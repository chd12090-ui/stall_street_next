import React, {useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import {createRoomGate} from './room-gate.mjs';
import {FieldGuide} from './field-guide.jsx';
import {StallIllustration} from './home-art.jsx';
import {bindSelectionAudio} from '../game/game-audio.mjs';

import {defaultNickname,limitNickname,nicknameLimit} from '../game/nickname.mjs';

const screenWidthKey = 'stall-street:screen-width';
const fixedWidths = ['360', '390', '412'];

function readScreenWidth() {
  try {
    const saved = localStorage.getItem(screenWidthKey);
    if (fixedWidths.includes(saved)) return saved;
  } catch {}
  return 'auto';
}

function applyScreenWidth(width) {
  const root = document.documentElement;
  root.toggleAttribute('data-fixed-game-width', width !== 'auto');
  if (width === 'auto') root.style.removeProperty('--fixed-game-width');
  else root.style.setProperty('--fixed-game-width', width + 'px');
}

function ScreenWidthPicker() {
  const [width, setWidth] = useState(readScreenWidth);
  function chooseWidth(event) {
    const next = event.currentTarget.value;
    setWidth(next);
    applyScreenWidth(next);
    try { localStorage.setItem(screenWidthKey, next); } catch {}
  }
  return <label className="room-width-picker">
    <span>가로 크기</span>
    <select className="ui-control ui-select ui-compact" value={width} onChange={chooseWidth}>
      <option value="auto">자동</option>
      {fixedWidths.map(size => <option key={size} value={size}>{size}px</option>)}
    </select>
  </label>;
}

function RoomCover({stage = 'entry', children}) {
  return <main id="room-lobby" data-stage={stage} aria-labelledby="room-game-title">
    <header className="room-cover">
      <div className="room-wordmark">
        <span className="room-imprint" lang="en">STALL STREET</span>
        <h1 id="room-game-title">변기투자</h1>
      </div>
      <StallIllustration interactive={stage === 'entry'}/>
    </header>
    <section className="room-panel">{children}</section>
  </main>;
}

export function RoomChoices({gate, state, nickname, setNickname, code, setCode}) {
  const {joining, pending, error, room, guestResume} = state;
  const busy = Boolean(pending);
  const guestLabel = guestResume ? '봇과 플레이 이어하기' : '혼자 봇과 플레이하기';
  const composingName = useRef(false);
  const codeField = useRef(null);
  const joinChoice = useRef(null);
  const primary = useRef(null);
  useLayoutEffect(() => {
    if (state.focus === 'code') codeField.current?.focus();
    if (state.focus === 'joinChoice') joinChoice.current?.focus({preventScroll:true});
    if (state.focus === 'primary') primary.current?.focus({preventScroll:true});
  }, [state.focus, error]);
  const admit = action => gate.admit(action, nickname, code);
  const joiningInvite = joining && Boolean(state.invitation) && code === state.invitation;
  return <form id="room-form" aria-busy={busy} onSubmit={event => {
    event.preventDefault();
    void admit(joining ? 'join' : 'guest');
  }}>
    <div className="room-heading">
      <h2 id="room-heading">{joining ? '친구 방 참가' : '게임 시작'}</h2>
      {joining ? <button type="button" className="room-back ui-control ui-compact" data-room-back="" onClick={gate.back} disabled={busy}>뒤로</button>
        : <ScreenWidthPicker/>}
    </div>
    {joining && <p id="room-hint">{joiningInvite ? '초대 링크의 방 코드를 채워 뒀어.' : '친구가 보낸 방 코드를 입력해.'}</p>}
    <label className="room-field"><span>닉네임 <small>(최대 {nicknameLimit}자)</small></span>
      <input name="nickname" autoComplete="off" spellCheck={false} value={nickname}
        onCompositionStart={()=>{composingName.current=true;}}
        onCompositionEnd={event=>{composingName.current=false;setNickname(limitNickname(event.currentTarget.value));}}
        onChange={event=>setNickname(composingName.current?event.target.value:limitNickname(event.target.value))} disabled={busy} />
    </label>
    {joining && <label className="room-field" id="room-code-field">방 코드
      <input ref={codeField} name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false}
        maxLength={48} placeholder="영문·숫자 16자리" value={code} required disabled={busy}
        aria-describedby={error ? 'room-error' : 'room-hint'} onChange={event => setCode(event.target.value)} />
    </label>}
    {error && <p id="room-error" className="room-error" role="alert">{error}</p>}
    {joining ? <div className="room-actions">
      <button ref={primary} type="submit" className="ui-control ui-primary full" id="room-primary" disabled={busy}>
        {pending === 'join' ? '참가하는 중…' : '참가하기'}
      </button>
    </div> : <div className="room-actions">
      <button ref={primary} type="submit" className="room-solo ui-control ui-primary full" id="room-primary" data-room-guest="" disabled={busy}>
        {pending === 'guest' ? '게임 여는 중…' : guestLabel}
      </button>
      <button type="button" className="ui-control" data-room-create="" onClick={() => admit('create')} disabled={busy}>
        {pending === 'create' ? '방 만드는 중…' : '방 만들기'}
      </button>
      <button type="button" className="ui-control" ref={joinChoice} data-room-join="" onClick={gate.join} disabled={busy}>참가하기</button>
    </div>}
    {!joining && room?.mode === 'multiplayer' &&
      <div className="room-resume-wrap"><button type="button" className="ui-control ui-compact" data-room-resume="" onClick={() => admit('resume')} disabled={busy}>
        {pending === 'resume' ? '방 확인 중…' : '기존 방으로 돌아가기'}
      </button></div>}
  </form>;
}

