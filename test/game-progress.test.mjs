import test from 'node:test';
import assert from 'node:assert/strict';
import {startLive} from '../src/game/live-clock.mjs';
import {acknowledgeProgressReset,adoptRoomProgress,legacyRitualOrphan,repairGuestRitual,restartProgress,sharedRitualRepairDue} from '../src/game/game-progress.mjs';
import {mergeRoomRituals} from '../src/game/ritual-room.mjs';
import {finishRitual,localRitualResult,reserveRitual,ritualUsedToday} from '../src/game/ritual.mjs';

const now=Date.parse('2026-11-24T02:00:00Z');
const id=()=>crypto.randomUUID();
function playedGame(){
  const state=startLive(null,now,now);
  assert.equal(reserveRitual(state,'MOON',id(),now),'');
  assert.ok(finishRitual(state,localRitualResult(state.ritualPending,()=>0)));
  state.sound=false;
  state.ritualUsedDay=state.day;
  state.ritualCursor=4;
  state.botSpyReports=[{id:id()}];
  state.intimidationNotices=[{id:id(),day:state.day-1,read:false}];
  state.intimidationInbox=[{id:id(),day:state.day,at:now}];
  state.testFriendIntimidations={'bot-bid':{mental:0,nextAt:now+7000}};
  state.history.push({day:state.day-1});
  return state;
}

test('resetting a same-day guest starts an unused ritual and forgets personal ledgers, mental effects and private market events',()=>{
  const old=playedGame();
  assert.equal(ritualUsedToday(old),true);
  const fresh=restartProgress(old,{now});
  const reloaded=startLive(JSON.parse(JSON.stringify(fresh)),now,now);
  assert.equal(reloaded.sound,false);
  assert.equal(reloaded.cash,5_000_000);
  assert.equal(reloaded.mental,75);
  assert.deepEqual(reloaded.history,[]);
  for(const field of ['ritualLast','ritualCharges','ritualUsedDay','ritualPending','ritualEvents','ritualCursor',
    'botSpyReports','intimidationNotices','intimidationInbox','testFriendIntimidations'])assert.equal(reloaded[field],undefined,field);
  assert.equal(reserveRitual(reloaded,'MOON',id(),now),'');
  assert.ok(finishRitual(reloaded,localRitualResult(reloaded.ritualPending,()=>1)));
  assert.equal(ritualUsedToday(reloaded),true);
  assert.match(reserveRitual(reloaded,'MOON',id(),now),/오늘은 이미/);
});

test('a member restart retains room market news and the synchronization cursor, and resets only personal payment and limits',()=>{
  const old=playedGame(), fresh=restartProgress(old,{shared:true,now});
  assert.ok(old.ritualEvents.length>0);
  assert.deepEqual(fresh.ritualEvents,old.ritualEvents);
  assert.equal(fresh.ritualCursor,4);
  assert.equal(ritualUsedToday(fresh),false);
  assert.equal(fresh.ritualLast,undefined);
  assert.equal(fresh.ritualCharges,undefined);
});

test('multiple offline restarts persist their causal order; stale acknowledgements never erase later intents',()=>{
  const a=restartProgress(playedGame(),{now});
  const b=restartProgress(JSON.parse(JSON.stringify(a)),{now:now+1});
  assert.deepEqual(b.roomProgressResets.map(r=>[r.previousId,r.resetId]),[['',a.resetId],[a.resetId,b.resetId]]);
  assert.equal(acknowledgeProgressReset(b,a.resetId),true);
  assert.equal(acknowledgeProgressReset(b,a.resetId),false);
  assert.equal(b.roomProgressResets[0].resetId,b.resetId);
  assert.equal(acknowledgeProgressReset(b,b.resetId),true);
  assert.equal(b.roomProgressResets,undefined);
  assert.equal(b.roomProgressId,b.resetId);
});

test('the guest upgrade repairs only an orphaned legacy limit and preserves genuine receipts and the rest of its run',()=>{
  const guest=startLive(null,now,now);
  const old={...guest,resetId:id(),ritualUsedDay:guest.day,cash:321_000,history:[{day:guest.day-1}]};
  repairGuestRitual(old);
  assert.equal(old.ritualUsedDay,undefined);
  assert.equal(old.cash,321_000);
  assert.equal(old.history.length,1);
  for(const proof of [{resetId:undefined},{roomProgressId:id()},{ritualLast:{day:guest.day}},
    {ritualPending:{day:guest.day}},{ritualCharges:[{day:guest.day}]}]){
    const protectedSave={...old,ritualUsedDay:guest.day,...proof};
    repairGuestRitual(protectedSave);
    assert.equal(protectedSave.ritualUsedDay,guest.day);
  }
});

test('the old multiplayer orphan repair is bounded to an identifiable restart and never revives a stale room response',()=>{
  const state=startLive(null,now,now),legacy=id();
  Object.assign(state,{resetId:legacy,ritualUsedDay:state.day,botSpyReports:[{id:'keep'}],cash:1_234_567});
  assert.equal(sharedRitualRepairDue(state),true);
  assert.equal(legacyRitualOrphan({...state,openingDay:state.day-1}),true);
  assert.equal(sharedRitualRepairDue({...state,openingDay:state.day-1}),false);
  assert.equal(sharedRitualRepairDue({...state,ritualCharges:[{day:state.day}]}),false);
  const replay={events:[],usedDay:state.day,ritualRepairId:null};
  const currentReceipt={...state};
  assert.ok(mergeRoomRituals(currentReceipt,{...replay,legacyRitualReceipt:false}));
  assert.equal(legacyRitualOrphan(currentReceipt),false);
  assert.equal(sharedRitualRepairDue(currentReceipt),false);
  assert.ok(mergeRoomRituals(state,{events:[],usedDay:null,ritualRepairId:legacy}));
  assert.equal(mergeRoomRituals(state,replay),false);
  assert.equal(ritualUsedToday(state),false);
  assert.equal(state.cash,1_234_567);
  assert.deepEqual(state.botSpyReports,[{id:'keep'}]);
  assert.ok(mergeRoomRituals(state,{...replay,ritualRepairId:legacy}));
  assert.equal(ritualUsedToday(state),true);
  assert.equal(sharedRitualRepairDue(state),false);
  assert.equal(mergeRoomRituals(state,{events:[],usedDay:null,ritualRepairId:legacy}),false);
  assert.equal(ritualUsedToday(state),true);
});

test('a server-confirmed generation restores a discarded local run, and an orphan without a room receipt is cleared',()=>{
  const old=playedGame(),generation=id(),adopted=adoptRoomProgress(old,generation,{now,shared:true});
  assert.equal(adopted.roomProgressId,generation);assert.equal(adopted.resetId,generation);
  assert.equal(adopted.roomProgressResets,undefined);assert.equal(adopted.mental,75);
  assert.deepEqual(adopted.ritualEvents,old.ritualEvents);
  assert.equal(adoptRoomProgress(null,generation,{now,shared:true}).sound,true);
  const orphan={resetId:id(),day:old.day,ritualUsedDay:old.day};
  assert.ok(mergeRoomRituals(orphan,{events:[],usedDay:null}));
  assert.equal(ritualUsedToday(orphan),false);
});
