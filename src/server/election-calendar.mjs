import {actualTimestamp,gameDayStart,gameTime} from '../game/clock-calendar.mjs';

const firstRoundId=Date.UTC(2026,10,20,9);
const roundInterval=7*86_400_000;
const votingDays=2;
export const roomElectionInterval=14;

export function electionRound(id){
  // Round IDs are the original weekly timestamps stored with votes and resets.
  if(id===firstRoundId)return {id,startsAt:id,endsAt:id+51*3_600_000};
  const day=gameTime(id).day;
  return {id,startsAt:actualTimestamp(gameDayStart(day)),endsAt:actualTimestamp(gameDayStart(day+votingDays))};
}

function legacyElectionSchedule(now){
  let id=firstRoundId+Math.max(0,Math.floor((now-firstRoundId)/roundInterval))*roundInterval;
  if(now>=electionRound(id+roundInterval).startsAt)id+=roundInterval;
  const round=electionRound(id);
  if(now<round.startsAt)return {active:null,last:null,next:round};
  const active=now<round.endsAt?round:null;
  const last=active?(id===firstRoundId?null:electionRound(id-roundInterval)):round;
  return {active,last,next:electionRound(id+roundInterval)};
}

export function roomElectionRound(openingDay,number){
  const day=openingDay+2+(number-1)*roomElectionInterval;
  const startsAt=actualTimestamp(gameDayStart(day));
  return {id:startsAt,number,startsAt,endsAt:actualTimestamp(gameDayStart(day+votingDays))};
}

export function electionSchedule(now,roomOpenedAt){
  if(!Number.isSafeInteger(roomOpenedAt))return legacyElectionSchedule(now);
  const openingDay=gameTime(roomOpenedAt).day;
  const number=1+Math.floor(Math.max(0,gameTime(now).day-openingDay-2)/roomElectionInterval);
  const round=roomElectionRound(openingDay,number);
  if(now<round.startsAt)return {openingDay,active:null,last:null,next:round};
  const active=now<round.endsAt?round:null;
  const last=active?(number>1?roomElectionRound(openingDay,number-1):null):round;
  return {openingDay,active,last,next:roomElectionRound(openingDay,number+1)};
}
