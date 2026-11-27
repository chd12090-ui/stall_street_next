import test from 'node:test';
import assert from 'node:assert/strict';
import {FakeSqlJs} from '../test-support/fake-sqljs.mjs';
import {sqlJsEngine} from '../src/storage/sqljs.mjs';
import {createMemoryStore} from '../src/storage/idb-store.mjs';
import {configureLocalDb, resetLocalDb, localDbInfo, withLocalDb} from '../src/storage/browser-db.mjs';
import {localGameApi, LocalRequest} from '../src/storage/local-game-api.mjs';
import {gameApiMode} from '../src/storage/game-api-client.mjs';
import {readFileSync} from 'node:fs';

const origin = 'https://stall.example/';
const engine = bytes => sqlJsEngine(FakeSqlJs, bytes);

function freshDb(store = createMemoryStore()) {
  configureLocalDb({createEngine: engine, store});
  return store;
}

function call(path, {guest, room, body, method = body ? 'POST' : 'GET', signal} = {}) {
  const headers = {};
  if (guest) headers['X-Stall-Guest'] = guest;
  if (room) headers['X-Stall-Room'] = room;
  if (body) headers['Content-Type'] = 'application/json';
  return localGameApi(new URL(path, origin), {method, headers, body: body && JSON.stringify(body), signal});
}

const soloRoom = (guest, nickname = '테스트') =>
  call('./api/rooms', {guest, body: {action: 'guest', nickname, requestId: crypto.randomUUID()}});

test('outside a browser the client talks to the network; in a browser it answers locally', t => {
  const saved = process.env.NEXT_PUBLIC_GAME_API_MODE;
  t.after(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_GAME_API_MODE; else process.env.NEXT_PUBLIC_GAME_API_MODE = saved;
    delete globalThis.indexedDB;
  });
  delete process.env.NEXT_PUBLIC_GAME_API_MODE;
  assert.equal(gameApiMode(), 'remote');
  globalThis.indexedDB = {};
  assert.equal(gameApiMode(), 'local');
  process.env.NEXT_PUBLIC_GAME_API_MODE = 'remote';
  assert.equal(gameApiMode(), 'remote');
});

test('the in-browser request exposes a fresh body stream and parses JSON', async () => {
  const request = new LocalRequest(new URL('/api/rooms', origin), {method: 'post', text: '{"action":"guest"}'});
  assert.equal(request.method, 'POST');
  assert.equal(await new Response(request.body).text(), '{"action":"guest"}');
  assert.equal(await new Response(request.body).text(), '{"action":"guest"}');
  assert.deepEqual(await request.json(), {action: 'guest'});
  assert.equal(new LocalRequest(new URL('/api/rooms', origin)).body, null);
});

test('a solo room is created, saved and found again after the page reloads', async () => {
  const store = freshDb();
  const guest = crypto.randomUUID();
  const created = await soloRoom(guest);
  assert.equal(created.status, 200);
  const room = await created.json();
  assert.equal(room.mode, 'guest');
  assert.equal(room.started, true);
  assert.match(room.code, /^[A-HJ-NP-Z2-9]{16}$/);
  const saved = await store.readMeta();
  assert.ok(saved.version >= 1);

  // A reload starts with an empty module state and reads the stored SQLite file.
  configureLocalDb({createEngine: engine, store});
  const again = await call('./api/rooms', {guest, room: room.code});
  assert.equal(again.status, 200);
  assert.equal((await again.json()).code, room.code);
  // Reading does not rewrite the file.
  assert.equal((await store.readMeta()).version, saved.version);
});

test('a copy saved by another tab is picked up before the next request', async () => {
  const store = freshDb();
  const guest = crypto.randomUUID();
  const room = await (await soloRoom(guest, '첫이름')).json();

  // "Another tab" edits the shared file and saves a newer version.
  const other = engine(await store.readBytes());
  other.query('UPDATE friend_room_members SET nickname=? WHERE room_code=?', ['새이름', room.code]);
  await store.write(other.export(), (await store.readMeta()).version + 1);

  const current = await (await call('./api/rooms', {guest, room: room.code})).json();
  assert.equal(current.nickname, '새이름');
});

