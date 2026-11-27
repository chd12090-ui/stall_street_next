import {mentalRateBreakdown,mood} from './market.mjs';
import {recoveryLimit,recoveryPoints,recoveryStatus} from './recovery-ad.mjs';

export const scoreLabel=score=>'정신력 '+score+'퍼센트';
const rateFormat=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:4});
const signedPoints=value=>(value<0?'−':value>0?'+':'')+rateFormat.format(Math.abs(value))+'p';
export function sheetValues(state){
  const {base,investment,debt,connection,fortunePercent,rate}=mentalRateBreakdown(state);
  const {remaining,gain}=recoveryStatus(state);
  return {
    score:String(state.mental),
    mood:mood(state.mental),
    rate:signedPoints(-rate),
    rateLabel:'게임 시간당 '+rateFormat.format(rate)+'점 감소',
    base:signedPoints(base),
    investment:signedPoints(investment),
    debt:signedPoints(debt),
    connection:signedPoints(connection),
    fortune:fortunePercent+'% 속도 감소',
    recovery:'광고 보고 '+(gain||recoveryPoints)+'점 회복',
    remaining:gain?'오늘 남은 횟수 '+remaining+'/'+recoveryLimit:'정신력이 가득 찼어.',
    canRecover:!!(remaining&&gain&&state.phase==='open')
  };
}
