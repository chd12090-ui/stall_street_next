import {events} from './world.mjs';
import {wireBetween} from './press-wire.mjs';
import {eventIdentity} from './disclosure-event.mjs';
import {equityAsset} from './company-profiles.mjs';

// Coefficients are disclosed scenario assumptions, expressed as fractions of baseline quarter sales.
// A confirmed contract changes revenue only when the simulated batch passes delivery/acceptance.
// Stock market price shocks are deliberately never read here.
const channels={
  sale:['검수·납품','고객이 인수한 분량에 매출을 인식해.','매출 · 매출채권','인수 일정과 잔금 회수 조건을 확인해.'],
  cost:['조달·비용','해당 항차나 생산에 실제로 쓴 자재·운송비가 원가에 들어가.','매출원가 · 영업이익률','기존 재고와 고정계약 물량, 고객에게 넘길 수 있는 운임을 확인해.'],
  stock:['재고 매입','입고한 물량은 재고와 매입채무에 먼저 담겨.','재고 · 영업현금흐름','소비 시점과 공급사 지급 기한에 따라 손익과 현금이 달라져.'],
  advance:['고객 선수금','계약금이 들어오면 현금과 선수금이 함께 늘어.','현금 · 선수금','검수 전 계약금은 매출로 잡지 않아.'],
  credit:['상환·회수','새로 약정하는 대출의 공급 규모가 달라질 수 있어.','대출채권 · 영업현금흐름','기존 약정의 금리·만기와 신규 인출을 나누어 봐.'],
  fx:['외화 정산','환전 경로와 결제 통화가 달라지면 정산 비용이 바뀔 수 있어.','금융·기타손익 · 현금','정산 환율과 헤지한 비중, 잔여 환노출을 확인해.'],
};
const leg=(channel,delay,fraction)=>({channel,delay,fraction});
const rules={
 'm1-strait':{MOON:[leg('cost',55,.010)],HARB:[leg('cost',75,.014)]},
 'm2-cold-vans':{MOON:[leg('sale',130,.016)],MART:[leg('cost',150,-.006)]},
 't1-cathode-test':{CORL:[leg('stock',70,.014)],WJBT:[leg('cost',185,.004)]},
 't2-lumen-settlement':{VOLT:[leg('fx',144,-.002)],NORD:[leg('fx',144,-.001)]},
 't3-nova-power':{NOVA:[leg('sale',96,.022)]},
 'w1-convoy':{HARB:[leg('sale',108,.009)],MOON:[leg('sale',99,.006)]},
 'w2-gas-storage':{VOLT:[leg('stock',36,.013),leg('cost',220,.008)],NORD:[leg('sale',96,.009)]},
 'h1-rail-freight':{RAIL:[leg('sale',72,.013)]},
 'h2-crown-collateral':{CROWN:[leg('credit',210,-.014)]},
 'h3-chip-export':{ARC:[leg('sale',180,.021)]},
 'f1-yard-contract':{TIDE:[leg('advance',12,.006),leg('sale',375,.030),leg('advance',375,-.006)],HARB:[leg('cost',375,.008)]},
 'f2-strait-renewal':{MOON:[leg('cost',120,-.003)],HARB:[leg('cost',116,-.004)]},
 'wire-asia':{JHMI:[leg('cost',100,-.002)]},
 'wire-pacific':{PACI:[leg('stock',164,.007),leg('cost',245,-.003)]},
 'wire-south':{ANDB:[leg('sale',240,.007)]},
 'wire-north':{MOON:[leg('cost',180,-.002)]},
 'wire-europe':{NORD:[leg('sale',240,.008)]},
 'wire-africa':{ATLS:[leg('sale',200,.009)]},
};
const procurement=new Set(['RWDV','ONTL','DYFD']);
function operatingLegs(event,code){
  const fixed=rules[event.id]?.[code];
  if(fixed)return fixed;
  const d=event.operatingDisclosure;
  if(!d||d.code!==code||d.type==='outlook'||event.editorialOnly)return [];
  if(d.type==='shipment')return [leg('sale',12,d.sign*d.quantity/100*.004)];
  if(d.sign<0)return []; // An extension of an unsigned/unaccepted order has no cash or revenue entry.
  if(procurement.has(code))return [leg('stock',95,d.quantity*.000045)];
  return [leg('sale',128,d.quantity*.00005)];
}
function detail(event,posting){
  const [channel,business,metric,condition]=channels[posting.channel];
  return {...eventIdentity(event),channel,business,metric,condition};
}
export function filingEventImpact(event,input){
  const asset=equityAsset(input);
  if(!asset||!event)return null;
  const posts=operatingLegs(event,asset.code);
  return posts.length?detail(event,posts[0]):null;
}
export function journalForInterval(list,from,through){
  const issuers=new Map(),seen=new Set();
  for(const event of list){
    if(event.editorialOnly||event.tick>through)continue;
    const codes=Object.keys(rules[event.id]??{});
    if(event.operatingDisclosure)codes.push(event.operatingDisclosure.code);
    for(const code of new Set(codes)){
      const postings=operatingLegs(event,code);
      for(const [index,post] of postings.entries()){
        const at=event.tick+post.delay;
        if(at<from||at>through)continue;
        const evidence=detail(event,post);
        const id=[code,evidence.releaseId,index].join(':');
        if(seen.has(id))continue;
        seen.add(id);
        if(!issuers.has(code))issuers.set(code,[]);
        issuers.get(code).push({...evidence,storyId:event.stories?.[0]?.id??event.id+'-0',
          occurredTick:event.tick,recognizedTick:at,account:post.channel,fraction:post.fraction});
      }
    }
  }
  return issuers;
}
const quarterJournalCache=new Map();
export function operatingJournal(code,from,through){
  if(through<0)return [];
  let index=quarterJournalCache.get(from);
  if(!index){
    // Maximum posting lag above is 375 market ticks. Include releases before the period boundary.
    const list=[...events,...wireBetween(Math.max(-1,from-376),through)];
    index=journalForInterval(list,from,through);
    if(quarterJournalCache.size>=12)quarterJournalCache.delete(quarterJournalCache.keys().next().value);
    quarterJournalCache.set(from,index);
  }
  return index.get(code)??[];
}
