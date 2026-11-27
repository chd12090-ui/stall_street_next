export function groupAmount(input,digits=0){
  const raw=String(input??'').replace(/[^0-9.]/g,'');
  const [whole='',...decimals]=raw.split('.');
  const integer=whole.replace(/^0+(?=\d)/,'').slice(0,13);
  const grouped=integer.replace(/\B(?=(\d{3})+(?!\d))/g,',');
  if(digits&&decimals.length)return (grouped||'0')+'.'+decimals.join('').slice(0,digits);
  return grouped;
}
export function applyAmountGrouping(field,digits=0){
  const before=field.value,start=field.selectionStart;
  const next=groupAmount(before,digits);
  if(next===before)return next;
  field.value=next;
  if(start!==null){
    const kept=before.slice(0,start).replace(digits?/[^0-9.]/g:/\D/g,'').length;
    let position=0,passed=0;
    while(position<next.length&&passed<kept){if(next[position]!==',')passed++;position++;}
    field.setSelectionRange(position,position);
  }
  return next;
}
export function amountFromText(input,digits=0){
  const text=String(input??'').replaceAll(',','').trim();
  if(!/^\d+(?:\.\d*)?$/.test(text))return null;
  const [whole,part]=text.split('.');
  if(whole.length>13||(!digits&&part!==undefined)||(part?.length??0)>digits)return null;
  const number=Number(text);
  return Number.isFinite(number)?number:null;
}
