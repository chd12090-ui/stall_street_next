import {civilDate,clockText} from './clock-calendar.mjs';

// All figures here use only published game filings. Company results never read the player's account.
export const analysisRoles = {investor:'투자자', bank:'은행', manager:'경영자'};
const formulaVersion = '1.0';
const ko = new Intl.NumberFormat('ko-KR', {maximumFractionDigits:2});
const exact = new Intl.NumberFormat('ko-KR', {maximumFractionDigits:6});
const amountUnit = '통화';
const shareUnit = '통화/주';
const quoteTime = tick=>Number.isFinite(tick)?civilDate(Math.floor((tick+108)/288))+' '+clockText(tick):'';
const missing = '해당 기간에 공개된 자료가 없어요.';
const banking = '금융회사의 사업구조에는 이 비교 기준을 적용하지 않아요.';
const labels = {
  cash:'현금', receivables:'매출채권', inventory:'재고', prepaids:'선급비용', currentAssets:'유동자산',
  quickAssets:'당좌자산', assets:'총자산', currentLiabilities:'유동부채', payables:'매입채무',
  interestDebt:'이자부 차입금', liabilities:'총부채', equity:'총자본', commonEquity:'보통주 귀속 자본',
  revenue:'매출액', costOfSales:'매출원가', sga:'판매비와관리비', operatingProfit:'영업이익',
  netIncome:'순이익', commonIncome:'보통주 귀속 순이익', interestExpense:'이자비용', creditSales:'외상매출액',
  creditPurchases:'외상매입액', depreciation:'유형자산 감가상각비', amortization:'무형자산상각비',
  cfo:'영업활동 현금흐름', cfi:'투자활동 현금흐름', cff:'재무활동 현금흐름', capex:'설비 취득지출',
  intangiblePurchases:'무형자산 취득지출', end:'기말 보통주 유통주식수', weightedAverage:'가중평균 보통주 유통주식수',
  dividendPerShare:'실제 지급 주당배당금', loansToCustomers:'고객 대출채권', customerDeposits:'고객 예금',
  customerReceipts:'판매·선수 대금 수취', operatingPayments:'영업대금 지급', taxesPaid:'법인세 납부',
  financingInterestPaid:'영업에 분류한 이자 지급', noncash:'비현금 조정', changeReceivables:'매출채권 증가액 (차감)',
  changeInventory:'재고 증가액 (차감)', changePayables:'매입채무 증가액 (가산)', otherOperating:'기타 영업 조정 (가산)',
  disposals:'자산 매각 수입', loanDrawn:'차입금 유입', principalRepaid:'원금 상환', dividendsPaid:'배당 지급', shareProceeds:'주식 발행 유입'
};
function format(value, unit, currency, full=false) {
  if (!Number.isFinite(value)) return '비교 불가';
  if (unit === amountUnit || unit === shareUnit) {
    const name = currency === 'KRW' ? '원' : ' '+(currency || '');
    const perShare = unit === shareUnit ? '/주' : '';
    const abs = Math.abs(value);
    if (!full && !perShare && abs >= 10000) {
      const [scale, text] = abs >= 1e12 ? [1e12,'조'] : abs >= 1e8 ? [1e8,'억'] : [1e4,'만'];
      return ko.format(value/scale)+text+name;
    }
    return (full ? exact : ko).format(value)+name+perShare;
  }
  return (full ? exact : ko).format(value)+unit;
}
const labelPeriod = file => file?.period?.label || '';
const fiscalKey = period => period.year*4+(period.quarter || 4);
const raw = (file, group, key) => group ? file?.[group]?.[key] : file?.[key];
function isAnnual(file) {
  const p = file?.period;
  return !!p && !p.quarter && p.days >= 350 && p.days <= 371;
}
function sameBasis(a, b) {
  return !!a && !!b && a.currency===b.currency && a.scope===b.scope && a.unit===b.unit &&
    a.formatVersion===b.formatVersion && (a.basis || '실적')===(b.basis || '실적');
}
function priorPeriod(a, b) {
  if (!sameBasis(a,b) || a.period.year!==b.period.year+1 || a.period.quarter!==b.period.quarter) return false;
  const ap=a.period,bp=b.period;
  if (!ap.days || !bp.days || Math.abs(ap.days-bp.days)>1) return false;
  // Gregorian fiscal quarters and years can differ by a leap day.
  const startsMatch=ap.start?.slice(5)===bp.start?.slice(5);
  const endA=new Date(ap.end),endB=new Date(bp.end);
  return startsMatch && endA.getUTCMonth()===endB.getUTCMonth() && Math.abs(endA.getUTCDate()-endB.getUTCDate())<=1;
}
function matchingPeriod(a, b) {
  return sameBasis(a,b) && a.period.start===b.period.start && a.period.end===b.period.end &&
    a.period.year===b.period.year && a.period.quarter===b.period.quarter && a.period.days===b.period.days;
}
function historyTo(bundle, file) {
  if (!file) return [];
  const byPeriod = new Map();
  for (const f of [...(bundle.history || []), bundle.yearAgo, bundle.previous, file]) {
    if (!f || !sameBasis(file,f) || !f.period || (f.companyCode && file.companyCode && f.companyCode!==file.companyCode)) continue;
    if (f.publishedTick>file.publishedTick || fiscalKey(f.period)>fiscalKey(file.period)) continue;
    if (fiscalKey(f.period)===fiscalKey(file.period) && f.id!==file.id) continue;
    const key=fiscalKey(f.period), latest=byPeriod.get(key);
    if (!latest || (f.publishedTick??0)>=(latest.publishedTick??0)) byPeriod.set(key,f);
  }
  return [...byPeriod.values()].sort((a,b)=>fiscalKey(a.period)-fiscalKey(b.period));
}
function trailing(files) {
  if (!files.length) return [];
  const last=files.at(-1);
  if (isAnnual(last)) return [last];
  if (!last.period.quarter) return [];
  const q=files.slice(-4);
  return q.length===4 && q.every((f,i)=>f.period.quarter && fiscalKey(f.period)===fiscalKey(last.period)-3+i) ? q : [];
}
class Missing extends Error {}
function unavailable(message) { throw new Missing(message); }
function denominator(value, reason='분모가 0이거나 음수여서 일반 비교가 어려워요.') {
  return value>0 ? value : unavailable(reason);
}
class Reading {
  constructor(bundle, file, quote, collect) {
    this.file=file;
    this.trail=trailing(historyTo(bundle,file));
    this.yearAgo=historyTo(bundle,file).find(f=>priorPeriod(file,f));
    this.quote=quote;
    this.collect=collect;
    this.inputs=[];
    this.flags=[];
  }
  add(input) {
    if (!this.collect) return;
    if (!this.inputs.some(x=>x.key===input.key && x.source===input.source)) this.inputs.push(input);
  }
  get(group,key,file=this.file) {
    if (!file) unavailable(missing);
    const value=raw(file,group,key);
    const prefix=group==='opening'?'기초 ':group==='closing'?'기말 ':'';
    if (!Number.isFinite(value)) unavailable(labelPeriod(file)+' '+prefix+labels[key]+' 자료가 없어요.');
    const unit=group==='shares'?'주':key==='dividendPerShare'?shareUnit:amountUnit;
    this.add({key:(group||'')+'.'+key,label:prefix+labels[key],value,unit,display:format(value,unit,file.currency,true),source:file.id,period:labelPeriod(file)});
    return value;
  }
  cashSource(key) {
    const cash=this.get('cashflow',key);
    if (this.collect) {
      const items={cfo:['noncash','changeReceivables','changeInventory','changePayables','otherOperating'],
        cfi:['disposals','capex','intangiblePurchases'],cff:['loanDrawn','principalRepaid','shareProceeds','dividendsPaid']};
      if (key==='cfo' && Number.isFinite(this.file.income?.netIncome)) this.get('income','netIncome');
      for (const item of items[key]) {
        if (Number.isFinite(this.file.cashflow[item])) this.get('cashflow',item);
      }
    }
    return cash;
  }
  avg(key) { return (this.get('opening',key)+this.get('closing',key))/2; }
  ratio(num, den, rate=1, reason) { return num/denominator(den,reason)*rate; }
  lastYear() {
    return this.yearAgo || unavailable('같은 길이의 전년 동기 자료가 없어요.');
  }
  ttm() {return this.trail.length ? this.trail : unavailable('연간 실적 또는 연속된 네 분기의 공시가 필요해요.');}
  sum(group,key) {return this.ttm().reduce((s,f)=>s+this.get(group,key,f),0);}
  days(file=this.file) {
    const days=file.period.days;
    if (!(Number.isInteger(days) && days>0)) unavailable('기준 기간의 일수가 없어요.');
    this.add({key:'period.days',label:'기간 일수',value:days,unit:'일',display:days+'일',source:file.id,period:labelPeriod(file)});
    return days;
  }
  shareEarnings() {
    const filings=this.ttm();
    const days=filings.reduce((sum,f)=>sum+this.days(f),0);
    const shares=filings.reduce((sum,f)=>sum+this.get('shares','weightedAverage',f)*this.days(f),0)/days;
    return this.ratio(this.sum('income','commonIncome'),shares,1,'가중평균 보통주 유통주식수가 0 이하예요.');
  }
  bookPerShare() {return this.ratio(this.get('closing','commonEquity'),this.get('shares','end'));}
  price() {
    const value=this.quote?.price;
    if (!Number.isFinite(value) || value<=0) unavailable('비교 시점의 유효한 주가가 없어요.');
    this.add({key:'price',label:'관찰 주가',value,unit:shareUnit,display:format(value,shareUnit,this.file.currency,true),source:'시장 시세',tick:this.quote.quoteTick??null,period:quoteTime(this.quote.quoteTick)||'관찰 시점'});
    return value;
  }
  marketCap() {return this.price()*denominator(this.get('shares','end'),'기말 주식수가 0 이하예요.');}
  enterpriseValue() {return this.marketCap()+this.get('closing','interestDebt')-this.get('closing','cash');}
  ebitda() {return this.sum('income','operatingProfit')+this.sum('income','depreciation')+this.sum('income','amortization');}
  creditSales() {
    if (Number.isFinite(this.file.income?.creditSales)) return this.get('income','creditSales');
    this.flags.push('외상매출 자료가 없어 전체 매출을 대용했어요.');
    return this.get('income','revenue');
  }
  collection() {return this.ratio(this.avg('receivables')*this.days(),this.creditSales());}
  inventoryDays() {return this.ratio(this.avg('inventory')*this.days(),this.get('income','costOfSales'));}
  payableDays() {return this.ratio(this.avg('payables')*this.days(),this.get('income','creditPurchases'));}
  growth(key) {
    const value=this.get('income',key), prior=this.get('income',key,this.lastYear());
    this.changeAmount=value-prior;
    if (prior===0) unavailable('기준값 0 · 변화액 '+format(value,amountUnit,this.file.currency));
    if (prior<0) {
      if (key==='revenue') unavailable('전년 동기 매출 음수 · 변화액 '+format(this.changeAmount,amountUnit,this.file.currency));
      const status=value>0?'흑자 전환':value===0?'손익분기 도달':value>prior?'적자 축소':value<prior?'적자 확대':'적자 유지';
      unavailable(status+' · 변화액 '+format(this.changeAmount,amountUnit,this.file.currency));
    }
    if (value<0) this.flags.push('흑자에서 적자로 전환했어요.');
    return this.ratio(value-prior,prior,100);
  }
}
const fields = {};
function metric(id,label,unit,definition,formula,read,options={}) {
  fields[id]={id,label,unit,definition,formula,read,...options};
}
const noBank={bankExcluded:true};
const ttm={ttm:true};
const priced={price:true};
const ttmPrice={price:true,ttm:true};
function pctIncome(key) {
  return r=>r.ratio(r.get('income',key),r.get('income','revenue'),100,'매출이 0 이하라 매출 대비 비율을 계산할 수 없어요.');
}
metric('operatingMargin','영업이익률','%','매출 100원당 본업에서 남긴 이익이에요.','영업이익 ÷ 매출액 × 100',pctIncome('operatingProfit'));
metric('netMargin','순이익률','%','금융손익과 세금까지 반영한 매출 대비 이익이에요.','순이익 ÷ 매출액 × 100',pctIncome('netIncome'));
metric('roe','자기자본이익률 (ROE)','%','보통주 주주가 맡긴 평균 자본 대비 주주 몫의 이익이에요.','보통주 귀속 순이익 ÷ 기초·기말 평균 보통주 귀속 자본 × 100',
  r=>r.ratio(r.get('income','commonIncome'),positiveAverageEquity(r),100));
