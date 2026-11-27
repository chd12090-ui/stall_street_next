import React,{useEffect,useRef,useState} from 'react';
import {stocks,symbolIndex,fmtMoney} from '../game/world.mjs';
import {ritualCostPercent,ritualMarketCapPercent,ritualImpactBps,ritualArticleId,ritualPercent,ritualTarget} from '../game/ritual-rules.mjs';
import {RITUAL_SPRITE,ritualDanceMs,ritualFinaleStartMs,ritualPetMs} from '../game/ritual-choreography.mjs';
import {ritualRoom,ritualForeground,paintRitualFrame} from '../game/ritual-performance.mjs';
import {playGameSound} from '../game/game-audio.mjs';
import {petCharacter} from '../game/player-character.mjs';
import {legacyRitualOrphan,sharedRitualRepairDue} from '../game/game-progress.mjs';
import {sharedRituals} from '../game/ritual-room.mjs';
import {ritualQuote,ritualUsedToday} from '../game/ritual.mjs';
import {CompanyMark} from './exchange-controls.jsx';
import {PetTarget} from './petting.jsx';

const targets=stocks.filter(asset=>ritualTarget(asset.code));
const groups=[['한국 증시','mora'],['미국 증시','arden']].map(([name,market])=>({name,assets:targets.filter(asset=>asset.market===market)}));
const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
const art='/art/pixel/ritual-';
const maximumImpact='최대 -'+ritualPercent(ritualImpactBps.max/100)+'%';
const foregroundPosition={
  width:100*ritualForeground.scale+'%',height:100*ritualForeground.scale+'%',
  left:50*(1-ritualForeground.scale)+'%',top:100*ritualForeground.top/ritualRoom.height+'%',
};
const actorPosition={
  left:100*(ritualRoom.footX-RITUAL_SPRITE.feetX)/ritualRoom.width+'%',
  top:100*(ritualRoom.footY-RITUAL_SPRITE.feetY)/ritualRoom.height+'%',
  width:100*RITUAL_SPRITE.width/ritualRoom.width+'%',
};

function SeatedCat({sound}){
  const [petting,setPetting]=useState(false);
  const sheet=useRef(null),loading=useRef(false);
  function pet(button){
    const image=sheet.current;
    if(!image.complete||!image.naturalWidth){
      if(!loading.current){
        loading.current=true;
        void image.decode().then(()=>{if(button.isConnected)pet(button);}).catch(()=>{}).finally(()=>{loading.current=false;});
      }
      return;
    }
    if(!petCharacter(button))return;
    setPetting(true);
    if(sound)playGameSound('pet');
  }
  return <div className="ritual-seated" data-pet-stage="" style={{'--pet-duration':ritualPetMs+'ms'}}>
    <span className="ritual-still" style={actorPosition} aria-hidden="true">
      <img className="ritual-idle" src={art+'cat-idle.webp'} width={RITUAL_SPRITE.width} height={RITUAL_SPRITE.height} draggable={false} alt=""/>
      <picture className="ritual-stroke">
        <source media="(prefers-reduced-motion: reduce)" srcSet={art+'cat-pet-still.webp'}/>
        <img ref={sheet} src={art+'cat-pet.webp'} onAnimationEnd={()=>setPetting(false)} draggable={false} alt=""/>
      </picture>
    </span>
    <PetTarget className="ritual-pet-target" label="검은 고양이 쓰다듬기" onPet={pet}/>
    <span className="sr-only" role="status">{petting?'고양이가 손길에 기대어 꼬리를 올렸어.':''}</span>
  </div>;
}

