import {instrumentIndustryIds,stocks,symbolIndex} from './securities-data.mjs';
import {industryLabels} from './industries.mjs';
import {canonicalCountry} from './atlas-data.mjs';

const excludedCountries=new Set(['haeon','chai']);
const excludedRegion=/일본|중국|동북아시아연합|요코하마|도쿄|상하이|베이징|日本|中国|\b(?:Japan(?:ese)?|China|Chinese|Northeast Asian Union|Yokohama|Tokyo|Shanghai|Beijing)\b/i;
export function isPublishedStory(story) {
  if(!story||excludedCountries.has(story.outletInfo?.nation)||story.countries?.some(id=>excludedCountries.has(canonicalCountry(id))))return false;
  if(story.related?.some(code=>excludedCountries.has(stocks[symbolIndex[code]]?.country)))return false;
  return ![story.ko,story.en].some(edition=>edition&&[edition.title,edition.lead,...(edition.body??[])].some(text=>excludedRegion.test(text??'')));
}

// Named operating relationships in the game. The price tape is not a source of evidence.
const partnerships = [
  ['NORD','VOLT','가스 공급사와 전력을 생산하는 연료 구매사'],
  ['MNRD','HARB','화물 철도와 항만에서 인계받는 선사'],
  ['ARC','BMEM','반도체 설계사와 메모리 공급사',3*288+194],
  ['LMX','RAIL','철도 장비 공급사와 철도 운영사'],
  ['SVHT','YJRX','의약품 위탁공급사와 제약사'],
  ['RTKW','IRPK','산업 부품 공급사와 조립설비 업체'],
  ['HARB','TIDE','선박 수리를 발주한 선사와 수리 조선소',4*288],
  ['MOON','MART','냉장 화물 운송사와 상품을 판매하는 유통사',90],
];

export const isNewsListing = code => Object.hasOwn(symbolIndex,code) && !stocks[symbolIndex[code]].archiveOnly;

export function relatedIndustryIds(story){
  // Coverage may name an industry with no listed company. Otherwise use the published links.
  const ids=story.industryIds??story.event?.industryIds??
    (story.related??[]).flatMap(code=>instrumentIndustryIds(stocks[symbolIndex[code]],story.event?.day));
  return [...new Set(ids)].filter(id=>Object.hasOwn(industryLabels,id));
}

export function publicNewsLinks(story) {
  const direct = [...new Set(story.related || [])].filter(isNewsListing);
  const partners = new Map();
  for (const [supplier,customer,relationship,knownAt=-Infinity] of partnerships) {
    if (story.event.tick < knownAt) continue;
    const other = direct.includes(supplier) ? customer : direct.includes(customer) ? supplier : null;
    if (other && isNewsListing(other) && !direct.includes(other)) partners.set(other,relationship);
  }
  return {direct,indirect:[...partners.keys()],partners};
}
