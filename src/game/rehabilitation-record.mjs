import {currencies} from './world.mjs';

export const rehabilitationReward=500_000;

function validReceipts(rows,state,validAmounts){
  return rows===undefined||Array.isArray(rows)&&rows.every((row,i)=>
    Number.isSafeInteger(row?.day)&&row.day<=state.day&&Number.isInteger(row.step)&&row.step>=0&&row.step<=288&&
    Number.isSafeInteger(row.seq)&&row.seq>(i?rows[i-1].seq:0)&&row.seq<=state.cashSequence&&validAmounts(row));
}
function validClearance({assets,debt,balances}){
  return Number.isFinite(assets)&&assets>=0&&Number.isFinite(debt)&&debt>assets&&
    balances&&typeof balances==='object'&&!Array.isArray(balances)&&
    Object.entries(balances).every(([currency,amount])=>Object.hasOwn(currencies,currency)&&Number.isFinite(amount)&&amount>0);
}
export function validRehabilitationSave(state){
  if(!validReceipts(state.rehabilitationPayments,state,row=>row.amount===rehabilitationReward)||
    !validReceipts(state.rehabilitationSettlements,state,validClearance))return false;

  // v51 attempts did not forgive debts or clear assets. Their awarded payments
  // remain on the ledger, and the new application always requires confirmation.
  const record=state.rehabilitationSession;
  if(record===undefined)return true;
  if(!state.rehabilitationSettlements?.length||!record||typeof record.token!=='string'||!record.token||
    !Number.isSafeInteger(record.day)||record.day<state.rehabilitationSettlements.at(-1).day||record.day>state.day||
    !Number.isSafeInteger(record.round)||record.round<1||!Number.isSafeInteger(record.wins)||record.wins<0||
    !Number.isInteger(record.misses)||record.misses<0||record.misses>2||!Number.isFinite(record.startedAt))return false;
  const {stage,round,wins,misses,lastResult,startedAt,stoppedAt,timing,withdrawnDay}=record;
  if(withdrawnDay!==undefined&&(!Number.isSafeInteger(withdrawnDay)||withdrawnDay<record.day||
    withdrawnDay>state.day||stage==='exhausted'))return false;
  if(timing!==undefined&&(!timing||
    ![timing.duration,timing.perfectStart,timing.perfectEnd].every(Number.isFinite)||
    timing.duration<=0||timing.perfectStart<0||timing.perfectEnd>1||timing.perfectStart>=timing.perfectEnd))return false;
  const played=wins+misses;
  if(stage==='playing')return round===played+1&&misses<2&&lastResult===null&&stoppedAt===null;
  if(round!==played||!Number.isFinite(stoppedAt)||stoppedAt<startedAt)return false;
  if(stage==='won')return lastResult==='won'&&wins>0&&misses<2;
  return lastResult==='miss'&&(stage==='lastChance'&&misses===1||stage==='exhausted'&&misses===2);
}
