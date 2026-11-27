import test from 'node:test';
import assert from 'node:assert/strict';
import {accountCalendar,accountTick,actualTimestamp,civilDate,gameDayStart} from '../src/game/clock-calendar.mjs';
import {dailyActivity} from '../src/game/investment-activity.mjs';
import {balance,drawCredit,exchange,loadable,localRates,placeOrder,settle,takeCredit,upgrade} from '../src/game/market.mjs';
import {fxQuote} from '../src/game/fx.mjs';
import {householdLedger,householdLedgerTotals} from '../src/game/status.mjs';
import {startLive,syncLiveClock} from '../src/game/live-clock.mjs';
import {fmtMoney,symbolIndex} from '../src/game/world.mjs';
import {quoteInfo} from '../src/game/tape.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';
const {AssetsPage,SettlementSummary}=await loadJsx(new URL('../src/ui/home.jsx',import.meta.url));

const {ActivityBody,ActivityLinks}=await loadJsx(new URL('../src/ui/accounts.jsx',import.meta.url));
const activityBody=(state,kind,day)=>renderView(ActivityBody,{state,modal:{kind,day}});
const activityLinks=state=>renderView(ActivityLinks,{state});

const novemberEnd=14,decemberStart=15;
const at=(day,hour,minute=0)=>actualTimestamp(gameDayStart(day)+(hour*60+minute)*60000);

test('a recorded exchange keeps its original slot time as the live clock advances',()=>{
  const s=startLive(null,at(9,9,1));
  assert.equal(exchange(s,'KRW','USD',100_000),'');
  const {day,step}=s.fxLog.at(-1);
  assert.equal(accountCalendar(s,day,step),'Day 1 09:00');
  syncLiveClock(s,at(9,9,4));
  assert.equal(accountCalendar(s),'Day 1 09:04');
  assert.equal(accountCalendar(s,day,step),'Day 1 09:00');
});

test('confirming a stale FX quote leaves both wallets and the account history intact',()=>{
  const s=startLive(null,at(9,9));
  const amount=100_000,from='KRW',to='USD';
  const oldQuote=fxQuote(localRates(s),from,to,amount);
  syncLiveClock(s,at(9,10));
  const quote=fxQuote(localRates(s),from,to,amount),cash=s.cash;
  assert.notEqual(quote.received,oldQuote.received);
  assert.match(exchange(s,from,to,amount,oldQuote),/환율이 바뀌었어/);
  assert.equal(s.cash,cash);
  assert.equal(s.wallets.USD,0);
  assert.equal(s.fxLog.length,0);
  assert.equal(exchange(s,from,to,amount,quote),'');
  assert.equal(s.wallets.USD,quote.received);
  assert.equal(s.cash,cash-amount);
});

test('the report uses each day’s new bank interest even across an older no-loan week',()=>{
  const s=startLive(null,at(13,9));
  const borrow=()=>{
    assert.equal(drawCredit(s,1_000_000,()=>0),'');
    assert.equal(takeCredit(s,0),'');
  };
  borrow();
  syncLiveClock(s,at(15,0));
  const paidBefore=s.credit.paidInterest;
  assert.ok(paidBefore>0);
  const emptyDay=s.history.find(row=>row.day===14);
  assert.equal(emptyDay.credit.accruedTotal,paidBefore);
  emptyDay.credit.accruedTotal=0; // Old saves reset the displayed cumulative value on no-loan days.
  borrow();
  const newInterest=s.credit.application.offers[0].dailyInterest;
  assert.ok(newInterest>0);
  syncLiveClock(s,at(16,0));
  const closed=s.history.at(-1);
  assert.equal(closed.credit.interestToday,newInterest);
  assert.equal(closed.credit.accruedTotal,paidBefore+newInterest);
  closed.credit.interestToday=closed.credit.accruedTotal; // The same save could also contain the overcounted day.
  const html=renderView(SettlementSummary,{state:s,day:closed.day});
  assert.match(html,new RegExp('이날 붙은 은행 이자</dt><dd[^>]*>'+fmtMoney(newInterest)+'</dd>'));
  assert.equal(householdLedger(s).find(row=>row.type==='interest'&&row.day===closed.day).accruedInterest,newInterest);
});

