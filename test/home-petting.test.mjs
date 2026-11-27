import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initial} from '../src/game/market.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';
const {BankPage,DeskPage}=await loadJsx(new URL('../src/ui/finance.jsx',import.meta.url));
const {HomeCharacter}=await loadJsx(new URL('../src/ui/home.jsx',import.meta.url));
const {CharacterPreviewDialog}=await loadJsx(new URL('../src/ui/extras.jsx',import.meta.url));
const {ShopSheet}=await loadJsx(new URL('../src/ui/shop.jsx',import.meta.url));
import {characterPose,characterPoses,petCharacter,petDuration} from '../src/game/player-character.mjs';

test('anger sits between weeping and exhaustion in automatic and manual previews',()=>{
  const samples=[[100,'1'],[80,'1'],[79,'2'],[60,'2'],[59,'3'],[40,'3'],[39,'4'],[20,'4'],
    [19,'6'],[10,'6'],[9,'5'],[0,'5']];
  for(const [score,id] of samples)assert.equal(characterPose(score).id,id);
  assert.equal(characterPose(75,'5').label,'방전');
  assert.equal(characterPose(75,'6').label,'분노');
  const choices=renderView(CharacterPreviewDialog,{state:initial(),characterPreview:'6'});
  assert.match(choices,/<h2 id="dialog-title">캐릭터 표정 미리보기<\/h2>/);
  assert.match(choices,/<strong aria-live="polite" aria-atomic="true">분노<\/strong>/);
  assert.match(choices,/role="img" aria-label="떨어진 휴대폰을 향해 등을 세우고 털을 곤두세운 고양이"/);
  assert.match(choices,/data-value="4"[^>]*><span>4번<\/span><b>울컥<\/b>.*?data-value="6"[^>]*><span>5번<\/span><b>분노<\/b>.*?data-value="5"[^>]*><span>6번<\/span><b>방전<\/b>/);
});

test('every home pose has an accessible pet target and independent cat, fixture and hand layers',()=>{
  for(const pose of characterPoses){
    const home=renderView(HomeCharacter,{pose});
    assert.ok(home.includes('aria-label="고양이 쓰다듬기"'));
    const files=new Map();
    for(const [,url,id] of home.matchAll(/href="\/([^"#]+)#([^"]+)"/g)){
      if(!files.has(url))files.set(url,readFileSync(new URL('../public/'+url,import.meta.url),'utf8'));
      assert.ok(files.get(url).includes('id="'+id+'"'),url+'#'+id);
    }
    assert.ok(home.includes('pose-'+pose.id+'.svg#fixture'));
    assert.ok(home.includes('pose-'+pose.id+'.svg#cat'));
    assert.equal(home.includes('.svg#wipe'),pose.id==='4',pose.label+' tissue layer');
    assert.ok(home.includes('petting-hand.svg#contact')&&home.includes('petting-hand.svg#open'));
    assert.doesNotMatch(renderView(CharacterPreviewDialog,{state:initial(),characterPreview:pose.id}),/pet-cat|petting-hand/);
  }
});

test('each office renders an accessible desk-only pet target and independent employee artwork',()=>{
  for(const [page,id,label] of [[BankPage,'bank','은행 직원'],[DeskPage,'loan-office','대부 창구 실장']]){
    const office=renderView(page,{state:initial()});
    assert.ok(office.includes('aria-label="'+label+' 쓰다듬기"'));
    assert.equal((office.match(/data-act="pet-desk-cat"/g)||[]).length,1);
    assert.doesNotMatch(office,/data-act="pet-cat"/);
    for(const layer of ['room','staff','staff-still','counter']){
      const path='art/pixel/'+id+'-'+layer+'.webp';
      assert.ok(office.includes(path),path);
      assert.equal(readFileSync(new URL('../public/'+path,import.meta.url)).toString('ascii',8,12),'WEBP');
    }
  }
});

test('the black-market vendor has one pet target on the illustrated alley with both motion settings',()=>{
  const shop=renderView(ShopSheet,{sound:false});
  const scene=shop.match(/<header class="shop-scene">.*?<\/header>/)?.[0];
  assert.ok(scene?.includes('class="shop-alley" data-pet-stage=""'));
  assert.equal((scene.match(/data-pet-target=/g)??[]).length,1);
  assert.match(scene,/aria-label="암시장 마눌고양이 쓰다듬기"/);
  assert.match(scene,/prefers-reduced-motion: reduce[^>]+black-market-still.webp/);
  assert.ok(scene.includes('petting-hand.svg#contact')&&scene.includes('black-market-pet.webp'));
  const face=readFileSync(new URL('../public/art/pixel/black-market-pet.webp',import.meta.url));
  assert.equal(face.toString('ascii',8,12),'WEBP');
  assert.doesNotMatch(scene,/구매하기|data-act="pet-cat"/);
});

test('a tap can restart a single stroke before the prior animation finishes',async()=>{
  const active=new Set(), newScene=new Set();
  let starts=0;
  const sprite={
    classList:{add:c=>{active.add(c);starts++;},remove:c=>active.delete(c)},
  };
  const button={closest:()=>sprite};
  const newButton={closest:()=>({classList:{add:c=>newScene.add(c),remove:c=>newScene.delete(c)}})};
  assert.equal(petCharacter(button,0),true);
  assert.equal(petCharacter(newButton,6),true);
  assert.equal(petCharacter(button,17),false);
  assert.equal(petCharacter(button,18),true);
  assert.equal(petCharacter(button,36),true);
  assert.equal(starts,3);
  assert.equal(active.has('petting'),true);
  assert.equal(newScene.has('petting'),true);
  await new Promise(resolve=>setTimeout(resolve,310));
  assert.equal(active.size,0);
  assert.equal(newScene.size,0);
});

test('rapid taps reuse visible animation tracks and refresh them when reduced motion changes',()=>{
  const classes=new Set(),hand={animationName:'pet-hand-pass',currentTime:0},fingers={animationName:'pet-fingers',currentTime:0};
  const body={animationName:'pet-body-squeeze',currentTime:0},idle={animationName:'character-rest',currentTime:91};
  let tracks=[hand,fingers,body,idle],scans=0;
  const sprite={
    classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},
    getAnimations(options){assert.deepEqual(options,{subtree:true});scans++;return tracks;},
    get offsetWidth(){assert.fail('replays should not force layout when CSS animation tracks are available');},
  };
  const button={closest:()=>sprite};
  assert.equal(petCharacter(button,0),true);
  assert.equal(petCharacter(button,18),true);
  for(const track of [hand,fingers,body]){
    assert.ok(track.currentTime>0);
    track.currentTime=100;
  }
  assert.equal(petCharacter(button,36),true);
  assert.equal(hand.currentTime,fingers.currentTime);
  assert.equal(hand.currentTime,body.currentTime);
  assert.equal(idle.currentTime,91);
  assert.equal(scans,1);
  let replayed=false;
  hand.playState='finished';hand.play=()=>{replayed=true;};
  assert.equal(petCharacter(button,54),true);
  assert.equal(replayed,true);
  assert.equal(scans,1);
  const still={animationName:'pet-hand-still',currentTime:0};
  hand.playState='idle';tracks=[still];
  assert.equal(petCharacter(button,72),true);
  assert.ok(still.currentTime>0);
  assert.equal(scans,2);
  assert.equal(classes.has('petting'),true);
});

