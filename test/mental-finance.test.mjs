import test from 'node:test';
import assert from 'node:assert/strict';
import {actualTimestamp,gameDayStart,gameTimestamp} from '../src/game/clock-calendar.mjs';
import {mentalRecoveryDue,startLive,syncLiveClock} from '../src/game/live-clock.mjs';
import {drawCredit,takeCredit,repayCredit,takeDeskLoan,repayDeskLoan,reconcileFinancialMood,financialMood,loadable,stockValue,exchange,placeOrder,mentalRateBreakdown,mentalDecayRate} from '../src/game/market.mjs';
import {rollDeskRate} from '../src/game/loan-desk.mjs';
import {quoteAt} from '../src/game/tape.mjs';
import {symbolIndex} from '../src/game/world.mjs';
import {reserveDeskCharge,finishDeskCharge} from '../src/game/desk-charges.mjs';
import {queueIntimidations} from '../src/game/desk-intimidation-state.mjs';

const time=(day,seconds=0)=>actualTimestamp(gameDayStart(day)+seconds*1000);
const at=time(8,10*3600);

test('bank and private debt change future hourly consumption and never deduct or refund an instant score',()=>{
  const s=startLive(null,at);
  assert.equal(drawCredit(s,500000,()=>.1),'');
  assert.equal(takeCredit(s,0),'');
  assert.equal(s.mental,75);
  assert.equal(mentalDecayRate(s),1.65);
  assert.equal(rollDeskRate(s,()=>0),'');
  assert.equal(takeDeskLoan(s,500000),'');
  assert.deepEqual(financialMood(s),{profit:0,debt:1005000,investmentPoints:0,debtPoints:-.3});
  const saved=startLive(structuredClone(s),at);
  assert(loadable(saved));
  assert.equal(reconcileFinancialMood(saved),false);
  const deadline=saved.mentalDecayAt;
  syncLiveClock(saved,actualTimestamp(deadline-2));
  assert.equal(saved.mental,75);
  syncLiveClock(saved,actualTimestamp(deadline));
  assert.equal(saved.mental,74);
  assert.equal(repayCredit(saved,375000),'');
  assert.equal(repayDeskLoan(saved,505000),'');
  assert.equal(financialMood(saved).debtPoints,-.04);
  assert.equal(repayCredit(saved,125000),'');
  assert.equal(mentalDecayRate(saved),1.5);
  assert.equal(saved.mental,74);
  assert.equal(startLive(structuredClone(saved),actualTimestamp(deadline)).mental,74);
});

test('rate changes halfway through a point charge elapsed time at the old rate',()=>{
  const start=gameDayStart(8)+10*3600_000,s=startLive(null,actualTimestamp(start));
  const halfway=start+1_200_000;
  syncLiveClock(s,actualTimestamp(halfway));
  assert.equal(drawCredit(s,500000,()=>.1),'');
  assert.equal(takeCredit(s,0),'');
  const deadline=halfway+Math.round(Math.round(3600_000/1.65)/2);
  assert.equal(s.mentalDecayAt,deadline);
  assert.equal(s.mental,75);
  syncLiveClock(s,actualTimestamp(deadline));
  assert.equal(s.mental,74);
});

test('hourly debt alone reaches 16 points and old capped saves keep partial decay progress',()=>{
  const state=startLive(null,at);
  assert.equal(drawCredit(state,1_000_000,()=>.1),'');
  assert.equal(takeCredit(state,0),'');
  state.cash=1_100_000;
  assert.equal(financialMood(state).debtPoints,-15);
  state.cash=1_000_000;
  state.realizedKRW=-500_000;
  assert.equal(financialMood(state).investmentPoints,-12);
  assert.equal(financialMood(state).debtPoints,-16);
  // Restore a v54 checkpoint half a point from its next decay deadline.
  state.mentalRates.investmentPoints=-12;
  state.mentalRates.debtPoints=-12;
  state.mentalDecayAt=gameTimestamp(at)+Math.round(Math.round(3_600_000/25.5)/2);
  const saved=startLive(structuredClone(state),at);
  assert.ok(loadable(saved));
  assert.equal(saved.mental,75);
  assert.equal(saved.mentalRates.debtPoints,-16);
  assert.equal(mentalDecayRate(saved),29.5);
  assert.ok(Math.abs(saved.mentalDecayAt-gameTimestamp(at)-3_600_000/29.5/2)<2);
  syncLiveClock(saved,actualTimestamp(saved.mentalDecayAt));
  assert.equal(saved.mental,74);
});

