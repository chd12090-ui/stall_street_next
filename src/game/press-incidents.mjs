import {stocks,symbolIndex} from './securities-data.mjs';
import {canonicalCountry,countries} from './atlas-data.mjs';

const edition=([title,...body])=>({title,body,lead:body[0]});
function report(category,outlet,countries,related,ko,en=null,urgent=true){
  return {category,outlet,countries:countries.map(canonicalCountry),related,ko:edition(ko),en:en&&edition(en),urgent,shock:{},fx:{},diplomacy:null};
}

function hostilities(outlet,countries,related,ko,en){
  return {...report('war',outlet,countries,related,ko,en),diplomacy:'hostile'};
}

// The market calendar begins at 09:00 KST. These are extra editions on the existing tape.
const openingTick=4*288+120; // 2026-11-20 19:00 KST
const specialReports=new Map([
  [0,report('earthquake','haeon-post',['haeon'],['KMTD','ASMZ'],[
    '일본 규모 7.2 지진…구모토·아사미즈 공장 멈췄다',
    '일본 동해안에서 규모 7.2 지진이 발생했다. 구모토 자동차는 동부 조립공장 두 곳을 비웠고, 아사미즈 전자는 센서 생산동의 가동을 멈췄다고 밝혔다.',
    '구모토는 출고장에 있던 차량 3,800대의 선적을 미뤘다. 아사미즈의 해외 출하량은 정전이 발생한 생산동의 재가동 시점에 달려 있다.'
  ],[
    'Magnitude 7.2 quake halts Japanese car and sensor plants',
    'A magnitude 7.2 earthquake struck Japan’s eastern coast. Kumoto Motors evacuated two assembly plants, and Asamizu Electronics shut its sensor factory.',
    'Kumoto postponed shipments of 3,800 finished vehicles. Asamizu said export schedules depended on when power could be restored to its production building.'
  ])],
  [2,report('affair','arden-wire',['arden'],['MDRA'],[
    '메리디언 에어로 CEO 불륜 의혹…이사회, 7300만 달러 계약 조사',
    '메리디언 에어로 감사위원회가 마렌 벡 CEO와 협력사 대표의 불륜 의혹에 대한 조사를 시작했다. 위원회는 해당 업체가 경쟁 입찰 없이 따낸 7,300만 달러 정비 계약도 들여다보고 있다.',
    '벡 CEO는 계약을 자신이 지시했다는 주장을 부인했다. 이사회는 첫 지급을 보류하고 계약 승인 당시의 회의록을 제출받기로 했다.'
  ],[
    'Meridian Aero board probes CEO affair allegation and $73m contract',
    'Meridian Aero’s audit committee opened an inquiry into allegations that CEO Maren Beck had an affair with a supplier’s chief. It is also reviewing a $73 million maintenance deal awarded without a competitive bid.',
    'Beck denied directing the award. Directors held back the first payment and requested the minutes from the meeting where the contract was approved.'
  ])],
  [4,hostilities('chai-news',['chai','vietlan'],['DHDG','SVHT'],[
    '동북아시아연합, 동남아시아연합에 선전포고…접경 화물 통관 전면 중단',
    '동북아시아연합 정부가 산악 접경에서의 충돌을 이유로 동남아시아연합에 선전포고했다. 동남아시아연합 외교부는 교섭단을 철수시켰고, 양국 통관 당국은 접경 화물 터미널 세 곳을 닫았다.',
    '둥후디지털은 동남아시아연합으로 향하던 자동화 설비를 창고로 돌렸다. 동남아시아연합 사비타 헬스케어는 접경에 묶인 의약품 원료를 해상으로 다시 조달할 수 있는지 확인 중이다.'
  ],[
    'The Northeast Asian Union declares war on the Southeast Asian Union; border freight stops',
    'The Northeast Asian Union declared war on the Southeast Asian Union after clashes along the mountain frontier. The Southeast Asian Union recalled its negotiators, and customs authorities closed three freight terminals.',
    'Donghu Digital diverted factory equipment bound for the Southeast Asian Union to storage. Savita Healthcare is checking whether it can replace stranded pharmaceutical ingredients by sea.'
  ])],
  [6,report('death','mora-daily',['mora'],['ONTL'],[
    '온누리텔레콤 창업 CEO 사망…신규 데이터센터 발표 취소',
    '온누리텔레콤은 창업자인 류하겸 CEO가 응급 이송된 뒤 병원에서 사망했다고 밝혔다. 이사회는 다음 날 예정됐던 6,200억 원 규모 데이터센터 투자 발표를 취소했다.',
    '장애 대응과 기존 통신 서비스는 계속된다. 투자 안건의 재상정 여부는 직무대행 선임 뒤 결정될 예정이다.'
  ])],
  [8,report('social','workday',['mora'],['SGMO'],[
    '세광모터스 CEO, 결함 신고한 차주 SNS서 비난…공동구매 4천 대 철회',
    '세광모터스 차민호 CEO가 제동장치 결함을 신고한 차주들을 SNS에서 “조회수를 노린다”고 비난했다. 게시물이 퍼지자 전기차 동호회 네 곳이 4,000대 규모 공동구매를 철회했다.',
    '회사는 게시물을 내리고 제동장치를 외부 기관에서 다시 검사하겠다고 밝혔다. 이미 계약금을 낸 차주에게는 수수료 없이 환불하기로 했다.'
  ])],
  [10,report('fraud','nubo-econ',['mora'],['GGPM'],[
    '금강정밀서 640억 횡령 정황…재무실장 체포',
    '한국 금융수사청은 금강정밀 재무실장이 회사 자금 640억 원을 횡령한 혐의로 체포됐다고 밝혔다. 금강정밀은 직전 발표의 현금 잔액을 다시 검증하고 있다.',
    '이사회는 장비 공장 증설에 쓰기로 한 계약금의 집행을 멈췄다. 외부 감사팀이 거래 내역을 대조한 뒤 확정 손실액을 공시할 예정이다.'
  ])],
  [11,report('disaster','arden-wire',['arden','kanora'],['HARB','QRGR'],[
    '허리케인 베라에 미국 17만 가구 정전…웨일라인 출항 중단',
    '허리케인 베라가 미국 동부에 상륙해 17만 가구에 전기가 끊겼다. 웨일라인은 해안 터미널이 닫히자 북아메리카연합행 화물선 세 편을 취소했다.',
    '쿼리 파워는 침수된 변전소 스위치기어를 교체할 예비 설비를 보내고 있다. 항만은 예비전원이 들어오기 전까지 냉장 컨테이너 신규 반입을 받지 않는다.'
  ],[
    'Hurricane Vera cuts power to 170,000 homes, closes freight terminal',
    'Hurricane Vera hit the eastern coast of the United States, cutting power to 170,000 homes. 웨일라인 cancelled three sailings to the North American Union after its coastal terminal closed.',
    '쿼리 파워 sent equipment to replace flooded substation switchgear. The terminal paused new refrigerated deliveries until backup power could be restored.'
  ])],
  [20,report('death','mora-daily',['mora'],['ONTL'],[
    '온누리텔레콤, 창업 CEO 별세 뒤 통신망 본부장을 직무대행에',
    '온누리텔레콤 이사회는 류하겸 창업자의 별세 이후 통신망 본부장 이수연을 임시 최고경영자로 선임했다. 이 본부장은 통신망 유지보수와 투자 발표가 취소된 데이터센터의 계약을 함께 점검한다.'
  ],null,false)],
  [24,report('war','chai-news',['chai','vietlan'],['DHDG','SVHT'],[
    '동북아시아연합 선전포고 뒤 접경 항공편도 끊겨…동남아시아연합, 의약품 원료 비축분 방출',
    '동북아시아연합과 동남아시아연합 사이 여객기에 탑재하던 소형 화물도 운송이 끊겼다. 동남아시아연합 사비타 헬스케어는 보건부가 배정한 비축분으로 생산을 이어가며, 둥후디지털은 인도 예정 설비의 보관료를 청구하지 않기로 했다.'
  ],[
    'Border flights stop after declaration of war; the Southeast Asian Union taps medicine reserves',
    'Small shipments carried on passenger flights between the Northeast Asian Union and the Southeast Asian Union have also stopped. Savita Healthcare will draw on health ministry reserves to keep producing medicines, while Donghu Digital waived storage charges on stranded equipment.'
  ],false)],
  [7*288+7,report('death','arden-wire',['vietlan'],['SVHT'],[
    '사비타 헬스케어 CEO 급서…20억 루피 공장 인수 표결 연기',
    '동남아시아연합 사비타 헬스케어는 라빈 도하르 CEO가 지병으로 병원에서 사망했다고 공시했다. 이사회는 신임 직무대행을 뽑을 때까지 20억 루피 규모의 공장 인수 표결을 미뤘다.',
    '인수 대상 공장은 기존 위탁생산 계약을 이어간다. 다음 달 만료되는 매매 우선협상권의 연장 여부는 확정되지 않았다.'
  ],[
    'Savita Healthcare CEO dies; board delays vote on ₹2bn plant deal',
    'Savita Healthcare said its chief executive, Ravin Dohar, died in hospital after an illness. The board postponed a vote on a ₹2 billion factory acquisition pending the appointment of an interim chief.',
    'The factory will continue to fill existing production orders. The parties have yet to extend exclusive talks beyond their scheduled expiry next month.'
  ])],
  [8*288+15,hostilities('arden-wire',['arden','kanora'],['JNFD','WFBK'],[
    '미국, 북아메리카연합에 선전포고…식품 화물 선적 허가 중단',
    '미국 정부가 북아메리카연합에 선전포고하고 북아메리카연합행 식품 화물의 선적 허가를 중단했다. 북아메리카연합 정부는 두 나라 정기 항공편의 운항 중단을 통지했다.',
    '주니퍼 푸즈는 출항을 앞둔 식품 1,900톤을 내수로 돌리기로 했다. 필드라인는 해당 선적에 연결된 대금 결제를 보류하고 계약별 규정을 검토 중이다.'
  ],[
    'The United States declares war on the North American Union and halts food shipment permits',
    'The United States declared war on the North American Union and suspended permits for food shipments. The North American Union notified carriers that scheduled flights between the countries were suspended.',
    'Juniper Foods is redirecting 1,900 tonnes of export cargo to domestic buyers. Fieldline Bank suspended settlement on affected shipments while reviewing individual contracts.'
  ])],
  [18*288+9,report('death','nubo-econ',['mora'],['SBEN'],[
    '솔빛에너지 CEO 출장 중 사망…변전소 두 곳 계약 서명 연기',
    '솔빛에너지는 유라겸 CEO가 출장 중 사고로 사망했다고 밝혔다. 회사는 공동 대표 체제로 일정을 이어가되, 새로 짓는 변전소 두 곳의 설비 계약 서명은 임시 이사회 이후로 미뤘다.',
    '이미 공사에 들어간 세 곳의 현장에는 계획대로 장비를 공급한다고 회사 측은 덧붙였다.'
  ])],
  [23*288+19,hostilities('chai-news',['chai','arden'],['DHDG','IRPK'],[
    '동북아시아연합·미국 군사 회담 결렬…동북아시아연합 선전포고',
    '중재국은 동북아시아연합과 미국의 군사 회담이 합의 없이 끝났다고 밝혔다. 동북아시아연합 정부는 곧이어 선전포고를 발표하고 미국으로 나갈 공장 자동화 설비의 수출 허가를 모두 중단했다.',
    '둥후디지털은 선적 대기 중인 컨테이너 31개를 창고로 돌렸다. 미국 아이언피크 로보틱스는 동북아시아연합산 장비를 들이기로 한 고객사 세 곳과 대체 설비 검증을 시작했다.'
  ],[
    'The Northeast Asian Union declares war on the United States after military talks fail',
    'Mediators said military talks ended without agreement. The Northeast Asian Union declared war on the United States and suspended all permits for factory automation equipment bound for the country.',
    'Donghu Digital moved 31 containers waiting for shipment back to storage. US company Ironpeak Robotics began testing replacement equipment with three affected customers.'
  ])],
]);

