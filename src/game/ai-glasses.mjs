import {accountTick,marketDayOffset,marketElapsed,usesKst} from './clock-calendar.mjs';
import {exchangeable,grossAssets} from './market.mjs';
import {quoteInfo} from './tape.mjs';
import {stocks} from './world.mjs';

export const aiGlassesBasePrice=2_000_000,aiGlassesAssetPercent=2,aiGlassesAccuracy=60;
const hour=3600,daySeconds=24*hour;

export const glassesPrice=state=>aiGlassesBasePrice+Math.round(grossAssets(state)*aiGlassesAssetPercent/100);
export function glassesPurchases(state){
  if(state.glassesPurchases)return state.glassesPurchases;
  if(!state.aiGlasses)return [];
  const {day,step,seq,cost}=state.aiGlasses;
  return [{day,step,seq,cost}];
}
export function hasGlasses(state){
  const latest=glassesPurchases(state).at(-1);
  return Boolean(latest&&!latest.used);
}
function savePurchases(state,purchases){
  state.glassesPurchases=purchases;
  delete state.aiGlasses;
}
export function buyGlasses(state,offeredPrice){
  if(hasGlasses(state))return '아직 사용하지 않은 AI 안경이 있어.';
  const cost=glassesPrice(state);
  if(!Number.isSafeInteger(offeredPrice)||cost>offeredPrice)return '가격이 바뀌었어. 새 가격을 확인하고 다시 눌러 줘.';
  if(exchangeable(state,'KRW')<cost)return '사용할 수 있는 원화가 부족해.';
  state.cash-=cost;
  state.startWealth-=cost;
  state.cashSequence++;
  savePurchases(state,[...glassesPurchases(state),{day:state.day,step:state.cursor,seq:state.cashSequence,cost}]);
  return '';
}

function timeOfQuote(state){
  return usesKst(state)
    ? accountTick(state.day,state.cursor,marketElapsed(state)??0)
    : accountTick(state.day,state.cursor+marketDayOffset);
}

function stateAt(state,time){
  const live=usesKst(state),tick=live?time:time-marketDayOffset*300;
  const day=Math.floor(tick/daySeconds),seconds=tick-day*daySeconds;
  return {...state,day,cursor:Math.floor(seconds/300),phase:'open',
    wallMinute:Math.floor(seconds/60),wallSecond:seconds%60};
}

export function forecastWithGlasses(state,index,random=Math.random){
  const asset=stocks[index];
  if(!hasGlasses(state)||!asset||asset.archiveOnly)return null;
  const now=timeOfQuote(state);

  const price=quoteInfo(state,index).price,until=now+hour;
  const futurePrice=quoteInfo(stateAt(state,until),index).price;
  if(!(price>0&&futurePrice>0))return null;
  if(price===futurePrice)return {from:now,until,price,up:null};
  const rises=futurePrice>price;
  const up=random()<aiGlassesAccuracy/100?rises:!rises;
  const purchases=glassesPurchases(state);
  savePurchases(state,[...purchases.slice(0,-1),{...purchases.at(-1),used:true}]);
  return {from:now,until,price,up};
}
