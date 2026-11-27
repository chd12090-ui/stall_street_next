export const guideSteps=Object.freeze(['stall','ranks','news','market','order','account','stakes','mental','retire']);
export const lastGuidePage=guideSteps.length-1;
export const practiceTicker='MOON';
export const practiceStocks=[['MART','장터마트'],[practiceTicker,'달밤물류'],['VOLT','한성전력']];
export const practiceQuote={cash:100000,reserve:50000,buyPrice:23500,nextPrice:22500};
export const practiceMental={initial:75,afterLoss:65};
const {cash,reserve,buyPrice,nextPrice}=practiceQuote;
const draftVersion=3;
const legacySteps=['news','order','account'];
export const maxPracticeQuantity=Math.floor((cash-reserve)/buyPrice);
export const inputLimit=Math.ceil(cash/buyPrice);

export const canBuy=qty=>Number.isInteger(qty)&&qty>0&&qty<=maxPracticeQuantity;

export function practiceAmounts(qty){
  const cost=qty*buyPrice;
  return {cost,cashLeft:cash-cost,value:qty*nextPrice,gain:qty*(nextPrice-buyPrice)};
}
export function restorePractice(raw){
  const evidence=['contract','freight'].includes(raw?.evidence)?raw.evidence:null;
  const paperOpen=raw?.paperOpen??Boolean(evidence);
  const market=evidence==='freight'&&practiceStocks.some(([ticker])=>ticker===raw?.market)?raw.market:null;
  const qty=market===practiceTicker&&Number.isInteger(raw?.qty)&&raw.qty>=0&&raw.qty<=inputLimit?raw.qty:0;
  const filled=canBuy(qty)&&raw?.filled===true;
  const conclusion=filled&&['cash','valuation'].includes(raw?.conclusion)?raw.conclusion:null;
  const mental=conclusion==='valuation'&&['drained','recovered'].includes(raw?.mental)?raw.mental:null;
  return {version:draftVersion,paperOpen:paperOpen===true,evidence,market,qty,filled,conclusion,mental};
}

export function canContinue(page,p){
  switch(guideSteps[page]){
    case 'stall':case 'ranks':case 'stakes':case 'retire':return true;
    case 'news':return p.evidence==='freight';
    case 'market':return p.market===practiceTicker;
    case 'order':return p.filled;
    case 'account':return p.conclusion==='valuation';
    case 'mental':return p.mental==='recovered';
    default:return false;
  }
}

export function firstAvailablePage(practice){
  const incomplete=guideSteps.findIndex((_,page)=>!canContinue(page,practice));
  return incomplete<0?lastGuidePage:incomplete;
}

export function restoreGuideCheckpoint(checkpoint){
  const {page,practice}=checkpoint??{};
  if(!practice||!Number.isInteger(page))return {page:0,practice:restorePractice()};
  const legacy=practice.version!==draftVersion;
  // The v143 order and account screens already operated on the tutorial ticker.
  const restored=restorePractice(legacy?{...practice,market:page>0||practice.qty>0?practiceTicker:null}:practice);
  const target=legacy?guideSteps.indexOf(legacySteps[page]):page;
  return {page:Math.max(0,Math.min(target,firstAvailablePage(restored))),practice:restored};
}
