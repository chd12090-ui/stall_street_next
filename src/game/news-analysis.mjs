import {articleById, visibleStories, printedTick, stocks, symbolIndex} from './world.mjs';
import {eventIdentity} from './disclosure-event.mjs';
import {filingEventImpact} from './company-events.mjs';

import {publicNewsLinks,isNewsListing} from './news-relations.mjs';
export {publicNewsLinks};

const pathways = {
  redemption:['지정참가사의 환매 처리가 밀리고 있어.','환매가 막히면 시장가격과 순자산가치의 차이를 줄이기 어려워질 수 있어.','괴리율 · 시세','환매가 재개된 뒤 괴리율이 좁혀지는지 확인해.','valuation'],
  orders:['고객의 주문이 납품과 검수로 이어지는 일정이 달라질 수 있어.','인도 조건을 충족하면 매출을 인식하고 외상 판매분은 대금을 받을 때 현금이 들어와.','매출 증가율 · 영업현금흐름','확정 계약, 취소 가능 물량, 선급금과 잔금 지급일을 살펴봐.','growth'],
  outlook:['회사가 앞으로 예상하는 주문량이나 시장 수요를 조정했어.','예상 물량 중 실제 계약과 납품까지 이어진 부분이 이후 매출에 반영될 수 있어.','매출 증가율','같은 기간의 실제 신규 계약과 납품 공시를 기다려 봐.','growth'],
  logistics:['운송 경로·납품 일정이 바뀌면 대기 시간과 비용 부담도 달라질 수 있어.','운송비가 먼저 나가고 인도와 대금 회수가 늦어지면 영업현금흐름이 줄 수 있어.','매출채권 회수기간 · 영업현금흐름','대체 항로, 이미 확보한 재고, 비용을 부담할 계약 당사자를 확인해.','activity'],
  input:['원재료의 조달 조건과 실제 사용 시점에 따라 생산비가 달라질 수 있어.','새 가격으로 들여온 재고를 판매할 때 매출원가가 달라져. 대금 지급은 그보다 앞설 수 있어.','영업이익률 · 영업현금흐름','보유 재고, 장기 계약의 고정 단가, 판매가격에 반영하는 시차를 확인해.','profitability'],
  capital:['시설을 쓰기 시작하는 시점과 실제 가동률이 달라질 수 있어.','설비 대금을 지급하면 투자현금흐름에 먼저 나타나고 가동 이후 감가상각과 매출이 달라질 수 있어.','투자활동 현금흐름 · 총자산회전율','취득 대금의 지급일, 사용 승인 범위와 실제 매출을 나눠서 봐.','cash'],
  finance:['신규 차입과 변동금리 대출의 재설정 조건에 따라 조달비용이 달라질 수 있어.','이자가 달라지는 시점에 금융비용이 바뀌고, 실제 지급일에 현금이 움직여.','이자보상비율 · 영업현금흐름','고정금리 비중, 재설정일, 차입 만기를 확인해.','liquidity'],
  currency:['대금을 받을 통화와 원재료를 지불할 통화가 다르면 환율에 노출돼.','외화 매출·매입과 외화부채의 방향, 결제 환율에 따라 이익과 현금이 다르게 움직일 수 있어.','영업이익률 · 영업현금흐름','계약 통화, 환헤지 범위, 실제 환전일을 확인해.','cash'],
  governance:['공개된 경영진 변동이나 조사로 계약 집행과 승인 일정이 달라질 수 있어.','계약 취소나 손실이 확인되어야 실적 영향을 추적할 수 있어. 조사 대상 금액과 확정 손실액은 구분해.','영업현금흐름 · 순이익률','공식 조사 결과, 실제 지급 보류액과 후속 공시를 확인해.','cash'],
  bank:['대출의 담보 조건과 차주의 상환 여력에 따라 신규·갱신 여신의 규모가 달라질 수 있어.','대출이 실행되고 이자가 발생하는 동안 이자수익·손실충당 비용이 달라질 수 있어.','순이익률 · ROA','기존 대출의 만기, 실제 연체와 충당금 공시를 확인해.','profitability'],
  demand:['고객이 서비스를 찾아 결제하는 양과 시점이 달라질 수 있어.','판매량·가격·환불 규모에 따라 매출과 실제 회수액이 달라질 수 있어.','매출 증가율 · 영업현금흐름','일시적인 지연인지, 계약 취소 또는 확정 환불인지 확인해.','growth'],
  neutral:['기사에 나온 변화가 이 회사의 고객이나 공급처와 어떻게 연결되는지 먼저 살펴봐.','영향받는 계약과 노출 금액이 공개되면 매출·비용·현금 중 어느 항목에 반영될지 확인할 수 있어.','영업현금흐름','회사 이름, 적용 대상, 금액과 기준 기간이 명시된 후속 공시를 확인해.','cash'],
};
const classification = {
  'm1-strait':'logistics','m2-cold-vans':'orders','m3-arden-rates':'finance',
  't1-cathode-test':'logistics','t2-lumen-settlement':'currency','t3-nova-power':'capital',
  'w1-convoy':'logistics','w2-gas-storage':'input','w3-chain-settlement':'demand',
  'h1-rail-freight':'orders','h2-crown-collateral':'finance','h3-chip-export':'orders',
  'f1-yard-contract':'orders','f2-strait-renewal':'logistics','f3-payrolls':'demand',
  'wire-asia':'logistics','wire-europe':'input','wire-north':'logistics','wire-south':'logistics',
  'wire-africa':'finance','wire-pacific':'input','weekend-clearing':'demand','weekend-reopen':'demand',
};

