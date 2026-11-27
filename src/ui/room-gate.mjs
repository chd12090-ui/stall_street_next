import {restoreGuideCheckpoint} from '../game/field-guide-model.mjs';

// The lobby and the game share the same room service, including its in-memory guest scope.
export function createRoomGate(session, {readUrl, replaceUrl, loadGame}) {
  const initialUrl = readUrl();
  const invite = initialUrl.searchParams.get('room');
  const initialRoom = session.getRoomSession();
  let state = {
    page: 'loading', room: initialRoom, joining: Boolean(invite),
    invitation: session.normalizeRoomCode(invite), pending: '', error: '', status: '', focus: '',
  };
  const listeners = new Set();
  let guideKey, guidePage, guidePractice, waitTimer, generation = 0, disposed = false;

  function update(fields) {
    if (disposed) return;
    state = {...state, ...fields};
    for (const listener of listeners) listener();
  }
  function invalidate() {
    clearTimeout(waitTimer);
    return ++generation;
  }
  const current = ticket => !disposed && ticket === generation;
  function editUrl(action, roomCode) {
    const url = readUrl();
    const previous = url.href;
    if (action === 'back') {
      url.searchParams.delete('room');
      url.searchParams.set('lobby', '1');
      url.hash = '';
    } else {
      url.searchParams.delete('lobby');
      if (action === 'play') url.searchParams.delete('room');
      if (action === 'wait' && url.searchParams.has('room')) url.searchParams.set('room', roomCode);
    }
    if (url.href !== previous) replaceUrl(url);
  }
  function errorMessage(error) {
    return error instanceof TypeError || error?.name === 'TimeoutError'
      ? '방에 연결하지 못했어. 잠시 뒤 다시 시도해 줘.' : error.message;
  }
  async function openGame(room, manual) {
    const ticket = invalidate();
    update({room, page: 'loading', pending: '', status: ''});
    editUrl('play');
    try {
      await loadGame();
      if (current(ticket)) update({page: 'game', focus: manual ? 'game' : ''});
    } catch {
      if (current(ticket)) update({page: 'failed', focus: 'retry'});
    }
  }
  function beginPlay(room, fromLobby) {
    guideKey = session.guideRunKey();
    const progress = session.getGuideCheckpoint(guideKey);
    if (progress === 'done') return openGame(room, fromLobby);
    invalidate();
    editUrl('play');
    ({page:guidePage,practice:guidePractice}=restoreGuideCheckpoint(progress));
    session.saveGuideProgress(guidePage, guideKey, guidePractice);
    update({room, page: 'tutorial', guidePage, guidePractice, focus: '', pending: '', status: ''});
  }
  function choices({back = false, error = '', room = state.room, focus = back ? 'primary' : ''} = {}) {
    invalidate();
    if (back) editUrl('back');
    const guestResume = room?.mode === 'guest' && session.getGuideCheckpoint(session.guideRunKey()) !== null;
    update({page: 'choices', joining: back ? false : state.joining, pending: '', focus, error, status: '', room, guestResume});
  }
  function wait(room) {
    const ticket = invalidate();
    editUrl('wait', room.code);
    update({room, page: 'waiting', pending: '', focus: 'wait', status: ''});
    async function poll() {
      try {
        const next = await session.refreshRoom();
        if (!current(ticket)) return;
        if (!next) {
          choices({back: true, room: null, error: '방을 확인할 수 없어. 방 코드를 다시 확인해 줘.'});
          return;
        }
        if (next.started) {
          await beginPlay(next, true);
          return;
        }
        if (next !== state.room) update({room: next});
      } catch (error) {
        if (!current(ticket)) return;
        if ([401, 403, 404].includes(error.status)) {
          choices({back: true, room: null, error: '방을 확인할 수 없어. 방 코드를 다시 확인해 줘.'});
          return;
        }
      }
      if (current(ticket)) waitTimer = setTimeout(poll, 2000);
    }
    waitTimer = setTimeout(poll, 2000);
  }
  async function enter(room, manual) {
    if (room?.started) return beginPlay(room, manual);
    if (room) wait(room);
    else choices({room: null});
  }
  async function initialize() {
    disposed = false;
    const ticket = invalidate();
    if (!initialRoom || initialUrl.searchParams.has('lobby') || (invite && state.invitation !== initialRoom.code)) {
      choices();
      return;
    }
    try {
      const room = await session.restoreRoom();
      if (current(ticket)) await enter(room, false);
    } catch (error) {
      if (current(ticket)) choices({error: errorMessage(error)});
    }
  }
  async function admit(action, nickname, rawCode) {
    if (disposed || state.page !== 'choices' || state.pending) return;
    const code = session.normalizeRoomCode(rawCode);
    if (action === 'join' && !code) {
      update({error: '영문과 숫자로 된 방 코드 16자리를 확인해 줘.', focus: 'code'});
      return;
    }
    const ticket = invalidate();
    update({pending: action, error: '', focus: ''});
    try {
      let room;
      if (action === 'resume' || (action === 'guest' && state.room?.mode === 'guest')) room = await session.restoreRoom();
      else room = await session.enterRoom({action, code, nickname: nickname.trim()});
      if (!current(ticket)) return;
      if (!room) {
        const error = action === 'guest'
          ? '이어 할 게임을 찾지 못했어. 다시 누르면 새 게임을 열어.'
          : '기존 방을 찾지 못했어.';
        choices({back: true, room: null, error});
        return;
      }
      await enter(room, true);
    } catch (error) {
      if (current(ticket)) update({pending: '', error: errorMessage(error)});
    }
  }
  async function start() {
    if (state.page !== 'waiting' || state.pending || !state.room?.host || state.room.participants < 2) return;
    const ticket = invalidate();
    update({pending: 'start', status: ''});
    try {
      const room = await session.startRoom();
      if (current(ticket)) await enter(room, true);
    } catch (error) {
      if (!current(ticket)) return;
      // Starting and polling may race. Restart polling after a rejected start.
      wait(state.room);
      update({status: errorMessage(error)});
    }
  }
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    initialize, admit, start,
    rememberGuidePage(page) {
      if (disposed || state.page !== 'tutorial') return;
      guidePage = page;
      session.saveGuideProgress(guidePage, guideKey, guidePractice);
    },
    rememberGuidePractice(practice) {
      if (disposed || state.page !== 'tutorial') return;
      guidePractice = practice;
      session.saveGuideProgress(guidePage, guideKey, guidePractice);
    },
    finishGuide({home=false}={}) {
      if (state.page !== 'tutorial') return;
      session.saveGuideProgress('done', guideKey);
      if (home) {
        const url=readUrl();
        url.hash='home';
        replaceUrl(url);
      }
      return openGame(state.room, true);
    },
    join() { if (!state.pending) update({joining: true, error: '', focus: 'code'}); },
    back() {
      if (!state.pending) choices({back: true, focus: state.page === 'choices' && state.joining ? 'joinChoice' : 'primary'});
    },
    dispose() { disposed = true; invalidate(); },
  };
}
