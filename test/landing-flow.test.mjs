import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomGate} from '../src/ui/room-gate.mjs';
import {normalizeRoomCode} from '../src/game/room-session.mjs';
import {guideSteps,practiceTicker,restorePractice} from '../src/game/field-guide-model.mjs';
import {loadJsx, renderView} from '../test-support/render-jsx.mjs';
const {RoomChoices, WaitingRoom} = await loadJsx(new URL('../src/ui/landing.jsx', import.meta.url));

// The static frame the Next.js page renders before the client takes over.
const {gameFrameMarkup: html} = await import('../src/components/game-frame-markup.mjs');
const code = 'ABCD2345EFGH6789';
const gameRoom = {code, nickname: '테스트', mode: 'multiplayer', started: true, participants: 2, host: true};
const waitingRoom = {...gameRoom, started: false, participants: 1};

function fixture(t, {room = null, search = '', guide = 'done', practice = null} = {}) {
  let url = new URL('https://stall.example/' + search);
  const restore = Promise.withResolvers();
  const app = Promise.withResolvers();
  const appStarted = Promise.withResolvers();
  let gameLoads = 0;
  const session = {
    guideRunKey: () => code,
    getGuideProgress: () => guide,
    getGuideCheckpoint: () => typeof guide === 'number' ? {page: guide, practice} : guide,
    saveGuideProgress: (page, key, nextPractice) => { guide = page; practice = nextPractice ?? null; },
    getRoomSession: () => room,
    normalizeRoomCode,
    restoreRoom: () => restore.promise,
    enterRoom: () => { throw new Error('unexpected admission'); },
    refreshRoom: () => room,
    startRoom: () => { throw new Error('unexpected start'); },
  };
  const gate = createRoomGate(session, {
    readUrl: () => new URL(url),
    replaceUrl: next => { url = next; },
    loadGame: () => { gameLoads++; appStarted.resolve(); return app.promise; },
  });
  t.after(gate.dispose);
  function view() {
    const state = gate.getSnapshot();
    return state.page === 'waiting'
      ? renderView(WaitingRoom, {gate, state, inviteUrl: () => ''})
      : state.page === 'choices'
        ? renderView(RoomChoices, {gate, state, nickname: '', code: state.invitation})
        : '';
  }
  return {gate, session, restore, app, appStarted, state: gate.getSnapshot, view, url: () => url, loads: () => gameLoads};
}

test('the landing stays hidden through automatic room restoration and game initialization', async t => {
  assert.match(html, /id="frame" data-room-gate="loading"/);
  assert.match(html, /id="room-loading" role="status"[\s\S]*<svg[^>]+aria-hidden="true"[\s\S]*room-loader-crash[\s\S]*게임 연결 중…/);
  assert.doesNotMatch(html, /id="room-form"/);
  const f = fixture(t, {room: gameRoom, search: '#market/0'});
  const mounted = f.gate.initialize();
  assert.equal(f.state().page, 'loading');
  f.restore.resolve(gameRoom);
  await f.appStarted.promise;
  assert.equal(f.state().page, 'loading');
  f.app.resolve();
  await mounted;
  assert.equal(f.state().page, 'game');
  assert.equal(f.url().hash, '#market/0');
});

test('the landing exposes the three room choices and the screen-width picker', async t => {
  const f = fixture(t);
  await f.gate.initialize();
  assert.equal(f.state().page, 'choices');
  assert.match(f.view(), /닉네임 <small>\(최대 6자\)<\/small><\/span><input [^>]*\bname="nickname"/);
  assert.match(f.view(), /<h2 id="room-heading">게임 시작<\/h2><label class="room-width-picker"><span>가로 크기<\/span><select[^>]*><option value="auto" selected="">자동<\/option>/);
  for (const size of [360,390,412]) assert.ok(f.view().includes('<option value="' + size + '">' + size + 'px</option>'));
  for (const label of ['혼자 봇과 플레이하기', '방 만들기', '참가하기']) assert.ok(f.view().includes('>' + label + '<'), label);
});

