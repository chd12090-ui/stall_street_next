// Leaders, parties, union memberships and political calendars belong to the game world.
export const continents={
  asia:{name:'아시아'},europe:{name:'유럽'},north:{name:'북아메리카'},
  south:{name:'남아메리카'},africa:{name:'아프리카'},oceania:{name:'오세아니아'},
};

function country(id,iso,name,en,continent,location,fields){
  return {id,iso,name,en,continent,location,...fields};
}

const profiles=[
  country('mora','KOR','대한민국','South Korea','asia',[127.6,36.4],{
    currency:'KRW',currencyName:'원',government:'대통령제 공화국',leader:'대통령 공석',
    party:'공석',partySide:'vacant',orientation:'공석',
    counterweight:'자유경제당은 기업의 투자 부담을 낮추는 방안을 제시한다.',
    electionDate:'2028-04-12',election:'국회 총선',leadership:'유권자가 대통령과 국회의원을 각각 선출한다.',
    geography:'동남권의 조선소와 자동차 공장이 남해 수출 항로를 공유한다.',
    society:'수도권의 서비스 산업과 지역 제조업 도시가 고용과 주거 문제를 함께 논의한다.',
    trade:'반도체·선박·자동차를 수출하고 원유·가스와 공정 소재를 수입한다.',blocs:['태평양 공급망 협의체']}),
  country('haeon','JPN','일본','Japan','asia',[138.2,36.2],{
    currency:'JPY',currencyName:'엔',government:'의원내각제',leader:'오가와 레이 총리',
    party:'공민보수당',partySide:'conservative',orientation:'보수 · 방재 투자와 제조업 지원',
    counterweight:'생활입헌당은 실질임금과 가계 전력요금에 중점을 둔다.',
    electionDate:'2028-10-22',election:'중의원 선거',leadership:'국회가 총리를 지명하고 내각이 행정을 맡는다.',
    geography:'태평양 연안의 산업 지대가 정밀기계와 자동차의 주요 선적지다.',
    society:'지방 도시와 대도시가 철도 유지비와 재해 복구 기금의 배분을 논의한다.',
    trade:'공작기계와 정밀소재를 수출하고 발전 연료와 곡물을 들여온다.',blocs:['태평양 공급망 협의체']}),
  country('arden','USA','미국','United States','north',[-99.2,38.9],{
    currency:'USD',currencyName:'달러',government:'연방 대통령제',leader:'엘리엇 콜 대통령',
    party:'연방보수당',partySide:'conservative',orientation:'보수 · 감세와 국내 조달',
    counterweight:'도시진보당은 의료 지출과 노동자 보호를 우선한다.',
    electionDate:'2028-11-07',election:'대통령·연방의회 선거',leadership:'대통령과 연방의회가 예산·통상 정책을 협의한다.',
    geography:'두 대양의 항구에 내륙 곡창과 제조업 도시가 철도·하천으로 연결된다.',
    society:'주마다 주요 산업과 세제가 달라 같은 조달 정책도 지역별 고용에 다르게 반영된다.',
    trade:'항공기·농산물·반도체 설계를 수출하고 전자제품과 핵심광물을 수입한다.',blocs:['북대서양 협의회','태평양 공급망 협의체']}),
  country('lumen','EUR','유럽연합','European Union','europe',[10.5,51.1],{
    currency:'EUR',currencyName:'유로',government:'회원국 의회 연합',leader:'이브 머서 집행위원장',
    party:'사회협력당',partySide:'progressive',orientation:'진보 · 노동 전환과 공동 전력망',
    counterweight:'산업보수연합은 공장 전기요금과 재정 규율을 강조한다.',
    electionDate:'2029-05-03',election:'연합의회 선거',leadership:'게임 속 연합의회가 집행위원장을 선출하고 회원 정부가 공동 예산을 심의한다.',
    geography:'북해 항구와 대륙 내륙의 강·철도가 자동차·화학 생산망을 연결한다.',
    society:'서로 다른 언어권의 노동시장과 농업 지역이 공동기금의 사용처를 협의한다.',
    trade:'산업기계·항공기·의약품을 수출하고 에너지와 배터리 원료를 수입한다.',blocs:['북대서양 협의회','대서양 교역회의']}),
  country('chai','EAU','동북아시아연합','Northeast Asian Union','asia',[104.2,35],{
    currency:'CNY',currencyName:'위안',government:'지역 대표회의 연합',leader:'린웨이 의장',
    party:'산업개혁당',partySide:'progressive',orientation:'진보 · 산업 현대화와 공공 철도',
    counterweight:'지역 재정위원회와 원자재 공급 지역이 투자 우선순위를 협의한다.',
    electionDate:'2028-03-05',election:'연합 대표회의',leadership:'지역 대표가 의장과 예산안을 표결한다.',
    geography:'동부 항만과 북부 자원 지대가 장거리 철도와 가스관으로 이어진다.',
    society:'항만 도시와 내륙 광업 지역 사이의 교통 및 에너지 비용 격차가 정책 의제다.',
    trade:'전자기기·정련 금속·가스를 공급하고 공정 장비·곡물을 조달한다.',blocs:['대륙 철도회의','태평양 공급망 협의체']}),
  country('vietlan','SEU','동남아시아연합','Southeast Asian Union','asia',[103.1,15.6],{
    currency:'VND',currencyName:'동',government:'회원국 의회 연합',leader:'쩐 민 안 의장',
    party:'노동협동당',partySide:'progressive',orientation:'진보 · 항만 노동과 전력 보급',
    counterweight:'수출기업 협의회는 통관 대기 시간과 운송비를 줄이는 데 주력한다.',
    electionDate:'2031-05-18',election:'연합의회 선거',leadership:'회원 지역이 선출한 의회가 집행 의장을 지명한다.',
    geography:'인도양과 태평양을 잇는 해협에 정유소와 전자 조립 항구가 모여 있다.',
    society:'강 유역의 농가, 수출 가공단지와 도서 주민이 홍수 대책과 식품 물류를 협의한다.',
    trade:'전자 조립품·의약품·쌀을 수출하고 칩과 공정 장비를 수입한다.',blocs:['인도양 해운회의']}),
  country('misran','MEU','중동연합','Middle East Union','asia',[46.8,24.7],{
    currency:'SAR',currencyName:'리얄',government:'회원국 평의회',leader:'나디아 하산 의장',
    party:'국가발전연합',partySide:'conservative',orientation:'보수 · 에너지 수출과 항만 안보',
    counterweight:'소비 지역 대표단은 전력요금과 곡물 보조금 안정에 집중한다.',
    electionDate:'2030-12-10',election:'연합평의회 의장 선거',leadership:'회원 대표들이 선출한 의장이 공동 항만 및 운송 일정을 조율한다.',
    geography:'홍해와 걸프 연안에 에너지 선적 항구가 있고 운하가 지중해 항로와 연결된다.',
    society:'사막 내륙과 해안 도시의 담수 확보가 전력·식품 정책에 함께 영향을 준다.',
    trade:'원유·LNG·비료를 수출하고 식량·기계·담수화 설비를 수입한다.',blocs:['인도양 해운회의','에너지 수출협의회']}),
  country('azania','AFU','아프리카연합','African Union','africa',[23,-3.1],{
    currency:'ZAR',currencyName:'랜드',government:'연합의회',leader:'날레디 모코 의장',
    party:'시민개혁연합',partySide:'progressive',orientation:'진보 · 전력망과 역내 식량 유통',
    counterweight:'광산 지역 대표단은 수출 항로와 로열티 배분을 협의한다.',
    electionDate:'2029-05-23',election:'연합의회 선거',leadership:'지역 의회가 대표를 보내고 연합의회가 의장을 선출한다.',
    geography:'내륙 광산에서 대서양과 인도양의 항만으로 철도·송전 회랑이 이어진다.',
    society:'연안 물류도시와 농업 지역이 식품 보관과 전력 접근성 개선을 위한 공동 기금을 운용한다.',
    trade:'산업용 금속·농산물을 수출하고 연료·기계·의약품을 수입한다.',blocs:['대서양 교역회의','인도양 해운회의']}),
  country('austran','OCU','오세아니아연합','Oceania Union','oceania',[133.4,-25.6],{
    currency:'AUD',currencyName:'호주 달러',government:'태평양 연합의회',leader:'로언 하트 총리',
    party:'연방노동당',partySide:'progressive',orientation:'진보 · 도서 교통과 산업 전환',
    counterweight:'항만·광산 지역은 장기 선박 계약과 전력 공급 보장을 요구한다.',
    electionDate:'2028-05-13',election:'연합의회 선거',leadership:'도서와 대륙 지역이 뽑은 의원들이 연립 내각을 구성한다.',
    geography:'대형 벌크항과 태평양 도서 항로가 광물·수산물 공급망을 이룬다.',
    society:'도서 주민은 정기 선편과 기상 관측망을 공유하고 목축 지역은 검역 규정을 공동 운영한다.',
    trade:'철광석·가스·냉장 식품을 수출하고 운송 장비와 전자 부품을 수입한다.',blocs:['태평양 공급망 협의체']}),
  country('brazin','SAU','남아메리카연합','South American Union','south',[-56,-15],{
    currency:'BRL',currencyName:'헤알',government:'지역 대표 연합',leader:'마리아 두아르치 의장',
    party:'노동연대당',partySide:'progressive',orientation:'진보 · 농촌 복지와 광산 수익 배분',
    counterweight:'곡물 수출 지역과 산림 지역은 철도 예산 및 토지 이용 기준을 두고 협상한다.',
    electionDate:'2028-10-01',election:'연합 대표 선거',leadership:'지역 대표회의가 내각을 구성하고 공동 통관 규칙을 정한다.',
    geography:'안데스의 구리 광산과 내륙 곡창이 양쪽 해안의 항만으로 이어진다.',
    society:'고산 지역의 수자원과 저지대의 산림을 관리하는 지역 공동체가 수출 개발에 참여한다.',
    trade:'구리·리튬·대두·옥수수를 수출하고 비료·산업 설비를 수입한다.',blocs:['대서양 교역회의']}),
  country('kanora','NAU','북아메리카연합','North American Union','north',[-105,55.2],{
    currency:'CAD',currencyName:'캐나다 달러',government:'연방 대표회의',leader:'마리옹 클라크 총리',
    party:'자유연방당',partySide:'conservative',orientation:'보수 · 역내 통상과 민간 투자',
    counterweight:'산업노동당은 국경 제조업의 임금과 항만 노동 기준을 협상한다.',
    electionDate:'2029-10-15',election:'연합 하원 선거',leadership:'게임에서 미국과 별도인 연합이다. 지역 대표가 선출한 하원 다수파가 내각을 구성한다.',
    geography:'북부 자원 지대와 중미 운하, 카리브 항만이 미국 양쪽의 해상·육상 무역로를 잇는다.',
    society:'내륙 자원 도시, 국경 조립단지와 도서 지역이 교통망과 재난 대응 비용을 공동 조정한다.',
    trade:'자동차 부품·원유·목재와 물류 서비스를 공급하고 기계·전자제품을 수입한다.',blocs:['북대서양 협의회','대서양 교역회의']}),
];

