import test from 'node:test';
import assert from 'node:assert/strict';
import {actualTimestamp,gameDayStart,dayLabel,accountCalendar,gameTimestamp} from '../src/game/clock-calendar.mjs';
import {startLive,syncLiveClock} from '../src/game/live-clock.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';
import {bingoOdds,bingoReduction,fortuneGridFor,fortuneSymbols,spinGrid,isFortuneGrid,lineWins,unlockFortuneReroll} from '../src/game/fortune-rules.mjs';
import {roll,loadable,mentalDecayInterval,mentalDecayRate} from '../src/game/market.mjs';
const {FortuneBody}=await loadJsx(new URL('../src/ui/extras.jsx',import.meta.url));
const {SettlementSummary}=await loadJsx(new URL('../src/ui/home.jsx',import.meta.url));

test('the reels show an existing pair on the left without changing saved symbols or winning rows',()=>{
  const symbols=Object.keys(fortuneSymbols);
  for(const left of symbols)for(const center of symbols)for(const right of symbols){
    const row=[left,center,right];
    const even=['shield','shield','shield'], mixed=['coupon','meal','calm'];
    const state={luck:'bingo',fortuneGrid:[row,even,mixed]};
    const saved=structuredClone(state);
    const shown=fortuneGridFor(state);
    assert.deepEqual(shown[0].toSorted(),row.toSorted());
    if(new Set(row).size===2)assert.equal(shown[0][0],shown[0][1]);
    else assert.deepEqual(shown[0],row);
    assert.deepEqual(shown.slice(1),[even,mixed]);
    assert.deepEqual(lineWins(shown),lineWins(saved.fortuneGrid));
    assert.deepEqual(fortuneGridFor(structuredClone(saved)),shown);
    assert.deepEqual(state,saved);
  }
});

test('home fortune renders, applies a single daily draw, and advances Day across the week boundary',()=>{
  const at=d=>actualTimestamp(gameDayStart(d)+60000),s=startLive(null,at(5));
  assert.match(renderView(FortuneBody,{state:s,modal:{}}),/오늘 운세 뽑기/);
  assert.equal(dayLabel(s),'Day 1');
  const original=s.cash;
  roll(s,0,gameTimestamp(at(5)));
  assert(isFortuneGrid(s.fortuneGrid));
  const drawn=structuredClone(s.fortuneGrid);
  roll(s,.99,gameTimestamp(at(5)));
  assert.deepEqual(s.fortuneGrid,drawn);
  assert.equal(s.cash,original);
  assert.equal(s.weekendRebate,0);
  assert.equal(s.discount,0);
  assert.equal(s.mental,75);
  assert.match(renderView(FortuneBody,{state:s,modal:{}}),/0줄 빙고/);
  assert.doesNotMatch(renderView(FortuneBody,{state:s,modal:{}}),/식비|할인|공짜 도시락/);
  syncLiveClock(s,at(12));
  assert.equal(s.luck,null);
  assert.equal(dayLabel(s),'Day 8');
  assert.match(accountCalendar(s),/^Day 8 /);
  const report=renderView(SettlementSummary,{state:s});
  assert.match(report,/<option value="11" selected="">Day 7<\/option>/);
  assert.doesNotMatch(report,/[월화수목금토일]요일/);
});

