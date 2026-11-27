import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCompany,getValuation} from '../src/game/analysis-metrics.mjs';

function filing(year, data={}, companyCode='TEST') {
  const stock={assets:200,liabilities:150,equity:50,commonEquity:50,cash:14,receivables:20,inventory:12,payables:15,
    currentAssets:80,quickAssets:48,currentLiabilities:40,interestDebt:95};
  const income={revenue:100,costOfSales:70,sga:20,operatingProfit:10,netIncome:8,commonIncome:8,
    interestExpense:2,creditSales:80,creditPurchases:45,depreciation:2,amortization:1};
  return {companyCode,id:companyCode+'-'+year,formatVersion:1,version:1,currency:'KRW',unit:'원',source:'게임 내 공시',scope:'별도',
    period:{start:year+'-01-01',end:year+'-12-31',year,days:365,label:year+' 연간'},publishedTick:year*100,
    opening:{...stock,...data.opening},closing:{...stock,...data.closing},income:{...income,...data.income},
    cashflow:{cfo:12,cfi:-6,cff:-1,capex:6,intangiblePurchases:1,...data.cashflow},
    shares:{weightedAverage:10,end:10,...data.shares},dividendPerShare:.5,...data.meta};
}
const data=(file,prior=null,extra={})=>({current:file,history:[prior,file].filter(Boolean),yearAgo:prior,profile:{group:'제조',financial:false},...extra});
const run=(file,prior,extra,opts)=>analyzeCompany(data(file,prior,extra),{price:20,quoteTick:260000,...opts});
test('연간 검증 사례에서 공통형 이익률, 전년 비교 %p, 영업현금의 원인이 실제 원자료와 일치',()=>{
  const p=filing(2025);
  const c=filing(2026,{income:{revenue:120,costOfSales:90,sga:24,operatingProfit:6,netIncome:3,commonIncome:3},
    cashflow:{cfo:-2,changeReceivables:8,changeInventory:5,changePayables:4}});
  const {groups,metrics:m}=run(c,p);
  assert.equal(m.revenueGrowth.value,20);
  assert.equal(m.operatingMargin.prior.value,10);
  assert.equal(m.operatingMargin.value,5);
  assert.match(m.operatingMargin.interpretation,/5%p 낮아요/);
  assert.equal(m.costShare.value,75);
  assert.equal(m.sgaShare.value,m.sgaShare.prior.value);
  assert.match(groups[0].summary,/매출원가/);assert.doesNotMatch(groups[0].summary,/판관비/);
  assert.match(groups.find(g=>g.id==='cash').summary,/외상대금과 재고.*흑자.*현금이 순유출/);
  assert.equal(m.cfo.value,3+4-8-5+4);
  assert.equal(m.fcf.value,-2-6-1);
  assert.ok(groups.every(g=>g.highlights.length<=3));
  assert.ok(m.operatingMargin.inputs.every(i=>i.source===c.id));
});
test('ROE·듀퐁과 평잔, EPS는 가중평균 주식수, BPS는 기말 주식수',()=>{
  const c=filing(2026,{income:{netIncome:10,commonIncome:10},opening:{assets:150,commonEquity:40},closing:{assets:250,commonEquity:60},
    shares:{weightedAverage:5,end:10}});
  const m=run(c).metrics;assert.equal(m.roe.value,20);assert.equal(m.dupontRoe.value,20);assert.equal(m.assetTurnover.value,.5);
  assert.equal(m.equityMultiplier.value,4);assert.equal(m.roa.value,5);
  assert.equal(m.eps.value,2);assert.equal(m.bps.value,6);assert.equal(m.pe.value,10);
  assert.equal(m.marketCap.value,200);assert.equal(m.enterpriseValue.value,200+95-14);assert.equal(m.ebitda.value,13);
  assert.deepEqual(getValuation(data(c),20),{eps:2,bps:6,pe:10,pb:20/6,ps:2,dividendYield:2.5,marketCap:200,roe:20});
});
test('누락·0·적자·음수자본, 불연속 비교 기준',()=>{
  const p=filing(2025,{income:{revenue:0,netIncome:-8,operatingProfit:-10}});
  const c=filing(2026,{opening:{assets:null},closing:{commonEquity:-3,equity:-3,currentLiabilities:0},income:{commonIncome:-3,operatingProfit:-12,interestExpense:0},
    cashflow:{capex:null}});
  const m=run(c,p).metrics;
  for (const id of ['roa','roe','debtRatio','currentRatio','pe','pb','evEbitda','interestCoverage','fcf']) assert.equal(m[id].value,null,id);
  assert.match(m.interestCoverage.reason,/해당 기간 이자비용 없음/);assert.match(m.fcf.reason,/설비 취득지출/);
  assert.match(m.revenueGrowth.display,/기준값 0/);assert.match(m.operatingGrowth.display,/적자 확대/);
  assert.match(m.netGrowth.display,/흑자 전환/);assert.equal(m.netGrowth.changeAmount,16);
  c.income.netIncome=-4;assert.match(run(c,p).metrics.netGrowth.display,/적자 축소/);
});
test('중앙값은 같은 기간·범위·업종·통화·측정기준만 사용하며 해당 시점의 동종 시세만 허용',()=>{
  const c=filing(2026);const peers=[];
  function peer(code,changes={},group='제조') {
    const f=filing(2026,changes,code);
    peers.push({...data(f),profile:{group},asset:{name:'기업 '+code,code}});
  }
  peer('A',{income:{operatingProfit:5}});peer('B',{income:{operatingProfit:7,creditSales:null}});
  peer('C',{meta:{currency:'USD'}});peer('D',{meta:{scope:'연결'}});peer('E',{},'은행');
  peer('F',{meta:{period:{...c.period,days:362}}});
  peer('G',{meta:{formatVersion:0}});
  const m=run(c,null,{peers},{peerPrices:{A:{price:14,quoteTick:260000},B:{price:16,quoteTick:259999}}}).metrics;
  assert.equal(m.operatingMargin.comparison.count,2);assert.equal(m.operatingMargin.comparison.value,6);
  assert.equal(m.receivableTurnover.comparison.count,1);assert.equal(m.pe.comparison.count,1);
  assert.equal(run(c).metrics.operatingMargin.comparison.value,null);
});
function quarter(year,q,income,wn,end) {
  const f=filing(year,{income:{commonIncome:income},shares:{weightedAverage:wn,end}});
  const index=year*4+q;
  const start=new Date(Date.UTC(year,(q-1)*3,1)),finish=new Date(Date.UTC(year,q*3,0));
  return {...f,id:'TEST-'+year+'Q'+q,publishedTick:index*10,
    period:{year,quarter:q,days:Math.round((finish-start)/86400000)+1,start:start.toISOString().slice(0,10),end:finish.toISOString().slice(0,10),label:year+'년 '+q+'분기'}};
}
test('연속된 4분기 EPS를 일수 가중 평균 주식수로 계산하고 누락·미공개·다른 회사 수치를 섞지 않는다',()=>{
  const qs=[quarter(2025,4,2,8,8),quarter(2026,1,3,9,9),quarter(2026,2,4,10,10),quarter(2026,3,5,11,12)];
  const c=qs.at(-1);
  const val=history=>getValuation(data(c,null,{history}),20);
  const totalShares=qs.reduce((s,f)=>s+f.period.days*f.shares.weightedAverage,0);
  assert.ok(Math.abs(val(qs).eps-14/(totalShares/365))<1e-10);
  assert.equal(val(qs.slice(1)).eps,null);
  assert.equal(val([qs[0],{...qs[1],publishedTick:c.publishedTick+10},qs[2],c]).eps,null);
  assert.equal(val([{...qs[0],companyCode:'OTHER'},...qs.slice(1)]).eps,null);
  assert.equal(val(qs).bps,50/12);
});
test('가격과 관점을 바꾸어도 기존 실적 불변, 금융사에는 제조업 비교 미적용',()=>{
  const c=filing(2026);const before=JSON.stringify(c);const investor=run(c).metrics;
  const model=run(c,null,{}, {role:'manager',price:40});
  assert.equal(model.metrics.operatingMargin.value,investor.operatingMargin.value);
  assert.equal(model.metrics.pe.value,2*investor.pe.value);assert.equal(JSON.stringify(c),before);
  assert.ok(model.groups.find(x=>x.id==='profitability').highlights.includes('costShare'));
  const bank=run(c,null,{profile:{financial:true,group:'은행'}}).metrics;
  for (const id of ['inventoryTurnover','debtRatio','evEbitda']) assert.equal(bank[id].value,null,id);
  assert.equal(bank.bankCapitalShare.value,25);
});

test('역사적 PER은 당시에 공개된 실적과 그 공시 때 실제로 관찰한 주가를 연결한다',()=>{
  const prior=filing(2025),current=filing(2026);
  const quote={price:5,quoteTick:prior.publishedTick};
  const m=run(current,prior,{}, {priorQuotes:{[prior.id]:quote}}).metrics;
  assert.equal(m.pe.prior.value,5/(8/10));
  assert.match(m.pe.prior.period,/관찰 시세/);
  assert.notEqual(m.pe.prior.period,m.pe.period);
  assert.equal(run(current,prior,{}, {priorQuotes:{[prior.id]:{...quote,quoteTick:quote.quoteTick+1}}}).metrics.pe.prior,null);
  const stub={...prior,period:{...prior.period,days:183,start:'2025-07-02'}};
  assert.equal(run(current,stub).metrics.operatingMargin.prior,null);
  assert.equal(run(current,stub).metrics.revenueGrowth.value,null);
});
