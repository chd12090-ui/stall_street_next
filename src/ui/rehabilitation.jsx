import {useLayoutEffect,useRef,useState} from 'react';
import {rehabilitationPosition,rehabilitationReward,rehabilitationView} from '../game/rehabilitation.mjs';
import {fmtMoney} from '../game/world.mjs';
import {Icon} from './controls.jsx';
import {RehabilitationArt} from './rehabilitation-art.jsx';

const won=amount=>fmtMoney(amount,'KRW');
const pct=fraction=>fraction*100+'%';
const buttonLabels={
  preview:'회생 신청하기',ready:'회생 신청하기',playing:'멈추기',won:'다음 판 시작',
  lastChance:'마지막 기회 시작',exhausted:'회생이 완료되었습니다.',withdrawn:'회생이 완료되었습니다.',
};

function roundNotice(view){
  switch(view.stage){
    case 'preview':return '순자산이 0원 미만일 때 신청할 수 있어.';
    case 'ready':return view.waitingForPayment?'처리 중인 거래가 끝나면 신청할 수 있어.':'자산과 대출을 정리하면 0원부터 시작해.';
    case 'playing':return view.misses?'마지막 기회야.':'';
    case 'won':return '딱지를 뒤집었어! '+won(rehabilitationReward)+'이 입금됐어.';
    case 'lastChance':return '은행 고양이에게 뺨을 한 대 맞았어. 마지막 기회야.';
    case 'exhausted':return '마지막 딱지가 빗나갔어. 회생이 끝났어.';
    case 'withdrawn':return '회생을 마쳤어.';
  }
}

