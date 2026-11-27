import test from 'node:test';
import assert from 'node:assert/strict';
import {accountTick,actualTimestamp,continuousTradingDay,gameDayStart} from '../src/game/clock-calendar.mjs';
import {startLive,syncLiveClock} from '../src/game/live-clock.mjs';
import {exchange,loadable,placeOrder} from '../src/game/market.mjs';
import {dailyActivity} from '../src/game/investment-activity.mjs';
import {barAt,chartBars,lastClose,quoteInfo,sessionBars} from '../src/game/tape.mjs';
import {fundTracking} from '../src/game/securities-data.mjs';
import {snapPrice,stocks,symbolIndex} from '../src/game/world.mjs';

const at=(day,hour,minute=0,second=0)=>actualTimestamp(gameDayStart(day)+((hour*60+minute)*60+second)*1000);

test('index and single-stock ETFs follow their own underlying prices at every live sample',()=>{
  const day=continuousTradingDay+2,group=stocks.filter(s=>s.dailyFund||s.code==='MOR2'||s.code==='MORI');
  assert.equal(group.length,10);
  const samples=[at(day,9,0,11),at(day,12,34,30),at(day,20,1,51)];
  for(const timestamp of samples){
    const state=startLive(null,timestamp);
    for(const asset of group){
      const i=symbolIndex[asset.code],terms=fundTracking(asset,day),member=symbolIndex[terms.reference[0]];
      const previous=lastClose(i,day-1),underlying=quoteInfo(state,member);
      const expected=snapPrice(i,previous*(1+terms.factor*underlying.pct/100));
      const quote=quoteInfo(state,i);
      assert.equal(quote.price,expected,asset.code);
      assert.equal(chartBars(state,i,'5').at(-1).c,expected,asset.code);
    }
  }
});

test('continuous trading produces a full Saturday tape for every active listing and keeps the old candles',()=>{
  const saturday=continuousTradingDay+6;
  for(const [i,asset] of stocks.entries()){
    if(asset.archiveOnly)continue;
    const bars=sessionBars(saturday,i);
    assert.equal(bars.length,288,asset.code);
    assert.ok(bars.every((bar,step)=>bar.step===step&&Number.isFinite(bar.c)),asset.code);
  }
  const domestic=symbolIndex.MOON,foreign=symbolIndex.ARC;
  assert.ok(barAt(domestic,continuousTradingDay-1,77));
  assert.equal(barAt(domestic,continuousTradingDay-1,78),null);
  assert.ok(barAt(foreign,continuousTradingDay-1,174));
  const live=startLive(null,at(saturday,16,15,50));
  const last=chartBars(live,domestic,'5').at(-1);
  assert.equal(last.day,saturday);
  assert.equal(last.step,87);
  assert.equal(last.partial,true);
});

test('domestic and overseas market orders both fill during their former off-hours',()=>{
  const day=continuousTradingDay+6,domestic=symbolIndex.MOON,foreign=symbolIndex.ARC;
  const state=startLive(null,at(day,16,12));
  assert.equal(exchange(state,'KRW','USD',1_000_000),'');
  for(const i of [domestic,foreign])assert.equal(placeOrder(state,i,1),'');
  assert.equal(syncLiveClock(state,at(day,16,17)).filled,2);
  assert.equal(state.holdings[domestic],1);
  assert.equal(state.holdings[foreign],1);
  assert.ok(state.fills.every(row=>row.price>0&&row.placedAt===accountTick(day,194,120)));
});

test('unfilled limit orders retain their initial placement after midnight, reload and the next tape day',()=>{
  const day=continuousTradingDay+1,domestic=symbolIndex.MOON,coin=symbolIndex.BIT;
  const state=startLive(null,at(day,23,59,59));
  assert.equal(exchange(state,'KRW','USD',1_000_000),'');
  for(const i of [domestic,coin])assert.equal(placeOrder(state,i,stocks[i].lot,snapPrice(i,.01)),'');
  const resumed=startLive(JSON.parse(JSON.stringify(state)),at(day+1,9,1));
  assert.ok(loadable(resumed));
  assert.equal(resumed.history.at(-1).expired.length,0);
  for(const i of [domestic,coin]){
    assert.equal(resumed.orders[i],stocks[i].lot);
    assert.equal(resumed.ordered[i],true);
    assert.equal(resumed.orderTime[i],accountTick(day,287,299));
    assert.equal(placeOrder(resumed,i,0),'');
  }
  assert.deepEqual(dailyActivity(resumed,day).orders.map(row=>row.status),['취소','취소']);
});
