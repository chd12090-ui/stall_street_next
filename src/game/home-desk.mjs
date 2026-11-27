import {dailySpendingEstimate,grossAssets,mood,spendingInterval,spendingPerTick,spendingWealthCharge,spendingWealthRate,stockValue} from './market.mjs';
import {gameClockRate,venueClockText} from './clock-calendar.mjs';
import {fmtMoney} from './world.mjs';

export const mentalLabel=value=>'정신력 '+value+'/100, '+mood(value)+' · 표정 미리보기 및 회복';
const compactWon=new Intl.NumberFormat('ko-KR',{notation:'compact',maximumFractionDigits:2});
export const panelMoney=value=>Math.abs(value)<1e8?fmtMoney(value):
  (value<0?'−':'')+compactWon.format(Math.abs(value))+'원';
export const panelProfit=value=>(value>0?'+':'')+panelMoney(value);
export const profitSign=value=>value>0?'up':value<0?'down':'flat';
export function investmentSummary(state){
  let held=false,cost=0;
  state.holdings.forEach((qty,i)=>{
    if(qty>0){
      held=true;
      cost+=state.costsKRW[i];
    }
  });
  const value=held?stockValue(state):0;
  return {held,value,profit:value-cost};
}

export function homeClock(state){
  const minutes=venueClockText(state),seconds=':'+String(state.wallSecond??0).padStart(2,'0');
  return {minutes,seconds,label:'게임 시각 '+minutes+seconds+' · '+gameClockRate+'배속'};
}

export const spendingPeriod=spendingInterval/60_000+'분';
export const spendPercent=new Intl.NumberFormat('ko-KR',{style:'percent',maximumFractionDigits:6});
export function spendDetails(state){
  const wealth=grossAssets(state),mental=state.mental;
  const wealthPercent=spendPercent.format(spendingWealthRate(mental));
  return {
    estimate:'약 '+fmtMoney(dailySpendingEstimate(state,wealth)),
    rate:fmtMoney(spendingPerTick(mental,wealth))+' / '+spendingPeriod,
    extra:fmtMoney(spendingWealthCharge(mental,wealth))+' ('+wealthPercent+')',
  };
}