metric('roeTtm','최근 12개월 자기자본이익률 (ROE)','%','보통주 주주가 맡긴 평균 자본 대비 최근 12개월 이익이에요.','최근 12개월 보통주 귀속 순이익 ÷ 같은 기간의 기초·기말 평균 보통주 귀속 자본 × 100',
  r=>r.ratio(r.sum('income','commonIncome'),positiveAverageEquity(r,r.ttm()[0]),100),ttm);
metric('roa','총자산이익률 (ROA)','%','평균 자산 100원으로 낸 순이익이에요.','순이익 ÷ 기초·기말 평균총자산 × 100',
  r=>r.ratio(r.get('income','netIncome'),r.avg('assets'),100));
function positiveAverageEquity(r,first=r.file) {
  const start=r.get('opening','commonEquity',first),end=r.get('closing','commonEquity');
  if (Math.min(start,end)<=0) unavailable('기초 또는 기말 보통주 자본이 0 이하여서 일반 ROE 비교가 어려워요.');
  return (start+end)/2;
}
metric('costShare','매출 100원당 매출원가','%','매출 중 상품·서비스 원가로 쓰인 몫이에요.','매출원가 ÷ 매출액 × 100',pctIncome('costOfSales'),noBank);
metric('sgaShare','매출 100원당 판관비','%','매출 중 판매와 관리에 사용한 몫이에요.','판매비와관리비 ÷ 매출액 × 100',pctIncome('sga'));
metric('equityMultiplier','자기자본승수','배','평균 자산이 평균 보통주 자본의 몇 배인지 보여줘요.','평균총자산 ÷ 평균 보통주 자본',r=>r.ratio(r.avg('assets'),positiveAverageEquity(r)));
metric('dupontRoe','듀퐁 분해 ROE','%','주주 이익률·자산회전율·자기자본승수를 곱해 ROE를 풀어봐요.','(보통주 이익 ÷ 매출) × (매출 ÷ 평균총자산) × (평균총자산 ÷ 평균 보통주 자본) × 100',
  r=>{const a=denominator(r.avg('assets')),sales=denominator(r.get('income','revenue'));return (r.get('income','commonIncome')/sales)*(sales/a)*(a/positiveAverageEquity(r))*100;});
