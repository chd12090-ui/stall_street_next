import React, {Component, createRef, useSyncExternalStore} from 'react';
import {readChat, subscribeChat, chatUpdate, groupFallback, shareTarget, previewMessage, previewTime, publishedTime} from '../game/community.mjs';
import {getRoomSession, roomInviteUrl} from '../game/room-session.mjs';
import {threadRows, presence, reactions} from '../game/friend-threads.mjs';
import {testFriend, testFriends} from '../game/test-friends.mjs';
import {ranking, muralRoster, badge, signed, color, rate, weekRecords, won} from '../game/league-profile.mjs';
import {dayLabel} from '../game/clock-calendar.mjs';
import {characterPose,characterPoses} from '../game/player-character.mjs';
import {Icon} from './controls.jsx';
export {ElectionPage} from './social-election.jsx';

const faceBounds={
  1:'-2 11 88 88',2:'-2 22 88 88',3:'-4 44 88 88',
  4:'8 9 100 100',5:'60 67 88 88',6:'84 32 88 88',
};
function FriendCat({standing,state,className}) {
  const rank=standing?.rank;
  const pose=standing?.me?characterPose(state.mental):characterPoses[rank>=1&&rank<=3?rank-1:1];
  return <svg className={className} viewBox={faceBounds[pose.id]} preserveAspectRatio="xMidYMax meet"
    shapeRendering="crispEdges" aria-hidden="true" focusable="false">
    <use href={'/art/player/pose-'+pose.id+'.svg#cat'}/>
  </svg>;
}
function ChatAvatar({standing,room=false}) {
  if (room) return <span className="friend-chat-group-icon" aria-hidden="true"><Icon name="users" /></span>;
  return <span className="community-person-icon" aria-hidden="true"><FriendCat standing={standing} className="community-avatar"/></span>;
}
function Reactions({room}) {
  return <div className="chat-reactions" role="group" aria-label="감정표현">
    {Object.entries(reactions).map(([id,{name}])=><button key={id} type="button" className="ui-control"
      data-act="friend-reaction" data-room={room} data-value={id}>{name}</button>)}
  </div>;
}
function InviteButton() {
  return <button type="button" className="ui-control ui-compact" data-act="chat-invite" aria-haspopup="dialog">초대하기</button>;
}
function ChatRow({person,standing,messages,state}) {
  const room=person?.room??'chat', latest=messages.at(-1), time=previewTime(latest);
  return <li><button type="button" className="friend-chat-row" data-act="tab" data-tab={'league/'+room} aria-describedby={'chat-preview-'+room}>
    <ChatAvatar standing={standing} room={!person} />
    <span className="friend-chat-row-copy"><strong>{person?.name??'친구방'}</strong><span id={'chat-preview-'+room} data-chat-group-preview={person?undefined:''}>
      {previewMessage(latest,state,person?'':groupFallback())}</span></span>
    <span className="friend-chat-row-time" data-chat-group-time={person?undefined:''} data-presence={person?.room}>
      {person?presence(messages):time?<time dateTime={new Date(latest.sentAt).toISOString()}>{time}</time>:null}
    </span>
  </button></li>;
}
function ChatList({chat, state}) {
  const people=ranking(state);
  return <>
    <header className="view-heading"><h1>친구</h1><div className="friend-chat-actions"><InviteButton />
      <button type="button" className="ui-control ui-compact" data-act="friend-rank" aria-haspopup="dialog">순위보기</button>
    </div></header>
    <p className="friend-chat-notice" role="status">{chat.notice}</p>
    <section className="friend-chat-list" aria-label="친구 채팅방">
      <ul aria-label="채팅 목록">
      <ChatRow messages={chat.messages} state={state} />
      {chat.members.map(member=><li key={member.number} data-chat-member=""><div className="friend-chat-row">
        <ChatAvatar/><span className="friend-chat-row-copy"><strong>{member.nickname}</strong></span>
      </div></li>)}
      {testFriends.map(friend=><ChatRow key={friend.room} person={friend} standing={people.find(p=>p.key===friend.room)}
        messages={threadRows(friend.room)} state={state} />)}
      </ul>
    </section>
  </>;
}
function ShareAmounts({amount,assetsTotal,debtTotal,own=false}){
  if(!Number.isSafeInteger(amount))return null;
  if(!Number.isSafeInteger(assetsTotal)||!Number.isSafeInteger(debtTotal)){
    return <><small>공유한 시점의 순자산</small><b>{won(amount)}</b></>;
  }
  return <span className="friend-chat-asset-totals">
    <span><small>{own?'내 순자산':'순자산'}</small><b>{won(amount)}</b></span>
    <span><small>자산 합계</small><b>{won(assetsTotal)}</b></span>
    <span><small>갚을 돈 합계</small><b>{won(debtTotal)}</b></span>
  </span>;
}