export function WaitingRoom({gate, state, inviteUrl}) {
  const {room, pending, status} = state;
  const [link, setLink] = useState('');
  const [copied, setCopied] = useState('');
  const heading = useRef(null);
  const field = useRef(null);
  useLayoutEffect(() => { heading.current?.focus({preventScroll:true}); }, []);
  useLayoutEffect(() => {
    if (link) { field.current?.focus(); field.current?.select(); }
  }, [link]);
  const ready = room.participants >= 2;
  async function copyInvite() {
    const url = inviteUrl(room.code);
    try {
      await navigator.clipboard.writeText(url);
      setCopied('초대 링크를 복사했어.');
    } catch {
      setLink(url);
      field.current?.focus();
      field.current?.select();
      setCopied('선택된 링크를 복사해 친구에게 보내 줘.');
    }
  }
  return <section id="room-created" aria-labelledby="room-created-title">
    <div className="room-heading">
      <h2 ref={heading} id="room-created-title" tabIndex={-1}>방 대기실</h2>
      <button type="button" className="room-back ui-control ui-compact" data-room-wait-back="" disabled={Boolean(pending)} onClick={gate.back}>뒤로</button>
    </div>
    <p id="room-created-hint">{room.host
      ? ready ? '친구가 도착했어. 함께 장을 열어 봐.' : '친구에게 방 코드나 초대 링크를 보내 줘. 둘이 모이면 시작할 수 있어.'
      : '방장이 시작하면 함께 게임에 들어가.'}</p>
    <div className="room-ticket"><div><span>방 코드</span><p id="room-member-status" className="room-member-status" role="status">참가자 {room.participants}명</p></div>
      <strong id="room-created-code">{room.code.match(/.{1,4}/g).join(' ')}</strong>
    </div>
    {link && <label className="room-field" id="room-link-field">초대 링크<input ref={field} readOnly value={link} /></label>}
    <p id="room-share-status" className="room-share-status" role="status">{status || copied}</p>
    <div className="room-actions">
      <button type="button" className={'btn light ui-control' + (room.host ? '' : ' full')} data-room-copy="" onClick={copyInvite}>초대 링크 복사</button>
      {room.host && <button type="button" className="btn primary ui-control ui-primary" data-room-play="" disabled={!ready || Boolean(pending)}
        onClick={() => { setCopied(''); void gate.start(); }}>{pending ? '게임 시작 중…' : '게임 시작'}</button>}
    </div>
  </section>;
}

