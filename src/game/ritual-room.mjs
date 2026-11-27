import {roomFetch,getRoomSession} from './room-session.mjs';
import {legacyRitualOrphan} from './game-progress.mjs';
import {mergeRitualEvents} from './ritual-rules.mjs';

export const sharedRituals=()=>getRoomSession()?.mode==='multiplayer';
export async function readRoomRituals(after=0,timeout=6000){
  if(!sharedRituals())return null;
  try{
    const response=await roomFetch('./api/rituals?after='+after,{cache:'no-store',signal:AbortSignal.timeout(timeout)});
    if(!response.ok)return null;
    const page=await response.json();
    return Array.isArray(page.events)?page:null;
  }catch{return null;}
}
export function mergeRoomRituals(state,page){
  if(!page)return false;
  let changed=mergeRitualEvents(state,page.events);
  if(state.resetId&&!state.roomProgressId&&!state.ritualRepairId&&Number.isSafeInteger(page.usedDay)){
    if(page.legacyRitualReceipt===true&&state.legacyRoomRitualDay!==page.usedDay){state.legacyRoomRitualDay=page.usedDay;changed=true;}
    if(page.legacyRitualReceipt===false&&state.confirmedRitualDay!==page.usedDay){state.confirmedRitualDay=page.usedDay;changed=true;}
  }
  if(page.usedDay===null&&legacyRitualOrphan(state)){
    delete state.ritualUsedDay;changed=true;
  }
  const repaired=page.ritualRepairId;
  if(repaired&&!state.roomProgressId&&state.ritualRepairId!==repaired){
    state.ritualRepairId=repaired;changed=true;
  }
  // An older poll may return the pre-repair receipt after a newer response cleared it.
  if((!state.ritualRepairId||repaired===state.ritualRepairId)&&Number.isSafeInteger(page.usedDay)&&page.usedDay>(state.ritualUsedDay??-Infinity)){
    state.ritualUsedDay=page.usedDay;changed=true;
  }
  if(!page.events?.length)return changed;
  const cursor=page.events.at(-1).sequence;
  if(cursor<=(state.ritualCursor??0))return changed;
  state.ritualCursor=cursor;
  return true;
}
export async function sendRoomRitual(pending){
  const {id,code,cost,wealth,quotedAt,mental,chance,day}=pending;
  try{
    const response=await roomFetch('./api/rituals',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id,code,cost,wealth,quotedAt,mental,chance,day}),signal:AbortSignal.timeout(6000)});
    const body=await response.json();
    if(response.ok&&body.result?.id===id&&body.result.code===code&&typeof body.result.success==='boolean')return body;
    if([400,401,403,409].includes(response.status)&&body.error)return {rejected:body.error,usedDay:body.usedDay,ritualRepairId:body.ritualRepairId,legacyRitualReceipt:body.legacyRitualReceipt};
  }catch{}
  // An interrupted response may already have committed. Resend exactly this ID.
  return null;
}
