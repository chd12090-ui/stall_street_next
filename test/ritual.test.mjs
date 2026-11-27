import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initial,grossAssets,netWealth,exchangeable,localRates,placeOrder,matchLiveOrders,loadable,upgrade,takeDeskLoan} from '../src/game/market.mjs';
import {rollDeskRate} from '../src/game/loan-desk.mjs';
import {ritualQuote,reserveRitual,localRitualResult,finishRitual,cancelRitual} from '../src/game/ritual.mjs';
import {ritualChance,ritualCost,drawRitualOutcome,ritualArticleId,mergeRitualEvents,ritualTarget} from '../src/game/ritual-rules.mjs';
import {stocks,symbolIndex,snapPrice,visibleStories,articleById,fmtMoney} from '../src/game/world.mjs';
import {publicCompanyHistory} from '../src/game/company-filings.mjs';
import {chartBars,quoteAt,quoteInfo,schedule} from '../src/game/tape.mjs';
import {articleEvidence} from '../src/game/news-analysis.mjs';
import {householdLedger} from '../src/game/status.mjs';
import {closedAmounts,reviewValues} from '../src/game/day-report.mjs';
import {marketDayOffset} from '../src/game/clock-calendar.mjs';
import {mergeRoomRituals} from '../src/game/ritual-room.mjs';

const at=(s,tick)=>{
  const civil=tick+marketDayOffset,cursor=civil%288;
  return {...s,clockMode:'kst',day:Math.floor(civil/288),cursor,phase:'open',wallMinute:cursor*5,wallSecond:0};
};
const receipt=(s,roll)=>{
  const result=localRitualResult(s.ritualPending,()=>roll);
  assert.equal(finishRitual(s,result),true);
  assert.equal(finishRitual(s,result),false);
  return result;
};

test('the offering adds a millionth of market cap, rounds the sum to won and retains the impact endpoints',()=>{
  assert.equal(ritualCost(5_000_000,1_250_000_000_000),1_500_000);
  assert.equal(ritualCost(90_000_010,1_250_000_500_000),5_750_001);
  assert.equal(ritualChance(1),.9);assert.equal(ritualChance(75),67.5);
  assert.equal(ritualChance(100),90);
  const draw=(mental,...rolls)=>drawRitualOutcome(ritualChance(mental),()=>{
    assert.ok(rolls.length,'no additional draw is due');
    return rolls.shift();
  });
  assert.deepEqual(draw(0,0),{success:false,bps:0});
  assert.deepEqual(draw(50,.44999,0),{success:true,bps:250});
  assert.deepEqual(draw(50,.20,.5),{success:true,bps:625});
  assert.deepEqual(draw(50,.45),{success:false,bps:0});
  assert.deepEqual(draw(100,.89999,1-2**-32),{success:true,bps:1000});
  assert.deepEqual(draw(100,.90),{success:false,bps:0});
  assert.equal(draw(50.25,.4522,.25).success,true);
});

test('both outcomes spend once, persist a receipt, and keep the offering out of investment P&L',()=>{
  for(const roll of [0,.99]){
    const s=initial(),id=crypto.randomUUID(),before=100_000_000;
    s.cash=s.startWealth=before;
    s.mental=75;s.holdings[symbolIndex.BMEM]=3;s.wallets.USD=100;
    const {cost}=ritualQuote(s,'BMEM');
    assert.equal(reserveRitual(s,'BMEM',id,1),'');
    assert.equal(s.cash,before-cost);assert.equal(s.mental,0);
    assert.equal(s.startWealth,before-cost);assert.ok(reserveRitual(s,'MOON',crypto.randomUUID(),1));
    const result=receipt(s,roll),key=ritualArticleId(id);
    assert.equal(result.success,roll===0);assert.equal(s.ritualCharges.length,1);
    assert.equal(s.ritualLast.mental,75);assert.equal(s.ritualLast.chance,67.5);assert.equal(s.wallets.USD,100);
    assert.equal(s.ritualLast.bps,roll===0?250:0);
    assert.ok(loadable(s));
    const restored=upgrade(JSON.parse(JSON.stringify(s)));
    assert.equal(!!articleById(restored,key),roll===0);
    assert.ok(!visibleStories(restored).some(a=>a.id===key));
    assert.equal(visibleStories(at(restored,100)).filter(a=>a.id===key).length,Number(roll===0));
    if(result.success)assert.equal(articleEvidence(restored,key,'BMEM').question,'growth');
    assert.equal(householdLedger(restored).find(row=>row.type==='ritual').legs[0].amount,-cost);
    assert.equal(closedAmounts(restored,{day:s.day}).ritual,cost);
    assert.ok(reviewValues(restored).extras>=cost);
  }
});

