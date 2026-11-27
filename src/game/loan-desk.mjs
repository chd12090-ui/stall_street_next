export const deskLender='무 대부';
export const deskLoanMaximum=50000000;
export const deskDieSize=20;
export const deskRerollAdSeconds=5;
const slots=288;
const isDice=roll=>Array.isArray(roll)&&roll.length===2&&[roll[0],roll[1]].every(die=>Number.isInteger(die)&&die>=1&&die<=deskDieSize);
const diceApr=([first,second])=>(first+second)*100;
// Older loans retain the rate from their original amount tier.
const legacyApr=amount=>amount<=5000000?1000:amount<=20000000?1500:2000;
const deskClosed=s=>s.phase!=='open'||s.cursor>=slots;
const closedMessage='자정 정산이 끝나면 이용할 수 있어.';

const interestScale=10000n*365n*BigInt(slots);
const tick=s=>s.day*slots+s.cursor;
const roundedInterest=units=>Number((units+interestScale/2n)/interestScale);
const currentUnits=(loan,s)=>BigInt(loan.interestUnits)+BigInt(loan.principal)*BigInt(loan.aprBps)*BigInt(Math.max(0,tick(s)-loan.lastTick));
const positiveWon=amount=>Number.isSafeInteger(amount)&&amount>0;
const amountAllowed=amount=>positiveWon(amount)&&amount<=deskLoanMaximum;
const upfrontInterestFor=(amount,aprBps)=>Math.max(1,Math.round(amount*aprBps/20_000));

