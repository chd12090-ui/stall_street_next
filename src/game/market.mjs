import {stocks,days,currencies,markets,runsOn,quantityUnit,quantityRound,snapPrice,priceTick,fmtMoney,symbolIndex} from './world.mjs';
import {quoteAt,barAt,schedule,barsPerDay,historyClosePrices,instrumentPressure} from './tape.mjs';
import {fxRates,fxQuote,nativeRound,isExchangeCurrency} from './fx.mjs';
import {emptyCredit,reviewCredit,drawOffers,acceptOffer,rejectOffers,payCredit,outstandingCredit,clearBankLoan,closeCreditDay,loadableCredit,upgradeCreditBanks} from './credit.mjs';
import {borrowAtDesk,clearDeskLoan,closeLoanDeskDay,deskLoanBalance,loadableLoanDesk,repayAtDesk} from './loan-desk.mjs';
import {accountTick,civilDate,continuousTradingDay,gameClockRate,gameDayStart,gameTimestamp,marketClock,marketElapsed,realTime,usesKst,weekdayIndex} from './clock-calendar.mjs';
import {marketPrints} from './market-ticks.mjs';
import {previousListingCounts,tapePrice,nyangUnitsPerLegacyCoin} from './securities-data.mjs';
import {testFriends} from './test-friends.mjs';
import {botDayProfit} from './spy-snapshot.mjs';
import {recoveryLimit} from './recovery-ad.mjs';
import {dailySalary,startingDailySalary,validSalaryRecord} from './salary-negotiation.mjs';
import {validRehabilitationSave} from './rehabilitation-record.mjs';
import {validHomePetRecovery} from './home-pet-recovery.mjs';
import {fortuneSymbols,bingoReduction,canDrawFortune,fortuneGridFor,isFortuneGrid,spinGrid} from './fortune-rules.mjs';
import {missingMental,spendingInterval,spendingPerTick} from './mental-rules.mjs';
export {stocks,days,historyClosePrices as prices};
export {spendingBase,spendingInterval,spendingPerPoint,spendingPerTick,spendingWealthCharge,spendingWealthMaxRate,spendingWealthRate} from './mental-rules.mjs';
export const ECON={initial:5000000,salary:startingDailySalary,bonusMin:.1,bonusMax:.5,coupon:30000,meal:80000};
export const buyFeeRates=Object.freeze({stock:.0015,etf:.0035});
const zeroes=()=>stocks.map(()=>0),blanks=()=>stocks.map(()=>null),flags=()=>stocks.map(()=>false);
const indexedDefaults={holdings:0,costs:0,costsKRW:0,basisEstimated:false,orders:0,ordered:false,orderPrices:null,orderFees:0,orderTime:null};
const freshWallets=()=>Object.fromEntries(Object.keys(currencies).filter(c=>c!=='KRW').map(c=>[c,0]));
const retiredCurrencies=Object.keys(currencies).filter(c=>!isExchangeCurrency(c));
const cashSequence=s=>(s.cashSequence=(s.cashSequence||0)+1);
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const toward=(v,target,step)=>v+Math.sign(target-v)*Math.min(Math.abs(target-v),step);
export const initial=()=>({
  version:3,saleHistoryVersion:1,nyangUnits:true,bitcoinCurrency:'USD',day:0,phase:'open',cash:ECON.initial,wallets:freshWallets(),mental:75,holdings:zeroes(),costs:zeroes(),costsKRW:zeroes(),basisEstimated:flags(),
  orders:zeroes(),ordered:flags(),cursor:0,orderPrices:blanks(),orderFees:zeroes(),fills:[],expired:[],fxLog:[],startWealth:ECON.initial,
  luck:null,discount:0,discountToday:0,weekendRebate:0,weekendLog:[],cashSequence:0,profit:0,realizedKRW:0,credit:emptyCredit(),history:[],edits:0,sound:true
});
export const mood=n=>n<25?'지침':n>=60&&n<80?'평온':'안정';

// Older receipts have no interval and may use the former 0.04% ten-second cap.
function validSpendingAmount(row){
  const {amount,mental,wealth,intervalMs}=row;
  if(intervalMs===undefined){
    if(wealth===undefined)return amount<=105;
    return Number.isSafeInteger(wealth)&&wealth>=0&&amount<=5+missingMental(mental)+Math.round(wealth*(.0004*missingMental(mental)/100));
  }
  return intervalMs===spendingInterval&&Number.isSafeInteger(wealth)&&wealth>=0&&amount<=spendingPerTick(mental,wealth);
}
const spendingTicksPerDay=Math.floor(86_400_000/(gameClockRate*spendingInterval));
export function estimateDailySpending(mental,wealth,availableWon){
  let total=0;
  for(let tick=0;tick<spendingTicksPerDay&&total<availableWon;tick++){
    total+=Math.min(spendingPerTick(mental,wealth-total),availableWon-total);
  }
  return total;
}
export const todayLiveSpending=s=>s.liveSpending?.day===s.day?s.liveSpending:null;
let spendingEstimate;
export function dailySpendingEstimate(s,wealth){
  const {day,resetId,mental}=s;
  const financingTransactions=(s.credit?.ledger?.length??0)+(s.loanDesk?.ledger?.length??0)+(s.rehabilitationPayments?.length??0)+(s.rehabilitationSettlements?.length??0);
  if(!spendingEstimate||day!==spendingEstimate.day||resetId!==spendingEstimate.resetId||
      financingTransactions!==spendingEstimate.financingTransactions||Math.abs(mental-spendingEstimate.mental)>=2){
    const amount=estimateDailySpending(mental,wealth??grossAssets(s),exchangeable(s,'KRW'));
    spendingEstimate={day,resetId,mental,financingTransactions,amount};
  }
  return Math.max(spendingEstimate.amount,todayLiveSpending(s)?.total??0);
}
const gameHour=3_600_000;
export const mentalDecayInterval=40*60_000;
export const mentalConnectionReduction=.75;
const baseDecayRate=gameHour/mentalDecayInterval;
export const mentalBurdenCap=12;
export const mentalDebtBurdenCap=16;
const decayRate=(burden,connection,fortune)=>Math.round((baseDecayRate+burden-connection)*(100-fortune)*100)/10000;
export function mentalRateBreakdown(s){
  const {investmentPoints:investment,debtPoints:debt}=financialMood(s);
  const connection=s.mentalConnectedAt===undefined?0:mentalConnectionReduction;
  const fortunePercent=bingoReduction(s);
  return {base:-baseDecayRate,investment,debt,connection,fortunePercent,rate:decayRate(-investment-debt,connection,fortunePercent)};
}
export const mentalDecayRate=s=>storedDecayRate(s);
function storedDecayRate(s,bingo=bingoReduction(s)){
  const book=s.mentalRates,connected=s.mentalConnectedAt!==undefined;
  if(Number.isFinite(book?.debtPoints)&&(!connected||s.mentalConnectionFlat)){
    return decayRate(-book.investmentPoints-book.debtPoints,connected?mentalConnectionReduction:0,bingo);
  }
  // Earlier deadlines applied the connection discount after fortune, or used a 75% multiplier.
  const rate=baseDecayRate*(100-bingo)/100;
  return !connected?rate:s.mentalConnectionFlat?Math.max(0,rate-mentalConnectionReduction):rate*.75;
}
function decayInterval(s,bingo=bingoReduction(s)){
  // A paused clock stores its remaining progress at the base rate.
  const rate=storedDecayRate(s,bingo)||baseDecayRate;
  return Math.round(gameHour/rate*(s.mentalBuffUntil===undefined?1:2));
}