function Message({message, person, state}) {
  const sender=message.own?'나':person?.name||message.senderName||'친구 '+Number(message.sender);
  const reaction=message.kind==='reaction'&&Object.hasOwn(reactions,message.content)?reactions[message.content]:null;
  const card=shareTarget(message.kind,message.content,state);
  return <article className={'friend-chat-message'+(message.own?' own':'')}>
    <div className="friend-chat-byline"><strong>{sender}</strong>{Number.isSafeInteger(message.sentAt)&&<time>{publishedTime.format(message.sentAt)}</time>}</div>
    {reaction?<p className="friend-chat-bubble friend-chat-reaction"><Icon name={reaction.icon} /><b>{reaction.name}</b></p>
      :card?<button type="button" className="friend-chat-card" data-act="tab" data-tab={card.path}><Icon name={card.icon} />
        <span className="friend-chat-card-copy"><strong>{card.title}</strong>
          {message.kind==='assets'&&<ShareAmounts {...message}/>}</span></button>
      :<p className="friend-chat-bubble">{message.kind==='text'?message.content:'공유한 항목을 확인할 수 없어.'}</p>}
  </article>;
}

// Read scroll geometry before React commits the older messages above the viewport.
class Transcript extends Component {
  log=createRef();
  componentDidMount() { this.log.current.scrollTop=this.log.current.scrollHeight; }
  getSnapshotBeforeUpdate() {
    const log=this.log.current;
    return {height:log.scrollHeight,top:log.scrollTop,atEnd:log.scrollHeight-log.scrollTop-log.clientHeight<80};
  }
  componentDidUpdate(previous,unused,before) {
    const log=this.log.current, {update}=this.props;
    if (update!==previous.update&&update.older) log.scrollTop=before.top+log.scrollHeight-before.height;
    else if (before.atEnd||(update!==previous.update&&(update.sent||update.reset))) log.scrollTop=log.scrollHeight;
  }
  render() {
    const {rows,person,state,hasEarlier}=this.props;
    return <div className="friend-chat-log" role="log" aria-label={(person?.name??'친구')+' 채팅 메시지'} aria-live="polite" tabIndex={0} ref={this.log}>
      {hasEarlier&&<button className="friend-chat-older ui-control ui-compact" data-act="chat-earlier">이전 메시지</button>}
      {rows.length?rows.map((message,index)=><Message key={message.id??index} message={message} state={state} person={person} />)
        :!person&&<p className="friend-chat-empty">{groupFallback()}</p>}
    </div>;
  }
}
function ChatThread({person, chat, invite, state, update}) {
  const rows=person?threadRows(person.room):chat.messages;
  const standing=person&&ranking(state).find(p=>p.key===person.room);
  return <>
    <header className="view-heading friend-chat-thread-heading"><div className="detail-title friend-chat-thread-title">
      <button type="button" className="detail-back" aria-label="채팅 목록으로" data-act="tab" data-tab="league"><Icon name="down" /></button>
      {!chat.joining&&<ChatAvatar standing={standing} room={!person} />}
      <div className="friend-chat-thread-name"><h1>{chat.joining?'채팅방 초대':person?.name||'친구방'}</h1>
        {!chat.joining&&(person?<small data-presence={person.room}>{presence(rows)}</small>
          :<small data-chat-members="">{Number.isInteger(chat.participants)?chat.participants+'명':''}</small>)}</div>
    </div>{!chat.joining&&!person&&<InviteButton />}</header>
    <p className="friend-chat-notice" role="status">{person?'':chat.notice}</p>
    {chat.joining?<section className="friend-chat-entry"><p>참여하면 같은 방의 친구들과 메시지를 나눌 수 있어.</p>
      <button className="btn primary ui-control ui-primary full" data-act="chat-join" data-value={invite}>채팅방 참여</button></section>:<>
      <Transcript rows={rows} person={person} state={state} update={update} hasEarlier={!person&&chat.hasEarlier} />
      {person&&<Reactions room={person.room} />}
      <form id="friend-chat-compose" className="friend-chat-form"><label className="friend-chat-access" htmlFor="friend-chat-input">메시지</label>
        <textarea id="friend-chat-input" name="message" rows={1} maxLength={600} required placeholder="메시지 입력" enterKeyHint="send" defaultValue={chat.draft} />
        <button className="btn primary ui-control ui-primary" type="submit">전송</button>
      </form></>}
  </>;
}
export function FriendsPage({state, view='', invite=''}) {
  const update=useSyncExternalStore(subscribeChat,chatUpdate,chatUpdate);
  const person=testFriend(view), chat=readChat(view,invite);
  const lobby=!person&&view!=='chat'&&!chat.joining;
  return <div className={'community-page friend-chat friends-club'+(lobby?' friend-lobby':'')} data-joining={String(chat.joining)} data-thread={person?.room||''}>
    {lobby?<ChatList state={state} chat={chat} />:<ChatThread key={view} state={state} chat={chat} person={person} invite={invite} update={update} />}
  </div>;
}

