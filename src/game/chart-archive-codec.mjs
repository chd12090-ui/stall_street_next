// Daily OHLC prices are stored in hundredths, volume in units, turnover in 1/300 currency units.
const units=[100,100,100,100,1,300],fields=['o','h','l','c','v','pv'];
const format='v2:';
export function historySignature(stock,all,venues){
  const contributors=[stock,...stock.reference.map(c=>all.find(s=>s.code===c))];
  return JSON.stringify([2,contributors.map(s=>{
    const source=s.tape??s;
    return [all.indexOf(s),s.code,s.listed,source.base,s.factor||0,s.shares||0,source.market,source.currency,venues[source.market].sessions];
  })]);
}
function put(out,n){
  let v=n<0?-2*n-1:2*n;
  if(!Number.isSafeInteger(v))throw new Error('Invalid candle history value');
  do{const low=v%128;v=Math.floor(v/128);out.push(low+(v?128:0));}while(v);
}
export function packHistory(rows){
  const bytes=[];
  let day=0,close=0,volume=0;
  for(const b of rows){
    const o=Math.round(b.o*100),h=Math.round(b.h*100),l=Math.round(b.l*100),c=Math.round(b.c*100),v=Math.round(b.v);
    put(bytes,b.day-day);
    put(bytes,o-close);
    put(bytes,c-o);
    put(bytes,h-Math.max(o,c));
    put(bytes,Math.min(o,c)-l);
    put(bytes,v-volume);
    // Store the difference from daily typical-price turnover to preserve the intraday total exactly.
    put(bytes,Math.round(b.pv*300)-(h+l+c)*v);
    day=b.day;close=c;volume=v;
  }
  let text='';for(let j=0;j<bytes.length;j+=16384)text+=String.fromCharCode(...bytes.slice(j,j+16384));
  return format+btoa(text);
}
export function unpackHistory(packed,start){
  const compact=packed.startsWith(format),bytes=atob(compact?packed.slice(format.length):packed);
  const out=[],previous=fields.map(()=>0);
  let off=0,day=0,close=0,volume=0;
  function take(){
    let result=0,place=1,byte;
    do{
      if(off>=bytes.length)throw new Error('Incomplete candle history');
      byte=bytes.charCodeAt(off++);
      result+=(byte%128)*place;
      place*=128;
    }while(byte>=128);
    if(!Number.isSafeInteger(result))throw new Error('Invalid candle history');
    return result%2?-(result+1)/2:result/2;
  }
  while(off<bytes.length){
    day+=take();const bar={day,step:start,key:day*288+start,partial:false};
    if(compact){
      const o=close+take(),c=o+take();
      const h=Math.max(o,c)+take(),l=Math.min(o,c)-take();
      volume+=take();
      const turnover=(h+l+c)*volume+take();
      bar.o=o/100;bar.h=h/100;bar.l=l/100;bar.c=c/100;bar.v=volume;bar.pv=turnover/300;
      close=c;
    }else{
      fields.forEach((k,i)=>{previous[i]+=take();bar[k]=previous[i]/units[i];});
    }
    out.push(bar);
  }
  return out;
}