export const countries=Object.fromEntries(profiles.map(c=>[c.id,c]));

const previousMembers={
  indara:'vietlan',ruska:'chai',francen:'lumen',germar:'lumen',espara:'lumen',
  mexara:'kanora',cubara:'kanora',panaro:'kanora',argentel:'brazin',chilena:'brazin',
  anderu:'brazin',colmera:'brazin',maghren:'azania',naijar:'azania',kenara:'azania',
  zelanda:'austran',papura:'austran',fijara:'austran',saloma:'austran',
};
export function canonicalCountry(id){
  if(Object.hasOwn(countries,id))return id;
  return Object.hasOwn(previousMembers,id)?previousMembers[id]:null;
}

const link=(a,b,kind,title,detail,sector)=>({a,b,kind,title,detail,sector});
export const relationKinds={
  alliance:{name:'안보·외교',color:'#8ea8ff'},trade:{name:'교역',color:'#49d3ac'},
  tension:{name:'통상 마찰',color:'#ff927d'},talk:{name:'정책 협상',color:'#e6bb70'},
  party:{name:'정당 협력',color:'#d8a0f3'},culture:{name:'문화·종교',color:'#77c4e7'}
};
export const relationStances={
  allied:{name:'동맹',color:'#84b7ff'},
  neutral:{name:'중립',color:'#f1d16f'},
  hostile:{name:'적대',color:'#ff806d'}
};
export const relations=[
  link('mora','arden','alliance','반도체 공급망 협의','양국은 수출 심사와 핵심 장비의 긴급 공급 절차를 조율한다.','반도체·장비'),
  link('mora','haeon','talk','정밀소재 납품 일정','양국 소재업체가 검수 규격과 해협 항로의 운항 시간을 맞춘다.','전자부품·해운'),
  link('mora','lumen','party','산업 전환 의원 협의','양측 의회는 조선·자동차 노동자의 재교육 비용을 공동 연구한다.','자동차·조선'),
  link('mora','chai','trade','배터리 셀과 정련 금속','한국의 배터리 제조사가 동북아시아연합 정련소의 금속 납품 일정을 점검한다.','배터리·소재'),
  link('mora','vietlan','trade','조립 공장과 부품 운송','전자부품 공급이 남방 항구의 전력 사정과 선박 배차에 따라 달라진다.','전자기기·물류'),
  link('mora','misran','trade','원유 선적과 조선 계약','원유 조달과 운반선 발주가 장기 에너지 계약을 통해 이어진다.','원유·조선'),
  link('haeon','chai','tension','해협 통항과 보험','해상 긴장이 높아지면 선사는 기항 순서와 해상보험 조건을 다시 정한다.','해운·손해보험'),
  link('haeon','austran','trade','가스와 식품 선적','일본 발전사와 식품업계는 연합 항만의 냉장선 및 가스선 배차를 살핀다.','전력·농산물'),
  link('haeon','arden','alliance','태평양 물류 협력','양측이 항만 안전 기준과 긴급 공급선을 공동 점검한다.','물류·통신'),
  link('arden','kanora','trade','국경을 넘는 자동차 부품','미국과 북아메리카연합의 조립 공장이 원산지 증명과 철도 적재 일정을 공유한다.','자동차·철도'),
  link('arden','lumen','alliance','대서양 공급망 협정','양측은 대서양 화물 운송과 금융 결제망의 연속성을 협의한다.','해운·금융'),
  link('arden','chai','tension','첨단 장비의 수출 심사','신규 허가가 늦어지면 이미 발주한 반도체 장비도 납기가 바뀐다.','반도체·장비'),
  link('arden','brazin','trade','곡물과 냉장 물류','양측 식품업체가 수확기에 맞춰 곡물선과 냉장창고를 예약한다.','곡물·물류'),
  link('lumen','chai','tension','대륙 경계의 철도 통관','검문과 보험 조건에 따라 국경 철도의 화학 원료와 완성차 인도일이 달라진다.','철도·화학'),
  link('lumen','azania','trade','지중해 양안의 자동차 생산','북아프리카의 전장 부품이 지중해를 건너 유럽 조립라인으로 이동한다.','자동차·항만'),
  link('lumen','misran','trade','운하와 전력 연료','운하 통항과 가스선 배차가 유럽연합의 연료 도입 가격에 영향을 준다.','천연가스·해운'),
  link('chai','austran','trade','철광석 선적과 제철 수요','제철소의 가동률에 맞춰 벌크선이 광산 항만의 화물을 실어 나른다.','광업·해운'),
  link('chai','brazin','trade','구리 정련과 대두 조달','남아메리카연합의 구리·대두가 태평양 항로를 거쳐 가공단지에 도착한다.','비철금속·식품'),
  link('chai','vietlan','talk','접경 통관과 전자부품','접경 물류단지의 검사 시간이 반도체 조립 공장의 부품 재고를 좌우한다.','전자조립·운송'),
  link('chai','misran','trade','대륙 에너지 회랑','에너지 도입 계약에는 국경 철도의 환적 일정과 파이프라인 정비 기간이 함께 반영된다.','천연가스·철도'),
  link('vietlan','misran','talk','인도양 항로와 비료 운임','비료와 발전 연료의 장거리 계약에 해협 운항 비용을 반영한다.','비료·해운'),
  link('vietlan','austran','trade','광물과 도서 항만','광석 선적과 수산물 냉장 운송을 도서 항로에 배분한다.','광물·수산물'),
  link('misran','azania','talk','홍해 회랑과 곡물 통관','인접 지역의 통관 일정과 곡물 비축을 맞춰 항구 대기 시간을 줄인다.','농산물·해운'),
  link('azania','brazin','trade','비료와 파종 일정','대서양을 건너는 비료 선박의 도착일이 파종과 수매 일정에 영향을 준다.','비료·곡물'),
  link('kanora','brazin','talk','운하 배선과 국경 물류','양측 항만이 운하 예약과 컨테이너 환적 일정을 협의한다.','운하·물류'),
];
