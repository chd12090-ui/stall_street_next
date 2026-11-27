import test from 'node:test';
import assert from 'node:assert/strict';
import {DB} from '../test-support/game-db.mjs';
import {serveGameApi} from '../src/server/game-api.mjs';
import {defaultNickname,limitNickname,validNickname} from '../src/game/nickname.mjs';
import {actualTimestamp,gameDayStart,gameTime,gameTimestamp} from '../src/game/clock-calendar.mjs';
import {intimidationCooldownDays,intimidationFee} from '../src/game/desk-intimidation-state.mjs';
import {ritualOffer} from '../test-support/ritual-offer.mjs';

const now = Date.UTC(2026, 10, 21, 3);
const rooms = '/api/rooms';
const elections = '/api/elections';
const desk = '/api/intimidations';
const reports = '/api/desk-reports';
const newGuest = () => ({guest:crypto.randomUUID()});
const create = () => ({action:'create', requestId:crypto.randomUUID()});
const start = session => accepted(call(rooms, session, {action:'start'}));

function call(path, {guest, room, account, progressId, openingDay}, body, when = now) {
  const headers = {'Content-Type':'application/json', 'Sec-Fetch-Site':'same-origin'};
  if (guest) headers['X-Stall-Guest'] = guest;
  if (room) headers['X-Stall-Room'] = room;
  if (openingDay!==undefined) headers['X-Stall-Opening-Day'] = String(openingDay);
  if (account) headers['OAI-Authenticated-User-Id'] = account;
  if (progressId) headers['X-Stall-Progress'] = progressId;
  return serveGameApi(new Request('https://game.example'+path, {
    method:body ? 'POST' : 'GET', headers, body:body && JSON.stringify(body),
  }), DB, when);
}

async function accepted(promise) {
  const response = await promise;
  const payload = await response.json();
  assert.ok(response.ok, JSON.stringify(payload));
  return payload;
}

async function host() {
  const session = newGuest();
  const {code} = await accepted(call(rooms, session, create()));
  return {...session, room:code};
}

async function join(session, code, nickname) {
  const membership = await accepted(call(rooms, session, {action:'join', code, nickname}));
  return {...session, room:membership.code};
}

test('guest room creation can be retried, invites can be pasted, and restoration checks membership', async () => {
  const session = newGuest(), request = create();
  const [{code}, retry] = await Promise.all([
    accepted(call(rooms, session, request)), accepted(call(rooms, session, request)),
  ]);
  assert.match(code, /^[A-HJ-NP-Z2-9]{16}$/);
  assert.equal(retry.code, code);
  const secondRoom = await accepted(call(rooms, session, create()));
  assert.notEqual(secondRoom.code, code);
  assert.equal((await accepted(call(rooms, {...session, room:code}))).code, code);
  const participant = await join(newGuest(), code.toLowerCase().match(/.{4}/g).join('-'));
  assert.equal((await accepted(call(rooms, participant))).code, code);
  const visitor = {...newGuest(), room:code};
  for (const path of [rooms, '/api/friends', elections, desk, reports]) {
    assert.ok([401, 403, 404].includes((await call(path, visitor)).status), path);
  }
  assert.ok(!(await call(rooms, {guest:'broken-token'}, create())).ok);
});

test('six visible characters apply to room admission, automatic names and earlier room identities',async()=>{
  const a=await host(),guest=newGuest(),long='포근한고양이87';
  for(const payload of [{...create(),nickname:long},{action:'join',code:a.room,nickname:long},
      {action:'guest',requestId:crypto.randomUUID(),nickname:long}]){
    const rejected=await call(rooms,guest,payload);
    assert.equal(rejected.status,400);
    assert.match((await rejected.json()).error,/6자/);
  }
  const six='냥이🐾👨‍👩‍👧‍👦🇰🇷7';
  assert.equal(limitNickname(six+'8'),six);
  const participant=await join(guest,a.room,six.normalize('NFD'));
  assert.equal((await accepted(call(rooms,participant))).nickname,six);
  await start(a);
  await DB.prepare('UPDATE friend_room_members SET nickname=? WHERE room_code=? AND nickname=?').bind(long,a.room,six).run();
  assert.equal((await accepted(call(rooms,participant))).nickname,'포근냥이87');
  const room=await accepted(call('/api/friends',a));
  assert.ok(room.members.some(member=>member.nickname==='포근냥이87'));
  assert.equal((await accepted(call(desk,a))).targets[0].nickname,'포근냥이87');
  assert.equal((await DB.prepare('SELECT count(*) AS n FROM friend_room_members WHERE room_code=? AND nickname=?').bind(a.room,long).first()).n,1);
  for(let i=0;i<120;i++)assert.ok(validNickname(defaultNickname()));
});

