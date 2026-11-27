import test from 'node:test';
import assert from 'node:assert/strict';
import {accountTick,actualTimestamp,gameDayStart} from '../src/game/clock-calendar.mjs';
import {startLive,syncLiveClock} from '../src/game/live-clock.mjs';
import {ECON,advanceMarket,balance,exchange,exchangeable,initial,limit,loadable,localRates,nextDay,orderAmounts,placeOrder,settle,upgrade} from '../src/game/market.mjs';
import {dailyActivity} from '../src/game/investment-activity.mjs';
import {barAt,quoteAt} from '../src/game/tape.mjs';
import {stocks,symbolIndex} from '../src/game/world.mjs';

const at=(day,hour,minute=0,second=0)=>actualTimestamp(gameDayStart(day)+((hour*60+minute)*60+second)*1000);

test('stock and ETF purchase fees are reserved, charged, and included in the eventual sale basis',()=>{
  const ordinary=symbolIndex.MOON,fund=symbolIndex.MOR2;
  assert.deepEqual(orderAmounts(ordinary,1,20_000),{notional:20_000,fee:30,total:20_030});
  assert.deepEqual(orderAmounts(fund,1,20_000),{notional:20_000,fee:70,total:20_070});
  assert.equal(orderAmounts(symbolIndex.BIT,.25,200).fee,0);
  for(const i of [ordinary,fund]){
    const state=initial(),price=quoteAt(state,i),amounts=orderAmounts(i,1,price);
    state.cash=amounts.total-1;
    assert.equal(limit(state,i,'buy',price),0);
    assert.match(placeOrder(state,i,1,price),/잔액/);
    state.cash=amounts.total;
    assert.equal(limit(state,i,'buy',price),1);
    assert.equal(placeOrder(state,i,1,price),'');
    assert.equal(exchangeable(state,'KRW'),0);
    assert.equal(state.cash,amounts.total);
    const [buy]=advanceMarket(state,1);
    assert.equal(buy.fee,amounts.fee);
    assert.equal(buy.cashDelta,-amounts.total);
    assert.equal(state.cash,0);
    assert.equal(state.costsKRW[i],amounts.total);
    assert.equal(placeOrder(state,i,-1),'');
    const [sale]=advanceMarket(state,1);
    assert.equal(sale.cashDelta,sale.price);
    assert.equal(sale.realizedKRW,sale.price-amounts.total);
  }
});

test('a saved buy reservation from before commissions keeps its original terms',()=>{
  const original=initial(),i=symbolIndex.MOON,price=quoteAt(original,i);
  delete original.orderFees;
  original.cash=price;original.orders[i]=1;original.orderPrices[i]=price;original.ordered[i]=true;
  assert.ok(loadable(original));
  const state=upgrade(original);
  assert.equal(exchangeable(state,'KRW'),0);
  assert.equal(placeOrder(state,i,1,price),'');
  const [fill]=advanceMarket(state,1);
  assert.equal(fill.cashDelta,-price);
  assert.equal(fill.fee,undefined);
  assert.equal(state.cash,0);
});

test('closing a local venue reserves a market buy across reload and midnight until the next opening print',()=>{
  const day=8,i=symbolIndex.MOON,s=startLive(null,at(day,15,30)),before=balance(s,'KRW');
  assert.equal(placeOrder(s,i,2),'');
  assert.equal(s.holdings[i],0);
  assert.equal(exchangeable(s,'KRW'),before-orderAmounts(i,2,quoteAt(s,i)).total);
  const save=JSON.parse(JSON.stringify(s));
  assert.ok(loadable(save));
  const resumed=startLive(save,at(day+1,8,59,59));
  assert.equal(resumed.orders[i],2);
  assert.equal(resumed.holdings[i],0);
  assert.equal(syncLiveClock(resumed,at(day+1,9)).filled,1);
  assert.equal(resumed.fills[0].second,0);
  assert.equal(resumed.fills[0].price,barAt(i,day+1,0).o);
  assert.equal(resumed.fills[0].placedAt,accountTick(day,186));
  assert.equal(dailyActivity(resumed,day).orders[0].status,'체결');
  assert.equal(syncLiveClock(resumed,at(day+1,9,1)).filled,0);
});