test('the landing appears after the server rejects a previously saved room', async t => {
  const f = fixture(t, {room: gameRoom});
  const mounted = f.gate.initialize();
  assert.equal(f.state().page, 'loading');
  f.restore.resolve(null);
  await mounted;
  assert.equal(f.state().room, null);
  assert.equal(f.state().page, 'choices');
});

test('an explicit landing visit exposes the choices while the old room status is pending', async t => {
  const f = fixture(t, {room: gameRoom, search: '?lobby=1'});
  await f.gate.initialize();
  assert.equal(f.state().page, 'choices');
  assert.match(f.view(), /기존 방으로 돌아가기/);
  f.restore.resolve(gameRoom);
  assert.equal(f.state().page, 'choices');
});

test('a rejected room resume clears the stale room button', async t => {
  const f = fixture(t, {room: gameRoom, search: '?lobby=1'});
  await f.gate.initialize();
  assert.match(f.view(), /기존 방으로 돌아가기/);
  f.restore.resolve(null);
  await f.gate.admit('resume', '테스트', '');
  assert.equal(f.state().page, 'choices');
  assert.equal(f.state().room, null);
  assert.equal(f.state().focus, 'primary');
  assert.match(f.view(), /기존 방을 찾지 못했어/);
  assert.doesNotMatch(f.view(), /기존 방으로 돌아가기/);
});

test('restoring a waiting room from its invite keeps a lone host in the waiting room', async t => {
  const f = fixture(t, {room: waitingRoom, search: '?room=' + code});
  let starts = 0;
  f.session.startRoom = () => { starts++; };
  f.restore.resolve(waitingRoom);
  await f.gate.initialize();
  assert.equal(f.state().page, 'waiting');
  assert.match(f.view(), /<button[^>]*data-room-play=""[^>]*disabled/);
  await f.gate.start();
  assert.equal(starts, 0);
});

test('a returning guest enters immediately as a solo player', async t => {
  const f = fixture(t);
  const actions = [];
  f.session.enterRoom = ({action}) => {
    actions.push(action);
    return {...gameRoom, mode: 'guest', participants: 1};
  };
  await f.gate.initialize();
  f.app.resolve();
  await f.gate.admit('guest', '손님', '');
  assert.deepEqual(actions, ['guest']);
  assert.equal(f.state().page, 'game');
  assert.equal(f.state().focus, 'game');
});

test('a solo run can resume from the landing while a reset shows the new-game label', async t => {
  const room = {...gameRoom, mode: 'guest', participants: 1};
  const checkpoint = fixture(t, {room, search: '?lobby=1', guide: 1, practice: restorePractice()});
  await checkpoint.gate.initialize();
  assert.match(checkpoint.view(), />봇과 플레이 이어하기</);
  checkpoint.restore.resolve(room);
  await checkpoint.gate.admit('guest', '테스트', '');
  assert.equal(checkpoint.state().page, 'tutorial');
  assert.equal(checkpoint.state().guidePage, 1);

  const reset = fixture(t, {room, search: '?lobby=1', guide: null});
  await reset.gate.initialize();
  assert.match(reset.view(), />혼자 봇과 플레이하기</);
});

test('the host can start after a second player joins', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const f = fixture(t, {room: waitingRoom});
  f.restore.resolve(waitingRoom);
  await f.gate.initialize();
  f.session.refreshRoom = () => ({...waitingRoom, participants: 2});
  t.mock.timers.tick(2000);
  await Promise.resolve();
  assert.equal(f.state().room.participants, 2);
  assert.doesNotMatch(f.view(), /<button[^>]*data-room-play=""[^>]*disabled/);
  f.session.startRoom = () => gameRoom;
  f.app.resolve();
  await f.gate.start();
  assert.equal(f.state().page, 'game');
});

