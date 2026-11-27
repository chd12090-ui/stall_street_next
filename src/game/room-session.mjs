import {displayNickname,validNickname,nicknameHint} from './nickname.mjs';
import {finishDeskCharge} from './desk-charges.mjs';
import {lastGuidePage} from './field-guide-model.mjs';
import {gameApiFetch} from '../storage/game-api-client.mjs';

const prefix='stall-street:guest:1:';
const guestKey=prefix+'identity', currentKey=prefix+'room';
const guestPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
let activeRoom=null,activeGuest=null,activeScope='',progressId='';
// A restored local room is allowed offline. Only a live server response can
// establish which run the member now owns when an older local save returns.
let confirmedProgressId;
export const getConfirmedRoomProgressId=()=>confirmedProgressId;
export function setRoomProgressId(id){progressId=id||'';}

function read(storage,key){
  try{return globalThis[storage]?.getItem(key);}catch{return null;}
}
function put(storage,key,value){
  try{
    if(!globalThis[storage])return false;
    if(value===null)globalThis[storage].removeItem(key);
    else globalThis[storage].setItem(key,value);
    return true;
  }catch{return false;}
}

export const gameSaveBase='stall-street:pixel-week:1';
export function roomSoundEnabled(){
  try{return JSON.parse(read('localStorage',roomStorageKey(gameSaveBase)))?.sound!==false;}
  catch{return true;}
}
const guideBase='stall-street:field-guide:v2';
const guideMemory=new Map();

export function guideRunKey(){
  let saved;
  try{saved=JSON.parse(read('localStorage',roomStorageKey(gameSaveBase)));}catch{}
  // An offline reset can be newer than the room server. Its pending reset owns this launch.
  const localRun=saved?.roomProgressId||saved?.resetId;
  const run=(saved?.roomProgressResets?.length?localRun:confirmedProgressId||localRun)||'initial';
  const key=roomStorageKey(guideBase)+':'+run;
  // Only an existing initial save can inherit the old device-wide completion flag.
  const legacy='stall-street:field-guide:v1';
  if(run==='initial'&&saved&&getGuideProgress(key)===null&&(read('localStorage',legacy)||read('sessionStorage',legacy)))saveGuideProgress('done',key);
  return key;
}
const isGuidePage=page=>Number.isInteger(page)&&page>=0&&page<=lastGuidePage;

function guideValues(key){
  return [read('localStorage',key),read('sessionStorage',key),guideMemory.get(key)];
}
export function getGuideCheckpoint(key=guideRunKey()){
  const legacy=guideValues(key);
  if(legacy.includes('done'))return 'done';
  for(const value of guideValues(key+':practice')){
    if(!value)continue;
    try{
      const record=JSON.parse(value);
      if(isGuidePage(record?.page))return record;
    }catch{}
  }
  const page=legacy.find(value=>/^[0-2]$/.test(value));
  return page===undefined?null:{page:Number(page),practice:null};
}
export function getGuideProgress(key=guideRunKey()){
  const record=getGuideCheckpoint(key);
  return record==='done'?'done':record?.page??null;
}
export function saveGuideProgress(page,key=guideRunKey(),practice=null){
  if(page!=='done'&&!isGuidePage(page))return;
  const draftKey=key+':practice';
  if(page==='done'){
    // Independently mark completion so a simultaneous draft from another tab cannot undo it.
    guideMemory.set(key,'done');
    guideMemory.delete(draftKey);
    for(const store of ['localStorage','sessionStorage']){
      put(store,key,'done');
      put(store,draftKey,null);
    }
  }else if(!guideValues(key).includes('done')){
    const draft=JSON.stringify({page,practice});
    guideMemory.set(draftKey,draft);
    for(const store of ['localStorage','sessionStorage'])put(store,draftKey,draft);
  }
}
function locked(key,callback){
  return globalThis.navigator?.locks?navigator.locks.request(key,callback):callback();
}

