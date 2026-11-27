import {canonicalCountry} from './atlas-data.mjs';
import {actualTimestamp,tapeEpochDay} from './clock-calendar.mjs';

export const candidates={
  progressive:{
    id:'progressive',name:'조현덕',party:'시민미래당',orientation:'진보',lean:'진보',
    platform:'조선·자동차 직업훈련 지원과 지역 전력망 보강을 추진해.',
    priority:'직업훈련과 전력망 보강',
    opposition:'자유경제당은 직업훈련 보조금의 기업 부담과 전력망 예산 규모를 따져 묻는다.'
  },
  conservative:{
    id:'conservative',name:'윤준오',party:'자유경제당',orientation:'보수',lean:'보수',
    platform:'제조업 투자세액공제와 수출 서류 간소화를 추진해.',
    priority:'제조업 투자와 수출 절차 개선',
    opposition:'시민미래당은 투자세액공제로 인한 세수와 신규 고용 효과를 점검하자고 요구한다.'
  }
};

// The market tick epoch is 09:00 KST, or 00:00 UTC, on the opening day.
const epoch=tapeEpochDay*86_400_000;
const tickMs=300_000;
const actualTick=tick=>actualTimestamp(epoch+tick*tickMs);
let electedTerms=[];

export function setElectedPolicy(termOrTerms){
  const terms=Array.isArray(termOrTerms)?termOrTerms:[termOrTerms];
  const next=terms.filter(t=>t&&Object.hasOwn(candidates,t.candidate)&&
    Number.isSafeInteger(t.effectiveAt)&&t.effectiveAt>0)
    .map(({candidate,effectiveAt})=>({candidate,effectiveAt}))
    .sort((a,b)=>a.effectiveAt-b.effectiveAt);
  const changed=next.length!==electedTerms.length||next.some((t,i)=>t.candidate!==electedTerms[i].candidate||
    t.effectiveAt!==electedTerms[i].effectiveAt);
  if(changed)electedTerms=next;
  return changed;
}

const termAt=asOf=>electedTerms.findLast(t=>t.effectiveAt<=asOf);

export function electedAt(tick){
  const term=termAt(actualTick(tick));
  return term?candidates[term.candidate]:null;
}

const agendas={
  progressive:{
    lumen:['산업 전환 협의 확대','한국 정부는 유럽연합과 조선·자동차 노동자 직업훈련을 우선 논의한다. 사업 참여 기업과 재원은 양국 실무회의에서 정하기로 했다.']
  },
  conservative:{
    arden:['공급망 협의 확대','한국 정부는 미국과 반도체 수출 서류를 줄이는 방안을 우선 논의한다. 심사 기준을 바꾸려면 양국 당국의 별도 협의가 필요하다.']
  }
};

const agendaDurationMs=3*86_400_000;

export function diplomaticAgenda(a,b,tick){
  const partner=canonicalCountry(a==='mora'?b:b==='mora'?a:null);
  if(!partner)return null;
  const asOf=actualTick(tick),term=termAt(asOf);
  if(!term||asOf>=term.effectiveAt+agendaDurationMs)return null;
  return agendas[term.candidate][partner]??null;
}

// Extra commentary is confined to the governing lean's good economic news.
const followUps={
  progressive:{
    SLYD:['workday','조선 협력사, 친환경 선박 일감에 기대','조선업계는 장비 주문이 생산 일정으로 확정되면 용접과 장비 검사 인력이 더 필요할 것으로 본다.'],
    ONTL:['tideline','전력 설비 수요 회복에 지역망 투자 관심','데이터센터 전력 계약이 설비 증설로 이어질 경우 지역 변전소와 배전업체에도 발주가 돌아갈 수 있다.'],
    DYFD:['citizen','냉장 물류 회복에 산지 집하장 숨통','산지 업체들은 배송 물량이 늘면 공동 집하장 가동률이 높아질 것으로 본다. 소매 가격에는 재고 소진과 매장별 납품 계약이 변수다.'],
    GGPM:['workday','공정 장비 주문 반등, 현장 교육 재개 기대','장비 설치가 늘면 협력사의 정밀공정 교육 일정도 다시 잡힐 수 있다. 추가 채용은 고객사의 실제 인도 시점에 맞춰 결정된다.']
  },
  conservative:{
    BMEM:['mora-daily','칩 검사장비 개선에 북미 납품망 투자 기대','검사장비 업체들은 출하 회복이 이어질 경우 미국으로 보내는 예비 부품 재고를 늘릴 여력이 생길 것으로 본다.'],
    WJBT:['quay-post','전지 소재 회복에 수출 항만 물동량 기대','북항 물류업계는 소재 수출이 회복될 경우 기존 항차에 배정한 비어 있는 적재 공간을 채울 수 있다고 본다. 실제 물량은 통관 일정에 달려 있다.'],
    YJRX:['nubo-econ','위탁생산 회복에 의약품 해외 납품 기대','제약업계에서는 생산 물량이 실제 출하로 이어지면 다음 분기 수출 매출에도 보탬이 될 것으로 본다. 품목별 허가 일정은 유지된다.'],
    SBEN:['nubo-econ','배전설비 발주 회복에 제조업 투자 관심','부품 공급업체들은 확정된 발주가 누적되면 노후 생산설비를 교체할 여지가 생길 것으로 본다. 계약별 투자 집행 시점은 다르다.']
  }
};

export const policyStoryChance=.03;

function slotRoll(tick){
  let h=(tick^0x3c29b07d)>>>0;
  h=Math.imul(h^(h>>>16),0x7feb352d);
  h=Math.imul(h^(h>>>15),0x846ca68b);
  return ((h^(h>>>16))>>>0)/2**32;
}

export function policyFollowUp(event){
  const winner=electedAt(event.tick),main=event.stories[0];
  if(!winner||main.outletInfo.nation!=='mora'||main.outletInfo.lean!==winner.lean)return null;
  const code=main.related.find(code=>event.shock[code]>0&&Object.hasOwn(followUps[winner.id],code));
  if(!code||slotRoll(event.tick)>=policyStoryChance)return null;
  return followUps[winner.id][code];
}