test('each bingo result changes only the remaining passive drain for the current game day',()=>{
  const start=gameDayStart(8)+22*3600_000,draw=start+mentalDecayInterval/2;
  for(const [lines,chance,reduction,rate] of [[0,.1,0,1.5],[1,.4,15,1.275],[2,.8,25,1.125],[3,.98,50,.75]]){
    const s=startLive(null,actualTimestamp(start));
    roll(s,chance,draw);
    assert.equal(lineWins(s.fortuneGrid).length,lines);
    assert.equal(bingoReduction(s),reduction);
    assert.equal(mentalDecayRate(s),rate);
    assert.equal(s.cash,s.startWealth);
    assert.equal(s.mental,75);
    assert.equal(s.discountToday,0);
    assert(loadable(s));
    const interval=Math.round(mentalDecayInterval*100/(100-reduction));
    const first=draw+Math.round(interval/2);
    const loaded=startLive(structuredClone(s),actualTimestamp(first-1));
    assert.equal(loaded.mental,75);
    syncLiveClock(loaded,actualTimestamp(first));
    assert.equal(loaded.mental,74);
    assert.equal(loaded.mentalDecayAt,first+interval);
    const midnight=gameDayStart(9);
    const saved=structuredClone(loaded);
    syncLiveClock(loaded,actualTimestamp(midnight));
    assert.equal(mentalDecayRate(loaded),1.5);
    assert.equal(loaded.luck,null);
    assert.equal(loaded.fortuneGrid,null);
    const next=first+(Math.floor((midnight-first)/interval)+1)*interval;
    assert.equal(loaded.mentalDecayAt,midnight+Math.round((next-midnight)*mentalDecayInterval/interval));
    const offline=startLive(saved,actualTimestamp(midnight));
    assert.equal(offline.mentalDecayAt,loaded.mentalDecayAt);
    assert.equal(offline.mental,loaded.mental);
    assert(loadable(offline));
  }
});

test('the actual draw and the displayed chance table agree on a ten-percent jackpot',()=>{
  const counts=[0,0,0,0];
  for(let index=0;index<1000;index++){
    const grid=spinGrid(null,()=>(index+.5)/1000);
    counts[lineWins(grid).length]++;
  }
  assert.deepEqual(counts,[200,500,200,100]);
  assert.deepEqual(counts.map(percent=>percent/10),bingoOdds);
  const at=gameDayStart(8)+60000;
  const state=startLive(null,actualTimestamp(at));
  roll(state,.899999,at);
  assert.equal(lineWins(state.fortuneGrid).length,2);
  assert.ok(unlockFortuneReroll(state));
  roll(state,.90,at,{reroll:true});
  assert.equal(lineWins(state.fortuneGrid).length,3);
  assert.match(renderView(FortuneBody,{state,modal:{}}),/3줄 · 정신력 감소 속도 −50%<\/span><b>10%/);
});

test('an ad saves one separate reroll without changing the result or mental progress until the next draw',()=>{
  const first=gameDayStart(8)+3600_000;
  const state=startLive(null,actualTimestamp(first));
  assert.equal(unlockFortuneReroll(state),false);
  assert.equal(roll(state,.98,first,{reroll:true}),false);
  assert.equal(roll(state,.98,first),true);
  assert.equal(bingoReduction(state),50);
  const drawn=renderView(FortuneBody,{state,modal:{}});
  assert.match(drawn,/<button class="fortune-action[^"]*"[^>]*><i[^>]*><\/i><span>5초 광고 보고 다시뽑기<\/span>/);
  assert.equal(roll(state,()=>assert.fail('the ad must unlock the reroll first'),first,{reroll:true}),false);
  const before=structuredClone(state);
  assert.equal(unlockFortuneReroll(state),true);
  assert.deepEqual(state,{...before,fortuneRerollReady:true});
  assert.equal(unlockFortuneReroll(state),false);
  const unlocked=JSON.parse(JSON.stringify(state));
  assert.equal(loadable(unlocked),true);
  const ready=startLive(unlocked,actualTimestamp(first));
  const waiting=renderView(FortuneBody,{state:ready,modal:{}});
  assert.match(waiting,/<span>다시 뽑기<\/span>/);
  assert.match(waiting,/3줄 잭팟/);
  assert.doesNotMatch(waiting,/is-spinning|5초 광고 보고/);
  const next=first+mentalDecayInterval/2;
  assert.equal(roll(ready,.1,next,{reroll:true}),true);
  assert.equal(ready.fortuneRerollReady,undefined);
  assert.equal(bingoReduction(ready),0);
  assert.equal(ready.mentalDecayAt,next+Math.round(mentalDecayInterval*.75));
  assert.equal(ready.cash,before.cash);
  assert.equal(ready.mental,75);
  const saved=JSON.parse(JSON.stringify(ready));
  assert.equal(loadable(saved),true);
  const restored=startLive(saved,actualTimestamp(next));
  assert.equal(bingoReduction(restored),0);
  assert.equal(roll(restored,()=>assert.fail('a second reroll must not use the RNG'),next,{reroll:true}),false);
  assert.deepEqual(restored.fortuneGrid,ready.fortuneGrid);

  const html=renderView(FortuneBody,{state:restored,modal:{}});
  assert.match(html,/<button class="fortune-action[^"]*"[^>]*disabled=""[^>]*>.*?내일 다시 뽑을 수 있어/);
  assert.match(html,/<button class="fortune-lever"[^>]*disabled=""/);
  assert.doesNotMatch(html,/광고/);
  assert.doesNotMatch(html,/오늘 결과 ·|테스트|효과음/);
  const midnight=gameDayStart(9);
  syncLiveClock(state,actualTimestamp(midnight));
  assert.equal(state.fortuneRerollReady,undefined);
  assert.equal(state.luck,null);
  syncLiveClock(restored,actualTimestamp(midnight));
  assert.equal(restored.fortuneRerollUsed,undefined);
  assert.equal(roll(restored,.5,midnight),true);
  assert.equal(roll(restored,.9,midnight,{reroll:true}),false);
  assert.equal(unlockFortuneReroll(restored),true);
  assert.equal(roll(restored,.9,midnight,{reroll:true}),true);
});

