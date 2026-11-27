import test from 'node:test';
import assert from 'node:assert/strict';

test('the synthesized reel ticks slow down, and closing the slot cancels scheduled sounds',async t=>{
  const voices=[];
  const pendingResumes=[];
  let context;
  const parameter={setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){}};
  function voice(kind) {
    return {
      kind,frequency:{...parameter,setValueAtTime(note){this.note=note;}},
      connect(){},
      start(at){this.startAt=at;voices.push(this);},
      stop(at){this.stopAt=at ?? 0;},
      disconnect(){this.disconnected=true;},
    };
  }
  class Audio {
    state='running';currentTime=0;sampleRate=24000;destination={};
    constructor(){context=this;}
    resume(){return new Promise(resolve=>pendingResumes.push(resolve));}
    createGain(){return {gain:{...parameter},connect(){}};}
    createBuffer(channels,frames){return {getChannelData:()=>new Float32Array(frames)};}
    createOscillator(){return voice('tone');}
    createBufferSource(){return voice('tap');}
    createBiquadFilter(){return {frequency:{...parameter},Q:{},connect(){}};}
  }
  const prior=globalThis.AudioContext;
  globalThis.AudioContext=Audio;
  t.after(()=>{if(prior)globalThis.AudioContext=prior;else delete globalThis.AudioContext;});
  t.mock.method(globalThis,'fetch',()=>assert.fail('Slot sounds use the audio graph without sample files'));
  const {playGameSound,stopFortuneAudio,muteGame,prepareGameAudio,bindSelectionAudio}=await import('../src/game/game-audio.mjs');

  playGameSound('lever',.15);
  assert.ok(voices.some(sound=>Math.abs(sound.startAt-.17)<.001));
  const spinStart=voices.length;
  playGameSound('reels',1.27);
  const spin=voices.slice(spinStart);
  const taps=spin.filter(sound=>sound.kind==='tap');
  assert.equal(taps.length,15);
  assert.ok(taps.every(sound=>sound.stopAt-sound.startAt<.02));
  assert.ok(taps[14].startAt-taps[13].startAt>2*(taps[1].startAt-taps[0].startAt));
  assert.ok(spin.every(sound=>sound.stopAt<1.29));
  const stopStart=voices.length;
  for(let index=0;index<3;index++)playGameSound('reelStop',index);
  assert.deepEqual(voices.slice(stopStart).filter(sound=>sound.kind==='tone'&&sound.startAt>.03)
    .map(sound=>sound.frequency.note),[392,494,587]);

  const missStart=voices.length;
  playGameSound('noBingo');
  const miss=voices.slice(missStart);
  assert.deepEqual(miss.filter(sound=>sound.kind==='tone').map(sound=>sound.frequency.note),[277,185]);
  assert.equal(miss.filter(sound=>sound.kind==='tap').length,1);

  for(const [cue,noteCount] of [['fortune',8],['doubleBingo',17],['jackpot',34]]){
    const start=voices.length;
    playGameSound(cue);
    assert.equal(voices.length-start,noteCount,cue);
  }

  const finished=voices[0];
  finished.onended();
  stopFortuneAudio();
  assert.ok(voices.every(sound=>sound.disconnected));
  assert.ok(voices.slice(1).every(sound=>sound.stopAt===0));
  const count=voices.length;
  muteGame(true);
  playGameSound('reels');
  playGameSound('noBingo');
  assert.equal(voices.length,count);

  muteGame(false);
  context.state='suspended';
  playGameSound('jackpot');
  assert.equal(pendingResumes.length,1);
  stopFortuneAudio();
  prepareGameAudio();
  assert.equal(pendingResumes.length,2,'a gesture retries a pending context resume');
  playGameSound('menu');
  context.state='running';
  pendingResumes.splice(0).forEach(resolve=>resolve());
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(voices.length,count+3,'only the new menu effect plays after closing the slot');

  context.state='suspended';
  playGameSound('menu');
  muteGame(true);muteGame(false);
  context.state='running';
  pendingResumes.splice(0).forEach(resolve=>resolve());
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(voices.length,count+3,'unmuting does not replay the old effect');

  const select=new EventTarget();
  select.matches=selector=>selector.split(', ').includes('select');
  let enabled=true;
  const unbind=bindSelectionAudio(select,()=>enabled);
  context.state='suspended';
  select.dispatchEvent(new Event('pointerdown'));
  assert.equal(pendingResumes.length,1);
  assert.equal(voices.length,count+3,'opening the picker only prepares audio');
  context.state='running';
  pendingResumes.pop()();
  select.dispatchEvent(new Event('change'));
  assert.equal(voices.length,count+6,'committing a choice sounds once');
  enabled=false;
  select.dispatchEvent(new Event('change'));
  assert.equal(voices.length,count+6);
  enabled=true;
  unbind();
  select.dispatchEvent(new Event('change'));
  assert.equal(voices.length,count+6);
});
