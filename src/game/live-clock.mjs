import {advanceMarket, advanceMentalClock, initial, initializeMentalClock, matchLiveOrders, migrateDailyFortune, netWealth, nextDay, settle, upgrade, reconcileFinancialMood} from './market.mjs';
import {rebaseCredit} from './credit.mjs';
import {rebaseLoanDesk} from './loan-desk.mjs';
import {applyDueIntimidations} from './desk-intimidation-state.mjs';
import {actualTimestamp, gameDayStart, gameTimestamp, realTime, usesKst, weekStart} from './clock-calendar.mjs';
import {dailyMentalRecoveryMinute,recoverDailyMental} from './mental-rules.mjs';

const mentalRecoveryTime=day=>gameDayStart(day)+dailyMentalRecoveryMinute*60_000;
export const mentalRecoveryDue=(state,gameAt)=>state.mentalRecoveryPending===true&&gameAt>=mentalRecoveryTime(state.day);
const legacyStep=step=>step==null||step===288?step:(step+108)%288;
function retainLegacyActivity(state,wall){
  const offset=wall.day-1-state.day;
  const keepTrades=(rows,day)=>rows.map(row=>({...row,step:legacyStep(row.step),tapeKey:day*288+(row.step||0)}));
  const convert=(record)=>{
    const day=record.day;
    return {...record, day:day+offset, legacy:true, trades:keepTrades(record.trades||[],day),
      expired:keepTrades(record.expired||[],day),cancelled:keepTrades(record.cancelled||[],day)};
  };
  if(state.phase==='open'&&(state.fills.length||state.expired.length||state.cancelled?.length)){
    const gains=netWealth(state)-state.startWealth;
    state.history.push({day:state.day, gains, before:state.mental,after:state.mental,
      trades:state.fills,expired:state.expired,cancelled:state.cancelled,luck:state.luck});
  }
  state.history=state.history.map(convert);
  if(state.salaryNegotiation)state.salaryNegotiation={...state.salaryNegotiation,day:state.salaryNegotiation.day+offset};
  if(state.salaryHistory)state.salaryHistory=state.salaryHistory.map(row=>({...row,day:row.day+offset}));
  if(state.rehabilitationSession)state.rehabilitationSession={...state.rehabilitationSession,day:state.rehabilitationSession.day+offset};
  for(const key of ['rehabilitationPayments','rehabilitationSettlements']){
    if(state[key])state[key]=state[key].map(row=>({...row,day:row.day+offset,step:legacyStep(row.step)}));
  }
  state.fxLog=state.fxLog.map(row=>({...row,day:row.day+offset,step:legacyStep(row.step)}));
  state.weekendLog=state.weekendLog.map(row=>({...row,day:row.day+offset,step:legacyStep(row.step)}));
  state.openingDay=offset;
  rebaseCredit(state,wall.day,wall.cursor,offset,legacyStep);
  rebaseLoanDesk(state,wall.day,wall.cursor,offset,legacyStep);
  if(!state.credit.loan&&wall.day===weekStart(wall.day))state.credit.used=false;
}

export function startLive(saved,now=Date.now(),connectedSince=null){
  if(saved&&usesKst(saved)){const state=upgrade(saved);syncLiveClock(state,now,connectedSince);return state;}
  const gameAt=gameTimestamp(now),wall=realTime(gameAt);
  const state=saved?upgrade(saved):initial();
  if(saved)retainLegacyActivity(state,wall);
  else state.openingDay=wall.day;
  Object.assign(state,{clockMode:'kst',day:wall.day,cursor:wall.cursor,phase:'open',wallMinute:wall.minute,wallSecond:wall.second,
    fills:[],expired:[],cancelled:[],fortuneGrid:null,luck:null,discountToday:0});
  delete state.fortuneRerollReady;
  delete state.fortuneRerollUsed;
  initializeMentalClock(state,gameAt);
  if(connectedSince!==null)advanceMentalClock(state,gameAt,gameAt);
  state.startWealth=netWealth(state);
  reconcileFinancialMood(state,gameAt);
  state.dayStartMental=state.mental;
  return state;
}

