import test from 'node:test';
import assert from 'node:assert/strict';
import {enterRoom} from '../src/game/room-session.mjs';
import {changeChat,readChat,refreshChat} from '../src/game/community.mjs';

test('friend chat can reload missing history after a burst and retry a timed-out message', async t => {
  const stored=new Map();
  globalThis.localStorage={
    getItem:key=>stored.get(key)??null,
    setItem:(key,value)=>stored.set(key,String(value)),
    removeItem:key=>stored.delete(key),
  };
  t.after(()=>delete globalThis.localStorage);
  const code='ABCD2345EFGH6789';
  const rows=Array.from({length:100},(_,index)=>({id:10+index*3}));
  const requests=[];
  t.mock.method(globalThis,'fetch',async (url,init)=>{
    if(url==='./api/rooms')return Response.json({code,mode:'multiplayer',started:true});
    assert.equal(init.headers.get('X-Stall-Room'),code);
    if(init.body){
      requests.push(JSON.parse(init.body));
      if(init.signal.aborted)throw init.signal.reason;
    }
    const before=new URL(url,'https://game.test/').searchParams.get('before');
    const available=before?rows.filter(row=>row.id<Number(before)):rows;
    return Response.json({code,messages:available.slice(-60),earlier:available.length>60});
  });
  await enterRoom({action:'create'});
  await refreshChat();
  await changeChat('earlier');
  assert.equal(readChat().messages.length,100);
  assert.equal(readChat().hasEarlier,false);

  rows.push({id:310});
  await refreshChat();
  assert.deepEqual(readChat().messages,rows);
  rows.push(...Array.from({length:80},(_,index)=>({id:313+index*3})));
  await refreshChat();
  assert.equal(readChat().hasEarlier,true);
  for(let page=0;page<3&&readChat().hasEarlier;page++)await changeChat('earlier');
  assert.equal(readChat().hasEarlier,false);
  assert.deepEqual(readChat().messages,rows);

  const nextSignal=t.mock.method(AbortSignal,'timeout',()=>AbortSignal.abort(new DOMException('Timed out','TimeoutError')));
  const message={kind:'text',content:'다시 보낼 메시지'};
  const failed=await changeChat('send',message);
  assert.match(failed.error,/채팅방에 연결하지 못했어/);
  nextSignal.mock.restore();
  const retry=await changeChat('send',message);
  assert.equal(retry.sent,true);
  assert.equal(requests[0].nonce,requests[1].nonce);
});