function fraud(cycle,phase){
  const code=['DHCP','GGPM','WJBT','YJRX','MRGM','SBEN','ONTL','DYFD'][cycle%8];
  const {name}=stocks[symbolIndex[code]],amount=270+(cycle*37)%720;
  const headlines=[`${name}, ${amount}억 횡령 혐의로 압수수색`,`${name} 감사위, 횡령 의심 송금 내역 확보`,`${name}, 횡령 수사 여파에 신규 투자 보류`];
  const copy=[
    `검찰은 ${name}에서 ${amount}억 원어치 회사 자금이 사라졌다는 신고를 받고 회계 자료를 확보했다. 이사회는 자금 집행 결재권을 감사위원회로 넘겼다.`,
    `${name} 감사위원회는 수사 대상 금액 ${amount}억 원과 연결된 송금을 추려 수사기관에 냈다. 회수 가능 금액은 아직 정해지지 않았다.`,
    `${name}은 차기 설비 투자에 배정된 자금을 동결했다. 수사 대상 ${amount}억 원을 실제 손실로 얼마나 반영할지는 외부 감사 결과에 달렸다.`
  ];
  return report('fraud','nubo-econ',['mora'],[code],[headlines[phase],copy[phase]],null,phase===0);
}

function boycott(cycle,phase){
  const code=['SGMO','MART','MRGM','DYFD','ONTL'][cycle%5];
  const {name}=stocks[symbolIndex[code]],count=900+(cycle*231)%3700;
  const groupCount=count.toLocaleString('ko-KR');
  const headlines=[`${name} CEO SNS 비난에 고객 ${groupCount}명 취소 신청`,`${name} 이사회, 취소 요청 ${groupCount}건에 CEO 해명 요구`,`${name}, 항의 고객 ${groupCount}건 환불 착수`];
  const copy=[
    `${name} CEO가 상품 문제를 제보한 고객을 개인 SNS에서 공개 비난했다. 소비자 모임은 게시물이 퍼진 뒤 취소 신청자 ${groupCount}명을 모아 회사에 전달했다.`,
    `${name} 이사회는 소비자 제보를 두고 올린 글의 작성 경위와 사후 대응을 보고하라고 CEO에게 요구했다. 고객센터에는 항의 접수와 결제 취소 기록을 따로 집계하라고 요청했다.`,
    `${name}은 비난 게시물 이후 접수된 취소 신청 ${groupCount}건의 환불 절차를 시작했다. 회사는 새 고객을 모으던 광고도 모든 온라인 채널에서 중단했다.`
  ];
  return report('social','workday',['mora'],[code],[headlines[phase],copy[phase]],null,phase===0);
}

