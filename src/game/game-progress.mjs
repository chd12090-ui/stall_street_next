import {startLive} from './live-clock.mjs';

// Room-wide price changes survive a member restarting. Receipts, daily limits,
// the analysis journal, balances and all other player activity start fresh.
export function restartProgress(previous,{shared=false,now=Date.now(),id=crypto.randomUUID()}={}){
  const fresh=startLive(null,now,now);
  fresh.sound=previous.sound;
  fresh.resetId=id;
  fresh.roomProgressId=id;
  fresh.progressStartedAt=now;
  fresh.electionResetVersion=1;
  fresh.roomProgressResets=[...(previous.roomProgressResets??[]),{
    previousId:previous.roomProgressId??'',resetId:id,resetAt:now,
  }];
  if(shared){
    if(previous.ritualEvents)fresh.ritualEvents=previous.ritualEvents;
    if(previous.ritualCursor)fresh.ritualCursor=previous.ritualCursor;
  }
  return fresh;
}

export function legacyRitualOrphan(state){
  const day=state.ritualUsedDay;
  return Boolean(state.resetId&&!state.roomProgressId&&!state.ritualRepairId&&Number.isSafeInteger(day)&&state.confirmedRitualDay!==day&&
    state.ritualPending?.day!==day&&state.ritualLast?.day!==day&&!state.ritualCharges?.some(row=>row.day===day));
}

export function repairGuestRitual(state){
  // Solo saves never receive a server-only daily receipt.
  if(legacyRitualOrphan(state))delete state.ritualUsedDay;
}

export function sharedRitualRepairDue(state){
  return legacyRitualOrphan(state)&&state.ritualUsedDay===state.day&&state.openingDay===state.day;
}

export function adoptRoomProgress(previous,roomId,{shared,now=Date.now()}){
  // A restored browser backup can still refer to a run the room has already reset.
  const fresh=restartProgress(previous??{sound:true},{shared,now,id:roomId});
  delete fresh.roomProgressResets;
  return fresh;
}

export function acknowledgeProgressReset(state,id){
  const queue=state.roomProgressResets;
  const index=queue?.findIndex(entry=>entry.resetId===id)??-1;
  if(index<0)return false;
  if(index===queue.length-1)delete state.roomProgressResets;
  else state.roomProgressResets=queue.slice(index+1);
  return true;
}
