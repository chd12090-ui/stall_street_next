const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export const maxCandles=192;

// All distances are CSS pixels. The fractional candle under the midpoint stays
// under the fingers even when they move sideways while changing their separation.
export function bindCandleGestures(canvas,{range,change,point,finish,dismiss}){
  const controller=new AbortController(), contacts=new Map();
  const on=(type,listener,options)=>canvas.addEventListener(type,listener,{...options,signal:controller.signal});
  const scroller=canvas.closest('#screen');
  let single=null,pinch=null,zoomed=false,wheel=null,wheelTimer;
  const xFraction=(clientX,r)=>clamp((clientX-canvas.getBoundingClientRect().left-r.left)/(r.right-r.left),0,1);
  const middle=(a,b)=>(a.x+b.x)/2;
  const distance=(a,b)=>Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));
  function beginSingle(p,suppressTap){
    single={...p,offset:range().offset,scrollTop:scroller?.scrollTop??0,axis:null,suppressTap};
  }
  function zoom(r,span,anchor,fraction){
    const count=clamp(Math.round(span),Math.min(3,r.total),Math.min(maxCandles,r.total));
    const offset=clamp(Math.round(r.total-anchor-count*(1-fraction)),0,r.total-count);
    if(count===r.count&&offset===r.offset)return false;
    change(count,offset);
    return true;
  }
  function finishWheel(){
    clearTimeout(wheelTimer);
    if(wheel?.changed)finish();
    wheel=null;
  }
  on('wheel',e=>{
    const r=range();
    if(!r||r.total<=3||contacts.size||e.defaultPrevented||!e.deltaY||Math.abs(e.deltaX)>Math.abs(e.deltaY))return;
    const count=Math.min(r.count,r.total),max=Math.min(maxCandles,r.total);
    if(!wheel&&!e.ctrlKey&&((count===3&&e.deltaY<0)||(count===max&&e.deltaY>0)))return;
    e.preventDefault();
    const fraction=xFraction(e.clientX,r);
    if(!wheel)wheel={span:count,changed:false};
    if(wheel.x!==e.clientX){
      wheel.x=e.clientX;
      wheel.anchor=r.total-r.offset-count+count*fraction;
    }
    // High-resolution trackpads send sub-pixel deltas. Accumulate the fractional
    // span and round only the painted window, keeping one anchor for the burst.
    const scale=e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1;
    const pixels=clamp(e.deltaY*scale,-480,480);
    wheel.span=clamp(wheel.span*Math.pow(1.3,pixels/100),3,max);
    if(zoom(r,wheel.span,wheel.anchor,fraction))wheel.changed=true;
    clearTimeout(wheelTimer);
    wheelTimer=setTimeout(finishWheel,150);
  },{passive:false});
  on('pointerdown',e=>{
    if(e.button!==0||contacts.size>=2||!range()?.total)return;
    finishWheel();
    const p={x:e.clientX,y:e.clientY};
    contacts.set(e.pointerId,p);
    canvas.setPointerCapture(e.pointerId);
    if(contacts.size===1){beginSingle(p,false);return;}
    dismiss?.();
    const [a,b]=contacts.values(),r=range(),count=Math.min(r.count,r.total);
    pinch={distance:distance(a,b),count,anchor:r.total-r.offset-count+count*xFraction(middle(a,b),r)};
    single=null;
  });
  on('pointermove',e=>{
    const r=range();
    if(!r?.total)return;
    if(!contacts.has(e.pointerId)){
      if(!contacts.size&&e.pointerType==='mouse')point(e,true);
      return;
    }
    const p={x:e.clientX,y:e.clientY};
    contacts.set(e.pointerId,p);
    if(pinch){
      const [a,b]=contacts.values();
      zoom(r,pinch.count*pinch.distance/distance(a,b),pinch.anchor,xFraction(middle(a,b),r));
      zoomed=true;
      return;
    }
    const dx=p.x-single.x,dy=p.y-single.y;
    if(!single.axis&&Math.max(Math.abs(dx),Math.abs(dy))>6){
      single.axis=Math.abs(dx)>=Math.abs(dy)?'x':'y';
      dismiss?.();
    }
    if(single.axis==='x')change(r.count,clamp(single.offset+Math.round(dx/r.unit),0,Math.max(0,r.total-r.count)));
    else if(single.axis==='y'&&scroller&&e.pointerType!=='mouse')scroller.scrollTop=single.scrollTop-dy;
  });
  function end(e){
    if(!contacts.has(e.pointerId))return;
    if(e.type==='pointerup'&&single&&!single.axis&&!single.suppressTap)point(e,false);
    contacts.delete(e.pointerId);
    pinch=null;single=null;
    if(contacts.size)beginSingle(contacts.values().next().value,true);
    else if(zoomed){zoomed=false;finish();}
  }
  for(const type of ['pointerup','pointercancel','lostpointercapture'])on(type,end);
  on('keydown',e=>{
    if(!['+','=','-'].includes(e.key)||e.ctrlKey||e.metaKey||contacts.size)return;
    const r=range();if(!r?.total)return;
    e.preventDefault();
    finishWheel();
    const count=Math.min(r.count,r.total);
    zoom(r,count*(e.key==='-'?1.3:1/1.3),r.total-r.offset-count/2,.5);finish();
  });
  return {get active(){return contacts.size>0||!!wheel;},dispose(){
    controller.abort();
    finishWheel();
    for(const id of contacts.keys())if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    if(zoomed)finish();
    contacts.clear();
  }};
}
