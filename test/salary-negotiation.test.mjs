import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,settle,nextDay,dailyBonus,loadable,upgrade} from '../src/game/market.mjs';
import {dailySalary,maxRaise,negotiateSalary,negotiationAdSeconds,salaryHistory,salaryQuote,todaysNegotiation} from '../src/game/salary-negotiation.mjs';
import {reviewValues} from '../src/game/day-report.mjs';
import {startLive,syncLiveClock} from '../src/game/live-clock.mjs';
import {actualTimestamp,gameDayStart} from '../src/game/clock-calendar.mjs';
import {watchGameAd} from '../src/game/recovery-ad.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';

const {SalarySheet}=await loadJsx(new URL('../src/ui/salary-negotiation.jsx',import.meta.url));
const sheet=(state,modal={})=>renderView(SalarySheet,{state,modal});
const unused=()=>assert.fail('a blocked attempt must not draw a result');

test('a smaller raise improves the odds; each failure carries two points into the next game day',()=>{
  let state=initial();
  assert.deepEqual(Array.from({length:10},(_,i)=>salaryQuote(state,i+1).chance),[100,90,80,70,60,50,40,30,20,10]);
  for(const rate of [0,11,1.5,'5',NaN])assert.equal(negotiateSalary(state,rate,unused),false);
  assert.equal(negotiateSalary(state,maxRaise,()=>0.1),true);
  assert.equal(todaysNegotiation(state).success,false);
  assert.equal(dailySalary(state),300_000);
  assert.equal(negotiateSalary(state,1,unused),false);
  assert.match(sheet(state),/협상 결렬/);
  assert.match(sheet(state),/다음 성공 확률<\/span><button[^>]*aria-controls="salary-failure-bonus"/);
  assert.match(sheet(state),/id="salary-chance"[^>]*>12%/);
  assert.match(sheet(state),/role="tooltip" hidden="">실패 보정 확률 \+2%p/);
  assert.match(sheet(state),/요청한 10% 인상안이 거절됐어\.<\/p><button[^>]*disabled/);
  assert.match(sheet(state),/<input id="salary-rate"[^>]+value="10"/);
  assert.doesNotMatch(sheet(state),/이번 성공 확률|다음 협상에는|<input[^>]*disabled/);
  assert.match(sheet(state),/협상 성공 시 연봉<\/dt><dd>120,450,000원<\/dd>/);
  assert.match(sheet(state),/협상 성공 시 일급<\/dt><dd>330,000원<\/dd>/);
  assert.match(sheet(state),/<button[^>]*disabled=""[^>]*>내일 다시 협상할 수 있어<\/button>/);
  assert.doesNotMatch(sheet(state),/다음 게임 날에 다시|>확인<\/button>/);
  assert.doesNotMatch(sheet(state),/data-act="salary-watch"/);
  settle(state);
  nextDay(state);
  state=upgrade(JSON.parse(JSON.stringify(state)));
  assert.ok(loadable(state));
  assert.equal(todaysNegotiation(state),null);
  assert.equal(salaryQuote(state,10).chance,12);
  assert.equal(salaryQuote(state,1).chance,100);
  assert.ok(negotiateSalary(state,10,()=>0.12));
  settle(state);nextDay(state);
  assert.equal(salaryQuote(state,10).chance,14);
  assert.ok(negotiateSalary(state,10,()=>0.13999));
  assert.equal(todaysNegotiation(state).success,true);
  assert.equal(todaysNegotiation(state).chance,14);
  assert.equal(salaryQuote(state,10).correction,0);
});