const faultRegions=[
  ['KMTD','일본 시라세 해안','Japan’s Shirase coast','haeon-post'],
  ['DHDG','동북아시아연합 츠윈 계곡','the Tsuyun valley in the Northeast Asian Union','chai-news'],
  ['ASMZ','일본 하나사키만','Japan’s Hanasaki Bay','haeon-post'],
  ['RTKW','유럽연합 발트루프 분지','the Waltruf basin in the European Union','arden-wire'],
  ['SVHT','동남아시아연합 루파 언덕','the Rupa Hills in the Southeast Asian Union','arden-wire'],
  ['TIDE','일본 기리오 평야','Japan’s Kirio plain','haeon-post'],
  ['CORL','일본 도요라 반도','Japan’s Toyora peninsula','haeon-post'],
  ['IRPK','미국 하이마치 계곡','the Highmarch valley in the US','arden-wire'],
];
function quake(cycle,phase){
  const [code,place,english,outlet]=faultRegions[cycle%faultRegions.length];
  const {name,enName,country}=stocks[symbolIndex[code]];
  const magnitude=(5.4+((cycle*7)%13)/10).toFixed(1),hours=6+(cycle*3)%26;
  const ko=[
    [`${place} 규모 ${magnitude} 지진…${name} 생산 멈춰`, `지진 감지 직후 ${name}은 ${place} 인근 공장의 가동을 멈추고 직원들을 대피시켰다. 모든 시설을 검사하는 데 최대 ${hours}시간이 걸릴 전망이다.`],
    [`${name}, 지진 여파로 출하 취소…안전검사 연장`, `${name}은 ${place} 지진 이후 공장 설비의 정렬이 어긋난 곳을 발견했다. 창고에 있는 재고를 우선 배정하고 신규 생산분의 선적을 미뤘다.`],
    [`${name} 지진 피해 시설 부분 재가동…야간 생산은 보류`, `${place} 인근의 ${name} 공장은 안전검사를 마친 설비부터 가동을 재개했다. 야간 생산분은 점검을 한 차례 더 거쳐 편성한다.`]
  ];
  const en=[
    [`Magnitude ${magnitude} quake halts ${enName} plant`, `${enName} halted production and evacuated staff near ${english} after an earthquake. It expects the full inspection to take up to ${hours} hours.`],
    [`${enName} cancels shipments as quake checks widen`, `${enName} reported equipment misalignment at its factory near ${english}. It is assigning warehouse stocks to customers and delaying shipments from new production.`],
    [`${enName} restarts part of quake-hit plant`, `${enName} restarted equipment that passed safety checks near ${english}. The factory will inspect the remaining equipment before expanding production.`]
  ];
  return report('earthquake',outlet,[country],[code],ko[phase],en[phase],phase===0);
}

