import test from 'node:test';
import assert from 'node:assert/strict';
import {bindBotThreads,threadRows,sendBotChat,presence,reactions} from '../src/game/friend-threads.mjs';
import {communityRoute,paintChat,refreshChat,shareTarget,subscribeChat} from '../src/game/community.mjs';
import {enterRoom} from '../src/game/room-session.mjs';
import {findFriendProfile, muralRoster, ranking} from '../src/game/league-profile.mjs';
import {testFriends} from '../src/game/test-friends.mjs';
import {botTradingSnapshot} from '../src/game/spy-snapshot.mjs';
import {initial} from '../src/game/market.mjs';
import {actualTimestamp,gameDayStart,gameTime} from '../src/game/clock-calendar.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';
import {bindElectionCalendar,refreshElection,shortcutState,voteInElection} from '../src/game/election.mjs';

const {FriendsPage,FriendRanking,FriendProfileBody,ElectionPage,InviteBody,ShareBody}=await loadJsx(new URL('../src/ui/social.jsx',import.meta.url));
const {HomePage}=await loadJsx(new URL('../src/ui/home.jsx',import.meta.url));
const communityPage=(view,state,invite='')=>renderView(FriendsPage,{view,state,invite});

test('friends retain both sides and timestamps, old messages migrate once and private reactions persist',async()=>{
  const store=new Map(),now=Date.now();
  globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
  store.set('stall-street:sample-chats:1',JSON.stringify({
    'bot-bid':[{kind:'text',content:'저장된 내 메시지',sentAt:now-3600000}],
    'sample-wolru':[{kind:'text',content:'옛 데모',sentAt:now-3600000}],
  }));
  const room='bot-bid',seed=threadRows(room,now),state=initial();
  assert.equal(seed.filter(row=>row.content==='저장된 내 메시지').length,1);
  assert.equal(seed.at(-2).own,true);
  assert.equal(seed.at(-1).own,false);
  assert.equal(presence(seed,now),'1시간 전 접속');
  assert.equal(presence(threadRows('bot-rebound',now),now),'2시간 전 접속');
  assert(!store.has('stall-street:sample-chats:1'));
  assert.deepEqual(threadRows(room,now+1000),seed);
  const before=communityPage('',state);
  assert.doesNotMatch(before,/예시 대화|테스트 봇|정신력|월루대리|급식고래|휴지부자/);
  assert.equal(communityRoute('sample-gorae'),'');
  assert.deepEqual(ranking(state).map(p=>p.key).sort(),['bot-bid','bot-chart','bot-dividend','bot-rebound','bot-scale','self']);
  for(const id of Object.keys(reactions))assert((await sendBotChat(room,{kind:'reaction',content:id},now)).sent);
  const rows=threadRows(room,now);
  assert.equal(rows.length,seed.length+8);
  assert.deepEqual(rows.slice(seed.length).filter(r=>r.own).map(r=>r.content),Object.keys(reactions));
  assert.equal(presence(rows,now),'접속 중');
  assert.equal(presence(rows,now+17*60000),'17분 전 접속');
  const page=communityPage(room,state);
  const buttons=[...page.matchAll(/<button[^>]*data-act="friend-reaction"[^>]*>(.*?)<\/button>/g)];
  assert.deepEqual(buttons.map(match=>match[1]),['응원','축하','유감','조롱']);
  assert(page.indexOf('role="group" aria-label="감정표현"')<page.indexOf('id="friend-chat-compose"'));
  assert(!communityPage('chat',state).includes('저장된 내 메시지'));
  globalThis.localStorage.setItem=()=>{throw Error('quota exceeded');};
  const failed=await sendBotChat(room,{kind:'text',content:'다시 보낼 메시지'},now);
  assert.ok(failed.error);
  assert.ok(!failed.sent);
  assert.deepEqual(threadRows(room,now),rows);
});

