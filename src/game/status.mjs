import {ECON,balance,exchangeable,creditStatus,localRates,netWealth,stockValue} from './market.mjs';
import {currencies,stocks,symbolIndex} from './world.mjs';
import {nativeRound} from './fx.mjs';
import {weekdayIndex} from './clock-calendar.mjs';
import {recordedBillPaid,recordedPurchase,wageLabel} from './living.mjs';
import {deskLoanBalance} from './loan-desk.mjs';
import {dailyBankInterest} from './credit.mjs';
import {glassesPurchases} from './ai-glasses.mjs';

const leg=(currency,amount)=>({currency,amount});
const entry=(id,type,category,title,day,step,legs,seq=null)=>({id,type,category,title,day,step,legs,seq});
export const rehabilitationIncomeOnDay=(state,day)=>(state.rehabilitationPayments??[])
  .reduce((total,payment)=>total+(payment.day===day?payment.amount:0),0);

export function householdSnapshot(s){
  const fx=localRates(s),cash=balance(s,'KRW'),net=netWealth(s),securities=stockValue(s),credit=creditStatus(s),desk=deskLoanBalance(s);
  const balances=Object.keys(currencies).map(currency=>{
    const amount=balance(s,currency);return {currency,amount,krw:Math.round(amount*fx[currency])};
  });
  const foreignKRW=Math.round(Object.keys(currencies).filter(c=>c!=='KRW').reduce((sum,c)=>sum+balance(s,c)*fx[c],0));
  const loanTotal=credit.liability+(desk?.total||0);
  return {cash,foreignKRW,assetsTotal:net+loanTotal,balances,securities,principal:(credit.loan?.principal||0)+(desk?.principal||0),
    interest:(credit.loan?.interest||0)+(desk?.interest||0),loanTotal,desk,
    net,available:exchangeable(s,'KRW'),credit};
}
function tradeEntry(r,day,id){
  const a=stocks[r.i],c=r.currency||a?.currency;
  if(!a||!currencies[c]||!Number.isFinite(r.qty))return null;
  const signed=Number.isFinite(r.cashDelta)?r.cashDelta:Number.isFinite(r.price)?-nativeRound(r.qty*r.price,c):null;
  return entry(id,'trade','trade',a.name+(r.qty<0?' 매도':' 매수'),day,r.step??null,signed===null?[]:[leg(c,signed)],r.seq);
}
function fxEntry(q,day,step,id,forced=false){
  if(!currencies[q.from]||!currencies[q.to])return null;
  const retired=q.reason==='retired-currency';
  const type=retired?'retired-fx':forced?'forced-fx':'fx';
  const title=retired?currencies[q.from].name+' 잔액 원화 전환':forced?'자동 환전 수수료':'환전 수수료';
  return {...entry(id,type,'fx',title,day,step,
    [leg(q.from,-q.amount),leg(q.to,q.received)],q.seq),fxCost:q.cost??0};
}
function liveSpendingEntry(day,spending){
  return entry('live-spend-'+day,'live-spending','living','하루 소비 합계',day,288,[leg('KRW',-spending.total)],spending.seq);
}
function addInterestEntry(records,day,lender,amount){
  if(!(amount>0))return;
  // Accruing interest changes the loan balance. The cash movement is recorded at repayment.
  records.push({...entry('interest-'+lender+'-'+day,'interest','credit',lender+' 대출 이자 발생',day,288,[]),
    accruedInterest:amount});
}
export function householdLedger(s){
  const records=[entry('opening','opening','opening','시작 자금',s.openingDay??0,0,[leg('KRW',ECON.initial)],0)];
  for(const {record:h,amount:bankInterest} of dailyBankInterest(s.history)){
    (h.trades||[]).forEach((r,j)=>records.push(tradeEntry(r,h.day,'trade-'+h.day+'-'+j)));
    for(const r of h.dividends??[]){
      const asset=stocks[r.i];
      if(!asset||!currencies[r.currency])continue;
      records.push({...entry('dividend-'+h.day+'-'+r.i,'dividend','income',asset.name+(asset.bond?' 이자':' 배당금'),h.day,288,
        [leg(r.currency,r.amount)],r.seq),incomeKRW:r.amountKRW});
    }
    const bill=h.bill;
    const purchase=recordedPurchase(h);
    if(purchase)records.push(entry('spend-'+h.day,'consumption','living','이전 소비 결제',h.day,288,[leg('KRW',-purchase.amount)],purchase.seq));
    if(h.liveSpending?.total>0)records.push(liveSpendingEntry(h.day,h.liveSpending));
    addInterestEntry(records,h.day,'은행',bankInterest);
    addInterestEntry(records,h.day,'대부',h.loanDesk?.interestToday);
    if(!bill)continue;
    if(bill.income)records.push(entry('wage-'+h.day,'salary','income',wageLabel(bill)+' 입금',h.day,288,[leg('KRW',bill.income)],bill.incomeSeq));
    (bill.sales||[]).forEach((r,j)=>{
      const c=r.currency||stocks[r.i]?.currency||'KRW';
      records.push(entry('sale-'+h.day+'-'+j,'forced-sale','trade',(stocks[r.i]?.name||r.name||'보유 종목')+' 자동 판매',
        h.day,288,[leg(c,r.amount)],r.seq));
    });
    (bill.conversions||[]).forEach((q,j)=>records.push(fxEntry(q,h.day,288,'auto-fx-'+h.day+'-'+j,true)));
    const paid=recordedBillPaid(bill);
    if(paid)records.push(entry('bill-'+h.day,'bill','living','이전 소비 결제',h.day,288,[leg('KRW',-paid)],bill.paymentSeq));
  }
  for(const charge of [...(s.ritualCharges??[]),...(s.ritualPending?[s.ritualPending]:[])]){
    records.push(entry('ritual-'+charge.id,'ritual','living','살굿 제물 · '+stocks[symbolIndex[charge.code]].name,
      charge.day,charge.step,[leg('KRW',-charge.cost)],charge.seq));
  }
  for(const {day,step,cost,seq} of glassesPurchases(s)){
    records.push(entry('ai-glasses-'+seq,'shop','living','AI 안경 구매',day,step,[leg('KRW',-cost)],seq));
  }
  for(const charge of s.intimidationCharges??[]){
    records.push(entry('desk-intimidation-'+charge.id,'desk-intimidation','living','협박 비용',charge.day,charge.step,
      [leg('KRW',-charge.cost)],charge.seq));
  }
  for(const receipt of s.rehabilitationSettlements??[]){
    const balances=Object.entries(receipt.balances).map(([currency,amount])=>leg(currency,-amount));
    const row=entry('rehabilitation-settlement-'+receipt.seq,'rehabilitation-settlement','credit','회생 자산·대출 정리',
      receipt.day,receipt.step,balances,receipt.seq);
    records.push({...row,clearedAssets:receipt.assets,clearedDebt:receipt.debt});
  }
  for(const payment of s.rehabilitationPayments??[]){
    records.push(entry('rehabilitation-'+payment.seq,'rehabilitation','income','회생 지원금',
      payment.day,payment.step,[leg('KRW',payment.amount)],payment.seq));
  }
  if(s.intimidationPending){
    const charge=s.intimidationPending;
    records.push(entry('desk-intimidation-'+charge.id,'desk-intimidation','living','협박 비용 처리 중',charge.day,charge.step,
      [leg('KRW',-charge.cost)],charge.seq));
  }
  for(const charge of [...(s.spyCharges??[]),...(s.spyPending?[s.spyPending]:[])]){
    records.push(entry('desk-spy-'+charge.id,'desk-spy','living',charge===s.spyPending?'염탐 보고서 발급 중':'염탐 보고서 발급',
      charge.day,charge.step,[leg('KRW',-charge.cost)],charge.seq));
  }
  if(s.phase==='open')(s.fills||[]).forEach((r,j)=>records.push(tradeEntry(r,s.day,'trade-'+s.day+'-'+j)));
  (s.fxLog||[]).forEach((q,j)=>records.push(fxEntry(q,q.day,q.step??null,'fx-'+j)));
  (s.credit?.ledger||[]).forEach((r,j)=>{
    const borrowed=r.type==='borrow',title=borrowed?'대출 입금':r.type==='maturity'?'만기에 자동으로 갚음':'대출 갚음';
    records.push(entry('credit-'+j,r.type,'credit',title,r.day,r.step,[leg('KRW',borrowed?r.amount:-r.amount)],r.seq));
  });
  (s.loanDesk?.ledger||[]).forEach((r,j)=>{
    const borrowed=r.type==='borrow',fee=r.upfrontInterest??0,amount=r.amount-fee;
    if(fee)records.push(entry('desk-upfront-interest-'+j,'upfront-interest','credit','대부 선이자 납부',
      r.day,r.step,[leg('KRW',-fee)],r.seq));
    if(amount)records.push(entry('loan-desk-'+j,r.type,'credit',borrowed?'대부 창구 입금':'대부 창구에 갚음',
      r.day,r.step,[leg('KRW',borrowed?amount:-amount)],r.seq));
  });
  let reportedRebate=0;
  const rebateDays=new Set();
  (s.weekendLog||[]).forEach((r,j)=>{
    reportedRebate+=r.amount;rebateDays.add(r.day);
    records.push(entry('rebate-'+r.day+'-'+j,'rebate','income','식비 환급',r.day,r.step,[leg('KRW',r.amount)],r.seq));
  });
  // Older saves tracked only the total weekend refund. Recover exact amounts from daily luck when available.
  let missing=Math.max(0,(s.weekendRebate||0)-reportedRebate);
  if(missing){
    const oldDays=[...s.history];
    if(s.phase==='open')oldDays.push({day:s.day,luck:s.luck});
    for(const r of oldDays){
      if(weekdayIndex(r.day)<5||rebateDays.has(r.day)||!missing)continue;
      const reward=r.luck==='coupon'?ECON.coupon:r.luck==='meal'?ECON.meal:0;
      const amount=Math.min(missing,reward);
      if(amount>0){
        records.push(entry('legacy-rebate-'+r.day,'rebate','income','식비 환급',r.day,null,[leg('KRW',amount)]));
        missing-=amount;
      }
    }
    if(missing)records.push(entry('legacy-rebate','rebate','income','이전 식비 환급 합계',null,null,[leg('KRW',missing)]));
  }
  const rows=records.filter(Boolean);
  // Preserve real action order within one five-minute tick. Older records list their known clock time only.
  return rows.map((r,k)=>({...r,k})).sort((a,b)=>Number(a.type==='opening')-Number(b.type==='opening')||(b.day??-1)-(a.day??-1)||(b.step??-1)-(a.step??-1)||(b.seq??-1)-(a.seq??-1)||b.k-a.k).map(({k,...r})=>r);
}
export function householdLedgerTotals(rows){
  let income=0,living=0;
  const byCurrency={};
  for(const r of rows){
    if(r.category==='income'&&Number.isFinite(r.incomeKRW))income+=r.incomeKRW;
    for(const l of r.legs){
      byCurrency[l.currency]=nativeRound((byCurrency[l.currency]||0)+l.amount,l.currency);
      if(r.category==='income'&&l.currency==='KRW'&&!Number.isFinite(r.incomeKRW))income+=l.amount;
      if(r.category==='living'&&l.currency==='KRW')living-=l.amount;
    }
  }
  return {income,living,byCurrency};
}
export const signed=(n,format)=>(n>0?'+':'')+format(n);
export const gainTone=n=>n>0?'st-rise':n<0?'st-fall':'';
export function investmentReturn(s,value){
  const principal=s.costsKRW.reduce((sum,cost)=>sum+cost,0);
  const profit=value-principal;
  const pct=principal?profit/principal*100:null;
  return {principal,profit,tone:gainTone(pct),text:pct===null?'—':signed(pct,n=>n.toFixed(2)+'%')};
}
export const ledgerIcons={opening:'coin',income:'coin',living:'lunch',trade:'market',fx:'reload',credit:'receipt'};