metric('debtRatio','부채비율','%','자본 100원당 총부채예요. 총부채에는 매입채무도 포함돼요.','총부채 ÷ 자본 × 100',
  r=>r.ratio(r.get('closing','liabilities'),r.get('closing','equity'),100,'기말 자본이 0 이하여서 부채비율을 비교할 수 없어요.'),noBank);
metric('currentRatio','유동비율','%','단기 지급 의무에 비해 유동자산을 얼마나 갖췄는지 보여줘요.','유동자산 ÷ 유동부채 × 100',
  r=>r.ratio(r.get('closing','currentAssets'),r.get('closing','currentLiabilities'),100),noBank);
metric('quickRatio','당좌비율','%','게임 공시의 현금과 매출채권을 포함하고 재고·선급비용은 제외해요.','공시 당좌자산 ÷ 유동부채 × 100',
  r=>r.ratio(r.get('closing','quickAssets'),r.get('closing','currentLiabilities'),100),noBank);
metric('interestCoverage','이자보상비율','배','본업 이익으로 해당 기간의 이자비용을 몇 번 감당하는지 보여줘요.','영업이익 ÷ 이자비용',
  r=>{const interest=r.get('income','interestExpense');if (interest===0) unavailable('해당 기간 이자비용 없음');return r.ratio(r.get('income','operatingProfit'),interest);},noBank);
for (const [id,key] of [['revenueGrowth','revenue'],['operatingGrowth','operatingProfit'],['netGrowth','netIncome']]) {
  metric(id,labels[key]+' 증가율','%',labels[key]+'을 전년 같은 기간과 비교한 변화율이에요.','(당기 '+labels[key]+' − 전년 동기 '+labels[key]+') ÷ 전년 동기 '+labels[key]+' × 100',r=>r.growth(key));
}
metric('assetTurnover','총자산회전율','회','기간 중 평균자산으로 몇 배의 매출을 냈는지 보여줘요.','매출액 ÷ 평균총자산',r=>r.ratio(r.get('income','revenue'),r.avg('assets')),noBank);
metric('inventoryTurnover','재고자산회전율','회','원가 기준으로 기간 중 재고가 몇 번 판매됐는지 보여줘요.','매출원가 ÷ 평균재고자산',r=>r.ratio(r.get('income','costOfSales'),r.avg('inventory')),noBank);
metric('receivableTurnover','매출채권회전율','회','기간 중 평균 매출채권을 매출로 몇 번 회전시켰는지 보여줘요.','기간 외상매출액 ÷ 평균매출채권',r=>r.ratio(r.creditSales(),r.avg('receivables')),noBank);
metric('collectionDays','매출채권 회수기간','일','외상 판매 후 대금을 받기까지 걸리는 평균 일수예요.','평균매출채권 ÷ 기간 외상매출액 × 기간 일수',r=>r.collection(),noBank);
metric('inventoryDays','재고 보유기간','일','매입한 재고가 판매되기까지 평균 일수예요.','평균재고자산 ÷ 기간 매출원가 × 기간 일수',r=>r.inventoryDays(),noBank);
metric('payableDays','매입채무 지급기간','일','외상 매입 후 대금을 지급하기까지 걸리는 평균 일수예요.','평균매입채무 ÷ 기간 외상매입액 × 기간 일수',r=>r.payableDays(),noBank);
metric('cashCycle','현금전환주기','일','판매대금 회수까지의 시간에서 외상 매입 유예기간을 빼요.','재고 보유기간 + 매출채권 회수기간 − 매입채무 지급기간',r=>r.inventoryDays()+r.collection()-r.payableDays(),noBank);
for (const [id,label,what] of [
  ['cfo','영업활동 현금흐름','본업에서 실제로 들어오고 나간 현금의 순액이에요.'],
  ['cfi','투자활동 현금흐름','설비·무형자산 등 투자와 매각으로 들어오고 나간 현금의 순액이에요.'],
  ['cff','재무활동 현금흐름','차입·상환, 증자·배당 등 자금조달과 반환에 따른 현금 순액이에요.']
]) metric(id,label,amountUnit,what,id==='cfo'
  ?'현금 수취 − 영업 지급 등. 간접법 검산: 순이익 + 비현금 조정 − 매출채권 증가 − 재고 증가 + 매입채무 증가 + 기타 영업 조정'
  :'현금흐름표의 '+label+' 유입 − 유출 합계',r=>r.cashSource(id));