export function syncLiveClock(state,now=Date.now(),connectedSince=null){
  const gameAt=gameTimestamp(now),wall=realTime(gameAt),mentalBefore=state.mental;
  const connectedFrom=connectedSince===null?null:gameTimestamp(Math.min(connectedSince,now));
  let advanced=false,rolled=false,filled=0;
  if(!usesKst(state)||wall.day<state.day||gameAt<state.mentalConnectedAt)return {advanced,rolled,filled};
  let mentalClockChanged=initializeMentalClock(state,gameAt),intimidationsChanged=false;
  // Desk charges, exchange and other account actions can be saved between clock pulses.
  // Reprice that saved balance at its own checkpoint before accumulating offline time.
  let financeChanged=reconcileFinancialMood(state);
  const refreshFinance=at=>{financeChanged=reconcileFinancialMood(state,at)||financeChanged;};
  const advanceDecayTo=at=>{mentalClockChanged=advanceMentalClock(state,at,connectedFrom)||mentalClockChanged;};
  const advanceMentalTo=at=>{
    if(mentalRecoveryDue(state,at)){
      advanceDecayTo(mentalRecoveryTime(state.day));
      state.mental=recoverDailyMental(state.mental);
      delete state.mentalRecoveryPending;
      mentalClockChanged=true;
    }
    advanceDecayTo(at);
  };
  const applyIntimidationsTo=at=>{
    intimidationsChanged=applyDueIntimidations(state,at,eventAt=>advanceMentalTo(gameTimestamp(eventAt)))||intimidationsChanged;
  };
  // Across a closed tab, apply the rate known at each market bar before marking the next one.
  // Cash-only accounts can advance directly to the requested instant.
  const advanceMarketTo=cursor=>{
    if(state.phase!=='open')return;
    const fxExposure=Object.values(state.wallets).some(Boolean)
      &&(state.mentalRates.debtPoints<0||state.mentalRates.investmentPoints<0);
    while(state.cursor<cursor&&(fxExposure||state.holdings.some(Boolean)||state.orders.some(Boolean))){
      const next=state.cursor+1,at=gameDayStart(state.day)+next*300_000;
      applyIntimidationsTo(actualTimestamp(next===288?at-1:at));
      advanceMentalTo(at);
      filled+=advanceMarket(state,1).length;
      if(next<288){
        state.wallMinute=next*5;state.wallSecond=0;
        refreshFinance(at);
      }
    }
    if(cursor>state.cursor)advanceMarket(state,cursor-state.cursor);
  };
  while(state.day<wall.day){
    const midnight=gameDayStart(state.day+1),traded=state.fills.length>0;
    const resting=!traded&&!state.orders.some(Boolean);
    if(state.phase==='open')advanceMarketTo(288);
    applyIntimidationsTo(actualTimestamp(midnight-1));
    advanceMentalTo(midnight);
    if(state.phase==='open')settle(state,{rest:resting});
    nextDay(state);
    advanced=rolled=true;
  }
  if(wall.cursor>state.cursor){
    advanceMarketTo(wall.cursor);
    advanced=true;
  }
  const minuteChanged=state.wallMinute!==wall.minute&&wall.cursor>=state.cursor;
  const previous=state.expired.length;
  if(wall.cursor===state.cursor){
    state.wallMinute=wall.minute;state.wallSecond=wall.second;
    filled+=matchLiveOrders(state);
  }
  applyIntimidationsTo(now);
  advanceMentalTo(gameAt);
  mentalClockChanged=migrateDailyFortune(state,gameAt)||mentalClockChanged;
  refreshFinance(gameAt);
  return {financeChanged,advanced,rolled,filled,minuteChanged,expired:state.expired.length!==previous,mentalClockChanged,intimidationsChanged,mentalChanged:state.mental!==mentalBefore};
}
