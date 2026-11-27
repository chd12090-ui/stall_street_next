// All amounts are game won. Interest carries an integer numerator until payment, including through overnight settlement.
const CREDIT_LIMIT=3000000;
const APR_SCALE=10000,SLOTS=288,YEAR=365,INTEREST_DENOM=APR_SCALE*YEAR*SLOTS;
const banks=['한국생활은행','한강상호은행','다온저축은행'];
const bankName=name=>name==='한려생활은행'?banks[0]:name;
export function upgradeCreditBanks(credit){
  if(!credit)return emptyCredit();
  const renamed=row=>row.bank!==bankName(row.bank);
  const updated=row=>renamed(row)?{...row,bank:bankName(row.bank)}:row;
  const offers=credit.application?.offers;
  const quotesChanged=offers?.some(renamed);
  const ledgerChanged=credit.ledger.some(renamed);
  if(!quotesChanged&&!ledgerChanged&&(!credit.loan||!renamed(credit.loan)))return credit;
  return {...credit,application:quotesChanged?{...credit.application,offers:offers.map(updated)}:credit.application,
    ledger:ledgerChanged?credit.ledger.map(updated):credit.ledger,loan:credit.loan?updated(credit.loan):credit.loan};
}
const tick=s=>s.day*SLOTS+s.cursor;
const int=Number.isSafeInteger;
const positiveWon=amount=>int(amount)&&amount>0;
const estimatedDayInterest=(p,bps)=>Math.round(p*bps/(APR_SCALE*YEAR));
export const emptyCredit=()=>({used:false,application:null,loan:null,paidInterest:0,ledger:[]});
function carriedInterest(loan,now){return loan.interestNumerator+loan.principal*loan.aprBps*Math.max(0,now-loan.lastTick);}
function loanAt(s){
  const loan=s.credit?.loan;
  if(!loan)return null;
  const interest=Math.round(carriedInterest(loan,tick(s))/INTEREST_DENOM);
  return {bank:loan.bank,original:loan.original,principal:loan.principal,aprBps:loan.aprBps,apr:loan.aprBps/100,
    startDay:loan.startDay,startStep:loan.startStep,interest,total:loan.principal+interest,dailyInterest:estimatedDayInterest(loan.principal,loan.aprBps)};
}
export const outstandingCredit=s=>loanAt(s)?.total||0;
function applicationReason(s,amount,max,application){
  if(s.phase!=='open'||s.cursor>=SLOTS)return '하루 정산 중에는 새 대출을 신청할 수 없어.';
  if(s.credit?.used)return s.credit.loan?'이미 이용 중인 대출이 있어.':'이번 주 대출을 이미 이용했어.';
  if(application?.declined)return '오늘 조건은 거절했어. 다음 날 다시 신청할 수 있어.';
  if(max===0)return '현재 순자산으로 대출할 수 있는 금액이 없어.';
  if(amount===0)return '';
  if(!positiveWon(amount))return '1원 이상의 금액을 입력해 줘.';
  if(amount>max)return '신청액이 현재 심사 한도를 넘어.';
  if(application&&application.amount!==amount)return '오늘은 이미 신청액과 세 가지 금리가 확정됐어.';
  return '';
}
export function reviewCredit(s,amount,{netWorth,available,salary}){
  const credit=s.credit||emptyCredit(),loan=loanAt(s);
  const application=credit.application?.day===s.day?credit.application:null;
  const max=Math.max(0,Math.floor(Math.min(CREDIT_LIMIT,salary*21,netWorth*.35)));
  const requested=amount===0&&application?application.amount:amount;
  const exposure=Number.isFinite(requested)&&max>0?Math.min(1,Math.max(0,requested/max)):0;
  const losses=s.history.slice(-3).filter(r=>r.gains<0).length;
  const floor=475+Math.round(175*exposure)+18*losses;
  const reason=applicationReason(s,requested,max,application);
  const grade=max===0?'보류':floor<=600?'우량':floor<=750?'양호':'일반';
  return {max,available,netWorth,eligible:!reason,reason,used:credit.used,application,
    expiredDay:credit.application&&credit.application.day<s.day?credit.application.day:null,
    grade:application?.grade??grade,aprMin:application?.aprMin??floor/100,aprMax:application?.aprMax??(floor+350)/100,
    loan,liability:loan?.total||0,maxRepay:loan&&s.phase==='open'?Math.min(available,loan.total):0,paidInterest:credit.paidInterest,ledger:credit.ledger};
}
export function drawOffers(s,amount,review,rng=Math.random){
  const old=review.application;
  if(review.reason)return review.reason;
  if(!positiveWon(amount))return '1원 이상의 금액을 입력해 줘.';
  if(old)return old.amount===amount?'':'오늘은 이미 신청액과 금리가 확정됐어.';
  const credit=s.credit??=emptyCredit(),low=Math.round(review.aprMin*100),span=351,used=new Set();
  const offers=banks.map((bank,id)=>{
    const raw=typeof rng==='function'?rng():rng;
    const sample=Math.max(0,Math.min(.999999999999,Number.isFinite(raw)?raw:0));
    let offset=Math.floor(sample*span);
    while(used.has(offset))offset=(offset+1)%span;
    used.add(offset);
    const aprBps=low+offset;
    return {id,bank,aprBps,apr:aprBps/100,dailyInterest:estimatedDayInterest(amount,aprBps)};
  });
  credit.application={day:s.day,step:s.cursor,amount,offers,declined:false,grade:review.grade,aprMin:review.aprMin,aprMax:review.aprMax};
  return '';
}
export function acceptOffer(s,offerId,review){
  if(review.reason)return review.reason;
  const app=review.application;
  if(!app)return '먼저 심사를 받고 금리 세 가지를 확인해 줘.';
  const id=typeof offerId==='string'&&/^[0-2]$/.test(offerId)?Number(offerId):offerId;
  const offer=app.offers.find(o=>o.id===id);
  if(!offer)return '제시된 금리 중 하나를 선택해 줘.';
  const credit=s.credit;
  credit.used=true;credit.loan={bank:offer.bank,aprBps:offer.aprBps,original:app.amount,principal:app.amount,startDay:s.day,startStep:s.cursor,lastTick:tick(s),interestNumerator:0};
  s.cash+=app.amount;
  credit.ledger.push({type:'borrow',day:s.day,step:s.cursor,amount:app.amount,principal:app.amount,interest:0,bank:offer.bank});
  return '';
}
export function rejectOffers(s){
  const app=s.credit?.application;
  if(s.phase!=='open'||s.credit?.used||!app||app.day!==s.day)return '거절할 대출 제안이 없어.';
  app.declined=true;return '';
}
export function payCredit(s,amount,available,maturity=false){
  const credit=s.credit,loan=credit?.loan;
  if(!loan)return '갚을 대출이 없어.';
  if(s.phase!=='open')return '정산 중에는 직접 갚을 수 없어.';
  const now=tick(s),numerator=carriedInterest(loan,now),interest=Math.round(numerator/INTEREST_DENOM);
  const total=loan.principal+interest;
  if(!int(amount)||amount<=0||amount>total)return '대출 잔액 안에서 1원 이상의 금액을 입력해 줘.';
  if(amount>available)return '주문에 예약된 금액을 제외한 원화 잔액이 부족해.';
  const full=amount===total;
  // A partial payment services whole won of accrued interest; sub-won interest keeps carrying on the reduced principal.
  const interestPaid=full?interest:Math.min(amount,Math.floor(numerator/INTEREST_DENOM));
  const principalPaid=amount-interestPaid;
  credit.paidInterest+=interestPaid;s.cash-=amount;
  credit.ledger.push({type:maturity?'maturity':'repay',day:s.day,step:s.cursor,amount,principal:principalPaid,interest:interestPaid,bank:loan.bank});
  if(full){credit.loan=null;}
  else{
    loan.principal-=principalPaid;loan.interestNumerator=numerator-interestPaid*INTEREST_DENOM;loan.lastTick=now;
  }
  return '';
}
export function clearBankLoan(s){
  const credit=s.credit;
  const waivedInterest=(credit.waivedInterest??0)+(loanAt(s)?.interest??0);
  s.credit={...credit,loan:null,application:null,waivedInterest};
}
export function* dailyBankInterest(history){
  let accrued=0;
  for(const record of history){
    const {credit}=record;
    // Older weeks with no loan reported zero even when earlier interest had been paid.
    const amount=Math.max(0,credit?.accruedTotal==null?credit?.interestToday??0:credit.accruedTotal-accrued);
    accrued+=amount;
    yield {record,amount,accrued};
  }
}
export function closeCreditDay(s,lastDay){
  const credit=s.credit;
  const waiver=credit?.waivedInterest??0;
  if(!credit?.used)return {principal:0,interest:0,total:0,interestToday:0,paidToday:0,maturityPaid:0,accruedTotal:(credit?.paidInterest??0)+waiver};
  const before=outstandingCredit(s),maturityPaid=lastDay?Math.min(s.cash,before):0;
  if(maturityPaid>0)payCredit(s,maturityPaid,s.cash,true);
  const loan=loanAt(s),interest=loan?.interest||0,accruedTotal=credit.paidInterest+interest+waiver;
  let prior=0;
  for(const row of dailyBankInterest(s.history))prior=row.accrued;
  return {principal:loan?.principal||0,interest,total:loan?.total||0,interestToday:Math.max(0,accruedTotal-prior),
    paidToday:credit.ledger.filter(r=>r.day===s.day&&r.type!=='borrow').reduce((n,r)=>n+r.amount,0),maturityPaid,accruedTotal};
}
export function rebaseCredit(s,day,cursor,offset,wallStep){
  const credit=s.credit;
  if(!credit)return;
  if(credit.loan){
    const loan=credit.loan;
    loan.interestNumerator=carriedInterest(loan,tick(s));
    loan.startDay+=offset;
    loan.startStep=wallStep(loan.startStep);
    loan.lastTick=day*SLOTS+cursor;
  }
  credit.ledger=credit.ledger.map(row=>({...row,day:row.day+offset,step:wallStep(row.step)}));
  credit.application=null;
}
export function loadableCredit(c,live=false){
  if(c===undefined)return true; // All saves written before the credit desk.
  if(!c||typeof c.used!=='boolean'||!int(c.paidInterest)||c.paidInterest<0||!Array.isArray(c.ledger)||!int(c.waivedInterest??0)||(c.waivedInterest??0)<0)return false;
  const a=c.application,l=c.loan;
  const goodDay=d=>int(d)&&(live||d>=0&&d<7);
  const goodOffer=o=>o&&int(o.id)&&o.id>=0&&o.id<3&&banks[o.id]===bankName(o.bank)&&int(o.aprBps)&&o.aprBps>0&&o.aprBps<2500
    &&o.apr===o.aprBps/100&&int(o.dailyInterest)&&o.dailyInterest>=0;
  if(a&&(!goodDay(a.day)||!int(a.step)||a.step<0||a.step>=SLOTS||!positiveWon(a.amount)||a.amount>CREDIT_LIMIT
    ||typeof a.declined!=='boolean'||!Array.isArray(a.offers)||a.offers.length!==3||!a.offers.every(goodOffer)
    ||new Set(a.offers.map(o=>o.id)).size!==3||new Set(a.offers.map(o=>o.aprBps)).size!==3))return false;
  if(l&&(!c.used||!banks.includes(bankName(l.bank))||!goodDay(l.startDay)||!int(l.startStep)||l.startStep<0||l.startStep>=SLOTS
    ||!positiveWon(l.original)||l.original>CREDIT_LIMIT||!int(l.principal)||l.principal<0||l.principal>l.original||
    !int(l.aprBps)||l.aprBps<=0||l.aprBps>=2500||!int(l.lastTick)||l.lastTick<l.startDay*SLOTS+l.startStep||(!live&&l.lastTick>7*SLOTS)||
    !int(l.interestNumerator)||l.interestNumerator<0))return false;
  return c.ledger.every(r=>r&&['borrow','repay','maturity'].includes(r.type)&&goodDay(r.day)&&int(r.step)&&r.step>=0&&r.step<=SLOTS&&
    int(r.amount)&&r.amount>0&&int(r.interest)&&r.interest>=0&&int(r.principal)&&r.principal>=0&&r.amount===r.principal+r.interest&&banks.includes(bankName(r.bank)));
}