function coastalStorm(cycle,phase){
  const places=['해진만','은목 연안','새울항','백로항','오동포','외포만','서운항','검파도'];
  const place=places[cycle%places.length],count=5+(cycle*11)%19;
  const headlines=[`폭풍해일이 ${place} 덮쳐…달밤물류 화물선 ${count}척 발 묶여`,`침수된 ${place}, 냉장 창고 전력 끊겨…달밤물류 긴급 반출`,`달밤물류, ${place} 운항 일부 재개…대체편 배정`];
  const copy=[
    `${place} 항만 당국은 폭풍해일로 접안시설을 닫았다. 달밤물류가 국내외 고객에게 운항 지연을 통지한 화물선만 ${count}척이다.`,
    `${place} 냉장 창고에 전력이 공급되지 않자 달밤물류는 상하지 않은 화물부터 내륙 보관시설로 옮기기 시작했다. 긴급 이송에 따른 추가 운임은 보험사의 피해 확인을 거쳐 정산한다.`,
    `${place}에서 안전 점검을 마친 선석 두 곳이 다시 열렸다. 달밤물류는 제때 출항하지 못한 선박 ${count}척 가운데 긴급 화물이 실린 편부터 새 운항표에 넣었다.`
  ];
  return report('disaster','tideline',['mora'],['MOON'],[headlines[phase],copy[phase]],null,phase===0);
}