test('retired listings keep past holdings and sell reservations while legacy currency settles in won',()=>{
  const day=8,i=symbolIndex.TIDE,j=symbolIndex.CORL,now=at(day,11,40);
  const old=startLive(null,now),rates=localRates(old);
  old.holdings[i]=2;old.costs[i]=6000;old.costsKRW[i]=57_000;
  old.wallets.JPY=23_400;old.wallets.CNY=193.28;old.wallets.USD=500;
  old.orders[j]=1;old.ordered[j]=true;old.orderPrices[j]=1;
  assert.equal(placeOrder(old,i,-1),'');
  assert.ok(loadable(old));
  const s=startLive(old,now);
  const migrated=old.cash+Math.round(old.wallets.JPY*rates.JPY)+Math.round(old.wallets.CNY*rates.CNY);
  assert.equal(s.cash,migrated);
  assert.equal(s.wallets.USD,500);
  assert.equal(s.wallets.JPY,0);
  assert.equal(s.wallets.CNY,0);
  assert.equal(s.holdings[i],2);
  assert.equal(s.costs[i],6000);
  assert.equal(s.orders[j],0);
  assert.equal(s.expired.at(-1).reason,'매수 지원 종료');
  assert.equal(s.orders[i],-1);
  assert.equal(old.wallets.JPY,23_400);
  assert.ok(s.fxLog.every(row=>row.cost===0&&row.to==='KRW'));
  assert.equal(upgrade(s),s);
  assert.match(exchange(s,'KRW','JPY',1_000_000),/원화와 달러만/);
  assert.match(exchange(s,'CNY','KRW',100),/원화와 달러만/);
  assert.match(placeOrder(s,i,1),/보유분 매도만/);
  assert.equal(barAt(i,day,32),null);
  assert.equal(syncLiveClock(s,at(day,12,29,59)).filled,0);
  assert.equal(syncLiveClock(s,at(day,12,30)).filled,1);
  const sale=s.fills[0];
  assert.equal(sale.price,barAt(i,day,42).o);
  assert.equal(sale.currency,'JPY');
  assert.equal(s.holdings[i],1);
  assert.equal(s.wallets.JPY,0);
  assert.equal(s.cash,migrated+Math.round(sale.cashDelta*localRates(s).JPY));
  assert.equal(s.fxLog.at(-1).amount,sale.cashDelta);
  assert.equal(placeOrder(s,i,-1,1_000_000),'');
  syncLiveClock(s,at(day,15,30));
  assert.equal(s.orders[i],0);
  assert.equal(s.expired.at(-1).reason,'장 종료');
});

test('US market sales fill at opening and unfilled limits remain active through account midnight',()=>{
  const day=8,i=symbolIndex.ARC,sale=symbolIndex.FLFX,s=startLive(null,at(day,22));
  assert.equal(exchange(s,'KRW','USD',1_000_000),'');
  assert.equal(placeOrder(s,i,1,1),'');
  assert.equal(placeOrder(s,i,2,1),'');
  assert.equal(s.cancelled[0].reason,'주문 변경');
  s.holdings[sale]=2;s.costs[sale]=12;s.costsKRW[sale]=16_000;
  assert.equal(placeOrder(s,sale,-2),'');
  assert.equal(syncLiveClock(s,at(day,23,29,59)).filled,0);
  assert.equal(syncLiveClock(s,at(day,23,30)).filled,1);
  assert.equal(s.fills[0].price,barAt(sale,day,174).o);
  assert.equal(s.holdings[sale],0);
  assert.equal(syncLiveClock(s,at(day+1,0,2)).filled,0);
  assert.equal(s.orders[i],2);
  assert.equal(s.orderTime[i],accountTick(day,264));
  syncLiveClock(s,at(day+1,6));
  assert.equal(s.orders[i],0);
  assert.equal(s.expired[0].placedAt,accountTick(day,264));
});

