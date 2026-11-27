import {isPublishedStory} from './news-relations.mjs';
import {canonicalCountry} from './atlas-data.mjs';
import {reportingOutlet} from './press-data.mjs';
import {policyFollowUp} from './election-policy.mjs';
import {scheduledIncident,incidentStanceChanges} from './press-incidents.mjs';

const wireStart=3*288+194; // 2026-11-20 01:10 KST
const crossMarketStart=4*288+138; // From the 20:30 KST edition forward, keep prior candles intact.
const tradeLinks={
  NORD:['VOLT',.18], // European gas shipments and South Korean electricity fuel costs.
  RTKW:['IRPK',.16], // European industrial parts and US assembly equipment.
  SVHT:['YJRX',.17], // Southeast Asian contract supply and South Korean pharmaceutical production.
  MNRD:['HARB',.23], // Intermodal rail between the North American Union and US freight terminals.
  LMX:['RAIL',.16],  // French rail equipment and South Korean fleet availability.
};
const edition=(title,...body)=>({title,body,lead:body[0]});
function dispatch(outlet,countries,shock,ko,en=null,diplomacy=null,fx={},newsCategory=diplomacy?'politics':'stock'){
  const related=Object.keys(shock);
  return {outlet,countries,shock,ko,en,diplomacy,fx,related,newsCategory};
}