test('asset history includes older records inline and does not count accrued interest as cash',()=>{
  const s=startLive(null,at(9,9));
  assert.equal(exchange(s,'KRW','USD',1_000_000),'');
  const fx=s.fxLog[0];
  syncLiveClock(s,at(17,9));
  const [first,,third]=s.history;
  first.credit={accruedTotal:125,interestToday:125};
  third.credit={accruedTotal:180,interestToday:180};
  third.loanDesk={interestToday:45};
  const rows=householdLedger(s).filter(row=>row.type==='interest');
  assert.deepEqual(rows.map(row=>row.accruedInterest).sort((a,b)=>a-b),[45,55,125]);
  assert.deepEqual(householdLedgerTotals(rows).byCurrency,{});
  const html=renderView(AssetsPage,{state:s,view:'ledger'});
  assert.match(html,/>내역<\/button>.*일급 및 보너스 입금.*환전 수수료.*시작 자금/);
  const fxRow=html.match(/<li class="st-entry">(?:(?!<\/li>).)*환전 수수료.*?<\/li>/)?.[0];
  assert.deepEqual(fxRow?.match(/<b[^>]*>([^<]+)<\/b>/g),[
    '<b class="st-entry-amount st-out">−'+fmtMoney(fx.cost,'KRW')+'</b>',
  ]);
  assert.deepEqual(householdLedgerTotals(householdLedger(s).filter(row=>row.type==='fx')).byCurrency,
    {KRW:-fx.amount,USD:fx.received});
  assert.doesNotMatch(html,/<details|<select|가계부|다음 내역 보기/);
});

function fill(s,i,qty,d,h,min){
  syncLiveClock(s,at(d,h,min));
  assert.equal(placeOrder(s,i,qty),'');
  assert.equal(syncLiveClock(s,at(d,h,min+1)).filled,1);
  return s.fills.at(-1);
}

test('pending, changed, cancelled and filled orders count once on the day placed',()=>{
  const s=startLive(null,at(novemberEnd,23,30)),i=symbolIndex.ARC;
  assert.equal(exchange(s,'KRW','USD',1_500_000),'');
  assert.equal(placeOrder(s,i,1,1),'');assert.equal(placeOrder(s,i,2,1),'');
  assert.equal(placeOrder(s,i,2,1),''); // repeat of the same resting order
  assert.equal(dailyActivity(s).orders.length,2);
  assert.equal(placeOrder(s,i,0),'');assert.equal(dailyActivity(s).orders.length,2);
  assert.equal(placeOrder(s,i,1,1),'');
  syncLiveClock(s,at(decemberStart,1));
  assert.equal(s.orders[i],1);
  assert.equal(dailyActivity(s).orders.length,0);
  assert.equal(dailyActivity(s,novemberEnd).orders.length,3);
  fill(s,i,1,decemberStart,1,3);
  const nov=dailyActivity(s,novemberEnd);
  assert.deepEqual(nov.orders.map(r=>r.status),['취소','취소','취소']);
  assert.equal(dailyActivity(s).orders.length,1);
  assert.match(activityBody(s,'orders',novemberEnd),/변경으로 취소/);
  const old=structuredClone(s);
  old.history.find(r=>r.day===novemberEnd).expired=[{i,qty:1,step:288}];
  assert.equal(dailyActivity(old,novemberEnd).orders.length,4,'old expiries stay on the settlement date');
});

test('an order filled after midnight stays on the day it was placed',()=>{
  const i=symbolIndex.ARC,s=startLive(null,at(novemberEnd,23,59)),p=accountTick(novemberEnd,287,299);
  assert.equal(exchange(s,'KRW','USD',1_500_000),'');
  assert.equal(placeOrder(s,i,1),'');
  // Submit after the last print in the 23:55 candle.
  s.orderTime[i]=p;
  syncLiveClock(s,at(decemberStart,0,2));
  assert.equal(s.fills[0].placedAt,p);
  assert.equal(dailyActivity(s).orders.length,0);
  assert.equal(dailyActivity(s,novemberEnd).orders[0].status,'체결');
  assert.match(activityLinks(s),/>1건<\/b>/);
  assert.match(activityBody(s,'orders'),/어제 23:59/);
});

