import test from 'node:test';
import assert from 'node:assert/strict';
import {RITUAL_PHRASE,RITUAL_PHRASES,RITUAL_INTRO,RITUAL_FINALE,RITUAL_OUTRO,RITUAL_TIMELINE,RITUAL_SPRITE,
  ritualPreludeMs,ritualWoodKnockMs,ritualTakeoffMs,ritualIntroMs,ritualFinaleStartMs,ritualFinalHitMs,ritualOutroStartMs,ritualDanceMs} from '../src/game/ritual-choreography.mjs';
import {paintRitualFrame,ritualFrameAt,ritualRoom} from '../src/game/ritual-performance.mjs';

test('the cat takes off on the wooden knock, dances three phrases, then steps down to its original seated pose',()=>{
  const duration=frames=>frames.reduce((sum,[,length])=>sum+length,0);
  assert.deepEqual(RITUAL_PHRASES.map(duration),[1455,1455,1455]);
  assert.deepEqual(RITUAL_TIMELINE,[...RITUAL_INTRO,...RITUAL_PHRASES.flat(),...RITUAL_FINALE,...RITUAL_OUTRO]);
  assert.equal(ritualPreludeMs,1250);
  const prepFrames=RITUAL_INTRO.filter((_,i)=>duration(RITUAL_INTRO.slice(0,i))<ritualPreludeMs);
  assert.ok(new Set(prepFrames.map(([frame])=>frame)).size>=3);assert.equal(duration(prepFrames),ritualPreludeMs);
  assert.equal(duration(RITUAL_INTRO),ritualIntroMs);assert.equal(ritualIntroMs,2450);
  assert.equal(ritualWoodKnockMs,1670);assert.equal(ritualTakeoffMs,1870);
  for(const cue of [ritualWoodKnockMs,ritualTakeoffMs])
    assert.notEqual(ritualFrameAt(cue-1).frame,ritualFrameAt(cue).frame);
  assert.equal(ritualFinaleStartMs,6815);
  assert.equal(duration(RITUAL_FINALE),2000);
  assert.equal(ritualOutroStartMs,8815);assert.equal(duration(RITUAL_OUTRO),1080);
  assert.equal(duration(RITUAL_TIMELINE),9895);
  assert.equal(ritualDanceMs,9895);
  assert.equal(ritualFinalHitMs,8030);
  assert.equal(ritualFrameAt(ritualFinaleStartMs).frame,RITUAL_FINALE[0][0]);
  assert.notEqual(ritualFrameAt(ritualFinalHitMs-1).frame,ritualFrameAt(ritualFinalHitMs).frame);
  const held=RITUAL_OUTRO.at(-1)[0];
  assert.equal(held,ritualFrameAt(0).frame);
  assert.equal(ritualFrameAt(ritualDanceMs-1).frame,held);
  assert.equal(ritualFrameAt(ritualDanceMs+500).frame,held);
  assert.notEqual(held,RITUAL_PHRASE[0][0]);
});

test('each dance phrase has its own series of drawings',()=>{
  const drawings=RITUAL_PHRASES.map(phrase=>new Set(phrase.map(([frame])=>frame)));
  for(const current of drawings){
    const others=drawings.filter(phrase=>phrase!==current);
    const unique=[...current].filter(frame=>others.every(phrase=>!phrase.has(frame)));
    assert.ok(unique.length>=3,'Each phrase needs its own movement between shared poses');
  }
});

test('restored playback picks the current drawing and the landing light only runs at the downbeat',()=>{
  const rects=[],draws=[];
  const ctx={clearRect(){},fillRect(...r){rects.push(r);},drawImage(...r){draws.push(r);}};
  const atlas={};
  for(const time of [0,521,2000,ritualFinaleStartMs,ritualFinalHitMs-1]){
    assert.ok(paintRitualFrame(ctx,atlas,time)>time);
    assert.equal(rects.length,0);
    const {frame}=ritualFrameAt(time);
    const {width,height,columns,feetX,feetY}=RITUAL_SPRITE;
    assert.deepEqual(draws.at(-1),[atlas,frame%columns*width,Math.floor(frame/columns)*height,width,height,
      ritualRoom.footX-feetX,ritualRoom.footY-feetY,width,height]);
  }
  paintRitualFrame(ctx,atlas,ritualFinalHitMs);
  assert.ok(rects.length>=2);
  rects.length=0;
  assert.equal(paintRitualFrame(ctx,atlas,ritualDanceMs),ritualDanceMs);
  assert.equal(rects.length,0);
});
