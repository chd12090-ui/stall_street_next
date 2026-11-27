import test from 'node:test';
import assert from 'node:assert/strict';
import {ritualDanceMs,ritualFinalHitMs} from '../src/game/ritual-choreography.mjs';

const duration = ritualDanceMs / 1000;
function audioFixture(t) {
  const voices = [];
  const ctx = {
    state:'running', currentTime:1, destination:{},
    createGain:()=>({gain:{setTargetAtTime(){}},connect(){},disconnect(){}}),
    createBufferSource() {
      const voice = {connect(){}, start(at,offset,length){this.offset=offset;this.length=length;},
        stop(){this.stopped=true;}, disconnect(){this.disconnected=true;}};
      voices.push(voice);
      return voice;
    },
    decodeAudioData:async()=>({duration}),
  };
  const audio = globalThis.AudioContext;
  globalThis.AudioContext = class { constructor(){ return ctx; } };
  t.after(()=>{if(audio)globalThis.AudioContext=audio;else delete globalThis.AudioContext;});
  const fetch = t.mock.method(globalThis,'fetch',async()=>new Response(new Uint8Array([0])));
  let now = 10000;
  t.mock.method(Date,'now',()=>now);
  return {ctx,voices,fetch,advance:ms=>{now+=ms;}};
}

test('one cached score follows the choreography and reduced motion plays the closing giggle and chimes',async t=>{
  const {voices,fetch,advance} = audioFixture(t);
  const {prepareRitualAudio,playRitualAudio,stopRitualAudio} = await import('../src/game/game-audio.mjs?score-timing');
  prepareRitualAudio();
  const started = Date.now();
  await playRitualAudio(started);
  assert.equal(voices[0].offset,0);
  assert.equal(voices[0].length,duration);
  advance(535);
  await playRitualAudio(started);
  assert.equal(voices[0].stopped,true);
  assert.equal(voices[1].offset,.535);
  assert.equal(voices[1].offset+voices[1].length,duration);
  assert.equal(fetch.mock.callCount(),1);
  await playRitualAudio(Date.now(),true);
  assert.equal(voices[2].offset,(ritualFinalHitMs-395)/1000);
  assert.equal(voices[2].offset+voices[2].length,duration);
  stopRitualAudio();
  advance(ritualDanceMs);
  await playRitualAudio(started);
  assert.equal(voices.length,3);
  assert.ok(voices.every(s=>s.stopped&&s.disconnected));
});

test('leaving or muting during a delayed decode never starts an old dance',async t=>{
  const {ctx,voices} = audioFixture(t);
  let release;
  ctx.decodeAudioData=()=>new Promise(resolve=>{release=()=>resolve({duration});});
  const {playRitualAudio,stopRitualAudio,muteGame} = await import('../src/game/game-audio.mjs?score-cancel');
  const started = Date.now();
  const oldPlay = playRitualAudio(started);
  await new Promise(resolve=>setImmediate(resolve));
  stopRitualAudio();
  const nextPlay=playRitualAudio(started);
  muteGame(true);muteGame(false);
  release();
  await Promise.all([oldPlay,nextPlay]);
  assert.equal(voices.length,0);
  await playRitualAudio(started);
  muteGame(true);
  assert.equal(voices[0].stopped,true);
  await playRitualAudio(started);
  assert.equal(voices.length,1);
});

test('a failed decode refetches a fresh score buffer and caches the successful retry',async t=>{
  const {ctx,voices,fetch}=audioFixture(t);
  let attempts=0;
  ctx.decodeAudioData=async file=>{
    assert.equal(file.byteLength,1);
    structuredClone(file,{transfer:[file]});
    if(++attempts===1)throw new Error('Decoder unavailable');
    return {duration};
  };
  const {playRitualAudio}=await import('../src/game/game-audio.mjs?score-retry');
  await playRitualAudio(Date.now());
  assert.equal(voices.length,0);
  await playRitualAudio(Date.now());
  await playRitualAudio(Date.now());
  assert.equal(fetch.mock.callCount(),2);
  assert.equal(attempts,2);
  assert.equal(voices.length,2);
});
