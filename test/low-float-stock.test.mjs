import assert from 'node:assert/strict';
import test from 'node:test';
import {actualTimestamp,gameDayStart} from '../src/game/clock-calendar.mjs';
import {startLive,syncLiveClock} from '../src/game/live-clock.mjs';
import {balance,exchange,initial,loadable,orderAmounts,placeOrder,upgrade} from '../src/game/market.mjs';
import {marketPrints,tradeTotals} from '../src/game/market-ticks.mjs';
import {chartBars,fullDay,lastClose,quoteAt,quoteInfo,sessionBars} from '../src/game/tape.mjs';
import {previousSession,stocks,symbolIndex} from '../src/game/world.mjs';

const i=symbolIndex.FLFX;
const atOpen=seconds=>actualTimestamp(gameDayStart(8)+(23*60+30)*60000+seconds*1000);

test('the new US listing preserves the existing positions, pending orders and index basket',()=>{
  assert.equal(stocks[i].market,'arden');
  assert.equal(stocks[i].currency,'USD');
  assert.equal(stocks[i].archiveOnly,undefined);
  assert.equal(stocks[symbolIndex.AMIDX].reference.length,15);
  assert(!stocks[symbolIndex.AMIDX].reference.includes('FLFX'));
  const old=initial(),j=symbolIndex.AMIDX;
  old.holdings[j]=3;old.costs[j]=140;old.costsKRW[j]=195000;
  old.orders[j]=-1;old.ordered[j]=true;old.orderPrices[j]=55;
  const fields=['holdings','costs','costsKRW','orders','ordered','orderPrices','basisEstimated'];
  for(const key of fields)old[key]=old[key].slice(0,78);
  delete old.orderFees;
  assert(loadable(old));
  const migrated=upgrade(old);
  for(const key of fields)assert.deepEqual(migrated[key].slice(0,78),old[key]);
  assert.equal(migrated.holdings[i],0);
  assert.equal(migrated.orders[i],0);
  assert(loadable(migrated));
});

test('archived and live sessions sustain rapid rallies and reversals without unbounded compounding',()=>{
  let rallies=0,drops=0,fastTurns=0;
  for(let d=-27;d<70;d++){
    const bars=sessionBars(d,i);
    if(!bars.length)continue;
    const daily=fullDay(i,d),prev=lastClose(i,previousSession('arden',d));
    assert.equal(daily.o,bars[0].o);
    assert.equal(daily.h,Math.max(...bars.map(b=>b.h)));
    assert.equal(daily.l,Math.min(...bars.map(b=>b.l)));
    assert.equal(daily.c,lastClose(i,d));
    assert.equal(daily.c,bars.at(-1).c);
    assert.equal(daily.v,bars.reduce((sum,b)=>sum+b.v,0));
    for(const [k,b] of bars.entries()){
      assert(b.l>0 && b.l<=Math.min(b.o,b.c) && b.h>=Math.max(b.o,b.c));
      if(k)assert.equal(b.o,bars[k-1].c);
    }
    if(d<0)continue;
    if(daily.h/prev>=1.30)rallies++;
    if(daily.l/prev<=.70)drops++;
    if(bars.some(b=>b.c/b.o>=1.12)&&bars.some(b=>b.c/b.o<=.88))fastTurns++;
    assert(daily.c/stocks[i].base>.35 && daily.c/stocks[i].base<2.4);
  }
  assert(rallies>=35 && drops>=32 && fastTurns>=30);
});

test('the live chart, quote and dollar orders use the same arriving prints',()=>{
  const state=startLive(null,atOpen(0)),candle=sessionBars(8,i)[0],prints=marketPrints(candle,i);
  assert(prints.length>=200);
  assert.equal(exchange(state,'KRW','USD',500000),'');
  const cash=balance(state,'USD');
  assert.equal(placeOrder(state,i,2),'');
  for(const [n,qty] of [[1,2],[2,-1]]){
    if(qty<0)assert.equal(placeOrder(state,i,qty),'');
    const {at,price}=prints[n];
    assert.equal(syncLiveClock(state,atOpen(at)).filled,1);
    const fill=state.fills.at(-1),q=quoteInfo(state,i);
    assert.equal(fill.price,price);
    assert.equal(fill.second,at);
    assert.equal(fill.qty,qty);
    assert.equal(quoteAt(state,i),price);
    assert.equal(q.price,price);
    assert.equal(q.volume,tradeTotals(prints,at).v);
    for(const period of ['T','1','5','D'])assert.equal(chartBars(state,i,period).at(-1).c,price);
  }
  assert.equal(state.holdings[i],1);
  assert.equal(balance(state,'USD'),Number((cash-orderAmounts(i,2,prints[1].price).total+prints[2].price).toFixed(2)));
  assert(loadable(JSON.parse(JSON.stringify(state))));
});