function RetryGame() {
  const retry = useRef(null);
  useLayoutEffect(() => { retry.current?.focus(); }, []);
  return <RoomCover stage="retry"><section aria-labelledby="room-created-title">
    <div className="room-heading"><h2 id="room-created-title">게임을 불러오지 못했어</h2></div>
    <p>연결을 확인하고 다시 시도해 줘.</p>
    <div className="room-actions"><button ref={retry} type="button" className="btn primary ui-control ui-primary full" data-room-play=""
      onClick={() => location.reload()}>다시 시도</button></div>
  </section></RoomCover>;
}

function Landing({gate, inviteUrl, roomSoundEnabled, frame, onReady}) {
  const state = useSyncExternalStore(gate.subscribe, gate.getSnapshot, gate.getSnapshot);
  const [nickname, setNickname] = useState(() => state.room?.nickname || defaultNickname());
  const [code, setCode] = useState(state.invitation);
  useEffect(() => {
    void gate.initialize();
    return gate.dispose;
  }, [gate]);
  useLayoutEffect(() => {
    if (state.page === 'game') {
      delete frame.dataset.roomGate;
      if (state.focus === 'game') {
        const target = frame.querySelector('[role="dialog"] [tabindex="-1"]') || frame.querySelector('#screen');
        target?.focus({preventScroll: true});
      }
      onReady();
    } else {
      frame.dataset.roomGate = ['loading','tutorial'].includes(state.page) ? state.page : 'lobby';
    }
  }, [frame, onReady, state.page, state.focus]);
  switch (state.page) {
    case 'loading': return null;
    case 'game': return null;
    case 'tutorial': return <main className="guide-entry" aria-label="게임 튜토리얼">
      <FieldGuide sound={roomSoundEnabled()} nickname={state.room?.nickname||nickname} initialPage={state.guidePage} initialPractice={state.guidePractice} onPage={gate.rememberGuidePage}
        onPractice={gate.rememberGuidePractice} onExit={gate.finishGuide} onStart={()=>gate.finishGuide({home:true})}/>
    </main>;
    case 'failed': return <RetryGame />;
    default: return <RoomCover stage={state.page === 'waiting' ? 'wait' : state.joining ? 'join' : 'entry'}>{state.page === 'waiting'
      ? <WaitingRoom gate={gate} state={state} inviteUrl={inviteUrl} />
      : <RoomChoices gate={gate} state={state} nickname={nickname} setNickname={setNickname} code={code} setCode={setCode} />}
    </RoomCover>;
  }
}

export async function mountLanding() {
  applyScreenWidth(readScreenWidth());
  const frame = document.getElementById('frame');
  const roomRoot = document.getElementById('room-root');
  const root = createRoot(roomRoot);
  try {
    const session = await import('../game/room-session.mjs');
    const gate = createRoomGate(session, {
      readUrl: () => new URL(location.href),
      replaceUrl: url => history.replaceState(history.state, '', url),
      loadGame: () => import('../game/app.mjs'),
    });
    const unbindSelectionAudio = bindSelectionAudio(roomRoot, session.roomSoundEnabled);
    root.render(<Landing gate={gate} inviteUrl={session.roomInviteUrl} roomSoundEnabled={session.roomSoundEnabled} frame={frame} onReady={() => queueMicrotask(() => {
      unbindSelectionAudio();
      root.unmount();
    })} />);
  } catch {
    frame.dataset.roomGate = 'lobby';
    root.render(<RetryGame />);
  }
}
