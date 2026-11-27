// The opening edition goes to press at 09:00 KST. These are six independent dispatches.
const article=(title,lead,first,second)=>({title,lead,body:[first,second]});
function dispatch(id,title,outlet,countries,related,shock,fx,ko,en) {
  return {id,minute:0,title,shock,fx,newsCategory:'international',stories:[{outlet,countries,related,...ko,ko,en}]};
}
export const openingBriefs=[
 dispatch('wire-asia','동북아시아·동남아시아 통관 시범','chai-news',['mora','haeon','chai','vietlan'],['JHMI','FVT','CORL'],{FVT:.012,JHMI:.008,CORL:.004},{CNY:.0015},
  article('서류 한 번에 세 항구 통과…동북아시아연합 배터리 원료, 전자 원산지 시험','일본 세관은 동남아시아연합의 베트남 항구에서 선적해 한국에서 환적하는 동북아시아연합산 원료에 전자 원산지 증명서를 받기로 했다.',
    '세 항구가 공유한 시험 지침에 따르면 기존에는 환적항을 지날 때마다 같은 증명을 냈다. 4주간 지정 선적 40건은 선적지에서 발급된 문서를 재사용할 수 있다. 비엣하이 터미널은 재입력 시간을 따로 기록한다.',
    '동남아시아연합 구매사들은 서류 처리 시간을 비교할 수 있도록 기존 방식으로 통관한 화물의 기록을 제공한다. 참여 업체가 내는 관세율과 원산지 검사는 그대로다. 화주가 절감할 수 있는 것은 시험 대상 화물의 부두 체류 비용이다.'),
  article('Three Asian ports to test a single origin certificate for battery cargo','Japanese customs will accept electronic certificates for Northeast Asian Union material shipped from a Vietnamese port in the Southeast Asian Union and transshipped in South Korea.',
    'Under guidance shared by the three ports, carriers previously filed the same proof at each transfer. For four weeks, 40 designated consignments may reuse the document issued at origin. Viethai Terminals will record time spent re-entering forms.',
    'Buyers in the Southeast Asian Union will supply clearance records for comparable shipments under the old process. Tariff rates and origin inspections are unchanged. The saving available to shippers is the cost of time spent on the quay.') ),
 dispatch('wire-europe','유럽 가스 운송용량 경매','lumen-gazette',['lumen','chai'],['NORD','RTKW','CROWN'],{NORD:.009,RTKW:-.005},{EUR:.002},
  article('유럽연합 스페인항 LNG, 프랑스 경유 독일행 운송권 12월물 경매','유럽연합 가스망 운영사 세 곳이 겨울철 역방향 가스관 용량 12GWh를 하루 단위로 내놓는다.',
    '공동 입찰서상 스페인의 재기화 설비에서 프랑스를 지나 독일 공장으로 보낼 수 있는 물량이다. 유럽연합의 노스미어 에너지도 수송권을 살 수 있지만 LNG 화물은 별도로 조달해야 한다.',
    '독일 철강업체들은 동북아시아연합발 동부 가스관 계약의 공백을 메울 단가를 비교하고 있다. 경매 가격에는 가스 자체의 값과 국경 뒤 현지 배관 요금이 빠져 있다. 낙찰 결과만으로 공장 도착 가격을 알 수 없다.'),
  article('Europe offers west-to-east gas capacity ahead of winter','Three pipeline operators are offering 12 GWh of daily reverse-flow capacity for December.',
    'The joint tender covers gas from Spain’s regasification terminals across France into Germany’s industrial belt. EU-based Northmere Energy is eligible to bid, but a slot carries no entitlement to an LNG cargo.',
    'German steelmakers are comparing the route with supply lost as eastern contracts from the Northeast Asian Union expire. The hammer price excludes gas and local transport beyond the border. It will not establish a delivered factory price on its own.') ),
 {...dispatch('wire-north','북미 냉장 운송 보험 갱신','arden-wire',['arden','kanora'],['PACP','MNRD','HARB'],{MNRD:.007,HARB:.003},{CAD:.001},
  article('파나마 운하 통과 보험료, 냉장 온도 기록 제출하면 할인','미국과 북아메리카연합의 해상보험사 두 곳이 유효한 센서 기록을 갖춘 냉장 컨테이너에 파손보험료 6% 할인을 제시했다.',
    '보험사의 갱신 통지에 따르면 멕시코만과 카리브해에서 싣고 파나마 운하를 지나는 냉장 화물의 다음 보험 갱신부터 적용된다. 캐나다 철도 구간으로 환적할 때도 센서 기록이 이어져야 한다.',
    '웨일라인은 참여 고객에게 항차별 견적을 전달한다고 밝혔다. 할인 대상은 전체 운임 가운데 파손보험료뿐이다. 온도 기록이 끊기면 할인 전 조건으로 다시 심사한다.'),
  article('Insurers offer 6% cargo-cover discount on monitored canal shipments','Two marine insurers in the United States and the North American Union will cut damage-cover premiums on refrigerated boxes with continuous sensor records.',
    'The renewal notice applies to eligible voyages loading in the Gulf of Mexico or the Caribbean and using the Panama Canal. The record must continue through any transfer to a Canadian rail service.',
    '웨일라인 will give participating customers voyage-specific quotes. The 6% applies to damage insurance, one component of the freight bill. Gaps in the temperature log trigger reassessment at the undiscounted terms.')),
   industryIds:['insurance','shipping','rail-transport']},
 dispatch('wire-south','남미 광물·농산물 선석 배정','quay-post',['brazin'],['VRS','ANDB','HARB'],{VRS:.014,HARB:.002},{BRL:.003},
  article('페루·칠레 광석 전용선석 3곳 추가…농산물은 예약제 유지','남아메리카연합 항만위원회가 12월 수출선의 접안 순번을 공고했다. 새로 지정한 광석 선석은 페루 2곳과 칠레 1곳이다.',
    '세관에 신고된 선적계획에는 브라질의 바르제아 미네라상이 12월 선적할 정광도 포함됐다. 수출 허가는 이미 받은 물량이다. 선석 확대가 재고의 현금 회수 시점을 앞당길 여지는 있어도 그만큼 새 광석이 생산되는 것은 아니다.',
    '아르헨티나 곡물상과 콜롬비아 커피 수출조합은 농산물 선적이 기존 예약제를 유지한다고 회원사에 알렸다. 창고에서 같은 화물차를 쓰는 품목의 육상 대기료는 이번 공고에 포함되지 않는다.') ),
 dispatch('wire-africa','아프리카 비료 신용장 공동창구','lumen-gazette',['misran','azania'],['ATLS','NILD','CROWN'],{CROWN:.006,KRV:.003},{ZAR:.002},
  article('아프리카연합 비료 수입상에 공동 신용장…첫 한도 1,800만 달러','아프리카연합과 중동연합을 잇는 비료 거래에 은행 세 곳이 미화 1,800만 달러 한도의 결제 보증을 제공한다.',
    '공동 약정에 따르면 모로코의 인광석과 나이지리아의 질소 원료를 중동연합에서 가공해 케냐에 파는 계약이 첫 대상이다. 남아프리카 운송사에는 검수된 운송장만으로도 보증 신청 자격이 생긴다.',
    '은행은 선적 서류를 확인한 거래별로 한도를 소진한다. 서류가 승인되기 전에 발표한 전체 한도는 공급사의 매출이 아니다. 운송 중 가격이 바뀌었을 때 어느 쪽이 부담할지는 개별 계약에 달렸다.'),
  article('Banks open $18mn of trade guarantees for African fertiliser buyers','A three-bank facility will guarantee up to $18mn of payments on fertiliser trade spanning the African Union and the Middle East Union.',
    'The agreement initially covers Moroccan phosphate and Nigerian nitrogen feedstock processed in the Middle East Union for sale in Kenya. South African carriers may apply against verified bills of lading.',
    'The banks will draw down the facility trade by trade after examining shipping documents. An announced ceiling is no supplier’s booked revenue. Each sales contract allocates the risk of a price change in transit.') ),
 dispatch('wire-pacific','오세아니아연합 연료 공동입찰','haeon-post',['austran'],['PACI','SCMT','HARB'],{SCMT:.005,HARB:.002},{AUD:.0015},
  article('오세아니아연합 섬 세 곳, 경유 공동입찰…도착항별 할증은 별도','오세아니아연합의 파푸아뉴기니·피지·솔로몬제도 항만이 6개월간 경유 9만 배럴을 함께 구매하는 입찰서를 냈다.',
    '세 곳의 항만공사가 한 계약으로 묶은 것은 정유소 출하가격이다. 호주와 뉴질랜드의 공급사는 섬마다 다른 항만 수심, 하역설비, 운송료를 반영한 도착가를 따로 제출해야 한다.',
    '낙찰 물량의 첫 인도 예정 시점은 12월이다. 기상 때문에 작은 유조선으로 갈아 실으면 최종 단가가 오를 수 있다. 이번 달 어선과 광산의 연료비 절감은 아직 확정되지 않았다. 오세아니아연합의 뉴질랜드 지역 정당들은 지역의회 선거를 앞두고 냉장 수출항 전력설비의 재원도 논의하고 있다.'),
  article('Three Pacific buyers pool diesel tender, retain port-specific freight','Port authorities in Papua New Guinea, Fiji and the Solomon Islands issued a six-month tender for a combined 90,000 barrels of diesel.',
    'The three port authorities pooled the ex-refinery price. Suppliers in Australia and New Zealand must still quote a delivered price for each island, reflecting berth depth, unloading equipment and freight.',
    'The first delivery is scheduled for December. Weather that forces a transfer to a smaller tanker could lift the final cost. Savings on this month’s fuel bills for fleets and mines have yet to be established. Ahead of the regional election in New Zealand, local parties are also debating how to fund power upgrades at chilled-export ports.') )
];

