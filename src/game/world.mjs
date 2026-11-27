import {pressSchedule} from './press-schedule.mjs';
export {printedTick} from './press-schedule.mjs';
import {ritualArticleId} from './ritual-rules.mjs';
import {outlets,eventDays} from './press-data.mjs';
import {isPublishedStory,publicNewsLinks} from './news-relations.mjs';
import {prepareEvent,openingBriefs,electionBulletin} from './press-edition.mjs';
import {markets,currencies,stocks} from './securities-data.mjs';
import {dayLabel,marketClock,usesKst} from './clock-calendar.mjs';
import {wireBetween,archivedBulletin,incidentImpacts} from './press-wire.mjs';
export {markets,currencies,stocks,fmtMoney,priceTick,snapPrice,quantityRound,symbolIndex,marketGroup,tradingCountries,tradingVenues,isSpot} from './securities-data.mjs';
export {outlets};
export const stepsPerDay=288;
export const weekdays=['월','화','수','목','금','토','일'];
export const days=weekdays.map(weekday=>({weekday}));
export const weekday=day=>((day%7)+7)%7;
// Archived candles predate the game. From the game's first session on, every venue trades daily.
export const runsOn=(market,day)=>!!markets[market].continuous||day>=0||weekday(day)<5;
export function previousSession(market,day){let d=day-1;while(!runsOn(market,d))d--;return d;}
export const unit=i=>currencies[stocks[i].currency].name;
export function quantityUnit(i){
  const asset=stocks[i];
  if(asset.bond)return '좌';
  if(asset.option)return '계약';
  return asset.kind==='현물 코인'&&asset.code!=='BIT'?'개':'주';
}
const weekendEvents=[
 {id:'weekend-clearing',minute:0,title:'결제망 점검',shock:{BIT:-.019,ETH:-.028},fx:{},stories:[{outlet:outlets.find(x=>x.nation==='arden').id,title:'코인 정산 지연…서부 결제사 두 곳, 정산 확인 시간 연장',lead:'서부 결제업체 두 곳이 정산 대기 시간을 늘렸다.',body:['은행 창구가 문을 닫은 사이 일부 온체인 결제가 밀렸다. 냥이코인 현물 거래는 계속됐다. 송금 요청이 더 많이 몰린 이더리움에서 대기 시간이 더 길었다.','한국에 상장된 코인 추종상품은 매일 정규장에 거래된다. 정규장이 닫히면 계속 움직이는 현물 가격과 상장상품의 마지막 거래 가격이 달라질 수 있다.'],related:['BIT','ETH','BITF']}]},
 {id:'weekend-reopen',minute:0,title:'정산 대기열 정상화',shock:{BIT:.012,ETH:.023},fx:{},stories:[{outlet:outlets.find(x=>x.nation==='haeon').id,title:'요코하마항 전자 결제 대기열 정상화…밀린 지급분 해소',lead:'요코하마항 정산소가 지연된 송금의 재처리를 마쳤다.',body:['항만 정산소는 밀려 있던 전자 선하증권 지급 대기를 해소했다. 항만 밖에서 거래되는 두 코인의 거래량은 서로 다른 속도로 회복됐다.','해운주와 상장 추종상품은 하루 정규장에 거래된다. 운송업체의 현금 수요가 주가에 어떻게 반영되는지는 장이 열린 뒤 확인할 수 있다.'],related:['TIDE','BIT','ETH']}]}
];
// Issuers further along the trade route can respond to the same dispatch even outside its reporting country.
const spillovers={
  'wire-north':{PACP:.008,MOON:.002}, // Canal tenants gain on less expensive insured cold-chain cargo.
  'wire-south':{ANDB:.012,URUQ:-.003,PAMP:-.003}, // New ore berths relieve mining queues; farm slots remain rationed.
  'wire-africa':{ATLS:.011,NILD:.004}, // Fertiliser letters of credit improve phosphate shipments and port utilisation.
  'wire-pacific':{PACI:.011,ORUR:.003}, // Joint fuel procurement reduces island shippers' bunker costs.
  'wire-europe':{LMX:-.002,NILD:.003}, // Industrial manufacturers face a higher winter fuel bill.
  'wire-asia':{TIDE:.002,MEXL:.001}, // Origin recognition reduces friction at the third-country component stage.
  'm1-strait':{PACI:-.005,NETP:-.002},'m3-arden-rates':{NETP:-.012,SVHT:-.003},
  't1-cathode-test':{JHMI:-.008,ANDB:-.003},'t3-nova-power':{NETP:-.014},
  'w1-convoy':{PACI:.006},'w2-gas-storage':{RTKW:-.009,LMX:-.004},
  'h3-chip-export':{NETP:-.013,JHMI:-.005},'f2-strait-renewal':{PACI:.007}
};
const currencyAliases={MR:'KRW',AD:'USD',LM:'GBP',HA:'JPY'};
const newsDays=Array.from({length:7},(_,day)=>{
  if(day===0)return [...(eventDays[0]||[]),...openingBriefs];
  if(day===5)return [weekendEvents[0],electionBulletin];
  return day<5?(eventDays[day]||[]):[weekendEvents[day-5]];
});
export const events=newsDays.flatMap((list,day)=>list.map(raw=>{
  const e=prepareEvent(raw);
  const fx=Object.fromEntries(Object.entries(e.fx||{}).map(([code,move])=>[currencyAliases[code]||code,move]));
  return {...e,shock:{...spillovers[e.id],...e.shock},fx,day,tick:day*stepsPerDay+e.minute/5};
})).sort((a,b)=>a.tick-b.tick);
export function eventsBetween(after,through){
  return [...events.filter(e=>e.tick>after&&e.tick<=through),...wireBetween(after,through),...incidentImpacts(after,through)].sort((a,b)=>a.tick-b.tick);
}
export function tradeNewsLinks(story){
  const {direct,indirect}=publicNewsLinks(story);
  return {direct,indirect};
}
const newsTick=state=>{const {day,cursor}=marketClock(state);return day*stepsPerDay+cursor;};
const ritualPublished=(row,state,now)=>row.tick<now||row.tick===now&&(row.minuteOffset??0)<=(usesKst(state)&&Number.isInteger(state.wallMinute)?state.wallMinute%5:4);
export const stories=events.flatMap(e=>e.stories.map((s,n)=>({...s,id:e.id+'-'+n,event:e,outletInfo:outlets.find(o=>o.id===s.outlet)}))).filter(isPublishedStory);
const press=pressSchedule(stories);
export function visibleStories(state){
  return press.visible(newsTick(state),state.ritualEvents??[]);
}
export function articleById(state,id){
  const now=newsTick(state);
  if(typeof id!=='string')return null;
  const rows=state.ritualEvents??[];
  if(id.startsWith('brief-'))return press.brief(id,now,rows);
  if(id.startsWith('ritual-')){
    const row=state.ritualEvents?.find(item=>ritualArticleId(item.id)===id&&ritualPublished(item,state,now));
    return row?press.ritual(row,now,rows):null;
  }
  const story=stories.find(s=>s.id===id&&s.event.tick<=now)??archivedBulletin(id,now);
  return isPublishedStory(story)?press.lookup(story,now,rows):null;
}
