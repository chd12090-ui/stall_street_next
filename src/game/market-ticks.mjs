import {stocks,snapPrice,isSpot,nyangUnitsPerLegacyCoin} from './securities-data.mjs';

const cache=new Map();
function sample(index,key,salt){
  let n=(Math.imul(index+1,19349663)^Math.imul(key+900001,83492791)^Math.imul(salt+3,15485863))|0;
  n=Math.imul(n^(n>>>16),0x45d9f3b);
  n=Math.imul(n^(n>>>16),0x45d9f3b);
  return ((n^(n>>>16))>>>0)/4294967296;
}

function createPrints(bar,i){
  if(bar.tracking){
    const {input,index,start,anchor,factor,multiplier}=bar.tracking;
    const trades=marketPrints(input,index),count=trades.length;
    return trades.map(({at,price},j)=>{
      const level=snapPrice(i,start*(1+factor*(price/anchor-1)));
      return {at,qty:Math.floor(bar.v*(j+1)/count)-Math.floor(bar.v*j/count),
        price:multiplier?snapPrice(i,level*multiplier):level};
    });
  }
  const asset=stocks[i],coin=isSpot(asset),slots=coin?288:asset.currency==='USD'?78:80;
  const reference=coin?(asset.code==='BIT'?8*nyangUnitsPerLegacyCoin:130):((asset.shares||asset.units||32000000)*.004/slots);
  const activity=Math.min(8,bar.v/Math.max(1,reference));
  const scale=coin?10_000:1,totalLots=Math.round(bar.v*scale);
  const count=Math.min(totalLots,280,Math.round(22+122*Math.sqrt(activity)));
  if(!count)return [];
  if(count<4){
    return Array.from({length:count},(_,j)=>({at:Math.floor((j+.25)*300/count),price:j?bar.c:bar.o,qty:1/scale}));
  }
  const first=Math.max(1,Math.floor((.22+.14*sample(i,bar.key,1))*count));
  const last=Math.min(count-2,Math.max(first+1,Math.floor((.59+.20*sample(i,bar.key,2))*count)));
  const highFirst=sample(i,bar.key,3)<.5;
  const anchors=[[0,bar.o],[first,highFirst?bar.h:bar.l],[last,highFirst?bar.l:bar.h],[count-1,bar.c]];
  const weights=Array.from({length:count},(_,j)=>.4+sample(i,bar.key,j+410)*1.45);
  const total=weights.reduce((sum,v)=>sum+v,0),extra=totalLots-count;
  let segment=1,used=0,weight=0;
  return weights.map((batch,j)=>{
    if(j>anchors[segment][0])segment++;
    const [from,start]=anchors[segment-1],[to,end]=anchors[segment];
    const t=(j-from)/(to-from);
    const noise=(sample(i,bar.key,j+50)-.5)*Math.sin(Math.PI*t)*(bar.h-bar.l)*(.24+.09*Math.sqrt(activity));
    const value=j===to?end:j===from?start:Math.max(bar.l,Math.min(bar.h,snapPrice(i,start+(end-start)*t+noise)));
    // Each print gets its own whole-second interval.
    const begin=Math.floor(300*j/count),endSecond=Math.floor(300*(j+1)/count);
    const at=j===0?0:begin+Math.floor((endSecond-begin)*sample(i,bar.key,j+250));
    weight+=batch;
    const shares=j===count-1?extra:Math.floor(extra*weight/total),qty=1+shares-used;
    used=shares;
    return {at,price:value,qty:qty/scale};
  });
}
export function marketPrints(bar,i){
  if(!bar)return [];
  // Adjusted and base tapes can share a timestamp. Use the actual bar as the cache key.
  if(cache.has(bar))return cache.get(bar);
  const prints=createPrints(bar,i);
  if(cache.size>=128)cache.delete(cache.keys().next().value);
  cache.set(bar,prints);
  return prints;
}
export function tradeTotals(prints,second=299){
  let v=0,pv=0,h=-Infinity,l=Infinity,c=null;
  for(const trade of prints){
    if(trade.at>second)break;
    v+=trade.qty;pv+=trade.price*trade.qty;
    h=Math.max(h,trade.price);l=Math.min(l,trade.price);c=trade.price;
  }
  return v?{o:prints[0].price,h,l,c,v:Math.round(v*1e6)/1e6,pv}:null;
}