test('the offering includes the borrowed cash, foreign cash and investments in gross assets',()=>{
  const s=initial(),id=crypto.randomUUID();
  s.holdings[symbolIndex.BMEM]=3;s.wallets.USD=100;
  const before=grossAssets(s);
  assert.equal(rollDeskRate(s,()=>.1),'');
  assert.equal(takeDeskLoan(s,10_000_000),'');
  const assets=grossAssets(s),cash=s.cash;
  assert.equal(assets,before+10_000_000);
  assert.ok(assets>cash);
  const code='FLFX',i=symbolIndex[code];
  const price=quoteInfo(s,i).price,shares=publicCompanyHistory(i,s).current.shares.end;
  const capKRW=price*shares*localRates(s).USD;
  const quote=ritualQuote(s,code);
  assert.equal(quote.wealth,assets);
  assert.equal(quote.cost,Math.round(assets*.05+capKRW/1_000_000));
  assert.ok(quote.cost>ritualCost(netWealth(s),capKRW));
  assert.notEqual(quote.cost,ritualQuote(s,'MOON').cost);
  assert.equal(reserveRitual(s,code,id,1),'');
  assert.equal(s.ritualPending.wealth,assets);
  assert.equal(s.cash,cash-quote.cost);
  assert.equal(cancelRitual(s,id),true);
  assert.equal(s.cash,cash);
});

test('reserved won, depleted mental strength, retired listings and server rejections leave recoverable accounts',()=>{
  const s=initial(),i=symbolIndex.BMEM;
  assert.equal(placeOrder(s,i,1,s.cash-10_000),'');
  assert.ok(exchangeable(s,'KRW')<ritualQuote(s,'MOON').cost);
  assert.ok(reserveRitual(s,'MOON',crypto.randomUUID(),0));
  assert.equal(s.cash,5000000);assert.equal(s.mental,75);
  const fresh=initial();assert.ok(reserveRitual(fresh,'NOT_LISTED',crypto.randomUUID(),0));
  fresh.mental=0;assert.ok(ritualQuote(fresh,'MOON').error);
  fresh.mental=50;const id=crypto.randomUUID();
  assert.equal(reserveRitual(fresh,'FLFX',id,1),'');
  assert.ok(cancelRitual(fresh,id));assert.equal(cancelRitual(fresh,id),false);
  assert.equal(fresh.cash,5000000);assert.equal(fresh.mental,50);assert.equal(fresh.ritualCharges,undefined);
});

test('success and failure spend one daily use across reloads, while cancelled reservations restore it',()=>{
  for(const roll of [0,.99]){
    const s=initial(),id=crypto.randomUUID();
    assert.equal(reserveRitual(s,'FLFX',id,1),'');
    receipt(s,roll);
    const saved=upgrade(JSON.parse(JSON.stringify(s)));
    saved.mental=100;
    const balance=saved.cash;
    assert.equal(ritualQuote(saved,'MOON').usedToday,true);
    assert.match(reserveRitual(saved,'MOON',crypto.randomUUID(),2),/오늘은 이미/);
    assert.equal(saved.cash,balance);assert.equal(saved.mental,100);assert.equal(saved.ritualPending,undefined);
    saved.day++;assert.equal(ritualQuote(saved,'MOON').usedToday,false);
    const next=crypto.randomUUID();assert.equal(reserveRitual(saved,'MOON',next,3),'');
    assert.equal(cancelRitual(saved,next),true);assert.equal(ritualQuote(saved,'MOON').error,'');
  }
  const s=initial();
  assert.equal(mergeRoomRituals(s,{events:[],usedDay:s.day}),true);
  assert.equal(mergeRoomRituals(s,{events:[],usedDay:s.day}),false);
  assert.equal(ritualQuote(s,'MOON').usedToday,true);
  s.day++;assert.equal(ritualQuote(s,'MOON').usedToday,false);
});

