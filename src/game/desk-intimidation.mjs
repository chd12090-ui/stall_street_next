import {roomFetch} from './room-session.mjs';
import {gameTime,dayLabel,clockText} from './clock-calendar.mjs';
import {intimidationFee,intimidationPoints,intimidationCooldownDays} from './desk-intimidation-state.mjs';
import {testFriend,testFriendNextAt,testFriends} from './test-friends.mjs';

const endpoint='./api/intimidations';

async function request(body,timeout){
  try{
    const init={cache:'no-store',signal:AbortSignal.timeout(timeout)};
    if(body)Object.assign(init,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const response=await roomFetch(endpoint,init),value=await response.json();
    return {status:response.status,value};
  }catch{return {};}
}

export async function fetchIntimidations(timeout=5000){
  const {status,value}=await request(null,timeout);
  return status===200&&Array.isArray(value?.targets)&&Array.isArray(value?.incoming)?value:null;
}

export async function sendIntimidation(pending){
  const {id,room,target,wealth,available,cost}=pending;
  const {status,value}=await request({action:'send',id,room,target,wealth,available,cost},7000);
  if(status===200&&value?.id===id&&value.cost===cost)return {accepted:true,nextAt:value.nextAt};
  if([400,404,409].includes(status)&&typeof value?.error==='string')return {accepted:false,error:value.error};
  return {};
}

export function acknowledgeIntimidations(ids){
  if(ids.length)void request({action:'ack',ids},5000);
}

export function intimidationOffer(view,state,net,available,modal){
  const cost=intimidationFee(net);
  const waiting=Boolean(state.intimidationPending);
  const friends=(view?.targets??[]).map(({slot,number,nickname,nextAt})=>({value:String(slot),label:nickname||'친구 '+Number(number),nextAt}));
  const bots=testFriends.map(friend=>({value:friend.room,label:friend.name}));
  const targets=[...friends,...bots];
  const selected=targets.find(({value})=>value===String(modal.target))??targets[0];
  const bot=testFriend(selected.value);
  const nextAt=bot?testFriendNextAt(state,bot):selected.nextAt;
  const onCooldown=nextAt>Date.now();
  const next=onCooldown?gameTime(nextAt):null;
  const notice=waiting?'결제를 확인 중이야.':
    onCooldown?'다음 이용 가능 · '+dayLabel(state,next.day)+' '+clockText(next.cursor,true,next.minute):
    available<cost?'사용 가능한 원화가 부족해.':'';
  return {
    id:'intimidation',targets,selected:selected.value,cost,available,
    description:'친구의 정신력을 '+intimidationPoints+'점 낮춰. 방 친구는 다음 날 정산보고서에서 알게 돼.',
    terms:'비용은 기본 200만 원이고, 순자산이 양수면 그 금액의 5%를 더해. 친구마다 게임 시간 기준 '+intimidationCooldownDays+'일에 한 번 이용할 수 있어.',
    status:notice||(modal.error&&!view?'친구방을 불러오지 못했어.':''),
    success:modal.botResult?.target===selected.value?'협박을 전했어.':'',
    action:'결제하고 협박하기',disabled:waiting||onCooldown||available<cost||state.phase!=='open'
  };
}
