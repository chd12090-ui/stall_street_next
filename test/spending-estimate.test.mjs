import test from 'node:test';
import assert from 'node:assert/strict';
import {chargeLiveSpending,dailyBonus,dailySpendingEstimate,estimateDailySpending,initial,loadable,nextDay,settle,spendingInterval,spendingPerTick,spendingWealthCharge,takeDeskLoan} from '../src/game/market.mjs';
import {actualTimestamp,gameDayStart,gameTimestamp} from '../src/game/clock-calendar.mjs';
import {startLive} from '../src/game/live-clock.mjs';
import {rollDeskRate} from '../src/game/loan-desk.mjs';
import {applyForRehabilitation,rehabilitationView,startRehabilitationRound,stopRehabilitationRound} from '../src/game/rehabilitation.mjs';
import {reviewValues} from '../src/game/day-report.mjs';
import {ranking} from '../src/game/league-profile.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';
const {AssetsPage,SpendingBody,SettlementSummary}=await loadJsx(new URL('../src/ui/home.jsx',import.meta.url));
import {fmtMoney} from '../src/game/world.mjs';
import {householdLedger,householdLedgerTotals,householdSnapshot} from '../src/game/status.mjs';

test('the history lists daily charges only once, at the close of their game day',()=>{
  const at=actualTimestamp(gameDayStart(9)),state=startLive(null,at);
  const preview=dailyBonus(state),firstReport=renderView(SettlementSummary,{state});
  assert.match(firstReport,/Day 1/);
  assert.match(firstReport,/<dt>일급 입금 예정<\/dt><dd>300,000원/);
  assert.ok(firstReport.includes('<dt>보너스 입금 예정</dt><dd>'+fmtMoney(preview)+'</dd>'));
  const total=chargeLiveSpending(state,at)+chargeLiveSpending(state,at+spendingInterval);
  assert.ok(total>0);
  assert.doesNotMatch(renderView(AssetsPage,{state,view:'ledger'}),/하루 소비 합계/);
  const replay=structuredClone(state),before=state.cash;
  settle(state);settle(state);settle(replay);
  const rows=householdLedger(state).filter(row=>row.type==='live-spending');
  assert.equal(rows.length,1);
  assert.equal(rows[0].step,288);
  assert.equal(rows[0].legs[0].amount,-total);
  const html=renderView(AssetsPage,{state,view:'ledger'});
  assert.match(html,/하루 소비 합계<\/h3><div class="st-entry-meta">23:59<\/div>/);
  assert.match(html,/일급 및 보너스 입금<\/h3><div class="st-entry-meta">23:59<\/div>/);
  assert.doesNotMatch(html,/마감|2회 결제 합계/);
  const bill=state.history[0].bill;
  assert.equal(bill.bonus,preview);
  assert.ok(bill.bonus>=30_000&&bill.bonus<=150_000);
  assert.equal(bill.income,300_000+bill.bonus);
  assert.equal(state.cash,before+bill.income);
  assert.deepEqual(replay.history[0].bill,bill);
  const wages=householdLedger(state).filter(row=>row.type==='salary');
  assert.equal(wages.length,1);
  assert.equal(wages[0].legs[0].amount,bill.income);
  const closedReport=renderView(SettlementSummary,{state,day:state.day});
  assert.ok(closedReport.includes('<dt>일급 및 보너스 입금</dt><dd>'+fmtMoney(bill.income)+'</dd>'));
  assert.ok(closedReport.includes('<dt>그중 보너스</dt><dd>'+fmtMoney(preview)+'</dd>'));
});

test('the forecast follows a full game day of actual payments at fixed mental and market values',()=>{
  const start=actualTimestamp(gameDayStart(9)),end=actualTimestamp(gameDayStart(10));
  const state=startLive(null,start);
  const forecast=estimateDailySpending(state.mental,state.cash,state.cash);
  let paid=0;
  for(let at=start;at<end;at+=spendingInterval)paid+=chargeLiveSpending(state,at);
  assert.equal(forecast,paid);
  assert.equal(estimateDailySpending(100,1_000_000,1_000_000),21_600);
  assert.equal(estimateDailySpending(0,1_000_000,71),71);
  assert.equal(estimateDailySpending(0,1_000_000,0),0);
});

test('the spending sheet uses a two-point change in either direction from its last estimate',()=>{
  const state=initial();
  const panelAmount=()=>renderView(SpendingBody,{state}).match(/data-spend-estimate="">([^<]+)/)[1];
  const expected=()=> '약 '+fmtMoney(estimateDailySpending(state.mental,state.cash,state.cash));
  const initialAmount=panelAmount();
  assert.equal(initialAmount,expected());
  state.mental--;
  assert.equal(panelAmount(),initialAmount);
  state.mental--;
  const revised=panelAmount();
  assert.notEqual(revised,initialAmount);
  assert.equal(revised,expected());
  state.mental++;
  assert.equal(panelAmount(),revised);
  state.mental++;
  assert.equal(panelAmount(),initialAmount);
  state.cash=100;
  state.day++;
  assert.equal(panelAmount(),expected());
  state.cash=50;
  state.resetId='another-game';
  assert.equal(panelAmount(),expected());
});