function ethics(cycle,phase){
  const codes=['CROWN','RWDV','NORD','WFBK','IRPK','ALTQ','SBCG','BWTX'],code=codes[cycle%codes.length];
  const {name,enName,country,currency:listingCurrency}=stocks[symbolIndex[code]],amount=19+(cycle*17)%89;
  const british=listingCurrency==='GBP',currency=british?'파운드':'달러',symbol=british?'£':'$';
  const ko=[
    [`${name} CEO 불륜 의혹…${amount}00만 ${currency} 용역 계약도 조사`, `${name} 감사위원회는 CEO가 불륜 의혹이 제기된 외부 인사에게 용역 계약을 몰아줬는지 조사한다. 회사는 ${amount}00만 ${currency} 규모 계약의 다음 지급을 보류했다.`],
    [`${name} CEO, 불륜 의혹 속 이사회 출석…계약 지시 부인`, `${name} CEO는 이사회에서 사적 관계가 계약에 영향을 줬다는 의혹을 부인했다. 회사는 당시 심사에 참여한 임원 진술과 입찰 서류를 대조하고 있다.`],
    [`${name}, CEO 논란 뒤 협력사 계약 재입찰`, `${name}은 계약을 다시 공모하고 이전 입찰에 참여한 임원들을 새 심사에서 제외했다. 미지급된 금액의 처리 방침은 별도로 확정한다.`]
  ];
  const en=[
    [`${enName} board reviews ${symbol}${amount}m deal amid CEO affair allegation`, `${enName} directors are looking into whether the CEO favoured an outside associate alleged to be involved in an affair. The company withheld its next payment under the ${symbol}${amount} million contract.`],
    [`${enName} CEO denies steering contract in board hearing`, `The chief executive denied that a personal relationship played a part in the award. ${enName} is checking bid records against the accounts of executives who took part.`],
    [`${enName} puts disputed contract back out to tender`, `${enName} will open a fresh round of bids and remove executives who reviewed the original deal from the panel. Directors have yet to determine what to do about withheld payments.`]
  ];
  return report('affair','arden-wire',[country],[code],ko[phase],en[phase],phase===0);
}

function disruption(cycle,phase){
  const codes=['QRGR','MNRD','HARB','JNFD','MDRA','SBCG','NETP','LMX'],code=codes[cycle%codes.length];
  const {name,enName,country}=stocks[symbolIndex[code]],count=12+(cycle*13)%41;
  const region=canonicalCountry(country);
  const place=countries[region].name,outlet=region==='mora'?'tideline':'arden-wire';
  const ko=[
    [`${place} 산불로 주요 도로 폐쇄…${name} 화물 ${count}건 지연`, `산불 진화 당국은 주요 운송 회랑을 폐쇄하고 지역 주민과 사업장 직원들에게 대피를 요청했다. ${name}은 해당 구간을 지나는 화물 ${count}건을 정차시키거나 돌려보냈다.`],
    [`${name}, 산불 확산에 운송사 긴급 재계약`, `${name}은 폐쇄 구간을 피할 수 있는 운송편을 새로 확보했다. 정차한 화물의 배송 순서는 우회도로의 개방 시각에 따라 달라진다.`],
    [`산불 도로 통제 일부 풀려…${name}, 적체 화물 순차 배송`, `${name}은 당국이 개방한 우회로를 이용해 화물 배송을 다시 시작했다. 보험사에 낼 지연 및 보관 비용을 정리하는 데는 시간이 걸릴 전망이다.`]
  ];
  const en=[
    [`Wildfire closes freight corridor, delaying ${count} shipments for ${enName}`, `Fire officials closed a major transport corridor and urged residents and workers nearby to leave. ${enName} stopped or turned back ${count} shipments.`],
    [`${enName} books emergency freight as wildfire spreads`, `${enName} secured new carriers to bypass the closure. Delivery order for stranded cargo depends on when local roads are opened.`],
    [`${enName} moves stranded freight as wildfire restrictions ease`, `${enName} resumed deliveries on a route cleared by authorities. It is still compiling storage and delay costs for its insurers.`]
  ];
  return report('disaster',outlet,[country],[code],ko[phase],country==='mora'?null:en[phase],phase===0);
}