test('old rewards retain recorded cash and cannot be drawn twice after upgrading',()=>{
  const at=gameDayStart(5)+3600_000;
  const old=startLive(null,actualTimestamp(at));
  Object.assign(old,{luck:'coupon',fortuneGrid:spinGrid('coupon',()=>.15,2),discountToday:30000,weekendRebate:30000,
    weekendLog:[{day:5,step:old.cursor,amount:30000,seq:1}],cash:old.cash+30000, startWealth:old.startWealth+30000});
  assert(loadable(old));
  const updated=startLive(structuredClone(old),actualTimestamp(at));
  assert.equal(updated.cash,old.cash);
  assert.deepEqual(updated.weekendLog,old.weekendLog);
  assert.equal(bingoReduction(updated),25);
  assert.equal(mentalDecayRate(updated),1.125);
  assert.equal(updated.mentalDecayAt,at+3200000);
  const reloaded=startLive(structuredClone(updated),actualTimestamp(at+1000));
  assert.equal(reloaded.mentalDecayAt,updated.mentalDecayAt);
  roll(reloaded,.99,at+1000);
  assert.equal(bingoReduction(reloaded),25);
  assert(loadable(reloaded));
  const invalid={...updated,fortuneGrid:[['missing']]};
  assert.equal(loadable(invalid),false);
});

test('the slot keeps the partially pulled lever, independently stopped reels and all jackpot effects', () => {
  const at=gameDayStart(8)+60000;
  const state=startLive(null,actualTimestamp(at));
  roll(state,.98,at);
  const spinning=renderView(FortuneBody,{state,modal:{spinning:true,pullProgress:.5,reelsStopped:2}});
  assert.equal((spinning.match(/class="fortune-reel"/g) ?? []).length,3);
  assert.equal((spinning.match(/data-stopped=/g) ?? []).length,2);
  assert.ok(spinning.includes('--lever-from:50%'));
  assert.ok(spinning.includes('--lever-latch:150ms'));
  assert.doesNotMatch(spinning,/class="fortune-celebration"/);
  const finished=renderView(FortuneBody,{state,modal:{hasSpun:true}});
  assert.equal((finished.match(/class="fortune-ember"/g) ?? []).length,18);
  assert.equal((finished.match(/class="fortune-payline"/g) ?? []).length,3);
  assert.match(finished,/class="fortune-fire"/);
  assert.match(finished,/3줄 잭팟/);
  assert.match(finished,/src="\/art\/pixel\/slot-cabinet\.webp"/);
  assert.doesNotMatch(finished,/slot-cabinet-still\.webp/);
  assert.doesNotMatch(renderView(FortuneBody,{state,modal:{}}),/class="fortune-celebration"/);
  const twoWins={...state,fortuneGrid:spinGrid('coupon',()=>.5,2)};
  const double=renderView(FortuneBody,{state:twoWins,modal:{hasSpun:true}});
  assert.equal((double.match(/class="fortune-bingo-shine"/g)||[]).length,2);
  assert.doesNotMatch(double,/class="fortune-fire"/);
  assert.doesNotMatch(renderView(FortuneBody,{state:twoWins,modal:{}}),/class="fortune-bingo-shine"/);
});
