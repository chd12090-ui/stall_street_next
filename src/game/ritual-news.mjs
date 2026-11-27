import {stocks,symbolIndex} from './securities-data.mjs';
import {outlets} from './press-data.mjs';
import {ritualArticleId} from './ritual-rules.mjs';

const desk=outlets.find(o=>o.id==='nubo-econ');
// Each dispatch reports a concrete disruption and an open question. Its scope follows the drawn impact.
function incident(asset){
  if(asset.reference)return ['redemption','환매 접수 지연','지정참가사의 환매 처리에 지연이 생겼다.','시장가격과 순자산가치의 차이가 얼마나 오래 이어질지'];
  if(asset.code==='BIT')return ['demand','거래소 출금 지연','현물 거래소가 냥이코인 출금 일부를 점검 대상으로 돌렸다.','출금 대기가 해소되고 거래소 간 가격 차이가 좁혀지는지'];
  if(['DHCP','WFBK'].includes(asset.code))return ['bank','여신 심사 지연','기업대출 심사에서 서류 재검토가 시작돼 예정된 집행이 밀렸다.','대기 중인 대출의 집행 일정과 이자 수입이 어떻게 달라지는지'];
  if(['VOLT','QRGR'].includes(asset.code))return ['input','발전 설비 긴급 점검','발전 설비에서 이상 신호가 잡혀 예정에 없던 점검이 시작됐다.','설비 재가동 일정과 대체 전력 구매 비용이 얼마나 늘어나는지'];
  if(['MOON','HARB','RAIL'].includes(asset.code))return ['logistics','화물 인도 지연','운송 서류를 다시 확인하는 과정에서 화물이 출발 예정 시각을 넘겼다.','밀린 물량과 고객사에 지급할 지연 보상금 규모가 얼마인지'];
  if(['ALTQ','FLFX','NOVA'].includes(asset.code))return ['demand','서비스 접속 장애','운영사가 반복되는 접속 오류를 확인하고 복구 작업에 들어갔다.','복구 소요 시간과 고객 보상 범위가 어떻게 정해지는지'];
  if(asset.code==='MART')return ['demand','매장 결제 지연','일부 매장에서 결제 승인이 늦어져 손님들이 계산대에서 발길을 돌렸다.','승인 속도와 매장 방문객 수가 회복되는지'];
  return ['orders','납품 검수 지연','구매처가 추가 검수를 요청하면서 예정된 납품 일정이 밀렸다.','실제 인도 시점과 대금 회수가 얼마나 늦어지는지'];
}
export function ritualStory(row){
  const asset=stocks[symbolIndex[row.code]],name=asset.name,[impactPath,headline,lead,watch]=incident(asset);
  const scale=row.bps>=500?'여러 곳':row.bps>=200?'두 곳':'한 곳';
  const title=name+', '+headline,day=Math.floor(row.tick/288),minute=(row.tick-day*288)*5+(row.minuteOffset??0);
  const body=[lead,'현재까지 관련 현장 '+scale+'에서 차질이 확인됐다. 담당자는 정상화 일정을 다시 안내하기로 했다.','다음 보도에서는 '+watch+' 확인할 예정이다.'];
  const id=ritualArticleId(row.id),event={id,day,minute,tick:row.tick,title,urgent:true,newsCategory:'stock',shock:{[row.code]:-row.bps/10000},fx:{}};
  return {id,event,impactPath,outlet:desk.id,outletInfo:desk,lang:'ko',title,lead,body,ko:{title,lead,body},related:[row.code],countries:[asset.country],newsCategory:'stock'};
}
