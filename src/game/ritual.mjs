import {grossAssets,exchangeable} from './market.mjs';
import {marketClock} from './clock-calendar.mjs';
import {reserveDeskCharge,finishDeskCharge} from './desk-charges.mjs';
import {ritualTarget,ritualCost,ritualChance,drawRitualOutcome,mergeRitualEvents,ritualDailyLimitMessage} from './ritual-rules.mjs';
import {ritualMarketCap,ritualQuoteTime} from './ritual-valuation.mjs';

export function ritualUsedToday(state){
  return state.ritualUsedDay===state.day||state.ritualLast?.day===state.day||state.ritualCharges?.at(-1)?.day===state.day;
}

export function ritualQuote(state,code){
  const eligible=ritualTarget(code),wealth=grossAssets(state),mental=state.mental;
  const marketCap=eligible?ritualMarketCap(state,code):NaN,cost=ritualCost(wealth,marketCap);
  const usedToday=ritualUsedToday(state);
  const error=!eligible?'개별 회사 주식을 골라 줘.':
    state.ritualPending?'지난 굿의 결과를 기다리고 있어.':usedToday?ritualDailyLimitMessage:
    !Number.isFinite(cost)?'이 회사의 시세가 아직 없어.':wealth<=0||cost<1?'제물을 낼 자산이 부족해.':
    mental<=0?'정신력을 회복하면 굿을 시작할 수 있어.':exchangeable(state,'KRW')<cost?'제물을 낼 수 있는 원화가 부족해.':'';
  return {wealth,cost,quotedAt:ritualQuoteTime(state),mental,chance:ritualChance(mental),usedToday,error};
}
export function reserveRitual(state,code,id,now){
  if(state.ritualLast?.id===id)return '이미 치른 굿이야.';
  const {wealth,cost,quotedAt,mental,chance,error}=ritualQuote(state,code);
  if(error)return error;
  const clock=marketClock(state);
  reserveDeskCharge(state,'ritualPending',{id,code,wealth,cost,quotedAt,mental,chance,started:now,
    tick:clock.day*288+clock.cursor,minuteOffset:(state.wallMinute??0)%5});
  state.mental=0;
  return '';
}
export function cancelRitual(state,id){
  const pending=state.ritualPending;
  if(!pending||pending.id!==id)return false;
  state.mental=Math.min(100,state.mental+pending.mental);
  return finishDeskCharge(state,'ritualPending','ritualCharges',id,false);
}
export function localRitualResult(pending,random){
  const {id,code,tick,minuteOffset}=pending;
  return {id,code,tick,minuteOffset,...drawRitualOutcome(pending.chance??pending.mental*.7,random)};
}
export function finishRitual(state,result){
  const paid=state.ritualPending;
  if(!paid||paid.id!==result.id||paid.code!==result.code)return false;
  if(result.success)mergeRitualEvents(state,[result]);
  const {id,code,cost,mental,chance,day,step,seq,started}=paid;
  state.ritualLast={id,code,cost,mental,chance,day,step,seq,started,success:result.success,bps:result.bps,tick:result.tick};
  state.ritualCharges=[...(state.ritualCharges??[]),{id,code,cost,day,step,seq}];
  delete state.ritualPending;
  return true;
}
