import React,{useState} from 'react';
import {calendarEvents,calendarKinds} from '../game/exchange-calendar.mjs';
import {civilDate} from '../game/clock-calendar.mjs';
import {Icon,Sheet} from './controls.jsx';

const weekdays=['일','월','화','수','목','금','토'];
const dateLabel=date=>{
  const [year,month,day]=date.split('-').map(Number);
  return year+'년 '+month+'월 '+day+'일';
};
function CalendarMark({kind}){
  return <i className="bk-calendar-mark" data-kind={kind} aria-hidden="true"/>;
}
export function ExchangeCalendar({state}){
  const today=civilDate(state.day);
  const [month,setMonth]=useState(()=>today.slice(0,7));
  const [year,monthNumber]=month.split('-').map(Number);
  const first=new Date(Date.UTC(year,monthNumber-1,1)).getUTCDay();
  const days=new Date(Date.UTC(year,monthNumber,0)).getUTCDate();
  const trailing=(7-(first+days)%7)%7;
  function changeMonth(step){
    setMonth(new Date(Date.UTC(year,monthNumber-1+step,1)).toISOString().slice(0,7));
  }
  return <div className="broker bk-calendar" role="region" aria-label="거래소 캘린더">
    <header className="view-heading bk-calendar-top">
      <button className="detail-back bk-back" type="button" data-act="tab" data-tab="market" aria-label="뒤로가기"><Icon name="down"/></button>
      <h1>캘린더</h1>
    </header>
    <div className="bk-calendar-month">
      <button className="ui-control ui-icon ui-compact bk-calendar-prev" type="button" aria-label="이전 달" onClick={()=>changeMonth(-1)}><Icon name="down"/></button>
      <h2 aria-live="polite">{year}년 {monthNumber}월</h2>
      <button className="ui-control ui-icon ui-compact bk-calendar-next" type="button" aria-label="다음 달" onClick={()=>changeMonth(1)}><Icon name="down"/></button>
    </div>
    <ul className="bk-calendar-legend" aria-label="일정 종류">
      {Object.entries(calendarKinds).map(([kind,label])=><li key={kind}><CalendarMark kind={kind}/>{label}</li>)}
    </ul>
    <div className="bk-calendar-week" aria-hidden="true">{weekdays.map(label=><span key={label}>{label}</span>)}</div>
    <div className="bk-calendar-grid" role="group" aria-label="일자 선택">
      {Array.from({length:first},(_,i)=><span key={'blank-'+i} className="bk-calendar-blank" aria-hidden="true"/>)}
      {Array.from({length:days},(_,i)=>{
        const date=month+'-'+String(i+1).padStart(2,'0'),events=calendarEvents(state,date);
        const kinds=[...new Set(events.map(event=>event.kind))];
        const label=dateLabel(date)+(kinds.length?' · '+kinds.map(kind=>calendarKinds[kind]).join(', '):'');
        return <button key={date} type="button" className="bk-calendar-date" data-act="calendar-day" data-value={date}
          aria-label={label} aria-current={date===today?'date':undefined} aria-haspopup="dialog">
          <span>{i+1}</span><span className="bk-calendar-marks">{kinds.map(kind=><CalendarMark key={kind} kind={kind}/>)}</span>
        </button>;
      })}
      {Array.from({length:trailing},(_,i)=><span key={'trailing-'+i} className="bk-calendar-blank" aria-hidden="true"/>)}
    </div>
  </div>;
}

export function CalendarDaySheet({state,date}){
  const events=calendarEvents(state,date);
  return <Sheet title={dateLabel(date)} theme="bk-calendar-sheet">
    {events.length?<ul className="bk-calendar-events">{events.map(event=><li key={event.id}>
      <div className="bk-calendar-event-meta"><CalendarMark kind={event.kind}/><b>{calendarKinds[event.kind]}</b>
        <span>{event.time&&event.time+' · '}{event.upcoming?'예정':'공시 완료'}</span></div>
      <h3>{event.title}</h3><p>{event.description}</p>
      {event.kind==='earnings'&&<p className="bk-calendar-companies">{event.companies.join(' · ')}</p>}
    </li>)}</ul>:<p className="bk-calendar-empty">이날 등록된 일정은 없어.</p>}
  </Sheet>;
}