export function normalizeRoomCode(input){
  const code=String(input??'').replace(/[\s-]/g,'').toUpperCase();
  return /^[A-HJ-NP-Z2-9]{16}$/.test(code)?code:'';
}
function getGuest(){
  return read('localStorage',guestKey)||read('sessionStorage',guestKey);
}
function ensureGuest(){
  return locked(guestKey,()=>{
    const current=activeGuest||getGuest();
    if(guestPattern.test(current))return current;
    const id=crypto.randomUUID();
    if(!put('localStorage',guestKey,id)&&!put('sessionStorage',guestKey,id)){
      throw new Error('게스트 정보를 보관하려면 이 사이트의 브라우저 저장 공간을 허용해 줘.');
    }
    return id;
  });
}
function parseRoom(raw){
  try{
    const data=JSON.parse(raw);
    if(!data?.code||data.code!==normalizeRoomCode(data.code))return null;
    return {
      code:data.code,nickname:displayNickname(data.nickname),
      mode:data.mode==='guest'?'guest':'multiplayer',
      host:data.host===true,started:data.started===true,
      participants:Number.isSafeInteger(data.participants)&&data.participants>0?data.participants:1,
    };
  }catch{}
  return null;
}
async function guestScope(guest){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(guest));
  return Array.from(new Uint8Array(digest,0,12),byte=>byte.toString(16).padStart(2,'0')).join('');
}
async function rememberRoom(value,guest,previousRoom=null){
  const room=parseRoom(JSON.stringify(value));
  if(!room)throw new Error('방 정보를 확인하지 못했어. 다시 시도해 줘.');
  const scope=await guestScope(guest);
  if(previousRoom&&activeRoom!==previousRoom)return activeRoom;
  const raw=JSON.stringify({...room,scope});
  const saved=put('localStorage',currentKey,raw);
  if(!put('sessionStorage',currentKey,raw)&&!saved)throw new Error('이 기기에 방을 저장하지 못했어.');
  activeRoom=room;activeGuest=guest;activeScope=scope;confirmedProgressId=value.progressId??'';
  return room;
}
export function getRoomSession(){
  if(activeRoom)return activeRoom;
  const guest=getGuest();
  if(!guestPattern.test(guest))return null;
  const raw=read('sessionStorage',currentKey)||read('localStorage',currentKey);
  const room=parseRoom(raw);
  if(room){
    put('sessionStorage',currentKey,raw);
    activeRoom=room;activeGuest=guest;
    activeScope=JSON.parse(raw).scope||'';
  }
  return room;
}

export function roomInviteUrl(code){
  const url=new URL(location.pathname,location.origin);
  url.searchParams.set('room',normalizeRoomCode(code));
  return url.href;
}
export function roomStorageKey(base,code=getRoomSession()?.code){
  return code?base+':room:'+code+':'+activeScope:base;
}
function roomRequest(url,init,guest,code){
  const headers=new Headers(init?.headers);
  headers.set('X-Stall-Guest',guest);
  if(code)headers.set('X-Stall-Room',code);
  if(code)headers.set('X-Stall-Progress',progressId||'initial');
  // Local mode answers in this browser; remote mode calls the Next.js API route.
  return gameApiFetch(url,{...init,headers});
}
export function roomFetch(url,init){
  const room=getRoomSession();
  if(!room)throw new Error('먼저 게임 방에 참가해 줘.');
  return roomRequest(url,init,activeGuest,room.code);
}
export async function resetRoomProgress(previousId,resetId,resetAt){
  const response=await roomFetch('./api/progress/reset',{
    method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({previousId,resetId,resetAt}),signal:AbortSignal.timeout(8000),
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.ok||data.progressId!==resetId)throw Object.assign(
    new Error(data?.error||'게임 기록 초기화를 확인하지 못했어. 연결 후 다시 시도해 줘.'),
    {reason:data?.reason,status:response.status,progressId:data?.progressId},
  );
  return data;
}
export async function repairRoomRitual(resetId,day){
  const current=await roomFetch('./api/rituals',{cache:'no-store',signal:AbortSignal.timeout(6000)});
  const page=await current.json();
  if(current.ok&&page.ritualRepairId===resetId)return {ok:true,day,repairId:resetId,usedDay:page.usedDay};
  if(!current.ok||page.usedDay!==day||!page.usedRequestId)throw new Error('오늘의 살굿 기록을 다시 확인해 줘.');
  const response=await roomFetch('./api/progress/ritual-repair',{
    method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({resetId,receiptId:page.usedRequestId,day}),signal:AbortSignal.timeout(6000),
  });
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data?.ok||data.repairId!==resetId)throw new Error(data?.error||'이전 살굿 기록을 정리하지 못했어.');
  return data;
}
async function roomPayload(response){
  const value=await response.json().catch(()=>null);
  if(!response.ok||!value?.code){
    throw Object.assign(new Error(value?.error||'방에 연결하지 못했어. 잠시 뒤 다시 시도해 줘.'),{
      status:response.status,reason:value?.reason,
    });
  }
  return value;
}

