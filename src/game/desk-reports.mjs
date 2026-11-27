import {roomFetch} from './room-session.mjs';
import {dayLabel,clockText,realTime} from './clock-calendar.mjs';
import {deskRequestId,spyFee} from './desk-charges.mjs';
import {exchangeable,grossAssets} from './market.mjs';
import {testFriend,testFriends} from './test-friends.mjs';
import {fmtMoney} from './world.mjs';

export async function spyRequest(body=null,query=null){
  try{
    const url=new URL('./api/desk-reports',location.href);
    for(const [key,value] of Object.entries(query??{}))url.searchParams.set(key,value);
    const init={cache:'no-store',signal:AbortSignal.timeout(8500)};
    if(body)Object.assign(init,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const response=await roomFetch(url,init);
    return {status:response.status,value:await response.json()};
  }catch{return {status:0};}
}

const won=n=>fmtMoney(n,'KRW');
export const reportTime=(state,at)=>{
  const {day,minute,cursor}=realTime(at);
  return dayLabel(state,day)+' '+clockText(cursor,true,minute);
};
export const reportName=r=>testFriend(r.botRoom)?.name??'친구 '+Number(r.friendNumber);
function spyTargets(view){
  const members=(view?.targets??[]).map(({slot,number,nickname})=>({value:String(slot),label:nickname||'친구 '+Number(number),ready:view.spyReady?.includes(slot)}));
  return [...members,...testFriends.map(friend=>({value:friend.room,label:friend.name,ready:true}))];
}

export function spyQuote(state,view,target){
  const assets=grossAssets(state),cost=spyFee(assets),available=exchangeable(state,'KRW');
  const ready=spyTargets(view).some(t=>t.value===target&&t.ready);
  return {assets,cost,available,ready,allowed:ready&&state.phase==='open'&&!state.spyPending&&available>=cost};
}

export function spyOffer(state,view,modal){
  const targets=spyTargets(view);
  const target=targets.find(t=>t.value===modal.target)??targets.find(t=>t.ready);
  const quote=spyQuote(state,view,target.value);
  const status=state.spyPending?'결제 확인 중이야. 보고서가 발급되면 보관함에 표시돼.':
    !quote.ready?'친구가 게임에 접속해 투자 기록을 동기화하면 발급할 수 있어.':
    quote.available<quote.cost?'사용 가능한 돈이 '+won(quote.cost-quote.available)+' 부족해.':'';
  return {
    id:'spy',targets,selected:target.value,cost:quote.cost,available:quote.available,assets:quote.assets,
    description:'친구의 최근 게임 3일 체결 내역과 보유 종목을 확인해. 상대에게는 익명 알림이 가.',
    terms:'비용은 100만 원에 내 총자산의 0.5%를 더한 금액이야.',
    status:modal.error||status,action:'결제하고 보고서 발급',disabled:!quote.allowed||modal.pending,quoted:true
  };
}

export function validSpyReport(r){
  return deskRequestId(r?.id)&&Number.isSafeInteger(r.cost)&&Number.isFinite(r.issuedAt)&&
    Number.isFinite(r.capturedAt)&&Array.isArray(r.positions)&&Array.isArray(r.trades);
}
