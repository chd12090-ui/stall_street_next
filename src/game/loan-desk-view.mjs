import {deskLoanBalance,deskLoanError,deskLoanQuote,deskLoanRequestError,deskLender} from './loan-desk.mjs';
import {exchangeable} from './market.mjs';
import {dayLabel} from './clock-calendar.mjs';
import {groupAmount,applyAmountGrouping,amountFromText} from './number-entry.mjs';
import {fmtMoney} from './world.mjs';
import {refreshFinancialView} from './loan-flow.mjs';
export {loanDiceTiming} from './loan-dice.mjs';

const won=n=>fmtMoney(n,'KRW');
const apr=bps=>'연 '+bps/100+'%';
let draft='',step='amount',diceTossAt=null;
let draftGame=null;
export const deskLoanDraftAmount=()=>amountFromText(draft);
export function clearLoanDeskDraft(){draft='';step='amount';diceTossAt=null;}

export function rollSummary(dice){
  return dice?dice.join(' + ')+' = '+apr((dice[0]+dice[1])*100):'주사위 두 개의 합으로 연 금리를 정해.';
}
export function deskLoanContract(s){
  const loan=s.loanDesk.loan;
  return {
    lender:deskLender,amount:won(loan.original),rate:'고정 '+apr(loan.aprBps),
    issued:dayLabel(s,loan.day),maturity:'없음',upfrontInterest:loan.upfrontInterest?won(loan.upfrontInterest):'',
  };
}
function deskRepayment(s,loan,amount){
  const available=exchangeable(s,'KRW');
  return {
    loan,available,text:draft,maximum:s.phase==='open'&&s.cursor<288?Math.min(available,loan.total):0,
    error:deskLoanError(s,amount,available),
  };
}
export function privateLoanViewState(s){
  if(draftGame!==s.resetId){clearLoanDeskDraft();draftGame=s.resetId;}
  const loan=deskLoanBalance(s),amount=deskLoanDraftAmount();
  return {
    amount,draft,step,diceTossAt,dice:s.loanDesk?.rateDice,
    quote:step==='review'&&!loan?deskLoanQuote(s,amount):null,
    validation:loan?'':deskLoanRequestError(s,amount),
    repayment:loan?deskRepayment(s,loan,amount):null,
  };
}
export function loanDeskNext(s){
  if(deskLoanRequestError(s,deskLoanDraftAmount()))return false;
  step='rate';
  return true;
}
export function loanDeskStage(name,s){
  if(diceTossAt!==null)return false;
  switch(name){
    case 'loan-desk-amount-back':step='amount';return true;
    case 'loan-desk-rates':step='rate';return true;
    case 'loan-desk-review':
      if(!deskLoanError(s,deskLoanDraftAmount(),0)){step='review';return true;}
      return false;
    default:return false;
  }
}
export const refreshLoanDesk=refreshFinancialView;
export function setLoanDeskToss(root,s,tossedAt){
  diceTossAt=tossedAt;
  refreshFinancialView(root,s);
}
export function loanDeskInput(field,s){
  if(field.id!=='loan-desk-amount')return false;
  draft=applyAmountGrouping(field);
  const root=field.closest('.loan-desk-loan');
  if(root)refreshLoanDesk(root,s);
  return true;
}
export function loanDeskPreset(button,root,s){
  const field=root.querySelector('#loan-desk-amount');
  if(!field)return;
  field.value=groupAmount(button.dataset.value);
  loanDeskInput(field,s);
}