test('only the host can start a multiplayer room after another guest has joined it', async () => {
  const a = await host();
  const get = session => accepted(call(rooms, session));
  const startRequest = session => call(rooms, session, {action:'start'});
  assert.deepEqual(await get(a), {
    code:a.room, nickname:'게스트 1', mode:'multiplayer', host:true, participants:1, started:false,
  });
  const before = await startRequest(a);
  assert.equal(before.status,409);
  assert.equal((await before.json()).reason,'waiting_for_players');
  const repeated = await join(a,a.room);
  assert.equal((await get(repeated)).participants,1);
  assert.equal((await startRequest(a)).status,409);
  assert.equal((await call('/api/friends/'+a.room,{account:'legacy-guest'},{action:'join'})).status,404);
  assert.equal((await get(a)).participants,1);

  const b = await join(newGuest(),a.room);
  assert.deepEqual(await get(b), {
    code:a.room, nickname:'게스트 2', mode:'multiplayer', host:false, participants:2, started:false,
  });
  const blocked = await startRequest(b);
  assert.equal(blocked.status,403);
  assert.equal((await blocked.json()).reason,'host_only');
  for(const path of ['/api/friends',elections,desk,reports]){
    const waiting = await call(path,b);
    assert.equal(waiting.status,409);
    assert.equal((await waiting.json()).reason,'room_not_started');
  }
  const [started,retried] = await Promise.all([start(a),start(a)]);
  assert.equal(started.started,true);
  assert.deepEqual(retried,started);
  assert.equal((await get(b)).started,true);
  assert.equal((await accepted(call('/api/friends',b))).participants,2);
});

test('guest mode starts immediately in an isolated room and can be restored', async () => {
  const guest = newGuest();
  const request = {...create(),action:'guest'};
  const room = await accepted(call(rooms,guest,request));
  assert.deepEqual(room, {
    code:room.code, nickname:'게스트 1', mode:'guest', host:true, participants:1, started:true,
  });
  assert.deepEqual(await accepted(call(rooms,guest,request)),room);
  assert.deepEqual(await accepted(call(rooms,{...guest,room:room.code})),room);
  assert.equal((await call(rooms,newGuest(),{action:'join',code:room.code})).status,404);
  assert.equal((await call('/api/friends/'+room.code,{account:'legacy-guest'},{action:'join'})).status,404);
  assert.equal((await accepted(call('/api/friends',{...guest,room:room.code}))).participants,1);
});

test('rooms created before the start gate are still playable and accept invites', async () => {
  const a = await host();
  await DB.prepare('UPDATE friend_rooms SET game_mode=NULL WHERE code=?').bind(a.room).run();
  assert.equal((await accepted(call(rooms,a))).started,true);
  assert.equal((await accepted(call('/api/friends',a))).participants,1);
  const b = await join(newGuest(),a.room);
  assert.equal((await accepted(call(rooms,b))).started,true);
});

