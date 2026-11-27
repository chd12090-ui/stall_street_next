import {getRoomSession,roomFetch} from './room-session.mjs';
import {articleById,stocks,symbolIndex} from './world.mjs';
import {testFriend} from './test-friends.mjs';
import {reactions} from './friend-threads.mjs';
const api='./api/friends';
export const publishedTime=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'});
const chatDay=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'numeric',day:'numeric'});
const chatDate=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'short',day:'numeric'});
const chatTime=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
let snapshot=null, earlier=[], more=false, revision=0, reading=false, writing=false, notice='', retry=null;
const drafts=new Map();
const draftKey=view=>testFriend(view)?view:'chat';
export const setChatDraft=(value,view)=>drafts.set(draftKey(view),value);
export const chatCode=input=>{
  const code=String(input??'').trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{16}$/.test(code)?code:'';
};

export function communityRoute(id){
  return id==='rank'||id==='chat'||testFriend(id)?id:'';
}

async function requestChat(code='',body=null,before=null){
  const suffix=(code?'/'+code:'')+(before===null?'':'?before='+before);
  const unavailable='채팅방에 연결하지 못했어. 잠시 후 다시 시도해 줘.';
  const signal=AbortSignal.timeout(8000);
  const init=body?{signal,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:
    {signal,cache:'no-store'};
  let result;
  try{result=await roomFetch(api+suffix,init);}
  catch(error){
    if(signal.aborted||error instanceof TypeError)throw new Error(unavailable);
    throw error;
  }
  const value=await result.json().catch(()=>null);
  if(!result.ok||!Array.isArray(value?.messages))throw Object.assign(new Error(value?.error||unavailable),{status:result.status});
  return value;
}

function applyChat(value){
  const roomChanged=value.code!==snapshot?.code;
  const changed=roomChanged||Boolean(notice)||JSON.stringify(value)!==JSON.stringify(snapshot);
  if (roomChanged) { earlier=[]; more=false; retry=null; }
  else if (earlier.length&&value.messages.length){
    const first=value.messages[0].id;
    // If the latest page has moved past the cached page, reload from its new boundary.
    // Global message IDs can have gaps even when no messages in this room are missing.
    if(first>snapshot.messages.at(-1)?.id) { earlier=[]; more=false; }
    else earlier=[...earlier,...snapshot.messages.filter(message=>message.id<first)];
  }
  snapshot=value;
  notice='';
  return {changed,roomChanged};
}

export async function refreshChat(){
  if (reading||writing) return {};
  reading=true;
  const requestRevision=revision;
  try {
    const value=await requestChat();
    return requestRevision===revision ? applyChat(value) : {};
  } catch (error) {
    if (requestRevision!==revision||error.message===notice) return {};
    if(error.status===401){snapshot=null;earlier=[];more=false;retry=null;setChatDraft('');}
    notice=error.message; return {changed:true};
  } finally { reading=false; }
}

export async function changeChat(action,value){
  if (writing) return {};
  revision++;
  writing=true;
  try {
    if (action==='earlier'){
      if (!snapshot?.code) return {};
      const oldest=(earlier.length?earlier:snapshot.messages)[0];
      if (!oldest) return {};
      const old=await requestChat(snapshot.code,null,oldest.id);
      earlier=[...old.messages,...earlier];
      more=old.earlier;
      return {changed:true,older:true};
    }
    if (action==='join'){
      return {...applyChat(await requestChat(value,{action})),joined:true};
    }
    if (!snapshot?.code) applyChat(await requestChat('',{action:'create'}));
    if (action==='create') return {changed:true};
    const identity=JSON.stringify([snapshot.code,value]);
    if (retry?.identity!==identity) retry={identity,nonce:crypto.randomUUID()};
    const result=applyChat(await requestChat(snapshot.code,{action:'send',nonce:retry.nonce,...value}));
    retry=null;
    return {...result,sent:true};
  } catch (error) {
    notice=error.message;
    return {changed:true,error:notice};
  } finally { writing=false; }
}

export function shareTarget(kind,content,state){
  if(kind==='assets') return {kind,content:'',title:'자산 현황',path:'assets',icon:'coin'};
  if(kind==='market') return {kind,content:'',title:'거래소',path:'market',icon:'market'};
  if(kind==='stock'&&Object.hasOwn(symbolIndex,content)) {
    const stock=stocks[symbolIndex[content]];
    return {kind,content,title:stock.name,path:'market/'+content,icon:'market'};
  }
  if(kind==='news'){
    const article=articleById(state,content);
    if(article)return {kind,content,title:article.title,path:'news/paper/'+content,icon:'news'};
  }
  return null;
}

export function previewMessage(message,state,fallback){
  if(!message)return fallback;
  const content=message.kind==='text'
    ? message.content
    : message.kind==='reaction'?reactions[message.content]?.name||'감정표현':(shareTarget(message.kind,message.content,state)?.title||'게임 카드')+' 공유';
  return (message.own?'나 · ':'')+content;
}
export function previewTime(message){
  const date=message?.sentAt;
  if(!Number.isSafeInteger(date))return '';
  const localTime=chatDay.format(date)===chatDay.format(Date.now())?chatTime:chatDate;
  return localTime.format(date);
}
export function groupFallback(){
  if(!snapshot&&!notice)return '채팅방을 확인하고 있어.';
  if(getRoomSession()?.mode==='guest')return '아직 메시지가 없어.';
  return snapshot?.participants>1?'같은 방의 친구와 대화를 시작해 봐.':'초대 링크로 친구와 대화를 시작해 봐.';
}

function otherRoomMembers() {
  return (snapshot?.members??[]).filter(member=>!member.own);
}

export function roomObservers() {
  const room=getRoomSession();
  if(room?.mode!=='multiplayer'||room.code!==snapshot?.code)return [];
  return otherRoomMembers().map(member=>({
    key:'member-'+member.number,name:member.nickname,roomMember:true,rank:null,
  }));
}

// The transport and React views share the same room snapshot and storage keys.
export function readChat(view,invite) {
  const messages=new Map([...earlier,...(snapshot?.messages??[])].map(message=>[message.id,message]));
  return {
    members:otherRoomMembers(),
    participants:snapshot?.participants,
    messages:[...messages.values()].sort((a,b)=>a.id-b.id),
    hasEarlier:earlier.length?more:snapshot?.earlier,
    code:snapshot?.code,joining:Boolean(invite&&invite!==snapshot?.code),
    draft:drafts.get(draftKey(view))??'',notice,
  };
}

let displayUpdate={};
const listeners=new Set();
export const chatUpdate=()=>displayUpdate;
export function subscribeChat(listener) {
  listeners.add(listener);
  return ()=>listeners.delete(listener);
}
function notifyChat(update) {
  displayUpdate=update;
  for(const listener of listeners)listener();
}

export function paintChat(root,invite,update={}) {
  const page=root.querySelector('.friend-chat');
  if(!page || page.dataset.thread!==(testFriend(update.view)?.room??'') ||
      page.dataset.joining!==String(Boolean(invite&&invite!==snapshot?.code)))return false;
  notifyChat({...update});
  return true;
}
let shownMinute=-1;
export function refreshPresence() {
  const minute=Math.floor(Date.now()/60000);
  if(minute!==shownMinute){shownMinute=minute;notifyChat({});}
}
