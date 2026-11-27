import {marketQuotes} from './exchange-events.mjs';
import {firstGameDay,marketClock,shortDayLabel} from './clock-calendar.mjs';
import {fundTracking,instrumentIndustryIds} from './securities-data.mjs';
import {stocks,markets,currencies,visibleStories,quantityUnit,isSpot,marketGroup,tradeNewsLinks,symbolIndex} from './world.mjs';
import {isExchangeCurrency} from './fx.mjs';
import {quoteInfo,chartBars,calendar,candlePeriod} from './tape.mjs';
import * as account from './market.mjs';
import {companyProfile,publicCompanyHistory} from './company-filings.mjs';
import {getValuation} from './analysis-metrics.mjs';
import {refreshChart} from './terminal.mjs';
import {allocateFlow,fundFacts,number,cash,shortValue,percent} from './broker-data.mjs';
import {instrumentMarketCap} from './market-cap.mjs';

const app = {
  group:'all',fundType:'index',sort:'turn',sector:'all',money:'KRW',holdingSort:'value',
  tab:'chart', symbol:null, period:'D',historyPage:0,
  expanded:null,flowPeriod:5
};
const tabs=[['chart','차트'],['history','시세'],['flow','동향'],['info','종목정보']];
export const productFilters=[
  ['all','전체','market-grid'],['domestic','국내주식','market'],['overseas','해외주식','market-globe'],
  ['fund','ETF','market-fund'],['coin','코인','coin'],
];
export const etfFilters=[['index','지수'],['leverage','레버리지'],['inverse','인버스']];
const ranks=[['turn','거래대금순'],['cap','시가총액순'],['up','상승률순'],['down','하락률순']];
const sectors=[
  ['chips','반도체',['semiconductors','semiconductor-equipment']],
  ['tech','기술·통신',['cloud','telecom-equipment','telecommunications','data-centers','gaming','electronics','digital-advertising','software','electronic-components']],
  ['auto','자동차',['automotive','auto-parts']],
  ['industry','산업·운송',['logistics','rail-transport','shipping','ports','shipbuilding','rail-equipment','industrial-machinery','defense','aerospace']],
  ['materials','소재·배터리',['materials','batteries','mining','fertilizer']],
  ['energy','에너지·전력',['power','gas','electrical-equipment']],
  ['finance','금융',['banking','securities','insurance','credit-finance','payments']],
  ['health','헬스케어',['pharmaceuticals']],
  ['consumer','소비재',['retail','food-manufacturing','agriculture','household-products']],
  ['other','기타',[]]
];
const sectorsByIndustry=new Map(sectors.flatMap(([id,,industries])=>industries.map(industry=>[industry,id])));
const sectorLabels=new Map(sectors.map(([id,label])=>[id,label]));
const sectorIds=industries=>[...new Set(industries.map(id=>sectorsByIndustry.get(id)).filter(Boolean))].slice(0,3);
function stockSectorIds(asset){
  if(asset.kind!=='주식')return [];
  const ids=sectorIds(asset.industryIds??[]);
  return ids.length?ids:['other'];
}
export function instrumentSectors(asset,day){
  const ids=asset.kind==='주식'?stockSectorIds(asset):sectorIds(instrumentIndustryIds(asset,day));
  return ids.map(id=>[id,sectorLabels.get(id)]);
}
const signedCash=(v,c='KRW')=>(v>0?'+':'')+cash(v,c);
const sessionChange=(q,c)=>signedCash(q.change,c)+'('+number(q.pct,2)+'%)';
const currencyAction={KRW:'원화로 표시',USD:'달러로 표시'};
const fmtUnit=(n,c)=>shortValue(n,currencies[c]?.name||c);
const reg=a=>a.archiveOnly?'archive':isSpot(a)?'coin':a.market==='mora'?'domestic':'overseas';
const type=a=>a.indexTracker?'지수 ETF':a.reference?'ETF':a.floatShares?'급등주':a.kind||'주식';
function currentPositions(s){
  return s.holdings.flatMap((qty,i)=>{
    if(!qty)return [];
    return [{i,a:stocks[i],...account.position(s,i)}];
  });
}
function normalizeSearch(text){
  return text.toLocaleLowerCase().replace(/\s/g,'');
}
const familiarMarkets={mora:'한국 대한민국 Korea',arden:'미국 USA'};
function searchTerms(a){
  return normalizeSearch([a.name,a.enName,...(a.formerNames??[]),a.ticker,a.code,type(a),a.sector,a.underlying,a.market,
    markets[a.market].name,markets[a.market].country,markets[a.market].board,familiarMarkets[marketGroup(a.market)]].filter(Boolean).join(' '));
}
const instruments=stocks.flatMap((a,i)=>a.archiveOnly?[]:[{a,i,search:searchTerms(a)}]);
const listingSectors=new Map(instruments.map(({a})=>[a,stockSectorIds(a)]));
const etfType=a=>a.factor<0?'inverse':a.factor>1?'leverage':'index';
export function searchInstruments(query){
  const term=normalizeSearch(query);
  return term?instruments.filter(({search})=>search.includes(term)):[];
}
function matchingInstruments(){
  const group=app.group;
  return instruments.filter(({a})=>{
    if(group==='all')return true;
    if(group==='fund')return a.reference&&etfType(a)===app.fundType;
    if(group==='coin')return isSpot(a);
    return a.kind==='주식'&&reg(a)===group;
  });
}
function sectorOptions(rows){
  const counts=new Map();
  for(const {a} of rows){
    for(const id of listingSectors.get(a)??stockSectorIds(a))counts.set(id,(counts.get(id)||0)+1);
  }
  return [['all','전체 섹터'],...sectors.flatMap(([id,label])=>{
    const count=counts.get(id)||0;
    return count||id===app.sector?[[id,label+' ('+count+')']]:[];
  })];
}
function findRows(s,scope=matchingInstruments()){
  const rates=account.localRates(s),{sector,sort}=app;
  const rows=scope.filter(({a})=>sector==='all'||(listingSectors.get(a)??stockSectorIds(a)).includes(sector)).map(({a,i})=>{
    const q=quoteInfo(s,i),rate=rates[a.currency]||1;
    const cap=sort==='cap'?instrumentMarketCap(a,s,q.price):null;
    return {a,i,q,rate,turn:q.turnover*rate,marketCap:cap===null?null:cap*rate};
  });
  rows.sort((a,b)=>{
    if(sort==='cap')return (b.marketCap??-1)-(a.marketCap??-1)||a.i-b.i;
    if(sort==='up')return b.q.pct-a.q.pct||a.i-b.i;
    if(sort==='down')return a.q.pct-b.q.pct||a.i-b.i;
    return b.turn-a.turn||a.i-b.i;
  });
  return rows;
}
export function valuationComparison(state,index,bundle,metric){
  const current=getValuation(bundle,quoteInfo(state,index).price);
  const peers=bundle.current?instruments.flatMap(({a,i})=>{
    if(i===index||companyProfile(a)?.group!==bundle.profile.group)return [];
    const peer=publicCompanyHistory(a,state);
    if(peer.current?.period.end!==bundle.current.period.end)return [];
    const value=getValuation(peer,quoteInfo(state,i).price)[metric];
    return Number.isFinite(value)?[value]:[];
  }):[];
  return {value:current[metric],eps:current.eps,average:peers.length?peers.reduce((sum,value)=>sum+value,0)/peers.length:null,count:peers.length};
}
const labelsPeriod={'5':'5분','D':'일별','M':'월별','Y':'연별'};
function historyDate(state,bar,tf){
  if(tf==='5')return calendar(bar.day,bar.step,state);
  if(tf==='D')return shortDayLabel(bar.day,firstGameDay(state));
  return candlePeriod(bar,tf);
}
function historyData(s,i){
 const a=stocks[i],tf=app.period,data=chartBars(s,i,tf),size=12;
 const maxPage=Math.max(0,Math.ceil(data.length/size)-1);
 app.historyPage=Math.min(app.historyPage,maxPage);
 const skip=app.historyPage*size,edge=data.length-skip,subset=data.slice(Math.max(0,edge-size),edge).reverse();
 const selected=subset.find(b=>b.key===app.expanded)||subset[0];
 return {tf,data,edge,subset,selected,maxPage};
}
function flowData(s,i){
 const a=stocks[i],daily=chartBars(s,i,'D'),bars=daily.slice(-app.flowPeriod);
 const labels=isSpot(a)?['소액 계정','대형 계정','유동성 공급자']:['개인','기관','외국인'];
 const totals=labels.map(()=>({net:0}));
 const fmt=n=>fmtUnit(n,a.currency);
 const rows=bars.map(b=>{
   const group=allocateFlow(i,b),mid=b.v&&b.pv?b.pv/b.v:(b.h+b.l+b.c)/3;
   const net=group.map(g=>g.net*mid);
   net.forEach((amount,j)=>{totals[j].net+=amount;});
   return {b,net};
 });
 const high=Math.max(1,...totals.map(g=>Math.abs(g.net)));
 return {labels,totals,rows,high,fmt};
}
function productInfo(s,i){
 const a=stocks[i];
 if(a.bond){
   const {issuer,face,term}=a.bond;
   return {title:'채권 정보',rows:[
     ['채권 종류',a.sector],['발행처',issuer],['액면가',cash(face,a.currency)],['대표 만기',term+'년'],
     ['표면금리 (연)',percent(a.annualDividend/face*100)],['1좌당 연 이자',cash(a.annualDividend,a.currency)],
   ],explanation:'게임 내 월말에 보유한 수량 기준으로 연 이자의 1/12을 받아. 시세에는 모의 시장금리 변화가 반영돼.'};
 }
 if(a.option){
   const {underlying,side,strike}=a.option,j=symbolIndex[underlying];
   return {title:'옵션 정보',rows:[
     ['유형',side==='call'?'콜 · 매수권':'풋 · 매도권'],['행사가',cash(strike,a.currency)],
     ['기초자산',stocks[j].name],['기초자산 현재가',cash(quoteInfo(s,j).price,a.currency)],
   ],explanation:'콜은 기초자산 가격이 오를 때, 풋은 내릴 때 프리미엄이 올라가. 게임에서는 이 모의 프리미엄을 거래해.'};
 }
 const facts=fundFacts(s,i);
 if(a.reference){
   const {underlying,factor}=fundTracking(a,marketClock(s).day);
   return {title:'ETF 정보',rows:[
     ['1좌당 NAV',cash(facts.nav,a.currency)],['괴리율',percent(facts.premiumPct,true)],['일간 추종 배수',factor+'배'],
     ['시가총액',fmtUnit(facts.marketCap,a.currency)],['보수비용 (연)',percent(facts.feePct)],['분배수익률',percent(facts.yieldPct)],
   ],metadata:[
     ['기초자산',underlying],['운용사',a.issuer||'—'],
     ['운용자산',fmtUnit(facts.aum,a.currency)],['발행 좌수',number(a.units)+'좌'],
   ],explanation:'기초자산의 전일 종가 대비 수익률을 표시된 배수만큼 추종해.'};
 }
 return {title:'현물 코인 정보',rows:[
   ['시가총액',fmtUnit(facts.marketCap,a.currency),true],
   ['유통량',number(a.circulating)+'개'],['최대 공급량',Number.isFinite(a.maxSupply)?number(a.maxSupply)+'개':'상한 없음'],
 ]};
}
function newsMove(event,asset,day){
 const move=event.shock?.[asset.code];
 if(Number.isFinite(move)&&move!==0)return move;
 const disclosure=event.operatingDisclosure;
 if(disclosure?.code===asset.code)return disclosure.sign;
 if(asset.option)return (asset.option.side==='put'?-1:1)*newsMove(event,stocks[symbolIndex[asset.option.underlying]],day);
 if(asset.bond?.issuerCode)return newsMove(event,stocks[symbolIndex[asset.bond.issuerCode]],day);
 const {reference,factor}=fundTracking(asset,day);
 return reference?.length?factor*reference.reduce((sum,code)=>sum+newsMove(event,stocks[symbolIndex[code]],day),0)/reference.length:0;
}
function newsData(s,i){
 const a=stocks[i],{day}=marketClock(s),reference=fundTracking(a,day).reference??[];
 const codes=new Set([a.code,...reference,...reference.flatMap(code=>stocks[symbolIndex[code]].reference??[])]);
 const related=a.option?.underlying??a.bond?.issuerCode;
 if(related)codes.add(related);
 return visibleStories(s).flatMap(story=>{
   const direct=story.related?.some(c=>codes.has(c));
   if(!direct&&!tradeNewsLinks(story).indirect.some(c=>codes.has(c)))return [];
   const move=newsMove(story.event,a,day);
   return [{story,indirect:!direct,impact:move>0?'positive':move<0?'negative':'neutral'}];
 });
}
export function selectSymbol(i){
  app.analysisFocus=null;app.symbol=i;app.tab='chart';app.period='D';app.historyPage=0;app.expanded=null;app.flowPeriod=5;
}
export function chartActive(){return app.tab==='chart';}
export function refreshLive(root,state,i){
  marketQuotes.publish(state);
  if(i!==null&&chartActive())refreshChart(state,quoteInfo(state,i));
}
export function handleBroker(action,el){
 const v=el.dataset.value;
 switch(action){
  case 'bk-tab':if(!tabs.some(([k])=>k===v))return false;app.tab=v;return true;
  case 'bk-group':if(!productFilters.some(([id])=>id===v))return false;app.group=v;app.sector='all';return true;
  case 'bk-fund':if(!etfFilters.some(([id])=>id===v))return false;app.fundType=v;return true;
  case 'bk-currency':if(!isExchangeCurrency(v))return false;app.money=v;return true;
  case 'bk-period':app.period=v;app.historyPage=0;app.expanded=null;return true;
  case 'bk-page':app.historyPage=Math.max(0,app.historyPage+Number(v));app.expanded=null;return true;
  case 'bk-bar':app.expanded=Number(v);return true;
  case 'bk-flow-range':app.flowPeriod=Number(v);return true;
  default:return false;
 }
}
export function brokerChange(el){
 switch(el.id){
  case 'bk-sector':if(el.value!=='all'&&!sectorLabels.has(el.value))return false;app.sector=el.value;return true;
  case 'bk-sort':if(!ranks.some(([key])=>key===el.value))return false;app.sort=el.value;return true;
  case 'bk-hold-sort':app.holdingSort=el.value;return true;
  default:return false;
 }
}
export {app as brokerView, tabs as detailTabs, ranks as sortOrders, sectorOptions, matchingInstruments,
  findRows, sessionChange, labelsPeriod, historyDate, historyData, flowData, productInfo, newsData,
  currentPositions, reg, signedCash, currencyAction};