test('five bots have independent chat rooms and appear in the settled ranking',async t=>{
  const storage=globalThis.localStorage,values=new Map();
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  t.after(()=>{globalThis.localStorage=storage;});
  const state=initial();
  const waiting=communityPage('',state);
  assert.match(waiting,/data-act="chat-invite" aria-haspopup="dialog">초대하기<\/button>/);
  assert.match(renderView(InviteBody,{}),/data-act="change-room">친구 방 만들러 가기<\/button>/);
  assert.match(waiting,/data-act="friend-rank" aria-haspopup="dialog">순위보기<\/button>/);
  assert.match(waiting,/<section class="friend-chat-list" aria-label="친구 채팅방"><ul aria-label="채팅 목록"><li/);
  assert.doesNotMatch(waiting,/friends-footwashing|friend-podium|친구 메뉴|<h2[^>]*>채팅<\/h2>/);
  const rankView=()=>renderView(FriendRanking,{state});
  const initialRank=rankView();
  assert.match(initialRank,/role="dialog" aria-modal="true" aria-labelledby="dialog-title"/);
  assert.match(initialRank,/<h2 id="dialog-title">손익 순위<\/h2><\/div>/);
  assert.match(initialRank,/<footer[^>]*><button[^>]*data-act="day-summary">하루 정산 보기<\/button><\/footer>/);
  assert.match(initialRank,/<div id="rank-mural" class="rank-mural" role="group"/);
  assert.doesNotMatch(initialRank,/rank-leading|rank-witness |class="rank-list"/);
  assert.equal(initialRank.match(/data-act="friend-profile"/g).length,6);
  assert.match(initialRank,/aria-label="나 프로필, 미정산"[^>]*><span class="rank-caption rank-caption-unsettled"><small>미정산<\/small><strong>나<\/strong>/);
  const actor=(markup,key)=>markup.match(new RegExp('<button[^>]+class="rank-portrait"[^>]+data-value="'+key+'"[^>]*>[\\s\\S]*?<\\/button>'))?.[0]??'';
  const before=ranking(state);
  assert.equal(before.filter(p=>p.rank).length,5);
  assert.equal(before.find(p=>p.me).rank,null);
  assert.match(actor(initialRank,before.filter(p=>p.rank).at(-1).key),/data-role="washer" data-rank="5"/);
  assert.match(actor(initialRank,'self'),/data-role="witness"/);
  assert.equal(testFriends.length,5);
  const now=Date.now();
  for(const friend of testFriends){
    assert.equal(communityRoute(friend.room),friend.room);
    assert.ok(waiting.includes('data-tab="league/'+friend.room+'"'));
    const message='주문 기록 확인 '+friend.name;
    assert.ok((await sendBotChat(friend.room,{kind:'text',content:message},now)).sent);
    assert.equal(threadRows(friend.room).at(-2).content,message);
    assert.ok(threadRows(friend.room).at(-1).content);
    assert.ok(botTradingSnapshot(friend,now).positions.every(p=>Number.isFinite(p.costKRW)));
  }
  state.history.push({day:state.day,gains:1_000_000});
  const current=ranking(state);
  assert.equal(current.length,6);
  assert.ok(current.every(p=>Number.isFinite(p.profit)&&Number.isInteger(p.rank)));
  const settled=rankView();
  assert.match(settled,/<p>Day [0-9]+ 마감 기준<\/p>/);
  for(const [index,person] of current.entries()){
    const button=actor(settled,person.key);
    assert.ok(button.includes('<small>'+person.rank+'위</small><strong>'+person.name+'</strong>'));
    if(index===0||index===current.length-1){
      assert.ok(button.includes('data-role="'+(index===0?'winner':'washer')+'"'));
    }else{
      assert.match(button,/data-role="witness"/);
    }
  }
  state.history[0].gains=Math.max(...current.filter(p=>!p.me).map(p=>p.profit));
  const tied=rankView();
  assert.equal((tied.match(/<small>공동 1위<\/small>/g)||[]).length,2);
  assert.equal((tied.match(/data-role="winner"/g)||[]).length,1);
  assert.equal((tied.match(/data-rank="1"/g)||[]).length,2);
  state.history[0].gains=current.filter(p=>!p.me)[3].profit;
  const skipped=rankView();
  assert.match(actor(skipped,current.at(-1).key),/data-role="washer" data-rank="6"/);
  assert.equal(skipped.match(/data-act="friend-profile"/g).length,current.length);
  state.history[0].gains=current.at(-1).profit;
  const tiedLast=rankView();
  assert.equal((tiedLast.match(/<small>공동 5위<\/small>/g)||[]).length,2);
  assert.equal((tiedLast.match(/data-role="washer" data-rank="5"/g)||[]).length,1);
});