export async function enterRoom({action,code,nickname}){
  const body={action},pendingKey=prefix+action;
  if(action==='join'){
    body.code=normalizeRoomCode(code);
    if(!body.code)throw new Error('초대 코드 16자리를 확인해 줘.');
  }else if(action==='create'||action==='guest'){
    const pending=read('sessionStorage',pendingKey);
    body.requestId=guestPattern.test(pending)?pending:crypto.randomUUID();
    put('sessionStorage',pendingKey,body.requestId);
  }else throw new Error('방 파기, 참가하기, 게스트 모드 중 하나를 골라 줘.');
  const name=(nickname??'').trim().normalize('NFC');
  if(!validNickname(name))throw new Error(nicknameHint);
  if(name)body.nickname=name;
  const guest=await ensureGuest();
  const response=await roomRequest('./api/rooms',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000),
  },guest);
  const room=await rememberRoom(await roomPayload(response),guest);
  put('sessionStorage',pendingKey,null);
  return room;
}

function forgetRoom(room){
  if(activeRoom!==room)return;
  activeRoom=null;activeGuest=null;activeScope='';confirmedProgressId=undefined;
  put('sessionStorage',currentKey,null);
  if(parseRoom(read('localStorage',currentKey))?.code===room.code)put('localStorage',currentKey,null);
}

export async function refreshRoom(){
  const room=getRoomSession();
  if(!room)return null;
  const guest=activeGuest;
  try{
    const value=await roomPayload(await roomFetch('./api/rooms',{cache:'no-store',signal:AbortSignal.timeout(4500)}));
    if(value.code!==room.code)throw Object.assign(new Error('방 정보를 다시 확인해 줘.'),{status:404});
    if(activeRoom!==room)return activeRoom;
    const next=parseRoom(JSON.stringify(value));
    if(activeScope&&JSON.stringify(next)===JSON.stringify(room)){
      confirmedProgressId=value.progressId??'';
      return room;
    }
    return rememberRoom(next,guest,room);
  }catch(error){
    if([401,403,404].includes(error.status))forgetRoom(room);
    throw error;
  }
}

export async function startRoom(){
  const room=getRoomSession();
  const value=await roomPayload(await roomFetch('./api/rooms',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'start'}),signal:AbortSignal.timeout(8000),
  }));
  if(value.code!==room.code||value.started!==true)throw new Error('아직 시작할 수 없는 방이야.');
  return rememberRoom(value,activeGuest);
}

export async function restoreRoom(){
  const room=getRoomSession();
  if(!room)return null;
  try{
    return await refreshRoom();
  }catch(error){
    if(activeRoom!==room)return activeRoom;
    if(room.started&&activeScope)return room;
    throw error;
  }
}

export async function migrateLegacyGame(base,isValid){
  const room=getRoomSession(),key=roomStorageKey(base);
  if(!room)return key;
  await locked(base+':room-migration',()=>{
    const marker=base+':first-room';
    const firstRoom=read('localStorage',marker);
    if(firstRoom&&firstRoom!==key)return;
    if(!firstRoom&&!put('localStorage',marker,key))return;
    if(read('localStorage',key)!==null)return;
    let saved;
    try{saved=JSON.parse(read('localStorage',base));}catch{return;}
    if(!saved||!isValid(saved))return;
    for(const [pending,charges] of [['spyPending','spyCharges'],['intimidationPending','intimidationCharges']]){
      const charge=saved[pending];
      if(charge&&Number.isFinite(charge.cost)&&charge.cost>=0)finishDeskCharge(saved,pending,charges,charge.id,false);
      else delete saved[pending];
    }
    delete saved.electionReset;
    delete saved.intimidationInbox;
    saved.electionResetVersion=1;
    for(const name of ['stall-street:friend-thread:2:bot-bid','stall-street:friend-thread:2:bot-rebound','stall-street:sample-chats:1']){
      const raw=read('localStorage',name);
      if(raw!==null&&read('localStorage',roomStorageKey(name))===null)put('localStorage',roomStorageKey(name),raw);
    }
    put('localStorage',key,JSON.stringify(saved));
  });
  return key;
}