metric('cashGap','영업현금과 순이익의 차이',amountUnit,'현금 회수·지급 시점과 비용 인식 시점에는 차이가 생길 수 있어요.','영업활동 현금흐름 − 순이익',r=>r.get('cashflow','cfo')-r.get('income','netIncome'));
metric('fcf','설비·무형자산 취득 후 현금 (FCF)',amountUnit,'영업현금에서 설비·무형자산 취득에 지급한 현금을 뺀 금액이에요.','CFO − 설비 취득지출 − 무형자산 취득지출',
  r=>r.get('cashflow','cfo')-r.get('cashflow','capex')-r.get('cashflow','intangiblePurchases'),noBank);
metric('eps','주당순이익 (EPS)',shareUnit,'최근 12개월의 보통주 주주 몫 이익을 기간 가중평균 주식수로 나눠요.','최근 12개월 보통주 귀속 순이익 ÷ 일수 가중 평균 보통주 유통주식수',r=>r.shareEarnings(),ttm);
metric('pe','주가수익비율 (PER)','배','관찰 주가가 최근 12개월 실적 EPS의 몇 배인지 보여줘요.','관찰 주가 ÷ 최근 12개월 실적 EPS',r=>r.ratio(r.price(),r.shareEarnings(),1,'최근 12개월 EPS가 0 이하여서 일반 PER 비교가 어려워요.'),ttmPrice);
metric('bps','주당순자산 (BPS)',shareUnit,'기말 보통주 자본을 같은 시점의 보통주 유통주식수로 나눠요.','기말 보통주 귀속 장부자본 ÷ 기말 보통주 유통주식수',r=>r.bookPerShare());
metric('pb','주가순자산비율 (PBR)','배','관찰 주가가 최근 공시의 BPS와 비교해 몇 배인지 보여줘요.','관찰 주가 ÷ 기말 BPS',r=>r.ratio(r.price(),r.bookPerShare(),1,'BPS가 0 이하여서 일반 PBR 비교가 어려워요.'),priced);
metric('ps','주가매출비율 (PSR)','배','시가총액을 최근 12개월 매출과 비교해요.','시가총액 ÷ 최근 12개월 매출',r=>r.ratio(r.marketCap(),r.sum('income','revenue')),ttmPrice);
metric('dividendYield','실제 지급 배당수익률','%','최근 12개월에 지급한 배당을 관찰 주가와 비교해요.','최근 12개월 실제 지급 주당배당 합계 ÷ 관찰 주가 × 100',r=>r.ratio(r.sum(null,'dividendPerShare'),r.price(),100),ttmPrice);
metric('enterpriseValue','기업가치 (EV)',amountUnit,'게임의 보통주 단일 구조에서 규모와 이자부 차입·현금을 반영해요.','시가총액 + 이자부 차입금 − 사용제한 없는 현금 (리스·우선주·비지배지분 없음)',r=>r.enterpriseValue(),{...noBank,...priced});
metric('ebitda','영업 기준 단순화 EBITDA',amountUnit,'영업이익에 유형·무형자산 상각을 더한 영업 기준 값이에요. 영업외손익은 포함하지 않아요.','최근 12개월 영업이익 + 유형자산 감가상각비 + 무형자산상각비',r=>r.ebitda(),{...noBank,...ttm});
metric('evEbitda','EV/EBITDA','배','기업가치가 최근 12개월 영업 기준 단순화 EBITDA의 몇 배인지 보여줘요.','기업가치 ÷ 최근 12개월 영업 기준 단순화 EBITDA',r=>r.ratio(r.enterpriseValue(),r.ebitda(),1,'EBITDA가 0 이하여서 통상적인 배수 비교가 어려워요.'),{...noBank,...ttmPrice});
metric('marketCap','시가총액',amountUnit,'관찰 주가에 최근 공시의 기말 보통주 유통주식수를 곱해요.','관찰 주가 × 기말 보통주 유통주식수',r=>r.marketCap(),priced);
metric('bankCapitalShare','회계상 자기자본비율','%','장부 총자산의 얼마를 자기자본으로 조달했는지 보여줘요. 규제자본비율은 별도 자료가 필요해요.','기말 자기자본 ÷ 기말 총자산 × 100',r=>r.ratio(r.get('closing','equity'),r.get('closing','assets'),100));
metric('bankCashShare','총자산 중 현금','%','기말 장부상 현금의 비중이에요. 만기별 인출 위험은 별도로 살펴야 해요.','기말 현금 ÷ 기말 총자산 × 100',r=>r.ratio(r.get('closing','cash'),r.get('closing','assets'),100));
metric('bankLoanShare','총자산 중 고객 대출채권','%','자산 100원 중 고객 대출에 쓰인 몫이에요. 대출의 연체 가능성은 별도 자료가 필요해요.','기말 고객 대출채권 ÷ 기말 총자산 × 100',r=>r.ratio(r.get('closing','loansToCustomers'),r.get('closing','assets'),100));
metric('bankDepositShare','총부채 중 고객 예금','%','고객이 맡긴 예금으로 조달한 자금이 전체 부채에서 차지하는 비중이에요.','기말 고객 예금 ÷ 기말 총부채 × 100',r=>r.ratio(r.get('closing','customerDeposits'),r.get('closing','liabilities'),100));
export const analysisGroups=[
  {id:'profitability',title:'수익성',question:'잘 벌고 있나?',keys:['operatingMargin','netMargin','roe','roa','costShare','sgaShare','equityMultiplier','dupontRoe'],
    caveat:'ROE는 차입 증가나 자본 감소에도 높아질 수 있어요.',next:'이익과 평균 자본 중 어느 쪽이 더 변했는지 살펴보세요.'},
  {id:'liquidity',title:'안전성·유동성',question:'빚과 당장 낼 돈을 감당할 수 있나?',keys:['debtRatio','currentRatio','quickRatio','interestCoverage'],
    caveat:'유동자산에는 회수가 늦은 채권이나 팔리지 않은 재고가 있을 수 있어요.',next:'단기 차입 만기와 실제 현금 회수 일정을 함께 확인하세요.'},
  {id:'growth',title:'성장성',question:'사업이 커지고 있나?',keys:['revenueGrowth','operatingGrowth','netGrowth'],
    caveat:'매출과 이익은 서로 다르게 움직일 수 있어요. 분기 비교에는 계절성도 영향을 줘요.',next:'매출 100원당 원가와 판관비를 전년 같은 기간과 비교하세요.'},
  {id:'activity',title:'활동성',question:'재고와 설비를 효율적으로 쓰나?',keys:['assetTurnover','inventoryTurnover','receivableTurnover','collectionDays','inventoryDays','payableDays','cashCycle'],
    caveat:'재고가 쌓인 배경에는 판매 둔화와 다음 납품을 위한 준비가 모두 가능해요.',next:'회수기간의 변화와 생산·납품 관련 공시를 함께 확인하세요.'},
  {id:'cash',title:'현금흐름',question:'이익이 실제 현금으로 들어오나?',keys:['cfo','cfi','cff','cashGap','fcf'],
    caveat:'영업현금이 순이익보다 커도 회수·지급 시점에 따라 달라져요. 투자현금 유입에는 자산 매각도 포함돼요.',next:'채권·재고 증감과 취득·매각 내역을 확인하세요.'},
  {id:'valuation',title:'시장가치',question:'실적과 자산에 비해 주가가 어느 수준인가?',keys:['eps','pe','bps','pb','dividendYield','enterpriseValue','ebitda','evEbitda','marketCap'],
    caveat:'낮은 배수에는 성장 기대나 위험이 반영될 수 있어요. 좋은 실적도 시장 기대보다 낮으면 주가가 내릴 수 있어요.',next:'비교기업의 성장률·부채와 다음 공시에서 확인할 조건을 살펴보세요.'}
];
const roles = {
  investor:{
    profitability:['operatingMargin','roe','netMargin'],liquidity:['debtRatio','quickRatio','interestCoverage'],growth:['revenueGrowth','operatingGrowth','netGrowth'],
    activity:['assetTurnover','inventoryDays','collectionDays'],cash:['cfo','cashGap','fcf'],valuation:['pe','pb','dividendYield']
  },
  bank:{
    profitability:['operatingMargin','roa','netMargin'],liquidity:['interestCoverage','quickRatio','debtRatio'],growth:['operatingGrowth','revenueGrowth','netGrowth'],
    activity:['collectionDays','cashCycle','payableDays'],cash:['cfo','cashGap','cff'],valuation:['enterpriseValue','ebitda','evEbitda']
  },
  manager:{
    profitability:['costShare','sgaShare','operatingMargin'],liquidity:['currentRatio','quickRatio','interestCoverage'],growth:['revenueGrowth','operatingGrowth','netGrowth'],
    activity:['inventoryDays','collectionDays','payableDays'],cash:['cashGap','cfo','fcf'],valuation:['eps','ebitda','bps']
  }
};
// A saved evidence card keeps the follow-up that belongs to that specific measure.
const followUps={
  operatingMargin:'매출·매출원가·판관비를 나란히 보고 매출 100원당 어떤 비용이 달라졌는지 확인하세요.',
  netMargin:'영업이익률과 순이익률을 비교한 뒤 이자·처분손익·세금의 변화를 확인하세요.',
  roe:'주주 귀속 이익, 평균 자본과 자기자본승수를 전년 동기와 함께 보세요.',
  roa:'순이익과 평균총자산 중 어느 쪽이 더 변했는지 확인하세요.',
  costShare:'조달 가격, 원재료 재고의 소진 시점과 판매가격 변화를 확인하세요.',
  sgaShare:'매출 증가 속도와 판매·관리 비용 증가 속도를 비교하세요.',
  equityMultiplier:'자산 증가를 차입으로 조달했는지, 배당 등으로 자본이 줄었는지 확인하세요.',
  dupontRoe:'이익률·자산회전율·자기자본승수 중 변화가 큰 항목을 찾아보세요.',
  debtRatio:'부채의 구성과 만기, 기말 자본의 증감을 함께 확인하세요.',
  currentRatio:'유동자산 중 현금·매출채권·재고 각각의 비중과 유동부채 만기를 확인하세요.',
  quickRatio:'당좌자산 가운데 현금의 비중과 채권의 회수 가능성을 확인하세요.',
  interestCoverage:'다음 이자 지급 일정과 고정·변동금리 차입금의 비중을 확인하세요.',
  revenueGrowth:'판매량·판매가격·납품 시점 중 매출 변화를 설명하는 자료를 확인하세요.',
  operatingGrowth:'전년 동기 매출과 원가·판관비의 증가 속도를 비교하세요.',
  netGrowth:'본업 이익과 일회성 처분손익, 금융비용·세금의 변화를 나눠 보세요.',
  assetTurnover:'매출과 평균총자산의 증가율, 새 설비의 가동 시점을 확인하세요.',
  inventoryTurnover:'재고 보유기간과 납품 일정이 함께 변했는지 확인하세요.',
  receivableTurnover:'채권 회수기간과 외상거래 조건의 변화를 확인하세요.',
  collectionDays:'고객 결제 조건이 길어졌는지, 미회수 대금이 늘었는지 확인하세요.',
  inventoryDays:'판매 둔화와 신제품·납품 준비 중 어느 설명을 지지하는 자료가 있는지 확인하세요.',
  payableDays:'공급사의 결제 조건과 실제 지급 지연 가능성을 확인하세요.',
  cashCycle:'재고 보유·매출채권 회수·매입대금 지급 중 주기가 크게 바뀐 항목을 찾으세요.',
  cfo:'순이익에 비현금 항목과 채권·재고·채무 증감을 반영해 영업현금과 대조하세요.',
  cfi:'설비·무형자산 취득과 자산 매각 수입을 나누어 확인하세요.',
  cff:'차입·상환·신주 발행·배당 가운데 현금 증감에 기여한 항목을 확인하세요.',
  cashGap:'순이익과 영업현금 차이를 비현금 비용과 운전자본 변동으로 나눠 보세요.',
  fcf:'영업현금으로 지급한 설비 투자액과 성장투자의 사용 목적을 확인하세요.',
  eps:'보통주 귀속 이익과 가중평균 주식수 중 변화가 컸던 항목을 확인하세요.',
  pe:'최근 12개월 이익에 일회성 손익이 포함됐는지, 성장 기대와 위험이 달라졌는지 확인하세요.',
  bps:'증자·배당과 자본 변동, 기말 보통주 수를 확인하세요.',
  pb:'장부자산의 회수 가능성과 자본 대비 주주 이익을 함께 살펴보세요.',
  dividendYield:'지난 네 분기의 실제 지급 배당과 다음 배당을 감당할 현금을 확인하세요.',
  enterpriseValue:'같은 관찰 주가 기준의 시가총액·이자부 차입금·차감 현금을 따로 확인하세요.',
  ebitda:'감가상각·무형자산상각과 실제 설비·무형자산 취득지출을 비교하세요.',
  evEbitda:'비교기업들의 EBITDA 산식, 차입금·현금 범위와 투자 지출을 확인하세요.',
  marketCap:'시장가격 변화와 신주 발행에 따른 주식 수 변화를 나누어 보세요.',
  bankCapitalShare:'자본 변동과 별도로 위험가중자산·자본적정성 관련 공시가 있는지 확인하세요.',
  bankCashShare:'현금과 가까운 시기의 예금 인출·차입 상환 일정을 함께 확인하세요.',
  bankLoanShare:'대출의 만기, 연체와 신용손실 관련 자료가 있는지 확인하세요.',
  bankDepositShare:'예금 만기·인출 민감도와 다른 자금 조달 수단을 확인하세요.'
};
const specificCaveats={
  operatingMargin:'원재료 단가, 판매가격과 제품 구성이 바뀌면 영업이익률이 달라질 수 있어요.',
  netMargin:'일회성 자산 처분손익이나 세금 변화도 순이익에 반영돼요.',
  roa:'신규 설비가 아직 가동되지 않았다면 자산이 이익보다 먼저 늘 수 있어요.',
  costShare:'장기계약과 보유 재고 때문에 외부 원재료 시세가 비용에 늦게 반영될 수 있어요.',
  sgaShare:'광고·연구개발 지출 시점과 매출이 인식되는 시점은 다를 수 있어요.',
  interestCoverage:'이자비용 이전에 발생한 영업손실이나 일시적 이익이 배수를 크게 바꿀 수 있어요.',
  cff:'차입이나 신주 발행으로 현금이 늘어도 본업의 이익이 커졌다는 뜻은 아니에요.',
  dividendYield:'과거의 지급액과 현재 주가로 구한 비율이에요. 다음 지급액은 달라질 수 있어요.',
  marketCap:'최근 공시의 주식 수를 쓰므로 이후 발행이나 소각은 새 공시에서 확인해야 해요.'
};
const roleIssues={
  investor:{profitability:'본업의 이익률 변화가 주주에게 남은 이익에도 이어졌을까요?',liquidity:'가까운 만기의 부채를 회수 가능한 자산으로 감당할 수 있을까요?',
    growth:'매출 성장이 이익으로도 이어졌을까요?',activity:'재고와 채권이 느는 동안 필요한 자금도 늘었을까요?',cash:'본업 현금으로 투자 지출을 얼마나 감당했을까요?',valuation:'현재 배수에 어떤 기대와 위험이 담겼을까요?'},
  bank:{profitability:'본업의 이익으로 이자를 감당할 수 있을까요?',liquidity:'부채 만기와 현금 유입 시점이 맞을까요?',growth:'이익의 변화가 상환 재원에도 이어질까요?',
    activity:'외상대금을 차입 만기 전에 회수할 수 있을까요?',cash:'원리금 상환에 쓸 현금이 반복해서 들어올까요?',valuation:'장부상 기업가치와 실제 상환 재원은 어떻게 다를까요?'},
  manager:{profitability:'매출 100원당 원가와 판관비 중 어느 비용이 더 변했을까요?',liquidity:'당장 지급할 대금 중 어떤 만기가 먼저 돌아올까요?',
    growth:'납품 증가를 뒷받침할 원가와 설비 여력이 있을까요?',activity:'재고·회수·지급 중 어디에 자금이 오래 묶일까요?',cash:'재고와 채권을 관리하면 현금이 얼마나 달라질까요?',valuation:'다음 공시에서 주주에게 설명할 운영 변화는 무엇일까요?'}
};
function calculate(def,bundle,file,quote,collect=false) {
  let value=null,reason='',r=null;
  try {
    if (!file || !file.period) unavailable(missing);
    if (file.basis==='전망' || file.forecast) unavailable('공시된 실적만 비교해요.');
    if (def.bankExcluded && bundle.profile?.financial) unavailable(banking);
    r=new Reading(bundle,file,quote,collect);
    value=def.read(r);
    if (!Number.isFinite(value)) unavailable('원자료로 유효한 값을 계산할 수 없어요.');
  } catch(e) {
    if (!(e instanceof Missing)) throw e;
    value=null;
    reason=e.message;
  }
  const period = !file?'':def.ttm && r?.trail.length ? (labelPeriod(r.trail[0])===labelPeriod(file) ? labelPeriod(file) : labelPeriod(r.trail[0])+' ~ '+labelPeriod(file))+' · 최근 12개월 실적' : labelPeriod(file);
  const observed=def.price?quoteTime(quote?.quoteTick):'';
  return {value,display:value===null?reason:format(value,def.unit,file.currency),reason,period:observed?period+' · '+observed+' 관찰 시세':period,inputs:r?.inputs || [],flags:r?.flags||[],changeAmount:r?.changeAmount??null};
}
function changeText(delta,unit,currency) {
  if (Math.abs(delta)<1e-10) return '같아요';
  const difference=unit==='%' ? ko.format(Math.abs(delta))+'%p' : format(Math.abs(delta),unit,currency);
  return difference+(delta>0?' 높아요':' 낮아요');
}
function comparePeers(values,unit,currency,period) {
  const sorted=values.sort((a,b)=>a.value-b.value);
  const count=sorted.length,mid=count>>1;
  const value=!count?null:count%2?sorted[mid].value:(sorted[mid-1].value+sorted[mid].value)/2;
  return {value,display:count?format(value,unit,currency):'비교 자료 없음',count,method:'중앙값',period,members:sorted};
}
function peerQuote(quoteMap,peer,clock) {
  const ref=quoteMap?.[peer.asset?.code??peer.current?.companyCode];
  return Number.isFinite(ref)?{price:ref,quoteTick:clock}:ref;
}
function metricCaveat(def,group,financial,flags) {
  if (flags.length) return flags.join(' ');
  if (financial && def.bankExcluded) return banking;
  if (specificCaveats[def.id]) return specificCaveats[def.id];
  switch (def.id) {
  case 'fcf':return '음수 FCF에는 성장투자가 포함될 수 있어요. 여기서는 운전자본 변동을 이미 반영한 CFO를 사용해요. 강의식 CFFA의 OCF(영업이익 + 감가상각 − 세금)와는 출발점이 달라요.';
  case 'ebitda':case 'evEbitda':return '영업 기준 단순화 EBITDA는 상각 전 영업성과예요. 이자·세금·운전자본·설비 지출에 따른 현금 이동은 별도로 확인해요.';
  case 'assetTurnover':case 'inventoryTurnover':case 'receivableTurnover':return '해당 회계기간의 회전 횟수예요. 연환산 없이 같은 길이·정의의 기간끼리 비교해요.';
  case 'eps':case 'bps':return '주당 금액은 주식 수와 명목 단위에 따라 달라져요. 주당 금액의 크기만으로 기업 간 우열을 판단하기 어려워요.';
  case 'cfo':case 'cfi':case 'cff':return group.caveat+' 현금흐름 금액은 기업 규모의 영향도 받아요.';
  case 'bankCapitalShare':case 'bankCashShare':case 'bankLoanShare':case 'bankDepositShare':return '회계상 잔액을 이용했어요. 예금 만기·연체·위험가중자산 자료가 있어야 건전성을 더 구체적으로 해석할 수 있어요.';
  default:return group.caveat;
  }
}
function interpret(m,currency) {
  if (m.value===null) return m.reason;
  const parts=[m.period+' '+m.label+'은 '+m.display+'예요.'];
  if (m.prior && m.prior.value!==null) parts.push('전년 같은 기간보다 '+changeText(m.value-m.prior.value,m.unit,currency)+'.');
  if (m.comparison.count) parts.push('동종 '+m.comparison.count+'곳 중앙값은 '+m.comparison.display+'예요.');
  return parts.join(' ');
}
function finite(...numbers){return numbers.every(Number.isFinite);}
function groupFact(group,m,file) {
  const v=id=>m[id]?.value, d=id=>m[id]?.display;
  if (group.id==='profitability' && finite(v('operatingMargin'),m.operatingMargin.prior?.value)) {
    const prior=m.operatingMargin.prior.value, current=v('operatingMargin'), costs=[];
    for (const id of ['costShare','sgaShare']) {
      const before=m[id]?.prior?.value;
      if (finite(v(id),before) && v(id)>before+0.001) costs.push(id==='costShare'?'매출원가':'판관비');
    }
    const costClause=current<prior && costs.length?'매출에서 '+costs.join('와 ')+'의 비중이 늘면서 ':'';
    return costClause+'영업이익률은 '+d('operatingMargin')+'로 전년 동기보다 '+changeText(current-prior,'%',file.currency)+'.';
  }
  if (group.id==='growth' && finite(v('revenueGrowth'),v('operatingGrowth')) && v('revenueGrowth')>0 && v('operatingGrowth')<0)
    return '매출은 전년 동기보다 '+d('revenueGrowth')+' 늘었지만 본업 이익은 '+ko.format(-v('operatingGrowth'))+'% 줄었어요.';
  if (group.id==='cash' && finite(v('cfo'),file.income?.netIncome) && v('cfo')<0 && file.income.netIncome>0) {
    const tied=[];
    if (file.cashflow?.changeReceivables>0) tied.push('외상대금');
    if (file.cashflow?.changeInventory>0) tied.push('재고');
    const workingCapital=tied.length?tied.join('과 ')+'에 묶인 자금이 늘어난 가운데, ':'';
    return workingCapital+'순이익은 흑자지만 본업에서 현금이 순유출됐어요.';
  }
  const first=group.highlights.map(id=>m[id]).find(x=>x && x.value!==null);
  if (first) return first.period+' 기준 '+first.label+'은 '+first.display+'예요.';
  return group.metrics?.[0]?.reason || '비교할 수 있는 공시 수치가 아직 없어요.';
}
export function getValuation(bundle,price) {
  const result={};
  for (const id of ['eps','bps','pe','pb','ps','dividendYield','marketCap'])
    result[id]=calculate(fields[id],bundle||{},bundle?.current,{price}).value;
  result.roe=calculate(fields.roeTtm,bundle||{},bundle?.current,{}).value;
  return result;
}
export function financialHistory(bundle,annual=false) {
  const quarters=historyTo(bundle,bundle.current);
  const years=[...new Set(quarters.map(file=>file.period.year))];
  const groups=annual?years.map(year=>quarters.filter(file=>file.period.year===year))
    .filter(files=>files.length===4&&files.every((file,i)=>file.period.quarter===i+1)):
    quarters.slice(-5).map(file=>[file]);
  const ratios=bundle.profile?.financial?['bankCapitalShare','bankCashShare']:['debtRatio','currentRatio'];
  return groups.map(files=>{
    const file=files.at(-1);
    const total=(key,source='income')=>{
      const values=files.map(row=>row[source]?.[key]);
      return values.every(Number.isFinite)?values.reduce((sum,value)=>sum+value,0):null;
    };
    const days=files.reduce((sum,row)=>sum+row.period.days,0);
    const weightedShares=read=>files.reduce((sum,row)=>sum+read(row)*row.period.days,0)/days;
    const perShare=(earnings,shares)=>earnings!==null&&Number.isFinite(shares)&&shares>0?earnings/shares:null;
    return {id:file.id,year:file.period.year,quarter:annual?null:file.period.quarter,end:file.period.end,
      industryIds:[...new Set(files.flatMap(row=>row.industryIds??[]))],
      revenue:total('revenue'),revenueEstimate:total('revenue','estimate'),
      operatingProfit:total('operatingProfit'),netIncome:total('netIncome'),
      eps:perShare(total('commonIncome'),weightedShares(row=>row.shares?.weightedAverage)),
      epsEstimate:perShare(total('commonIncome','estimate'),weightedShares(row=>row.estimate?.shares)),
      ...Object.fromEntries(ratios.map(key=>[key,calculate(fields[key],bundle,file,{}).value]))};
  });
}
function earlierMatch(bundle,file) {
  return file && historyTo(bundle,file).find(f=>priorPeriod(file,f));
}
export function analyzeCompany(bundle={}, options={}) {
  const role=Object.hasOwn(analysisRoles,options.role)?options.role:'investor';
  const file=bundle?.current;
  if (!file?.period || (Number.isFinite(options.quoteTick) && file.publishedTick>options.quoteTick)) return {groups:[],metrics:{},role,period:''};
  const previous=earlierMatch(bundle,file);
  const peers=(bundle.peers||[]).filter(p=>p.current && p.current.companyCode!==file.companyCode && (!Number.isFinite(options.quoteTick) || p.current.publishedTick<=options.quoteTick) &&
    (!p.profile?.group || !bundle.profile?.group || p.profile.group===bundle.profile.group) && matchingPeriod(file,p.current));
  const metrics={};
  const groups=analysisGroups.map(spec=>{
    const financial=bundle.profile?.financial;
    const bankingKeys={liquidity:['bankCapitalShare','bankCashShare'],activity:['bankLoanShare','bankDepositShare']};
    const bankKeys=financial && bankingKeys[spec.id];
    const keys=bankKeys?[...bankKeys,...spec.keys]:spec.keys;
    const group={id:spec.id,title:spec.title,question:spec.question,issue:roleIssues[role][spec.id],metrics:[],
      highlights:bankKeys || roles[role][spec.id]};
    if (financial && spec.id==='activity') {
      group.question='예금과 대출이 자금 운용에서 차지하는 몫은?';
      group.issue='영업비용·대출채권 건전성과 회수 자료가 공개됐는지 확인해 보세요.';
    }
    for (const id of keys) {
      const def=fields[id], base=calculate(def,bundle,file,options,true);
      const priorQuote=previous && options.priorQuotes?.[previous.id];
      const prev=previous && (!def.price || priorQuote?.quoteTick===previous.publishedTick) ? calculate(def,bundle,previous,priorQuote) : null;
      const sameMeasurement=reading=>base.flags.includes('외상매출 자료가 없어 전체 매출을 대용했어요.')===reading.flags.includes('외상매출 자료가 없어 전체 매출을 대용했어요.');
      const members=[];
      for (const p of peers) {
        if (base.value===null) break;
        const quote=peerQuote(options.peerPrices,p,options.quoteTick);
        if (def.price && (!Number.isFinite(options.quoteTick) || !quote || quote.quoteTick!==options.quoteTick)) continue;
        const reading=calculate(def,p,p.current,quote);
        if (reading.value===null || !sameMeasurement(reading)) continue;
        members.push({code:p.current.companyCode,name:p.asset?.name || p.current.companyCode,value:reading.value,display:reading.display});
      }
      const {read,...descriptive}=def;
      const m={...descriptive,...base,formulaVersion,currency:file.currency,scope:file.scope,source:file.source || '게임 내 공시',
        filingId:file.id,periodStart:file.period.start,periodEnd:file.period.end,publishedTick:file.publishedTick,quoteTick:def.price?(options.quoteTick??null):null,
        prior:prev?(sameMeasurement(prev)?{value:prev.value,display:prev.display,period:prev.period,reason:prev.reason}:
          {value:null,display:'산식 기준 다름',period:prev.period,reason:'외상매출과 전체 매출 대용값은 서로 비교할 수 없어요.'}):null,
        comparison:comparePeers(members,def.unit,file.currency,base.period),comparable:base.value!==null,
        caveat:metricCaveat(def,spec,financial,base.flags),next:followUps[id] || spec.next};
      if (m.ttm) {
        const window=trailing(historyTo(bundle,file));
        if (window.length) m.periodStart=window[0].period.start;
      }
      m.interpretation=interpret(m,file.currency);
      metrics[id]=m;group.metrics.push(m);
    }
    if (financial && !bankKeys) {
      const eligible=group.metrics.filter(m=>!m.bankExcluded).map(m=>m.id);
      group.highlights=[...new Set([...group.highlights.filter(id=>eligible.includes(id)),...eligible])].slice(0,3);
    }
    if (spec.id==='profitability' && !financial && role!=='bank') {
      group.issue='매출 100원당 원가와 판관비 중 어느 비용이 영업이익률 변화를 설명할까요?';
    }
    if (role==='investor' && spec.id==='growth' && metrics.revenueGrowth.value>0 && metrics.operatingGrowth.value<0)
      group.issue='매출이 늘었는데 영업이익이 줄어든 이유를 비용 내역에서 찾을 수 있을까요?';
    if (role==='investor' && spec.id==='cash' && metrics.cfo.value<0 && file.income?.netIncome>0)
      group.issue='흑자에도 현금이 줄었다면 채권과 재고 중 어디에 자금이 더 묶였을까요?';
    group.summary=groupFact(group,metrics,file);
    return group;
  });
  return {groups,metrics,role,period:labelPeriod(file)};
}
