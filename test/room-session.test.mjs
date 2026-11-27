import test from 'node:test';
import assert from 'node:assert/strict';
import {lastGuidePage,practiceTicker,restorePractice} from '../src/game/field-guide-model.mjs';

function storage(){
  const entries=new Map();
  return {
    getItem:key=>entries.get(key)??null,
    setItem:(key,value)=>entries.set(key,String(value)),
    removeItem:key=>entries.delete(key),
  };
}

test('room clients pin the guest and room per tab, reuse a failed create, and adopt an old game only once',async t=>{
  const local=storage();
  const tab=storage();
  t.mock.method(globalThis,'fetch',async (url,init)=>{
    const headers=init.headers,body=init.body&&JSON.parse(init.body);
    requests.push({url,headers,body});
    if(requests.length===1)throw new TypeError('connection interrupted');
    if(body)return Response.json({code:body.code??roomA,nickname:'게스트 1'});
    return Response.json({code:headers.get('X-Stall-Room'),nickname:'게스트 1'});
  });
  for(const [name,value] of [['localStorage',local],['sessionStorage',tab]]){
    const original=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{configurable:true,value});
    t.after(()=>{if(original)Object.defineProperty(globalThis,name,original);else delete globalThis[name];});
  }
  const roomA='ABCD2345EFGH6789',roomB='BBCD2345EFGH6789',requests=[];
  const clientA=await import('../src/game/room-session.mjs?tabA');
  await assert.rejects(clientA.enterRoom({action:'create'}));
  await clientA.enterRoom({action:'create'});
  assert.equal(requests[0].body.requestId,requests[1].body.requestId);
  const guest=requests[1].headers.get('X-Stall-Guest');
  assert.match(guest,/^[0-9a-f-]{36}$/);

  const game='test:game';
  local.setItem(game,JSON.stringify({cash:10,startWealth:12,spyPending:{id:'old',cost:7},electionReset:{resetId:'old'}}));
  const keyA=await clientA.migrateLegacyGame(game,()=>true);
  const imported=JSON.parse(local.getItem(keyA));
  assert.equal(imported.cash,17);
  assert.equal(imported.startWealth,19);
  assert.equal(imported.electionReset,undefined);
  assert.equal(imported.spyPending,undefined);
  assert.ok(!keyA.includes(guest));
  local.setItem(keyA,'updated');
  await clientA.migrateLegacyGame(game,()=>true);
  assert.equal(local.getItem(keyA),'updated');

  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage()});
  const clientB=await import('../src/game/room-session.mjs?tabB');
  await clientB.enterRoom({action:'join',code:'bbcd-2345-efgh-6789'});
  assert.equal(clientB.getRoomSession().code,roomB);
  const keyB=await clientB.migrateLegacyGame(game,()=>true);
  assert.notEqual(keyA,keyB);
  assert.equal(local.getItem(keyB),null);
  await clientA.roomFetch('./api/friends');
  assert.equal(requests.at(-1).headers.get('X-Stall-Room'),roomA);
  assert.equal(requests.at(-1).headers.get('X-Stall-Guest'),guest);

  local.removeItem('stall-street:guest:1:identity');
  const secondGuest=await import('../src/game/room-session.mjs?anotherGuest');
  await secondGuest.enterRoom({action:'join',code:roomA});
  const secondKey=await secondGuest.migrateLegacyGame(game,()=>true);
  assert.notEqual(keyA,secondKey);
  assert.equal(local.getItem(secondKey),null);
  await clientA.roomFetch('./api/friends');
  assert.equal(requests.at(-1).headers.get('X-Stall-Guest'),guest);
});

