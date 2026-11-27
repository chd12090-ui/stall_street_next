import {nyangUnitsPerLegacyCoin,fundTracking} from './securities-data.mjs';
import {stocks, fmtMoney, quantityUnit, previousSession, symbolIndex, isSpot} from './world.mjs';
import {continuousTradingDay,marketClock} from './clock-calendar.mjs';
import {quoteInfo, schedule, sourceSessionBars, sessionBars, lastClose, quoteAt, instrumentPressure} from './tape.mjs';
import {fxRates} from './fx.mjs';
import {publicCompanyHistory} from './company-filings.mjs';
import {getValuation} from './analysis-metrics.mjs';
import {instrumentMarketCap} from './market-cap.mjs';

const fraction = n => n - Math.floor(n);
const noise = n => fraction(Math.sin(n * 12.9898 + 78.233) * 43758.5453);
const formatters = new Map();
export function number(value, digits = 0, minimum = 0) {
  if (!Number.isFinite(value)) return '—';
  const key = digits + '/' + minimum;
  if (!formatters.has(key)) formatters.set(key, new Intl.NumberFormat('ko-KR', {maximumFractionDigits:digits, minimumFractionDigits:minimum}));
  return formatters.get(key).format(value);
}
export function instrumentListLabel(asset) {
  return asset.market === 'arden' && !asset.bond && !asset.option && !asset.reference ? asset.ticker : asset.name;
}
export function cash(value, iso = 'KRW') {
  if (!Number.isFinite(value)) return '—';
  return fmtMoney(value,iso);
}
export function shortValue(value, suffix = '', digits = 2) {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  for (const [scale,label] of [[1e12,'조'],[1e8,'억'],[1e4,'만']]) {
    if (abs >= scale) return number(value/scale, digits) + label + suffix;
  }
  return number(value,digits) + suffix;
}
export const percent = (n, signed = false) => Number.isFinite(n) ? (signed && n > 0 ? '+' : '') + number(n,2,2) + '%' : '—';
export const cls = n => n > 0 ? 'bk-up' : n < 0 ? 'bk-down' : 'bk-flat';
export const shareCount = (qty, i) => number(qty, stocks[i].lot < 1 ? 8 : 0) + quantityUnit(i);

// Split each observed bar's volume independently into buyer and seller groups.
// Largest-remainder rounding ensures both side totals equal the traded volume.
function split(total,weights) {
  const sum=weights.reduce((n,x)=>n+x,0);
  const raw=weights.map(x=>total*x/sum),parts=raw.map(Math.floor);
  const ranks=[0,1,2].sort((a,b)=>(raw[b]-parts[b])-(raw[a]-parts[a]));
  const extra=total-parts.reduce((n,x)=>n+x,0);
  for(let i=0;i<extra;i++)parts[ranks[i]]++;
  return parts;
}
export function allocateFlow(i,b) {
  const s=stocks[i],seed=b.key*3.17+i*71;
  const move=b.o>0?Math.max(-1,Math.min(1,(b.c/b.o-1)*12)):0;
  const mix=isSpot(s)?[.46,.32,.22]:[.49,.29,.22];
  const weights=side=>mix.map((w,j)=>w*(.56+.91*noise(seed+j*11+side*193))*(1+move*[.10,-.10,.08][j]*side));
  const decimals=isSpot(s)?100:1,volume=Math.max(0,Math.round(b.v*decimals));
  const buy=split(volume,weights(1)),sell=split(volume,weights(-1));
  return buy.map((n,j)=>({buy:n/decimals,sell:sell[j]/decimals,net:(n-sell[j])/decimals}));
}
function basketMark(i,day,edge,onAuction,events) {
  const sc=schedule(i,day),pressure=instrumentPressure(events,i);
  const opening=onAuction&&sc.index[edge]>=0,index=opening?sc.index[edge]:sc.until[edge]-1;
  const affected=index>=0&&day*288+sc.steps[index]>=pressure.steps[0]?.from;
  const bars=affected?sessionBars(day,i,pressure):sourceSessionBars(day,i),bar=bars[index];
  if(bar){
    const price=opening?bar.o:(bar.h+bar.l+bar.c)/3;
    return affected&&stocks[i].tape?price*fxRates(day,bar.step).USD*nyangUnitsPerLegacyCoin:price;
  }
  const mark=quoteAt({day,cursor:edge,phase:'open',ritualEvents:events},i);
  return stocks[i].tape?mark*fxRates(day,edge).USD*nyangUnitsPerLegacyCoin:mark;
}
function indicativeNAV(state,i,q) {
  const a=stocks[i],day=q.asOf,sc=schedule(i,day),prior=previousSession(a.market,day);
  const {reference,factor}=fundTracking(a,day);
  const clock=marketClock(state);
  const edge=day===clock.day?Math.min(sc.end,Math.max(sc.start,clock.cursor)):sc.end;
  const auction=day<continuousTradingDay&&clock.day===day&&clock.phase!=='closed'&&sc.index[edge]>=0&&
    (edge===sc.start||sc.index[edge-1]<0);
  const startNAV=(lastClose(i,prior,instrumentPressure(state.ritualEvents,i))||a.base)/(1+(a.navOffset||0));
  const basket=reference.reduce((sum,code)=>{
    const j=symbolIndex[code],previous=basketMark(j,prior,sc.end,false,state.ritualEvents),current=basketMark(j,day,edge,auction,state.ritualEvents);
    return sum+current/previous-1;
  },0)/reference.length;
  const elapsed=sc.until[edge]/sc.steps.length;
  const sessionsPerYear=day<0?252:365;
  return Math.max(.000001,startNAV*(1+factor*basket)*(1-(a.fee/100/sessionsPerYear)*elapsed));
}
export function fundFacts(state,i) {
  const a=stocks[i],q=quoteInfo(state,i),price=q.price,isFund=!!a.reference,isCoin=isSpot(a);
  if(!isFund&&!isCoin){
    const filings=publicCompanyHistory(i,state),v=getValuation(filings,price);
    return {price,asOf:q.asOf,filing:filings.current?.publishedLabel,shares:filings.current?.shares?.end,
      marketCap:v.marketCap,yieldPct:v.dividendYield,pe:v.pe,pb:v.pb,eps:v.eps,book:v.bps,
      nav:null,aum:null,premiumPct:null,feePct:null};
  }
  const nav=isFund?indicativeNAV(state,i,q):null;
  const dividend=Number.isFinite(a.annualDividend)?a.annualDividend:null;
  return {
    price, asOf:q.asOf, marketCap:instrumentMarketCap(a,state,price),
    yieldPct:dividend!==null&&!isCoin?100*dividend/price:null,
    nav,aum:nav!==null&&Number.isFinite(a.units)?nav*a.units:null,
    premiumPct:nav!==null?(price/nav-1)*100:null, feePct:isFund?a.fee:null,
    pe:null,pb:null,eps:null,book:null
  };
}
