import {clearRehabilitationFinances,netWealth,reconcileFinancialMood} from './market.mjs';
import {rehabilitationReward} from './rehabilitation-record.mjs';

export {rehabilitationReward};

// The marker crosses the bar in duration milliseconds and reverses at either end.
export function rehabilitationPosition(startedAt,duration,now=Date.now()){
  const phase=(Math.max(0,now-startedAt)%(2*duration))/duration;
  return phase<=1?phase:2-phase;
}

function roundTiming(round,token){
  const advance=round-1;
  const width=.06+.22*.68**advance;
  const duration=530+1000*.74**advance;
  const variation=token?Number.parseInt(token.slice(0,2),16)/255-.5:0;
  const center=.5+variation*Math.min(.44,.11*advance);
  return {duration,perfectStart:center-width/2,perfectEnd:center+width/2};
}

function oldRoundTiming(round){
  const width=.072+.208/(1+.28*(round-1));
  return {duration:430+1100/(1+.18*(round-1)),perfectStart:(1-width)/2,perfectEnd:(1+width)/2};
}

export function rehabilitationView(state){
  const netWorth=netWealth(state),record=state.rehabilitationSession;
  const finishedDay=record?.withdrawnDay??(record?.stage==='exhausted'?record.day:null);
  const current=record&&(finishedDay===null||finishedDay===state.day)?record:null;
  const stage=current?.withdrawnDay!==undefined?'withdrawn':current?.stage??(netWorth<0?'ready':'preview');
  const round=current?.round??1;
  // Preserve the exact timing for rounds begun before the rebalance.
  const timing=current?current.timing??oldRoundTiming(round):roundTiming(round);
  const waitingForPayment=Boolean(state.ritualPending||state.spyPending||state.intimidationPending);
  return {stage,netWorth,round,...timing,
    token:record?.token??null,startedAt:current?.startedAt??null,stoppedAt:current?.stoppedAt??null,
    wins:current?.wins??0,misses:current?.misses??0,lastResult:current?.lastResult??null,waitingForPayment,
    canApply:state.phase==='open'&&stage==='ready'&&!waitingForPayment,
    canStart:state.phase==='open'&&['won','lastChance'].includes(stage),
    canLeave:Boolean(current&&finishedDay===null)};
}

function beginRound(state,wins,misses,now){
  const token=globalThis.crypto.randomUUID(),round=wins+misses+1;
  state.rehabilitationSession={stage:'playing',round,wins,misses,token,timing:roundTiming(round,token),
    day:state.day,startedAt:now,stoppedAt:null,lastResult:null};
}

// Apply only to a staged save under the room lock. A confirmed application
// clears the accounts and starts the first round in the same transaction.
export function applyForRehabilitation(state,expectedToken=null,now=Date.now()){
  const view=rehabilitationView(state);
  if(!view.canApply||expectedToken!==view.token||!Number.isFinite(now))return false;
  clearRehabilitationFinances(state);
  delete state.rehabilitation; // The previous version did not clear assets.
  beginRound(state,0,0,now);
  return true;
}

export function startRehabilitationRound(state,expectedToken,now=Date.now()){
  const view=rehabilitationView(state);
  if(!view.canStart||expectedToken!==view.token||!Number.isFinite(now))return false;
  beginRound(state,view.wins,view.misses,now);
  return true;
}

export function leaveRehabilitationSession(state,expectedToken){
  const view=rehabilitationView(state);
  if(!view.canLeave||expectedToken!==view.token)return false;
  state.rehabilitationSession={...state.rehabilitationSession,withdrawnDay:state.day};
  return true;
}

export function stopRehabilitationRound(state,token,stoppedAt=Date.now()){
  const record=state.rehabilitationSession;
  if(state.phase!=='open'||record?.stage!=='playing'||record.withdrawnDay!==undefined||token!==record.token||
    !Number.isFinite(stoppedAt)||stoppedAt<record.startedAt)return null;
  const {duration,perfectStart,perfectEnd}=rehabilitationView(state);
  const position=rehabilitationPosition(record.startedAt,duration,stoppedAt);
  const won=position>=perfectStart&&position<=perfectEnd;
  const next={...record,day:state.day,stoppedAt,lastResult:won?'won':'miss'};
  if(won){
    const seq=(state.cashSequence??0)+1;
    state.cash+=rehabilitationReward;
    state.startWealth+=rehabilitationReward;
    state.cashSequence=seq;
    state.rehabilitationPayments=[...(state.rehabilitationPayments??[]),
      {day:state.day,step:state.cursor,seq,amount:rehabilitationReward}];
    next.wins++;
    next.stage='won';
    if(state.mentalRates)state.mentalRates={...state.mentalRates};
    reconcileFinancialMood(state);
  }else{
    next.misses++;
    next.stage=next.misses===2?'exhausted':'lastChance';
  }
  state.rehabilitationSession=next;
  return next.stage;
}