test('investment losses use current net worth, positive returns add no drain, and legacy applied points migrate once',()=>{
  const s=startLive(null,at,at);
  s.realizedKRW=-500000;
  assert.equal(reconcileFinancialMood(s),true);
  assert.deepEqual(mentalRateBreakdown(s),{base:-1.5,investment:-.15,debt:0,connection:.75,fortunePercent:0,rate:.9});
  assert.equal(s.mental,75);
  s.cash=2500000;
  assert.equal(reconcileFinancialMood(s),true);
  assert.equal(financialMood(s).investmentPoints,-.3);
  s.cash=0;
  assert.equal(financialMood(s).investmentPoints,-12);
  s.realizedKRW=100000;
  assert.equal(financialMood(s).investmentPoints,0);
  const old=startLive(null,at);
  old.mental=64.75;delete old.mentalRates;
  old.mentalFinance={day:old.day,opening:0,dividends:0,capital:500000,
    investment:{target:2,applied:.75},debt:{target:-12,applied:-11}};
  const migrated=startLive(old,at);
  assert.equal(migrated.mental,75);
  assert.equal(startLive(structuredClone(migrated),at).mental,75);
  assert.equal(migrated.mentalFinance,undefined);
});

test('a v37 tab can initialize its own ledger and its next save never refunds hourly losses',()=>{
  const s=startLive(null,at);
  drawCredit(s,500000,()=>.1);takeCredit(s,0);
  const charged=s.mentalDecayAt;
  syncLiveClock(s,actualTimestamp(charged));
  assert.equal(s.mental,74);
  for(let n=0;n<2;n++){
    // The old client initializes this absent key on receipt, retains unknown keys,
    // and books -2 for a 500,000-won loan in addition to the existing hourly score.
    assert.equal(s.mentalFinance,undefined);
    s.mentalFinance={day:s.day,opening:s.mentalRates.opening,capital:0,dividends:0,
      investment:{target:0,applied:0},debt:{target:-2,applied:-2}};
    s.mental-=2;
    syncLiveClock(s,actualTimestamp(charged));
    assert.equal(s.mental,74);
    assert.equal(mentalDecayRate(s),1.65);
    assert.equal(startLive(structuredClone(s),actualTimestamp(charged)).mental,74);
  }
});

test('opening and sale marks survive reload without treating purchases or sales as mental events',()=>{
  const start=5*60,i=symbolIndex.FLFX,second=start+10;
  const state=startLive(null,time(9,start));
  assert.equal(exchange(state,'KRW','USD',4000000),'');
  assert.equal(placeOrder(state,i,150),'');
  syncLiveClock(state,time(9,second));
  assert.equal(state.holdings[i],150);
  const marked=financialMood(state);
  assert.equal(marked.profit,stockValue(state)-state.costsKRW[i]);
  assert.equal(state.mental,75);
  const old=structuredClone(state);delete old.mentalRates;
  assert.deepEqual(financialMood(startLive(old,time(9,second))),marked);
  assert.equal(placeOrder(state,i,-150),'');
  syncLiveClock(state,time(9,second+4));
  assert.equal(state.holdings[i],0);
  assert.equal(financialMood(state).profit,state.realizedKRW);
  assert.equal(state.mental,75);
  assert.equal(quoteAt(state,i)>0,true);
});

test('midnight resets the investment rate and carries debt forward without a second charge',()=>{
  const prior=time(8,86390),s=startLive(null,prior);
  assert.equal(rollDeskRate(s,()=>0),'');
  assert.equal(takeDeskLoan(s,250000),'');
  s.realizedKRW=-500000;
  assert.equal(reconcileFinancialMood(s),true);
  assert.equal(s.mental,75);
  const later=startLive(structuredClone(s),time(9,40*60));
  assert.equal(later.history.at(-1).after,75);
  assert.equal(later.history.at(-1).gains,-500000);
  assert.equal(later.mental,99);
  assert.equal(financialMood(later).investmentPoints,0);
  assert.equal(financialMood(later).debtPoints,-.07);
  assert.equal(startLive(structuredClone(later),time(9,40*60)).mental,99);
});