test('an asset share shows the same three amounts before sending and in restored private chat',async t=>{
  const {localStorage:previous}=globalThis,values=new Map();
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  t.after(()=>{globalThis.localStorage=previous;});
  const state=initial(),room='bot-bid';
  const totals={amount:5_007_692,assetsTotal:5_018_093,debtTotal:10_401};
  const target=shareTarget('assets','',state);
  const confirmation=renderView(ShareBody,{modal:{target,assetTotals:totals}});
  const sent=await sendBotChat(room,{kind:target.kind,content:target.content,...totals});
  assert.ok(sent.sent);
  assert.deepEqual(Object.fromEntries(Object.keys(totals).map(key=>[key,threadRows(room).at(-2)[key]])),totals);
  const oldShare=await sendBotChat(room,{kind:'assets',content:'',amount:250_000});
  assert.ok(oldShare.sent);
  const thread=communityPage(room,state);
  for(const html of [confirmation,thread]){
    assert.match(html,/내 순자산<\/small><b>5,007,692원<\/b>/);
    assert.match(html,/자산 합계<\/small><b>5,018,093원<\/b>/);
    assert.match(html,/갚을 돈 합계<\/small><b>10,401원<\/b>/);
  }
  assert.match(thread,/공유한 시점의 순자산<\/small><b>250,000원<\/b>/);
});

test('the chat list shows every other room member before anyone sends a message',async t=>{
  const storage=globalThis.localStorage;
  const values=new Map();
  globalThis.localStorage={
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,value),
    removeItem:key=>values.delete(key),
  };
  t.after(()=>{globalThis.localStorage=storage;});
  const code='ABCD2345EFGH6789';
  const members=[{number:1,nickname:'테스트 방장',own:true}];
  t.mock.method(globalThis,'fetch',async url=>Response.json(url==='./api/rooms'
    ? {code,nickname:members[0].nickname,mode:'multiplayer',host:true,started:true,participants:1}
    : {code,participants:members.length,members,messages:[],earlier:false}));
  await enterRoom({action:'create'});
  const previousLocation=globalThis.location;
  globalThis.location=new URL('https://game.example/#league');
  t.after(()=>{globalThis.location=previousLocation;});
  const invite=renderView(InviteBody,{});
  assert.ok(invite.includes('value="https://game.example/?room='+code+'"'));
  assert.match(invite,/data-act="chat-copy">초대 링크 복사<\/button>/);
  await refreshChat();

  // Simulate the list already being open when guests join the room.
  const state=initial();
  const before=communityPage('',state);
  assert.doesNotMatch(before,/방 참가자|data-chat-member|테스트 방장/);
  const ledByPlayer={...state,history:[{day:state.day,gains:1_000_000}]};
  assert.match(renderView(FriendRanking,{state:ledByPlayer}),/<small>1위<\/small><strong>테스트 방장<\/strong>/);
  const page={dataset:{thread:'',joining:'false'}};
  const root={querySelector:()=>page};
  let updates=0;
  const unsubscribe=subscribeChat(()=>updates++);
  t.after(unsubscribe);
  for(let number=2;number<=10;number++)members.push({number,nickname:'친구 '+number,own:false});
  members[1].nickname='친구<하나>';
  assert.equal((await refreshChat()).changed,true);
  assert.equal(paintChat(root,''),true);
  assert.equal(updates,1);
  const after=communityPage('',state);
  assert.equal(after.match(/<li data-chat-member=""/g).length,9);
  assert.match(after,/친구&lt;하나&gt;/);
  assert.match(after,/친구 10/);
  assert.match(after,/data-tab="league\/chat"/);
  assert.match(after,/data-tab="league\/bot-bid"/);
  assert.doesNotMatch(after,/방 참가자|테스트 방장/);
  const roster=muralRoster(ledByPlayer);
  assert.equal(roster.length,15);
  assert.equal(roster.filter(p=>p.roomMember).length,9);
  assert.deepEqual(roster.filter(p=>p.rank).map(p=>p.key),ranking(ledByPlayer).map(p=>p.key));
  assert(!roster.some(p=>p.key==='member-1'));
  const visitor=findFriendProfile(ledByPlayer,'member-2');
  assert.equal(visitor.name,'친구<하나>');
  assert.equal(visitor.rank,null);
  const galleryPages=[0,1].map(initialPage=>renderView(FriendRanking,{state:ledByPlayer,initialPage}));
  assert.match(galleryPages[0],/data-witness-page="0"/);
  assert.match(galleryPages[1],/data-witness-page="1"/);
  assert.equal(galleryPages[0].match(/data-act="friend-profile"/g).length,10);
  assert.equal(galleryPages[1].match(/data-act="friend-profile"/g).length,7);
  for(const guest of roster.filter(person=>person.roomMember)){
    assert.equal(galleryPages.filter(page=>page.includes('data-value="'+guest.key+'"')).length,1);
  }
  const profile=renderView(FriendProfileBody,{state:ledByPlayer,person:visitor});
  assert.match(profile,/참관/);
  assert.match(profile,/data-tab="league\/chat"/);
  assert.doesNotMatch(profile,/순자산|누적 투자 손익|friend-reaction/);
});