export const electionBulletin={
 ...dispatch('zelanda-election','뉴질랜드 지역의회 잠정 개표','arden-wire',['austran'],['ORUR','PACI'],{ORUR:-.007,PACI:-.003},{},
   article('뉴질랜드 지역의회 잠정 집계, 과반 정당 없어…냉장 항만 예산은 연정 협상으로','오세아니아연합의 뉴질랜드 지역 선거위원회가 지역구 투표의 82%를 집계한 날 밤, 마이아 리드 대표가 이끄는 국민연합당은 비례 의석을 합쳐 잠정 53석으로 추산됐다.',
   '현지시각 오후 11시 10분 기준 잠정 배분은 120석 중 국민연합당 53석, 시민노동당 47석, 나머지 정당 20석이다. 리드 대표는 지역 연정 협상을 시작하겠다고 밝혔고 시민노동당도 소수 정당과 대화 중이라고 전했다. 특별투표와 최종 비례 배분은 남아 있다.',
   '쟁점에는 두 수출항의 냉장 컨테이너 전력설비 예산이 포함된다. 시드니에도 상장한 오우라 데어리와 피지 노선의 선사는 예산 의결 전까지 신규 설비 사용일을 확정할 수 없다. 개표 발표 당시 상장시장은 휴장 중이었다.'),
   article('New Zealand regional count points to hung assembly, leaving cold-port budget for coalition talks','The New Zealand electoral office in the Oceania Union projected 53 seats for Maia Reed’s National Alliance after counting 82% of constituency ballots.',
   'At 11:10 p.m. local time the provisional allocation, including list seats, put National Alliance on 53 of 120 seats, Civic Labour on 47 and other parties on 20. Reed said she would begin talks to form a regional government. Civic Labour also reported contact with smaller parties. Special ballots and the final list-seat allocation are outstanding.',
   'At stake is a proposed appropriation for refrigerated-container power at two export ports. Oura Dairy, also listed in Sydney, and carriers serving Fiji cannot book the new facilities until funding is secured. The listing exchange was closed when the count was released.')),
 minute:610,newsCategory:'politics'
};
