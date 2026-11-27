import {drawAnnotations} from './chart-drawings.mjs';
import {colors,overlaySeries,paneInfo,studyScale} from './plot.mjs';
import {calculate,defaultStudies} from './studies.mjs';

const width=160,height=63,left=7,right=width-7,top=8,bottom=height-8;
export const previewViewBox='0 0 '+width+' '+height;

let volume=0,turnover=0,previous=50;
const priceBars=Array.from({length:80},(_,key)=>{
  const c=50+key*.32+Math.sin(key*.36)*10+Math.sin(key*1.77)*1.7;
  const o=previous+Math.sin(key*1.23)*1.4;
  const h=Math.max(o,c)+1.3,l=Math.min(o,c)-1.2;
  const v=22+Math.floor(14*(1+Math.sin(key*1.31)));
  volume+=v;turnover+=v*(h+l+c)/3;previous=c;
  return {key,o,c,h,l,v,vwap:turnover/volume};
});
const params=defaultStudies();
for(const indicator of Object.values(params))indicator.on=true;
const data=calculate(priceBars,params);
const end=priceBars.length,start=end-15,rows=priceBars.slice(start);
const step=(right-left)/rows.length;
const x=i=>left+(i-start+.5)*step;
const project=(low,high)=>value=>bottom-(bottom-top)*(value-low)/(high-low);

const anchors={
  level:[[7,.48]],vert:[[7,.49]],trend:[[2,.26],[12,.77]],ray:[[2,.28],[9,.57]],
  channel:[[1,.43],[13,.83],[7,.29]],rect:[[3,.8],[12,.27]],
  fib:[[2,.24],[9,.81]],fibext:[[2,.28],[6,.51],[8,.29]],
  measure:[[3,.26],[12,.75]],avwap:[[2,null]],
};
const cache=new Map();
const rounded=n=>Math.round(n*100)/100;
const coords=(x,y)=>rounded(x)+' '+rounded(y);
const pointsPath=points=>points.map(([x,y],i)=>(i?'L':'M')+coords(x,y)).join('');

function buildPreview(id,tool){
  const shapes=[];
  const add=(type,props)=>shapes.push({type,props});
  const line=(x1,y1,x2,y2,stroke,strokeWidth=1,dash=[])=>add('line',{
    x1,y1,x2,y2,stroke,strokeWidth,strokeDasharray:dash.length?dash.join(' '):undefined,
  });
  const box=(x,y,width,height,fill,stroke)=>add('rect',{x,y,width,height,fill,stroke});
  const area=(points,fill)=>add('path',{d:pointsPath(points)+'Z',fill});
  const trace=(points,stroke,strokeWidth)=>add('path',{d:pointsPath(points),stroke,strokeWidth});
  function path(key,y,stroke=colors[key],strokeWidth=1.45){
    let d='',drawing=false;
    for(let i=start;i<end;i++){
      const value=data[key][i];
      if(!Number.isFinite(value)){drawing=false;continue;}
      d+=(drawing?'L':'M')+coords(x(i),y(value));
      drawing=true;
    }
    if(d)add('path',{d,stroke,strokeWidth});
  }

  const series=tool?[]:overlaySeries[id];
  if(!tool&&!series){
    const {low,high,refs}=studyScale(id,data,params,start,end),y=project(low,high);
    if(refs.length===2)box(left,y(refs[1]),right-left,y(refs[0])-y(refs[1]),colors.referenceFill);
    for(const ref of refs)line(left,y(ref),right,y(ref),colors.grid,1,[3,3]);
    if(id==='macd'){
      const base=y(0);
      for(let i=start;i<end;i++){
        const v=data.hist[i],pos=y(v),w=step*.6;
        box(x(i)-w/2,Math.min(pos,base),w,Math.max(1,Math.abs(pos-base)),v>=0?colors.histUp:colors.histDown);
      }
    }
    for(const key of paneInfo[id][1])if(key!=='hist')path(key,y);
    return shapes;
  }

  const values=rows.flatMap(bar=>[bar.h,bar.l]);
  for(const key of series)values.push(...data[key].slice(start).filter(Number.isFinite));
  const low=Math.min(...values),high=Math.max(...values),y=project(low,high);
  for(const gridY of [height/3,height*2/3])line(left,gridY,right,gridY,colors.grid,.7);
  if(id==='bb'){
    // Close the area along the lower band in reverse order.
    const upper=rows.map((_,j)=>[x(start+j),y(data.upper[start+j])]);
    const lower=rows.map((_,j)=>[x(start+j),y(data.lower[start+j])]).reverse();
    area([...upper,...lower],colors.bandFill);
    path('upper',y,colors.band,1.1);
    path('lower',y,colors.band,1.1);
    path('mid',y,colors.mid,1.1);
  }
  rows.forEach((bar,j)=>{
    const px=x(start+j),w=step*.62;
    const color=bar.c>bar.o?colors.up:bar.c<bar.o?colors.down:colors.even;
    const hi=y(Math.max(bar.o,bar.c)),lo=y(Math.min(bar.o,bar.c));
    line(px,y(bar.h),px,y(bar.l),color);
    box(px-w/2,hi,w,Math.max(1.1,lo-hi),color);
  });
  if(tool){
    const points=anchors[id].map(([i,position])=>{
      const bar=rows[i],v=position===null?(bar.h+bar.l+bar.c)/3:low+position*(high-low);
      return {key:bar.key,v};
    });
    drawAnnotations([{tool:id,points}],{
      bars:priceBars,start,end,x,py:y,left,right,priceH:height,line,area,box,trace,
      label:()=>{},measure:()=>0,format:rounded,
    });
  }else if(id!=='bb'){
    for(const key of series)path(key,y);
  }
  return shapes;
}
export function chartPreview(id,tool){
  const key=(tool?'tool:':'study:')+id;
  if(!cache.has(key))cache.set(key,buildPreview(id,tool));
  return cache.get(key);
}