const reportingDesks=[fraud,quake,boycott,coastalStorm,ethics,disruption];
const rollingTick=openingTick+12;
const extraLeadInterval=12; // One additional lead per game hour, between regular incident slots.
const extraLeadStart=rollingTick+5;
const extraLeads=[
  report('fraud','nubo-econ',['mora'],['DHCP'],[
    '물결금융 금고 장부엔 1,280억, 실물은 0원…14개 계좌 동결',
    '한국 금융수사청은 물결금융이 담보로 보유한다고 신고한 1,280억 원이 금고에 없었다고 밝혔다. 법원은 자금이 흘러간 것으로 의심되는 14개 계좌를 동결했다.'
  ]),
  report('disaster','haeon-post',['haeon'],['TIDE'],[
    '미나토중공업 선박 3척, 태풍에 계류줄 끊겨 방파제 충돌',
    '태풍이 일본 남쪽 정비항을 덮치자 수리 중이던 선박 세 척이 방파제와 충돌했다. 미나토중공업은 선박을 옮길 예인선이 들어올 때까지 정비항 입구를 닫았다.'
  ],[
    'Three ships break loose in typhoon and strike Japanese breakwater',
    'Three ships under repair hit a breakwater when a typhoon passed through a southern Japanese port. Minato Heavy Industries closed the harbour entrance until tugboats could reach the vessels.'
  ]),
  report('social','arden-wire',['arden'],['HZMA'],[
    '대시 EV CEO, 화재 신고에 “차주 탓”…딜러 43곳 판매 중단',
    '대시 EV CEO가 충전 중 화재를 신고한 차주들에게 SNS에서 책임을 돌렸다. 독립 딜러 43곳은 외부 검사 결과가 나올 때까지 같은 모델의 인도를 보류했다.'
  ],[
    '대시 EV CEO blames customers for fires; 43 dealers halt deliveries',
    '대시 EV’s CEO blamed drivers on social media after they reported fires while charging. Forty-three independent dealers paused deliveries of the model pending an outside inspection.'
  ]),
  report('earthquake','arden-wire',['brazin'],['ANDB'],[
    '남아메리카연합 구리광산 규모 6.9 강진…지하 노동자 28명 고립',
    '남아메리카연합 광산청은 지진 뒤 안데스 코브레의 광산 갱도가 무너졌다고 밝혔다. 지하 대피실로 이동한 노동자 28명과 연락은 닿았으나, 구조팀이 접근할 수 있는 길은 아직 확보하지 못했다.'
  ],[
    'Magnitude 6.9 quake traps 28 workers at South American copper mine',
    'The South American Union’s mining authority said an Andes Cobre tunnel collapsed after an earthquake. It reached the 28 workers sheltering underground, but rescue crews had yet to secure a way to them.'
  ]),
  report('affair','workday',['mora'],['SLYD'],[
    '세림조선, CEO 불륜 의혹 상대에게 회사 사택 제공 정황',
    '세림조선 감사팀은 CEO와 불륜 의혹이 제기된 협력사 임원에게 사택이 무상 제공된 정황을 확인했다. CEO는 사택 배정과 협력사 선정에 관여하지 않았다고 밝혔다.'
  ]),
  report('death','arden-wire',['arden'],['BWTX'],[
    '브라이어우드 창업 CEO 사망…항암제 기술이전 협상 중단',
    '브라이어우드 테라퓨틱스는 해외 임상회의에 참석한 창업 CEO가 현지 병원에서 사망했다고 공시했다. 투자위원회는 사흘 뒤로 잡힌 항암제 기술이전 최종 협상 일정을 취소했다.'
  ],[
    'Briarwood founder dies abroad; cancer drug licensing talks halted',
    'Briarwood Therapeutics said its founder and CEO died in hospital while attending a clinical conference overseas. The investment committee cancelled the final round of cancer drug licensing talks scheduled three days later.'
  ]),
  report('disaster','tideline',['mora'],['VOLT'],[
    '서경 지하 공동구 침수…온빛전력 관할 9만 가구 정전',
    '밤사이 쏟아진 폭우로 서경 도심의 전력·통신 공동구가 잠겼다. 온빛전력은 합선 위험이 사라질 때까지 9만 가구에 전력을 공급하던 회로를 끊었다.'
  ]),
  report('fraud','arden-wire',['azania','lumen'],['NGNT'],[
    '나이저 델타 네트웍스, 9,600만 파운드 장비 대금 빼돌린 혐의',
    '아프리카연합 검찰은 나이저 델타 네트웍스의 전 재무총괄이 납품 실적이 없는 회사로 장비 대금을 보냈다고 밝혔다. 배임·횡령 혐의와 관련해 전 재무총괄 자택과 회계 서버를 압수수색했다.'
  ],[
    'Niger Delta Networks ex-finance chief investigated over £96m in payments',
    'African Union prosecutors said a former finance executive sent equipment payments to a company with no record of deliveries. Investigators searched the former executive’s home and seized accounting records.'
  ]),
  hostilities('arden-wire',['chai','lumen','mora'],['RTKW'],[
    '동북아시아연합·유럽연합 접경 교전 계속…화물철도 운행 재개 미정',
    '동북아시아연합과 유럽연합 군이 접경에서 교전해 한국 중재단이 휴전 유지 회담을 중단했다. 라인탈 베르케는 철도 폐쇄로 부품을 실은 열차 세 편이 국경 대기선에 멈췄다고 밝혔다.'
  ],[
    'Fighting continues on the frontier between the Northeast Asian and European unions as rail freight waits',
    'South Korean mediators suspended ceasefire talks after fighting resumed on the frontier. Rheintal Werke said three trains carrying parts stopped at the border when freight rail services closed.'
  ]),
  report('social','citizen',['mora'],['MRGM'],[
    '모래내게임즈 CEO, 환불 요구자 명단 SNS 공개…결제사 승인 중단',
    '모래내게임즈 대표가 환불을 요구한 이용자를 비난하며 신청자 명단을 SNS에 게시했다. 결제 대행사 두 곳은 사건 경위를 확인할 때까지 게임 내 결제의 신규 승인을 멈췄다.'
  ]),
  report('affair','haeon-post',['haeon'],['CORL'],[
    '세이와소재 CEO 불륜 의혹 상대 업체에 84억 엔 독점 계약',
    '세이와소재 이사회는 CEO와 불륜 의혹이 불거진 협력사 대표의 회사가 84억 엔 규모 원료 운송 계약을 경쟁 없이 따낸 경위를 조사한다. CEO는 계약 조건을 검토한 적이 없다고 밝혔다.'
  ],[
    'Seiwa board reviews ¥8.4bn sole-source deal amid CEO affair allegation',
    'Seiwa Materials is examining how a freight company run by an alleged personal partner of its CEO won a ¥8.4 billion contract without bidding. The chief executive denied reviewing the terms.'
  ]),
  report('disaster','arden-wire',['kanora','arden'],['MNRD','HARB'],[
    '북아메리카연합 산사태에 화물선로 2㎞ 매몰…곡물 열차 19편 운행 취소',
    '산사태가 북아메리카연합 동부 산악 화물선로 2㎞를 덮었다. 메이플 노던 레일은 곡물 열차 19편의 출발을 취소했고 웨일라인은 열차를 기다리던 선박의 출항일을 늦췄다.'
  ],[
    'North American Union landslide buries two kilometres of track, cancels 19 grain trains',
    'A landslide buried two kilometres of freight track on the North American Union’s eastern rail corridor. Maple Northern Rail cancelled 19 grain trains, and 웨일라인 delayed vessels waiting for their loads.'
  ])
];