test('closed-session sale proceeds cannot finance buys and cancellations cannot be blocked by price or wallet changes',()=>{
  const s=startLive(null,at(8,18)),us=symbolIndex.ARC,coin=symbolIndex.BIT;
  s.holdings[us]=2;s.holdings[coin]=.01;
  assert.equal(placeOrder(s,us,-1),'');
  assert.equal(limit(s,coin,'buy'),0);
  assert.match(placeOrder(s,coin,stocks[coin].lot),/돈이 부족/);
  assert.equal(placeOrder(s,coin,-.005),'');
  assert.equal(limit(s,us,'buy'),0);
  assert.match(placeOrder(s,us,1),/돈이 부족/);
  assert.match(placeOrder(s,us,-3),/보유 수량이 부족/);
  s.wallets.USD=1.01;
  assert.equal(placeOrder(s,symbolIndex.NOVA,1,1),'');
  s.wallets.USD=0;
  assert.equal(placeOrder(s,us,0),'');
  assert.equal(s.cancelled.at(-1).reason,'직접 취소');
});

test('midnight credits the wage without charging retired bills or liquidating reserved shares',()=>{
  const day=11,i=symbolIndex.MOON,s=startLive(null,at(day,16));
  s.cash=0;s.holdings[i]=2;s.costs[i]=s.costsKRW[i]=44_000;
  assert.equal(placeOrder(s,i,-2),'');
  const tick=syncLiveClock(s,at(day+1,0));
  assert.equal(tick.rolled,true);
  assert.equal(tick.filled,0);
  assert.equal(s.orders[i],-2);
  assert.equal(s.holdings[i],2);
  assert.equal(s.cash,ECON.salary+s.history[0].bill.bonus);
  assert.equal(s.history[0].bill.due,0);
  assert.equal(s.history[0].expired.length,0);
});

test('older slot-based games also carry a reservation to the next playable day',()=>{
  const s=initial(),i=symbolIndex.MOON;
  advanceMarket(s,80);
  assert.equal(placeOrder(s,i,1),'');
  assert.equal(s.fills.length,0);
  settle(s);
  assert.equal(s.orders[i],1);
  nextDay(s);
  assert.equal(advanceMarket(s,1).length,1);
  assert.equal(s.fills[0].price,barAt(i,1,0).o);
});

test('the coin split preserves existing orders, cost basis and historical fills across repeated room loads',()=>{
  const index=symbolIndex.BIT,asset=stocks[index],old=initial();
  delete old.nyangUnits;
  const qty=.012345,limitPrice=88888.97;
  old.holdings[index]=qty;
  old.orders[index]=-.000011;
  old.orderPrices[index]=limitPrice;
  old.costs[index]=1085.35;
  old.costsKRW[index]=1_490_000;
  old.fills=[{i:index,name:'비트코인',qty,price:87500,cashDelta:-1080.19,currency:'USD'}];
  const original=structuredClone(old);
  const game=upgrade(old);
  assert.equal(loadable(old),true);
  assert.equal(loadable(game),true);
  assert.deepEqual(old,original);
  assert.equal(asset.ticker,'NYAN');
  assert.ok(asset.base*1380>=300000&&asset.base*1380<400000);
  assert.equal(game.holdings[index],4.938);
  assert.equal(game.orders[index],-.0044);
  assert.equal(game.orderPrices[index],limitPrice/400);
  assert.equal(game.costs[index],1085.35);
  assert.equal(game.costsKRW[index],1_490_000);
  assert.deepEqual(game.fills[0],{...old.fills[0],name:'냥이코인',qty:4.938,price:218.75});
  assert.deepEqual(upgrade(structuredClone(game)),game);
});