test('rejected requests come back as API errors, not exceptions', async () => {
  freshDb();
  const guest = crypto.randomUUID();
  const missing = await call('./api/rooms', {guest, room: 'ABCD2345EFGH6789'});
  assert.equal(missing.status, 403);
  assert.match((await missing.json()).error, /참가/);
  const noRoom = await call('./api/rituals', {guest});
  assert.equal(noRoom.status, 403);
  const noGuest = await call('./api/rooms', {room: 'ABCD2345EFGH6789'});
  assert.equal(noGuest.status, 401);
  const badJoin = await call('./api/rooms', {guest, body: {action: 'join', code: 'nope'}});
  assert.equal(badJoin.status, 400);
});

test('a broken database answers 503 and an aborted request rejects like fetch', async t => {
  configureLocalDb({createEngine: () => { throw new Error('wasm missing'); }, store: createMemoryStore()});
  t.mock.method(console, 'error', () => {});
  const response = await soloRoom(crypto.randomUUID());
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /브라우저 저장소/);

  freshDb();
  const controller = new AbortController();
  controller.abort(new DOMException('stop', 'AbortError'));
  await assert.rejects(call('./api/rooms', {guest: crypto.randomUUID(), signal: controller.signal}), {name: 'AbortError'});
});

test('requests from several callers are serialized and reset clears the stored data', async () => {
  const store = freshDb();
  const guests = Array.from({length: 4}, () => crypto.randomUUID());
  const rooms = await Promise.all(guests.map(guest => soloRoom(guest).then(response => response.json())));
  assert.equal(new Set(rooms.map(room => room.code)).size, 4);
  const count = await withLocalDb(db => db.prepare('SELECT COUNT(*) AS n FROM friend_rooms').first('n'));
  assert.equal(count, 4);
  assert.equal((await localDbInfo()).store, 'memory');
  await resetLocalDb();
  assert.equal(await store.readMeta(), null);
  assert.equal(await withLocalDb(db => db.prepare('SELECT COUNT(*) AS n FROM friend_rooms').first('n')), 0);
});

test('room-session uses the local API end to end when running in a browser', async t => {
  const storage = () => {
    const entries = new Map();
    return {getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, String(value)), removeItem: key => entries.delete(key)};
  };
  for (const [name, value] of [['localStorage', storage()], ['sessionStorage', storage()], ['indexedDB', {}], ['location', new URL(origin)]]) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {configurable: true, value});
    t.after(() => { if (original) Object.defineProperty(globalThis, name, original); else delete globalThis[name]; });
  }
  t.mock.method(globalThis, 'fetch', () => { throw new Error('local mode must not use the network'); });
  freshDb();
  const session = await import('../src/game/room-session.mjs?local-api');
  const room = await session.enterRoom({action: 'guest', nickname: '로컬'});
  assert.equal(room.mode, 'guest');
  assert.equal(room.started, true);
  assert.equal((await session.refreshRoom()).code, room.code);
  const progress = await (await session.roomFetch('./api/progress/reset', {cache: 'no-store'})).json();
  assert.deepEqual(progress, {progressId: ''});
});

test('the bundled migrations match db/migrations', async () => {
  const {migrations} = await import('../src/server/db/migrations.generated.mjs');
  const journal = JSON.parse(readFileSync(new URL('../db/migrations/meta/_journal.json', import.meta.url), 'utf8'));
  assert.deepEqual(migrations.map(item => item.name), journal.entries.map(entry => entry.tag));
  for (const {name, sql} of migrations)
    assert.equal(sql, readFileSync(new URL('../db/migrations/' + name + '.sql', import.meta.url), 'utf8'), name);
});
