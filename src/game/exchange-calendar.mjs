import {stocks,markets} from './world.mjs';
import {civilDate,tapeEpochDay,venueClockText} from './clock-calendar.mjs';
import {filingMarketTick,filingOnDay} from './company-filings.mjs';

export const calendarKinds={listing:'상장공시',merger:'합병공시',earnings:'실적발표'};
const dayMs=86_400_000;
const listings=stocks.filter(asset=>!asset.archiveOnly&&asset.listed);
const equities=listings.filter(asset=>asset.kind==='주식');
const disclosureNotices=[
  {kind:'listing',date:'2026-11-27',time:'10:00',title:'한강 중소형주 ETF 상장 예비공시',
    description:'한강자산운용이 국내 중소형주 지수 추종 ETF의 상장 심사를 신청해. 상장일과 종목 코드는 심사 뒤 확정돼.'},
  {kind:'merger',date:'2026-11-29',time:'11:00',title:'이음철도 물류 자회사 흡수합병 추진',
    description:'물류 자회사 운영을 통합하는 방안을 검토해. 이사회 의결 뒤 합병 조건과 후속 일정을 공개할 예정이야.'},
  {kind:'merger',date:'2026-12-08',time:'14:00',title:'장터마트 지역 유통 자회사 합병 안건',
    description:'지역 유통 자회사 통합이 이사회 안건에 올라. 합병 비율과 시행일은 후속 공시에서 확인할 수 있어.'},
];

export function calendarDay(date){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  const day=Date.parse(date+'T00:00:00Z')/dayMs-tapeEpochDay;
  return Number.isInteger(day)&&civilDate(day)===date?day:null;
}

export function calendarEvents(state,date){
  const day=calendarDay(date);
  if(day===null)return [];
  const today=civilDate(state.day),events=listings.filter(asset=>asset.listed===date).map(asset=>({
    id:'listing-'+asset.code,kind:'listing',title:asset.name+' 상장',
    description:markets[asset.market].venue+' · '+asset.kind+' · '+asset.ticker,upcoming:date>today,
  }));
  for(const notice of disclosureNotices.filter(notice=>notice.date===date)){
    events.push({...notice,id:notice.kind+'-'+date,upcoming:date>today||date===today&&notice.time>venueClockText(state)});
  }
  const filing=filingOnDay(day);
  if(filing){
    const companies=equities.filter(asset=>asset.listed<=date).map(asset=>asset.name);
    const {period,time,tick}=filing;
    events.push({id:'earnings-'+date,kind:'earnings',time,title:period.year+'년 '+period.quarter+'분기 실적 발표',companies,
      description:'게임 회계 기간 '+period.start+' ~ '+period.end,upcoming:tick>filingMarketTick(state)});
  }
  return events;
}
