import {currencies,events} from './world.mjs';
import {firstEdition} from './press-wire.mjs';
export const exchangeCurrencies=Object.freeze(['KRW','USD']);
export const isExchangeCurrency=code=>exchangeCurrencies.includes(code);
export const spread=.0025;
export function nativeRound(n,c='KRW'){
  const scale=10**currencies[c].digits;
  return Math.sign(n)*Math.round((Math.abs(n)+Number.EPSILON)*scale)/scale;
}
export function floorMoney(n,c='KRW'){
  const scale=10**currencies[c].digits;
  return Math.floor(n*scale+1e-8)/scale;
}
export function ceilMoney(n,c='KRW'){
  const scale=10**currencies[c].digits;
  return Math.ceil(n*scale-1e-8)/scale;
}
const rateCache=new Map();
export function fxRates(day,step){
  const t=Math.max(0,day*288+step),key=day+'/'+t;
  if(rateCache.has(key))return rateCache.get(key);
  const rates={KRW:1},dispatches=firstEdition(t).filter(e=>e.tick>t-432);
  for(const [j,code] of Object.keys(currencies).filter(c=>c!=='KRW').entries()){
    const wave=.006*(Math.sin(t/(57+j*13)+j)-Math.sin(j))+.003*Math.sin(t/(18+j*11));
    let news=0;
    for(const e of events){if(e.tick>t||e.day>day)break;if(e.fx[code])news+=e.fx[code]*(1-Math.exp(-(t-e.tick+2)/11));}
    for(const e of dispatches)if(e.fx[code])news+=e.fx[code]*Math.exp(-(t-e.tick)/96);
    rates[code]=Number((currencies[code].base*Math.exp(wave+news)).toPrecision(10));
  }
  if(rateCache.size>96)rateCache.delete(rateCache.keys().next().value);
  rateCache.set(key,rates);return rates;
}
export function fxQuote(rates,from,to,amount) {
  if(!isExchangeCurrency(from)||!isExchangeCurrency(to)||from===to||!Number.isFinite(amount)||amount<=0||amount!==nativeRound(amount,from))return null;
  const bid=rates[from]*(from==='KRW'?1:1-spread),ask=rates[to]*(to==='KRW'?1:1+spread);
  const received=floorMoney(amount*bid/ask,to);
  return {from,to,amount,received,rate:bid/ask,mid:rates[from]/rates[to],cost:Math.max(0,Math.round(amount*rates[from]-received*rates[to]))};
}
// Smallest debit that delivers the requested amount at this quote, including its spread.
export function fxDebitFor(rates,from,to,needed){
  const sample=fxQuote(rates,from,to,1);
  if(!sample||!Number.isFinite(needed)||needed<=0)return 0;
  const amount=ceilMoney(needed/sample.rate,from);
  if(fxQuote(rates,from,to,amount)?.received>=needed)return amount;
  return nativeRound(amount+10**-currencies[from].digits,from);
}