function TimingGame({view,inputRevision,confirming,slapping}){
  const marker=useRef(null),control=useRef(null);
  const lastPaint=useRef(0),heldAt=useRef(0),pressedRound=useRef(null);
  const playing=view.stage==='playing';
  const {startedAt,duration,token,stoppedAt,perfectStart,perfectEnd}=view;
  useLayoutEffect(()=>{
    const button=control.current;
    heldAt.current=0;
    lastPaint.current=0;
    if(button)delete button.dataset.stoppedAt;
    function paint(time){
      const position=rehabilitationPosition(startedAt,duration,time);
      marker.current.style.left=pct(position);
      lastPaint.current=time;
    }
    if(!playing){
      if(stoppedAt&&startedAt)paint(stoppedAt);
      else marker.current.style.left='0%';
      return;
    }
    let frame=0;
    function draw(){
      if(!heldAt.current)paint(Date.now());
      frame=requestAnimationFrame(draw);
    }
    draw();
    return ()=>cancelAnimationFrame(frame);
  },[playing,token,startedAt,duration,stoppedAt,inputRevision]);

  // A touch can be held before its click fires. Judge the displayed frame at
  // contact and keep it on screen while the transaction saves that attempt.
  function hold(button){
    if(!playing||heldAt.current)return;
    const time=lastPaint.current||startedAt;
    heldAt.current=time;
    button.dataset.stoppedAt=String(time);
  }
  function release(button){
    heldAt.current=0;
    delete button.dataset.stoppedAt;
  }
  function press(button){
    pressedRound.current={token,stage:view.stage};
    hold(button);
  }
  function activate(event){
    const pressed=pressedRound.current;
    pressedRound.current=null;
    // A second tab may settle this round while a finger is still on the button.
    if(pressed&&(pressed.token!==token||pressed.stage!==view.stage)){
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    hold(event.currentTarget);
  }
  return <div className="rehab-controls">
    <div className="rehab-game">
      <div className="rehab-game-heading"><h3>딱지치기</h3><span>{view.round}번째 판</span></div>
      <p id="rehab-instructions">표시가 PERFECT 구간에 들어오면 멈추기를 눌러.</p>
      <div className="rehab-meter" data-started-at={startedAt??undefined} data-duration={duration}
        data-perfect-start={perfectStart} data-perfect-end={perfectEnd} aria-hidden="true"
        style={{'--goal-start':pct(perfectStart),'--goal-width':pct(perfectEnd-perfectStart),'--goal-center':pct((perfectStart+perfectEnd)/2)}}>
        <div className="rehab-track">
          <span className="rehab-perfect-zone"/><b className="rehab-target-label">PERFECT</b>
          <span className="rehab-mark" ref={marker}/>
        </div>
      </div>
      <dl className="rehab-accounts">
        <div><dt>{confirming?'정리 후 총자산':'얻은 돈'}</dt><dd>{won(confirming?0:view.wins*rehabilitationReward)}</dd></div>
        <div><dt>승리 시 지원금</dt><dd>+{won(rehabilitationReward)}</dd></div>
      </dl>
    </div>
    {confirming?<div className="rehab-action">
      <p id="rehab-clearance">회생을 확정하면 대출, 보유 종목, 예약 주문, 잔액이 모두 정리돼.</p>
      <div className="rehab-confirm-actions">
        <button type="button" className="ui-control" data-act="rehab-cancel">돌아가기</button>
        <button type="button" className="ui-control ui-primary" data-act="rehab-confirm" data-token={token||undefined}
          disabled={!view.canApply} aria-describedby="rehab-clearance">확정하고 시작</button>
      </div>
    </div>:<div className="rehab-action">
      <p role="status" aria-live="polite" aria-atomic="true" data-stage={view.stage}>{roundNotice(view)}</p>
      <button type="button" ref={control} className="rehab-submit ui-control ui-primary"
        data-act={playing?'rehab-stop':view.stage==='ready'?'rehab-apply':'rehab-start'} data-token={token||undefined}
        disabled={slapping||!playing&&!view.canStart&&!view.canApply} aria-describedby="rehab-instructions"
        onPointerDown={event=>{if(event.isPrimary&&event.button===0)press(event.currentTarget);}}
        onPointerCancel={event=>{pressedRound.current=null;release(event.currentTarget);}}
        onPointerLeave={event=>{if(event.buttons)release(event.currentTarget);}}
        onKeyDown={event=>{
          if(event.key!==' '&&event.key!=='Enter')return;
          if(event.repeat)event.preventDefault();
          else press(event.currentTarget);
        }}
        onBlur={event=>{pressedRound.current=null;release(event.currentTarget);}}
        onClickCapture={activate}>
        {buttonLabels[view.stage]}
      </button>
    </div>}
  </div>;
}

function RehabilitationExit({view,pending}){
  return <div className="rehab-exit">
    <section className="rehab-exit-panel" role="alertdialog" aria-modal="true" aria-labelledby="rehab-exit-title" aria-describedby="rehab-exit-question">
      <h3 id="rehab-exit-title">회생을 끝낼까?</h3>
      <p id="rehab-exit-question">지금까지 얻은 <strong>{won(view.wins*rehabilitationReward)}</strong>만 받고 나갈까?</p>
      <div className="rehab-confirm-actions">
        <button type="button" className="ui-control" data-act="rehab-stay" disabled={pending}>계속하기</button>
        <button type="button" className="ui-control ui-primary" data-act="rehab-leave" data-token={view.token} disabled={pending}>나가기</button>
      </div>
    </section>
  </div>;
}

export function RehabilitationSheet({state,modal}){
  const view=rehabilitationView(state);
  const {stage,token}=view;
  const leaving=modal?.leaving===true;
  const inert=leaving?'':undefined;
  const playedRound=useRef(null);
  const [finishedRound,setFinishedRound]=useState(null);
  useLayoutEffect(()=>{
    if(stage==='playing')playedRound.current=token;
  },[stage,token]);
  const art=stage==='lastChance'||stage==='exhausted'?'slap':stage==='won'?'win':'idle';
  const animationKey=art!=='idle'&&playedRound.current===token?token:undefined;
  const slapping=art==='slap'&&animationKey!==undefined&&finishedRound!==animationKey;
  return <section className="sheet shop-sheet rehab-sheet" role={leaving?undefined:'dialog'}
    aria-modal={leaving?undefined:'true'} aria-labelledby={leaving?undefined:'rehab-title'}>
    <button type="button" className="shop-close ui-control ui-icon" data-act="dismiss" aria-label="닫기" inert={inert}><Icon name="close"/></button>
    <div className="shop-scroll rehab-scroll" inert={inert}>
      <header className="shop-scene rehab-scene">
        <RehabilitationArt motion={art} animationKey={animationKey} onFinish={setFinishedRound}/>
        <h2 id="rehab-title">회생신청</h2>
      </header>
      <TimingGame view={view} inputRevision={modal?.inputRevision} confirming={view.stage==='ready'&&modal?.confirming} slapping={slapping}/>
    </div>
    {leaving&&<RehabilitationExit view={view} pending={modal.inputPending}/>}
  </section>;
}
