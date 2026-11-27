const ink='#4c6f55',fill='rgba(76,111,85,.12)';
function locate(bars,key){
  let lo=0,hi=bars.length;
  while(lo<hi){const m=(lo+hi)>>1;if(bars[m].key<key)lo=m+1;else hi=m;}
  return bars[lo]?.key===key?lo:-1;
}
export function drawAnnotations(marks, geometry){
  const {bars,start,end,x,py,left,right,priceH,line,label,format,area,box,trace,measure}=geometry;
  for(const mark of marks){
    const pts=mark.points.map(p=>({i:locate(bars,p.key),v:p.v}));
    if(!pts.length||pts.some(p=>p.i<0))continue;
    const [a,b,c]=pts,ax=x(a.i),ay=py(a.v),bx=b?x(b.i):ax,by=b?py(b.v):ay;
    const horizontal=(y,dash=[])=>line(left,y,right,y,ink,1,dash);
    const segment=(x1,y1,x2,y2)=>line(x1,y1,x2,y2,ink,1.4);
    if(mark.tool==='level'){
      horizontal(ay,[4,3]);label(format(a.v),left+3,ay-7,ink);
    }else if(mark.tool==='vert'){
      line(ax,0,ax,priceH,ink,1,[4,3]);
    }else if(mark.tool==='trend'&&b){
      segment(ax,ay,bx,by);
    }else if(mark.tool==='ray'&&b){
      if(ax===bx)segment(ax,ay,bx,by<ay?0:priceH);
      else{const edge=bx>ax?right:left;segment(ax,ay,edge,ay+(by-ay)*(edge-ax)/(bx-ax));}
    }else if(mark.tool==='channel'&&b){
      segment(ax,ay,bx,by);
      if(c&&ax!==bx){
        const off=py(c.v)-(ay+(by-ay)*(x(c.i)-ax)/(bx-ax));
        area([[ax,ay],[bx,by],[bx,by+off],[ax,ay+off]],fill);
        segment(ax,ay+off,bx,by+off);line(ax,ay+off/2,bx,by+off/2,ink,.8,[3,3]);
      }
    }else if((mark.tool==='fib'&&b)||(mark.tool==='fibext'&&c)){
      const ext=mark.tool==='fibext',base=ext?c:b;
      const from=Math.max(left,Math.min(right,x(Math.min(...pts.map(p=>p.i)))));
      for(const k of (ext?[0,.618,1,1.272,1.618,2,2.618]:[0,.236,.382,.5,.618,.786,1])){
        const v=ext?c.v+(b.v-a.v)*k:base.v+(a.v-base.v)*k,y=py(v);line(from,y,right,y,ink,.8,[3,3]);label(Math.round(k*1000)/10+'%',from+3,y-6,ink);
      }
    }else if((mark.tool==='rect'||mark.tool==='measure')&&b){
      const xx=Math.min(ax,bx),yy=Math.min(ay,by),w=Math.max(1,Math.abs(bx-ax)),h=Math.max(1,Math.abs(by-ay));
      box(xx,yy,w,h,fill,ink);
      if(mark.tool==='measure'){
        const ret=a.v?(100*(b.v/a.v-1)):0;
        const text=(ret>0?'+':'')+ret.toFixed(2)+'% · '+Math.abs(b.i-a.i)+'봉 · '+format(b.v-a.v);
        label(text,Math.max(left+2,Math.min(right-measure(text)-3,xx+4)),Math.max(9,Math.min(priceH-9,yy+10)),ink,10);
        line(ax,ay,bx,by,ink,.8,[2,2]);
      }
    }else if(mark.tool==='avwap'&&a.i<end){
      let vol=0,amount=0;
      const points=[];
      for(let j=a.i;j<end;j++){
        const z=bars[j];vol+=z.v;amount+=z.v*(z.h+z.l+z.c)/3;
        if(j<start||!vol)continue;
        points.push([x(j),py(amount/vol)]);
      }
      if(points.length)trace(points,ink,1.6);
    }
    for(const p of pts){if(p.i<start||p.i>=end)continue;box(x(p.i)-2,py(p.v)-2,4,4,ink);}
  }
}