test('guest chat and desk reports use the selected room even when one browser joins two rooms', async () => {
  const alice = await host(), bea = await join(newGuest(), alice.room, '초록고양이'), carol = await host();
  const aliceElsewhere = await join(alice, carol.room);
  await Promise.all([start(alice),start(carol)]);
  const roomPath = '/api/friends/'+alice.room;
  const message = {action:'send', kind:'text', nonce:crypto.randomUUID(), content:'안녕!'};
  const sent = await accepted(call(roomPath, alice, message));
  assert.ok(sent.messages.at(-1).own);
  await accepted(call(roomPath, alice, message));
  const received = await accepted(call('/api/friends', bea));
  assert.equal(received.participants, 2);
  assert.deepEqual(received.members, [
    {number:1,nickname:'게스트 1',own:false},
    {number:2,nickname:'초록고양이',own:true},
  ]);
  assert.deepEqual(received.messages.map(m => [m.content,Boolean(m.own)]), [['안녕!',false]]);
  const shared = {action:'send', kind:'stock', nonce:crypto.randomUUID(), content:'MOON'};
  await accepted(call(roomPath, bea, shared));
  const stockMessage = (await accepted(call(roomPath, alice))).messages.at(-1);
  assert.equal(stockMessage.kind, 'stock');
  assert.equal(stockMessage.senderName, '초록고양이');
  assert.deepEqual((await accepted(call('/api/friends', aliceElsewhere))).messages, []);
  assert.ok(!(await call(roomPath, aliceElsewhere, {...message,nonce:crypto.randomUUID()})).ok);

  const positions = [{code:'MOON',qty:1,average:10,costKRW:14000}];
  await accepted(call(reports, bea, {action:'sync',capturedAt:gameTimestamp(now),positions,trades:[]}));
  const roster = await accepted(call(desk, alice));
  assert.equal(roster.targets.length, 1);
  assert.equal(roster.targets[0].nickname, '초록고양이');
  const target = roster.targets[0].slot;
  assert.deepEqual(roster.spyReady,[target]);
  const id = crypto.randomUUID();
  const bought = await accepted(call(reports, alice, {
    action:'buy',id,room:alice.room,buyerSlot:roster.selfSlot,target,assets:2_000_000,available:2_000_000,cost:1_010_000,
  }));
  assert.deepEqual(bought.positions, positions);
  assert.equal((await accepted(call(desk, bea))).spyNotices.length, 1);
  assert.deepEqual((await accepted(call(reports, aliceElsewhere))).reports, []);
  assert.ok(!(await call(reports+'?id='+id, aliceElsewhere)).ok);
});

test('asset snapshots retain all three values for the recipient and keep older shares readable',async()=>{
  const sender=await host(),recipient=await join(newGuest(),sender.room);
  await start(sender);
  const path='/api/friends/'+sender.room;
  const legacy={action:'send',kind:'assets',content:'',nonce:crypto.randomUUID(),amount:4_800_000};
  await accepted(call(path,sender,legacy));
  const totals={amount:-10_000,assetsTotal:40_000,debtTotal:50_000};
  const snapshot={...legacy,...totals,nonce:crypto.randomUUID()};
  assert.equal((await call(path,sender,{...snapshot,debtTotal:undefined})).status,400);
  assert.equal((await call(path,sender,{...snapshot,assetsTotal:40_001})).status,400);
  await accepted(call(path,sender,snapshot));
  await accepted(call(path,sender,snapshot));
  const {messages}=await accepted(call(path,recipient));
  assert.equal(messages.length,2);
  assert.equal(messages[0].amount,legacy.amount);
  assert.equal(Object.hasOwn(messages[0],'assetsTotal'),false);
  assert.equal(Object.hasOwn(messages[0],'debtTotal'),false);
  assert.deepEqual(Object.fromEntries(Object.keys(totals).map(key=>[key,messages[1][key]])),totals);
  assert.equal(Boolean(messages[1].own),false);
});

