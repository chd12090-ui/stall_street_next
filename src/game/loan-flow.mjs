import {accountCalendar} from './clock-calendar.mjs';
import {fmtMoney} from './world.mjs';

const won=amount=>fmtMoney(amount,'KRW');

// Live field updates carry the current game snapshot even when a different tab replaced it.
export function refreshFinancialView(root,state){
  if(root?.dispatchEvent)root.dispatchEvent(new CustomEvent('finance-change',{bubbles:true,detail:state}));
}

export function loanContractBody({amount,rate,issued,maturity,upfrontInterest}){
  const rows=[['대출 금액',amount],['대출 금리',rate]];
  if(upfrontInterest)rows.push(['상환 시 선이자',upfrontInterest]);
  rows.push(['대출 실행일',issued],['만기',maturity]);
  return {rows,account:'입금 계좌',stamp:'입금'};
}

export function loanRepaymentBody(state,row,remaining){
  const rows=[['상환 금액',won(row.amount)],['상환 원금',won(row.principal)],['납부 이자',won(row.interest)]];
  if(row.upfrontInterest)rows.push(['납부 선이자',won(row.upfrontInterest)]);
  rows.push(['남은 대출금',won(remaining)],['상환일',accountCalendar(state,row.day,row.step)]);
  return {rows,account:'출금 계좌',stamp:remaining?'상환':'완납'};
}