test('an invited player stays in the lobby until the host starts the game', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const f = fixture(t, {search: '?room=' + code});
  const guest = {...gameRoom, started: false, host: false};
  f.session.enterRoom = ({action, code: joinedCode}) => {
    assert.equal(action, 'join');
    assert.equal(joinedCode, code);
    return guest;
  };
  await f.gate.initialize();
  assert.equal(f.state().invitation, code);
  await f.gate.admit('join', '참가자', code);
  assert.equal(f.state().page, 'waiting');
  assert.doesNotMatch(f.view(), /data-room-play=/);
  f.session.refreshRoom = () => ({...guest, started: true});
  t.mock.timers.tick(2000);
  await f.appStarted.promise;
  assert.equal(f.state().page, 'loading');
  f.app.resolve();
  await new Promise(setImmediate);
  assert.equal(f.state().page, 'game');
});

test('a pending waiting-room refresh cannot open the game after choosing to go back', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const f = fixture(t, {room: waitingRoom});
  f.restore.resolve(waitingRoom);
  const response = Promise.withResolvers();
  f.session.refreshRoom = () => response.promise;
  await f.gate.initialize();
  t.mock.timers.tick(2000);
  f.gate.back();
  response.resolve(gameRoom);
  await new Promise(setImmediate);
  assert.equal(f.state().page, 'choices');
  assert.equal(f.url().searchParams.get('lobby'), '1');
});

test('loading failure after room admission exposes the retry state', async t => {
  const f = fixture(t, {room: gameRoom});
  const mounted = f.gate.initialize();
  f.restore.resolve(gameRoom);
  await f.appStarted.promise;
  f.app.reject(new Error('network'));
  await mounted;
  assert.equal(f.state().page, 'failed');
});

test('an expired solo save requires a new start choice before creating another game', async t => {
  const solo = {...gameRoom, mode: 'guest', participants: 1};
  const f = fixture(t, {room: solo, search: '?lobby=1'});
  const actions = [];
  f.session.enterRoom = ({action}) => { actions.push(action); return solo; };
  f.restore.resolve(null);
  f.app.resolve();
  await f.gate.initialize();
  assert.match(f.view(), />봇과 플레이 이어하기</);
  await f.gate.admit('guest', '손님', '');
  assert.deepEqual(actions, []);
  assert.match(f.view(), /이어 할 게임을 찾지 못했어/);
  assert.match(f.view(), />혼자 봇과 플레이하기</);
  await f.gate.admit('guest', '손님', '');
  assert.deepEqual(actions, ['guest']);
  assert.equal(f.state().page, 'game');
});

test('refresh after correcting an invite code restores the waiting room actually joined', async t => {
  const actual = {...waitingRoom, code: 'QWER2345TYUF6789', host: false, participants: 2};
  const f = fixture(t, {search: '?room=' + code});
  await f.gate.initialize();
  assert.equal(f.state().invitation, code);
  f.session.enterRoom = ({code: admitted}) => { assert.equal(admitted, actual.code); return actual; };
  await f.gate.admit('join', '손님', 'qwer 2345 tyuf 6789');
  assert.equal(f.state().page, 'waiting');
  assert.equal(f.url().searchParams.get('room'), actual.code);
  const reopened = fixture(t, {room: actual, search: f.url().search});
  reopened.restore.resolve(actual);
  await reopened.gate.initialize();
  assert.equal(reopened.state().page, 'waiting');
  assert.equal(reopened.state().room.code, actual.code);
});

test('first solo admission opens the cutscenes before loading the game and skipping loads it once', async t => {
  const f = fixture(t, {guide: null, search: '?lobby=1'});
  f.session.enterRoom = () => ({...gameRoom, mode: 'guest'});
  await f.gate.initialize();
  await f.gate.admit('guest', '치즈냥', '');
  assert.equal(f.state().page, 'tutorial');
  assert.equal(f.session.getGuideProgress(), 0);
  assert.equal(f.loads(), 0);
  assert.equal(f.url().search, '');
  const practice = restorePractice({evidence:'freight'});
  f.gate.rememberGuidePractice(practice);
  f.gate.rememberGuidePage(1);
  assert.deepEqual(f.session.getGuideCheckpoint(), {page:1, practice});
  f.gate.rememberGuidePage(0);
  assert.deepEqual(f.session.getGuideCheckpoint(), {page:0, practice});
  const entering = f.gate.finishGuide();
  await f.gate.finishGuide();
  f.gate.rememberGuidePage(0);
  f.app.resolve();
  await entering;
  assert.equal(f.state().page, 'game');
  assert.equal(f.loads(), 1);
  assert.equal(f.session.getGuideProgress(), 'done');
});

