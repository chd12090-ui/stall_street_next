// Only archived days can contain the retired billing and purchase entries.
export function wageLabel(bill){
  if(Number.isFinite(bill?.bonus))return '일급 및 보너스';
  return bill?.income&&bill.incomePeriod!=='day'?'이전 급여 정산':'일급';
}
export const recordedBillPaid=bill=>Math.max(0,(bill?.due??0)-(bill?.debt??0));

export function recordedPurchase(record){
  if(!record?.buyItem&&!record?.purchase)return null;
  return {amount:record.purchase?.amount??80_000,seq:record.purchase?.seq};
}
