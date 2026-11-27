import {amountFromText,applyAmountGrouping} from './number-entry.mjs';
import {creditStatus,drawCredit,takeCredit,repayCredit,declineCredit} from './market.mjs';
import {dayLabel,weekStart} from './clock-calendar.mjs';
import {refreshFinancialView} from './loan-flow.mjs';
const won=n=>Math.round(Number(n)||0).toLocaleString('ko-KR')+'원';
const percent=n=>Number(n).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const choiceStore='stall-street:credit-offer-choice:1';
let viewDay=null,viewGame=null,requestText='',repayText='',currentKey='',selectedOffer=null,spinningKey='',timer=0;
let loanStep='amount';
let notice='',repayNotice='',confirmDecline=false,desk='menu';
const desks=['menu','history'];
export function setBankDesk(section='menu'){
  const next=desks.includes(section)?section:'menu';
  if(next!==desk){confirmDecline=false;notice='';repayNotice='';}
  desk=next;
}
function quoteKey(q){return q?[q.day,q.step,q.amount,...q.offers.map(v=>v.id+'-'+v.aprBps)].join('/'):'';}
const amountValue=text=>amountFromText(text);
let choice=null;
try{choice=JSON.parse(localStorage.getItem(choiceStore));}catch{}
let persistChoice=value=>{try{localStorage.setItem(choiceStore,JSON.stringify(value));}catch{}};
export const bankOfferChoice=()=>choice;
export function bindBankChoice(records,write){
  clearTimeout(timer);timer=0;spinningKey='';currentKey='';selectedOffer=null;
  viewDay=null;viewGame=null;confirmDecline=false;desk='menu';
  choice=records.bankChoice??null;persistChoice=write;
}
function alignDraft(state,status){
  if(viewDay!==state.day||viewGame!==state.resetId){
    viewDay=state.day;viewGame=state.resetId;loanStep='amount';requestText='';repayText='';notice='';repayNotice='';
  }
  const key=quoteKey(status.application);
  if(currentKey!==key){
    currentKey=key;selectedOffer=null;notice='';confirmDecline=false;
    if(spinningKey&&spinningKey!==key){clearTimeout(timer);timer=0;spinningKey='';}
    if(key){
      loanStep='rate';
      requestText=status.application.amount.toLocaleString('ko-KR');
    }else loanStep='amount';
    if(key&&choice?.key===key&&status.application.offers.some(o=>o.id===choice.id))selectedOffer=choice.id;
  }
}
function rememberOffer(id){
  selectedOffer=id;
  choice=id==null?null:{key:currentKey,id};persistChoice(choice);
}
function offer(status){return status.application?.offers.find(o=>o.id===selectedOffer);}
function requestValidation(s,status){
  if(notice)return notice;
  if(s.phase!=='open')return '하루 정산을 마쳤어. 다음 거래일에 신청할 수 있어.';
  if(status.max===0)return status.reason||'현재 대출 가능한 금액이 없어.';
  if(!requestText.trim())return '';
  const v=amountValue(requestText);
  if(v==null)return '원 단위 숫자를 입력해 줘.';
  if(v<1)return '1원 이상의 금액을 입력해 줘.';
  return status.eligible?'':status.reason||'신청 금액을 확인해 줘.';
}
function repayValidation(s,status){
  if(repayNotice)return repayNotice;
  if(!status.loan)return '';
  if(s.phase!=='open')return '하루 정산 후에는 금액을 변경할 수 없어.';
  if(status.maxRepay<=0)return '주문에 잡아 둔 돈을 빼면 지금 갚을 수 있는 원화가 없어.';
  if(!repayText.trim())return '';
  const n=amountValue(repayText);
  if(n==null||n<1)return '갚을 금액을 1원 단위로 입력해 줘.';
  if(n>status.maxRepay)return '지금 갚을 수 있는 돈 '+won(status.maxRepay)+' 이내로 입력해 줘.';
  return '';
}
function bankRepayment(s,status){
  return {
    loan:status.loan,available:status.available,maximum:status.maxRepay,text:repayText,error:repayValidation(s,status),
  };
}
export function bankLoanContract(s){
  const loan=s.credit?.loan;
  if(!loan)return null;
  return {
    lender:loan.bank,amount:won(loan.original),rate:'고정 연 '+percent(loan.aprBps/100),
    issued:dayLabel(s,loan.startDay),maturity:dayLabel(s,weekStart(loan.startDay)+6)+' 마감',
  };
}
export function bankViewState(s){
  const amount=amountValue(requestText);
  const initial=creditStatus(s,amount||0);
  alignDraft(s,initial);
  const requested=amountValue(requestText);
  const status=requested===amount?initial:creditStatus(s,requested||0);
  return {
    desk,status,requestText,amount:requested,step:loanStep,notice,confirmDecline,
    offer:offer(status),spinning:Boolean(status.application&&spinningKey===quoteKey(status.application)),
    validation:requestValidation(s,status),repayment:bankRepayment(s,status),
  };
}
function updateRequest(el,s){
  requestText=applyAmountGrouping(el);notice='';
  refreshFinancialView(el,s);
}
function updateRepayment(el,s){
  repayText=applyAmountGrouping(el);repayNotice='';
  refreshFinancialView(el,s);
}
export function creditInput(el,state){
  if(el.id==='credit-amount'){updateRequest(el,state);return true;}
  if(el.id==='credit-repay-amount'){updateRepayment(el,state);return true;}
  return false;
}
function feedbackError(ctx,err,repay=false){
  if(repay)repayNotice=err;else notice=err;
  ctx.render();ctx.feedback(err);
}
export function creditAction(name,el,s,ctx){
  if(typeof name!=='string'||!name.startsWith('credit-'))return false;
  const v=el.dataset.value;
  if(name==='credit-preset'){
    const input=el.closest('.credit-page')?.querySelector('#credit-amount');
    if(input){input.value=Number(v).toLocaleString('ko-KR');creditInput(input,s);}
  }else if(name==='credit-next'){
    const amount=amountValue(requestText),status=creditStatus(s,amount??0);
    if(loanStep!=='amount'||amount===null||requestValidation(s,status)||status.application)return true;
    loanStep='rate';ctx.render(true);
  }else if(name==='credit-amount-back'){
    if(!creditStatus(s).application){loanStep='amount';notice='';ctx.render(true);}
  }else if(name==='credit-review'){
    const st=creditStatus(s);
    if(st.eligible&&offer(st)&&!spinningKey){loanStep='review';notice='';ctx.render(true);}
  }else if(name==='credit-rates'){
    if(creditStatus(s).application){loanStep='rate';notice='';ctx.render(true);}
  }else if(name==='credit-draw'){
    const amount=amountValue(requestText);if(loanStep!=='rate'||amount==null||creditStatus(s,amount).application)return true;
    const error=drawCredit(s,amount);
    if(error){feedbackError(ctx,error);return true;}
    ctx.save();ctx.beep?.('bankDraw');const st=creditStatus(s,amount);
    alignDraft(s,st);rememberOffer(null);
    const key=quoteKey(st.application);if(!key){ctx.render();return true;}
    const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    clearTimeout(timer);spinningKey=reduced?'':key;ctx.render(true);
    if(!reduced){
      timer=setTimeout(()=>{
        if(spinningKey!==key)return;
        spinningKey='';timer=0;
        if(ctx.open?.()){ctx.render(true);ctx.beep?.('bankOffers');}
      },940);
    }
  }else if(name==='credit-decline'){
    if(creditStatus(s).application&&!spinningKey){confirmDecline=true;notice='';ctx.render();}
  }else if(name==='credit-decline-cancel'){
    confirmDecline=false;ctx.render();
  }else if(name==='credit-decline-confirm'){
    if(!confirmDecline)return true;
    const err=declineCredit(s);
    if(err){feedbackError(ctx,err);return true;}
    confirmDecline=false;rememberOffer(null);ctx.save();ctx.render();ctx.feedback('오늘의 금리 제안을 거절했어.');
  }else if(name==='credit-select'){
    const st=creditStatus(s);
    const picked=st.application?.offers.find(o=>String(o.id)===v);
    if(picked&&!st.application.declined&&(!spinningKey||spinningKey!==quoteKey(st.application))){rememberOffer(picked.id);notice='';ctx.render();}
  }else if(name==='credit-accept'){
    const st=creditStatus(s),choice=offer(st);
    if(loanStep!=='review'||!choice||spinningKey===quoteKey(st.application))return true;
    const err=takeCredit(s,choice.id);
    if(err){feedbackError(ctx,err);return true;}
    notice='';repayText='';ctx.save();ctx.render(true);ctx.beep?.('money');
  }else if(name==='credit-repay'){
    const n=amountValue(repayText),st=creditStatus(s);
    if(n==null||!st.loan)return true;
    const err=repayCredit(s,n);
    if(err){feedbackError(ctx,err,true);return true;}
    repayText='';repayNotice='';ctx.save();ctx.beep?.('money');
    ctx.repaid(s.credit.ledger.at(-1),creditStatus(s).liability);
  }else return false;
  return true;
}