// The first publication of each development sets the relationship in the atlas.
export const incidentStanceChanges=[
  ...Array.from(specialReports,([offset,report])=>[openingTick+offset,report]),
  ...extraLeads.map((report,slot)=>[extraLeadStart+slot*extraLeadInterval,report]),
].filter(([,report])=>report.diplomacy);

// Follow-ups share the news clock without changing the price history on the tape.
const conflictDesk=[
  report('war','chai-news',['chai','vietlan'],['DHDG'],[
    '동북아시아연합·동남아시아연합 접경 봉쇄 이어져…세관 밖에서 인도 기한 맞은 화물',
    '동북아시아연합 접경 세관은 오늘도 일반 화물을 받지 않았다. 둥후디지털은 이미 세관 앞까지 운송한 설비의 인도 기한이 지나 고객사와 새 날짜를 협의하고 있다.'
  ],[
    'Freight deadlines pass as the border between the Northeast Asian and Southeast Asian unions remains closed',
    'Northeast Asian Union customs kept the frontier closed to ordinary freight today. Donghu Digital is negotiating new delivery dates for equipment already waiting outside the customs yard.'
  ],false),
  report('border','haeon-post',['haeon','chai'],['TIDE'],[
    '청람열도 경계 분쟁 계속…여객선사는 돌아오는 배표부터 환불',
    '일본 여객선사는 청람열도를 오가는 저녁편을 오늘도 운항표에 넣지 못했다. 돌아갈 날짜를 정하지 못한 승객은 항구 창구에서 남은 구간의 운임을 돌려받고 있다.'
  ],[
    'Evening ferries remain off the timetable in the Blue Shoals dispute',
    'A Japanese operator again left its evening island service off today’s timetable. Passengers without a return date are collecting refunds for the unused leg at the port.'
  ],false),
  report('border','chai-news',['lumen','chai'],['HARB'],[
    '유럽연합·동북아시아연합 해상 분쟁, 공동 수역 통항 협의 계속',
    '동북아시아연합 항만청은 유럽연합과 통항 조건을 논의 중이라며 다음 연락 때까지 기존 우회 항로를 유지한다고 밝혔다. 웨일라인은 도착일을 확정하지 못한 화주에게 보관료 면제 기간을 연장했다.'
  ],[
    'Northeast Asian and European unions continue talks on passage through disputed waters',
    'The Northeast Asian Union’s port authority kept the existing diversion in place pending its next meeting with the European Union. 웨일라인 extended free storage for customers still waiting for a delivery date.'
  ],false),
  report('war','arden-wire',['chai','lumen'],['RTKW'],[
    '동북아시아연합·유럽연합 접경 철도 운행 중단 계속…부품 열차 출발 대기',
    '양국 철도 운영사가 오늘 발표한 운행표에도 접경 화물편은 빠졌다. 유럽연합의 라인탈 베르케는 발송을 마친 부품과 아직 출발역에 있는 부품을 구분해 고객사에 알리고 있다.'
  ],[
    'Cross-border freight remains suspended between the Northeast Asian Union and the European Union',
    'Neither rail operator listed the frontier route in today’s freight timetable. European manufacturer Rheintal Werke is telling customers which parts have left the depot and which are still waiting.'
  ],false),
  report('war','workday',['mora','chai','vietlan'],['YJRX'],[
    '동북아시아연합·동남아시아연합 전쟁 장기화…한국 제약사, 원료 기다리며 근무표 다시 짠다',
    '동북아시아연합과 동남아시아연합 사이 일반 통관이 막힌 가운데 한국 맑음제약은 이번 교대부터 일부 생산 인력을 검수 업무로 옮겼다. 노사는 밀린 원료가 도착하면 교대 시각을 다시 협의하기로 했다.'
  ],null,false),
  report('border','haeon-post',['haeon','chai'],[],[
    '일본·동북아시아연합 어업 경계 협상 계속…어시장엔 가까운 바다 어획물만',
    '청람열도 어업 경계를 정하는 실무 협의가 이어지고 있다. 일본 항구의 아침 경매에는 공동 어장에서 돌아온 배가 없었다. 어민 조합은 다음 출항 여부를 양국 발표 뒤 결정하기로 했다.'
  ],[
    'Fishing crews wait as Japan and the Northeast Asian Union continue boundary talks',
    'No boats from the shared Blue Shoals grounds landed fish at the morning auction in Japan. The local cooperative will decide on its next sailing after the two governments report on their talks.'
  ],false),
];
const regionalDesk=[
  report('war','chai-news',['chai','vietlan','misran','azania'],['HARB','NILD','ATLS'],[
    '아시아 국경 봉쇄 장기화…중동연합 홍해 항만에 비료선 추가 입항',
    '동북아시아연합과 동남아시아연합의 육상 통관이 멈춘 뒤 홍해를 지나는 선적이 늘었다. 중동연합 항만청은 아프리카연합 수입상이 주문한 비료에 하역 시간을 추가 배정했다. 운송을 맡은 웨일라인은 두 번째 배의 접안 시각을 기다리고 있다.'
  ],[
    'Red Sea terminals add a fertiliser berth as Asian border closures persist',
    'More cargo is moving by sea while the land crossing between the Northeast Asian and Southeast Asian unions stays closed. The Middle East Union port authority set aside unloading time for fertiliser ordered by African Union importers. 웨일라인, the carrier, is still waiting for a berth for its second vessel.'
  ],false),
  report('border','haeon-post',['haeon','chai','austran','brazin'],['CORL','PACI','ANDB'],[
    '일본·동북아시아연합 통항 협의 길어져…태평양 광석선 도착 일정 변경',
    '오세아니아연합 선사는 남아메리카연합에서 광석을 싣고 일본으로 향하던 배를 청람열도 밖 항로로 돌렸다. 세이와소재는 이 선박에 실린 원료의 인수 일정을 미뤘다. 일본과 동북아시아연합 항만 당국은 추가 통항 신청을 다음 협의에서 검토한다고 밝혔다.'
  ],[
    'Pacific ore carrier revises arrival date as Japan and Northeast Asian Union negotiate passage',
    'An Oceania Union carrier diverted a Japan-bound shipment of South American Union ore around the Blue Shoals. Seiwa Materials put back the delivery date for its cargo on board. Port officials in Japan and the Northeast Asian Union will consider requests for additional passages at their next meeting.'
  ],false),
];
const conflictStart=rollingTick+7,conflictInterval=96; // One follow-up per eight game hours.