test('old guide checkpoints and both reserve-preserving trade sizes survive reloads until completed', async t => {
  for(const name of ['localStorage','sessionStorage']){
    const original=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{configurable:true,value:storage()});
    t.after(()=>{if(original)Object.defineProperty(globalThis,name,original);else delete globalThis[name];});
  }
  const first=await import('../src/game/room-session.mjs?firstGuide');
  assert.equal(first.getGuideProgress(),null);
  const key=first.guideRunKey();
  localStorage.setItem(key,'2');
  assert.deepEqual(first.getGuideCheckpoint(key),{page:2,practice:null});
  const oldOrder={evidence:'freight',qty:2,filled:true,conclusion:null};
  localStorage.setItem(key+':practice',JSON.stringify({page:1,practice:oldOrder}));
  assert.deepEqual(first.getGuideCheckpoint(key),{page:1,practice:oldOrder});
  for(const qty of [1,2]){
    const practice={...oldOrder,qty,conclusion:'valuation'};
    first.saveGuideProgress(2,key,practice);
    first.saveGuideProgress(9,key);
    const reopened=await import('../src/game/room-session.mjs?reopenedGuide'+qty);
    assert.deepEqual(reopened.getGuideCheckpoint(),{page:2,practice});
    assert.equal(reopened.getGuideProgress(),2);
  }
  const finisher=await import('../src/game/room-session.mjs?reopenedGuide2');
  const newPractice=restorePractice({...oldOrder,market:practiceTicker,conclusion:'valuation',mental:'recovered'});
  finisher.saveGuideProgress(lastGuidePage,key,newPractice);
  assert.deepEqual(first.getGuideCheckpoint(key),{page:lastGuidePage,practice:newPractice});
  finisher.saveGuideProgress('done',key);
  localStorage.setItem(key+':practice',JSON.stringify({page:1,practice:oldOrder}));
  first.saveGuideProgress(2);
  assert.equal(first.getGuideProgress(),'done');
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage()});
  const another=await import('../src/game/room-session.mjs?otherGuide');
  assert.equal(another.getGuideProgress(),'done');
});

test('guide completion belongs to each room member and reset, including an offline restart', async t => {
  const local=storage(),tab=storage(),roomA='ABCD2345EFGH6789',roomB='BBCD2345EFGH6789';
  for(const [name,value] of [['localStorage',local],['sessionStorage',tab]]){
    const original=Object.getOwnPropertyDescriptor(globalThis,name);
    Object.defineProperty(globalThis,name,{configurable:true,value});
    t.after(()=>{if(original)Object.defineProperty(globalThis,name,original);else delete globalThis[name];});
  }
  let serverRun='';
  t.mock.method(globalThis,'fetch',async (_,init)=>{
    const body=init.body&&JSON.parse(init.body);
    return Response.json({code:body?.code||init.headers.get('X-Stall-Room')||roomA,progressId:serverRun,started:true});
  });
  const game=await import('../src/game/room-session.mjs?guide-runs');
  local.setItem('stall-street:field-guide:v1','1');
  await game.enterRoom({action:'guest'});
  const initial=game.guideRunKey();
  assert.equal(game.getGuideProgress(initial),null);
  game.saveGuideProgress('done',initial);
  const reset=crypto.randomUUID();
  local.setItem(game.roomStorageKey(game.gameSaveBase),JSON.stringify({resetId:reset,roomProgressId:reset,roomProgressResets:[{resetId:reset}]}));
  const next=game.guideRunKey();
  assert.notEqual(initial,next);
  assert.equal(game.getGuideProgress(next),null);
  game.saveGuideProgress(1,next);
  serverRun=reset;
  await game.refreshRoom();
  local.setItem(game.roomStorageKey(game.gameSaveBase),JSON.stringify({roomProgressId:reset,resetId:reset}));
  assert.equal(game.getGuideProgress(game.guideRunKey()),1);
  const newer=crypto.randomUUID();
  serverRun=newer;
  await game.refreshRoom();
  assert.equal(game.getGuideProgress(game.guideRunKey()),null);
  game.saveGuideProgress('done',next);
  assert.equal(game.getGuideProgress(game.guideRunKey()),null);
  serverRun='';
  await game.enterRoom({action:'join',code:roomB});
  assert.equal(game.getGuideProgress(game.guideRunKey()),null);
  // A played, unreset save can carry over the old global marker when first opened.
  local.setItem(game.roomStorageKey(game.gameSaveBase),JSON.stringify({day:9}));
  assert.equal(game.getGuideProgress(game.guideRunKey()),'done');
});
