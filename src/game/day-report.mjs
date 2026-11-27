import {dailyBonus,dailySpendingEstimate,financialMood,grossAssets,netWealth,todayLiveSpending} from './market.mjs';
import {dailySalary} from './salary-negotiation.mjs';
import {recordedBillPaid,recordedPurchase} from './living.mjs';
import {householdLedger,householdLedgerTotals,rehabilitationIncomeOnDay} from './status.mjs';
import {fmtMoney,quantityRound,stocks} from './world.mjs';
import {nativeRound} from './fx.mjs';
import {weekdayIndex} from './clock-calendar.mjs';
import {dailyBankInterest} from './credit.mjs';
import {collectActivity} from './investment-activity.mjs';
import {glassesPurchases} from './ai-glasses.mjs';

const won=amount=>fmtMoney(amount,'KRW');
const sumOnDay=(rows,day,field)=>(rows??[]).reduce((sum,row)=>sum+(row.day===day?(row[field]??0):0),0);

const ritualSpend=(state,day)=>sumOnDay(state.ritualCharges,day,'cost')+(state.ritualPending?.day===day?state.ritualPending.cost:0);
const glassesSpend=(state,day)=>sumOnDay(glassesPurchases(state),day,'cost');

function closingNetAssets(state,record,ledger){
  if(Number.isFinite(record.netAssets))return record.netAssets;
  if(record.legacy)return null;
  if(record.day>=state.day)return record.day===state.day&&state.phase==='closed'?netWealth(state):null;
  // Newer receipts store the total. Rewind later cash movements and trades for earlier receipts.
  if(state.rehabilitationSettlements?.some(row=>row.day>record.day))return null;
  const later=(ledger??householdLedger(state)).filter(row=>row.day>record.day);
  if(later.some(row=>row.type==='trade'&&!row.legs.length))return null;
  const {byCurrency}=householdLedgerTotals(later);
  const open=state.phase==='open',spending=open?todayLiveSpending(state)?.total??0:0;
  const cash=state.cash-(byCurrency.KRW??0)+spending;
  const wallets=Object.fromEntries(Object.entries(state.wallets).map(([currency,amount])=>
    [currency,nativeRound(amount-(byCurrency[currency]??0),currency)]));
  const holdings=state.holdings.slice();
  const days=state.history.filter(row=>row.day>record.day);
  const trades=days.flatMap(row=>[...(row.trades??[]),...(row.bill?.sales??[]).map(sale=>({i:sale.i,qty:-Math.abs(sale.qty)}))]);
  if(open)trades.push(...state.fills);
  for(const {i,qty} of trades){
    if(!stocks[i]||!Number.isFinite(qty))return null;
    holdings[i]=quantityRound(holdings[i]-qty);
  }
  if([cash,...Object.values(wallets),...holdings].some(value=>!Number.isFinite(value)||value<0))return null;
  const debt=(record.credit?.total??0)+(record.loanDesk?.total??0);
  return grossAssets({...state,day:record.day,cursor:288,phase:'closed',cash,wallets,holdings})-debt;
}

export function closedAmounts(state, record) {
  const bill = record.bill;
  const paid = recordedBillPaid(bill);
  const purchase = recordedPurchase(record);
  const live = record.liveSpending?.total??0;
  const intimidation=sumOnDay(state.intimidationCharges,record.day,'cost');
  const spy=sumOnDay(state.spyCharges,record.day,'cost');
  const ritual=ritualSpend(state,record.day);
  const ledger=weekdayIndex(record.day)>=5?householdLedger(state):null;
  const refund=ledger?.filter(row=>row.type==='rebate'&&row.day===record.day).reduce((sum,row)=>sum+row.legs[0].amount,0)??0;
  const dividends=(record.dividends??[]).reduce((sum,row)=>sum+(row.amountKRW??0),0);
  const rehabilitation=rehabilitationIncomeOnDay(state,record.day);
  const bank=record.credit,desk=record.loanDesk;
  const repayment=(bank?.paidToday??0)+(desk?.paidToday??0),deskInterest=desk?.interestToday??0;
  let bankInterest=0;
  for(const {record:day,amount} of dailyBankInterest(state.history)){
    if(day.day===record.day){bankInterest=amount;break;}
  }
  const exchangeCost=sumOnDay(state.fxLog,record.day,'cost');
  const sales=collectActivity(state,record.day,false);
  return {bill,paid,purchase,live,refund,intimidation,spy,ritual,glasses:glassesSpend(state,record.day),dividends,rehabilitation,
    repayment,bankInterest,deskInterest,exchangeCost,sales,netAssets:closingNetAssets(state,record,ledger)};
}

const flow=amount=>(amount>0?'+':'')+won(amount);
export function reviewValues(state){
  const {day,mental}=state;
  const profit=financialMood(state)?.profit??0;
  const estimate=dailySpendingEstimate(state);
  const salary=dailySalary(state),bonus=dailyBonus(state);
  const rehabilitation=rehabilitationIncomeOnDay(state,day);
  const extras=ritualSpend(state,day)+glassesSpend(state,day)+sumOnDay(state.intimidationCharges,day,'cost')+sumOnDay(state.spyCharges,day,'cost')+
    sumOnDay(state.fxLog,day,'cost')+sumOnDay(state.credit?.ledger,day,'interest')+
    sumOnDay(state.loanDesk?.ledger,day,'interest')+sumOnDay(state.loanDesk?.ledger,day,'upfrontInterest');
  return {extras,rehabilitation,values:{
    mental:String(mental),
    profit:flow(profit),
    extra:flow(-extras),
    estimate:flow(-estimate),
    income:flow(salary),
    bonus:flow(bonus),
    rehabilitation:flow(rehabilitation),
    net:flow(salary+bonus+rehabilitation-estimate-extras)
  }};
}