const leadDesk=[
  dispatch('arden-wire',['arden','mora'],{ARC:-.062,BMEM:-.012},
    edition('노스스타 CEO 급서, 이사회 소집…차세대 칩 발표 연기',
      '노스스타는 19일 밤 아드리언 켈 최고경영자가 병원에서 사망했다고 공시했다. 이사회는 예정됐던 차세대 칩 공개 행사를 연기하고 긴급회의를 소집했다.',
      '회사는 이미 받은 주문의 출하 일정에 변동이 없다고 밝혔다. 노스스타에 고대역폭 메모리를 공급하는 한국 백산칩은 1분기 물량을 따로 확인하고 있다.'),
    edition('Northstar CEO dies suddenly; board calls emergency meeting',
      'Northstar Chips said Adrian Kell, its chief executive, died in hospital late that night. The company postponed its next-generation chip launch while directors convened an emergency meeting.',
      'Northstar said previously ordered shipments were proceeding as scheduled. South Korean supplier Baeksan Chips is checking the status of its first-quarter orders separately.')),
  dispatch('workday',['mora'],{DHCP:-.046,MART:.001},
    edition('물결금융 대표 불륜 의혹…이사회, 협력사 계약도 들여다본다',
      '물결금융 강도현 대표가 협력사 임원과 부적절한 관계를 맺었다는 의혹이 제기됐다. 강 대표는 사적 관계가 계약에 영향을 미쳤다는 주장을 부인했다.',
      '이사회가 확보한 자료에는 해당 협력사와 체결한 78억 원 규모의 위탁계약 두 건이 포함돼 있다. 감사위원회는 입찰 당시 강 대표가 보고를 받았는지 확인하겠다고 밝혔다.')),
  dispatch('haeon-post',['haeon','chai'],{TIDE:-.012,JHMI:-.027,ASMZ:-.015,MOON:.003},
    edition('일본·동북아시아연합 경계 해역 대치…화물선 8척 항로 바꿔',
      '일본 해상보안청은 청람열도 동쪽에서 동북아시아연합 경비정 세 척이 경고 방송을 보낸 뒤 자국 순찰선과 대치했다고 밝혔다. 동북아시아연합 외교부는 해당 해역에 대한 자국의 관할권을 주장했다.',
      '두 항만의 관제 당국은 상선 8척에 우회를 권고했다. 보험중개업체들은 추가 항해 시간이 길게는 14시간에 이를 것으로 봤다.'),
    edition('Japanese and Northeast Asian Union patrols face off near contested islands',
      'Japan said three Northeast Asian Union patrol boats confronted one of its vessels off the Blue Shoals islands. The Northeast Asian Union’s foreign ministry asserted jurisdiction over the waters.',
      'Port controllers advised eight cargo ships to divert. Marine insurance brokers estimated the longer route could add as much as 14 hours to a voyage.'),
    'hostile',{JPY:-.005,CNY:-.004},'international'),
  dispatch('arden-wire',['arden','mora'],{ARC:.022,BMEM:.006},
    edition('노스스타 이사회, CTO를 직무대행에 임명…생산 주문 유지',
      '노스스타 이사회는 기술총괄 미라 베넷을 CEO 직무대행으로 선임했다. 회사는 계약한 웨이퍼 3만 장의 생산 주문을 유지하겠다고 밝혔다.',
      '신제품 공개 일정은 다시 정하기로 했다. 회사에 따르면 지난 분기 주문의 약 31%가 차세대 제품과 직접 관련돼 있다.'),
    edition('Northstar names technology chief acting CEO, keeps wafer order',
      'Northstar’s board appointed chief technology officer Mira Bennett as acting chief executive. The company said it would keep its order for 30,000 wafers in place.',
      'A date for the rescheduled product launch has yet to be set. Northstar said about 31% of orders last quarter were tied directly to the next-generation product.')),
  dispatch('arden-wire',['chai','lumen','mora'],{RTKW:-.036,NORD:.039,VOLT:-.011,MDRA:.014,KAON:.026},
    edition('동북아시아연합·유럽연합 국경전 발발…북방 가스관 공급 35% 급감',
      '유럽연합 내무부는 동북아시아연합군이 동부 국경을 넘어와 두 나라 군대가 교전에 들어갔다고 발표했다. 동북아시아연합 정부는 국경 지역의 충돌을 인정했으나 양국의 설명은 엇갈린다.',
      '송출 운영사에 따르면 국경을 지나는 가스관의 공급은 전날보다 35% 줄었다. 유럽연합 산업부는 공장에 공급하던 비축분 중 하루치 물량을 긴급 배정했다.'),
    edition('War breaks out on the frontier between the Northeast Asian and European unions; pipeline flows tumble',
      'The European Union said Northeast Asian Union forces had crossed its eastern border and that the two armies were engaged. The Northeast Asian Union confirmed fighting in the border area but disputed the European Union’s account.',
      'The pipeline operator said gas flows were down 35 per cent from the previous day. The European Union’s industry ministry made one day’s worth of industrial reserves available.'),
    'hostile',{EUR:-.007,GBP:.003},'international'),
  dispatch('mora-daily',['mora'],{DHCP:.006},
    edition('물결금융 대표 직무 정지…감사위, 입찰 기록 보전 요청',
      '물결금융 이사회가 20일 새벽 강도현 대표의 직무를 정지했다. 금융당국에는 감사위원회가 검토 중인 협력사 계약 두 건의 목록을 제출했다.',
      '이사회는 고객 예금 인출과 자금 집행이 평소대로 진행된다고 밝혔다. 협력사에 남은 계약 대금 19억 원은 감사가 끝날 때까지 보류했다.')),
  dispatch('chai-news',['haeon','chai','mora'],{CORL:-.021,JHMI:-.018,WJBT:-.01,MOON:.008},
    edition('일본·동북아시아연합, 통관 창구 두 곳 폐쇄…배터리 소재 반입 지연',
      '청람열도에서 양국 순찰선이 물러난 뒤에도 일본과 동북아시아연합은 상대국 화물의 일부 통관을 중단했다. 현지 무역업계 집계로 반입 대기 화물은 63건이다.',
      '일본 세이와소재는 재고로 약 나흘간 생산할 수 있다고 밝혔다. 한국 한칸전지는 달밤물류에 대체 항로의 운임을 문의했다.'),
    edition('Japan and the Northeast Asian Union suspend cargo clearance at two ports',
      'Japan and the Northeast Asian Union paused some customs clearance after patrol vessels pulled back from the Blue Shoals. A trade association put the backlog at 63 consignments.',
      'Seiwa Materials said it had roughly four days of stock on hand. South Korea’s OneCell Battery asked a freight forwarder to price an alternative route.'),
    null,{},'international'),
  dispatch('arden-wire',['arden'],{BIT:-.017,ETH:-.031,VXPM:-.013},
    edition('미국 코인 거래소 출금 멈춰…고객 1만 4천 명 대기',
      '미국의 민간 코인 거래소 베이루프가 이더리움 출금을 중단했다. 거래소는 중복 요청을 발견해 지갑 간 이체를 잠갔다고 공지했다.',
      '요청이 밀린 계정은 1만 4천 개다. 베이루프는 매매 체결은 계속하고 있으며 예치자산의 손실 여부는 조사 중이라고 밝혔다.'),
    edition('Bayloop pauses ether withdrawals for 14,000 customers',
      'US exchange Bayloop suspended ether withdrawals after detecting duplicate requests. The exchange said trading was still available.',
      'About 14,000 accounts were awaiting withdrawals. Bayloop said it was still checking whether any customer assets had been lost.'),
    null,{},'market'),
  dispatch('arden-wire',['arden','mora'],{ARC:.018,BMEM:.01},
    edition('노스스타 최대 고객 두 곳, 주문 유지 확인…미납 물량은 재협상',
      '노스스타의 서버 고객 두 곳이 기존 구매확약 물량을 유지한다고 밝혔다. 두 회사가 이미 낸 선급금은 합계 1억 2천만 달러다.',
      '아직 인수 검사를 거치지 않은 물량은 재협상 대상에 남았다. 백산칩은 당초 합의한 첫 선적은 진행한다고 공시했다.'),
    edition('Two key Northstar customers keep orders after CEO succession',
      'Two Northstar server customers said they were keeping their existing purchase commitments. They had together paid $120 million in advances.',
      'Units that have yet to pass acceptance testing remain subject to negotiation. Memory supplier Baeksan said its initial shipment would go ahead.')),
  dispatch('arden-wire',['chai','lumen','mora'],{RTKW:.008,NORD:-.013,VOLT:.006},
    edition('북방 국경전, 중재 회담 제안…가스 현물가 상승폭 일부 반납',
      '한국 외교부가 동북아시아연합과 유럽연합에 중립 지역에서의 회담을 제안했다. 양국 모두 회담 일정을 확정하지 않은 상태다.',
      '중재안 공개 뒤 유럽연합 가스 현물가가 고점에서 4%가량 내렸다. 송출 운영사는 가스관 공급에 당장 변화가 없다고 공지했다.'),
    edition('South Korea proposes talks as frontier war strains European gas supply',
      'South Korea proposed talks on neutral ground to the Northeast Asian Union and the European Union. Neither government had confirmed a negotiating date at publication.',
      'European spot gas fell about 4 per cent from its peak after the proposal. The pipeline operator reported no immediate change in volumes.'),
    null,{},'international'),
  dispatch('workday',['mora'],{DHCP:-.018},
    edition('감사위, 물결금융 협력사에 납품 단가 자료 추가 요청',
      '감사위원회는 물결금융 협력사의 위탁수수료가 같은 기간 유사한 계약보다 17% 높았다고 보고했다. 차이가 발생한 이유는 추가 확인이 필요하다고 설명했다.',
      '강 전 대표 측 대리인은 설비 교체와 야간 근무 비용이 반영됐다며 특혜 의혹을 부인했다. 차기 이사회는 감사 보고서를 의결할 예정이다.')),
  dispatch('haeon-post',['haeon','chai'],{CORL:.015,JHMI:.014,ASMZ:.011},
    edition('일본·동북아시아연합, 청람열도 통관 재개…임시 항행선 합의',
      '일본과 동북아시아연합은 분쟁 해역에서 하루 20척까지 통항을 허용하는 임시 항행선을 정했다. 적체된 수입 화물은 원래 통관 순번대로 처리한다.',
      '양국은 해역의 최종 경계를 추후 회담 안건으로 남겼다. 항만업계는 통관은 재개돼도 체선료 정산에는 시간이 걸릴 것으로 봤다.'),
    edition('Japan and the Northeast Asian Union reopen cargo lanes under interim agreement',
      'Japan and the Northeast Asian Union agreed an interim route for up to 20 ships a day near the Blue Shoals. Ports are to clear the backlog in its original customs order.',
      'Final demarcation remains on the agenda for later talks. Port operators expect demurrage bills to take longer to settle.'),
    'neutral',{JPY:.004,CNY:.003},'international'),
  dispatch('arden-wire',['chai','lumen','mora'],{RTKW:.023,NORD:-.021,VOLT:.008,KAON:-.014},
    edition('동북아시아연합·유럽연합, 48시간 휴전…가스관 점검은 아직',
      '동북아시아연합과 유럽연합이 국제 중재단의 제안에 따라 48시간 휴전에 합의했다. 중재단은 재개 여부를 확인할 회의를 내일 연다고 밝혔다.',
      '국경을 가로지르는 가스관 두 곳의 안전 점검은 시작되지 않았다. 유럽연합 가스 거래소는 정규장 공급 공지가 나올 때까지 변동성 제한 폭을 유지했다.'),
    edition('The Northeast Asian Union and the European Union agree 48-hour ceasefire; pipeline checks pending',
      'The Northeast Asian Union and the European Union agreed to stop fighting for 48 hours under a proposal from mediators, who said they would meet again the following day.',
      'Safety inspections are still pending on two pipelines crossing the border. The European Union’s exchange left its volatility controls in place pending a supply update.'),
    'neutral',{EUR:.003},'international'),
];

