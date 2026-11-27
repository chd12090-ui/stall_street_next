// Versioned public financial statements of the simulation. Only a published period can be queried.
// The tape, room, orders, and the player account never write into issuer ledgers.
import {stocks} from './securities-data.mjs';
import {civilDate,clockText,marketClock,marketDayOffset} from './clock-calendar.mjs';
import {fxRates} from './fx.mjs';
import {companyProfile,equityAsset} from './company-profiles.mjs';
import {operatingJournal} from './company-events.mjs';
export {companyProfile} from './company-profiles.mjs';
export {filingEventImpact} from './company-events.mjs';

const QUARTER=4*288, firstQuarter=-12, offset=QUARTER/2, releaseLag=72;
const round=Math.round;
const bound=(v,min,max)=>Math.min(max,Math.max(min,v));
const startTick=index=>index*QUARTER-offset;
const releaseTick=index=>startTick(index+1)+releaseLag;
const issuerHistories=new Map();
const noHistory=asset=>({asset,profile:null,history:[],current:null,previous:null,yearAgo:null});
const freezeRecord=value=>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    Object.values(value).forEach(freezeRecord);
    Object.freeze(value);
  }
  return value;
};
export function filingMarketTick(state){
  if(typeof state==='number')return Number.isFinite(state)?Math.floor(state):null;
  if(!state||!Number.isInteger(state.day)||!Number.isFinite(state.cursor))return null;
  const clock=marketClock(state);
  return clock.day*288+clock.cursor;
}
function publicDate(tick){
  return civilDate(Math.floor((tick+marketDayOffset)/288))+' '+clockText(tick);
}
function periodAt(index){
  const month=9+index*3,start=Date.UTC(2026,month,1),next=Date.UTC(2026,month+3,1);
  const first=new Date(start),year=first.getUTCFullYear(),quarter=first.getUTCMonth()/3+1;
  return {year,quarter,start:first.toISOString().slice(0,10),end:new Date(next-86400000).toISOString().slice(0,10),
    days:(next-start)/86400000,label:'게임 회계 '+year+'년 '+quarter+'분기'};
}
export function filingOnDay(day){
  const start=day*288-marketDayOffset;
  const index=Math.ceil((start-releaseTick(0))/QUARTER);
  const tick=releaseTick(index);
  return index>=firstQuarter&&tick<start+288?{tick,time:clockText(tick),period:periodAt(index)}:null;
}
function phase(code){
  return [...code].reduce((hash,char)=>(hash*31+char.charCodeAt(0))>>>0,0)%997;
}
function setup(asset){
  const profile=companyProfile(asset), financial=profile.financial;
  const baseEquity=round(asset.bookPerShare*asset.shares);
  const annualEarnings=round(asset.eps*asset.shares);
  const quarterlySales=round(Math.max(baseEquity*(financial?.095:.45),Math.abs(annualEarnings)*(financial?1.8:3.2)));
  const inventoryHeavy=!financial&&!['게임 개발','결제 처리','광고 플랫폼','보안 소프트웨어','통신·클라우드'].includes(profile.group);
  const seed=phase(asset.code);
  return {asset,profile,financial,baseEquity,annualEarnings,quarterlySales,inventoryHeavy,seed,
    borrowRatio:financial?.22:.24+.015*(seed%14),dueFraction:.18+(seed%7)*.025,
    exportShare:asset.exposure.length?(.11+(seed%7)*.023):0,
    importShare:asset.exposure.length?(.10+(seed%6)*.024):0,
    hedgedShare:asset.exposure.length?(.25+(seed%4)*.1):0,
    foreignCurrency:asset.currency==='USD'?'JPY':'USD'};
}
function totals(fields){
  const b={...fields};
  b.quickAssets=b.cash+b.receivables;
  b.currentAssets=b.quickAssets+b.inventory+b.prepaids;
  b.assets=b.currentAssets+b.ppe+b.intangibles+b.loansToCustomers;
  b.interestDebt=b.shortDebt+b.longDebt;
  b.currentLiabilities=b.payables+b.shortDebt+b.advances+b.customerDeposits;
  b.liabilities=b.currentLiabilities+b.longDebt;
  b.equity=b.assets-b.liabilities;
  b.commonEquity=b.equity;
  return b;
}
function openingBalance(model){
  const {asset,baseEquity,annualEarnings,financial,inventoryHeavy,quarterlySales:sales,borrowRatio}=model;
  // Issuers already operating at the beginning of the archive have an opening ledger.
  const equity=round(Math.max(baseEquity*.37,baseEquity-(-firstQuarter)*(annualEarnings-asset.annualDividend*asset.shares)/4));
  const debt=round(baseEquity*borrowRatio),shortDebt=round(debt*model.dueFraction);
  const payables=round(sales*(financial?.035:.19)),customerDeposits=financial?round(baseEquity*5.7):0;
  const advances=round(sales*(financial?0:.018)),assets=equity+debt+payables+advances+customerDeposits;
  const receivables=round(Math.min(sales*.28,assets*.17)),inventory=inventoryHeavy?round(Math.min(sales*.24,assets*.16)):0;
  const prepaids=round(assets*.009),ppe=round(assets*(financial?.032:.35)),intangibles=round(assets*(financial?.008:.044));
  const loansToCustomers=financial?round(assets*.70):0;
  const cash=assets-receivables-inventory-prepaids-ppe-intangibles-loansToCustomers;
  return totals({cash,receivables,inventory,prepaids,ppe,intangibles,loansToCustomers,
    payables,shortDebt,longDebt:debt-shortDebt,customerDeposits,advances,shares:asset.shares});
}
function fxExposure(model,from,through){
  if(through<0||!model.exportShare)return 0;
  const crossRate=tick=>{
    const day=Math.floor(tick/288),rates=fxRates(day,tick-day*288);
    return rates[model.foreignCurrency]/rates[model.asset.currency];
  };
  return (crossRate(through)/crossRate(Math.max(0,from-1))-1)*(1-model.hedgedShare);
}
function makeStatement(model,index,opening){
  const {asset,seed,quarterlySales,inventoryHeavy,financial}=model;
  const period=periodAt(index),from=startTick(index),through=startTick(index+1)-1;
  const publishedTick=releaseTick(index),cycle=index+seed;
  // Stable bounded volume and order seasonality, keyed to the company and the closed fiscal quarter.
  const season=1+.065*Math.sin(period.quarter*Math.PI/2+seed);
  // New equipment or purchased software can enter service only from the following period.
  const operatingAssets=opening.ppe+opening.intangibles;
  const capacityEffect=financial?1:bound(.95+.12*operatingAssets/model.baseEquity,.88,1.19);
  const volume=season*(1+.10*Math.sin(cycle*.42)+.16*Math.tanh(index/18))*capacityEffect;
  const baseSales=round(quarterlySales*volume);
  const ledgerEvents=operatingJournal(asset.code,from,through);
  const movement={sale:0,cost:0,advance:0,stock:0,credit:0,fx:0};
  const eventRows=ledgerEvents.map(item=>{
    const amount=round(baseSales*item.fraction);
    movement[item.account]+=amount;
    const {fraction,...event}=item;
    return {...event,amount};
  });
  const exchangeMove=fxExposure(model,from,through);
  const exportRevaluation=round(baseSales*model.exportShare*exchangeMove);
  const importRevaluation=round(baseSales*model.importShare*exchangeMove);
  const revenue=baseSales+movement.sale+exportRevaluation;
  const debtRate=.035, floatingShare=.35;
  const resetRate=Math.max(0,.036+.012*Math.sin(cycle*.32));
  const fundingCost=round(opening.interestDebt*((1-floatingShare)*debtRate+floatingShare*resetRate)*period.days/365);
  const interestExpense=financial?0:fundingCost;
  const depositInterest=round(opening.customerDeposits*(.021+.006*Math.sin(cycle*.32))*period.days/365);
  // The opening earnings estimate uses planned volume before the quarter's shocks and settlements.
  const benchmark=round(model.annualEarnings*volume/4);
  const normalInterest=round(model.baseEquity*model.borrowRatio*debtRate/4);
  const targetOperating=benchmark+Math.max(0,round(benchmark*.25))+(financial?0:normalInterest);
  const depreciation=round(opening.ppe*.019),amortization=round(opening.intangibles*.035);
  const sga=round(baseSales*(financial?.28:.205)*(1+.025*Math.cos(cycle*.6)))+amortization;
  const baseCosts=baseSales-targetOperating-round(baseSales*(financial?.28:.205))-round(model.baseEquity*(financial?.001:.008));
  const operatingFunding=financial?depositInterest+fundingCost:0;
  const costOfSales=round(baseCosts+depreciation+.64*movement.sale+.012*baseSales*Math.sin(cycle*.77))+
    importRevaluation+movement.cost+operatingFunding-(financial?round(model.baseEquity*.032):0);
  const operatingProfit=revenue-costOfSales-sga;
  const capex=round(depreciation*(1.05+.32*Math.sin(cycle*.54))+.006*baseSales);
  const intangiblePurchases=round(amortization*(1+.16*Math.cos(cycle*.6))+.001*baseSales);
  // Sale proceeds and the gain are separate legs of one transaction.
  const soldBookValue=(index+seed)%7===0?round(opening.ppe*.012):0;
  const disposals=round(soldBookValue*(1.04+.06*Math.sin(cycle*.6))),disposalGain=disposals-soldBookValue;
  const foreignDebtShare=model.exportShare?.16:0;
  const debtRevaluation=round(opening.interestDebt*foreignDebtShare*exchangeMove);
  const financialOther=disposalGain-interestExpense-movement.fx-debtRevaluation;
  const tax=Math.max(0,round((operatingProfit+financialOther)*.20));
  const netIncome=operatingProfit+financialOther-tax;
  const receivables=round(Math.max(0,revenue*(financial?.06:.235+.045*Math.sin(cycle*.84))+movement.sale*.17));
  const inventory=inventoryHeavy?round(Math.max(0,baseSales*(.24+.045*Math.cos(cycle*.43))+movement.stock)):0;
  const prepaids=round(baseSales*(.016+.002*Math.cos(cycle*.44)));
  const payables=round(Math.max(0,(costOfSales-depreciation)*(.16+.023*Math.sin(cycle*.81))+movement.stock*.6));
  const advances=Math.max(0,opening.advances+movement.advance);
  const loansToCustomers=financial?round(model.baseEquity*(4.85+.30*Math.sin(cycle*.4))+movement.credit):0;
  const customerDeposits=financial?round(model.baseEquity*(5.7+.25*Math.sin(cycle*.38))):0;
  const changeReceivables=receivables-opening.receivables,changeInventory=inventory-opening.inventory,changePayables=payables-opening.payables;
  const changePrepaids=prepaids-opening.prepaids,changeAdvances=advances-opening.advances;
  const changeLoans=loansToCustomers-opening.loansToCustomers,changeDeposits=customerDeposits-opening.customerDeposits;
  const creditSales=round(revenue*(financial?.18:.68));
  const purchasedInputs=Math.max(0,round((costOfSales-depreciation-operatingFunding)*(inventoryHeavy?.78:.39)));
  const inventoryConsumed=inventoryHeavy?purchasedInputs:0;
  const inventoryPurchases=inventoryConsumed+changeInventory;
  const purchases=purchasedInputs+changeInventory;
  const creditPurchases=round(purchases*.72);
  // Cash journals: receipts on billed sales and deposits, supplier/payroll disbursements,
  // taxes, borrowing costs, customer loan movements and capital transactions.
  const customerReceipts=revenue-changeReceivables+changeAdvances;
  const operatingPayments=costOfSales+sga-depreciation-amortization+changeInventory+changePrepaids-changePayables;
  const cfo=customerReceipts-operatingPayments-tax-interestExpense-movement.fx-changeLoans+changeDeposits;
  const cfi=disposals-capex-intangiblePurchases;
  const dividendPerShare=asset.annualDividend/4;
  const dividendsPaid=round(dividendPerShare*opening.shares);
  const cashBuffer=round(baseSales*.08);
  const available=opening.cash+cfo+cfi-dividendsPaid;
  const matured=round(opening.shortDebt*.19);
  const baseDraw=round(matured*(.88+.22*Math.sin(cycle*.38)));
  const fundingNeeded=Math.max(0,cashBuffer-(available+baseDraw-matured));
  // A cash shortfall is funded on the last fiscal day. New shares participate for that day.
  const issuePrice=Math.max(asset.bookPerShare*.65,1);
  const newShares=fundingNeeded>0&&opening.interestDebt>model.baseEquity*.6?Math.ceil(fundingNeeded*.5/issuePrice):0;
  const shareProceeds=round(newShares*issuePrice);
  const loanDrawn=baseDraw+Math.max(0,fundingNeeded-shareProceeds);
  const borrowing=loanDrawn-matured;
  const cff=borrowing+shareProceeds-dividendsPaid;
  const interestDebt=opening.interestDebt+debtRevaluation+borrowing;
  const shortDebt=round(interestDebt*model.dueFraction);
  const shares={end:opening.shares+newShares,weightedAverage:opening.shares+newShares/period.days,
    newShares,issueDate:newShares?period.end:null};
  const closing=totals({cash:opening.cash+cfo+cfi+cff,receivables,inventory,prepaids,loansToCustomers,
    ppe:opening.ppe+capex-soldBookValue-depreciation,intangibles:opening.intangibles+intangiblePurchases-amortization,
    payables,advances,shortDebt,longDebt:interestDebt-shortDebt,customerDeposits,shares:shares.end});
  const cashflow={cfo,cfi,cff,capex,intangiblePurchases,disposals,soldBookValue,disposalGain,
    borrowing,loanDrawn,principalRepaid:matured,dividendsPaid,shareProceeds,adjustments:0,
    noncash:depreciation+amortization-disposalGain+debtRevaluation,
    changeReceivables,changeInventory,changePayables,changePrepaids,changeAdvances,changeLoans,changeDeposits,
    otherOperating:-changePrepaids+changeAdvances-changeLoans+changeDeposits,
    customerReceipts,operatingPayments,taxesPaid:tax,financingInterestPaid:interestExpense,settlementFees:movement.fx};
  const income={revenue,costOfSales,sga,operatingProfit,netIncome,commonIncome:netIncome,interestExpense,financialOther,
    tax,creditSales,creditPurchases,purchases,inventoryPurchases,inventoryConsumed,depreciation,amortization,disposalGain,debtRevaluation,
    exportRevaluation,importRevaluation,depositInterest,operatingFunding};
  const id=asset.code+'-'+period.year+'Q'+period.quarter+'-v1';
  return freezeRecord({id,companyCode:asset.code,industryIds:model.profile.industryIds,formatVersion:'issuer-quarter-1',version:1,period,
    periodStartTick:from,periodEndTick:through,publishedTick,publishedLabel:publicDate(publishedTick),
    currency:asset.currency,unit:'통화 단위',scope:'별도 · 보통주',source:'게임 내 공시',status:'공시 실적',
    revisionHistory:[{version:1,publishedTick,label:'최초 공시'}],opening,closing,income,cashflow,shares,
    estimate:{commonIncome:benchmark,shares:opening.shares,revenue:baseSales},
    dividendPerShare,events:eventRows,terms:{floatingShare,fixedRate:debtRate,resetRate,foreignDebtShare,
      capacityEffect,foreignCurrency:model.foreignCurrency,exportShare:model.exportShare,importShare:model.importShare,hedgedShare:model.hedgedShare},
    dividendBasis:'회계 분기의 지급 배당. 플레이어 계좌는 기존 게임 달력의 월 지급 일정으로 정산해.'});
}
// Keep full reports only around the active date. Compact opening balances at intervals let
// an old memo's disclosure date be replayed without retaining every news line for every year.
const retainedPeriods=16,checkpointInterval=32;
function statementsFor(asset,index,periods){
  let entry=issuerHistories.get(asset.code);
  if(!entry){
    const model=setup(asset),initial=openingBalance(model);
    entry={model,last:firstQuarter-1,balance:initial,rows:[],checkpoints:new Map([[firstQuarter,initial]])};
    issuerHistories.set(asset.code,entry);
  }
  const oldest=Math.max(firstQuarter,index-periods+1);
  if(index>entry.last){
    for(let n=entry.last+1;n<=index;n++){
      if((n-firstQuarter)%checkpointInterval===0)entry.checkpoints.set(n,entry.balance);
      const row=makeStatement(entry.model,n,entry.balance);
      entry.rows.push(row);
      if(entry.rows.length>retainedPeriods)entry.rows.shift();
      entry.balance=row.closing;
      entry.last=n;
    }
  }
  const start=entry.last-entry.rows.length+1;
  if(oldest>=start)return entry.rows.slice(oldest-start,index-start+1);
  const checkpoint=oldest-(oldest-firstQuarter)%checkpointInterval;
  const rows=[];
  let balance=entry.checkpoints.get(checkpoint);
  for(let n=checkpoint;n<=index;n++){
    const filing=makeStatement(entry.model,n,balance);
    if(n>=oldest)rows.push(filing);
    balance=filing.closing;
  }
  return rows;
}
export function publicCompanyHistory(input,state,periods=9){
  const asset=equityAsset(input),profile=companyProfile(asset),tick=filingMarketTick(state);
  if(!profile||tick==null)return noHistory(asset);
  const index=Math.floor((tick+offset-releaseLag)/QUARTER)-1;
  const history=index<firstQuarter?[]:statementsFor(asset,index,periods);
  return {asset,profile,history,current:history.at(-1)??null,previous:history.at(-2)??null,yearAgo:history.at(-5)??null};
}
export function companyFilings(input,state){
  const result=publicCompanyHistory(input,state),{asset,profile}=result;
  const peers=profile?stocks.filter(peer=>peer.code!==asset.code&&!peer.archiveOnly&&peer.currency===asset.currency
    &&companyProfile(peer)?.group===profile.group).map(peer=>publicCompanyHistory(peer,state)).filter(peer=>peer.current):[];
  return {...result,peers};
}