test('intimidation cooldown applies to each friend and retries never charge twice',async()=>{
  const sender=await host(),first=await join(newGuest(),sender.room,'첫째'),second=await join(newGuest(),sender.room,'둘째');
  await start(sender);
  const roster=await accepted(call(desk,sender));
  const target=name=>roster.targets.find(friend=>friend.nickname===name).slot;
  const wealth=5_000_000,cost=intimidationFee(wealth);
  const intent=name=>({action:'send',id:crypto.randomUUID(),room:sender.room,target:target(name),wealth,available:wealth,cost});
  const firstRequest=intent('첫째');
  const [result,retry]=await Promise.all([accepted(call(desk,sender,firstRequest)),accepted(call(desk,sender,firstRequest))]);
  assert.deepEqual(retry,result);
  const during=await accepted(call(desk,sender));
  const nextAt=Math.ceil(actualTimestamp(gameTimestamp(now)+intimidationCooldownDays*86_400_000));
  assert.equal(during.targets.find(friend=>friend.nickname==='첫째').nextAt,nextAt);
  assert.equal(during.targets.find(friend=>friend.nickname==='둘째').nextAt,0);
  assert.equal((await call(desk,sender,intent('첫째'),nextAt-1)).status,409);
  await accepted(call(desk,sender,intent('둘째')));
  assert.equal((await accepted(call(desk,first))).incoming.length,1);
  assert.equal((await accepted(call(desk,second))).incoming.length,1);
  await accepted(call(desk,sender,intent('첫째'),nextAt));
  assert.equal((await accepted(call(desk,first,null,nextAt))).incoming.length,2);
});

test('solo elections restart with the current save on Day 1, including an already-reset older save',async()=>{
  const guest=newGuest(),arrival=gameTime(now).day,at=day=>actualTimestamp(gameDayStart(day));
  const {code}=await accepted(call(rooms,guest,{action:'guest',requestId:crypto.randomUUID()}));
  const player={...guest,room:code};
  const read=(session,day)=>accepted(call(elections,session,undefined,at(day)+500));
  const firstVote=(session,day)=>accepted(call(elections,session,{action:'vote',election:at(day),candidate:'progressive'},at(day)+500));
  const first=await firstVote(player,arrival+2);
  assert.equal(first.ballot.number,1);
  const freshDay=arrival+8;
  // Earlier clients reset locally while the server kept this solo room's original creation date.
  const saved={...player,openingDay:freshDay};
  const recovered=await read(saved,freshDay);
  assert.deepEqual([recovered.openingDay,recovered.nextNumber,recovered.nextStartsAt],[freshDay,1,at(freshDay+2)]);
  assert.deepEqual(recovered.history,[]);
  assert.deepEqual(recovered.terms,[]);
  assert.equal((await firstVote(saved,freshDay+2)).ballot.ownVote,'progressive');
  const resetDay=arrival+21,resetId=crypto.randomUUID();
  const restart={previousId:'',resetAt:at(resetDay)+100,resetId};
  await accepted(call('/api/progress/reset',player,restart,restart.resetAt));
  const fresh={...player,progressId:resetId};
  const today=await read(fresh,resetDay);
  assert.equal(today.openingDay,resetDay);
  assert.deepEqual([today.ballot,today.nextNumber,today.nextStartsAt,today.nextEndsAt],[null,1,at(resetDay+2),at(resetDay+4)]);
  assert.deepEqual(today.terms,[]);
  const voted=await firstVote(fresh,resetDay+2);
  assert.deepEqual([voted.ballot.number,voted.ballot.ownVote,voted.ballot.votes],[1,'progressive',1]);
  // A retry of the completed reset keeps the replacement ballot.
  await accepted(call('/api/progress/reset',player,restart,at(resetDay+3)));
  assert.equal((await read(fresh,resetDay+3)).ballot.ownVote,'progressive');
  const result=await read(fresh,resetDay+4);
  assert.deepEqual([result.lastResult.number,result.lastResult.winner,result.publishedToday],[1,'progressive',true]);
  assert.equal(result.nextStartsAt,at(resetDay+16));
});

