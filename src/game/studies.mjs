export const studySpecs = [
  {id:'bb', title:'볼린저밴드', short:'BB', on:false, fields:[['n','기간',20,2,200,1],['k','배수 σ',2,.1,5,.1]], note:'중심선은 종가의 단순이동평균. 상·하단은 중심선 ± 배수 × 모집단 표준편차.'},
  {id:'sma', title:'단순이동평균', short:'SMA', on:false, fields:[['n','기간',60,2,200,1]], note:'선택한 기간 동안의 종가를 동일한 비중으로 평균한다.'},
  {id:'ema', title:'지수이동평균', short:'EMA', on:false, fields:[['n','기간',9,2,200,1]], note:'첫 n봉의 단순평균을 초깃값으로 사용하고 이후 종가에 2/(n+1)의 가중치를 둔다.'},
  {id:'vwap', title:'VWAP', short:'VWAP', on:false, fields:[], note:'분봉 전용. 봉의 대표가격 (고가+저가+종가)/3을 체결 수량으로 가중한다. 일봉의 시작점부터 누적한다.'},
  {id:'rsi', title:'상대강도지수', short:'RSI', on:false, fields:[['n','기간',14,2,100,1],['high','상단',70,1,99,1],['low','하단',30,1,99,1]],note:'종가 상승분과 하락분을 Wilder 방식으로 평활한다. RSI = 100 − 100/(1 + 평균 상승분/평균 하락분). 양쪽이 0이면 50으로 표시한다.'},
  {id:'macd', title:'MACD', short:'MACD', on:false, fields:[['fast','단기 EMA',12,2,100,1],['slow','장기 EMA',26,3,200,1],['signal','시그널',9,2,100,1]],note:'MACD선은 단기 EMA − 장기 EMA, 시그널은 MACD선의 EMA. 히스토그램은 두 선의 차이다.'},
  {id:'stoch', title:'슬로 스토캐스틱', short:'STOCH', on:false, fields:[['n','조회 기간',14,2,100,1],['k','%K 평활',3,1,30,1],['d','%D 평활',3,1,30,1]],note:'원시 %K = 100 × (종가 − 기간 최저가)/(기간 최고가 − 기간 최저가). 원시 %K를 단순평균해 슬로 %K를, 이를 다시 단순평균해 %D를 구한다.'},
  {id:'atr', title:'평균진폭', short:'ATR', on:false, fields:[['n','기간',14,2,100,1]],note:'TR은 고저차, 고가와 직전 종가 차이의 절댓값, 저가와 직전 종가 차이의 절댓값 중 최댓값. ATR은 TR의 Wilder 평균이다.'},
  {id:'pctb', title:'볼린저 %B', short:'%B', on:false, fields:[],note:'(종가 − 하단)/(상단 − 하단). 하단은 0, 중심선은 0.5, 상단은 1이며 밴드 바깥의 값도 표시한다. BB 설정을 공유한다.'},
  {id:'bbw', title:'볼린저 밴드폭', short:'BBW', on:false, fields:[],note:'100 × (상단 − 하단)/중심선. BB 설정을 공유한다.'},
  {id:'wma',title:'가중이동평균',short:'WMA',on:false,fields:[['n','기간',20,2,200,1]],note:'최근 종가에 n, 첫 종가에 1의 가중치를 주고 전체 가중치의 합으로 나눈다.'},
  {id:'don',title:'돈치안 채널',short:'DC',on:false,fields:[['n','기간',20,2,200,1]],note:'현재 봉을 포함한 기간 최고가와 최저가를 상·하단으로 표시한다. 중심선은 두 가격의 중간값이다.'},
  {id:'kelt',title:'켈트너 채널',short:'KC',on:false,fields:[['n','EMA 기간',20,2,200,1],['a','ATR 기간',10,2,100,1],['k','ATR 배수',2,.1,8,.1]],note:'종가 EMA를 중심선으로 설정하고, 독립적으로 계산한 Wilder ATR에 배수를 곱해 위아래 밴드를 만든다.'},
  {id:'dmi',title:'방향운동지수',short:'DMI / ADX',on:false,fields:[['n','기간',14,2,100,1]],note:'직전 봉 대비 고가 상승분과 저가 하락분을 비교해 우세한 방향만 DM으로 잡는다. Wilder 평균 DM을 평균 TR로 나눠 ±DI를, DI 차이의 비율을 평활해 ADX를 계산한다.'},
  {id:'mfi',title:'자금흐름지수',short:'MFI',on:false,fields:[['n','기간',14,2,100,1]],note:'대표가격과 체결 수량을 곱해 자금흐름을 구한다. 가격이 오른 봉의 자금흐름이 전체에서 차지하는 비율을 표시한다.'},
  {id:'cmf',title:'차이킨 머니플로',short:'CMF',on:false,fields:[['n','기간',20,2,200,1]],note:'각 봉의 고저 범위에서 종가의 상대 위치를 −1부터 +1로 환산한다. 기간 내 체결 수량으로 가중평균한다.'},
  {id:'cci',title:'상품채널지수',short:'CCI',on:false,fields:[['n','기간',20,2,100,1]],note:'대표가격과 기간 평균의 차이를 0.015 × 평균절대편차로 나눈다. 평균절대편차가 0인 기간은 값이 없다.'},
  {id:'willr',title:'윌리엄스 %R',short:'%R',on:false,fields:[['n','기간',14,2,100,1]],note:'−100 × (기간 최고가 − 현재 종가)/(기간 최고가 − 기간 최저가). 값은 −100부터 0 사이에 놓인다.'},
  {id:'roc',title:'가격 변화율',short:'ROC',on:false,fields:[['n','비교 기간',12,1,200,1]],note:'현재 종가를 n봉 전 종가로 나누고 1을 뺀 뒤 100을 곱한다. 0선은 비교 시점과 같은 가격이다.'},
];
export function defaultStudies() {
  return Object.fromEntries(studySpecs.map(s=>[s.id,{on:s.on,...Object.fromEntries(s.fields.map(([key,,value])=>[key,value]))}]));
}
export function readStudies(raw) {
  const defaults=defaultStudies();
  if(!raw || typeof raw!=='object')return defaults;
  for(const def of studySpecs){
    const v=raw[def.id];if(!v)continue;
    const item=defaults[def.id];
    if(typeof v.on==='boolean')item.on=v.on;
    for(const [k,,base,lo,hi,step] of def.fields){
      const n=Number(v[k]);
      if(Number.isFinite(n)&&n>=lo&&n<=hi&&Math.abs(n/step-Math.round(n/step))<1e-6)item[k]=n;
    }
  }
  if(defaults.macd.fast>=defaults.macd.slow)Object.assign(defaults.macd,{fast:12,slow:26});
  if(defaults.rsi.low>=defaults.rsi.high)Object.assign(defaults.rsi,{low:30,high:70});
  return defaults;
}
export function sma(values,n){
  let sum=0, count=0;
  return values.map((v,i)=>{
    if(Number.isFinite(v)){sum+=v;count++;}
    if(i>=n && Number.isFinite(values[i-n])){sum-=values[i-n];count--;}
    return count===n ? sum/n : null;
  });
}
function smoothed(values,n,alpha){
  let last=null,sum=0,count=0;
  return values.map(v=>{
    if(!Number.isFinite(v)){sum=0;count=0;last=null;return null;}
    if(last===null){sum+=v;if(++count<n)return null;last=sum/n;}
    else last+=(v-last)*alpha;
    return last;
  });
}
export const ema=(a,n)=>smoothed(a,n,2/(n+1));
export const wilder=(a,n)=>smoothed(a,n,1/n);
function rollingBounds(bars,n){
  const low=[],high=[];
  for(let i=0;i<bars.length;i++){
    if(i+1<n){low.push(null);high.push(null);continue;}
    let l=Infinity,h=-Infinity;
    for(let j=i-n+1;j<=i;j++){l=Math.min(l,bars[j].l);h=Math.max(h,bars[j].h);}
    low.push(l);high.push(h);
  }
  return {low,high};
}
function advanced(bars,c,v,tr,p){
  const out={};
  if(p.wma.on){
    const n=p.wma.n,divisor=n*(n+1)/2;let sum=0,weighted=0;
    out.wma=c.map((x,i)=>{if(i>=n){weighted-=sum;sum-=c[i-n];}sum+=x;weighted+=x*Math.min(i+1,n);return i<n-1?null:weighted/divisor;});
  }
  if(p.don.on){
    const b=rollingBounds(bars,p.don.n);out.dcHi=b.high;out.dcLo=b.low;out.dcMid=b.high.map((x,i)=>x==null?null:(x+b.low[i])/2);
  }
  if(p.kelt.on){
    const base=ema(c,p.kelt.n),spread=wilder(tr,p.kelt.a);
    out.kcMid=base;out.kcHi=base.map((m,i)=>m==null||spread[i]==null?null:m+p.kelt.k*spread[i]);out.kcLo=base.map((m,i)=>m==null||spread[i]==null?null:m-p.kelt.k*spread[i]);
  }
  if(p.dmi.on){
    const positive=[null],negative=[null],n=p.dmi.n;
    for(let i=1;i<bars.length;i++){
      const up=bars[i].h-bars[i-1].h,down=bars[i-1].l-bars[i].l;
      positive.push(up>down&&up>0?up:0);negative.push(down>up&&down>0?down:0);
    }
    const range=wilder(tr.map((x,i)=>i?x:null),n);
    const di=values=>wilder(values,n).map((value,i)=>value==null?null:range[i]===0?0:100*value/range[i]);
    out.plusDI=di(positive);out.minusDI=di(negative);
    const dx=out.plusDI.map((x,i)=>x==null?null:x+out.minusDI[i]===0?0:100*Math.abs(x-out.minusDI[i])/(x+out.minusDI[i]));
    out.adx=wilder(dx,n);
  }
  const typical=p.mfi.on||p.cci.on?bars.map(b=>(b.h+b.l+b.c)/3):null;
  if(p.mfi.on){
    const n=p.mfi.n;
    const flow=dir=>sma(typical.map((x,i)=>i===0?null:Math.sign(x-typical[i-1])===dir?x*v[i]:0),n);
    const pos=flow(1),neg=flow(-1);
    out.mfi=pos.map((x,i)=>x==null?null:x+neg[i]===0?50:100*x/(x+neg[i]));
  }
  if(p.cmf.on){
    const n=p.cmf.n,denom=sma(v,n);
    const flow=sma(bars.map(b=>b.h===b.l?0:((2*b.c-b.h-b.l)/(b.h-b.l))*b.v),n);
    out.cmf=flow.map((x,i)=>x==null||!denom[i]?null:x/denom[i]);
  }
  if(p.cci.on){
    const n=p.cci.n,mean=sma(typical,n);
    out.cci=mean.map((m,i)=>{if(m==null)return null;let deviations=0;for(let j=i-n+1;j<=i;j++)deviations+=Math.abs(typical[j]-m);return deviations?(typical[i]-m)/(.015*deviations/n):null;});
  }
  if(p.willr.on){
    const b=rollingBounds(bars,p.willr.n);out.willr=c.map((x,i)=>b.high[i]==null||b.high[i]===b.low[i]?null:-100*(b.high[i]-x)/(b.high[i]-b.low[i]));
  }
  if(p.roc.on){const n=p.roc.n;out.roc=c.map((x,i)=>i<n||!c[i-n]?null:100*(x/c[i-n]-1));}
  return out;
}
export function calculate(bars,p=defaultStudies()) {
  const c=bars.map(b=>b.c), volumes=bars.map(b=>b.v), diff=c.map((v,i)=>i?v-c[i-1]:null);
  const mid=sma(c,p.bb.n), squared=sma(c.map(v=>v*v),p.bb.n);
  const sd=mid.map((v,i)=>{
    if(v===null)return null;
    const variance=squared[i]-v*v;
    return variance<Math.abs(squared[i])*1e-12?0:Math.sqrt(Math.max(0,variance));
  });
  const upper=mid.map((v,i)=>v===null?null:v+p.bb.k*sd[i]), lower=mid.map((v,i)=>v===null?null:v-p.bb.k*sd[i]);
  const pctb=mid.map((v,i)=>v===null||upper[i]===lower[i]?null:(c[i]-lower[i])/(upper[i]-lower[i]));
  const bbw=mid.map((v,i)=>!v?null:100*(upper[i]-lower[i])/v);
  const gains=wilder(diff.map(v=>v===null?null:Math.max(v,0)),p.rsi.n);
  const losses=wilder(diff.map(v=>v===null?null:Math.max(-v,0)),p.rsi.n);
  const rsi=gains.map((g,i)=>g===null?null:losses[i]===0?(g===0?50:100):100-100/(1+g/losses[i]));
  const fast=ema(c,p.macd.fast), slow=ema(c,p.macd.slow);
  const macd=fast.map((v,i)=>v===null||slow[i]===null?null:v-slow[i]), signal=ema(macd,p.macd.signal);
  const hist=macd.map((v,i)=>signal[i]===null?null:v-signal[i]);
  const rawK=bars.map((bar,i)=>{
    if(i<p.stoch.n-1)return null;
    let lo=bar.l,hi=bar.h;
    for(let j=i-p.stoch.n+1;j<i;j++){lo=Math.min(lo,bars[j].l);hi=Math.max(hi,bars[j].h);}
    return hi===lo?null:100*(bar.c-lo)/(hi-lo);
  });
  const stochK=sma(rawK,p.stoch.k),stochD=sma(stochK,p.stoch.d);
  const tr=bars.map((b,i)=>i?Math.max(b.h-b.l,Math.abs(b.h-c[i-1]),Math.abs(b.l-c[i-1])):b.h-b.l);
  const atr=wilder(tr,p.atr.n);
  return {mid,upper,lower,pctb,bbw,sma:sma(c,p.sma.n),ema:ema(c,p.ema.n),vwap:bars.map(b=>b.vwap??null),
    rsi,macd,signal,hist,stochK,stochD,atr,...advanced(bars,c,volumes,tr,p)};
}
