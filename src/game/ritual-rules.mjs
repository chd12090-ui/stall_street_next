import {marketProduct,stocks,symbolIndex} from './securities-data.mjs';

export {ritualDanceMs} from './ritual-choreography.mjs';
export function ritualTarget(code){
  if(!Object.hasOwn(symbolIndex,code))return false;
  const asset=stocks[symbolIndex[code]];
  return !asset.archiveOnly&&asset.kind==='주식';
}
export const ritualCostPercent=5;
export const ritualMarketCapPercent=.0001;
export const ritualDailyLimitMessage='오늘은 이미 살굿을 치렀어. 다음 날 다시 와.';
export const ritualChancePerPoint=.9;
export const ritualImpactBps=Object.freeze({min:250,max:1000});
export const ritualCost=(assets,marketCap)=>Math.round(Math.max(0,assets)*ritualCostPercent/100+marketCap*ritualMarketCapPercent/100);
export const ritualChance=mental=>Math.min(100,Math.max(0,mental))*ritualChancePerPoint;
export function ritualRandom(){
  return crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
}
export function drawRitualOutcome(chance,random=ritualRandom){
  if(random()*100>=chance)return {success:false,bps:0};
  const {min,max}=ritualImpactBps;
  return {success:true,bps:min+Math.floor(random()*(max-min+1))};
}
export const ritualArticleId=id=>'ritual-'+id;
export const ritualPercent=n=>n.toLocaleString('ko-KR',{maximumFractionDigits:3});

export function mergeRitualEvents(state,incoming){
  if(!incoming?.length)return false;
  const previous=state.ritualEvents??[],seen=new Set(previous.map(row=>row.id)),fresh=[];
  for(const row of incoming){
    // Published shocks from the old offering rules still belong to the room's tape.
    if(!row||typeof row.id!=='string'||seen.has(row.id)||!Object.hasOwn(symbolIndex,row.code)||
      marketProduct(stocks[symbolIndex[row.code]])!=='stocks'||!Number.isSafeInteger(row.tick)||
      !Number.isInteger(row.bps)||row.bps<0||row.bps>ritualImpactBps.max)continue;
    seen.add(row.id);fresh.push({id:row.id,code:row.code,tick:row.tick,minuteOffset:row.minuteOffset??0,bps:row.bps});
  }
  if(!fresh.length)return false;
  state.ritualEvents=[...previous,...fresh].sort((a,b)=>a.tick-b.tick||(a.minuteOffset??0)-(b.minuteOffset??0)||a.id.localeCompare(b.id));
  return true;
}
