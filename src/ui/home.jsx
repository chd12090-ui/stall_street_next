import React, {memo, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {dayLabel, gameClockRate} from '../game/clock-calendar.mjs';
import {homeClock, investmentSummary, mentalLabel, panelMoney, panelProfit, profitSign} from '../game/home-desk.mjs';
import {netWealth,todayLiveSpending} from '../game/market.mjs';
import {fmtMoney} from '../game/world.mjs';
import {characterPose, floorBleed, handOrigins, petDuration, whenHomePoseReady} from '../game/player-character.mjs';
import {shortcutState} from '../game/election.mjs';
import {todaysNegotiation} from '../game/salary-negotiation.mjs';
import {Icon} from './controls.jsx';
import {MentalBrain, MentalGauge, PixelArt} from './home-art.jsx';
import {newsCategories} from '../game/news-category.mjs';
import {homeClockUpdates} from '../game/exchange-events.mjs';
import {useViewUpdate} from './exchange-controls.jsx';

export {AssetsPage} from './home-assets.jsx';
export {DayReview, DaySlip, MentalBody, SpendingBody, SettlementSummary} from './home-reports.jsx';

export const HomeCharacter=memo(function HomeCharacter({pose}) {
  const sprite=useRef(null);
  const [drawing,setDrawing]=useState(pose);
  useEffect(()=>{
    if(drawing===pose)return;
    return whenHomePoseReady(pose,()=>sprite.current?.classList.contains('petting'),setDrawing);
  },[drawing,pose]);
  const url='/art/player/pose-'+drawing.id+'.svg';
  const [handX,handY]=handOrigins[drawing.id];
  const [left,top,width,height]=drawing.petBounds;
  const hitArea={
    left:`${left/drawing.width*100}%`, top:`${top/drawing.height*100}%`,
    width:`${width/drawing.width*100}%`, height:`${height/drawing.height*100}%`,
  };
  return <span ref={sprite} className="character-art pov-pet-sprite" data-pet-stage="" data-character-pose={drawing.id}
    style={{'--pet-duration':petDuration+'ms',transform:`translateY(${100*floorBleed/drawing.height}%)`}}>
    <svg aria-hidden="true" viewBox={`0 0 ${drawing.width} ${drawing.height}`} shapeRendering="crispEdges">
      <use href={url+'#fixture'}/>
      <g className="pov-pet-body" style={{'--cat-support':`${drawing.support[0]}px ${drawing.support[1]}px`}}>
        <use href={url+'#cat'}/>
        {drawing.id==='4' && <use className="pov-tissue-dab" href={url+'#wipe'}/>}
      </g>
      {drawing.phoneOnSeat && <use href={url+'#phone'}/>}
      <g transform={`translate(${handX} ${handY})`}><g className="pov-pet-hand">
        <use className="pet-open" href="/art/player/petting-hand.svg#open" width="52" height="34"/>
        <use className="pet-contact" href="/art/player/petting-hand.svg#contact" width="52" height="34"/>
      </g></g>
    </svg>
    <button className="pov-pet-target" style={hitArea} type="button" data-act="pet-cat" aria-label="고양이 쓰다듬기" aria-description={drawing.alt}/>
  </span>;
});

function HomeInvestment({state}) {
  const {held,value,profit}=investmentSummary(state);
  return <button type="button" className="pov-investment" data-pov-investment="" data-act="tab" data-tab="market">
    <span className="pov-widget-title"><Icon name="market"/><b>내 투자 현황</b></span>
    <span className="pov-investment-metrics" data-pov-invest-metrics="" hidden={!held}>
      <span>가치 <b data-pov-invest-value="">{panelMoney(value)}</b></span>
      <span>손익 <b data-pov-invest-profit={profitSign(profit)}>{panelProfit(profit)}</b></span>
    </span>
    <span className="pov-investment-empty" data-pov-invest-empty="" hidden={held}>보유 종목 없음</span>
  </button>;
}

function Headline({latest}) {
  const current=useRef(null), previous=useRef(null);
  const [titles,setTitles]=useState(()=>({current:latest.title,previous:null,id:latest.id}));
  if(titles.id!==latest.id || titles.current!==latest.title){
    setTitles({id:latest.id,current:latest.title,previous:titles.current});
  }
  useLayoutEffect(()=>{
    if(titles.previous===null)return;
    const finish=()=>setTitles(value=>value===titles?{...value,previous:null}:value);
    if(!current.current?.animate || matchMedia('(prefers-reduced-motion: reduce)').matches){
      finish();
      return;
    }
    const options={duration:330,easing:'cubic-bezier(.25,.65,.3,1)',fill:'both'};
    const exit=previous.current.animate([{transform:'translateY(0)'},{transform:'translateY(-100%)'}],options);
    const enter=current.current.animate([{transform:'translateY(100%)'},{transform:'translateY(0)'}],options);
    enter.onfinish=finish;
    return ()=>{enter.onfinish=null;enter.cancel();exit.cancel();};
  },[titles]);
  const key=Object.hasOwn(newsCategories,latest.category)?latest.category:'market';
  const {label,icon}=newsCategories[key];
  return <button className="pov-headline" data-act="article" data-value={latest.id}>
    <span className="news-category" data-news-category={key} title={label+' 뉴스'}><Icon name={icon}/>{label}</span>
    <span className="pov-headline-window">
      {titles.previous!==null && <span className="pov-headline-text" ref={previous} aria-hidden="true">{titles.previous}</span>}
      <span className="pov-headline-text" ref={current} data-headline="">{titles.current}</span>
    </span>
  </button>;
}

function todayAction(due) {
  return due?{'data-today-action':'','aria-describedby':'home-today-action'}:{};
}

function ElectionShortcut() {
  const {phase,caption,label}=shortcutState(Date.now());
  return <button className="pov-action pov-election" data-act="tab" data-tab="election"
    data-voting={phase==='voting'?'':undefined} data-voted={phase==='voted'?'':undefined} aria-label={label}
    {...todayAction(phase==='voting')}>
    <Icon name="election-mark"/><span>대통령 선거</span><strong data-election-days="">{caption}</strong>
  </button>;
}

function HomeTime({initial}){
  const state=useViewUpdate(initial,homeClockUpdates),time=homeClock(state);
  return <div className="pov-time"><b data-pov-day="">{dayLabel(state)}</b>
    <span className="pov-clock" role="time" aria-label={time.label}>
      <Icon name="clock"/><span className="pov-clock-text"><strong data-pov-minutes="">{time.minutes}</strong>
        <small data-pov-seconds="">{time.seconds}</small><span className="pov-clock-rate" aria-hidden="true"><sub>{gameClockRate}</sub></span>
      </span>
    </span></div>;
}

export function HomePage({state,options}) {
  const value=state.mental;
  const dayOpen=state.phase==='open';
  const {latest,characterPreview}=options;
  return <section className="pov-stage" aria-labelledby="pov-title">
    <h1 id="pov-title" className="pov-sr">변기투자</h1>
    <span id="home-today-action" hidden>오늘 할 일</span>
    <div className="pov-art-plane">
      <PixelArt id="room-stall" className="pov-art" width={160} height={320} eager/>
      <figure className="pov-character-stage"><HomeCharacter pose={characterPose(value,characterPreview)}/></figure>
    </div>
    <div className="pov-top">
      <div className="pov-widget-column">
        <HomeTime initial={state}/>
        <div className="pov-budget-stack">
          <button type="button" className="pov-budget" data-act="tab" data-tab="assets">
            <span className="pov-widget-title"><Icon name="coin"/><b>내 순자산</b></span>
            <strong data-pov-net="">{panelMoney(netWealth(state))}</strong></button>
          <button type="button" className="pov-budget" data-act="spending" aria-haspopup="dialog">
            <span className="pov-widget-title"><Icon name="receipt"/><b>오늘 소비</b></span>
            <strong data-pov-budget="">{fmtMoney(todayLiveSpending(state)?.total??0)}</strong></button>
        </div>
        <HomeInvestment state={state}/>
      </div>
      <div className="pov-widget-column">
        <button className="pov-settings ui-control ui-icon" data-act="settings" aria-label="게임 설정"><Icon name="menu"/></button>
        <button className={'pov-condition'+(value<25?' pov-low':'')} data-act="mental" aria-haspopup="dialog" aria-label={mentalLabel(value)}>
          <MentalBrain value={value}/>
          <MentalGauge value={value}/>
        </button>
        <button type="button" className="pov-action pov-salary" data-act="salary-negotiation" aria-haspopup="dialog"
          {...todayAction(dayOpen&&!todaysNegotiation(state))}><Icon name="salary-raise"/><span>연봉협상</span></button>
        <ElectionShortcut/>
      </div>
    </div>
    <div className="pov-dock">{latest && <Headline latest={latest}/>}
      <div className="pov-actions"><button className="scene-action pov-fortune ui-control" data-act="fortune"
        {...todayAction(dayOpen&&!state.luck)}><Icon name="fortune-slot"/><span data-pov-fortune="">{state.luck?'운세 확인':'운세 뽑기'}</span></button>
        <button className="scene-action ui-control" data-act="day-summary"><Icon name="receipt"/>하루 정산</button>
        <button type="button" className="scene-action ui-control" data-act="shop" aria-haspopup="dialog"><Icon name="news-stock"/>쇼핑하기</button>
      </div>
    </div>
  </section>;
}
