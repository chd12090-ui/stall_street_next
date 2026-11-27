import test from 'node:test';
import assert from 'node:assert/strict';
import {glassesPrice,buyGlasses,forecastWithGlasses,hasGlasses} from '../src/game/ai-glasses.mjs';
import {closedAmounts,reviewValues} from '../src/game/day-report.mjs';
import {householdLedger} from '../src/game/status.mjs';
import {grossAssets,initial,placeOrder} from '../src/game/market.mjs';
import {accountTick} from '../src/game/clock-calendar.mjs';
import {quoteInfo} from '../src/game/tape.mjs';
import {symbolIndex} from '../src/game/world.mjs';

const at=(day,minute)=>({...initial(),clockMode:'kst',openingDay:13,day,
  cursor:Math.floor(minute/5),wallMinute:minute,wallSecond:37});

const buy=state=>buyGlasses(state,glassesPrice(state));

test('AI glasses cost the base price plus 2% of all assets and respect reserved cash',()=>{
  const state=at(17,723),balance=state.cash,price=glassesPrice(state);
  assert.equal(price,2_100_000);
  const foreign=structuredClone(state);
  foreign.wallets.USD=200;
  foreign.holdings[symbolIndex.BMEM]=100;
  assert.equal(glassesPrice(foreign),2_000_000+Math.round(grossAssets(foreign)*.02));
  assert.ok(glassesPrice(foreign)>price);
  assert.match(buyGlasses(foreign,price),/가격이 바뀌었어/);
  const reserved=structuredClone(state);
  assert.equal(placeOrder(reserved,symbolIndex.MOON,200,24_000),'');
  assert.match(buy(reserved),/부족해/);
  assert.equal(reserved.cash,balance);
  assert.equal(buy(state),'');
  assert.ok(buy(state));
  assert.equal(state.cash,balance-price);
  assert.equal(state.startWealth,balance-price);
  assert.ok(hasGlasses(state));
  assert.ok(forecastWithGlasses(state,symbolIndex.BMEM,()=>.1));
  const second=glassesPrice(state);
  assert.equal(buy(state),'');
  assert.equal(reviewValues(state).extras,price+second);
  assert.equal(closedAmounts(state,{day:17}).glasses,price+second);
  assert.deepEqual(householdLedger(state).filter(row=>row.type==='shop').map(row=>row.legs[0].amount),[-second,-price]);
});

test('exactly 60% of rolls indicate the simulated direction after one game hour',()=>{
  const index=symbolIndex.BMEM;
  for(const [day,minutes] of [[17,1408],[17,964]]){
    let correct=0;
    for(let n=0;n<100;n++){
      const state=at(day,minutes);
      assert.equal(buy(state),'');
      const prediction=forecastWithGlasses(state,index,()=> (n+0.5)/100);
      const later=at(day+Math.floor((minutes+60)/1440),(minutes+60)%1440);
      const price=quoteInfo(later,index).price;
      assert.equal(prediction.price,quoteInfo(state,index).price);
      assert.notEqual(price,prediction.price);
      assert.equal(prediction.from,accountTick(day,state.cursor,minutes%5*60+37));
      assert.equal(prediction.until,prediction.from+3600);
      if(prediction.up===(price>prediction.price))correct++;
    }
    assert.equal(correct,60);
  }
});

test('one prediction consumes the glasses across symbols and reloads, with one use carried over from older saves',()=>{
  const state=at(17,723),index=symbolIndex.BMEM;
  const fail=()=>assert.fail('A call must not use randomness without a directional prediction');
  assert.equal(forecastWithGlasses(state,index,fail),null);
  state.aiGlasses={day:16,step:82,seq:1,cost:250_000,equipped:false,predictions:{}};
  assert.ok(hasGlasses(state));
  assert.equal(householdLedger(state).find(row=>row.type==='shop').legs[0].amount,-250_000);
  assert.ok(forecastWithGlasses(state,index,()=>.59));
  const reopened=JSON.parse(JSON.stringify(state));
  assert.equal(reopened.aiGlasses,undefined);
  assert.equal(hasGlasses(reopened),false);
  assert.equal(forecastWithGlasses(reopened,index,fail),null);
  assert.equal(forecastWithGlasses(reopened,symbolIndex.MOON,fail),null);
  const flat=at(17,1408);
  buy(flat);
  assert.equal(forecastWithGlasses(flat,symbolIndex.MOON,fail).up,null);
  assert.ok(hasGlasses(flat));
});