const desks=[
  ['mora-daily','백산칩','Baeksan Chips','BMEM',['mora','arden'],'반도체 검사 장비','chip test equipment','공급 계약','supply contracts'],
  ['arden-wire','레드우드','Redwood Devices','RWDV',['arden','mora'],'스마트기기 부품','device components','부품 구매 계약','purchase contracts'],
  ['workday','세림조선','Serim Shipyards','SLYD',['mora','haeon'],'친환경 선박 장비','marine equipment','선박 장비 계약','equipment contracts'],
  ['haeon-post','아사미즈','Asamizu Electronics','ASMZ',['haeon','mora'],'정밀 센서','precision sensors','센서 납품 계약','sensor contracts'],
  ['mora-daily','한칸전지','OneCell Battery','WJBT',['mora','chai'],'전지 소재','battery materials','공급 계약','supply contracts'],
  ['arden-wire','대시 EV','대시 EV','HZMA',['arden','mora'],'충전 모듈','charging modules','충전망 납품 계약','charging contracts',['electrical-equipment']],
  ['arden-wire','노스미어','Northmere Energy','NORD',['lumen','mora'],'가스 저장용량','gas storage capacity','저장 계약','storage contracts'],
  ['workday','온누리텔레콤','Onnuri Telecom','ONTL',['mora'],'데이터센터 전력','data-centre power','전력 계약','power contracts',['data-centers']],
  ['arden-wire','메리디언 에어로','Meridian Aero','MDRA',['arden','lumen'],'항공기 부품','aircraft components','장비 납품 계약','equipment contracts'],
  ['mora-daily','맑음제약','Clearday Pharma','YJRX',['mora','vietlan'],'위탁생산 물량','contract production','생산 계약','production contracts'],
  ['chai-news','구모토 자동차','Kumoto Motors','KMTD',['haeon','chai'],'전장부품','vehicle electronics','핵심 부품 계약','parts contracts'],
  ['arden-wire','클릭파인드','클릭파인드','ALTQ',['arden','lumen'],'기업용 광고 물량','enterprise ad inventory','장기 광고 계약','advertising contracts'],
  ['workday','대영식품','Daeyoung Foods','DYFD',['mora','vietlan'],'식품 냉장 물량','chilled foods','냉장 배송 계약','shipping contracts'],
  ['mora-daily','솔빛에너지','Solbit Energy','SBEN',['mora','lumen'],'배전설비','distribution equipment','설비 납품 계약','distribution contracts'],
  ['arden-wire','쿼리 파워','쿼리 파워','QRGR',['arden'],'변전소 설비','substation equipment','유지보수 계약','maintenance contracts'],
  ['workday','금강정밀','Geumgang Precision','GGPM',['mora','chai'],'공정 장비','fabrication equipment','장비 인도 계약','equipment contracts'],
];

