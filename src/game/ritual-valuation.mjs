import {stocks,symbolIndex} from './securities-data.mjs';
import {accountTick,marketClock,marketElapsed} from './clock-calendar.mjs';
import {instrumentMarketCap} from './market-cap.mjs';
import {quoteAt} from './tape.mjs';
import {fxRates} from './fx.mjs';

export function ritualQuoteTime(state){
  return accountTick(state.day,state.cursor,marketElapsed(state)??0);
}

// Reconstruct the same price and exchange rate used to quote the offering.
export function ritualQuoteClock(time){
  const day=Math.floor(time/86400),seconds=time-day*86400,wallMinute=Math.floor(seconds/60);
  return {clockMode:'kst',phase:'open',day,cursor:Math.floor(wallMinute/5),wallMinute,wallSecond:seconds%60};
}

export function ritualMarketCap(state,code){
  const index=symbolIndex[code],asset=stocks[index],cap=instrumentMarketCap(asset,state,quoteAt(state,index));
  if(cap===null)return NaN;
  if(asset.currency==='KRW')return cap;
  const clock=marketClock(state);
  return cap*fxRates(clock.day,clock.cursor)[asset.currency];
}
