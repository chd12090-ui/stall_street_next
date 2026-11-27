export const startingDailySalary=300_000;
export const maxRaise=10;
export const negotiationAdSeconds=5;
export const failureBonusPoints=2;

const validRaise=raise=>Number.isInteger(raise)&&raise>=1&&raise<=maxRaise;
const raisedWage=(salary,raise)=>salary+Math.round(salary*raise/100);

export function dailySalary(state){
  const last=state.salaryNegotiation;
  if(!last)return startingDailySalary;
  return last.success?raisedWage(last.previousSalary,last.raise):last.previousSalary;
}

const baseOdds=raise=>(maxRaise+1-raise)*10;
const correctedOdds=(base,correction)=>Math.min(100,base+correction);

function terms(previousSalary,raise,priorFailures){
  const baseChance=baseOdds(raise);
  const correction=priorFailures*failureBonusPoints;
  return {previousSalary,raise,priorFailures,baseChance,correction,chance:correctedOdds(baseChance,correction),offeredSalary:raisedWage(previousSalary,raise)};
}

export function salaryQuote(state,raise){
  if(!validRaise(raise))return null;
  const last=state.salaryNegotiation;
  const failures=last&&!last.success?last.priorFailures+1:0;
  return terms(dailySalary(state),raise,failures);
}

export function todaysNegotiation(state){
  const last=state.salaryNegotiation;
  return last?.day===state.day?{...terms(last.previousSalary,last.raise,last.priorFailures),success:last.success}:null;
}

// Older saves kept only the last offer. Two consecutive daily payslips can
// also identify a successful raise exactly. Unchanged pay cannot prove a rejection.
function raisesFromPayslips(state){
  const records=[];
  let priorDay=(state.openingDay??0)-1,priorPay=startingDailySalary;
  for(const {day,bill} of state.history??[]){
    if(day>=state.salaryNegotiation.day)break;
    const pay=bill?.incomePeriod==='day'?bill.income-bill.bonus:NaN;
    if(day===priorDay+1&&Number.isSafeInteger(pay)&&priorPay>=startingDailySalary&&pay>priorPay){
      const raise=Math.round((pay-priorPay)*100/priorPay);
      if(validRaise(raise)&&raisedWage(priorPay,raise)===pay)records.push({day,raise,success:true});
    }
    priorDay=day;
    priorPay=pay;
  }
  return records;
}

// Legacy archives can begin with successful raises inferred from payslips.
// A gap in that prefix may hide a rejection. Preserve unknown odds explicitly.
function historicalOffers(state,last){
  const rows=state.salaryHistory??raisesFromPayslips(state);
  let day=(state.openingDay??0)-1,failures=0,complete=false;
  const offers=rows.map(row=>{
    if(!complete&&row.day>day+1)failures=null;
    const base=baseOdds(row.raise);
    const chance=row.chance!==undefined?row.chance:base===100?100:
      failures===null?null:correctedOdds(base,failures*failureBonusPoints);
    if(!row.success||row.chance!=null)complete=true;
    failures=row.success?0:failures===null?null:failures+1;
    day=row.day;
    return {...row,chance};
  });
  // The last offer stores its exact incoming streak. This also identifies
  // the odds of earlier archived rejections in that streak, even on skipped days.
  let start=offers.length;
  while(start>0&&!offers[start-1].success)start--;
  if(offers.length-start===last.priorFailures){
    for(let i=start;i<offers.length;i++){
      const offer=offers[i];
      if(offer.chance==null)offer.chance=correctedOdds(baseOdds(offer.raise),(i-start)*failureBonusPoints);
    }
  }
  return offers;
}

export function salaryHistory(state){
  const last=state.salaryNegotiation;
  if(!last)return [];
  const {day,raise,success,priorFailures}=last;
  const chance=last.chance??correctedOdds(baseOdds(raise),priorFailures*failureBonusPoints);
  return [...historicalOffers(state,last),{day,raise,chance,success}];
}

// Only called after the ad finishes, while holding the game save lock.
export function negotiateSalary(state,raise,random=Math.random){
  if(state.phase!=='open'||state.salaryNegotiation?.day>=state.day)return false;
  const quote=salaryQuote(state,raise);
  if(!quote||!Number.isSafeInteger(quote.offeredSalary))return false;
  const success=random()*100<quote.chance;
  state.salaryHistory=salaryHistory(state);
  state.salaryNegotiation={day:state.day,raise,previousSalary:quote.previousSalary,priorFailures:quote.priorFailures,chance:quote.chance,success};
  return true;
}

const validChance=value=>Number.isInteger(value)&&value>=1&&value<=100;
export function validSalaryRecord(state){
  const last=state.salaryNegotiation;
  const archived=state.salaryHistory;
  if(archived!==undefined&&(!Array.isArray(archived)||!archived.every((row,index)=>
    Number.isSafeInteger(row?.day)&&row.day<last?.day&&(!index||row.day>archived[index-1].day)&&
    validRaise(row.raise)&&(row.chance==null||validChance(row.chance))&&typeof row.success==='boolean')))return false;
  if(last===undefined)return true;
  return !!last&&Number.isSafeInteger(last.day)&&last.day<=state.day&&validRaise(last.raise)&&
    Number.isSafeInteger(last.previousSalary)&&last.previousSalary>=startingDailySalary&&
    Number.isSafeInteger(raisedWage(last.previousSalary,last.raise))&&
    Number.isSafeInteger(last.priorFailures)&&last.priorFailures>=0&&(last.chance===undefined||validChance(last.chance))&&
    typeof last.success==='boolean';
}