function pathway(article,asset) {
  const title = article.title;
  const kind = article.impactPath??classification[article.event.id];
  if(kind==='redemption')return pathways.redemption;
  if (asset.kind === '추종상품') return ['기사에 노출된 기초자산을 상품의 편입 종목에서 찾아봐.','기초자산의 변동은 편입 비중과 추종 배율에 따라 상품 가격에 다르게 전달될 수 있어.','편입 비중 · 추종 배율 · 보수','기초자산과 상품의 거래시간, 일간 추종과 환율 차이를 확인해.','valuation'];
  if (asset.kind === '현물 코인') return ['거래와 송금이 이루어지는 네트워크의 이용 조건을 살펴봐.','입출금 대기나 수수료는 코인 이용 수요·거래 여건에 영향을 줄 수 있어.','현재가 · 등락률','해당 네트워크와 거래소, 적용 기간을 확인해.','valuation'];
  if (/은행|캐피탈|금융|보험/.test(asset.sector) && (kind==='finance' || /대출|담보|대손|여신|이자/.test(title))) return pathways.bank;
  if (kind) return pathways[kind];
  if (/주문 전망|수요 전망|예상 발주/.test(title)) return pathways.outlook;
  if (/수사|이사회|감사위|CEO|횡령|의혹/.test(title)) return pathways.governance;
  if (/설비투자|증설|가동 승인/.test(title)) return pathways.capital;
  if (/공급 차질|가스관|원자재|원재료/.test(title)) return pathways.input;
  if (/선적|통관|출항|우회|지진|접경|운항|운송|화물/.test(title)) return pathways.logistics;
  if (/계약|출하|수주|구매확약/.test(title)) return pathways.orders;
  if (/결제|환불|구매 중단/.test(title)) return pathways.demand;
  return pathways.neutral;
}

const cashPath = {
  '검수·납품':'납품을 인수하면 매출을 기록해. 외상 대금이 남으면 매출채권이 생기고 회수할 때 현금이 들어와.',
  '조달·비용':'사용한 원료나 운송 서비스의 단가가 달라지면 원가와 이익률이 움직여. 이미 낸 대금과 나중에 지급할 대금은 현금에 반영되는 시점이 달라.',
  '재고 매입':'판매 전에는 입고 비용이 재고로 남아. 외상 대금 지급이 판매대금 회수보다 빠르면 현금 부담이 생길 수 있어.',
  '고객 선수금':'검수 전에 받은 현금은 아직 제공해야 할 서비스의 대가야. 매출을 기록할 때와 현금이 들어오는 날이 달라질 수 있어.',
  '상환·회수':'담보 조건이 적용되는 신규·갱신 대출의 집행액과 상환액에 따라 대출채권과 현금이 달라질 수 있어.',
  '외화 정산':'실제 지급일의 환율과 헤지 계약에 따라 자국 통화 지출과 금융손익이 달라질 수 있어.',
};
function linkedQuestion(metric,fallback) {
  const first=metric?.split(/[·,/]/)[0] || '';
  if (/회전|회수기간|보유기간|재고/.test(first)) return 'activity';
  if (/현금|취득지출|금융·기타손익/.test(first)) return 'cash';
  if (/이익률|매출원가|ROA|ROE/.test(first)) return 'profitability';
  if (/차입|부채|이자|유동/.test(first)) return 'liquidity';
  if (/매출|증가율/.test(first)) return 'growth';
  return fallback;
}

function unpackArticle(article, code) {
  const links=publicNewsLinks(article);
  if (!links.direct.includes(code) && !links.partners.has(code)) return null;
  const asset=stocks[symbolIndex[code]];
  const [business,financial,metric,condition,question]=pathway(article,asset);
  const indirect=links.partners.get(code);
  const entry=indirect ? null : filingEventImpact(article.event,asset);
  const doc=article.document?.ko;
  const facts=doc?.facts || [];
  const source=doc?.source || article.outletInfo.name;
  const relation=indirect ? indirect+'로 연결돼. 해당 회사의 계약에 실제로 적용되는지는 따로 확인해야 해.' : '';
  return {
    id:article.id, ...eventIdentity(article.event), publishedTick:printedTick(article), companyCode:code, headline:article.title,
    source, outlet:article.outletInfo.name, fact:facts[0] || article.ko?.lead || article.ko?.body?.[0] || article.title,
    body:article.ko?.body??[],
    business:entry?.business || business, financial:cashPath[entry?.channel] || financial, channel:entry?.channel || null,
    metric:entry?.metric || metric, conditions:[facts[2],entry?.condition || condition].filter(Boolean).join(' · '),
    question:linkedQuestion(entry?.metric,question), relation,
  };
}

export function articleEvidence(state,id,code) {
  const article=articleById(state,id);
  return article ? unpackArticle(article,code) : null;
}

export function companyNewsEvidence(state,code,limit=3) {
  if (!isNewsListing(code) || limit<=0) return [];
  const reports=visibleStories(state);
  const result=[],seen=new Set();
  for (const story of reports) {
    const key=eventIdentity(story.event).releaseId;
    if (seen.has(key)) continue;
    const evidence=unpackArticle(story,code);
    if (!evidence) continue;
    result.push(evidence);
    seen.add(key);
    if (result.length>=limit) break;
  }
  return result;
}

export function isOutlook(story) {
  return /주문 전망|수요 전망|실적 전망|시장 전망|매출 전망|주가 전망/.test(story.title);
}