// Changing rates preserves the fraction of the current point already consumed.
function rescaleDecayClock(s,at,before,after){
  if(s.mentalDecayAt!==undefined&&before!==after){
    const remaining=s.mentalDecayAt-at;
    const scaled=Math.round(remaining*after/before);
    s.mentalDecayAt=at+(remaining>0?Math.max(1,scaled):scaled);
  }
}

export function initializeMentalClock(s,gameAt){
  if(s.mentalDecayAt!==undefined)return false;
  // Keep the old timer's unfinished interval. Count offline time from the first load of this version.
  s.mentalDecayAt=gameAt+Math.round((1-(s.mentalActivity?.elapsed??0)/mentalDecayInterval)*decayInterval(s));
  delete s.mentalActivity;
  return true;
}
function decayTo(s,gameAt){
  if(s.mentalConnectedAt!==undefined){
    if(gameAt<=s.mentalConnectedAt)return false;
    const elapsed=gameAt-s.mentalConnectedAt;
    s.mentalConnectedAt=gameAt;
    if(storedDecayRate(s)===0){
      s.mentalDecayAt+=elapsed;
      return false;
    }
  }
  if(gameAt<s.mentalDecayAt)return false;
  const interval=decayInterval(s);
  const points=1+Math.floor((gameAt-s.mentalDecayAt)/interval);
  s.mental=Math.max(0,s.mental-points);
  s.mentalDecayAt+=points*interval;
  return true;
}
export function advanceMentalClock(s,gameAt,connectedSince=null){
  let changed=false;
  const checkpoint=s.mentalConnectedAt;
  if(checkpoint!==undefined){
    if(gameAt<checkpoint)return false;
    const disconnected=connectedSince===null||connectedSince>checkpoint;
    if(disconnected||!s.mentalConnectionFlat){
      const before=decayInterval(s);
      if(disconnected){
        delete s.mentalConnectedAt;
        delete s.mentalConnectionFlat;
      }else s.mentalConnectionFlat=true;
      rescaleDecayClock(s,checkpoint,before,decayInterval(s));
      changed=true;
    }
  }
  if(s.mentalBuffUntil!==undefined){
    // Finish the old input buff at its expiry or when the new session begins.
    const expires=gameTimestamp(s.mentalBuffUntil);
    const end=Math.max(checkpoint??0,Math.min(expires,connectedSince??Infinity));
    if(end<=gameAt){
      decayTo(s,end);
      const before=decayInterval(s);
      delete s.mentalBuffUntil;
      rescaleDecayClock(s,end,before,decayInterval(s));
      changed=true;
    }
  }
  if(s.mentalConnectedAt===undefined&&connectedSince!==null&&connectedSince<=gameAt){
    decayTo(s,connectedSince);
    const before=decayInterval(s);
    s.mentalConnectedAt=connectedSince;
    s.mentalConnectionFlat=true;
    rescaleDecayClock(s,connectedSince,before,decayInterval(s));
    changed=true;
  }
  return decayTo(s,gameAt)||changed;
}