test('the settlement report shows the selected day’s investment and realized sales results',()=>{
  const state=startLive(null,at(7,9)), i=symbolIndex.MOON;
  const receipt={day:6,gains:-10519,bill:{income:114286,incomePeriod:'day',sales:[{i,realizedKRW:250}]},
    liveSpending:{total:66887,count:1335},trades:[{i,qty:1},{i,qty:-1,realizedKRW:1200}],expired:[{i,qty:-1,realizedKRW:5000}]};
  state.history.push(receipt,{day:7,bill:{income:114286,incomePeriod:'day'},
    liveSpending:{total:4567},trades:[{i,qty:-1,realizedKRW:21000}]});
  const draw=()=>renderView(SettlementSummary,{state,day:receipt.day});
  const html=draw();
  assert.match(html,/<section class="day-living"><h3>투자 손익<\/h3>.*<dt>매도 손익<\/dt><dd>\+1,450원<\/dd>/);
  assert.match(html,/<dt>이날 투자 손익<\/dt><dd>−10,519원<\/dd>/);
  assert.match(html,/<dt>실시간 소비<\/dt><dd>66,887원<\/dd>/);
  assert.doesNotMatch(html,/마감표|매수|21,000원|4,567원|1335회/);
  receipt.trades[1].realizedKRW=null;
  assert.match(draw(),/매도 손익<\/dt><dd>기록 일부 없음/);
});

test('investment history totals include every day while profit analysis still selects one day',()=>{
  const s=startLive(null,at(7,9)),i=symbolIndex.MOON;
  fill(s,i,4,7,9,10);fill(s,i,-1,7,10,10);
  fill(s,i,1,8,9,10);
  assert.equal(dailyActivity(s,7).sales.length,1);
  assert.equal(dailyActivity(s,8).sales.length,0);
  assert.equal(dailyActivity(s,7).orders.length,2);
  assert.equal(dailyActivity(s,8).orders.length,1);
  assert.match(activityLinks(s),/>3건<\/b>/);
  assert.doesNotMatch(activityLinks(s),/Day|이번 달/);
  assert.match(activityBody(s,'analysis',7),/Day 1<\/strong>/);
  assert.match(activityBody(s,'analysis'),/Day 2<\/strong>/);
  const orders=activityBody(s,'orders');
  assert.equal(orders.match(/<li>/g).length,3);
  assert.match(orders,/어제 09:10/);
  assert.match(orders,/오늘 09:10/);
  for(const kind of ['orders','sales','dividends'])assert.doesNotMatch(activityBody(s,kind),/Day |activity-day/);
  assert.doesNotMatch(activityBody(s,'analysis'),/2026년|11월|이번 달/);
});

test('partial sales use real trade cost; dividends settle once in each native currency',()=>{
  assert.equal(civilDate(novemberEnd),'2026-11-30');
  const kr=symbolIndex.MOON,us=symbolIndex.ARC,s=startLive(null,at(novemberEnd,9));
  const buy=fill(s,kr,8,novemberEnd,9,1),sell=fill(s,kr,-2,novemberEnd,10,2);
  const ledgerHtml=renderView(AssetsPage,{state:s,view:'ledger'});
  assert.match(ledgerHtml,/ 매수<\/h3><div class="st-entry-meta">09:00<\/div><\/div><b class="st-entry-amount st-out">−/);
  assert.doesNotMatch(ledgerHtml,/주 ×|체결가 미기록/);
  const expected=sell.cashDelta-(-buy.cashDelta-Math.round(-buy.cashDelta*6/8));
  assert.equal(sell.realizedKRW,expected);
  assert.equal(exchange(s,'KRW','USD',1_500_000),'');fill(s,us,3,novemberEnd,23,35);
  const usd=balance(s,'USD'),before=structuredClone(s);
  syncLiveClock(s,at(decemberStart,0,5));
  assert.equal(balance(s,'USD'),Number((usd+.21).toFixed(2)));
  const rec=s.history.at(-1),m=dailyActivity(s,novemberEnd);
  assert.deepEqual(rec.dividends.map(r=>[r.i,r.qty,r.amount]),[[kr,6,300],[us,3,.21]]);
  assert.equal(m.saleProfit,expected);assert.equal(m.dividendIncome,rec.dividends.reduce((n,r)=>n+r.amountKRW,0));
  const ledger=householdLedger(s).filter(r=>r.type==='dividend');
  assert.equal(householdLedgerTotals(ledger).income,m.dividendIncome);
  assert.match(renderView(SettlementSummary,{state:s,row:rec,notices:[]}),/받은 배당금/);
  assert.match(activityBody(s,'dividends',novemberEnd),/\$0\.21/);
  assert.ok(activityLinks(s).includes('>'+m.dividendIncome.toLocaleString('ko-KR')+'원</b>'));
  assert.ok(activityBody(s,'dividends').includes('>'+m.dividendIncome.toLocaleString('ko-KR')+'원</strong>'));
  const profit=(expected>0?'+':'')+fmtMoney(expected);
  assert.ok(activityLinks(s).includes('>'+profit+'</b>'));
  assert.ok(activityBody(s,'sales').includes('>'+profit+'</strong>'));
  assert.match(activityBody(s,'analysis',novemberEnd),/판매수익과 배당금 합계/);
  assert.equal(dailyActivity(s).dividendIncome,0);
  const restored=startLive(structuredClone(s),at(decemberStart,0,5));assert.deepEqual(restored.history,s.history);
  settle(before);const closed=structuredClone(before);settle(before);
  assert.deepEqual(closed,before);assert.equal(dailyActivity(before).orders.length,3);
  const offline=startLive(before,at(decemberStart,0,5));
  assert.deepEqual(offline.history[0].dividends,rec.dividends);
  assert.equal(loadable(offline),true);
});