test('friend subpages use the shared back control and link to their parent',()=>{
  const state=initial();
  const chatHome=/class="detail-back"[^>]*aria-label="채팅 목록으로"[^>]*data-tab="league"/;
  for(const view of ['chat','bot-bid','bot-rebound']){
    assert.match(communityPage(view,state),chatHome,view);
  }
  assert.match(renderView(FriendRanking,{state}),/data-act="dismiss" aria-label="순위 닫기"/);
  assert.equal(communityRoute('rank'),'rank');
  for(const oldView of ['archive','board-spread','saved-post-57']){
    assert.equal(communityRoute(oldView),'');
    assert.equal(communityPage(oldView,state),communityPage('',state));
  }
});


test('the React ballot shows the live candidates, records a vote and restores the saved choice',async t=>{
  const now=Date.UTC(2026,10,23,3),{day}=gameTime(now);
  t.mock.method(Date,'now',()=>now);
  const at=date=>actualTimestamp(gameDayStart(date));
  const start=at(day),roundId=start+10_000;
  const rows={openingDay:day-2,ballot:{startsAt:start,endsAt:at(day+2),roundId,number:1,ownVote:null,votes:0},
    terms:[],lastResult:null,history:[],nextNumber:2,nextStartsAt:at(day+14),nextEndsAt:at(day+16)};
  const previous=globalThis.localStorage,values=new Map();
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  t.after(()=>{globalThis.localStorage=previous;});
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    if(url==='./api/rooms')return Response.json({code:'ABCD2345EFGH6789',nickname:'유권자',mode:'guest',host:true,started:true,participants:1});
    assert.equal(url,'./api/elections');
    assert.equal(options.headers.get('X-Stall-Opening-Day'),String(day-2));
    if(options.method==='POST'){
      const vote=JSON.parse(options.body);
      assert.equal(vote.election,roundId);
      rows.ballot.ownVote=vote.candidate;
      rows.ballot.votes++;
    }
    return Response.json(rows);
  });
  await enterRoom({action:'guest'});
  const state={...initial(),day,openingDay:day-2,clockMode:'kst'},page=()=>renderView(ElectionPage,{state});
  const home=()=>renderView(HomePage,{state,options:{}});
  const voteDue=/data-tab="election"[^>]*data-today-action=""/;
  bindElectionCalendar(state);
  assert.doesNotMatch(home(),voteDue);
  await refreshElection();
  assert.match(home(),voteDue);
  assert.equal(page().match(/data-act="election-vote"/g).length,2);
  assert.match(page(),/aria-label="기호 1">1<\/span><h3>조현덕<\/h3>.*?aria-label="조현덕에게 한 표" data-act="election-vote" data-value="progressive"/);
  assert.match(page(),/aria-label="기호 2">2<\/span><h3>윤준오<\/h3>.*?aria-label="윤준오에게 한 표" data-act="election-vote" data-value="conservative"/);
  assert.match(page(),/후보 공약<\/summary>.*?조현덕 <span>진보<\/span>.*?윤준오 <span>보수<\/span>/);
  assert.match(page(),/<h1>제 1대 대통령 선거<\/h1>/);
  assert.match(page(),/>Day 3<\/time> ~ <time[^>]+>Day 4<\/time>/);
  assert.doesNotMatch(page(),/>Day 5<\/time> 결과 공표/);
  assert.match(page(),/class="election-paper".*class="election-ballot-box".*<h2>투표함<\/h2>/);
  assert.match(page(),/aria-label="선거 화면 닫기"><i class="ico i-close"/);
  const historyPanel=()=>page().match(/<details class="election-history">(.*?)<\/details>/)?.[1];
  assert.match(historyPanel(),/^<summary(?: [^>]*)?>이전 선거<\/summary><section class="election-presidency"><span>현 정부<\/span><b>공석<\/b><\/section><p[^>]+>첫 선거 결과 공표 대기<\/p>$/);
  assert.equal((page().match(/class="election-presidency"/g)||[]).length,1);
  assert.match(page(),/선거 규칙<\/summary>.*<details class="election-history">/);
  assert.equal(shortcutState(now).caption,'D-1');
  assert.ok((await voteInElection('progressive')).stamped);
  await refreshElection();
  assert.doesNotMatch(home(),voteDue);
  assert.match(page(),/내가 투표한 후보 · 조현덕/);
  assert.doesNotMatch(page(),/data-act="election-vote"/);
  rows.lastResult={number:1,startsAt:start,endsAt:at(day+2),progressive:1,conservative:0,winner:'progressive'};
  rows.history=[rows.lastResult];
  rows.terms=[{candidate:'progressive',effectiveAt:at(day+2)}];
  rows.publishedToday=true;
  rows.ballot=null;
  await refreshElection();
  assert.match(page(),/<h1>제 1대 대통령 선거<\/h1>/);
  assert.match(historyPanel(),/현 정부<\/span><b[^>]+>조현덕 대통령\(시민미래당\)<\/b>.*?조현덕 당선.*?조현덕<\/dt><dd>1표.*?윤준오<\/dt><dd>0표/);
  assert.match(page(),/결과 공표<\/span><p[^>]+><time[^>]+>Day 5<\/time>/);
  rows.publishedToday=false;
  await refreshElection();
  assert.match(page(),/<h1>제 2대 대통령 선거<\/h1>/);
  assert.match(page(),/>Day 17<\/time> ~ <time[^>]+>Day 18<\/time>/);
  assert.doesNotMatch(page(),/최근 개표|위에 표시된 이틀|\d+월 \d+일|[월화수목금토일]요일|\d{2}:\d{2}|KST/);
  assert.equal(shortcutState(now).caption,'D-14');
  assert.doesNotMatch(home(),voteDue);
  // A late joiner or a member who restarted sees the shared vote in their own Day labels.
  const otherCalendar=renderView(ElectionPage,{state:{...state,openingDay:day}});
  assert.match(otherCalendar,/>Day 15<\/time> ~ <time[^>]+>Day 16<\/time>/);
  assert.match(otherCalendar,/내 게임 시작일 기준/);
});


test('resetting the practice conversations drops the old transcript and rejects a queued send from that run',async t=>{
  const data=new Map(),storage=globalThis.localStorage;
  globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  t.after(()=>{globalThis.localStorage=storage;});
  const room='bot-bid',before=crypto.randomUUID(),after=crypto.randomUUID();
  bindBotThreads({resetId:before,roomProgressId:before});
  await sendBotChat(room,{kind:'text',content:'예전 게임에서 보낸 메시지'});
  let pending;
  const locks=Object.getOwnPropertyDescriptor(navigator,'locks');
  Object.defineProperty(navigator,'locks',{configurable:true,value:{request:(_,callback)=>new Promise(resolve=>{pending=()=>resolve(callback());})}});
  t.after(()=>{if(locks)Object.defineProperty(navigator,'locks',locks);else delete navigator.locks;});
  const delayed=sendBotChat(room,{kind:'text',content:'늦게 도착한 메시지'});
  bindBotThreads({resetId:after,roomProgressId:after});
  pending();
  assert.equal((await delayed).sent,undefined);
  assert.equal(threadRows(room).some(row=>row.content.includes('메시지')),false);
  assert.equal([...data.values()].some(value=>value.includes('예전 게임에서 보낸 메시지')),false);
});