function closingStamp(state) {
  const last=weekRecords(state).at(-1);
  return last?dayLabel(state,last.day)+' 마감 기준':null;
}
const standingName=person=>person.me?(getRoomSession()?.nickname||person.name):person.name;
// Head positions in the 144 × 216 painting. The eight witnesses are
// already part of the scene, including seats without a player.
const witnessHeads=[
  [29,56], [72,52], [109,55],
  [49,72], [91,82], [126,85],
  [19,90], [18,115],
];

function muralProfiles(people,requestedPage){
  const winner=people.find(person=>person.rank===1);
  const washer=people.findLast(person=>person.rank!=null&&person!==winner);
  const observers=people.filter(person=>person!==winner&&person!==washer);
  const capacity=witnessHeads.length;
  const pages=Math.max(1,Math.ceil(observers.length/capacity));
  const page=Math.max(0,Math.min(requestedPage,pages-1));
  const seats=observers.slice(page*capacity,(page+1)*capacity).map((person,index)=>{
    const [x,y]=witnessHeads[index];
    return {person,role:'witness',x,y};
  });
  if(winner)seats.push({person:winner,role:'winner',x:118,y:110});
  if(washer)seats.push({person:washer,role:'washer',x:53,y:123});
  const unranked=people.length+1;
  seats.sort((a,b)=>(a.person.rank??unranked)-(b.person.rank??unranked));
  return {seats,page,pages};
}
function MuralPerson({seat}){
  const {person,role,x,y}=seat,name=standingName(person),place=person.rank?badge(person):person.roomMember?'참관':'미정산';
  const unsettled=person.rank==null&&!person.roomMember;
  const description=name+' 프로필, '+place+(person.rank?', 손익 '+signed(person.profit):'');
  return <button type="button" className="rank-portrait" data-role={role} data-rank={person.rank??undefined} style={{'--head-x':x,'--head-y':y}}
    data-act="friend-profile" data-value={person.key} aria-haspopup="dialog" aria-label={description} title={description}>
    <span className={'rank-caption'+(unsettled?' rank-caption-unsettled':'')}>
      {(person.rank||unsettled)&&<small>{place}</small>}<strong>{name}</strong>
    </span>
  </button>;
}
export function FriendRanking({state,initialPage=0}) {
  const [requestedPage,setPage]=React.useState(initialPage);
  const stamp=closingStamp(state);
  useSyncExternalStore(subscribeChat,chatUpdate,chatUpdate);
  const {seats,page,pages}=muralProfiles(muralRoster(state),requestedPage);
  return <section className="sheet friend-ranking" data-witness-page={page} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
    <div className="friend-gallery">
      <header className="friend-ranking-head"><div><h2 id="dialog-title">손익 순위</h2>{stamp&&<p>{stamp}</p>}</div>
        <button type="button" className="ui-control ui-icon ui-compact" data-act="dismiss" aria-label="순위 닫기"><Icon name="close"/></button>
      </header>
      <div id="rank-mural" className="rank-mural" role="group" aria-label="순위별 고양이 프로필">
        {seats.map(seat=><MuralPerson key={seat.person.key} seat={seat}/>)}
      </div>
      <footer className="friend-ranking-actions"><button type="button" className="ui-control ui-compact" data-act="day-summary">하루 정산 보기</button>
        {pages>1&&<nav className="rank-pager" aria-label="구경꾼 페이지">
          <button type="button" className="ui-control ui-compact" aria-label="이전 구경꾼" aria-controls="rank-mural" disabled={page===0} onClick={()=>setPage(page-1)}>‹</button>
          <span aria-live="polite">{page+1} / {pages}</span>
          <button type="button" className="ui-control ui-compact" aria-label="다음 구경꾼" aria-controls="rank-mural" disabled={page===pages-1} onClick={()=>setPage(page+1)}>›</button>
        </nav>}
      </footer>
    </div>
  </section>;
}
export function FriendProfileBody({state, person:p}) {
  if (!p) return null;
  const stamp=p.rank&&closingStamp(state);
  return <div className="member-profile friend-card"><div className="member-ident"><span className="member-avatar"><FriendCat standing={p} state={state}/></span>
    <div><span>{p.me?'내 계정':'친구'}</span><b>{p.rank?badge(p):p.roomMember?'참관':'순위 집계 전'}</b>{stamp&&<span>{stamp}</span>}</div></div>
    {p.rank?<dl className="member-stats friend-stats"><div><dt>순자산</dt><dd>{won(p.assets)}</dd></div><div><dt>갚을 돈 <small>(이자 포함)</small></dt><dd>{won(p.debt)}</dd></div>
      <div><dt>누적 투자 손익</dt><dd className={color(p.profit)}>{signed(p.profit)}</dd></div>
      <div><dt>초기 자금 대비 수익률</dt><dd className={color(p.profit)}>{rate(p.profit)}</dd></div></dl>
      :!p.roomMember&&<p className="friend-no-snapshot">이번 주 첫 자정 정산 뒤에 자산과 수익률이 공개돼.</p>}
    {p.roomMember&&<button className="btn light ui-control full" data-act="tab" data-tab="league/chat">친구방 열기</button>}
    {!p.me&&!p.roomMember&&<><Reactions room={p.key} /><button className="btn light ui-control full" data-act="tab" data-tab={'league/'+p.key}>채팅 열기</button></>}
  </div>;
}
export function InviteBody() {
  const room=getRoomSession();
  if(room?.mode!=='multiplayer')return <>
    <p className="sheet-intro">친구와 함께할 방을 만들면 초대 링크를 보낼 수 있어.</p>
    <button type="button" className="btn primary ui-control ui-primary full" data-act="change-room">친구 방 만들러 가기</button>
  </>;
  return <><p className="sheet-intro">친구에게 링크를 보내면 같은 게임 방에 참가할 수 있어.</p>
    <label className="friend-chat-invite-url">초대 링크<input type="url" id="chat-invite-url" value={roomInviteUrl(room.code)} readOnly /></label>
    <button className="btn primary ui-control ui-primary full" data-act="chat-copy">초대 링크 복사</button></>;
}
export function ShareBody({modal}) {
  const {target, pending, assetTotals, recipient, error}=modal;
  return <><div className="friend-chat-card"><Icon name={target.icon} />
    <span className="friend-chat-card-copy"><strong>{target.title}</strong>{assetTotals&&<ShareAmounts {...assetTotals} own/>}</span></div>
    <label className="friend-chat-recipient">받는 곳 <select className="ui-control ui-select" id="chat-share-recipient" disabled={pending} defaultValue={recipient||''}>
      <option value="">친구 채팅방</option>{testFriends.map(p=><option key={p.room} value={p.room}>{p.name}</option>)}</select></label>
    {error&&<p className="friend-chat-notice" role="status">{error}</p>}
    <button className="btn primary ui-control ui-primary full" data-act="chat-send-share" disabled={pending}>{pending?'전송 중':'채팅으로 보내기'}</button></>;
}