test('old bonds retain their coupons and option holdings can be sold after retirement',()=>{
  const old=startLive(null,at(novemberEnd,9));
  const {KTB3Y,MOONC,MOONP}=symbolIndex;
  const optionCost=quoteInfo(old,MOONC).price;
  old.holdings[KTB3Y]=2;
  old.costs[KTB3Y]=old.costsKRW[KTB3Y]=2*quoteInfo(old,KTB3Y).price;
  old.holdings[MOONC]=1;
  old.costs[MOONC]=old.costsKRW[MOONC]=optionCost;
  old.orders[MOONC]=1;
  old.ordered[MOONC]=true;
  const s=upgrade(old);
  assert.equal(s.holdings[KTB3Y],2);
  assert.equal(s.orders[MOONC],0);
  assert.equal(s.expired.at(-1).reason,'매수 지원 종료');
  assert.equal(placeOrder(s,KTB3Y,1),'보유분 매도만 가능해.');
  assert.equal(placeOrder(s,MOONC,1),'보유분 매도만 가능해.');
  const sale=fill(s,MOONC,-1,novemberEnd,9,6);
  assert.equal(sale.unit,'계약');
  assert.equal(s.holdings[MOONC],0);
  assert.equal(sale.realizedKRW,sale.cashDelta-optionCost);
  const callBefore=quoteInfo(s,MOONC).price,putBefore=quoteInfo(s,MOONP).price;
  const shock={code:'MOON',tick:(novemberEnd-1)*288,bps:500,id:'test-event'};
  const repriced={...s,ritualEvents:[shock]};
  assert.ok(quoteInfo(repriced,MOONC).price<callBefore);
  assert.ok(quoteInfo(repriced,MOONP).price>putBefore);

  syncLiveClock(s,at(decemberStart,0,5));
  const payment=s.history.at(-1).dividends.find(row=>row.i===KTB3Y);
  assert.equal(payment.amount,Math.round(2*3100/12));
  assert.match(activityBody(s,'dividends'),/국고채 3년 이자/);
  assert.equal(loadable(s),true);
});

test('older partial and forced sales reconstruct without changing balances or issuing past dividends',()=>{
  const s=startLive(null,at(decemberStart,9)),i=symbolIndex.MOON;
  s.history=[{day:novemberEnd,trades:[{i,qty:4,price:100,currency:'KRW'},{i,qty:-1,price:90,currency:'KRW'}],
    bill:{sales:[{i,qty:1,amount:110,currency:'KRW'}]},expired:[],cancelled:[]}];
  s.holdings[i]=2;s.costs[i]=s.costsKRW[i]=200;delete s.realizedKRW;delete s.saleHistoryVersion;
  const restored=upgrade(s);assert.equal(restored.cash,s.cash);assert.equal(restored.realizedKRW,0);
  assert.deepEqual(dailyActivity(restored,novemberEnd).sales.map(r=>r.realizedKRW),[10,-10]);
  assert.equal(dailyActivity(restored,novemberEnd).orders.length,2);
  assert.equal(dailyActivity(restored,novemberEnd).dividendIncome,0);
  assert.equal(s.history[0].trades[1].realizedKRW,undefined,'upgrading does not mutate original archive');
  assert.equal(upgrade(restored),restored);
  s.history[0].trades.shift();
  assert(dailyActivity(upgrade(s),novemberEnd).incomplete);
  assert.match(activityBody(upgrade(s),'sales',novemberEnd),/기록 부족/);
  assert.match(activityLinks(restored),/주문 내역/);
});