const developingStories=[
  ['arden-wire','RWDV',['arden','haeon'],'레드우드','Redwood','신형 단말기 리콜','device recall','배터리 결함','battery fault'],
  ['workday','SLYD',['mora','haeon'],'세림조선','Serim Shipyards','조선소 조업 중단','shipyard stoppage','협력사 작업 중단','a contractor shutdown'],
  ['mora-daily','DHCP',['mora'],'물결금융','Tideway Finance','감사 자료 유출','leaked audit documents','위탁계약 심사','a review of outsourcing contracts'],
  ['arden-wire','VXPM',['arden'],'버텍스','Vertex Payments','카드 승인 장애','payment outage','승인 시스템 고장','a processor fault'],
  ['haeon-post','KMTD',['haeon','chai'],'구모토','Kumoto Motors','부품 공급 차질','parts shortage','전장부품 지연','a delay in electronic components'],
  ['mora-daily','YJRX',['mora','vietlan'],'맑음제약','Clearday Pharma','수출 허가 보류','export approval setback','품질 심사 연장','an extended quality review'],
  ['arden-wire','NORD',['lumen'],'노스미어','Northmere Energy','가스 선적 중단','halt to gas loadings','항만 터미널 정비','maintenance at the export terminal'],
  ['arden-wire','BWSC',['arden'],'브레이크워터','Breakwater','고객사 정보 유출 조사','customer data inquiry','고객사 접근기록 이상','irregular access records'],
];
function developing(n){
  const episode=Math.floor(n/12),phase=n%12;
  const [outlet,code,countries,name,english,topic,enTopic,cause,enCause]=developingStories[episode%developingStories.length];
  const count=2+(episode*13)%17,minutes=15+Math.floor(episode/3)%9*5;
  const stages=[
    [name+' '+topic+'…관련 계약 '+count+'건 점검','이사회는 '+cause+' 관련 통지를 접수했다고 밝혔다. 회사가 확인 중인 계약은 '+count+'건이고, 그중 일부의 이행 시각이 밀릴 수 있다.',
     english+' reviews '+count+' contracts after '+enTopic,'The board said it had received a notice concerning '+enCause+'. It is reviewing '+count+' contracts, some of which may be delayed.'],
    [name+', '+topic+' 후속 공시…고객사에 일정 통보','회사는 해당 계약의 고객사에 1차 진행 상황을 통지했다. 다음 확인은 공지 '+minutes+'분 뒤이며, 확정된 손실액은 공개하지 않았다.',
     english+' notifies clients in update on '+enTopic,'The company notified affected customers of the first findings. Another check is due '+minutes+' minutes after the notice. It has not given a confirmed loss figure.'],
    [name+', '+topic+' 영향 일부 해소…잔여 건 별도 관리','회사 측은 확인 대상 '+count+'건 중 '+Math.max(1,Math.floor(count*.65))+'건을 정상 처리했다고 밝혔다. 남은 건은 보상이나 인도 일정을 고객별로 협의 중이다.',
     english+' clears part of backlog linked to '+enTopic,'The company said it had cleared '+Math.max(1,Math.floor(count*.65))+' of the '+count+' contracts under review. It is negotiating compensation or delivery dates on the remainder.']
  ];
  const [title,body,head,en]=stages[phase];
  return {...dispatch(outlet,countries,{[code]:[-.012,-.003,.009][phase]},
    edition(title,body),reportingOutlet(outlet,countries).lean==='해외'?edition(head,en):null),
    urgent:phase===0,development:{id:'developing-'+episode,version:phase+1}};
}
function routine(slot){
  const n=slot-leadDesk.length, cycle=Math.floor(n/desks.length);
  if(n%12<3)return developing(n);
  const [outlet,name,english,code,countries,goods,enGoods,contract,enContract,industryIds]=desks[(n+cycle*3)%desks.length];
  const number=3+(slot*13+cycle*7)%29, sign=(Math.imul(slot+19,1597334677)>>>29)<4?1:-1;
  const variants=[
    [name+', '+goods+' 출하 '+number+'% '+(sign>0?'증가':'감소'),
     name+'은 직전 발표 대비 '+goods+' 출하량이 '+number+'% '+(sign>0?'늘었다':'줄었다')+'고 밝혔다. 출하 확인을 마친 납품만 포함한 수치다.',
     english+' shipments '+(sign>0?'rise ':'fall ')+number+'%',
     english+' said shipments of '+enGoods+' '+(sign>0?'increased':'decreased')+' by '+number+'% from its prior report. The figure covers dispatched goods only.'],
    [name+', '+contract+' '+number+'건 '+(sign>0?'확정':'연기'),
     name+'은 고객사에 '+contract+' '+number+'건을 '+(sign>0?'확정':'연기')+'한다고 통지했다. 선급금과 잔금은 각 계약서에 정한 인도 조건에 맞춰 들어온다.',
     english+' '+(sign>0?'confirms ':'delays ')+number+' '+enContract,
     english+' told its customers it had '+(sign>0?'confirmed ':'delayed ')+number+' '+enContract+'. Deposits and final payments remain subject to the delivery terms.'],
    [name+', '+goods+' 주문 전망 '+number+'% '+(sign>0?'상향':'하향'),
     name+'이 '+goods+'의 주문 전망을 '+number+'% '+(sign>0?'올렸다':'낮췄다')+'. 회사는 예상 발주를 집계했으며 계약을 맺은 물량은 별도로 확인한다고 밝혔다.',
     english+' '+(sign>0?'raises ':'cuts ')+'order outlook by '+number+'%',
     english+' '+(sign>0?'raised':'cut')+' its order outlook for '+enGoods+' by '+number+'%. The projection counts potential bookings, with signed orders recorded separately.'],
  ];
  const variant=(cycle+slot)%variants.length;
  const [title,body,head,englishBody]=variants[variant];
  const en=reportingOutlet(outlet,countries).lean==='해외';
  const raw=dispatch(outlet,countries,{[code]:sign*(.0006+number*.00012)},edition(title,body),
    en?edition(head,englishBody):null);
  return {...raw,industryIds,operatingDisclosure:{code,type:['shipment','contract','outlook'][variant],quantity:number,sign}};
}