test('rooms elect on Days 3–4 and publish on Day 5 independently of legacy elections', async () => {
  const a = await host(), b = await join(newGuest(), a.room), c = await host();
  await join(newGuest(),c.room);
  const startDay=gameTime(now).day+1;
  const at=offset=>actualTimestamp(gameDayStart(startDay+offset));
  await Promise.all([a,c].map(session=>accepted(call(rooms,session,{action:'start'},at(0)+1000))));
  const original = {account:'legacy-election-player'};
  async function vote(session, candidate, when) {
    const {ballot} = await accepted(call(elections, session, undefined, when));
    return accepted(call(elections, session, {action:'vote',election:ballot.roundId,candidate},when));
  }
  const old=await vote(original,'conservative',now);
  const before=await accepted(call(elections,a,undefined,at(2)-1));
  assert.equal(before.openingDay,startDay);
  const laterMember={...b,openingDay:startDay+1};
  const shared=await accepted(call(elections,laterMember,undefined,at(2)-1));
  assert.deepEqual(shared,before);
  assert.equal(before.ballot,null);
  assert.equal(before.lastResult,null);
  assert.deepEqual(before.terms,[]);
  assert.equal(before.nextNumber,1);
  assert.equal(before.nextStartsAt,at(2));
  assert.equal(before.nextEndsAt,at(4));
  assert.equal((await call(elections,a,{action:'vote',election:at(2),candidate:'progressive'},at(2)-1)).status,409);
  await vote(a,'progressive',at(2));
  const late=await vote(b,'progressive',at(4)-1);
  assert.equal(late.ballot.votes,2);
  assert.equal(late.lastResult,null);
  assert.deepEqual(late.terms,[]);
  assert.equal((await vote(c,'conservative',at(3))).ballot.votes,1);
  assert.equal((await accepted(call(elections, original))).ballot.votes, 1);
  const own = await accepted(call(elections, a, undefined, at(3)));
  assert.equal(own.ballot.ownVote,'progressive');
  assert.equal((await vote(a,'progressive',at(3))).ballot.votes,2);
  assert.equal((await call(elections,a,{action:'vote',election:at(2),candidate:'progressive'},at(4))).status,409);

  for (const [session, winner, votes] of [[a,'progressive',2],[c,'conservative',1]]) {
    const closed = await accepted(call(elections,session,undefined,at(4)));
    assert.equal(closed.lastResult.winner, winner);
    assert.equal(closed.lastResult[winner], votes);
    assert.equal(closed.lastResult.number,1);
    assert.equal(closed.publishedToday,true);
    assert.deepEqual(closed.history,[closed.lastResult]);
    assert.deepEqual(closed.terms,[{candidate:winner,effectiveAt:at(4)}]);
    assert.equal(closed.nextNumber,2);
    assert.equal(closed.nextStartsAt,at(16));
  }
  const second=await accepted(call(elections,a,undefined,at(16)));
  assert.equal(second.ballot.number,2);
  assert.equal(second.ballot.ownVote,null);
  assert.equal(second.publishedToday,false);
  const legacy=await accepted(call(elections,original,undefined,old.ballot.endsAt+1));
  assert.equal(legacy.lastResult.winner,'conservative');
  assert.equal(legacy.lastResult.conservative,1);
});

test('a returning signed member keeps the legacy chat and independent memberships in two game rooms', async () => {
  const signed = {account:'pre-landing-player'};
  const old = await accepted(call('/api/friends', signed, {action:'create'}));
  const legacyMessage = {action:'send',kind:'text',nonce:crypto.randomUUID(),content:'이전 대화'};
  await accepted(call('/api/friends/'+old.code, signed, legacyMessage));
  const first = await host(), second = await host();
  const signFirst = await join(signed, first.room, '첫 방 이름');
  const signSecond = await join(signed, second.room, '둘째방 이름');
  await Promise.all([start(first),start(second)]);
  const oldAgain = await accepted(call('/api/friends', signed));
  assert.equal(oldAgain.code, old.code);
  assert.deepEqual(oldAgain.messages.map(message => message.content), ['이전 대화']);
  for (const [session, name] of [[signFirst,'첫 방 이름'],[signSecond,'둘째방 이름']]) {
    const room = await accepted(call('/api/friends', session));
    assert.equal(room.code, session.room);
    assert.deepEqual(room.messages, []);
    assert.equal(room.members.find(member => member.own).nickname,name);
  }
});

