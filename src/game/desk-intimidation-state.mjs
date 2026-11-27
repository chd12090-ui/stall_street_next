import {deskRequestId,reserveDeskCharge,finishDeskCharge} from './desk-charges.mjs';

export const intimidationPoints=25;
export const intimidationBase=2_000_000;
export const intimidationCooldownDays=4;
export const intimidationFee=wealth=>intimidationBase+Math.round(Math.max(0,wealth)*.05);
export const intimidationId=deskRequestId;

export function queueIntimidations(state,events){
  const seen=new Set([...(state.intimidationNotices??[]),...(state.intimidationInbox??[])].map(e=>e.id));
  const fresh=events.filter(e=>{
    if(!intimidationId(e?.id)||!Number.isSafeInteger(e.at)||!Number.isSafeInteger(e.day)||seen.has(e.id))return false;
    seen.add(e.id);return true;
  });
  if(!fresh.length)return false;
  state.intimidationInbox=[...(state.intimidationInbox??[]),...fresh].sort((a,b)=>a.at-b.at);
  return true;
}

export function applyDueIntimidations(state,throughActualMs,beforeDelta=()=>{}){
  const inbox=state.intimidationInbox;
  if(!inbox?.length||inbox[0].at>throughActualMs)return false;
  const fresh=inbox.filter(event=>event.at<=throughActualMs);
  state.intimidationInbox=inbox.slice(fresh.length);
  const notices=state.intimidationNotices??=[];
  for(const event of fresh){
    beforeDelta(event.at);
    state.mental=Math.max(0,state.mental-intimidationPoints);
    notices.push({id:event.id,day:event.day,points:intimidationPoints,read:false});
  }
  return true;
}

export function intimidationReportNotices(state){
  return (state.intimidationNotices??[]).filter(notice=>notice.day<state.day&&!notice.read);
}

export function markIntimidationReportsRead(state,ids){
  const visible=new Set(ids), notices=intimidationReportNotices(state).filter(notice=>visible.has(notice.id));
  for(const notice of notices)notice.read=true;
  return notices.length>0;
}

export const reserveIntimidation=(state,pending)=>reserveDeskCharge(state,'intimidationPending',pending);
export const finishIntimidation=(state,id,accepted)=>finishDeskCharge(state,'intimidationPending','intimidationCharges',id,accepted);