function dispatchEvent(id,tick,raw,urgent){
  const event={id,day:Math.floor(tick/288),tick,minute:(tick%288)*5,urgent,
    shock:raw.shock,fx:raw.fx,diplomacy:raw.diplomacy,countries:raw.countries,newsCategory:raw.newsCategory};
  if(tick>=crossMarketStart&&!raw.editorialOnly){
    const disruption=urgent&&['war','earthquake','disaster','death'].includes(raw.category)?-.018:0;
    for(const issuer of raw.related){
      const link=tradeLinks[issuer];
      if(!link)continue;
      const [partner,weight]=link,move=(raw.shock[issuer]??disruption)*weight;
      if(!move||Object.hasOwn(raw.shock,partner))continue;
      if(event.shock===raw.shock)event.shock={...raw.shock};
      event.shock[partner]=(event.shock[partner]||0)+move;
    }
  }
  if(raw.operatingDisclosure)event.operatingDisclosure=raw.operatingDisclosure;
  if(raw.industryIds)event.industryIds=raw.industryIds;
  if(raw.category)event.incident=raw.category;
  if(raw.development)event.development=raw.development;
  if(raw.editorialOnly)event.editorialOnly=true;
  const outletInfo=reportingOutlet(raw.outlet,raw.countries);
  const original=raw.en??raw.ko;
  event.stories=[{...original,title:raw.ko.title,id:event.id+'-0',event,outlet:outletInfo.id,outletInfo,
    lang:raw.en?'en':'ko',ko:raw.ko,en:raw.en,countries:raw.countries,related:raw.related}];
  return event;
}
// Subsequent dispatches report changes to these specific cases.
const leadDevelopments=[
  ['northstar-succession',1],['donghae-inquiry',1],['shoals-patrol',1],
  ['northstar-succession',2],['northern-pipeline',1],['donghae-inquiry',2],
  ['shoals-patrol',2],null,['northstar-succession',3],['northern-pipeline',2],
  ['donghae-inquiry',3],['shoals-patrol',3],['northern-pipeline',3],
];
const cache=new Map();
function eventAt(tick){
  if(tick<wireStart||!Number.isInteger(tick))return null;
  if(cache.has(tick))return cache.get(tick);
  const slot=tick-wireStart;
  const raw=leadDesk[slot]??routine(slot);
  const event=dispatchEvent('dispatch-'+tick,tick,raw,slot<leadDesk.length||raw.urgent===true);
  const development=leadDevelopments[slot];
  if(development)event.development={id:development[0],version:development[1]};
  if(cache.size>=950)cache.delete(cache.keys().next().value);
  cache.set(tick,event);
  return event;
}
const incidentCache=new Map();
function incidentStory(tick){
  if(incidentCache.has(tick))return incidentCache.get(tick);
  const report=scheduledIncident(tick);
  const story=report?dispatchEvent('incident-'+tick,tick,report,report.urgent).stories[0]:null;
  if(incidentCache.size>=950)incidentCache.delete(incidentCache.keys().next().value);
  incidentCache.set(tick,story);
  return story;
}
export function incidentImpacts(after,through){
  const events=[];
  for(let tick=Math.max(crossMarketStart,Math.floor(after)+1);tick<=through;tick++){
    const event=incidentStory(tick)?.event;
    if(event&&Object.keys(event.shock).length)events.push(event);
  }
  return events;
}
export function wireBetween(after,through){
  const first=Math.max(wireStart,Math.floor(after)+1),last=Math.floor(through);
  return Array.from({length:Math.max(0,last-first+1)},(_,i)=>eventAt(first+i));
}
export function firstEdition(through){return wireBetween(wireStart-1,Math.min(through,wireStart+leadDesk.length-1));}
function additionalStory(event){
  const slot=event.tick-wireStart-leadDesk.length;
  if(slot<0||slot%12<3)return null;
  const followUp=policyFollowUp(event);
  if(!followUp)return null;
  const [outlet,title,analysis]=followUp,main=event.stories[0];
  const ko=edition(title,main.ko.body[0],analysis);
  const outletInfo=reportingOutlet(outlet,main.countries);
  return {...main,...ko,id:event.id+'-1',outlet:outletInfo.id,outletInfo,ko,newsCategory:'politics'};
}
// Desk coverage fills quiet editions before the continuous wire begins.
export function deskBrief(issue,tick){
  for(let n=issue*13;;n++){
    if(n%12<3)continue;
    const raw=routine(leadDesk.length+n);
    const story=dispatchEvent('brief-'+issue,tick,{...raw,shock:{},editorialOnly:true},false).stories[0];
    if(isPublishedStory(story))return story;
  }
}
export function visibleWireStories(after,through){
  return wireBetween(after,through).flatMap(event=>{
    const incident=incidentStory(event.tick),extra=additionalStory(event);
    // On a shared publication time the incident leads in the home ticker and the stand.
    return [incident,...event.stories,extra].filter(Boolean);
  });
}
export function archivedBulletin(id,tickLimit){
  const match=/^(dispatch|incident)-(\d+)-([01])$/.exec(id);
  if(!match)return null;
  const [,kind,number,edition]=match,tick=Number(number);
  if(!Number.isSafeInteger(tick)||!(tick<=tickLimit))return null;
  if(kind==='incident')return edition==='0'?incidentStory(tick):null;
  const event=eventAt(tick);
  if(!event)return null;
  return edition==='1'?additionalStory(event):event.stories[0];
}
const stanceChanges=[
  ...leadDesk.map((entry,index)=>[wireStart+index,entry]).filter(([,entry])=>entry.diplomacy),
  ...incidentStanceChanges,
].sort(([a],[b])=>b-a);

export function incidentStance(a,b,now){
  const left=canonicalCountry(a),right=canonicalCountry(b);
  if(!left||!right||left===right)return null;
  for(const [tick,{countries:[first,second],diplomacy}] of stanceChanges){
    if(tick<=now&&((left===first&&right===second)||(left===second&&right===first)))return diplomacy;
  }
  return null;
}