test('all active ritual targets publish once and affect the next open bar across charts and quotes',()=>{
  const active=stocks.filter(s=>ritualTarget(s.code));
  assert.deepEqual(active,stocks.filter(s=>s.kind==='주식'&&!s.archiveOnly));
  const state=initial(),before=structuredClone(state);
  for(const asset of stocks.filter(s=>!active.includes(s))){
    assert.equal(reserveRitual(state,asset.code,crypto.randomUUID(),0),'개별 회사 주식을 골라 줘.');
  }
  assert.deepEqual(state,before);
  for(const asset of active){
    const i=symbolIndex[asset.code],steps=schedule(i,2).steps,tick=2*288+steps[1],next=2*288+steps[2],base=initial(),impacted=initial();
    const row={id:crypto.randomUUID(),code:asset.code,bps:1000,tick};
    assert.equal(mergeRitualEvents(impacted,[row,row]),true);
    assert.equal(mergeRitualEvents(impacted,[row]),false);
    const key=ritualArticleId(row.id);
    assert.equal(articleById(at(impacted,tick-1),key),null);
    assert.deepEqual(articleById(at(impacted,tick),key).related,[asset.code]);
    const early=at(impacted,tick);
    assert.deepEqual(quoteInfo(early,i),quoteInfo(at(base,tick),i));
    const later=at(impacted,next),plain=at(base,next),expected=snapPrice(i,quoteAt(plain,i)*.9);
    assert.equal(quoteInfo(later,i).price,expected,asset.code);
    assert.equal(quoteAt(later,i),expected,asset.code);
    assert.equal(chartBars(later,i,'5').at(-1).c,expected,asset.code);
    assert.equal(chartBars(later,i,'D').at(-1).c,expected,asset.code);
    assert.equal(quoteAt(plain,i),quoteInfo(plain,i).price);
    const other=symbolIndex.BIT;
    assert.deepEqual(quoteInfo(later,other),quoteInfo(plain,other));
  }
});

test('an after-hours dispatch leaves the previous close intact and the opening order fills on the impacted tape',()=>{
  const i=symbolIndex.BMEM,steps=schedule(i,3).steps,last=3*288+steps.at(-1),next=4*288+steps[0];
  const base=initial(),impacted=initial(),id=crypto.randomUUID();
  mergeRitualEvents(impacted,[{id,code:'BMEM',bps:400,tick:last+1}]);
  const earlier=at(impacted,next-1);
  assert.equal(quoteAt(earlier,i),quoteAt(at(base,next-1),i));
  assert.equal(placeOrder(earlier,i,1),'');
  const opening=at(earlier,next);
  assert.equal(matchLiveOrders(opening),1);
  assert.equal(opening.fills[0].price,quoteAt(opening,i));
  assert.ok(opening.fills[0].price<quoteAt(at(base,next),i));
});