test('room rituals draw once, publish only successes to members of that room and resume from a cursor',async t=>{
  const owner=await host(),friend=await join(newGuest(),owner.room);
  await start(owner);
  const isolated=await host(),peer=await join(newGuest(),isolated.room);
  await start(isolated);
  let roll=0;
  t.mock.method(crypto,'getRandomValues',array=>{array.fill(roll);return array;});
  const offer=(when=now)=>ritualOffer(when);
  const first=offer(),path='/api/rituals';
  const [a,b]=await Promise.all([accepted(call(path,owner,first)),accepted(call(path,owner,first))]);
  assert.deepEqual(a,b);assert.equal(a.result.success,true);assert.equal(a.result.bps,250);
  roll=0xffffffff;
  assert.deepEqual(await accepted(call(path,owner,first)),a);
  assert.equal((await call(path,owner,{...first,code:'MOON'})).status,409);
  assert.equal((await call(path,friend,first)).status,409);
  assert.equal((await call(path,owner,{...offer(),cost:99})).status,400);
  assert.equal((await call(path,owner,{...offer(),mental:0})).status,400);
  assert.equal((await call(path,owner,{...offer(),chance:98})).status,400);
  assert.equal((await call(path,owner,{...offer(),quotedAt:undefined})).status,400);
  for(const code of ['BIT','ETH','HRIDX','MOR2','MORI','ARCL3','HZMAI3']){
    const disallowed=await call(path,owner,{...offer(),code});
    assert.equal(disallowed.status,400);
    assert.equal((await disallowed.json()).error,'개별 회사 주식을 골라 줘.');
  }
  const failed=await accepted(call(path,friend,offer()));
  assert.equal(failed.result.success,false);assert.equal(failed.result.bps,0);
  const feed=await accepted(call(path,friend));assert.deepEqual(feed.events.map(e=>e.id),[first.id]);
  assert.equal(feed.usedDay,gameTime(now).day);
  const denied=await call(path,friend,offer());
  assert.equal(denied.status,409);assert.equal((await denied.json()).usedDay,feed.usedDay);
  assert.equal(feed.events[0].tick,a.result.tick);assert.equal(feed.events[0].mental,undefined);
  assert.deepEqual((await accepted(call(path+'?after='+feed.events[0].sequence,owner))).events,[]);
  assert.deepEqual((await accepted(call(path,peer))).events,[]);
  assert.equal((await call(path,{...newGuest(),room:owner.room})).status,403);
  // A retry of a paid pre-update request must not refund a published event or charge the new price.
  const legacyCost=2250000;
  await DB.prepare('UPDATE market_rituals SET code=?,cost=?,strength=? WHERE room_code=? AND request_id=?')
    .bind('BIT',legacyCost,180,owner.room,first.id).run();
  const legacy={...first,code:'BIT',cost:legacyCost,quotedAt:undefined,day:undefined};
  const old=await accepted(call(path,owner,legacy));
  assert.deepEqual(old.result,{...a.result,code:'BIT',bps:180});
  assert.equal((await call(path,owner,{...offer(),cost:legacyCost})).status,400);
  roll=Math.floor(.425*2**32);
  const nextDay=gameTime(now).day+1,midnight=Math.ceil(actualTimestamp(gameDayStart(nextDay)));
  assert.equal((await call(path,owner,offer(midnight-1),midnight-1)).status,409);
  const expired=await call(path,owner,{...offer(),day:nextDay-1},midnight);
  assert.equal(expired.status,409);assert.equal((await expired.json()).usedDay,undefined);
  assert.equal((await accepted(call(path,owner,undefined,midnight))).usedDay,null);
  assert.deepEqual((await accepted(call(path,owner,legacy,midnight))).result,old.result);
  const oldQuote=await accepted(call(path,owner,{...offer(midnight),chance:undefined},midnight));
  assert.equal(oldQuote.result.success,false);
  const randoms=[roll,0xffffffff];
  t.mock.method(crypto,'getRandomValues',array=>{assert.ok(randoms.length);array.fill(randoms.shift());return array;});
  const max=await accepted(call(path,friend,offer(midnight),midnight));
  assert.equal(max.result.bps,1000);
  const nextFeed=await accepted(call(path+'?after='+feed.events[0].sequence,friend));
  assert.equal(nextFeed.events[0].bps,1000);
});

