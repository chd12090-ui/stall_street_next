// The local game database: SQLite (sql.js) in memory, saved to IndexedDB.
//
// Every API call runs inside withLocalDb(). Calls are serialized across tabs with
// the Web Locks API, and each call first checks whether another tab saved a newer
// copy. After a call that changed data, the whole SQLite file is written back.
import {createD1} from '../server/db/d1-adapter.mjs';
import {migrate} from '../server/db/migrate.mjs';
import {loadSqlJs, sqlJsEngine} from './sqljs.mjs';
import {createIndexedDbStore, createMemoryStore} from './idb-store.mjs';

const lockName = 'stall-street:local-db';
const defaults = {
  createEngine: async bytes => sqlJsEngine(await loadSqlJs(), bytes),
  store: null,
};
let config = {...defaults};
let storePromise;
let current = null;
let queue = Promise.resolve();

// Tests and tools can swap the engine factory or the store.
export function configureLocalDb(options = {}) {
  config = {...defaults, ...options};
  storePromise = undefined;
  current?.engine.close?.();
  current = null;
}

function exclusive(task) {
  if (globalThis.navigator?.locks?.request) return navigator.locks.request(lockName, task);
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

function getStore() {
  storePromise ??= (async () => {
    if (config.store) return config.store;
    if (typeof indexedDB !== 'undefined') {
      const store = createIndexedDbStore();
      try {
        await store.readMeta();
        return store;
      } catch (error) {
        console.warn('[stall-street] IndexedDB is unavailable; local game data will last for this tab only.', error);
      }
    }
    return createMemoryStore();
  })();
  return storePromise;
}

async function persist(state) {
  const bytes = await state.engine.export();
  const version = state.version + 1;
  await state.store.write(bytes, version);
  state.version = version;
  state.engine.clearDirty?.();
}

async function openCurrent() {
  const store = await getStore();
  const version = (await store.readMeta())?.version ?? 0;
  if (current && current.version === version && current.store === store) return current;
  // Another tab saved a newer copy (or site data was cleared): reload it.
  const bytes = version ? await store.readBytes() : null;
  current?.engine.close?.();
  current = null;
  const engine = await config.createEngine(bytes);
  const state = {engine, d1: createD1(engine), version, store};
  if (await migrate(engine)) await persist(state);
  current = state;
  return state;
}

export function withLocalDb(task) {
  return exclusive(async () => {
    const state = await openCurrent();
    state.engine.clearDirty?.();
    try {
      return await task(state.d1);
    } finally {
      if (state.engine.dirty && current === state) await persist(state);
    }
  });
}

// Loads sql.js and opens the database ahead of the first API call.
export const warmUpLocalDb = () => withLocalDb(() => {});

// Downloads-ready copy of the SQLite file (open it with any SQLite viewer).
export const exportLocalDb = () => withLocalDb(async () => current.engine.export());

// Deletes every room, chat and vote kept by the local game API in this browser.
export function resetLocalDb() {
  return exclusive(async () => {
    const store = await getStore();
    await store.clear();
    current?.engine.close?.();
    current = null;
  });
}

export async function localDbInfo() {
  const store = await getStore();
  return {store: store.kind, ...(await store.readMeta())};
}