export function scheduledIncident(tick){
  const special=specialReports.get(tick-openingTick);
  if(special)return special;
  const elapsed=tick-conflictStart;
  if(elapsed>=0&&elapsed%conflictInterval===0)return {...conflictDesk[elapsed/conflictInterval%conflictDesk.length],editorialOnly:true};
  // Regional dispatches use an otherwise empty publication slot. Keep archived conflict editions on their six-story rotation.
  const regionalElapsed=tick-(conflictStart+2);
  if(regionalElapsed>=0&&regionalElapsed%(2*conflictInterval)===0){
    const slot=regionalElapsed/(2*conflictInterval);
    return {...regionalDesk[slot%regionalDesk.length],editorialOnly:true};
  }
  const extraTick=tick-extraLeadStart;
  if(extraTick>=0&&extraTick%extraLeadInterval===0){
    const edition=extraTick/extraLeadInterval;
    const rotation=Math.floor(edition/extraLeads.length);
    const lead=extraLeads[(edition+rotation)%extraLeads.length];
    return {...lead,editorialOnly:true};
  }
  if(tick<rollingTick||(tick-rollingTick)%2!==0)return null;
  const editionNumber=(tick-rollingTick)/2,pass=Math.floor(editionNumber/reportingDesks.length);
  const cycle=Math.floor(pass/3),phase=pass%3;
  const desk=(editionNumber+cycle)%reportingDesks.length;
  const report=reportingDesks[desk](cycle,phase);
  return {...report,development:{id:'incident-series-'+cycle+'-'+desk,version:phase+1}};
}