test('two simultaneous offerings on different stocks share one daily slot for a room member',async()=>{
  const owner=await host(),peer=await join(newGuest(),owner.room);await start(owner);
  const path='/api/rituals',requests=['FLFX','MOON'].map(code=>ritualOffer(now,code));
  const results=await Promise.all(requests.map(r=>call(path,owner,r)));
  assert.deepEqual(results.map(res=>res.status).sort(),[200,409]);
  const winner=results.findIndex(res=>res.ok),paid=(await results[winner].json()).result;
  assert.equal((await accepted(call(path,owner,requests[winner]))).result.id,paid.id);
  assert.equal((await accepted(call(path,owner))).usedDay,requests[winner].day);
  assert.equal((await accepted(call(path,peer))).usedDay,null);
  const tally=await DB.prepare('SELECT COUNT(*) AS count FROM market_rituals WHERE room_code=?').bind(owner.room).first();
  assert.equal(tally.count,1);
});

test('a room offering uses the selected company’s price after earlier room shocks',async t=>{
  const owner=await host(),friend=await join(newGuest(),owner.room);
  await start(owner);
  t.mock.method(crypto,'getRandomValues',array=>array.fill(0));
  const path='/api/rituals',day=gameTime(now).day+1;
  const open=actualTimestamp(gameDayStart(day)+10*3_600_000),later=open+5*60_000;
  const code='MOON';
  const first=(await accepted(call(path,owner,ritualOffer(open,code),open))).result;
  const unaffected=ritualOffer(later,code);
  const priced=ritualOffer(later,code,[first]);
  assert.ok(priced.cost<unaffected.cost);
  assert.equal((await call(path,friend,unaffected,later)).status,400);
  const settled=await accepted(call(path,friend,priced,later));
  assert.equal(settled.result.id,priced.id);
});