test('the first guide for an invited player starts after the room has started', async t => {
  t.mock.timers.enable({apis: ['setTimeout']});
  const f = fixture(t, {guide: null, search: '?room=' + code});
  f.session.enterRoom = () => ({...waitingRoom, host: false});
  await f.gate.initialize();
  await f.gate.admit('join', '참가자', code);
  assert.equal(f.state().page, 'waiting');
  assert.equal(f.session.getGuideProgress(), null);
  f.session.refreshRoom = () => ({...gameRoom, host: false});
  t.mock.timers.tick(2000);
  await new Promise(setImmediate);
  assert.equal(f.state().page, 'tutorial');
  assert.equal(f.session.getGuideProgress(), 0);
  assert.equal(f.loads(), 0);
});

test('a v143 guide resumes at the equivalent exercise and keeps its practice order and deep link', async t => {
  const practice = {evidence:'freight', qty:2, filled:true, conclusion:null};
  const f = fixture(t, {guide: 2, practice, room: gameRoom, search: '#market/0'});
  f.restore.resolve(gameRoom);
  await f.gate.initialize();
  assert.equal(f.state().page, 'tutorial');
  assert.equal(f.state().guidePage, guideSteps.indexOf('account'));
  assert.deepEqual(f.state().guidePractice, restorePractice({...practice,market:practiceTicker}));
  f.app.resolve();
  await f.gate.finishGuide();
  assert.equal(f.url().hash, '#market/0');
});

test('an unfinished page-only tutorial starts with the first cutscene', async t => {
  const f = fixture(t, {guide: 2, room: gameRoom});
  f.restore.resolve(gameRoom);
  await f.gate.initialize();
  assert.equal(f.state().page, 'tutorial');
  assert.equal(f.state().guidePage, 0);
  assert.deepEqual(f.state().guidePractice, restorePractice());
});

test('a current guide resumes after either cutscene or an unfinished recovery exercise', async t => {
  const opening = fixture(t, {guide: 1, practice: restorePractice(), room: gameRoom});
  opening.restore.resolve(gameRoom);
  await opening.gate.initialize();
  assert.equal(guideSteps[opening.state().guidePage], 'ranks');

  const practice = restorePractice({evidence:'freight',market:practiceTicker,qty:1,filled:true,conclusion:'valuation',mental:'drained'});
  const recovery = fixture(t, {guide: guideSteps.indexOf('mental'), practice, room: gameRoom});
  recovery.restore.resolve(gameRoom);
  await recovery.gate.initialize();
  assert.equal(guideSteps[recovery.state().guidePage], 'mental');
  assert.deepEqual(recovery.state().guidePractice, practice);
});

test('a fresh run restored through a deep link also shows onboarding', async t => {
  const f = fixture(t, {guide: null, room: gameRoom, search: '#market/0'});
  f.restore.resolve(gameRoom);
  await f.gate.initialize();
  assert.equal(f.state().page, 'tutorial');
  assert.equal(f.state().guidePage, 0);
  f.app.resolve();
  await f.gate.finishGuide();
  assert.equal(f.url().hash, '#market/0');
});

test('starting at the end of the guide opens home even after entering through a deep link', async t => {
  const f=fixture(t,{guide:null,room:gameRoom,search:'#market/0'});
  f.restore.resolve(gameRoom);
  await f.gate.initialize();
  f.app.resolve();
  await f.gate.finishGuide({home:true});
  assert.equal(f.state().page,'game');
  assert.equal(f.url().hash,'#home');
});