test('successful raises compound on actual daily pay from this settlement forward and survive reload',()=>{
  let state=initial();
  assert.equal(dailySalary(state),300_000);
  settle(state);
  const firstReceipt=structuredClone(state.history[0].bill);
  assert.match(sheet(state),/<button[^>]*disabled=""[^>]*>내일 다시 협상할 수 있어<\/button>/);
  assert.equal(negotiateSalary(state,4,unused),false);
  nextDay(state);
  assert.ok(negotiateSalary(state,10,()=>0));
  assert.equal(reviewValues(state).values.income,'+330,000원');
  const bonus=dailyBonus(state);
  settle(state);
  assert.equal(state.history.at(-1).bill.income,330_000+bonus);
  assert.deepEqual(state.history[0].bill,firstReceipt);
  nextDay(state);
  assert.ok(negotiateSalary(state,3,()=>0));
  state=upgrade(JSON.parse(JSON.stringify(state)));
  assert.ok(loadable(state));
  assert.equal(dailySalary(state),339_900);
  assert.match(sheet(state),/연봉 인상 합의/);
  assert.match(sheet(state),/실패 보정 확률 \+0%p/);
  assert.match(sheet(state),/요청한 3% 인상안이 받아들여졌어\.<\/p><button[^>]*disabled/);
  assert.match(sheet(state),/<button[^>]*disabled=""[^>]*>내일 다시 협상할 수 있어<\/button>/);
  assert.match(sheet(state),/협상 성공 시 연봉<\/dt><dd>124,063,500원<\/dd>/);
  assert.equal(negotiateSalary(state,1,unused),false);
  assert.equal(loadable({...state,salaryNegotiation:{...state.salaryNegotiation,day:state.day+1}}),false);
  const draft=sheet(initial(),{raise:5});
  assert.match(draft,/id="salary-chance"[^>]*>60%<\/strong>/);
  assert.match(draft,/현재 연봉<\/dt><dd>109,500,000원<\/dd>/);
  assert.match(draft,/성공 시 연봉<\/dt><dd>114,975,000원<\/dd>/);
  assert.match(draft,/성공 시 일급<\/dt><dd>315,000원<\/dd>/);
  assert.match(draft,/data-act="salary-watch" data-value="5"/);
  assert.doesNotMatch(draft,/인상률을 낮추면|게임 하루 1회|>Day /);
  assert.match(draft,/class="sprite salary-blink" src="\/art\/pixel\/negotiation-room-blink\.webp"/);
  assert.match(draft,/class="salary-sitter pov-pet-body"/);
  assert.match(draft,/petting-hand\.svg#contact/);
  assert.match(draft,/class="sprite salary-lamp"/);
  assert.match(draft,/aria-label="협상 고양이 쓰다듬기" data-pet-target/);
  assert.match(draft,/최소 1%<\/span><span>최대 10%/);
  assert.doesNotMatch(draft,/<details|<summary|기본 성공 확률|실패마다|누적/);
  assert.doesNotMatch(draft,/확률은 최대 100%야/);
  assert.doesNotMatch(draft,/인상률 1%p (낮추기|높이기)/);
  assert.match(draft,/<div class="salary-scale"><input[^>]+type="range"[^>]+min="1"[^>]+max="10"/);
  assert.match(sheet(initial(),{raise:1}),/aria-valuetext="1% 인상"/);
  const ad=sheet(initial(),{stage:'ad',raise:5});
  assert.match(ad,/class="sheet salary-sheet salary-ad" role="dialog"/);
  assert.match(ad,/max="5"/);
  assert.doesNotMatch(ad,/salary-scene|salary-footer|salary-rate/);
});

test('history lists real game days newest first and retains one committed outcome per attempt',()=>{
  const state=initial();
  assert.match(sheet(state,{stage:'history'}),/아직 협상 기록이 없어/);
  assert.ok(negotiateSalary(state,7,()=>0.98));
  settle(state);nextDay(state);
  settle(state);nextDay(state);
  const next={...state};
  assert.ok(negotiateSalary(next,4,()=>0));
  assert.deepEqual(salaryHistory(state),[{day:0,raise:7,chance:40,success:false}]);
  assert.equal(negotiateSalary(next,2,unused),false);
  const restored=upgrade(JSON.parse(JSON.stringify(next)));
  assert.ok(loadable(restored));
  assert.deepEqual(salaryHistory(restored),[{day:0,raise:7,chance:40,success:false},{day:2,raise:4,chance:72,success:true}]);
  const view=sheet(restored,{stage:'history'});
  assert.match(view,/요청 인상률<\/th><th scope="col">성공 확률<\/th><th scope="col">결과/);
  assert.match(view,/Day 3.*?\+4%<\/td><td>72%.*?성공.*?Day 1.*?\+7%<\/td><td>40%.*?실패/);
  assert.equal(loadable({...restored,salaryHistory:[{day:0,raise:7,success:false,chance:102}]}),false);
  const old=structuredClone(restored);
  delete old.salaryNegotiation.chance;
  old.salaryHistory.forEach(row=>delete row.chance);
  assert.deepEqual(salaryHistory(old),salaryHistory(restored));
  assert.doesNotMatch(view,/Day 2/);
  const live=startLive(restored,actualTimestamp(gameDayStart(20))+1000);
  assert.ok(loadable(live));
  assert.match(sheet(live,{stage:'history'}),/Day 3.*?Day 1/);
});

test('old saves recover known raises and the last offer without treating idle days as rejections',()=>{
  const state=initial();
  assert.ok(negotiateSalary(state,4,()=>0));
  settle(state);nextDay(state);
  assert.ok(negotiateSalary(state,8,()=>0.99));
  settle(state);nextDay(state);
  settle(state);nextDay(state);
  assert.ok(negotiateSalary(state,5,()=>0));
  settle(state);nextDay(state);
  assert.ok(negotiateSalary(state,9,()=>0.99));
  delete state.salaryHistory;
  const restored=upgrade(JSON.parse(JSON.stringify(state)));
  const expected=[{day:0,raise:4,chance:70,success:true},{day:3,raise:5,chance:null,success:true},{day:4,raise:9,chance:20,success:false}];
  assert.deepEqual(salaryHistory(restored),expected);
  assert.match(sheet(restored,{stage:'history'}),/당시 성공 확률 기록 없음/);
  settle(restored);nextDay(restored);
  assert.ok(negotiateSalary(restored,1,()=>0));
  assert.deepEqual(salaryHistory(restored),[...expected,{day:5,raise:1,chance:100,success:true}]);
});

test('a reload across game midnight pays the agreed wage once and opens a fresh daily attempt',()=>{
  const midnight=actualTimestamp(gameDayStart(18));
  const state=startLive(null,midnight-1_000);
  assert.equal(state.day,17);
  assert.ok(negotiateSalary(state,5,()=>0));
  const bonus=dailyBonus(state);
  const reloaded=startLive(JSON.parse(JSON.stringify(state)),midnight+1000);
  assert.equal(reloaded.day,18);
  assert.equal(reloaded.history.length,1);
  assert.equal(reloaded.history[0].bill.income,315_000+bonus);
  assert.equal(todaysNegotiation(reloaded),null);
  assert.ok(negotiateSalary(reloaded,10,()=>0.99));
  syncLiveClock(reloaded,midnight+5000);
  assert.equal(reloaded.history.length,1);
  assert.equal(negotiateSalary(reloaded,1,unused),false);
});

test('a five-second game ad counts only visible time, can be dismissed, and completes just once',t=>{
  const doc=new EventTarget(),previous=globalThis.document;
  globalThis.document=doc;
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
  let now=0,tick,completions=0;
  t.mock.method(performance,'now',()=>now);
  t.mock.method(globalThis,'setInterval',cb=>{tick=cb;return 1;});
  t.mock.method(globalThis,'clearInterval',()=>{});
  const bar={},label={},root={querySelector:q=>q==='progress'?bar:label};
  const stop=watchGameAd(root,()=>completions++,negotiationAdSeconds);
  now=2000;tick();stop();now=9000;tick();
  assert.equal(completions,0);
  watchGameAd(root,()=>completions++,negotiationAdSeconds);
  now=10_900;doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));
  now=99_000;tick();
  assert.equal(bar.value,1.9);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));
  now+=3099;tick();assert.equal(completions,0);
  now+=2;tick();tick();
  assert.equal(completions,1);
  assert.equal(label.textContent,'0초');
});