test('reset clears my spy archive, desk notices and cooldown without erasing another member’s records',async()=>{
  const owner=await host(),friend=await join(newGuest(),owner.room);
  await start(owner);
  const oldPositions=[{code:'MOON',qty:4,average:10,costKRW:56_000}];
  const sync=positions=>({action:'sync',capturedAt:gameTimestamp(now),positions,trades:[]});
  const roster=session=>accepted(call(desk,session));
  await Promise.all([owner,friend].map(session=>accepted(call(reports,session,sync(oldPositions)))));
  const [mySlot,theirSlot]=(await Promise.all([roster(owner),roster(friend)])).map(roster=>roster.selfSlot);
  const buy=(buyerSlot,target)=>({action:'buy',id:crypto.randomUUID(),room:owner.room,buyerSlot,target,
    assets:2_000_000,available:2_000_000,cost:1_010_000});
  const intimidate=target=>({action:'send',id:crypto.randomUUID(),room:owner.room,target,wealth:5_000_000,
    available:5_000_000,cost:intimidationFee(5_000_000)});
  const mine=buy(mySlot,theirSlot),theirs=buy(theirSlot,mySlot);
  await accepted(call(reports,owner,mine));
  const frozen=await accepted(call(reports,friend,theirs));
  await accepted(call(desk,owner,intimidate(theirSlot)));
  await accepted(call(desk,friend,intimidate(mySlot)));
  const before=await roster(friend);
  // Hold an old portfolio upload after the server starts reading its body.
  // Its write will race both the reset and the first upload from the new game.
  const reading=Promise.withResolvers(),resume=Promise.withResolvers();
  const body=new ReadableStream({async pull(controller){
    reading.resolve();
    await resume.promise;
    controller.enqueue(new TextEncoder().encode(JSON.stringify(sync(oldPositions))));
    controller.close();
  }},{highWaterMark:0});
  const pending=serveGameApi(new Request('https://game.example'+reports,{method:'POST',
    headers:{'Content-Type':'application/json','X-Stall-Room':owner.room,'X-Stall-Guest':owner.guest},
    body,duplex:'half'}),DB,now);
  await reading.promise;
  const reset={previousId:'',resetId:crypto.randomUUID(),resetAt:now};
  await accepted(call('/api/progress/reset',owner,reset));
  const fresh={...owner,progressId:reset.resetId};
  const myDesk=await roster(fresh),theirDesk=await roster(friend);
  assert.equal(myDesk.selfSlot,mySlot);
  assert.deepEqual(myDesk.incoming,[]);
  assert.deepEqual(myDesk.spyNotices,[]);
  assert.equal(myDesk.nextAt,0);
  assert.equal(myDesk.targets.find(t=>t.slot===theirSlot).nextAt,0);
  assert.deepEqual(theirDesk.incoming,before.incoming);
  assert.deepEqual(theirDesk.spyNotices,before.spyNotices);
  assert.equal(theirDesk.nextAt,before.nextAt);
  assert.deepEqual((await accepted(call(reports,fresh))).reports,[]);
  assert.equal((await call(reports+'?id='+mine.id,fresh)).status,404);
  assert.equal((await call(reports+'?before='+mine.id,fresh)).status,404);
  assert.equal((await call(reports,fresh,mine)).status,409);
  assert.deepEqual(await accepted(call(reports+'?id='+theirs.id,friend)),frozen);

  const replacement=buy(mySlot,theirSlot);
  await accepted(call(reports,fresh,replacement));
  await accepted(call(desk,fresh,intimidate(theirSlot)));
  await accepted(call(reports,fresh,sync([])));
  resume.resolve();
  assert.equal((await pending).status,409);
  assert.equal((await call(reports,owner,sync(oldPositions))).status,409);
  const freshReport=await accepted(call(reports,friend,buy(theirSlot,mySlot)));
  assert.deepEqual(freshReport.positions,[]);
  assert.deepEqual((await accepted(call(reports,fresh))).reports.map(r=>r.id),[replacement.id]);
  assert.ok((await roster(fresh)).nextAt>now);
});

test('reset clears only my active ballot and retry preserves the replacement vote and published history',async()=>{
  const owner=await host(),friend=await join(newGuest(),owner.room);
  await start(owner);
  const when=actualTimestamp(gameDayStart(gameTime(now).day+2));
  const read=(session,time)=>accepted(call(elections,session,undefined,time));
  const ballot=(await read(owner,when)).ballot;
  const vote=(candidate,generation)=>({action:'vote',election:ballot.roundId,candidate,generation});
  await accepted(call(elections,owner,vote('conservative',ballot.generation),when));
  await accepted(call(elections,friend,vote('progressive',ballot.generation),when));
  const reset={previousId:'',resetId:crypto.randomUUID(),resetAt:when};
  await accepted(call('/api/progress/reset',owner,reset,when));
  const fresh={...owner,progressId:reset.resetId};
  const after=(await read(fresh,when)).ballot;
  assert.equal(after.ownVote,null);
  assert.equal(after.votes,1);
  assert.equal((await read(friend,when)).ballot.ownVote,'progressive');
  assert.equal((await call(elections,owner,vote('conservative',ballot.generation),when)).status,409);
  await accepted(call(elections,fresh,vote('progressive',after.generation),when));
  await accepted(call('/api/progress/reset',owner,reset,when));
  assert.equal((await read(fresh,when)).ballot.ownVote,'progressive');
  const result=(await read(fresh,ballot.endsAt)).lastResult;
  assert.equal(result.progressive,2);
  const later={previousId:reset.resetId,resetId:crypto.randomUUID(),resetAt:ballot.endsAt};
  await accepted(call('/api/progress/reset',fresh,later,ballot.endsAt));
  assert.deepEqual((await read({...owner,progressId:later.resetId},ballot.endsAt)).lastResult,result);
});