function RitualStage({started,finished,canPet,sound,prepareDance}) {
  const canvasRef=useRef(null),actor=useRef(null);
  useEffect(()=>{
    if(started==null&&(!prepareDance||reduced())){actor.current=null;return;}
    if(!actor.current){
      const image=new Image();
      image.src=art+'cat-atlas.webp';
      const decoded=image.decode().then(()=>image).catch(()=>{
        if(actor.current===decoded)actor.current=null;
        return null;
      });
      actor.current=decoded;
    }
    if(started==null)return;
    const canvas=canvasRef.current,foreground=canvas.parentElement,ctx=canvas.getContext('2d');
    if(!ctx)return;
    let active=true,timer,atlas;
    function draw(){
      clearTimeout(timer);
      if(!active||!atlas||document.hidden)return;
      const elapsed=Math.max(0,Date.now()-started);
      const next=paintRitualFrame(ctx,atlas,elapsed);
      if(!foreground.hasAttribute('data-painted'))foreground.dataset.painted='';
      if(next>elapsed)timer=setTimeout(draw,Math.max(1,started+next-Date.now()));
    }
    ctx.imageSmoothingEnabled=false;
    void actor.current.then(image=>{atlas=image;draw();});
    document.addEventListener('visibilitychange',draw);
    return ()=>{active=false;clearTimeout(timer);document.removeEventListener('visibilitychange',draw);delete foreground.dataset.painted;};
  },[started,prepareDance]);
  const description=started!=null?'나무 소리에 검은 고양이가 작두 위로 뛰어올라 몸을 돌리며 칼춤을 추고, 바닥으로 내려와 다시 앉는다.':
    finished?'칼춤을 마친 검은 고양이가 작두를 등지고 안개 속에 앉아 있다.':'안개가 흐르는 당집에서 넓은 갓을 쓴 검은 고양이가 작두를 등지고 앉아 있다.';
  return <figure className="ritual-stage" role="group" aria-label="살굿 무대">
    <picture className="ritual-backdrop" role="img" aria-label={description}>
      <source media="(prefers-reduced-motion: reduce)" srcSet={art+'room.webp'}/>
      <img className="ritual-room" src={art+'room-mist.webp'} width={ritualRoom.width} height={ritualRoom.height} alt="" draggable={false}/>
    </picture>
    <div className="ritual-foreground" style={foregroundPosition}>
      <img className="ritual-platform" src={art+'platform.webp'} width={ritualRoom.width} height={ritualRoom.height} alt="" draggable={false}/>
      {canPet?<SeatedCat sound={sound}/>:<img className="ritual-still" style={actorPosition} src={art+'cat-idle.webp'}
        width={RITUAL_SPRITE.width} height={RITUAL_SPRITE.height} alt="" draggable={false}/>}
      <canvas ref={canvasRef} width={ritualRoom.width} height={ritualRoom.height} aria-hidden="true"/>
    </div>
    <picture className="ritual-foremist" aria-hidden="true">
      <source media="(prefers-reduced-motion: reduce)" srcSet={art+'foremist-still.webp'}/>
      <img src={art+'foremist.webp'} width={ritualRoom.width} height={ritualRoom.height} alt="" draggable={false}/>
    </picture>
  </figure>;
}

function OfferingTerms({offer,chance,recorded}){
  const [open,setOpen]=useState(null);
  const anchor=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const trigger=anchor.current;
    const outside=event=>{if(!trigger.parentElement?.contains(event.target))setOpen(null);};
    function escape(event){
      if(event.key==='Escape'){setOpen(null);trigger.focus({preventScroll:true});}
    }
    document.addEventListener('pointerdown',outside);
    document.addEventListener('focusin',outside);
    document.addEventListener('keydown',escape);
    return ()=>{
      document.removeEventListener('pointerdown',outside);
      document.removeEventListener('focusin',outside);
      document.removeEventListener('keydown',escape);
    };
  },[open]);
  function term(id,label,value,note){
    const active=open===id,hintId='ritual-hint-'+id;
    return <div><dt>{label}
      <button type="button" className="ritual-help" aria-label={label+' 설명'} aria-expanded={active} aria-controls={hintId}
        aria-describedby={active?hintId:undefined} onClick={event=>{anchor.current=event.currentTarget;setOpen(active?null:id);}}>
        <span aria-hidden="true">!</span>
      </button>
      <span className="ritual-hint" id={hintId} role="note" hidden={!active}>{note}</span>
    </dt><dd>{value}</dd></div>;
  }
  return <dl className="ritual-terms">
    {term('cost','제물',fmtMoney(offer.cost),recorded?'결제할 때 확정된 금액이야.':
      '총자산의 '+ritualCostPercent+'% + 선택한 회사 시가총액의 '+ritualMarketCapPercent+'%')}
    {term('mental','정신력',ritualPercent(offer.mental),'보유 정신력을 모두 써.')}
    <div><dt>성공 확률</dt><dd>{chance}%</dd></div>
    <div><dt>가격 충격</dt><dd>{maximumImpact}</dd></div>
  </dl>;
}