test('the picker exposes the ritual targets and a receipt opens before its newspaper edition',async()=>{
  const {loadJsx,renderView}=await import('../test-support/render-jsx.mjs');
  const {RitualPage}=await loadJsx(new URL('../src/ui/ritual.jsx',import.meta.url));
  const s=initial(),html=renderView(RitualPage,{state:s});
  const idleImage=html.match(/<img class="ritual-idle" src="\/([^"]+)"/)?.[1];
  assert.ok(idleImage,'the waiting stage renders a seated cat');
  const idleBytes=await readFile(new URL('../public/'+idleImage,import.meta.url));
  assert.equal(idleBytes.toString('ascii',8,12),'WEBP');
  const choices=[...html.matchAll(/<option[^>]*value="([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual([...choices].sort(),stocks.filter(a=>ritualTarget(a.code)).map(a=>a.code).sort());
  assert.ok(html.includes('<dd>'+fmtMoney(ritualQuote(s,choices[0]).cost)+'</dd>'));
  assert.match(html,/67.5%/);assert.match(html,/최대 -10%/);
  for(const name of ['제물 설명','정신력 설명','검은 고양이 쓰다듬기'])assert.ok(html.includes('aria-label="'+name+'"'));
  assert.equal((html.match(/role="note" hidden/g)??[]).length,2);
  const tick=4*288+15,id=crypto.randomUUID();
  mergeRitualEvents(s,[{id,tick,code:'MOON',bps:200,minuteOffset:3}]);
  const early=at(s,tick),later={...early,wallMinute:early.wallMinute+3};
  assert.equal(articleById(early,ritualArticleId(id)),null);
  const story=articleById(later,ritualArticleId(id));
  assert.ok(story);assert.equal(story.event.minute,15*5+3);
  assert.ok(!visibleStories(later).some(s=>s.id===story.id));
  const printed=visibleStories(at(s,tick+50)).find(s=>s.id===story.id);
  assert.ok(printed.publishedAt>tick);
  assert.equal(articleById(at(s,printed.publishedAt),story.id).publishedAt,printed.publishedAt);
});

test('two simultaneous successful rituals occupy separate normal print slots',()=>{
  const s=initial(),tick=2500,ids=[crypto.randomUUID(),crypto.randomUUID()];
  mergeRitualEvents(s,ids.map(id=>({id,tick,code:'MOON',bps:200,minuteOffset:3})));
  const keys=new Set(ids.map(ritualArticleId));
  const affected=visibleStories(at(s,tick+45)).filter(story=>keys.has(story.id));
  assert.equal(affected.length,2);
  const gap=(affected[0].publishedAt-affected[1].publishedAt)*5;
  assert.ok(gap>=40&&gap<=60);
  for(const story of affected){
    const printed=at(s,story.publishedAt);
    assert.ok(!visibleStories(at(s,story.publishedAt-1)).some(s=>s.id===story.id));
    assert.deepEqual(visibleStories(printed).filter(s=>s.publishedAt===story.publishedAt).map(s=>s.id),[story.id]);
  }
});

test('old receipts retain their historical cost and odds while the field always shows the maximum',async()=>{
  const {loadJsx,renderView}=await import('../test-support/render-jsx.mjs');
  const {RitualPage}=await loadJsx(new URL('../src/ui/ritual.jsx',import.meta.url));
  const s=initial(),id=crypto.randomUUID();
  const offer=renderView(RitualPage,{state:s});
  assert.match(offer,/총자산의 5% \+ 선택한 회사 시가총액의 0\.0001%/);
  s.ritualLast={id,code:'BIT',started:1,mental:75,cost:250000,success:true,bps:175};
  const before=renderView(RitualPage,{state:s});
  assert.match(before,/250,000원/);assert.match(before,/52.5%/);assert.match(before,/최대 -10%/);
  assert.doesNotMatch(before,/1\.75%/);
  assert.match(before,/<option value="BIT" selected="">/);
  const saved={id,code:'BIT',tick:1,bps:175};
  assert.equal(mergeRitualEvents(s,[saved]),true);
  assert.equal(mergeRitualEvents(s,[{...saved,id:'new',bps:1001}]),false);
  s.ritualLast={...s.ritualLast,cost:2250000,chance:60,success:false,bps:0};
  const after=renderView(RitualPage,{state:s});
  assert.match(after,/2,250,000원/);
  assert.match(after,/가격 충격<\/dt><dd>최대 -10%/);assert.match(after,/60%/);
  assert.equal(localRitualResult(s.ritualLast,()=>.63).success,false);
  assert.equal(s.ritualEvents[0].bps,175);
});