test('salary slider clicks end at silence, reuse their sound and coalesce bunched input',async t=>{
  const voices=[],samples=[];
  const ctx={
    state:'running',currentTime:0,sampleRate:48000,destination:{},
    createGain:()=>({gain:{setTargetAtTime(){}},connect(){}}),
    createBuffer(_channels,frames){
      const pcm=new Float32Array(frames);
      samples.push(pcm);
      return {getChannelData:()=>pcm};
    },
    createBufferSource:()=>({connect(){},start(at){voices.push(at);}}),
  };
  const prior=globalThis.AudioContext;
  globalThis.AudioContext=class {constructor(){return ctx;}};
  t.after(()=>{if(prior)globalThis.AudioContext=prior;else delete globalThis.AudioContext;});
  const {playGameSound,muteGame}=await import('../src/game/game-audio.mjs');
  for(let i=0;i<10;i++){
    ctx.currentTime=i/120;
    playGameSound('salaryTick');
    playGameSound('salaryTick');
  }
  assert.equal(voices.length,10);
  assert.equal(samples.length,1);
  const [pcm]=samples;
  assert.equal(Math.abs(pcm[0])+Math.abs(pcm.at(-1)),0);
  assert.ok(pcm.some(x=>Math.abs(x)>.05));
  const mix=new Float32Array(6000);
  for(const at of voices){
    const start=Math.round(at*ctx.sampleRate);
    pcm.forEach((value,i)=>{mix[start+i]+=value;});
  }
  assert.ok(mix.every(x=>Math.abs(x)<.3),'rapid dragging retains headroom');
  muteGame(true);
  ctx.currentTime+=.1;
  playGameSound('salaryTick');
  assert.equal(voices.length,10);
  muteGame(false);
});
