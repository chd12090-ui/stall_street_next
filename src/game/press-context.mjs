// Reported details from the scenario's dispatches. The cues avoid repeating a detail
// already present in a particular edition of the story.
export const pressContext={
  'm1-strait':{
    ko:[[/등부표.{0,9}(?:2기|두 기)/,'당국은 사고 해역에서 등부표 두 기가 사라진 것을 확인했다.'],[/18시간|열여덟 시간/,'북항으로 가는 배가 외해로 우회하면 항해 시간이 약 18시간 늘어난다.']],
    en:[[/two (?:light )?buoys|2 (?:light )?buoys/i,'The navigational notice says two light buoys are missing.'],[/18 hours/i,'The offshore detour adds about 18 hours to the North Port voyage.']],
  },
  'm2-cold-vans':{
    ko:[[/8대|여덟 대/,'공시에 따르면 두 회사는 냉장차 8대를 투입해 2주간 시험 운행한다.'],[/하루.{0,6}(?:두 번|2회|두 차례)/,'운임이 보장된 운행은 하루 두 차례다.']],
    en:[[/eight (?:trucks|refrigerated)|8 (?:trucks|refrigerated)/i,'The trial will use eight refrigerated trucks over two weeks.'],[/two trips a day|two daily trips/i,'The partners guarantee two trips a day.']],
  },
  'm3-arden-rates':{
    ko:[[/3\.25%/,'미국 연방준비위원회는 기준금리를 연 3.25%로 동결했다.'],[/다섯.{0,8}네|5명.{0,9}4명/,'위원 다섯 명 가운데 네 명이 동결에 표를 던졌다.']],
    en:[[/3\.25%/,'The US Federal Reserve Committee held its benchmark rate at 3.25%.'],[/four.{0,10}five|4–1/i,'Four of the five committee members voted to hold.']],
  },
  't1-cathode-test':{
    ko:[[/열두|12상자/,'세관은 한 선적분에 든 원료 12상자를 검사 구역에 뒀다.'],[/사흘째|3일째/,'계약상 선적이 사흘째 밀리면 지체료가 붙는다.']],
    en:[[/12 crates|twelve crates/i,'Customs kept all 12 crates in the consignment at the inspection site.'],[/day three|third day/i,'Late-delivery charges begin on the third day under the supply contract.']],
  },
  't2-lumen-settlement':{
    ko:[[/장기.{0,9}한 건|계약.{0,5}1건/,'당국이 시범 대상으로 승인한 것은 기존 장기공급계약 한 건이다.'],[/확정.{0,7}않|환율.{0,10}오르면|환율은.{0,10}묶/,'첫 대금에 적용할 원·파운드 환율은 결제일에 정해진다.']],
    en:[[/one.{0,18}(?:contract|agreement)|first long-term/i,'The pilot covers one existing long-term supply contract.'],[/exchange rate|sterling rate|unhedged/i,'The parties have yet to lock in a won–sterling rate for the first payment.']],
  },
  't3-nova-power':{
    ko:[[/다음 달|다음달/,'동관의 전력 설비 재검사는 다음 달로 잡혔다.'],[/사용료|고객.{0,8}요금/,'현재 고객 사용료를 청구할 수 있는 곳은 앞서 허가받은 서관뿐이다.']],
    en:[[/next month/i,'Inspectors are due to return to the east hall next month.'],[/bill|usage charges/i,'For now only the operating west hall can bill customers for use.']],
  },
  'w1-convoy':{
    ko:[[/11척|열한 척/,'주간 배정표에서 통과를 승인받은 배는 6척으로 집계됐다. 나머지 11척은 대기 명단에 남았다.'],[/야간.{0,13}(?:유지|중단|제한|금지)/,'해협의 야간 통항 제한은 계속된다.']],
    en:[[/11 (?:wait|vessels|ships)|eleven/i,'The daylight roster cleared six vessels and left 11 waiting.'],[/night.{0,18}(?:restrict|remain|closed)/i,'Restrictions on night passages remain in place.']],
  },
  'w2-gas-storage':{
    ko:[[/3일분|사흘분|사흘치|3일치/,'유럽연합 에너지청은 난방용 비축분 사흘치를 풀기로 했다.'],[/민간.{0,8}재고/,'정부는 이번 인출 물량을 민간 판매 재고와 따로 집계한다.']],
    en:[[/three days|3 days/i,'The energy agency approved the release of three days’ worth of heating reserves.'],[/private stocks|commercial inventory/i,'The agency records those public stocks separately from saleable private inventory.']],
  },
  'w3-chain-settlement':{
    ko:[[/2곳|두 곳/,'시범 규정의 적용을 받는 등록 송금사는 두 곳이다.'],[/냥이코인/,'결제원은 이더리움으로 네트워크 수수료를 받기로 했다. 냥이코인은 지정 경로에 들지 않았다.']],
    en:[[/two (?:registered )?remitters|2 (?:registered )?remitters/i,'Two registered remitters qualify for the pilot.'],[/Nyangcoin/i,'The clearing authority authorised fees in ETH and left Nyangcoin outside the route.']],
  },
  'h1-rail-freight':{
    ko:[[/30상자|서른 상자/,'운행표에 오른 하루 최대 적재량은 30상자다.'],[/20상자|스무 상자/,'운임이 보장된 물량은 20상자분으로, 나머지 10상자는 아직 화주가 정해지지 않았다.']],
    en:[[/30 (?:chilled )?crates|thirty crates/i,'The timetable allows for up to 30 chilled crates a day.'],[/20 crates|twenty crates/i,'The carriage agreement guarantees payment on 20 crates. Ten have no committed shipper.']],
  },
  'h2-crown-collateral':{
    ko:[[/65%/,'은행은 무역금융의 담보인정률을 기존 80%에서 65%로 내렸다.'],[/신규.{0,5}갱신/,'새 조건은 신규 대출과 만기 뒤 갱신하는 대출부터 적용한다.']],
    en:[[/65%/,'The bank cut the advance rate on eligible collateral from 80% to 65%.'],[/origination|renewal|new and renewed/i,'The revised terms apply to new lending and renewals.']],
  },
  'h3-chip-export':{
    ko:[[/절반|50%/,'노스스타는 허가된 수량의 약 절반에 대해 구매 의사가 확인됐다고 밝혔다.'],[/고성능.{0,10}심사/,'고성능 모듈은 통상청의 별도 심사를 받고 있다.']],
    en:[[/half|50%/i,'Northstar confirmed buyers for about half of the licensed units.'],[/high.performance.{0,22}review/i,'The trade office is still reviewing the higher-performance modules.']],
  },
  'f1-yard-contract':{
    ko:[[/20%/,'계약금은 전체 수리 대금의 20%다. 잔금 80%는 인도 검사 뒤에 지급한다.'],[/2척|두 척/,'계약 대상은 냉장 컨테이너선 두 척이다.']],
    en:[[/20%/,'The contract calls for a 20% deposit, with the remainder payable after acceptance.'],[/two.{0,23}ships|2.{0,23}ships/i,'Two refrigerated container ships are covered by the agreement.']],
  },
  'f2-strait-renewal':{
    ko:[[/일몰|해가 진/,'공동 항행통보에 따르면 일몰부터 양방향 통항이 재개된다.'],[/환급|돌려받/,'이미 출항한 선박에 붙은 보험료 할증은 일괄 환급하지 않는다.']],
    en:[[/sunset|dusk/i,'The joint notice clears traffic in both directions from sunset.'],[/refund/i,'Insurers have ruled out a blanket refund on voyages already under way.']],
  },
  'f3-payrolls':{
    ko:[[/1\.4만|1만 ?4천|14,000/,'미국 통계원은 신규 고용이 1만 4천 명 늘었다고 발표했다. 사전 조사의 중앙값은 3만 명이었다.'],[/2만 ?1천|2\.1만|21,000/,'직전 달 증가분은 2만 8천 명에서 2만 1천 명으로 하향 수정됐다.']],
    en:[[/14,000/,'Payrolls rose by 14,000 against a median forecast for a gain of 30,000.'],[/21,000/,'The statistics office revised the previous month’s gain down to 21,000 from 28,000.']],
  },
  'weekend-clearing':{
    ko:[[/두 곳|2곳/,'미국 서부 결제협회는 결제업체 두 곳이 정산 확인 시간을 연장했다고 밝혔다.']],
    en:[[/two processors|two settlement/i,'The western payments association said two processors had extended their settlement checks.']],
  },
  'weekend-reopen':{
    ko:[[/선하증권/,'항만정산소가 재처리를 완료한 건은 처리가 밀린 전자 선하증권 지급분이다.']],
    en:[[/bills of lading/i,'The clearing office has reprocessed the electronic bills of lading held during the disruption.']],
  },
  'zelanda-election':{
    ko:[[/82%/,'선거위원회가 발표한 지역구 개표율은 82%다. 의석과 예산안은 새 의회에서 확정된다.']],
    en:[[/82%/,'The electoral commission reported 82% of constituency votes counted. Seat allocations remain provisional.']],
  },
  'wire-asia':{ko:[[/40건/,'세 항구가 공개한 합동 지침에 따라 전자 원산지 확인을 4주간 최대 40건에 시범 적용한다.']],en:[[/40 consignments/i,'The three ports will test the procedure on up to 40 consignments over four weeks.']]},
  'wire-europe':{ko:[[/12 ?GWh/,'공동 입찰서에 오른 역방향 운송 용량은 하루 12GWh다.']],en:[[/12 GWh/i,'The auction offers 12 GWh a day of reverse-flow capacity.']]},
  'wire-north':{ko:[[/6%/,'온도 기록을 전 구간에서 제출한 화물은 파손 보험료를 6% 할인받을 수 있다.']],en:[[/6%/,'The renewal notice offers a 6% damage-premium discount on voyages with unbroken temperature records.']]},
  'wire-south':{ko:[[/3곳|세 곳/,'공동위원회는 12월 배정표에 광석 전용 선석 세 곳을 추가했다.']],en:[[/three.{0,14}berths/i,'The council’s December schedule adds three dedicated ore berths.']]},
  'wire-africa':{ko:[[/1,800만|1800만/,'은행 3곳이 설정한 보증 한도는 1,800만 달러다. 실제 보증은 선적 서류를 확인한 뒤 건별로 이뤄진다.']],en:[[/18mn|18 million/i,'The three banks set an $18 million guarantee ceiling, with each draw subject to proof of shipment.']]},
  'wire-pacific':{ko:[[/9만|90,000/,'항만공사들이 공고한 공동 입찰 물량은 6개월간 9만 배럴이다.']],en:[[/90,000/,'The joint tender covers 90,000 barrels over six months.']]},
};
