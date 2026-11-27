const dayMs=86_400_000, kstMs=9*3_600_000;
export const tapeEpochDay=Date.UTC(2026,10,16)/dayMs;
// The continuous tape starts at the November 29 game-day boundary.
export const continuousTradingDay=Date.UTC(2026,10,29)/dayMs-tapeEpochDay;
export const gameClockRate=2;
const marketStartMinute=9*60;
export const marketDayOffset=marketStartMinute/5;
const gameClockStart=Date.UTC(2026,10,20,13,30); // 22:30 KST
export const gameTimestamp=now=>now+Math.max(0,now-gameClockStart)*(gameClockRate-1);
export const actualTimestamp=gameAt=>gameAt-Math.max(0,gameAt-gameClockStart)*(1-1/gameClockRate);
const pad=n=>String(n).padStart(2,'0');
export const weekdayIndex=day=>((day%7)+7)%7;
export const weekStart=day=>day-weekdayIndex(day);
export const usesKst=s=>s.clockMode==='kst';
export const civilDate=day=>new Date((tapeEpochDay+day)*dayMs).toISOString().slice(0,10);
export const firstGameDay=state=>state.openingDay??state.history?.[0]?.day??0;
export function shortDayLabel(day,openingDay){
  const elapsed=day-openingDay;
  return 'Day '+(elapsed<0?elapsed:elapsed+1);
}
export function dayLabel(state,day=state.day){
  const elapsed=day-firstGameDay(state);
  return elapsed<0?'시작 '+(-elapsed)+'일 전':'Day '+(elapsed+1);
}
export const gameDayStart=day=>(tapeEpochDay+day)*dayMs-kstMs;
export function realTime(now=Date.now()){
  const local=now+kstMs,today=Math.floor(local/dayMs);
  const minute=Math.floor((local-today*dayMs)/60_000);
  return {day:today-tapeEpochDay,minute,cursor:Math.floor(minute/5),second:Math.floor((local-today*dayMs)/1000)%60};
}
export const gameTime=(now=Date.now())=>realTime(gameTimestamp(now));
export function clockText(step,kst=false,minute=null){
  const time=minute??(((kst?0:marketStartMinute)+step*5)%1440+1440)%1440;
  return pad(Math.floor(time/60))+':'+pad(time%60);
}
export function accountCalendar(state,day,step){
  const live=usesKst(state),slot=step??state.cursor;
  const minute=live&&day===undefined&&step===undefined&&slot<288?state.wallMinute:null;
  const date=(day??state.day)+Math.floor(((live?0:marketStartMinute)+slot*5)/1440);
  return dayLabel(state,date)+' '+clockText(slot,live,minute);
}
export function venueClockText(state){
  const live=usesKst(state);
  return clockText(state.cursor,live,live&&state.cursor<288?state.wallMinute??null:null);
}
export function marketClock(state,step=state.cursor){
  if(!usesKst(state))return {day:state.day,cursor:step,phase:state.phase};
  const tick=state.day*288+step-marketDayOffset,day=Math.floor(tick/288);
  return {day,cursor:tick-day*288,phase:'open'};
}
export const tradeKey=(state,day,step)=>day*288+step-(usesKst(state)?marketDayOffset:0);

export function marketElapsed(state){
  if(!usesKst(state)||state.phase==='closed'||state.cursor!==Math.floor(state.wallMinute/5)||!Number.isInteger(state.wallSecond))return null;
  return state.wallMinute%5*60+state.wallSecond;
}
export const accountTick=(day,step,second=0)=>day*86400+step*300+second;
