import test from 'node:test';
import assert from 'node:assert/strict';
import {afterHomePat} from '../src/game/home-pet-recovery.mjs';
import {initial,loadable,upgrade} from '../src/game/market.mjs';
import {startLive,syncLiveClock} from '../src/game/live-clock.mjs';

function pats(state,count){
  for(let i=0;i<count;i++)state=afterHomePat(state)??state;
  return state;
}

test('every hundredth home pat earns one point, up to five, including after a save and reload',()=>{
  let state=pats(initial(),99);
  assert.equal(state.mental,75);
  assert.equal(state.petRecovery.pats,99);
  assert.ok(loadable(state));
  state=upgrade(JSON.parse(JSON.stringify(state)));
  const restored=pats(state,1);
  assert.equal(restored.mental,76);
  assert.equal(state.mental,75);
  const capped=pats(restored,900);
  assert.equal(capped.mental,80);
  assert.deepEqual(capped.petRecovery,{day:state.day,pats:0,points:5});
  assert.equal(afterHomePat(capped),null);
  assert.equal(pats(initial(),1).petRecovery.pats,1);
});

test('game midnight resets the daily allowance and preserves an unfinished 100-pat streak',()=>{
  const before=Date.UTC(2026,10,18,14,59,59); // one second before game midnight in Korea
  const game=startLive(null,before);
  for(const [count,expectedPats] of [[99,0],[600,1]]){
    const saved=pats(structuredClone(game),count);
    const day=saved.day;
    const {rolled}=syncLiveClock(saved,before+2000);
    assert.ok(rolled);
    assert.equal(saved.day,day+1);
    // Allow a new point even when midnight filled the gauge.
    saved.mental=Math.min(saved.mental,99);
    const score=saved.mental;
    const next=afterHomePat(saved);
    const gain=count===99?1:0;
    assert.equal(next.mental,score+gain);
    assert.deepEqual(next.petRecovery,{day:day+1,pats:expectedPats,points:gain});
    assert.ok(loadable(next));
  }
});

test('a full score produces no credit or sound-triggering gain and keeps the remaining daily allowance',()=>{
  const atMax=pats({...initial(),mental:100},100);
  assert.deepEqual(atMax.petRecovery,{day:0,pats:0,points:0});
  assert.equal(atMax.mental,100);
  const lower=pats({...atMax,mental:99},100);
  assert.equal(lower.mental,100);
  assert.equal(lower.petRecovery.points,1);
  assert.equal(afterHomePat({...lower,phase:'closed'}),null);
  assert.equal(loadable({...lower,petRecovery:{day:1,pats:0,points:1}}),false);
});

test('the recovery sound has three rising bell notes and observes the game mute setting',async t=>{
  const {playGameSound,muteGame}=await import('../src/game/game-audio.mjs');
  const notes=[];
  const param={setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}};
  class Audio {
    state='running';currentTime=0;destination={};
    createGain(){return {gain:{...param},connect(){}};}
    createOscillator(){
      const oscillator={start(at){notes.push([at,this.type,this.pitch]);},connect(){},stop(){}};
      oscillator.frequency={setValueAtTime(note){oscillator.pitch=note;}};
      return oscillator;
    }
  }
  const previous=globalThis.AudioContext;
  globalThis.AudioContext=Audio;
  t.after(()=>{if(previous)globalThis.AudioContext=previous;else delete globalThis.AudioContext;});
  muteGame(true);
  playGameSound('petRecovery');
  assert.deepEqual(notes,[]);
  muteGame(false);
  playGameSound('petRecovery');
  const main=notes.filter(([,type])=>type==='triangle');
  assert.deepEqual(main.map(([, ,pitch])=>pitch),[659,880,1175]);
  assert.ok(main[0][0]<main[1][0]&&main[1][0]<main[2][0]);
});
