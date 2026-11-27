import {getRoomSession,roomFetch,roomStorageKey} from './room-session.mjs';
import {candidates,setElectedPolicy} from './election-policy.mjs';
import {firstGameDay,gameTime} from './clock-calendar.mjs';

const api='./api/elections';

let snapshot=null, reading=false, posting=null, notice='';
let revision=0,pendingReset=null,resetRequest=null;
let cacheKey='',soloOpeningDay=null;
export function bindElectionCalendar(state){
  const solo=getRoomSession()?.mode==='guest';
  soloOpeningDay=solo?firstGameDay(state):null;
  const key=roomStorageKey('stall-street:server-election:2')+(solo?':'+soloOpeningDay+':'+(state.roomProgressId??''):'');
  if(key===cacheKey)return;
  cacheKey=key;
  revision++;
  snapshot=null;
  let terms=[];
  try{terms=JSON.parse(localStorage.getItem(key))??[];}catch{}
  setElectedPolicy(terms);
}

function applyElection(data) {
  const changed=Boolean(notice)||JSON.stringify(snapshot)!==JSON.stringify(data);
  snapshot=data;
  notice='';
  try { localStorage.setItem(cacheKey,JSON.stringify(data.terms)); } catch {}
  return {changed,policy:setElectedPolicy(data.terms)};
}

function resolveNotice(next) {
  const changed=notice!==next;
  notice=next;
  return {changed};
}

async function requestElection(body) {
  const signal=AbortSignal.timeout(8000);
  const headers={};
  if(Number.isSafeInteger(soloOpeningDay))headers['X-Stall-Opening-Day']=String(soloOpeningDay);
  if(body)headers['Content-Type']='application/json';
  const response=await roomFetch(api,body?{signal,headers,
    method:'POST',body:JSON.stringify(body),keepalive:body.action==='reset',
  }:{cache:'no-store',signal,headers});
  const data=await response.json().catch(()=>null);
  if(!response.ok||!data)throw Object.assign(new Error(data?.error||'대통령 선거에 연결하지 못했어. 다시 시도해 줘.'),{status:response.status});
  return data;
}

export function useElectionReset(reset){
  if((pendingReset?.resetId??null)===(reset?.resetId??null))return;
  pendingReset=reset??null;
  revision++;
  snapshot=null;
  notice=reset?'새 게임의 투표용지를 준비하고 있어.':'';
}
export async function refreshElection() {
  if(pendingReset){
    const reset=pendingReset,current=revision;
    if(resetRequest===reset.resetId||posting)return {};
    resetRequest=reset.resetId;
    try{
      const data=await requestElection({action:'reset',resetAt:reset.resetAt,resetId:reset.resetId});
      if(current!==revision)return {};
      pendingReset=null;
      return {...applyElection(data),changed:true,acknowledgedReset:reset.resetId};
    }catch(error){
      if(current!==revision)return {};
      if(error.status===401){
        pendingReset=null;
        return {...resolveNotice(error.message),policy:setElectedPolicy([]),acknowledgedReset:reset.resetId};
      }
      return resolveNotice('투표용지를 갱신하는 중이야. 연결되면 다시 시도해.');
    }finally{if(resetRequest===reset.resetId)resetRequest=null;}
  }
  if(reading||posting)return {};
  reading=true;
  const current=revision;
  try {
    const data=await requestElection();
    return current===revision?applyElection(data):{};
  } catch(error) {
    if(current!==revision)return {};
    const info=resolveNotice(error.message);
    return error.status===401?{...info,policy:setElectedPolicy([])}:info;
  } finally {
    reading=false;
  }
}

export async function voteInElection(candidate,onStart) {
  if(pendingReset||posting||!Object.hasOwn(candidates,candidate)||!snapshot?.ballot||snapshot.ballot.ownVote)return {};
  const {startsAt,roundId=startsAt,generation=0}=snapshot.ballot;
  const current=++revision;
  posting=candidate;
  try {
    onStart?.();
    const data=await requestElection({action:'vote',candidate,election:roundId,generation});
    if(current!==revision)return {};
    return {...applyElection(data),changed:true,stamped:data.ballot?.ownVote===candidate};
  } catch(error) {
    if(current!==revision)return {};
    let policy=false;
    if(error.status===409){
      try { const data=await requestElection();if(current!==revision)return {};({policy}=applyElection(data)); } catch {}
      if(current!==revision)return {};
    }
    resolveNotice(error.message);
    return {changed:true,policy};
  } finally {
    posting=null;
  }
}

export function shortcutState(now=Date.now()) {
  const ballot=snapshot?.ballot?.endsAt>now?snapshot.ballot:null;
  const phase=ballot?(ballot.ownVote?'voted':'voting'):'scheduled';
  const target=ballot?ballot.endsAt-1:snapshot?.nextStartsAt;
  const days=Number.isFinite(target)?gameTime(target).day-gameTime(now).day:-1;
  if(days<0)return {phase,caption:'—',label:'대통령 선거 · 일정 확인 중'};
  const action=ballot?'마감':'시작';
  const status=phase==='voted'?' · 투표 완료':phase==='voting'?' · 투표 중':'';
  const caption=days?'D-'+days:'D-DAY';
  const label='대통령 선거'+status+' · '+(days?action+'까지 '+days+'일':'오늘 '+action);
  return {phase,caption,label};
}

export const canRepairOldBallot=state=>Boolean(state?.resetId&&!state.electionResetVersion&&!state.electionReset&&snapshot?.ballot?.ownVote&&snapshot.ballot.endsAt>Date.now());

export const readElection=()=>({snapshot,posting,notice});
export const presidentialElectionTitle=()=>`제 ${snapshot?.ballot?.number??(snapshot?.publishedToday?snapshot.lastResult?.number:null)??snapshot?.nextNumber??1}대 대통령 선거`;