export function rollDeskRate(s,rng=Math.random){
  if(deskClosed(s))return closedMessage;
  if(s.loanDesk?.loan)return '이용 중인 대출을 갚으면 다음 금리를 굴릴 수 있어.';
  const desk=s.loanDesk??={loan:null,paidInterest:0,ledger:[]};
  desk.rateDice=[1+Math.floor(rng()*deskDieSize),1+Math.floor(rng()*deskDieSize)];
  return '';
}
export function deskLoanQuote(s,amount){
  const dice=s.loanDesk?.rateDice;
  if(!dice||!amountAllowed(amount))return null;
  const aprBps=diceApr(dice);
  return {amount,aprBps,upfrontInterest:upfrontInterestFor(amount,aprBps),
    dailyInterest:roundedInterest(BigInt(amount)*BigInt(aprBps)*BigInt(slots))};
}
export function deskLoanBalance(s){
  const loan=s.loanDesk?.loan;
  if(!loan)return null;
  const interest=roundedInterest(currentUnits(loan,s)),upfrontInterest=loan.upfrontInterest??0;
  return {...loan,interest,upfrontInterest,total:loan.principal+interest+upfrontInterest,
    dailyInterest:roundedInterest(BigInt(loan.principal)*BigInt(loan.aprBps)*BigInt(slots))};
}
export function deskLoanRequestError(s,amount){
  if(deskClosed(s))return closedMessage;
  if(!positiveWon(amount))return '1원 이상의 금액을 입력해 줘.';
  return amountAllowed(amount)?'':'대출 한도 5,000만원을 넘었어.';
}
export function deskLoanError(s,amount,available){
  if(deskClosed(s))return closedMessage;
  const loan=deskLoanBalance(s);
  if(!loan){
    if(!s.loanDesk?.rateDice)return '주사위를 먼저 굴려서 금리를 정해 줘.';
    return deskLoanRequestError(s,amount);
  }
  if(!Number.isSafeInteger(amount)||amount<=0||amount>loan.total)return '갚을 돈을 넘지 않게 1원 이상 입력해 줘.';
  return amount>available?'주문에 잡아 둔 돈을 빼면 사용할 수 있는 원화가 부족해.':'';
}
export function borrowAtDesk(s,amount){
  if(s.loanDesk?.loan)return '이용 중인 대출을 갚으면 다시 빌릴 수 있어.';
  const error=deskLoanError(s,amount,0);
  if(error)return error;
  const desk=s.loanDesk,{aprBps,upfrontInterest}=deskLoanQuote(s,amount);
  desk.loan={original:amount,principal:amount,aprBps,upfrontInterest,dice:desk.rateDice,
    day:s.day,step:s.cursor,lastTick:tick(s),interestUnits:'0'};
  delete desk.rateDice;
  s.cash+=amount;
  desk.ledger.push({type:'borrow',day:s.day,step:s.cursor,amount,principal:amount,interest:0,bank:deskLender});
  return '';
}
export function repayAtDesk(s,amount,available){
  const desk=s.loanDesk,loan=desk?.loan;
  if(!loan)return '갚을 대출이 없어.';
  const error=deskLoanError(s,amount,available);
  if(error)return error;
  const units=currentUnits(loan,s),remainingFee=loan.upfrontInterest??0;
  const upfrontInterest=Math.min(amount,remainingFee),afterFee=amount-upfrontInterest;
  const full=amount===loan.principal+roundedInterest(units)+remainingFee;
  const interest=full?roundedInterest(units):Math.min(afterFee,Number(units/interestScale));
  const principal=afterFee-interest;
  desk.paidInterest+=interest;
  s.cash-=amount;
  desk.ledger.push({type:'repay',day:s.day,step:s.cursor,amount,principal,interest,bank:deskLender,
    ...(upfrontInterest?{upfrontInterest}:{})});
  if(full)desk.loan=null;
  else{
    if(remainingFee)loan.upfrontInterest=remainingFee-upfrontInterest;
    loan.principal-=principal;
    loan.interestUnits=String(units-BigInt(interest)*interestScale);
    loan.lastTick=tick(s);
  }
  return '';
}
export function clearDeskLoan(s){
  if(!s.loanDesk)return;
  const {rateDice,...desk}=s.loanDesk;
  const waivedInterest=(desk.waivedInterest??0)+(deskLoanBalance(s)?.interest??0);
  s.loanDesk={...desk,loan:null,waivedInterest};
}
export function closeLoanDeskDay(s){
  const desk=s.loanDesk;
  if(!desk)return undefined;
  const loan=deskLoanBalance(s),accruedTotal=desk.paidInterest+(desk.waivedInterest??0)+(loan?.interest||0);
  const last=s.history.at(-1)?.loanDesk?.accruedTotal||0;
  const repayments=desk.ledger.filter(r=>r.day===s.day&&r.type==='repay');
  return {total:loan?.total||0,interestToday:accruedTotal-last,accruedTotal,
    paidToday:repayments.reduce((sum,r)=>sum+r.amount,0),
    upfrontInterestPaid:repayments.reduce((sum,r)=>sum+(r.upfrontInterest??0),0)};
}
export function rebaseLoanDesk(s,day,cursor,offset,wallStep){
  const desk=s.loanDesk;
  if(!desk)return;
  if(desk.loan){
    const loan=desk.loan;
    loan.interestUnits=String(currentUnits(loan,s));
    loan.day+=offset;
    loan.step=wallStep(loan.step);
    loan.lastTick=day*slots+cursor;
  }
  desk.ledger=desk.ledger.map(row=>({...row,day:row.day+offset,step:wallStep(row.step)}));
}
export function loadableLoanDesk(desk){
  if(desk===undefined)return true;
  const nonnegative=n=>Number.isSafeInteger(n)&&n>=0;
  const date=r=>Number.isSafeInteger(r.day)&&nonnegative(r.step)&&r.step<slots;
  if(!desk||!Object.hasOwn(desk,'loan')||!nonnegative(desk.paidInterest)||!nonnegative(desk.waivedInterest??0)||!Array.isArray(desk.ledger))return false;
  const loan=desk.loan;
  if(desk.rateDice!==undefined&&(loan!==null||!isDice(desk.rateDice)))return false;
  if(loan!==null){
    if(!loan||!date(loan)||!amountAllowed(loan.original)||!nonnegative(loan.principal)||loan.principal>loan.original||
      !Number.isSafeInteger(loan.lastTick)||loan.lastTick<loan.day*slots+loan.step||
      typeof loan.interestUnits!=='string'||!/^\d{1,30}$/.test(loan.interestUnits))return false;
    if(loan.dice!==undefined&&!isDice(loan.dice))return false;
    if(loan.aprBps!==(loan.dice?diceApr(loan.dice):legacyApr(loan.original)))return false;
    if(loan.upfrontInterest!==undefined&&(!nonnegative(loan.upfrontInterest)||
      loan.upfrontInterest>upfrontInterestFor(loan.original,loan.aprBps)))return false;
  }
  return desk.ledger.every(r=>r&&['borrow','repay'].includes(r.type)&&r.bank===deskLender&&date(r)&&
    nonnegative(r.principal)&&nonnegative(r.interest)&&nonnegative(r.amount)&&r.amount>0&&
    (r.upfrontInterest===undefined||r.type==='repay'&&nonnegative(r.upfrontInterest))&&
    r.amount===r.principal+r.interest+(r.upfrontInterest??0));
}