test('a loan updates the spending rate, same-day estimate and charge from the asset total',()=>{
  const at=actualTimestamp(gameDayStart(9)),state=startLive(null,at);
  state.resetId='borrowed-spending';
  renderView(SpendingBody,{state});
  assert.equal(rollDeskRate(state,()=>.1),'');
  const before=state.cash,borrowed=25_000_000;
  assert.equal(takeDeskLoan(state,borrowed),'');
  const {assetsTotal,net,available}=householdSnapshot(state);
  assert.equal(assetsTotal,before+borrowed);
  assert.ok(net<assetsTotal);
  const estimate=estimateDailySpending(state.mental,assetsTotal,available);
  const extra=spendingWealthCharge(state.mental,assetsTotal);
  const amount=spendingPerTick(state.mental,assetsTotal);
  assert.ok(extra>spendingWealthCharge(state.mental,net));
  const html=renderView(SpendingBody,{state});
  assert.ok(html.includes('자산 합계 비례 추가분</dt><dd data-spend-wealth="">'+fmtMoney(extra)));
  assert.ok(html.includes('data-spend-estimate="">약 '+fmtMoney(estimate)));
  assert.equal(chargeLiveSpending(state,at),amount);
  assert.equal(state.liveSpending.recent[0].wealth,assetsTotal);
  assert.equal(loadable(state),true);
});

test('rehabilitation winnings fund the household and refresh its forecast without adding trading gains',()=>{
  const at=actualTimestamp(gameDayStart(9)),state=startLive(null,at);
  settle(state);nextDay(state);
  rollDeskRate(state,()=>.99);
  assert.equal(takeDeskLoan(state,50_000_000),'');
  const {assets:previousClose,profit:previousGain}=ranking(state).find(person=>person.me);
  assert.ok(dailySpendingEstimate(state)>0);
  const start=actualTimestamp(gameDayStart(state.day));
  assert.ok(applyForRehabilitation(state,null,start));
  assert.equal(dailySpendingEstimate(state),0);
  for(let round=0;round<2;round++){
    const now=start+2000*round;
    if(round)assert.ok(startRehabilitationRound(state,rehabilitationView(state).token,now));
    const {duration,token,perfectStart,perfectEnd}=rehabilitationView(state);
    assert.equal(stopRehabilitationRound(state,token,now+duration*(perfectStart+perfectEnd)/2),'won');
  }
  assert.equal(dailySpendingEstimate(state),estimateDailySpending(state.mental,state.cash,state.cash));
  const receipts=householdLedger(state).filter(row=>row.type==='rehabilitation');
  assert.equal(receipts.length,2);
  assert.equal(new Set(receipts.map(row=>row.id)).size,2);
  assert.deepEqual(householdLedgerTotals(receipts),{income:1_000_000,living:0,byCurrency:{KRW:1_000_000}});
  assert.equal(reviewValues(state).values.rehabilitation,'+1,000,000원');
  const self=ranking(state).find(person=>person.me);
  assert.equal(self.profit,previousGain);
  assert.equal(self.assets,previousClose);
  settle(state);
  assert.equal(state.history.at(-1).gains,0);
  assert.match(renderView(SettlementSummary,{state}),/회생 지원금<\/dt><dd>1,000,000원/);
});

test('minute charges preserve older ten-second receipts and are collected once per visible interval',()=>{
  const at=actualTimestamp(gameDayStart(9)),state=startLive(null,at);
  const wealth=state.cash,amount=530,mental=75;
  state.cash-=amount;
  state.startWealth-=amount;
  state.cashSequence=1;
  state.liveSpending={day:state.day,at,step:state.cursor,seq:1,total:amount,count:1,
    recent:[{at,gameAt:gameTimestamp(at),amount,mental,wealth}]};
  assert.equal(loadable(state),true);
  assert.equal(spendingInterval,60_000);
  assert.equal(spendingPerTick(100,wealth),30);
  assert.equal(spendingWealthCharge(0,wealth),750);
  const restored=startLive(structuredClone(state),at);
  assert.equal(chargeLiveSpending(restored,at+10_000),0);
  assert.equal(chargeLiveSpending(restored,at+59_999),0);
  assert.equal(chargeLiveSpending(restored,at+spendingInterval),366);
  assert.equal(chargeLiveSpending(restored,at+spendingInterval),0);
  assert.deepEqual(restored.liveSpending.recent[0],state.liveSpending.recent[0]);
  assert.equal(restored.liveSpending.total,896);
  assert.equal(restored.cash,wealth-896);
  assert.equal(loadable(restored),true);
  const html=renderView(SpendingBody,{state:restored});
  assert.match(html,/366원 \/ 1분/);
  assert.match(html,/186원 \(0\.00375%\)/);
  assert.match(html,/최대 0\.015%/);
});

test('retired expenses only appear as paid amounts on archived days',()=>{
  const state=startLive(null,actualTimestamp(gameDayStart(11)));
  state.mental=12;
  const cash=state.cash;
  settle(state);
  assert.equal(state.cash,cash+state.history[0].bill.income);
  assert.equal(state.history[0].purchase,undefined);
  assert.deepEqual(householdLedger(state).filter(row=>row.category==='living'),[]);

  const record=state.history[0];
  record.bill={...record.bill,due:18000,debt:3000,items:[{name:'시장 장보기',amount:18000}]};
  record.purchase={amount:80000};
  const receipt=renderView(SettlementSummary,{state,day:record.day});
  assert.match(receipt,/95,000원/);
  assert.doesNotMatch(receipt,/시장 장보기|생활비 품목/);
  const paid=householdLedger(state).filter(row=>row.category==='living');
  assert.deepEqual(paid.map(row=>row.legs[0].amount),[-15000,-80000]);
});