export function chargeLiveSpending(s,now=Date.now()){
  if(!usesKst(s)||s.phase!=='open'||now-(s.liveSpending?.at??-Infinity)<spendingInterval)return 0;
  const gameAt=gameTimestamp(now),wall=realTime(gameAt);
  if(wall.day!==s.day)return 0;
  const cash=exchangeable(s,'KRW');
  if(!cash)return 0;
  const wealth=grossAssets(s),amount=Math.min(spendingPerTick(s.mental,wealth),cash);
  if(!amount)return 0;
  const current=todayLiveSpending(s);
  const recent=[...(current?.recent??[]),{at:now,gameAt,amount,mental:s.mental,wealth,intervalMs:spendingInterval}].slice(-12);
  s.liveSpending={day:s.day,at:now,step:wall.cursor,seq:cashSequence(s),
    total:(current?.total??0)+amount,count:(current?.count??0)+1,recent};
  adjust(s,'KRW',-amount);
  // Deduct cash from the investment baseline too, so consumption never counts as market losses.
  s.startWealth-=amount;
  reconcileFinancialMood(s,gameAt);
  return amount;
}
const investmentMark=(s,value=stockValue(s))=>value+(s.realizedKRW??0)-s.costsKRW.reduce((sum,won)=>sum+won,0);
const totalBorrowed=s=>outstandingCredit(s)+(deskLoanBalance(s)?.total??0);
// Reconstruct the opening mark for saves made before the daily ledger existed.
function openingInvestmentMark(s){
  const quantities=s.holdings.slice();
  let tradingCash=0;
  for(const fill of s.fills){
    const asset=stocks[fill.i];
    const currency=fill.currency??asset?.currency;
    if(!asset||!Object.hasOwn(currencies,currency)||!Number.isFinite(fill.qty))continue;
    const cash=fill.cashDelta??-nativeRound(fill.qty*fill.price,currency);
    if(!Number.isFinite(cash))continue;
    quantities[fill.i]=quantityRound(quantities[fill.i]-fill.qty);
    const {day,cursor}=marketClock(s,fill.step??0);
    tradingCash+=Math.sign(cash)*Math.round(Math.abs(cash)*fxRates(day,cursor)[currency]);
  }
  const opening={...s,holdings:quantities,cursor:0,wallMinute:0,wallSecond:0,phase:'open'};
  return investmentMark(s,stockValue(opening))-tradingCash;
}
function financeBurden(amount,worth,cap){
  if(amount<=0)return 0;
  if(worth<=0)return -cap;
  return -Math.min(cap,Math.round(baseDecayRate*100*amount/worth)/100)||0;
}
export function financialMood(s){
  const book=s.mentalRates?.day===s.day?s.mentalRates:null;
  const value=stockValue(s),debt=totalBorrowed(s);
  const openProfit=investmentMark(s,value)-(book?.opening??openingInvestmentMark(s))+(book?.dividends??0);
  const worth=debt||openProfit<0?grossAssets(s,value)-debt:0;
  return {profit:openProfit+(book?.priorProfit??0),debt,
    investmentPoints:financeBurden(-openProfit,worth,mentalBurdenCap),debtPoints:financeBurden(debt,worth,mentalDebtBurdenCap)};
}
function financialClockAt(s){
  return s.mentalConnectedAt??(gameDayStart(s.day)+(s.wallMinute??s.cursor*5)*60000+(s.wallSecond??0)*1000);
}
export function reconcileFinancialMood(s,at=financialClockAt(s)){
  const prior=s.mentalRates,legacy=s.mentalFinance,before=decayInterval(s);
  const fresh=prior?.day!==s.day;
  if(legacy){
    // A v37 tab may write its own ledger alongside the new one. Reverse only the instant
    // points it actually applied, then retire that ledger. Earned hourly drain stays spent.
    const applied=(Number.isFinite(legacy.investment?.applied)?legacy.investment.applied:0)
      +(Number.isFinite(legacy.debt?.applied)?legacy.debt.applied:0);
    if(applied)s.mental=clamp(s.mental-applied,0,100);
    delete s.mentalFinance;
  }
  if(fresh){
    const previous=legacy?.day===s.day?legacy:null;
    s.mentalRates={day:s.day,opening:previous?.opening??openingInvestmentMark(s),dividends:previous?.dividends??0};
  }
  const book=s.mentalRates,{investmentPoints,debtPoints}=financialMood(s);
  if(!fresh&&!legacy&&book.investmentPoints===investmentPoints&&book.debtPoints===debtPoints)return false;
  Object.assign(book,{investmentPoints,debtPoints});
  rescaleDecayClock(s,at,before,decayInterval(s));
  return true;
}
function applyBingo(s,grid,gameAt){
  if(usesKst(s)){
    initializeMentalClock(s,gameAt);
    advanceMentalClock(s,gameAt,s.mentalConnectedAt??null);
  }
  const before=decayInterval(s);
  s.fortuneGrid=grid;
  s.luck='bingo';
  rescaleDecayClock(s,gameAt,before,decayInterval(s));
}
export function roll(s,random=Math.random,gameAt=gameTimestamp(Date.now()),{reroll=false}={}){
  if(!canDrawFortune(s,reroll))return false;
  const rng=typeof random==='function'?random:()=>random;
  applyBingo(s,spinGrid(null,rng),gameAt);
  if(reroll){
    delete s.fortuneRerollReady;
    s.fortuneRerollUsed=true;
  }
  return true;
}
// An old draw is still today's draw. Its already-booked money stays on the ledger.
export function migrateDailyFortune(s,gameAt){
  if(!s.luck||s.luck==='bingo'||s.phase!=='open')return false;
  applyBingo(s,fortuneGridFor(s),gameAt);
  return true;
}
export const balance=(s,c='KRW')=>c==='KRW'?s.cash:(s.wallets[c]??0);
function adjust(s,c,delta){
  const next=nativeRound(balance(s,c)+delta,c);
  if(c==='KRW')s.cash=next;else s.wallets[c]=next;
}
function settleRetiredCash(s,from,rate,step=s.cursor){
  const amount=balance(s,from),received=nativeRound(amount*rate,'KRW');
  s.wallets[from]=0;
  adjust(s,'KRW',received);
  s.fxLog.push({from,to:'KRW',amount,received,rate,mid:rate,cost:0,
    reason:'retired-currency',day:s.day,step,seq:cashSequence(s)});
}
export const localRates=s=>{
  const {day,cursor}=marketClock(s);
  return fxRates(day,cursor);
};
export const averagePurchasePrice=(s,i)=>s.holdings[i]>0?s.costs[i]/s.holdings[i]:null;
export function position(s,i){
  const a=stocks[i],qty=s.holdings[i],cost=s.costs[i],costKRW=s.costsKRW[i],rate=localRates(s)[a.currency];
  const value=qty?nativeRound(qty*quoteAt(s,i),a.currency):0;
  const valueKRW=Math.round(value*rate),profit=nativeRound(value-cost,a.currency),profitKRW=valueKRW-costKRW;
  return {qty,cost,costKRW,average:averagePurchasePrice(s,i)??0,value,profit,pct:cost?100*profit/cost:0,valueKRW,profitKRW,pctKRW:costKRW?100*profitKRW/costKRW:0,estimated:!!s.basisEstimated[i]};
}
export function stockValue(s){
  let value=0,rates;
  s.holdings.forEach((qty,i)=>{
    if(!qty)return;
    const c=stocks[i].currency,rate=c==='KRW'?1:(rates??=localRates(s))[c];
    value+=nativeRound(qty*quoteAt(s,i),c)*rate;
  });
  return Math.round(value);
}
export function grossAssets(s,value=stockValue(s)){
  let cash=s.cash,rates;
  for(const [c,amount] of Object.entries(s.wallets)){
    if(amount&&Object.hasOwn(currencies,c)&&c!=='KRW')cash+=amount*(rates??=localRates(s))[c];
  }
  return Math.round(value+cash);
}
export function netWealth(s){
  return grossAssets(s)-outstandingCredit(s)-(deskLoanBalance(s)?.total||0);
}
function updatePosition(s,i,qty,amount,rate){
  const held=s.holdings[i],c=stocks[i].currency;
  const next=quantityRound(held+qty),priorBasis=s.costsKRW[i],estimated=s.basisEstimated[i];
  if(qty>0){s.costs[i]=nativeRound(s.costs[i]+amount,c);s.costsKRW[i]+=Math.round(amount*rate);}
  else if(next>0&&held>0){
    s.costs[i]=nativeRound(s.costs[i]*next/held,c);s.costsKRW[i]=Math.round(s.costsKRW[i]*next/held);
  }else{s.costs[i]=0;s.costsKRW[i]=0;s.basisEstimated[i]=false;}
  s.holdings[i]=next;
  if(qty<0){
    const realizedKRW=Math.round(amount*rate)-(priorBasis-s.costsKRW[i]);
    s.realizedKRW+=realizedKRW;
    if(estimated)s.realizedEstimated=true;
    return estimated?{realizedKRW,estimated:true}:{realizedKRW};
  }
}
const cashScale={MR:10000,AD:10,LM:10,HA:800};
const aliases={MR:'KRW',AD:'USD',LM:'GBP',HA:'JPY'};
const shareScale=[10,10,10,10,2,2,2,10,10,8,8,.0064,.08,10,10,10,10,10,10,10,2,2];
const oldNames=['달밤배달','이른장터','새벽전철','온기전력','아르덴칩','노바클라우드','서안항운','크라운은행','노르드가스','해온조선','산호소재','비트코어','에테르망','모라 대표지수','모라 레버리지 2X','모라 인버스','비트코어 추종','비트코어 레버리지 2X','비트코어 인버스','에테르망 추종','아르덴 테크 2X','아르덴 테크 인버스'];
function oldCurrency(i){return i<4||i>=11&&i<20?'MR':i<7||i>=20?'AD':i<9?'LM':'HA';}
const oldToWon=n=>Math.round((n??0)*cashScale.MR);
function legacyFx(q){
  if(!aliases[q?.from]||!aliases[q?.to])return null;
  const from=aliases[q.from],to=aliases[q.to],ratio=cashScale[q.to]/cashScale[q.from];
  return {...q,from,to,amount:nativeRound(q.amount*cashScale[q.from],from),received:nativeRound(q.received*cashScale[q.to],to),mid:q.mid*ratio,rate:q.rate*ratio,cost:oldToWon(q.cost)};
}
const bitcoin=symbolIndex.BIT;
const legacyPrice=(i,n)=>Number.isFinite(n)?tapePrice(i,n*cashScale[oldCurrency(i)]/shareScale[i]):null;
function legacyRow(row){
  const i=Number.isInteger(row.i)?row.i:oldNames.indexOf(row.name);
  if(i<0||i>=shareScale.length)return null;
  const c=stocks[i].tape?.currency??stocks[i].currency;
  const converted={...row,i,name:stocks[i].name,currency:c,unit:quantityUnit(i),qty:quantityRound(row.qty*shareScale[i])};
  for(const f of ['price','limit'])if(f in row)converted[f]=legacyPrice(i,row[f]);
  if(Number.isFinite(row.price)&&Number.isFinite(row.qty)){
    const originalNotional=Math.round((row.qty*row.price+Number.EPSILON)*100)/100;
    converted.cashDelta=nativeRound(-originalNotional*cashScale[oldCurrency(i)],c);
  }
  if('amount' in row)converted.amount=nativeRound(row.amount*cashScale[oldCurrency(i)],c);
  return converted;
}
const mapRows=rows=>(rows||[]).map(legacyRow).filter(Boolean);
function legacyReceipt(r){
  const bill=r.bill?{...r.bill,sales:mapRows(r.bill.sales),conversions:(r.bill.conversions||[]).map(legacyFx).filter(Boolean)}:null;
  if(bill)for(const k of ['due','income','discount','debt'])bill[k]=oldToWon(bill[k]);
  return {...r,gains:oldToWon(r.gains),trades:mapRows(r.trades),expired:mapRows(r.expired),cancelled:mapRows(r.cancelled),bill};
}
function recordedDollarBasis(s){
  const basis=s.costs[bitcoin];
  if(!basis)return 0;
  let qty=0,won=0,dollars=0;
  const add=(r,day)=>{
    if(r.i!==bitcoin||!(r.qty>0))return;
    const tick=Number.isInteger(r.tapeKey)?r.tapeKey:day*288+(r.step??0)-(usesKst(s)?108:0);
    const tapeDay=Math.floor(tick/288),rate=fxRates(tapeDay,tick-tapeDay*288).USD;
    const amount=Number.isFinite(r.cashDelta)?-r.cashDelta:r.qty*r.price;
    if(!Number.isFinite(amount)||amount<0)return;
    qty=quantityRound(qty+r.qty);won+=amount;dollars+=amount/rate;
  };
  const remove=(r,sold)=>{
    if(r.i!==bitcoin||!(sold>0)||qty<=0)return;
    const left=quantityRound(Math.max(0,qty-sold)),remaining=left/qty;
    dollars*=remaining;won*=remaining;qty=left;
  };
  const replay=(rows,day)=>{for(const r of rows||[]){if(r.qty<0)remove(r,-r.qty);else add(r,day);}};
  for(const r of s.history){
    replay(r.trades,r.day);
    for(const sold of r.bill?.sales||[])remove(sold,sold.qty);
  }
  if(s.phase==='open')replay(s.fills,s.day);
  const complete=qty===s.holdings[bitcoin]&&Math.abs(won-basis)<=Math.max(2,basis*.001)&&won>0;
  return complete?nativeRound(dollars*basis/won,'USD'):nativeRound(basis/localRates(s).USD,'USD');
}
// Rebuild old sales from the same average-cost and trade-time FX rules used
// by the live engine. Never assign a zero cost to an unrecorded acquisition.
function restoreSaleHistory(s){
  const ledger=stocks.map(()=>({qty:0,cost:0,netCash:0,sold:false,complete:true}));
  function record(row,date,forced=false){
    const asset=stocks[row.i],account=ledger[row.i];
    if(!asset||!Number.isFinite(row.qty)||!row.qty)return row;
    const qty=forced?-row.qty:row.qty,c=row.currency||asset.currency;
    const next=quantityRound(account.qty+qty);
    let {day,cursor}=marketClock(date,forced?288:row.step??0);
    if(Number.isInteger(row.tapeKey)){
      day=Math.floor(row.tapeKey/288);cursor=row.tapeKey-day*288;
    }
    const cash=forced?row.amount:row.cashDelta??(currencies[c]&&Number.isFinite(row.price)?-nativeRound(qty*row.price,c):null);
    const rate=c==='KRW'?1:currencies[c]&&fxRates(day,cursor)[c];
    if(!Number.isFinite(cash)||!Number.isFinite(rate)||next<0)account.complete=false;
    const won=Number.isFinite(cash)&&Number.isFinite(rate)?Math.round(Math.abs(cash)*rate):0;
    account.netCash+=qty>0?-won:won;
    let result=row;
    if(qty>0)account.cost+=won;
    else{
      account.sold=true;
      const left=next>0&&account.qty>0?Math.round(account.cost*next/account.qty):0;
      if(row.realizedKRW===undefined)result={...row,realizedKRW:account.complete?won-(account.cost-left):null};
      account.cost=left;
    }
    account.qty=next;
    return result;
  }
  s.history=s.history.map(h=>{
    const date=h.legacy?{day:h.day-(s.openingDay??0)}:{day:h.day,clockMode:s.clockMode};
    const trades=(h.trades??[]).map(row=>record(row,date));
    const bill=h.bill?.sales?{...h.bill,sales:h.bill.sales.map(row=>record(row,date,true))}:h.bill;
    return {...h,trades,bill};
  });
  s.fills=s.phase==='open'?s.fills.map(row=>record(row,s)):s.history.at(-1)?.trades??s.fills;
  if(!Number.isSafeInteger(s.realizedKRW)){
    s.realizedKRW=0;
    for(const [i,account] of ledger.entries()){
      if(!account.sold)continue;
      if(!account.complete||account.qty!==s.holdings[i]||s.basisEstimated[i])s.realizedEstimated=true;
      else s.realizedKRW+=account.netCash+s.costsKRW[i];
    }
  }
  s.saleHistoryVersion=1;
}
const blockedBuy=(i,qty)=>qty>0&&stocks[i].archiveOnly;
function migrateMarketSupport(s,changingBitcoin,retiredWallets){
  const restricted=s.orders.flatMap((qty,i)=>blockedBuy(i,qty)||changingBitcoin&&i===bitcoin&&qty?[i]:[]);
  if(restricted.length){
    for(const key of ['orders','orderPrices','orderFees','ordered','orderTime','expired'])if(s[key])s[key]=s[key].slice();
    for(const i of restricted){
      if(changingBitcoin&&i===bitcoin)expire(s,i,s.cursor,'달러 거래 전환으로 예약 취소','KRW');
      else expire(s,i,s.cursor,'매수 지원 종료');
    }
  }
  if(retiredWallets.length){
    const rates=localRates(s);
    s.wallets={...s.wallets};
    s.fxLog=s.fxLog.slice();
    for(const c of retiredWallets)settleRetiredCash(s,c,rates[c]);
  }
  return s;
}
function upgradeCoinUnits(state){
  // The same listing slot and total cost basis survive the split, including in shared rooms.
  const factor=nyangUnitsPerLegacyCoin;
  const revised={...state,nyangUnits:true};
  for(const key of ['holdings','orders','orderPrices']){
    revised[key]=state[key].slice();
    const value=state[key][bitcoin];
    // Retain an existing limit exactly. Future fills still use the new public price tick.
    if(value!=null)revised[key][bitcoin]=key==='orderPrices'?value/factor:quantityRound(value*factor);
  }
  function rows(list){
    return list.map(r=>{
      if(r.i!==bitcoin){
        return [symbolIndex.BITF,symbolIndex.BIT2,symbolIndex.BITI].includes(r.i)?{...r,name:stocks[r.i].name}:r;
      }
      const changed={...r,name:stocks[bitcoin].name,qty:quantityRound(r.qty*factor)};
      for(const key of ['price','limit'])if(Number.isFinite(r[key]))changed[key]=r[key]/factor;
      return changed;
    });
  }
  for(const key of ['fills','expired','cancelled'])if(state[key])revised[key]=rows(state[key]);
  revised.history=state.history.map(day=>{
    const record={...day};
    for(const key of ['trades','expired','cancelled'])if(day[key])record[key]=rows(day[key]);
    if(day.bill?.sales)record.bill={...day.bill,sales:rows(day.bill.sales)};
    return record;
  });
  return revised;
}
export function upgrade(old){
  if(old.version===3){
    const credit=upgradeCreditBanks(old.credit);
    const needsListings=old.holdings.length<stocks.length;
    const changingBitcoin=old.bitcoinCurrency!=='USD';
    const retiredWallets=retiredCurrencies.filter(c=>balance(old,c)>0);
    if(old.friendNotes===undefined&&old.expenseStart===undefined&&old.impulseDue===undefined&&old.saleHistoryVersion===1&&Number.isSafeInteger(old.realizedKRW)&&!needsListings&&!changingBitcoin&&!retiredWallets.length&&!old.orders.some((qty,i)=>blockedBuy(i,qty))&&credit===old.credit&&old.weekendLog&&Number.isSafeInteger(old.cashSequence))return old.nyangUnits?old:upgradeCoinUnits(old);
    const upgraded={...old,credit,weekendLog:old.weekendLog??[],cashSequence:old.cashSequence??0};
    delete upgraded.friendNotes;
    delete upgraded.expenseStart;
    delete upgraded.impulseDue;
    if(needsListings)for(const [key,value] of Object.entries(indexedDefaults)){
      upgraded[key]=stocks.map((_,i)=>old[key]?.[i]??value);
    }
    if(changingBitcoin){
      upgraded.bitcoinCurrency='USD';
      upgraded.costs=upgraded.costs.slice();
      upgraded.costs[bitcoin]=recordedDollarBasis(upgraded);
    }
    if(upgraded.saleHistoryVersion!==1||!Number.isSafeInteger(upgraded.realizedKRW))restoreSaleHistory(upgraded);
    const supported=migrateMarketSupport(upgraded,changingBitcoin,retiredWallets);
    return supported.nyangUnits?supported:upgradeCoinUnits(supported);
  }
  const s={...initial(),...old,version:3,bitcoinCurrency:'USD',cash:oldToWon(old.cash),wallets:freshWallets(),cursor:old.phase==='closed'?288:old.cursor||0,
    holdings:zeroes(),costs:zeroes(),costsKRW:zeroes(),basisEstimated:flags(),orders:zeroes(),ordered:flags(),orderPrices:blanks(),
    history:old.history.map(legacyReceipt),expired:mapRows(old.expired),fills:mapRows(old.fills??(old.phase==='closed'?old.history.at(-1)?.trades:[])),
    fxLog:(old.fxLog||[]).map(legacyFx).filter(Boolean)};
  delete s.expenseStart;
  delete s.impulseDue;
  for(const [c,n] of Object.entries(old.wallets||{}))if(aliases[c]&&c!=='MR')s.wallets[aliases[c]]=nativeRound(n*cashScale[c],aliases[c]);
  for(const k of ['profit','discount','discountToday','weekendRebate'])s[k]=oldToWon(old[k]);
  for(let i=0;i<old.orders.length;i++){
    s.orders[i]=quantityRound(old.orders[i]*shareScale[i]);s.orderPrices[i]=legacyPrice(i,old.orderPrices?.[i]);s.ordered[i]=old.ordered?.[i]??!!s.orders[i];
  }
  // Replay known acquisitions at their trade date and preserve the old quantity economics across each redenomination.
  const replay=(rows,day)=>{for(const r of rows){
    if(!Number.isFinite(r.price)||s.holdings[r.i]+r.qty<-.000000001){
      if(r.qty<0)s.realizedEstimated=true;
      continue;
    }
    const rate=fxRates(day,r.step||0)[stocks[r.i].currency];
    Object.assign(r,updatePosition(s,r.i,r.qty,r.i===bitcoin?r.price/rate:r.price,rate));
  }};
  for(const r of s.history){
    replay(r.trades,r.day);
    for(const sale of r.bill?.sales||[]){
      if(!(sale.qty>0&&s.holdings[sale.i]>=sale.qty)){s.realizedEstimated=true;continue;}
      const rate=fxRates(r.day,288)[stocks[sale.i].currency];
      const px=sale.amount/sale.qty;
      Object.assign(sale,updatePosition(s,sale.i,-sale.qty,sale.i===bitcoin?px/rate:px,rate));
    }
  }
  if(s.phase==='open')replay(s.fills,s.day);
  for(let i=0;i<old.holdings.length;i++){
    const qty=quantityRound(old.holdings[i]*shareScale[i]);
    if(Math.abs(s.holdings[i]-qty)>1e-9){
      const c=stocks[i].currency;s.holdings[i]=qty;s.basisEstimated[i]=qty>0;
      s.costs[i]=qty?nativeRound(qty*quoteAt(s,i)*(i===bitcoin?nyangUnitsPerLegacyCoin:1),c):0;s.costsKRW[i]=Math.round(s.costs[i]*localRates(s)[c]);
    }
  }
  const converted=upgradeCoinUnits(migrateMarketSupport(s,true,retiredCurrencies.filter(c=>balance(s,c)>0)));
  converted.startWealth=Number.isFinite(old.startWealth)?oldToWon(old.startWealth):netWealth(converted);
  return converted;
}
function tradingAt(s,i){
  const {day,cursor,phase}=marketClock(s);
  return phase==='open'&&runsOn(stocks[i].market,day)&&schedule(i,day).index[cursor]>=0;
}
function purchaseFeeRate(i){
  const stock=stocks[i];
  return stock.reference?buyFeeRates.etf:stock.kind==='주식'?buyFeeRates.stock:0;
}
export function orderFeeRate(s,i,qty,price){
  if(!(qty>0))return 0;
  // A reservation retains its disclosed terms after an upgrade or reload.
  return qty===s.orders[i]&&price===s.orderPrices[i]?s.orderFees?.[i]??0:purchaseFeeRate(i);
}
export function orderAmounts(i,qty,price,feeRate=qty>0?purchaseFeeRate(i):0){
  const currency=stocks[i].currency,notional=nativeRound(Math.abs(qty)*price,currency);
  const fee=qty>0&&feeRate&&notional>0?
    Math.max(10**-currencies[currency].digits,nativeRound(notional*feeRate,currency)):0;
  return {notional,fee,total:nativeRound(notional+fee,currency)};
}
function funds(s,c,orders,levels,countOpenSales){
  let total=balance(s,c);
  for(let i=0;i<orders.length;i++){
    const q=orders[i],px=levels[i];
    if(!q||stocks[i].currency!==c)continue;
    if(q>0||(countOpenSales&&px==null&&tradingAt(s,i))){
      total-=Math.sign(q)*orderAmounts(i,q,px??quoteAt(s,i),orderFeeRate(s,i,q,px)).total;
    }
  }
  return nativeRound(total,c);
}
export function projected(s,orders=s.orders,levels=s.orderPrices,c='KRW',i=null){
  return funds(s,c,orders,levels,i===null||tradingAt(s,i));
}
export function exchangeable(s,c){return isExchangeCurrency(c)?Math.max(0,Math.min(balance(s,c),funds(s,c,s.orders,s.orderPrices,false))):0;}
export function creditStatus(s,amount=0){
  return reviewCredit(s,amount,{netWorth:netWealth(s),available:exchangeable(s,'KRW'),salary:dailySalary(s)});
}
export function drawCredit(s,amount,rng=Math.random){return drawOffers(s,amount,creditStatus(s,amount),rng);}
export function takeCredit(s,offerId){
  const error=acceptOffer(s,offerId,creditStatus(s));
  if(!error){s.credit.ledger.at(-1).seq=cashSequence(s);reconcileFinancialMood(s);}
  return error;
}
export function declineCredit(s){return rejectOffers(s);}
export function repayCredit(s,amount){
  const error=payCredit(s,amount,exchangeable(s,'KRW'));
  if(!error){s.credit.ledger.at(-1).seq=cashSequence(s);reconcileFinancialMood(s);}
  return error;
}
export function takeDeskLoan(s,amount){
  const error=borrowAtDesk(s,amount);
  if(!error){s.loanDesk.ledger.at(-1).seq=cashSequence(s);reconcileFinancialMood(s);}
  return error;
}
export function repayDeskLoan(s,amount){
  const error=repayAtDesk(s,amount,exchangeable(s,'KRW'));
  if(!error){s.loanDesk.ledger.at(-1).seq=cashSequence(s);reconcileFinancialMood(s);}
  return error;
}
export function exchange(s,from,to,amount,offered){
  if(s.phase!=='open')return '다음 날을 시작하면 환전할 수 있어.';
  if(!isExchangeCurrency(from)||!isExchangeCurrency(to))return '원화와 달러만 환전할 수 있어.';
  const q=fxQuote(localRates(s),from,to,amount);
  if(!q||q.received<=0)return '통화 단위와 받을 금액을 확인해 줘.';
  if(offered!==undefined&&(!offered||offered.from!==from||offered.to!==to||offered.amount!==amount||
    offered.received!==q.received||offered.cost!==q.cost))return '환율이 바뀌었어. 받을 금액을 확인해 줘.';
  if(amount>exchangeable(s,from))return '주문에 예약된 금액을 제외하면 잔액이 부족해.';
  adjust(s,from,-amount);adjust(s,to,q.received);s.fxLog.push({...q,day:s.day,step:s.cursor,seq:cashSequence(s)});return '';
}
export function limit(s,i,side,price=null){
  if(side==='sell')return s.holdings[i];
  const stock=stocks[i],c=stock.currency,others=s.orders.slice();others[i]=0;
  if(stock.archiveOnly)return 0;
  const free=projected(s,others,s.orderPrices,c,i);
  if(free<=0)return 0;
  const px=price??quoteAt(s,i),halfUnit=.5*10**-currencies[c].digits;
  if(!(px>0))return 0;
  // Search in lots so commission and currency rounding also fit at the last lot.
  let low=0,high=Math.min(Number.MAX_SAFE_INTEGER,Math.floor((free+halfUnit)/(px*stock.lot)));
  while(low<high){
    const lots=low+Math.ceil((high-low)/2);
    if(orderAmounts(i,quantityRound(lots*stock.lot),px).total<=free)low=lots;
    else high=lots-1;
  }
  return quantityRound(low*stock.lot);
}
export function placeOrder(s,i,qty,price=null){
  const stock=stocks[i];
  if(!stock||s.phase!=='open'||!Number.isFinite(qty)||Math.abs(qty/stock.lot-Math.round(qty/stock.lot))>1e-6)return '주문 수량을 확인해 줘.';
  if(stock.archiveOnly&&qty>0)return '보유분 매도만 가능해.';
  if(qty&&!usesKst(s)&&s.day===days.length-1&&s.cursor>=schedule(i,s.day).end)return '이 모의 거래에서는 더 이상 주문할 수 없어.';
  if(!qty)price=null;
  if(price!==null&&(!Number.isFinite(price)||price<=0||price>1e13||Math.abs(price-snapPrice(i,price))>1e-7))return '호가 단위 '+fmtMoney(priceTick(i,price),stock.currency)+'에 맞춰 줘.';
  if(qty&&!(quoteAt(s,i)>0))return '시세가 시작되면 주문할 수 있어.';
  if(qty===s.orders[i]&&price===s.orderPrices[i])return '';
  if(quantityRound(s.holdings[i]+qty)<0)return '매도할 보유 수량이 부족해.';
  const orders=s.orders.slice(),levels=s.orderPrices.slice();orders[i]=quantityRound(qty);levels[i]=price;
  const feeRate=orderFeeRate(s,i,orders[i],price);
  if(qty>0&&projected(s,orders,levels,stock.currency,i)<0)return '사용 가능한 돈이 부족해. '+currencies[stock.currency].name+' 잔액을 확인해 줘.';
  if(s.orders[i])(s.cancelled??=[]).push({...row(s,i),step:s.cursor,reason:qty?'주문 변경':'직접 취소'});
  (s.orderFees??=zeroes())[i]=feeRate;
  s.orders=orders;s.orderPrices=levels;s.ordered[i]=!!qty;
  if(usesKst(s))(s.orderTime??=blanks())[i]=qty?accountTick(s.day,s.cursor,marketElapsed(s)??0):null;
  return '';
}
function row(s,i,currency=stocks[i].currency){return {qty:s.orders[i],i,name:stocks[i].name,limit:s.orderPrices[i],placedAt:s.orderTime?.[i],currency,unit:quantityUnit(i)};}
function clear(s,i){
  s.orders[i]=0;s.orderPrices[i]=null;s.ordered[i]=false;
  if(s.orderFees)s.orderFees[i]=0;
  if(s.orderTime)s.orderTime[i]=null;
}
export function clearRehabilitationFinances(s){
  const {profit,debt}=financialMood(s);
  const balances=Object.fromEntries(Object.keys(currencies)
    .map(currency=>[currency,balance(s,currency)]).filter(([,amount])=>amount>0));
  const receipt={day:s.day,step:s.cursor,seq:cashSequence(s),balances,assets:grossAssets(s),debt};
  s.rehabilitationSettlements=[...(s.rehabilitationSettlements??[]),receipt];
  const cancelled=s.orders.flatMap((qty,i)=>qty?[{...row(s,i),step:s.cursor,reason:'회생으로 취소'}]:[]);
  s.cancelled=[...(s.cancelled??[]),...cancelled];
  for(const [field,empty] of Object.entries(indexedDefaults)){
    s[field]=stocks.map(()=>empty);
  }
  s.cash=0;
  s.wallets=freshWallets();
  clearBankLoan(s);
  clearDeskLoan(s);
  // Preserve the day's investment result, but begin measuring investment
  // pressure from the empty portfolio. The previous day's basis stays intact.
  s.mentalRates={...s.mentalRates,day:s.day,opening:s.realizedKRW??0,dividends:0,priorProfit:profit};
  reconcileFinancialMood(s);
}
function expire(s,i,step,reason='장 종료',currency){s.expired.push({...row(s,i,currency),step,reason});clear(s,i);}
function ordersForMatching(s){
  const pending=[];
  s.orders.forEach((qty,i)=>{if(qty)pending.push(i);});
  return pending.sort((a,b)=>s.orders[a]-s.orders[b]);
}
function matchStep(s,step,cutoff,finish,pending){
  const session=marketClock(s,step),live=usesKst(s);
  for(const i of pending){
    const qty=s.orders[i];
    if(!qty)continue;
    if(blockedBuy(i,qty)){expire(s,i,step,'매수 지원 종료');continue;}
    const b=barAt(i,session.day,session.cursor,instrumentPressure(s.ritualEvents,i));if(!b)continue;
    const lim=s.orderPrices[i];
    const eligible=lim==null?()=>true:qty>0?px=>px<=lim:px=>px>=lim;
    const t0=accountTick(s.day,step),after=(s.orderTime?.[i]??t0-1)-t0;
    const match=live?marketPrints(b,i).find(trade=>trade.at>after&&trade.at<=cutoff&&eligible(trade.price)):null;
    const px=live?match?.price:lim==null?b.o:qty>0?(eligible(b.o)?b.o:eligible(b.l)?lim:null):(eligible(b.o)?b.o:eligible(b.h)?lim:null);
    if(px==null){
      if(finish&&session.day<continuousTradingDay&&session.cursor+1===schedule(i,session.day).end&&
        (!markets[stocks[i].market].continuous||!live))expire(s,i,step+1);
      continue;
    }
    const c=stocks[i].currency,{total,fee}=orderAmounts(i,qty,px,s.orderFees?.[i]??0);
    const cashDelta=-Math.sign(qty)*total;
    if(qty>0&&total>balance(s,c)){expire(s,i,step,'잔액 부족');continue;}
    adjust(s,c,cashDelta);
    const rate=fxRates(session.day,session.cursor)[c],sale=updatePosition(s,i,qty,total,rate);
    s.fills.push({...row(s,i),...sale,price:px,step,...(match?{second:match.at}:{}),cashDelta,...(fee&&{fee}),seq:cashSequence(s),kind:lim===null?'market':'limit'});
    if(qty<0&&!isExchangeCurrency(c))settleRetiredCash(s,c,rate,step);
    clear(s,i);
  }
}
export function advanceMarket(s,steps){
  if(s.phase!=='open'||!Number.isInteger(steps)||steps<1)return [];
  const before=s.fills.length,stop=Math.min(288,s.cursor+steps),pending=ordersForMatching(s);
  while(s.cursor<stop){
    if(!pending.some(i=>s.orders[i])){s.cursor=stop;break;}
    matchStep(s,s.cursor,299,true,pending);
    s.cursor++;
  }
  return s.fills.slice(before);
}
export function matchLiveOrders(s){
  const offset=marketElapsed(s);
  if(offset===null)return 0;
  const pending=ordersForMatching(s);
  if(!pending.length)return 0;
  const before=s.fills.length;
  matchStep(s,s.cursor,offset,false,pending);
  return s.fills.length-before;
}
export function dailyBonus(s){
  // A run previews and pays the same bonus for a given game day, even after a reload.
  const key=[s.day,s.openingDay??0,s.resetId??'',s.roomProgressId??''].join('/');
  let seed=2166136261;
  for(const character of key)seed=Math.imul(seed^character.charCodeAt(0),16777619);
  const fraction=(seed>>>0)/0xffffffff;
  return Math.round(dailySalary(s)*(ECON.bonusMin+fraction*(ECON.bonusMax-ECON.bonusMin)));
}
function payDailyWage(s){
  const bonus=dailyBonus(s);
  const income=dailySalary(s)+bonus;
  adjust(s,'KRW',income);
  return {income,bonus,incomePeriod:'day',incomeSeq:cashSequence(s),due:0,debt:0};
}
function payMonthlyDistributions(s){
  if(civilDate(s.day).slice(0,7)===civilDate(s.day+1).slice(0,7))return [];
  const rates=localRates(s),payments=[];
  for(const [i,qty] of s.holdings.entries()){
    const {currency,annualDividend}=stocks[i];
    if(!qty||!(annualDividend>0))continue;
    const amount=nativeRound(qty*annualDividend/12,currency);
    if(amount<=0)continue;
    adjust(s,currency,amount);
    payments.push({i,qty,currency,amount,amountKRW:Math.round(amount*rates[currency]),seq:cashSequence(s)});
    if(!isExchangeCurrency(currency))settleRetiredCash(s,currency,rates[currency]);
  }
  return payments;
}
export function settle(s,{rest=false}={}){
  if(s.phase!=='open')return;
  if(s.mentalRates?.day!==s.day)reconcileFinancialMood(s);
  const cancelled=[...(s.cancelled??[])];if(rest)s.orders.forEach((q,i)=>{if(q){cancelled.push(row(s,i));clear(s,i);}});
  advanceMarket(s,barsPerDay);
  // Apply the original expiry rules when replaying days before the trading change.
  if(marketClock(s,barsPerDay-1).day<continuousTradingDay){
    const scenarioEnded=!usesKst(s)&&s.day===days.length-1;
    s.orders.forEach((q,i)=>{if(q&&(scenarioEnded||markets[stocks[i].market].continuous))expire(s,i,barsPerDay);});
  }
  const dividends=payMonthlyDistributions(s);
  s.mentalRates.dividends=dividends.reduce((sum,item)=>sum+item.amountKRW,0);
  const before=s.mental,gains=financialMood(s).profit;
  s.profit+=gains;
  if(rest&&!s.holdings.some(Boolean)&&!totalBorrowed(s))s.mental=toward(s.mental,50,25);
  const bill=payDailyWage(s);
  const credit=closeCreditDay(s,weekdayIndex(s.day)===days.length-1);
  if(credit.maturityPaid)s.credit.ledger.at(-1).seq=cashSequence(s);
  const spending=todayLiveSpending(s);
  const liveSpending=spending?{total:spending.total,count:spending.count,step:spending.step,seq:spending.seq}:undefined;
  const loanDesk=closeLoanDeskDay(s);
  reconcileFinancialMood(s,gameDayStart(s.day+1));
  s.phase='closed';
  s.history.push({day:s.day,netAssets:netWealth(s),...(dividends.length?{dividends}:{}),credit,loanDesk,gains,before,after:s.mental,
    startMental:s.dayStartMental,trades:s.fills.slice(),expired:s.expired.slice(),cancelled,rest,bill,luck:s.luck,liveSpending});
}
export function nextDay(s){
  const live=usesKst(s);
  if(s.phase!=='closed'||(!live&&s.day>=days.length-1))return;
  const before=decayInterval(s);
  s.fortuneGrid=null;
  delete s.fortuneRerollReady;
  delete s.fortuneRerollUsed;
  const capital=stockValue(s),opening=investmentMark(s,capital),closing=netWealth(s);s.day++;s.phase='open';s.cursor=0;s.fills=[];s.expired=[];s.cancelled=[];s.ordered=s.orders.map(Boolean);s.edits=0;s.luck=null;s.discountToday=0;s.startWealth=closing;
  if(live){s.wallMinute=0;s.wallSecond=0;}
  s.mentalRates={day:s.day,opening,dividends:0};
  const {investmentPoints,debtPoints}=financialMood(s);
  Object.assign(s.mentalRates,{investmentPoints,debtPoints});
  if(live)rescaleDecayClock(s,gameDayStart(s.day),before,decayInterval(s));
  if(live){
    s.dayStartMental=s.mental;
    s.mentalRecoveryPending=true;
    if(weekdayIndex(s.day)===0){
      s.discount=0;s.weekendRebate=0;
      if(!s.credit.loan)s.credit.used=false;
    }
  }
}
export function rivals(count,settledDays=null){
  const dates=settledDays??Array.from({length:count},(_,i)=>i);
  return testFriends.map(friend=>({key:friend.room,name:friend.name,
    profit:dates.reduce((sum,day)=>sum+botDayProfit(friend,day),0)}));
}
export function loadable(s){
  const live=s?.version===3&&usesKst(s);
  if(!s||![1,2,3].includes(s.version)||!['open','closed'].includes(s.phase)||!Number.isSafeInteger(s.day)||(!live&&(s.day<0||s.day>=(s.version===1?5:7))))return false;
  const modern=s.version===3,n=s.version===1?4:s.version===2?22:s.holdings?.length;
  if(!validSalaryRecord(s)||!validRehabilitationSave(s))return false;
  if(s.fortuneRerollUsed!==undefined&&(s.fortuneRerollUsed!==true||s.luck!=='bingo'))return false;
  if(s.fortuneRerollReady!==undefined&&(s.fortuneRerollReady!==true||!s.luck||s.fortuneRerollUsed))return false;
  if(modern&&n!==stocks.length&&!previousListingCounts.includes(n))return false;
  const arr=(a,ok)=>Array.isArray(a)&&a.length===n&&a.every(ok),finite=Number.isFinite;
  const valid=(v,i)=>{const lot=modern?(i===bitcoin&&!s.nyangUnits?0.000001:stocks[i].lot):i===11||i===12?.01:1;return finite(v)&&Math.abs(v/lot-Math.round(v/lot))<1e-6;};
  if(![s.cash,s.mental,s.discount,s.profit,s.edits].every(finite)||s.cash<0||s.mental<0||s.mental>100||!arr(s.holdings,(v,i)=>valid(v,i)&&v>=0)||!arr(s.orders,valid)||
    (s.luck==='bingo'?!isFortuneGrid(s.fortuneGrid):s.luck&&!Object.hasOwn(fortuneSymbols,s.luck))||!Array.isArray(s.history)||
    (live?s.history.some((row,i)=>!Number.isSafeInteger(row?.day)||row.day>s.day||i&&row.day<=s.history[i-1].day):s.history.length!==s.day+(s.phase==='closed'?1:0)))return false;
  if(s.version===1)return true;
  const names=modern?Object.keys(currencies).filter(c=>c!=='KRW'):['AD','LM','HA'];
  if(!names.every(c=>finite(s.wallets?.[c])&&s.wallets[c]>=0)||!Number.isInteger(s.cursor)||s.cursor<0||s.cursor>288||!arr(s.orderPrices,v=>v===null||finite(v))||
    !Array.isArray(s.fills)||!Array.isArray(s.expired)||!Array.isArray(s.fxLog)||!finite(s.startWealth))return false;
  if(modern&&s.orderFees!==undefined&&!arr(s.orderFees,v=>v===0||v===buyFeeRates.stock||v===buyFeeRates.etf))return false;
  const recovery=s.adRecovery;
  const spending=s.liveSpending;
  const activity=s.mentalActivity;
  const validActivity=!activity||(live&&Number.isSafeInteger(activity.at)&&activity.at>=0&&
    Number.isSafeInteger(activity.elapsed)&&activity.elapsed>=0&&activity.elapsed<mentalDecayInterval);
  const validMentalClock=s.mentalDecayAt===undefined||(live&&Number.isSafeInteger(s.mentalDecayAt)&&s.mentalDecayAt>0);
  const hasMentalClock=live&&s.mentalDecayAt!==undefined;
  const validMentalBuff=s.mentalBuffUntil===undefined||(hasMentalClock&&Number.isSafeInteger(s.mentalBuffUntil)&&s.mentalBuffUntil>0);
  const validMentalRecovery=s.mentalRecoveryPending===undefined||(live&&s.mentalRecoveryPending===true);
  const validMentalConnection=s.mentalConnectedAt===undefined||(hasMentalClock&&
    Number.isSafeInteger(s.mentalConnectedAt)&&s.mentalConnectedAt>0&&s.mentalConnectedAt<s.mentalDecayAt);
  const validSpending=!spending||(live&&Number.isSafeInteger(spending.day)&&spending.day<=s.day&&Number.isSafeInteger(spending.at)&&
    Number.isSafeInteger(spending.total)&&spending.total>0&&Number.isSafeInteger(spending.count)&&spending.count>0&&
    Number.isInteger(spending.step)&&spending.step>=0&&spending.step<288&&Number.isSafeInteger(spending.seq)&&
    Array.isArray(spending.recent)&&spending.recent.length<=12&&spending.recent.every(r=>r&&Number.isSafeInteger(r.at)&&Number.isSafeInteger(r.amount)&&
      (r.gameAt===undefined||Number.isSafeInteger(r.gameAt)&&r.gameAt>=r.at)&&
      r.amount>0&&finite(r.mental)&&r.mental>=0&&r.mental<=100&&validSpendingAmount(r)));
  return !modern||validHomePetRecovery(s)&&validSpending&&validActivity&&validMentalClock&&validMentalBuff&&validMentalRecovery&&validMentalConnection&&(!recovery||Number.isInteger(recovery.day)&&recovery.day<=s.day&&Number.isInteger(recovery.count)&&recovery.count>=0&&recovery.count<=recoveryLimit)&&
    loadableCredit(s.credit,live)&&loadableLoanDesk(s.loanDesk)&&arr(s.costs,v=>finite(v)&&v>=0)&&arr(s.costsKRW,v=>finite(v)&&v>=0)&&arr(s.basisEstimated,v=>typeof v==='boolean')&&arr(s.ordered,v=>typeof v==='boolean');
}
