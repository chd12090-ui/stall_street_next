import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCandleGestures,maxCandles} from '../src/game/candle-gestures.mjs';

function chart(total=500,count=48){
  const canvas=new EventTarget(),scroller={scrollTop:80},captures=new Set(),picked=[];
  let offset=0,saves=0;
  canvas.clientHeight=300;
  canvas.closest=()=>scroller;
  canvas.getBoundingClientRect=()=>({left:50,top:100-scroller.scrollTop});
  canvas.setPointerCapture=id=>captures.add(id);
  canvas.hasPointerCapture=id=>captures.has(id);
  canvas.releasePointerCapture=id=>captures.delete(id);
  const range=()=>({left:4,right:292,unit:288/Math.min(total,count),total,count,offset});
  const controller=bindCandleGestures(canvas,{range,change:(c,o)=>{count=c;offset=o;},point:(e,hover)=>picked.push(hover?'hover':'tap'),finish:()=>saves++});
  function send(type,id,x=0,y=100,extra={}){
    const event=new Event(type,{cancelable:true});
    Object.assign(event,{pointerId:id,clientX:x,clientY:y,button:0,pointerType:'touch'},extra);
    canvas.dispatchEvent(event);
    return event;
  }
  return {range,send,scroller,controller,picked,get saves(){return saves;}};
}

test('two fingers zoom around the candle between them and save only once',()=>{
  const c=chart(),send=c.send;
  send('pointerdown',1,158);send('pointerdown',2,238);
  send('pointermove',1,118);send('pointermove',2,278);
  assert.equal(c.range().count,24);
  assert.equal(c.range().offset,12);
  send('pointermove',1,142);send('pointermove',2,302);
  assert.equal(c.range().count,24);
  assert.equal(c.range().offset,14,'moving the midpoint also pans');
  send('pointerup',2,302);send('lostpointercapture',2);send('pointerup',1,142);
  assert.equal(c.saves,1);assert.deepEqual(c.picked,[]);assert.equal(c.controller.active,false);
  c.controller.dispose();
});

test('vertical pinch zooms out to the limit; a remaining finger can pan without a tap',()=>{
  const c=chart(),send=c.send;
  send('pointerdown',1,198,30);send('pointerdown',2,198,230);
  send('pointermove',2,198,50);
  assert.equal(c.range().count,maxCandles);assert.equal(c.scroller.scrollTop,80);
  send('pointercancel',2);send('pointermove',1,258,30);send('pointerup',1,258,30);
  assert(c.range().offset>0);assert.deepEqual(c.picked,[]);assert.equal(c.saves,1);
  send('pointerdown',3,180,120);send('pointermove',3,182,70);send('pointerup',3,182,70);
  assert.equal(c.scroller.scrollTop,130);assert.equal(c.saves,1);
  send('pointerdown',4,180);send('pointerup',4,180);assert.deepEqual(c.picked,['tap']);
  c.controller.dispose();
});

test('short histories, keyboard zoom, lost capture and unmount stay in bounds',()=>{
  const c=chart(5),send=c.send;
  send('pointerdown',1,175);send('pointerdown',2,185);send('pointerdown',3,195);
  send('pointermove',1,110);send('pointermove',2,260);
  assert.equal(c.range().count,3);
  send('lostpointercapture',1);send('pointerup',2);assert(!c.controller.active);
  const key=send('keydown',0,0,0,{key:'-'});assert(key.defaultPrevented);
  assert.equal(c.range().count,4);
  send('keydown',0,0,0,{key:'-',ctrlKey:true});assert.equal(c.range().count,4);
  send('pointerdown',1,150);send('pointerdown',2,220);send('pointermove',2,218);
  c.controller.dispose();assert(!c.controller.active);
  send('pointerup',1);send('keydown',0,0,0,{key:'='});assert.equal(c.saves,3);
  const short=chart(1);short.send('keydown',0,0,0,{key:'+'});assert.equal(short.range().count,1);
});

test('wheel zoom keeps the bar under the cursor stable and finishes one burst on unmount',()=>{
  const c=chart(),x=126,fraction=.25;
  const event=deltaY=>c.send('wheel',0,x,120,{deltaY,deltaX:0,deltaMode:0});
  const underCursor=()=>{const {total,count,offset}=c.range();return total-offset-count+count*fraction;};
  const anchor=underCursor();
  for(let i=0;i<70;i++)assert(event(-1).defaultPrevented);
  assert(c.range().count<48,'fractional trackpad inputs accumulate');
  assert(Math.abs(underCursor()-anchor)<=.5);
  const zoomed=c.range().count;
  event(40);assert(c.range().count>zoomed);assert(Math.abs(underCursor()-anchor)<=.5);
  assert(c.controller.active);assert.equal(c.saves,0);
  c.controller.dispose();assert.equal(c.saves,1);assert(!c.controller.active);
  assert(!event(-100).defaultPrevented,'disposed canvas releases the wheel');
});

test('line and page wheels zoom, and touch, horizontal scroll and exhausted charts keep their input',()=>{
  const c=chart();
  const wheel=(deltaY,extra={})=>c.send('wheel',0,198,120,{deltaY,deltaX:0,deltaMode:1,...extra});
  assert(!wheel(0,{deltaX:2}).defaultPrevented);
  assert(!wheel(1,{deltaX:5}).defaultPrevented);
  c.send('pointerdown',1,195);
  assert(!wheel(-3).defaultPrevented);
  c.send('pointerup',1,195);
  assert(wheel(-3).defaultPrevented);assert(c.range().count<48);
  assert(wheel(1,{deltaMode:2}).defaultPrevented);assert(c.range().count>48);
  c.controller.dispose();
  const full=chart(10,10);
  assert(!full.send('wheel',0,198,120,{deltaY:100}).defaultPrevented);
  full.controller.dispose();
  const short=chart(2,2);
  assert(!short.send('wheel',0,198,120,{deltaY:-100}).defaultPrevented);
  short.controller.dispose();
});