export function RitualPage({state}){
  const last=state.ritualLast,pending=state.ritualPending,record=pending??last;
  const [code,setCode]=useState(()=>ritualTarget(record?.code)?record.code:targets[0].code);
  const [dismissed,setDismissed]=useState(null);
  const [,refresh]=useState(0);
  const elapsed=Date.now()-(record?.started??0);
  const dancing=Boolean(record&&!reduced()&&elapsed<ritualDanceMs);
  const finale=dancing&&elapsed>=ritualFinaleStartMs;
  const boundary=dancing?(finale?ritualDanceMs:ritualFinaleStartMs):null;
  useEffect(()=>{
    if(boundary==null)return;
    const timer=setTimeout(()=>refresh(value=>value+1),Math.max(1,record.started+boundary-Date.now()+2));
    return ()=>clearTimeout(timer);
  },[record?.started,boundary]);
  const settled=last&&!pending&&!dancing&&dismissed!==last.id;
  const busy=dancing||Boolean(pending),showReceipt=busy||settled;
  const target=stocks[symbolIndex[showReceipt?record.code:code]],offer=showReceipt?record:ritualQuote(state,code);
  const usedToday=showReceipt?ritualUsedToday(state):offer.usedToday;
  // Old receipts store the amount spent and the mental points, before chance was snapshotted.
  const legacy=showReceipt&&record.chance==null;
  const chance=legacy?record.mental*.7:offer.chance;
  const outcome=busy?(dancing?(finale?'마지막 장단이야.':'굿을 치르는 중…'):'굿의 결과를 확인하는 중…'):
    settled?(last.success?'살굿 성공.. 악재가 신문에 실렸어.':'살굿 실패.. 새로운 악재는 없었어.'):offer.error;
  return <section className="ritual-page" aria-label="살굿">
    <RitualStage started={dancing?record.started:null} finished={Boolean(showReceipt&&!dancing)} canPet={!busy}
      prepareDance={!showReceipt&&!offer.error} sound={state.sound}/>
    <section className="ritual-offering" aria-label="제단">
      <div className="ritual-order">
        <label htmlFor="ritual-target">대상 종목</label>
        <div className="ritual-target"><CompanyMark asset={target} size={28}/>
          <select className="ui-control ui-select" id="ritual-target" value={target.code} disabled={Boolean(showReceipt)} onChange={e=>setCode(e.target.value)}>
            {showReceipt&&!ritualTarget(target.code)&&<option value={target.code}>{target.name}</option>}
            {groups.map(group=><optgroup key={group.name} label={group.name}>{group.assets.map(a=><option key={a.code} value={a.code}>{a.name}</option>)}</optgroup>)}</select>
        </div>
      </div>
      <OfferingTerms key={showReceipt?record.id:'ready'} offer={offer} chance={ritualPercent(chance)} recorded={showReceipt}/>
      <div className="ritual-foot">
        <p className="ritual-outcome" role="status">{outcome||'하루에 한 번, 이 종목에 악재를 부를 수 있어.'}</p>
        {settled?<div className="ritual-actions">
          {last.success&&<button className="ritual-primary ui-control ui-primary" data-act="article" data-value={ritualArticleId(last.id)}>기사 읽기</button>}
          <button className={last.success?'ritual-secondary ui-control':'ritual-primary ui-control ui-primary'} disabled={usedToday} onClick={()=>setDismissed(last.id)}>
            {usedToday?'오늘의 살굿 완료':'다음 굿 준비'}</button>
        </div>:<button className="ritual-primary ui-control ui-primary" data-act="ritual-start" data-value={code} data-previous={last?.id??''}
          disabled={busy||Boolean(offer.error)}>{busy?'굿 진행 중':usedToday?'오늘의 살굿 완료':'제물 바치고 살굿 시작'}</button>}
        {usedToday&&!busy&&sharedRituals()&&state.legacyRoomRitualDay===state.day&&legacyRitualOrphan(state)&&!sharedRitualRepairDue(state)&&
          <button className="ritual-secondary ui-control" data-act="ritual-repair">이전 살굿 기록 정리</button>}
      </div>
    </section>
  </section>;
}