test('retapping a seated cat keeps the shared stroke alive through the new release',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const classes=new Set(),track={animationName:'pet-body-squeeze',currentTime:0};
  const sprite={classList:{add:c=>classes.add(c),remove:c=>classes.delete(c)},
    getAnimations:()=>[track]};
  const button={closest:()=>sprite};
  assert.ok(petCharacter(button,0));
  t.mock.timers.tick(100);
  assert.ok(classes.has('petting'));
  assert.ok(petCharacter(button,100));
  assert.equal(track.currentTime,petDuration*.29);
  t.mock.timers.tick(petDuration+15);
  assert.ok(classes.has('petting'));
  t.mock.timers.tick(1);
  assert.ok(!classes.has('petting'));
});

test('each accepted tap plays one copy of the clipped recording; mute and overlapping taps work',async t=>{
  const sample=readFileSync(new URL('../public/audio/pat.wav',import.meta.url));
  assert.equal(sample.toString('ascii',0,4),'RIFF');
  const block=sample.indexOf('data'),rate=sample.readUInt32LE(24);
  assert.equal(sample.readUInt16LE(22),1);
  assert.ok(Math.abs(sample.readUInt32LE(block+4)/rate/2-.22)<.001);
  let requests=0,decodes=0;
  const starts=[],activeVoices=new Set();
  t.mock.method(globalThis,'fetch',async url=>{
    assert.ok(url.href.endsWith('/audio/pat.wav'));
    requests++;
    return new Response(sample);
  });
  const {playGameSound,muteGame}=await import('../src/game/game-audio.mjs');
  class Audio {
    state='suspended'; currentTime=0; destination={};
    createGain(){return {gain:{setTargetAtTime(){}},connect(){}};}
    async resume(){this.state='running';}
    async decodeAudioData(data){decodes++;assert.equal(data.byteLength,sample.byteLength);return {};}
    createBufferSource(){
      return {
        connect(){},
        start(time){starts.push(time);activeVoices.add(this);},
        stop(){assert.ok(activeVoices.has(this));},
        disconnect(){activeVoices.delete(this);},
      };
    }
  }
  const prior=globalThis.AudioContext;
  globalThis.AudioContext=Audio;
  t.after(()=>{if(prior)globalThis.AudioContext=prior;else delete globalThis.AudioContext;});
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  muteGame(true);
  playGameSound('pet');await settle();assert.equal(requests,0);
  muteGame(false);
  playGameSound('pet');await settle();assert.equal(starts.length,1);
  playGameSound('pet');await settle();assert.equal(starts.length,2);
  assert.equal(requests,1);assert.equal(decodes,1);
  for(let i=0;i<14;i++)playGameSound('pet');
  assert.equal(starts.length,16);
  assert.equal(activeVoices.size,8);
  activeVoices.values().next().value.onended();
  assert.equal(activeVoices.size,7);
  muteGame(true);
  assert.equal(activeVoices.size,0);
  playGameSound('pet');await settle();
  assert.equal(starts.length,16);
});