test('a desk purchase saved between clock updates reprices debt from the purchase checkpoint',()=>{
  const start=gameDayStart(11)+3600_000,s=startLive(null,actualTimestamp(start));
  assert.equal(rollDeskRate(s,()=>0),'');
  assert.equal(takeDeskLoan(s,5000000),'');
  reserveDeskCharge(s,'spyPending',{id:'purchase',cost:2500000});
  finishDeskCharge(s,'spyPending','spyCharges','purchase',true);
  const {rate}=mentalRateBreakdown(s);
  const reopened=startLive(structuredClone(s),actualTimestamp(start+4*3600_000));
  assert.equal(reopened.mental,75-Math.floor(rate*4));
  assert.equal(mentalDecayRate(reopened),rate);
});

test('offline catch-up accounts for successive market bars in the same order as individual updates',()=>{
  const start=gameDayStart(16),s=startLive(null,actualTimestamp(start)),i=0;
  s.holdings[i]=100;s.costsKRW[i]=5000000;
  s.mentalRates.opening=financialMood(s).profit+700000;
  reconcileFinancialMood(s);
  const cloned=structuredClone(s),rate=mentalDecayRate(s);
  for(let step=1;step<=96;step++)syncLiveClock(cloned,actualTimestamp(start+step*300000));
  syncLiveClock(s,actualTimestamp(start+96*300000));
  assert.notEqual(mentalDecayRate(s),rate);
  assert.equal(s.mental,cloned.mental);
  assert.equal(s.mentalDecayAt,cloned.mentalDecayAt);
});

test('00:00 on the next game day restores up to 50 points exactly once across reloads',()=>{
  const state=startLive(null,time(8,86_390));
  state.mental=32;
  syncLiveClock(state,time(8,86_399));
  assert.equal(state.mental,32);
  const reward=startLive(JSON.parse(JSON.stringify(state)),time(9));
  assert.equal(reward.history.at(-1).after,50);
  assert.equal(reward.mental,100);
  assert.equal(mentalRecoveryDue(reward,gameDayStart(9)),false);
  reward.mental=90;
  assert.equal(startLive(structuredClone(reward),time(9,1)).mental,90);

  // A save made at 00:00 on the earlier schedule may still owe today's recovery.
  const pending=startLive(null,time(9));
  assert.equal(pending.mental,75,'the initial game day has no overnight recovery');
  pending.mental=86;
  pending.mentalRecoveryPending=true;
  assert(loadable(pending));
  const capped=syncLiveClock(pending,time(9));
  assert.equal(pending.mental,100);
  assert.equal(capped.mentalClockChanged,true);
  pending.mental=90;
  assert.equal(startLive(structuredClone(pending),time(9,1)).mental,90);
});

test('overnight recovery is ordered between events before and after 00:00',()=>{
  const state=startLive(null,time(8,86_390));
  assert.equal(rollDeskRate(state,()=>0),'');
  assert.equal(takeDeskLoan(state,250000),'');
  state.mental=20;
  queueIntimidations(state,[{id:crypto.randomUUID(),day:8,at:time(8,86_399)},{id:crypto.randomUUID(),day:9,at:time(9,1)}]);
  syncLiveClock(state,time(9,2));
  assert.equal(state.mental,25);
  assert.equal(state.intimidationNotices.length,2);
});

test('catching up several days applies each daily recovery like an uninterrupted clock',()=>{
  const state=startLive(null,time(8,86_390));
  state.mental=33;
  const stepped=structuredClone(state);
  for(const day of [9,10,11])syncLiveClock(stepped,time(day));
  const resumed=startLive(structuredClone(state),time(11));
  assert.equal(resumed.mental,stepped.mental);
  assert.deepEqual(resumed.history.map(({day,after})=>[day,after]),stepped.history.map(({day,after})=>[day,after]));
  assert.equal(resumed.mentalRecoveryPending,undefined);
});
