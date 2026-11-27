import {drawAnnotations} from './chart-drawings.mjs';
import {fmtMoney} from './securities-data.mjs';
import {candlePeriod,stamp,isIntraday} from './tape.mjs';

export const colors={
  up:'#bd3945',down:'#2d67b5',even:'#879591',band:'#3d75a8',mid:'#7855a8',sma:'#587549',ema:'#b04d63',vwap:'#24704e',
  rsi:'#794d98',macd:'#286997',signal:'#985360',stochK:'#2a6897',stochD:'#975670',atr:'#9a5745',
  pctb:'#4769a4',bbw:'#577837',grid:'#dce3e0',axis:'#51635f',mark:'#685182',wma:'#15797c',
  dcHi:'#32704b',dcMid:'#687b62',dcLo:'#32704b',kcHi:'#a04d8e',kcMid:'#a27a81',kcLo:'#a04d8e',adx:'#675480',
  plusDI:'#227a49',minusDI:'#a33d63',mfi:'#6247a8',cmf:'#297a64',cci:'#745685',willr:'#356d9a',roc:'#915473',
  bandFill:'rgba(90,146,199,.095)',referenceFill:'rgba(168,142,196,.062)',histUp:'#d28a90',histDown:'#82a6d5',
};
const finite=Number.isFinite;
const numberFormats=new Map();
function formatNumber(value,minimum,maximum=minimum){
  const key=minimum+':'+maximum;
  let format=numberFormats.get(key);
  if(!format){
    format=new Intl.NumberFormat('ko-KR',{minimumFractionDigits:minimum,maximumFractionDigits:maximum});
    numberFormats.set(key,format);
  }
  return format.format(value);
}
export function numeral(value,digits=2) {
  return finite(value)?formatNumber(value,digits):'—';
}
export function compact(value,fractionDigits=2) {
  if(!Number.isFinite(value))return '—';
  const n=Math.abs(value);
  for(const [magnitude,suffix] of [[1e12,'T'],[1e9,'B'],[1e6,'M'],[1e3,'K']]){
    if(n>=magnitude)return Number((value/magnitude).toFixed(n>=magnitude*100?0:1))+suffix;
  }
  return n>0&&n<.05&&fractionDigits===1?(value<0?'−':'')+'<0.1':numeral(value,n%1?fractionDigits:0);
}
export const overlaySeries={
  bb:['upper','mid','lower'],sma:['sma'],ema:['ema'],vwap:['vwap'],wma:['wma'],
  don:['dcHi','dcMid','dcLo'],kelt:['kcHi','kcMid','kcLo'],
};
export const paneInfo={
  rsi:['RSI',['rsi'],59],macd:['MACD',['macd','signal','hist'],65],
  stoch:['STOCH',['stochK','stochD'],59],atr:['ATR',['atr'],56],
  pctb:['%B',['pctb'],56],bbw:['BBW %',['bbw'],56],dmi:['DMI',['adx','plusDI','minusDI'],70],mfi:['MFI',['mfi'],60],cmf:['CMF',['cmf'],58],cci:['CCI',['cci'],60],willr:['%R',['willr'],58],roc:['ROC',['roc'],59],
};
const studyGuides={stoch:[20,80],mfi:[20,80],macd:[0],cmf:[0],roc:[0],pctb:[0,1],willr:[-80,-20],cci:[-100,100],dmi:[25]};
export function studyScale(id,data,params,start,end){
  const refs=id==='rsi'?[params.rsi.low,params.rsi.high]:studyGuides[id]??[];
  if(['rsi','stoch','mfi','dmi'].includes(id))return {low:0,high:100,refs};
  if(id==='willr')return {low:-100,high:0,refs};
  const values=[...refs,...paneInfo[id][1].flatMap(key=>data[key].slice(start,end).filter(finite))];
  if(!values.length)return {low:0,high:1,refs};
  const low=Math.min(...values),high=Math.max(...values);
  const pad=Math.max((high-low)*.08,1e-5,Math.abs(high)*.001);
  return {low:low-pad,high:high+pad,refs};
}
const longestSeriesLabels={
  macd:['M -1,000.000','S -1,000.000','H -1,000.000'],
  dmi:['ADX 100.0','+ 100.0','− 100.0'],
};
const macdLabel=value=>Math.abs(value)>=1000?compact(value):numeral(value,3);
export function plotChart(canvas,model,view) {
  if(!canvas || !canvas.isConnected)return null;
  const detailed=view.detailed!==false;
  const labels=detailed?Object.keys(paneInfo).filter(name=>model.params[name].on):[];
  const width=canvas.clientWidth;
  if(width<80)return null;
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  const dpr=Math.min(window.devicePixelRatio||1,3);
  const rowHeight=20, priceH=220;
  const fontFamily='"Pretendard Variable", sans-serif';
  const font='14px '+fontFamily,axisFont='13px '+fontFamily;
  ctx.font=axisFont;
  const measure=text=>ctx.measureText(text).width;
  const {bars,data,params}=model, tf=model.tf==='A'?bars[0]?.bucket:model.tf;
  const n=bars.length, count=Math.min(view.count,n);
  view.offset=Math.max(0,Math.min(n-count,view.offset));
  const end=n-view.offset, start=Math.max(0,end-count);
  if(!count)return null;
  const intraday=isIntraday(tf);
  const startDate=stamp(bars[start],intraday),endDate=stamp(bars[end-1],intraday);
  const sameDate=startDate.slice(0,10)===endDate.slice(0,10);
  const sameYear=startDate.slice(0,4)===endDate.slice(0,4);
  const dateHeight=26;
  const format=value=>numeral(value,model.digits??2);
  const chosen=view.selected==null?end-1:Math.max(start,Math.min(end-1,view.selected));
  const selectedDate=view.selected==null?null:candlePeriod(bars[chosen],tf);
  const slice=bars.slice(start,end);
  const lows=slice.map(b=>detailed?b.l:b.c),highs=slice.map(b=>detailed?b.h:b.c);
  const periodLow=Math.min(...lows),periodHigh=Math.max(...highs);
  let min=periodLow,max=periodHigh;
  const overlays=detailed?Object.entries(overlaySeries).flatMap(([id,keys])=>params[id].on?keys:[]):[];
  for(const key of overlays)for(let i=start;i<end;i++){
    if(finite(data[key][i])){min=Math.min(min,data[key][i]);max=Math.max(max,data[key][i]);}
  }
  // Include nearby cost in the axis. For distant purchases keep the window legible
  // and mark the direction explicitly at the edge instead of flattening the price path.
  const average=model.average;
  const extension=Math.max(max-min,max*.001,.035)*1.25;
  if(finite(average)&&average>=min-extension&&average<=max+extension){
    min=Math.min(min,average);max=Math.max(max,average);
  }
  const slack=Math.max((max-min)*.095,.035);
  const low=Math.max(0,min-slack),high=max+slack;
  const axisValues=Array.from({length:5},(_,k)=>low+(high-low)*k/4);
  const axisQuotes=[...axisValues,bars[end-1].c];
  // Shorten large ticks only when the native-currency price cannot fit. Keep
  // enough precision to distinguish neighboring ticks on a low-volatility day.
  const axisBudget=Math.min(105,Math.max(68,width*.28));
  const magnitude=Math.max(Math.abs(low),Math.abs(high));
  const [divisor,suffix]=magnitude>=1e8?[1e8,'억']:magnitude>=1e4?[1e4,'만']:[1,''];
  const tickDigits=Math.max(0,Math.min(8,Math.ceil(-Math.log10((high-low)/(4*divisor)))+1));
  const shortAxis=divisor>1 && axisQuotes.some(v=>measure(format(v))+10>axisBudget);
  const formatAxis=v=>shortAxis?formatNumber(Number((v/divisor).toFixed(tickDigits)),0,tickDigits)+suffix:format(v);
  const axisWidth=Math.max(measure('−100.00'),...axisQuotes.map(v=>measure(formatAxis(v))))+11;
  const axis=detailed?Math.ceil(Math.min(Math.max(axisWidth,60),Math.max(65,width-95))):4;
  const left=4,right=width-axis,plotW=right-left,unit=plotW/count;
  const x=i=>left+(i-start+.5)*unit;
  const indexAt=pos=>Math.max(start,Math.min(end-1,start+Math.floor((pos-left)/unit)));
  const py=v=>15+(high-v)/(high-low)*(priceH-30);
  const valueAt=pos=>high-(Math.max(15,Math.min(priceH-15,pos))-15)/(priceH-30)*(high-low);
  function paneLayout(id){
    const [title,keys,baseHeight]=paneInfo[id];
    const period=params[id].n || (id==='macd'?[params.macd.fast,params.macd.slow,params.macd.signal].join('/'):'');
    const heading=title+(period?' '+period:'');
    const display=id==='macd'?[['M',macdLabel(data.macd[chosen]),colors.macd],['S',macdLabel(data.signal[chosen]),colors.signal],['H',macdLabel(data.hist[chosen]),'#556d61']]:
      id==='stoch'?[['K',numeral(data.stochK[chosen],1),colors.stochK],['D',numeral(data.stochD[chosen],1),colors.stochD]]:
      id==='dmi'?[['ADX',numeral(data.adx[chosen],1),colors.adx],['+',numeral(data.plusDI[chosen],1),colors.plusDI],['−',numeral(data.minusDI[chosen],1),colors.minusDI]]:
      [['',numeral(data[id][chosen]),colors[id]]];
    const entries=[[heading,'#314740'],...display.map(([name,value,color])=>[(name?name+' ':'')+value,color])];
    // Reserve room for typical readings so the legend stays stable as values change.
    const series=longestSeriesLabels[id];
    const budget=width-left-9;
    let offset=11,xx=left+2;
    const legend=entries.map(([text,color],i)=>{
      const textWidth=Math.max(measure(text),series?.[i-1]?measure(series[i-1]):0);
      const reserved=Math.min(textWidth,budget);
      if(xx+reserved>width-7){xx=left+2;offset+=rowHeight;}
      const item={text,color,xx,offset,maxWidth:reserved};
      xx+=reserved+10;
      return item;
    });
    const header=offset+12,chartHeight=Math.max(69,baseHeight+10);
    return {id,keys,legend,header,h:header+chartHeight};
  }
  ctx.font=font;
  const panes=labels.map(paneLayout);
  const height=priceH+panes.reduce((n,pane)=>n+pane.h,0)+dateHeight;
  if(canvas.style.height!==height+'px')canvas.style.height=height+'px';
  const bitmapW=Math.round(width*dpr), bitmapH=Math.round(height*dpr);
  if(canvas.width!==bitmapW)canvas.width=bitmapW;
  if(canvas.height!==bitmapH)canvas.height=bitmapH;
  ctx.setTransform(bitmapW/width,0,0,bitmapH/height,0,0);
  ctx.font=font;ctx.textBaseline='middle';ctx.clearRect(0,0,width,height);
  const line=(x1,y1,x2,y2,color,w=1,dash=[])=>{
    ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=w;ctx.setLineDash(dash);
    ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);
  };
  function tracePoints(points){
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);
  }
  function label(str,xx,yy,color=colors.axis,maxWidth=null) {
    ctx.fillStyle=color;
    if(maxWidth!==null&&measure(str)>maxWidth)ctx.fillText(str,xx,yy,maxWidth);
    else ctx.fillText(str,xx,yy);
  }
  const notes=[];
  function annotationLabel(text,xx,yy,color){
    if(yy < -rowHeight || yy > priceH+rowHeight)return;
    const lines=[];
    for(const part of String(text).split(' · ')){
      const last=lines.at(-1);
      if(last && measure(last+' · '+part)<plotW-5)lines[lines.length-1]=last+' · '+part;
      else lines.push(part);
    }
    notes.push({lines,xx,yy,color,width:Math.min(plotW,Math.max(...lines.map(measure))+4),height:lines.length*rowHeight});
  }
  function drawNotes(){
    const used=[];
    // Keep a level tied to its own price. Prefer a horizontal move before
    // changing its vertical position. Draw a leader when it changes rows.
    for(const note of notes.reverse()){
      const {lines,xx,yy,color,width:w,height:h}=note;
      const x0=Math.max(left,Math.min(right-w,xx-2));
      const y0=Math.max(1,Math.min(priceH-h-1,yy-rowHeight/2));
      const xPositions=[...new Set([x0,left,right-w,...used.flatMap(r=>[r.x+r.w+2,r.x-w-2])])]
        .filter(x=>x>=left && x+w<=right+.01).sort((a,b)=>Math.abs(a-x0)-Math.abs(b-x0));
      const yPositions=[...new Set([y0,1,priceH-h-1,...used.flatMap(r=>[r.y+r.h+1,r.y-h-1])])]
        .filter(y=>y>=1 && y+h<priceH).sort((a,b)=>Math.abs(a-y0)-Math.abs(b-y0));
      let box=null;
      for(const y of yPositions){
        const neighbors=used.filter(r=>y<r.y+r.h+1 && y+h>r.y-1);
        const x=xPositions.find(x=>!neighbors.some(r=>x<r.x+r.w+1 && x+w>r.x-1));
        if(x!==undefined){box={x,y,w,h};break;}
      }
      if(!box)continue;
      used.push(box);
      if(Math.abs(box.y-y0)>2)line(Math.max(left,Math.min(xx,right)),yy,box.x+2,box.y+rowHeight/2,color,.7);
      ctx.fillStyle='rgba(255,255,255,.92)';ctx.fillRect(box.x,box.y,w,h);
      lines.forEach((str,j)=>label(str,box.x+2,box.y+(j+.5)*rowHeight,color,w-4));
    }
  }
  function path(key,y,col,weight=1,breakDay=false){
    ctx.beginPath();ctx.lineWidth=weight;ctx.strokeStyle=col;let previous=false;
    for(let i=start;i<end;i++){
      const a=data[key][i];
      if(!finite(a)){previous=false;continue;}
      if(!previous || (breakDay && i>start&&bars[i-1].day!==bars[i].day))ctx.moveTo(x(i),y(a));
      else ctx.lineTo(x(i),y(a));previous=true;
    }
    ctx.stroke();
  }
  function clip(fn,top,h){
    ctx.save();ctx.beginPath();ctx.rect(left,top,plotW,h);ctx.clip();fn();ctx.restore();
  }
  const lastY=end===n?py(bars[n-1].c):Infinity;
  ctx.font=axisFont;
  for(const value of detailed?axisValues:[]){
    const y=py(value);
    line(left,y,right,y,colors.grid,.7,[2,3]);
    if(Math.abs(lastY-y)>rowHeight)label(formatAxis(value),right+4,y,colors.axis,axis-7);
  }
  function dateLabel(i){
    const time=stamp(bars[i],intraday);
    if(tf==='Y')return time.slice(0,4);
    if(tf==='3Y')return String(Math.floor(Number(time.slice(0,4))/3)*3);
    if(tf==='M')return time.slice(0,7).replace('.','/');
    const monthDay=time.slice(5,10).replace('.','/');
    // Keep the axis on one line when the visible candles cross a day or year.
    if(intraday)return sameDate?time.slice(11):monthDay+' '+time.slice(11,16);
    return sameYear?monthDay:time.slice(2,4)+'/'+monthDay;
  }
  const candidates=count===1?[end-1]:[start,end-1,start+Math.floor((count-1)/2)];
  const badgeWidth=selectedDate?Math.min(plotW,Math.ceil(measure(selectedDate))+12):0;
  const badgeLeft=Math.max(left,Math.min(right-badgeWidth,x(chosen)-badgeWidth/2));
  const occupied=selectedDate?[[badgeLeft,badgeLeft+badgeWidth]]:[];
  for(const i of candidates){
    const text=dateLabel(i),length=Math.min(plotW,measure(text));
    const tx=Math.max(left,Math.min(right-length,x(i)-length/2));
    if(occupied.some(([a,b])=>tx<b+10 && tx+length>a-10))continue;
    occupied.push([tx,tx+length]);
    if(detailed)line(x(i),0,x(i),height-dateHeight,colors.grid,.7,[2,4]);
    label(text,tx,height-dateHeight/2,colors.axis,length);
  }
  ctx.font=font;
  if(detailed&&intraday){
    for(let i=start+1;i<end;i++)if(bars[i-1].day!==bars[i].day)line(x(i)-unit/2,0,x(i)-unit/2,height-dateHeight,'#c6d2cf',.85,[4,4]);
  }
  function detailedPrice(){
    if(params.bb.on){
      let segment=[];
      const fill=()=>{
        if(segment.length>1){
          ctx.beginPath();ctx.moveTo(x(segment[0]),py(data.upper[segment[0]]));
          for(const i of segment)ctx.lineTo(x(i),py(data.upper[i]));
          for(let j=segment.length-1;j>=0;j--){const i=segment[j];ctx.lineTo(x(i),py(data.lower[i]));}
          ctx.closePath();ctx.fillStyle=colors.bandFill;ctx.fill();
        }
        segment=[];
      };
      for(let i=start;i<end;i++){if(finite(data.upper[i]))segment.push(i);else fill();}fill();
      path('upper',py,colors.band,1);path('lower',py,colors.band,1);path('mid',py,colors.mid,1);
    }
    for(let i=start;i<end;i++){
      const b=bars[i], xx=x(i);
      if(tf==='T'){
        const previous=bars[i-1],delta=previous?b.c-previous.c:0;
        const color=delta>0?colors.up:delta<0?colors.down:'#657a71';
        if(i>start&&previous.day===b.day)line(x(i-1),py(previous.c),xx,py(b.c),color,1.25);
        ctx.fillStyle=color;ctx.fillRect(xx-1,py(b.c)-1,2,2);
      }else{
        const color=b.c>b.o?colors.up:b.c<b.o?colors.down:colors.even;
        const top=py(Math.max(b.c,b.o)),bottom=py(Math.min(b.c,b.o));
        line(xx,py(b.h),xx,py(b.l),color,1);
        const body=Math.max(1,Math.min(15,unit*.62));
        ctx.fillStyle=color;ctx.fillRect(xx-body/2,top,body,Math.max(1.1,bottom-top));
      }
    }
    for(const k of overlays)if(!['upper','lower','mid'].includes(k))path(k,py,colors[k],1.4,k==='vwap');
    for(let i=start;i<end;i++){
      const trades=model.fills.get(bars[i].key);if(!trades)continue;
      for(const side of [1,-1]){
        if(!trades.some(t=>Math.sign(t.qty)===side))continue;
        const px=x(i),v=side===1?bars[i].l:bars[i].h,y=py(v)+(side===1?3:-3);
        ctx.fillStyle=side===1?'#a34733':'#36669a';ctx.beginPath();ctx.moveTo(px,y);
        ctx.lineTo(px-3.5,y+side*5);ctx.lineTo(px+3.5,y+side*5);ctx.closePath();ctx.fill();
      }
    }
    drawAnnotations(view.drawings,{
      bars,start,end,x,py,left,right,priceH,line,label:annotationLabel,format,measure,
      area(points,fill){
        tracePoints(points);ctx.closePath();ctx.fillStyle=fill;ctx.fill();
      },
      box(x,y,w,h,fill,stroke){
        ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);
        if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.strokeRect(x,y,w,h);}
      },
      trace(points,stroke,weight){
        tracePoints(points);ctx.strokeStyle=stroke;ctx.lineWidth=weight;ctx.stroke();
      },
    });
    if(finite(model.target))line(left,py(model.target),right,py(model.target),colors.mark,1,[6,3]);
  }
  function simplePrice(){
    const color=bars[end-1].c>=bars[start].c?colors.up:colors.down;
    ctx.beginPath();ctx.lineWidth=2.5;ctx.strokeStyle=color;ctx.lineJoin='round';ctx.lineCap='round';
    ctx.moveTo(x(start),py(bars[start].c));
    for(let i=start+1;i<end;i++)ctx.lineTo(x(i),py(bars[i].c));
    ctx.stroke();
    function extreme(text,i,above){
      const xx=x(i),yy=py(bars[i].c);
      ctx.beginPath();ctx.arc(xx,yy,2.7,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
      annotationLabel(text,xx-measure(text)/2,yy+(above?-14:14),color);
    }
    const hi=start+highs.indexOf(periodHigh),lo=start+lows.indexOf(periodLow);
    if(periodHigh===periodLow)extreme('최고·최저 '+fmtMoney(periodHigh,model.currency),hi,true);
    else{
      extreme('최고 '+fmtMoney(periodHigh,model.currency),hi,true);
      extreme('최저 '+fmtMoney(periodLow,model.currency),lo,false);
    }
  }
  clip(detailed?detailedPrice:simplePrice,0,priceH);
  if(detailed&&end===n){
    const b=bars[n-1],y=Math.max(14,Math.min(priceH-14,py(b.c))),color=b.c>=b.o?colors.up:colors.down;
    ctx.font=axisFont;
    line(left,y,right,y,color,.6,[2,4]);ctx.fillStyle=color;ctx.fillRect(right,y-10,axis,20);label(formatAxis(b.c),right+4,y,'#ffffff',axis-7);
    ctx.font=font;
  }
  let y0=priceH;
  for(const {id,keys,h,header,legend} of panes){
    const y1=y0+h;
    line(0,y0,width,y0,'#d7e1dc',1);
    const {low:lo,high:hi,refs}=studyScale(id,data,params,start,end);
    const ypos=v=>y0+header+9+(hi-v)/(hi-lo)*(h-header-18);
    if(refs.length===2){
      ctx.fillStyle=colors.referenceFill;ctx.fillRect(left,ypos(refs[1]),plotW,ypos(refs[0])-ypos(refs[1]));
    }
    const referenceTicks=refs.map(value=>({value,y:ypos(value),textY:ypos(value)})).sort((a,b)=>a.y-b.y);
    if(referenceTicks.length===2 && referenceTicks[1].y-referenceTicks[0].y<rowHeight){
      const center=(referenceTicks[0].y+referenceTicks[1].y)/2;
      const top=Math.max(y0+header+9,Math.min(center-rowHeight/2,y1-9-rowHeight));
      referenceTicks[0].textY=top;
      referenceTicks[1].textY=top+rowHeight;
    }
    ctx.font=axisFont;
    for(const {value,y,textY} of referenceTicks){
      line(left,y,right,y,colors.grid,1,[3,3]);
      if(y!==textY)line(right,y,right+4,textY,colors.axis,.8);
      label(compact(value),right+6,textY,colors.axis,axis-9);
    }
    if(!refs.length || (id==='macd' && Math.abs(ypos(hi)-ypos(0))>rowHeight))label(compact(hi),right+4,ypos(hi),colors.axis,axis-7);
    ctx.font=font;
    clip(()=>{
      if(id==='macd'){
        const base=ypos(0);
        for(let i=start;i<end;i++){
          const v=data.hist[i];if(!finite(v))continue;
          ctx.fillStyle=v>=0?colors.histUp:colors.histDown;const y=ypos(v),w=Math.max(1,unit*.6);
          ctx.fillRect(x(i)-w/2,Math.min(y,base),w,Math.max(1,Math.abs(y-base)));
        }
      }
      for(const key of keys)if(key!=='hist')path(key,ypos,colors[key],1.45);
    },y0+header,h-header);
    for(const {text,color,xx,offset,maxWidth} of legend)label(text,xx,y0+offset,color,maxWidth);
    y0=y1;
  }
  if(detailed)line(right,0,right,height-dateHeight,'#d7e1dc',.85);
  if(selectedDate){
    const pos=x(chosen),y=py(bars[chosen].c);
    line(pos,0,pos,height-dateHeight+3,'#7b8b84',.8,[3,3]);line(left,y,right,y,'#87968b',.75,[2,4]);
    ctx.fillStyle='#31513e';ctx.fillRect(pos-2.5,y-2.5,5,5);
    ctx.fillStyle='#31513e';ctx.fillRect(badgeLeft,height-dateHeight+2,badgeWidth,dateHeight-4);
    ctx.font=axisFont;ctx.fillStyle='#fff';ctx.fillText(selectedDate,badgeLeft+6,height-dateHeight/2,badgeWidth-12);
    ctx.font=font;
  }
  clip(()=>{
    if(finite(average)){
      const edge=average>high?'↑ ':average<low?'↓ ':'';
      const y=average>high?8:average<low?priceH-8:py(average);
      line(left,y,right,y,'#727873',1.2,[5,4]);
      annotationLabel(edge+'평균 매수가 '+fmtMoney(average,model.currency),left+3,y,'#555c57');
    }
    drawNotes();
  },0,priceH);
  return {width,height,priceH,unit,start,end,chosen,selectedDate,indexAt,valueAt,left,right};
}
