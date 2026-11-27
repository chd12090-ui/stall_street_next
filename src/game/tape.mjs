import {ritualPressure,pressuredBars} from './ritual-prices.mjs';
import {historySignature,unpackHistory} from './chart-archive-codec.mjs';
import {fundHistoryLoaders} from './fund-history/index.mjs';
import {snapPrice as nativePrice} from './world.mjs';
import {stocks,markets,currencies,isSpot,eventsBetween,symbolIndex,previousSession,runsOn,stepsPerDay} from './world.mjs';
import {tapePrice,nyangUnitsPerLegacyCoin,fundTracking,trackedFundMember} from './securities-data.mjs';
import {fxRates} from './fx.mjs';
import {civilDate,continuousTradingDay,dayLabel,marketClock,marketElapsed,usesKst,weekStart} from './clock-calendar.mjs';
import {marketPrints,tradeTotals} from './market-ticks.mjs';
export const barsPerDay=stepsPerDay, intradayHistory=90;
export const timeframes=[['T','틱'],['1','1분'],['5','5분'],['10','10분'],['15','15분'],['30','30분'],['60','60분'],['120','120분'],['240','240분'],['D','일'],['W','주'],['M','월'],['Y','1년'],['3Y','3년'],['A','전체']];
export const money=n=>Math.round((n+Number.EPSILON)*100)/100;
export const isIntraday=tf=>['T','1','5','10','15','30','60','120','240'].includes(tf);
export const retainedSessions=tf=>tf==='T'?3:tf==='1'?20:intradayHistory;
const epoch=Date.UTC(2026,10,16),msDay=86400000;
export function clock(step){const m=((540+step*5)%1440+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}
export const tapeCivilDay=(day,step)=>day+Math.floor((540+step*5)/1440);
export function calendar(day,step=0,state={}){return dayLabel(state,tapeCivilDay(day,step))+' '+clock(step);}
const pad=n=>String(n).padStart(2,'0');
export function stamp(b,intra=false){
  const openingSeconds=Math.round((540+b.step*5)*60);
  const d=b.day+(intra?Math.floor(openingSeconds/86400):0);
  const date=new Date(epoch+d*msDay).toISOString().slice(0,10).replaceAll('-','.');
  if(!intra)return date;
  const seconds=openingSeconds%86400;
  return date+' '+pad(Math.floor(seconds/3600))+':'+pad(Math.floor(seconds/60)%60)+(b.tradeTick?':'+pad(seconds%60):'');
}
export function candlePeriod(bar,tf){
  if(tf==='W')return civilDate(weekStart(bar.day)).replaceAll('-','.')+' 주';
  const date=stamp(bar,isIntraday(tf));
  if(tf==='Y')return date.slice(0,4)+'년';
  if(tf==='3Y'){
    const year=Math.floor(Number(date.slice(0,4))/3)*3;
    return year+'–'+(year+2)+'년';
  }
  if(tf==='M')return date.slice(0,7);
  return isIntraday(tf)?date.slice(5):date;
}
function hash(seed){let n=seed|0;n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;}
const rand=(i,d,k)=>hash(Math.imul(i+1,174763)+Math.imul(d+2000,12109)+Math.imul(k+13,15485863));
const flowStartDay=(Date.UTC(2026,10,21)-epoch)/msDay;
const flowBaskets=new Map(['MOR2','ATE2'].flatMap(code=>{
  const fund=symbolIndex[code];
  return stocks[fund].reference.map(member=>[member,fund]);
}));
// Occasional institutional flows move the underlying basket together. Each fund
// still earns its published daily multiple of the actual constituent returns.
function basketFlow(code,day,slots){
  const fund=flowBaskets.get(code);
  if(day<flowStartDay||fund===undefined)return null;
  // Match inflows with outflows so the extra volatility does not create a permanent price trend.
  const block=Math.floor(day/8),session=day%8;
  const inflow=Math.floor(8*rand(fund,block,1301));
  const outflow=(inflow+1+Math.floor(7*rand(fund,block,1302)))%8;
  if(session!==inflow&&session!==outflow)return null;
  const magnitude=.083+.020*rand(fund,block,3402);
  const start=Math.floor(slots*(.12+.45*rand(fund,day,3403)));
  const duration=8;
  return {start,end:start+duration,perBar:(session===inflow?magnitude:-magnitude)/duration};
}
const past=stocks.map(()=>null),pastFunds=stocks.map(()=>null),liveBooks=stocks.map(()=>new Map());
const liveCloses=stocks.map(()=>({through:-1,values:[]}));
const firstDays=stocks.map(s=>Math.floor((Date.parse((s.listed||'2022-11-16')+'T00:00:00Z')-epoch)/msDay));
export const listingDay=i=>firstDays[i];
const historyInfo=new Map(),dailyFundCache=new Map();
function cacheSet(map,key,value,capacity){if(map.size>=capacity)map.delete(map.keys().next().value);map.set(key,value);return value;}
const previousIndex=[];
function makeSchedule(steps){
  const index=new Int16Array(288).fill(-1),until=new Int16Array(289);let j=0;
  steps.forEach((step,k)=>index[step]=k);
  for(let t=0;t<=288;t++){while(j<steps.length&&steps[j]<t)j++;until[t]=j;}
  return {steps,index,until,start:steps[0],end:steps.at(-1)+1};
}
const historicalSchedules=Object.fromEntries(Object.entries(markets).map(([name,market])=>[
  name,makeSchedule(market.sessions.flatMap(([start,end])=>Array.from({length:end-start},(_,step)=>start+step))),
]));
const continuousSchedule=makeSchedule(Array.from({length:barsPerDay},(_,step)=>step));
export const schedule=(i,day)=>day>=continuousTradingDay?continuousSchedule:historicalSchedules[stocks[i].market];
function dailyTurnoverUnits(i,day){
  const s=stocks[i],r=rand(i,day,6);
  if(isSpot(s))return s.code==='BIT'?Math.round(1500+2700*r):Math.round(20000+51000*r);
  if(s.floatShares)return Math.round(s.floatShares*(.5+1.5*r));
  if(s.bond)return Math.round(s.units*(.001+.003*r));
  return Math.round((s.shares||32000000)*(.0014+.0046*r));
}
const baseVol=i=>stocks[i].kind==='현물 코인' ? .010 : .0048;
// The thin float can turn over several times on a rush. Closing levels follow a
// bounded valuation cycle so repeated squeezes don't compound into runaway prices.
function lowFloatClose(i,day){
  const cycle=.31*Math.sin(day*.17)+.19*Math.cos(day*.09);
  const repricing=(rand(i,day,3010)-.5)*.64;
  return tapePrice(i,stocks[i].base*Math.exp(cycle+repricing));
}
function lowFloatSession(i,day){
  const stock=stocks[i],steps=schedule(i,day).steps,n=steps.length;
  const sample=key=>rand(i,day,key),price=value=>tapePrice(i,value);
  const prior=day===firstDays[i]?stock.base:lowFloatClose(i,previousSession(stock.market,day));
  const open=price(prior*(.94+.12*sample(3011))),close=lowFloatClose(i,day);
  const firstUp=sample(3012)<.56,secondUp=sample(3013)<.68?!firstUp:firstUp;
  function burst(peak,up,seed){
    const rise=1+Math.floor(4*sample(seed)),hold=1+Math.floor(4*sample(seed+1));
    const fall=2+Math.floor(8*sample(seed+2));
    const multiple=up?1.3+.66*sample(seed+3):.34+.37*sample(seed+3);
    return {start:peak-rise,peak,release:peak+hold,end:peak+hold+fall,target:Math.log(multiple)};
  }
  const bursts=[burst(Math.floor(n*(.11+.23*sample(3014))),firstUp,3030),
    burst(Math.floor(n*(.56+.25*sample(3015))),secondUp,3040)];
  const lots=dailyTurnoverUnits(i,day)/n;
  let last=open;
  return steps.map((step,k)=>{
    const t=k+1,f=t/n;
    let level=Math.log(open/prior)+Math.log(close/open)*f;
    const active=bursts.find(b=>t>=b.start&&t<=b.end);
    let weight=0;
    if(active){
      weight=Math.min(1,(t-active.start)/(active.peak-active.start),(active.end-t)/(active.end-active.release));
      level+=(active.target-level)*weight;
    }
    const jitter=(sample(3100+k)-.5)*.055*Math.sin(Math.PI*f)*(1-.85*weight);
    const o=last,c=t===n?close:price(prior*Math.exp(level+jitter));
    const move=Math.abs(Math.log(c/o)),wick=.008+Math.min(.010,move*.12);
    const h=price(Math.max(o,c)*(1+wick*sample(3200+k))),l=price(Math.min(o,c)*(1-wick*sample(3300+k)));
    const v=Math.max(1,Math.round(lots*(.3+sample(3400+k))*(1+move*6+(active ? .8 : 0))));
    last=c;
    return {day,step,key:day*288+step,o,h,l,c,v,pv:(h+l+c)*v/3,partial:false};
  });
}
// Keep only one scalar per historical close. Listing a quote should not allocate decades of candles.
function historicalClose(i,day){
  const s=stocks[i],base=s.tape?.base??s.base;
  if(s.floatShares)return lowFloatClose(i,day);
  if(s.bond){
    const rateChange=.0022*Math.sin(day/15)+.0008*Math.sin(day/7)+.0012*(rand(i,day,201)-.5);
    return tapePrice(i,base*Math.exp(-s.bond.term*rateChange));
  }
  const book=past[i]??={cursor:0,next:base,closes:new Float64Array(Math.max(16,-firstDays[i]+16))};
  const growth=isSpot(s)?.28:.016+rand(i,0,114)*.046;
  while(book.cursor>day){
    const d=--book.cursor;
    if(!runsOn(s.market,d))continue;
    book.closes[-d]=book.next;
    const age=Math.max(0,(-d-365)/365.25);
    const anchor=base*Math.exp(-growth*age+.16*Math.sin(age*.72)*Math.min(1,age));
    book.next=tapePrice(i,book.next*Math.exp((rand(i,d,1)+rand(i,d,2)-1)*.05+.012*Math.log(anchor/book.next)));
  }
  return book.closes[-day]||base;
}
function pastInfo(i,day){
  const key=i+'/'+day,cached=historyInfo.get(key);if(cached)return cached;
  const s=stocks[i],sc=schedule(i,day),price=n=>tapePrice(i,n);
  const close=historicalClose(i,day),prior=historicalClose(i,previousSession(s.market,day));
  const range=s.bond ? .08 : 1;
  const o=price(prior*(1+(rand(i,day,3)-.5)*.017*range));
  const h=price(Math.max(o,close)*(1+(.005+rand(i,day,4)*.032)*range));
  const l=price(Math.min(o,close)*(1-(.005+rand(i,day,5)*.030)*range));
  const n=sc.steps.length,v=dailyTurnoverUnits(i,day),a=Math.floor(n*(.18+.18*rand(i,day,7))),b=Math.floor(n*(.62+.20*rand(i,day,8))),up=rand(i,day,9)>.5;
  const bar={o,h,l,c:close,v,day,step:sc.start,key:day*288+sc.start,partial:false};
  return cacheSet(historyInfo,key,{bar,a,b,up,n},1024);
}
function pastBar(i,day,k){
  const price=n=>tapePrice(i,n),{bar,a,b,up,n}=pastInfo(i,day),range=bar.h-bar.l,sc=schedule(i,day),step=sc.steps[k];
  const at=t=>{
    if(t===0)return bar.o;if(t===n)return bar.c;
    const hi=up?bar.h:bar.l,lo=up?bar.l:bar.h;
    const v=t<=a?[0,a,bar.o,hi]:t<=b?[a,b,hi,lo]:[b,n,lo,bar.c];
    const f=(t-v[0])/(v[1]-v[0]);
    return price(Math.max(bar.l,Math.min(bar.h,v[2]+(v[3]-v[2])*f+(rand(i,day,t+41)-.5)*range*.20*Math.sin(Math.PI*f))));
  };
  const o=at(k),c=at(k+1),h=price(Math.min(bar.h,Math.max(o,c)+range*.034*rand(i,day,2*k+350))),l=price(Math.max(bar.l,Math.min(o,c)-range*.034*rand(i,day,2*k+351)));
  const vol=t=>Math.round(bar.v*(t/n+.24*Math.sin(2*Math.PI*t/n)/(2*Math.PI)));
  const v=vol(k+1)-vol(k);return {day,step,key:day*288+step,o,h,l,c,v,pv:(h+l+c)*v/3,partial:false};
}
function rawClose(i,day){
  if(day<0)return historicalClose(i,day);
  seedLive(day,i);
  return liveCloses[i].values[day];
}
function rawSession(day,i){
  const price=n=>tapePrice(i,n),s=stocks[i],sc=schedule(i,day),pday=previousSession(s.market,day);
  const unitVolume=dailyTurnoverUnits(i,day)/sc.steps.length/1.8;
  const flow=basketFlow(s.code,day,sc.steps.length);
  let last=rawClose(i,pday),prev=pday*288+schedule(i,pday).steps.at(-1),memory=0,momentum=0;
  const chronological=eventsBetween(prev,day*288+sc.end-1).filter(e=>e.shock[s.code]);let eidx=0;
  return sc.steps.map((step,k)=>{
    const tick=day*288+step;let fresh=flow&&k>=flow.start&&k<flow.end?flow.perBar:0;
    while(eidx<chronological.length&&chronological[eidx].tick<=tick)fresh+=chronological[eidx++].shock[s.code];
    const gap=tick-prev>1,openPart=gap?fresh*.53:0;
    const o=gap?price(last*Math.exp(openPart+(rand(i,day,k+859)-.5)*.008)):last;
    memory+=fresh-openPart;const response=memory*.26;memory-=response;
    const sigma=baseVol(i);
    const broad=(rand(40,day,step+7)-.5)*sigma*.65;
    momentum=momentum*.21+(rand(i,day,k+151)-.5)*sigma*1.65+broad;
    const c=price(o*Math.exp(momentum+response)),h=price(Math.max(o,c)*(1+sigma*(.07+.55*rand(i,day,k+410)))),l=price(Math.min(o,c)*(1-sigma*(.06+.53*rand(i,day,k+609))));
    const edge=Math.abs((k+.5)/sc.steps.length-.5)*2;
    const v=Math.max(1,Math.round(unitVolume*(1+edge*1.6)*(1+Math.min(5,Math.abs(response)*110+Math.abs(fresh)*48))*(.6+rand(i,day,k+992))));
    last=c;prev=tick;
    return {day,step,key:tick,o,h,l,c,v,pv:(h+l+c)*v/3,partial:false};
  });
}
function sourceBar(i,day,k){
  const stock=stocks[i];
  return day<0&&!stock.floatShares&&!stock.reference?pastBar(i,day,k):sourceSessionBars(day,i)[k];
}
function underClose(i,day,edge){
  const m=stocks[i].market,sc=schedule(i,day),n=runsOn(m,day)?sc.until[edge]:0;
  if(n&&n!==sc.steps.length)return sourceBar(i,day,n-1).c;
  const closeDay=n?day:previousSession(m,day);
  return stocks[i].reference?lastClose(i,closeDay):rawClose(i,closeDay);
}
const members=i=>previousIndex[i]??=stocks[i].reference.map(c=>symbolIndex[c]);
function historicalFundClose(i,day){
  const s=stocks[i],sc=schedule(i,day),ids=members(i);
  const book=pastFunds[i]??={cursor:0,next:s.base,closes:new Float64Array(Math.max(16,-firstDays[i]+16))};
  while(book.cursor>day){
    const d=--book.cursor;
    if(!runsOn(s.market,d))continue;
    const prev=previousSession(s.market,d);
    book.closes[-d]=book.next;
    const ret=ids.reduce((sum,j)=>sum+underClose(j,d,sc.end)/underClose(j,prev,sc.end)-1,0)/ids.length;
    book.next=book.next/Math.max(.01,1+s.factor*ret);
  }
  return book.closes[-day]||s.base;
}
function fundBase(day,i,ids){
  const s=stocks[i],sc=schedule(i,day),prev=previousSession(s.market,day);
  const start=s.dailyFund&&prev<firstDays[i]?s.base:prev<0?historicalFundClose(i,prev):rawClose(i,prev);
  return {start,anchor:ids.map(j=>underClose(j,prev,sc.end)),close:day<0?historicalFundClose(i,day):null};
}
function resetFundBar(bar,i,input,index,start,anchor,factor){
  const level=key=>nativePrice(i,start*(1+factor*(input[key]/anchor-1)));
  const o=level('o'),c=level('c'),h=Math.max(o,c,level(factor>0?'h':'l')),l=Math.min(o,c,level(factor>0?'l':'h'));
  // Individual trades share the underlying's timestamps. Allow one lot for each possible print.
  const v=Math.max(280,bar.v);
  return {...bar,o,h,l,c,v,pv:(h+l+c)*v/3,tracking:{input,index,start,anchor,factor}};
}
function fundSession(day,i){
  const price=n=>nativePrice(i,n),s=stocks[i],terms=fundTracking(s,day);
  const ids=terms===s?members(i):terms.reference.map(code=>symbolIndex[code]);
  const {factor}=terms,sc=schedule(i,day),{start,anchor,close}=fundBase(day,i,ids);
  const followsPrints=s.dailyFund||terms!==s;
  return sc.steps.map((step,k)=>{
    const inputs=ids.map(j=>sourceBar(j,day,schedule(j,day).index[step]));
    const level=key=>price(start*(1+factor*inputs.reduce((sum,bar,j)=>sum+bar[key]/anchor[j]-1,0)/ids.length));
    const o=level('o'),c=k===sc.steps.length-1&&close!=null?price(close):level('c');
    const h=Math.max(o,c,level(factor>0?'h':'l')),l=Math.min(o,c,level(factor>0?'l':'h'));
    const activity=inputs.reduce((sum,b,j)=>sum+(isSpot(stocks[ids[j]])?b.v*b.c/c*.06:b.v),0)/ids.length;
    const v=Math.max(1,Math.round(activity*(.28+.65*rand(i,day,k))));
    const bar={day,step,key:day*288+step,o,h,l,c,v,pv:(h+l+c)*v/3,partial:false};
    return followsPrints?resetFundBar(bar,i,inputs[0],ids[0],start,anchor[0],factor):bar;
  });
}
function optionPrice(i,underlyingPrice){
  const {side,strike,premium}=stocks[i].option;
  const exerciseValue=(underlyingPrice-strike)*(side==='call'?1:-1);
  // A smooth premium preserves some value outside the strike on the simulated tape.
  return nativePrice(i,(exerciseValue+Math.hypot(exerciseValue,2*premium))/2);
}
function optionSession(day,i,pressure){
  const {underlying,side}=stocks[i].option;
  return sessionBars(day,symbolIndex[underlying],pressure).map((bar,k)=>{
    const o=optionPrice(i,bar.o),c=optionPrice(i,bar.c);
    const h=optionPrice(i,side==='call'?bar.h:bar.l),l=optionPrice(i,side==='call'?bar.l:bar.h);
    const v=Math.max(1,Math.round(bar.v*(.006+.012*rand(i,day,k))));
    return {...bar,o,h,l,c,v,pv:(h+l+c)*v/3};
  });
}
const recentHistory=new Map();
function makeSession(day,i){
  if(stocks[i].option)return optionSession(day,i);
  if(stocks[i].reference)return fundSession(day,i);
  if(stocks[i].floatShares)return lowFloatSession(i,day);
  return day<0||stocks[i].bond?schedule(i,day).steps.map((_,k)=>pastBar(i,day,k)):rawSession(day,i);
}
function seedLive(day,i){
  const book=liveCloses[i],cache=liveBooks[i];
  while(book.through<day){
    const current=++book.through;
    if(current<firstDays[i]||!runsOn(stocks[i].market,current))continue;
    const rows=makeSession(current,i);
    book.values[current]=rows.at(-1).c;
    cacheSet(cache,current,rows,60);
  }
}
export function sourceSessionBars(day,i){
  if(day<firstDays[i]||!runsOn(stocks[i].market,day))return [];
  if(day<0){
    const key=i+'/'+day;if(recentHistory.has(key))return recentHistory.get(key);
    const data=makeSession(day,i);
    if(day>=-145)cacheSet(recentHistory,key,data,112);
    return data;
  }
  seedLive(day,i);
  const cache=liveBooks[i];
  return cache.get(day)??cacheSet(cache,day,makeSession(day,i),60);
}
const convertedSessions=new WeakMap();
const pressuredOptionSessions=new WeakMap();
const trackedSessions=new Map();
const dollarRate=(day,step)=>day<0?currencies.USD.base:fxRates(day,step).USD;
function dollarBar(i,bar){
  const rate=dollarRate(bar.day,bar.step),price=p=>nativePrice(i,p/(rate*nyangUnitsPerLegacyCoin));
  return {...bar,o:price(bar.o),h:price(bar.h),l:price(bar.l),c:price(bar.c),v:bar.v*nyangUnitsPerLegacyCoin,pv:bar.pv/rate};
}
export function instrumentPressure(events,i){
  const own=ritualPressure(events,i),member=trackedFundMember(stocks[i]);
  if(!member)return own;
  const underlying=ritualPressure(events,symbolIndex[member]);
  return underlying.steps.length?{...own,underlying,key:own.key+'|'+underlying.key}:own;
}
function trackedSession(day,i,bars,pressure){
  const tracking=bars[0]?.tracking;
  if(!tracking||!pressure?.steps.length||bars.at(-1).key<pressure.steps[0].from)return bars;
  const key=i+'/'+day+'/'+pressure.key;
  const cached=trackedSessions.get(key);
  if(cached)return cached;
  const previous=previousSession(stocks[i].market,day);
  const prior=trackedSession(previous,i,sourceSessionBars(previous,i),pressure);
  const start=prior.at(-1)?.c??tracking.start;
  const anchor=lastClose(tracking.index,previous,pressure)??tracking.anchor;
  const underlying=sessionBars(day,tracking.index,pressure);
  const rows=bars.map((bar,j)=>resetFundBar(bar,i,underlying[j],tracking.index,start,anchor,tracking.factor));
  return cacheSet(trackedSessions,key,rows,96);
}
export function sessionBars(day,i,pressure){
  const bars=sourceSessionBars(day,i);
  if(stocks[i].option){
    if(!pressure?.steps.length||!bars.length||bars.at(-1).key<pressure.steps[0].from)return bars;
    const cached=pressuredOptionSessions.get(bars);
    if(cached?.key===pressure.key)return cached.rows;
    const rows=optionSession(day,i,pressure);
    pressuredOptionSessions.set(bars,{key:pressure.key,rows});
    return rows;
  }
  if(!stocks[i].tape||!bars.length)return pressuredBars(trackedSession(day,i,bars,pressure?.underlying),i,pressure);
  if(!convertedSessions.has(bars))convertedSessions.set(bars,bars.map(bar=>dollarBar(i,bar)));
  return pressuredBars(convertedSessions.get(bars),i,pressure);
}
export function combine(bars,partial=false){
  const first=bars[0],last=bars.at(-1);let h=first.h,l=first.l,v=0,pv=0;
  for(const b of bars){h=Math.max(h,b.h);l=Math.min(l,b.l);v+=b.v;pv+=b.pv||0;}
  return {day:first.day,step:first.step,key:first.key,o:first.o,h,l,c:last.c,v,pv,partial};
}
export function fullDay(i,d,pressure){
  if(d<firstDays[i]||!runsOn(stocks[i].market,d))return null;
  if(d<0&&!stocks[i].reference&&!stocks[i].floatShares&&!stocks[i].option){
    const bar=pastInfo(i,d).bar;
    return stocks[i].tape?dollarBar(i,{...bar,pv:(bar.h+bar.l+bar.c)*bar.v/3}):bar;
  }
  const key=i+'/'+d+'/'+(pressure?.key??''),cached=dailyFundCache.get(key);if(cached)return cached;
  return cacheSet(dailyFundCache,key,combine(sessionBars(d,i,pressure)),4096);
}
export function lastClose(i,day,pressure){
  if(day<firstDays[i])return null;
  if([pressure?.steps[0],pressure?.underlying?.steps[0]].some(step=>step&&day*288+287>=step.from)&&
    runsOn(stocks[i].market,day))return sessionBars(day,i,pressure).at(-1)?.c??null;
  const s=stocks[i];
  if(s.tape){
    const close=rawClose(i,day);
    return nativePrice(i,close/(dollarRate(day,schedule(i,day).steps.at(-1))*nyangUnitsPerLegacyCoin));
  }
  if(s.option&&day<0){
    const price=lastClose(symbolIndex[s.option.underlying],day);
    return price===null?null:optionPrice(i,price);
  }
  if(day<0)return s.reference?nativePrice(i,historicalFundClose(i,day)):historicalClose(i,day);
  return runsOn(s.market,day)?rawClose(i,day):s.base;
}
export function barAt(i,day,step,pressure){
  const k=schedule(i,day).index[step];
  return k>=0&&day>=firstDays[i]&&runsOn(stocks[i].market,day)?sessionBars(day,i,pressure)[k]:null;
}
function obs(state,i){
  const s=stocks[i],day=state.day,sc=schedule(i,day),t=state.cursor??0;
  if(runsOn(s.market,day)){
    const n=sc.until[t];
    if(t<288&&sc.index[t]>=0&&(t===sc.start||sc.index[t-1]<0)&&state.phase!=='closed')return {day,n,open:true};
    if(n)return {day,n,open:false};
  }
  const prior=previousSession(s.market,day);
  return {day:prior,n:schedule(i,prior).steps.length,open:false};
}
function currentPrints(i,clock,second,pressure){
  if(second===null)return null;
  const bar=barAt(i,clock.day,clock.cursor,pressure);
  return bar?{bar,second,prints:marketPrints(bar,i)}:null;
}
function lastObservedPrice(clock,i,o,pressure){
  if(o.day<firstDays[i])return null;
  if(o.open)return barAt(i,o.day,clock.cursor,pressure).o;
  return o.n===schedule(i,o.day).steps.length?lastClose(i,o.day,pressure):sessionBars(o.day,i,pressure)[o.n-1].c;
}
export function quoteAt(state,i){
  const clock=marketClock(state),pressure=instrumentPressure(state.ritualEvents,i),second=marketElapsed(state);
  // Regular bars with four or more lots always print their opening price at second zero.
  // Catch-up visits every bar boundary; avoid allocating the full list of prints.
  if(second===0){
    const bar=barAt(i,clock.day,clock.cursor,pressure);
    if(bar&&!bar.tracking&&Math.round(bar.v*(isSpot(stocks[i])?10000:1))>=4)return bar.o;
  }
  const live=currentPrints(i,clock,second,pressure);
  if(live){
    const tape=live.prints;
    let lo=0,hi=tape.length;
    while(lo<hi){
      const mid=(lo+hi)>>>1;
      if(tape[mid].at<=live.second)lo=mid+1;
      else hi=mid;
    }
    if(lo)return tape[lo-1].price;
  }
  return lastObservedPrice(clock,i,obs(clock,i),pressure);
}
const sessionTotals=new WeakMap(),lastQuotes=[];
const unavailableQuote={price:null,change:0,pct:0,volume:0,asOf:null,turnover:0};
function completedTotals(day,i,n,exact,pressure){
  if(!n)return {v:0,pv:0};
  const rows=sessionBars(day,i,pressure);
  if(!exact){
    let v=0,pv=0;
    for(let j=0,end=Math.min(n,rows.length);j<end;j++){
      v+=rows[j].v;
      pv+=rows[j].pv;
    }
    return {v,pv};
  }
  let prefix=sessionTotals.get(rows);
  if(!prefix){prefix=[{v:0,pv:0}];sessionTotals.set(rows,prefix);}
  while(prefix.length<=n){
    const row=rows[prefix.length-1],prev=prefix.at(-1);
    const trades=tradeTotals(marketPrints(row,i));
    prefix.push({v:prev.v+(trades?.v??0),pv:prev.pv+(trades?.pv??0)});
  }
  return prefix[n];
}
export function quoteInfo(state,i){
  const clock=marketClock(state),o=obs(clock,i),pressure=instrumentPressure(state.ritualEvents,i);
  const venue=stocks[i].market,sc=schedule(i,clock.day);
  const second=sc.index[clock.cursor]>=0&&clock.day>=firstDays[i]&&runsOn(venue,clock.day)?marketElapsed(state):null;
  const liveSlot=second===null?null:clock.day*barsPerDay+clock.cursor;
  const exact=usesKst(state),cached=lastQuotes[i];
  // All players see the same quote at the same market tick.
  if(cached&&cached.pressure===pressure.key&&cached.day===o.day&&cached.n===o.n&&cached.open===o.open&&
    cached.liveSlot===liveSlot&&cached.second===second&&cached.exact===exact)return {...cached.quote};
  const live=currentPrints(i,clock,second,pressure);
  const partial=live?tradeTotals(live.prints,live.second):null;
  const p=partial?.c??lastObservedPrice(clock,i,o,pressure);
  let quote=unavailableQuote;
  if(p!==null){
    const day=live?.bar.day??o.day,count=live?sc.until[clock.cursor]:o.n;
    const prev=lastClose(i,previousSession(venue,day),pressure)??(stocks[i].dailyFund?stocks[i].base:sessionBars(day,i,pressure)[0].o);
    const sums=completedTotals(day,i,count,exact&&day>=0,pressure);
    quote={price:p,change:money(p-prev),pct:100*(p/prev-1),volume:sums.v+(partial?.v??0),asOf:day,turnover:sums.pv+(partial?.pv??0)};
  }
  lastQuotes[i]={...o,pressure:pressure.key,liveSlot,second,exact,quote};
  return {...quote};
}
// The exchange rows use only recent observed five-minute closes and the current quote.
// A partially traded bar's final close belongs to the future and must stay off the chart.
const recentQuotes=[];
export function quoteTrend(state,i,quote=quoteInfo(state,i)){
  if(quote.asOf===null||quote.price===null)return [];
  const clock=marketClock(state),day=quote.asOf,sc=schedule(i,day);
  const current=clock.day===day;
  const count=current?sc.until[clock.cursor]:sc.steps.length;
  const live=current&&sc.index[clock.cursor]>=0&&(marketElapsed(state)!==null||obs(clock,i).open);
  const pressure=instrumentPressure(state.ritualEvents,i),cached=recentQuotes[i];
  if(cached&&cached.day===day&&cached.count===count&&cached.live===live&&
    cached.price===quote.price&&cached.pressure===pressure.key)return cached.prices;
  const limit=24,slots=limit-Number(live);
  const prices=sessionBars(day,i,pressure).slice(Math.max(0,count-slots),count).map(bar=>bar.c);
  if(prices.length<slots){
    const previous=previousSession(stocks[i].market,day);
    const before=sessionBars(previous,i,pressure).slice(prices.length-slots);
    prices.unshift(...before.map(bar=>bar.c));
  }
  if(live||!prices.length)prices.push(quote.price);
  recentQuotes[i]={day,count,live,price:quote.price,pressure:pressure.key,prices};
  return prices;
}
export function historyClosePrices(day){return stocks.map((s,i)=>lastClose(i,previousSession(s.market,day)));}
const lastSeries=new Map();
function grouped(input,period,partial){
  let sumV=0,sumPV=0;const out=[];
  for(let j=0;j<input.length;){
    let end=j+1;while(end<input.length&&end-j<period&&input[end].step===input[end-1].step+1)end++;
    const b=combine(input.slice(j,end),partial&&end===input.length&&end-j<period);
    sumV+=b.v;sumPV+=b.pv;b.vwap=sumV?sumPV/sumV:null;out.push(b);j=end;
  }return out;
}

function printBars(bar,i,tf,cutoff=299){
  const ticks=marketPrints(bar,i).filter(trade=>trade.at<=cutoff).map(trade=>{
    const price=trade.price,fraction=trade.at/300;
    return {day:bar.day,step:bar.step+fraction,key:bar.key+fraction,o:price,h:price,l:price,c:price,v:trade.qty,pv:price*trade.qty,partial:false,tradeTick:true};
  });
  if(tf==='T')return ticks;
  const minutes=[];
  for(let minute=0;minute<5&&minute*60<=cutoff;minute++){
    const sample=ticks.filter(tick=>Math.floor(Math.round((tick.step-bar.step)*300)/60)===minute);
    if(!sample.length)continue;
    const candle=combine(sample,cutoff<(minute+1)*60-1),fraction=minute/5;
    candle.step=bar.step+fraction;candle.key=bar.key+fraction;
    minutes.push(candle);
  }
  return minutes;
}
function fineGrouped(bars,i,tf){
  let volume=0,turnover=0;
  return bars.flatMap(bar=>printBars(bar,i,tf).map(part=>{
    volume+=part.v;turnover+=part.pv;
    part.vwap=volume?turnover/volume:null;
    return part;
  }));
}
const dailyArchive=new Map();
const fundArchives=new Map();

export function fundHistoryReady(i){
  return !fundHistoryLoaders[stocks[i]?.code]||fundArchives.get(i)?.ready===true;
}

export function loadFundHistory(i){
  const asset=stocks[i];
  const load=fundHistoryLoaders[asset?.code];
  if(!load)return Promise.resolve();
  const pending=fundArchives.get(i);
  if(pending)return pending.promise;

  const entry={ready:false,packed:null};
  entry.promise=load().then(({default:record})=>{
    if(record[0]!==historySignature(asset,stocks,markets)||typeof record[1]!=='string')return;
    entry.packed=record[1];
    dailyArchive.delete(i);
    for(const key of lastSeries.keys())if(key.startsWith(i+'/'))lastSeries.delete(key);
  }).catch(()=>{
    // The tape can reconstruct older candles if an archive isn't available.
  }).finally(()=>{entry.ready=true;});
  fundArchives.set(i,entry);
  return entry.promise;
}

function archive(i){
  if(dailyArchive.has(i))return dailyArchive.get(i);
  const entry=fundArchives.get(i);
  if(entry?.packed){
    let bars;
    try{bars=unpackHistory(entry.packed,schedule(i,-1).start);}catch{
      // Rebuild from the tape if the downloaded archive is incomplete.
      entry.packed=null;
    }
    if(bars?.length)return cacheSet(dailyArchive,i,bars,4);
  }
  const list=[];
  for(let d=firstDays[i];d<0;d++)if(runsOn(stocks[i].market,d))list.push(fullDay(i,d));
  return cacheSet(dailyArchive,i,list,4);
}
function periodOf(day,tf){
  if(tf==='W')return Math.floor(day/7);
  const date=new Date(epoch+day*msDay),year=date.getUTCFullYear();
  if(tf==='3Y')return Math.floor(year/3)*3;
  return tf==='Y'?year:year*12+date.getUTCMonth();
}
function calendarBars(input,tf,market){
  if(tf==='D')return input;
  const result=[];
  for(let j=0;j<input.length;){
    const period=periodOf(input[j].day,tf);let end=j+1;
    while(end<input.length&&periodOf(input[end].day,tf)===period)end++;
    const last=input[end-1];let next=last.day+1;
    while(!runsOn(market,next))next++;
    result.push(combine(input.slice(j,end),end===input.length&&(last.partial||periodOf(next,tf)===period)));
    j=end;
  }
  return result;
}
function fullSpan(input,market){
  const tf=input.length<=90?'D':input.length<=420?'W':input.length<=1980?'M':'Y';
  return calendarBars(input,tf,market).map(bar=>({...bar,bucket:tf}));
}
function closedSeries(state,i,tf,pressure){
  const market=stocks[i].market,day=state.day,sc=schedule(i,day);
  const n=runsOn(market,day)?sc.until[state.cursor??0]:0,key=i+'/'+tf,when=day+'/'+n+'/'+pressure.key;
  if(lastSeries.get(key)?.when===when)return lastSeries.get(key).series;
  if(day<firstDays[i])return [];
  const intra=isIntraday(tf),rows=intra?[]:day<0?archive(i).filter(b=>b.day<day):archive(i).slice();
  let first=Math.max(Math.min(0,day),firstDays[i]);
  if(intra){first=day;for(let j=1;j<retainedSessions(tf)&&first>firstDays[i];j++)first=previousSession(market,first);first=Math.max(first,firstDays[i]);}
  for(let d=first;d<=day;d++){
    if(!runsOn(market,d)||(d===day&&!n))continue;
    if(!intra){
      rows.push(d<day||n===sc.steps.length?fullDay(i,d,pressure):combine(sessionBars(d,i,pressure).slice(0,n),true));
    }else{
      const input=sessionBars(d,i,pressure),visible=d===day?input.slice(0,n):input;
      if(tf==='T'||tf==='1'){rows.push(...fineGrouped(tf==='T'?visible.slice(-72):visible,i,tf));continue;}
      const partial=d===day&&n<sc.steps.length&&sc.steps[n]===visible.at(-1).step+1;
      rows.push(...grouped(visible,Number(tf)/5,partial));
    }
  }
  const series=tf==='T'?rows.slice(-7200):intra?rows:tf==='A'?fullSpan(rows,market):calendarBars(rows,tf,market);
  cacheSet(lastSeries,key,{when,series},6);return series;
}


export function chartBars(state,i,tf){
  const clock=marketClock(state),pressure=instrumentPressure(state.ritualEvents,i),base=closedSeries(clock,i,tf,pressure),live=currentPrints(i,clock,marketElapsed(state),pressure);
  if(!live)return base;
  const {bar,prints,second}=live,sc=schedule(i,bar.day);
  const observed=tradeTotals(prints,second);
  if(!observed)return base;
  const partial={...bar,...observed,partial:true};
  const display=tf==='A'?(base[0]?.bucket||'D'):tf;
  if(tf==='T'||tf==='1'){
    const sums=completedTotals(bar.day,i,sc.until[bar.step],true,pressure);
    let {v,pv}=sums;
    const current=printBars(bar,i,tf,second);
    for(const part of current){v+=part.v;pv+=part.pv;part.vwap=v?pv/v:null;}
    return [...base,...current].slice(tf==='T'?-7200:0);
  }
  const last=base.at(-1);
  const same=last&&(display==='D'?last.day===bar.day:
    isIntraday(display)?last.day===bar.day&&bar.step-last.step<Number(display)/5&&sc.index[bar.step]-sc.index[last.step]===bar.step-last.step:
    periodOf(last.day,display)===periodOf(bar.day,display));
  const updated=same?combine([last,partial],true):partial;
  if(isIntraday(display)){
    const sums=completedTotals(bar.day,i,sc.until[bar.step],bar.day>=0,pressure);
    updated.vwap=(sums.pv+partial.pv)/(sums.v+partial.v);
  }
  if(tf==='A')updated.bucket=display;
  return same?[...base.slice(0,-1),updated]:[...base,updated];
}
