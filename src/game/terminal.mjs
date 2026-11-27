import {nyangUnitsPerLegacyCoin,symbolIndex} from './securities-data.mjs';
import {chartReadouts} from './exchange-events.mjs';
import {bindCandleGestures,maxCandles} from './candle-gestures.mjs';
import {dayLabel,firstGameDay,tradeKey} from './clock-calendar.mjs';
import {stocks,snapPrice,fmtMoney} from './world.mjs';
import {fxRates} from './fx.mjs';
import {averagePurchasePrice} from './market.mjs';
import {timeframes,chartBars,calendar,candlePeriod,tapeCivilDay,money,barsPerDay,isIntraday} from './tape.mjs';
import {defaultStudies,readStudies,studySpecs,calculate} from './studies.mjs';
import {plotChart,numeral,colors} from './plot.mjs';

const prefKey='stall-street:chart-settings:1';
const readPrefs=()=>{try{return JSON.parse(localStorage.getItem(prefKey))||{};}catch{return {};}};
const saved=readPrefs();
let params=readStudies(saved.studies),stock=Number.isInteger(saved.stock)&&stocks[saved.stock]?saved.stock:0;
if(saved.indicatorLayout!==2)for(const s of studySpecs)params[s.id].on=s.on;
const minuteFrames=timeframes.filter(([id])=>isIntraday(id));
const longFrames=[['D','일'],['W','주'],['M','월'],['Y','년']];
let tf=isIntraday(saved.tf)||longFrames.some(([id])=>id===saved.tf)?saved.tf:['3Y','A'].includes(saved.tf)?'Y':'D';
const count=Number.isInteger(saved.count)&&saved.count>=1&&saved.count<=maxCandles?saved.count:48;
let intradayFrame=isIntraday(tf)?tf:isIntraday(saved.intradayFrame)?saved.intradayFrame:'10';
let drawings=saved.drawings&&typeof saved.drawings==='object'?saved.drawings:{};
if(saved.calendar!==2){
  // Earlier drawings used 72 slots per weekday. Preserve their original calendar date and local time.
  for(const list of Object.values(drawings)){
    if(!Array.isArray(list))continue;
    for(const drawing of list)for(const point of (Array.isArray(drawing?.points)?drawing.points:[])){
      if(!Number.isInteger(point?.key))continue;
      const tradingDay=Math.floor(point.key/72),step=point.key-tradingDay*72;
      const calendarDay=Math.floor(tradingDay/5)*7+((tradingDay%5+5)%5);
      point.key=calendarDay*barsPerDay+step;
    }
  }
}
const oldBase=[22,20,28,24,34.20,24.80,15.40,19.50,16.75,32.60,21.40,78.60,36.50,25,18,21,17,12,14,12,18,20];
if(saved.priceScale!==3||saved.bitcoinCurrency!=='USD')for(const [slot,list] of Object.entries(drawings)){
  const i=Number(slot.split('/')[0]),asset=stocks[i];
  if(!asset||!Array.isArray(list))continue;
  const ratio=saved.priceScale===3?1:(asset.tape?.base??asset.base)/oldBase[i];
  if(!Number.isFinite(ratio))continue;
  for(const mark of list)for(const p of (Array.isArray(mark?.points)?mark.points:[])){
    if(!Number.isFinite(p?.v))continue;
    if(asset.tape&&saved.bitcoinCurrency!=='USD'&&Number.isFinite(p.key)){
      const day=Math.floor(p.key/barsPerDay),step=Math.floor(p.key-day*barsPerDay);
      p.v=money(p.v*ratio/fxRates(day,step).USD);
    }else if(ratio!==1)p.v=money(p.v*ratio);
  }
}
// Only price coordinates change; the drawing dates and their room ownership remain intact.
export function convertOldCoinDrawings(records){
  for(const [slot,marks] of Object.entries(records??{})){
    if(Number(slot.split('/')[0])!==symbolIndex.BIT||!Array.isArray(marks))continue;
    for(const mark of marks)for(const p of Array.isArray(mark?.points)?mark.points:[]){
      if(Number.isFinite(p?.v))p.v=money(p.v/nyangUnitsPerLegacyCoin);
    }
  }
}
if(!saved.nyangUnits)convertOldCoinDrawings(drawings);
const tools=[
  ['level','수평선',1],['vert','수직선',1],['trend','추세선',2],['ray','추세 반직선',2],
  ['channel','평행 채널',3],['rect','가격 구간',2],['fib','피보나치 되돌림',2],['fibext','피보나치 확장',3],
  ['measure','가격·기간 측정',2],['avwap','앵커 VWAP',1]
];
const toolById=Object.fromEntries(tools.map(x=>[x[0],x]));
let model,canvas,metric,observer,frame=0,detailIndex=null,gestures=null,chartQuoteKey=null,chartListeners=null;
const view={count,detailed:saved.detailed!==false,offset:0,selected:null,tool:null,points:[],drawings:[],inspecting:false};
const finite=Number.isFinite;
let persistDrawings=null;
export function bindChartDrawings(records,write){
  drawings=records.drawings&&typeof records.drawings==='object'?records.drawings:{};
  persistDrawings=write;
  resetView();
}
export const chartDrawings=()=>drawings;
function savePrefs(){
  const prefs={nyangUnits:true,calendar:2,priceScale:3,bitcoinCurrency:'USD',indicatorLayout:2,detailed:view.detailed,studies:params,stock,tf,intradayFrame,count:view.count};
  if(!persistDrawings)prefs.drawings=drawings;
  try{localStorage.setItem(prefKey,JSON.stringify(prefs));}catch{}
}
function saveDrawings(){if(persistDrawings)persistDrawings(drawings);else savePrefs();}
const digits=()=>['KRW','JPY','VND','CLP'].includes(stocks[stock]?.currency)?0:2;
const quote=(v)=>finite(v)?numeral(v,digits()):'—';
const isIntra=()=>isIntraday(tf);
const drawKey=()=>stock+'/'+tf;
const activeDrawings=()=>{
  const list=drawings[drawKey()];
  return Array.isArray(list)?list.filter(m=>m&&Object.hasOwn(toolById,m.tool)&&Array.isArray(m.points)&&m.points.length&&m.points.every(p=>finite(p?.key)&&finite(p.v))).slice(-24):[];
};
function resetView(){view.offset=0;view.selected=null;view.tool=null;view.points=[];view.inspecting=false;detailIndex=null;}
export function selectStock(i){if(stocks[i]){stock=i;resetView();savePrefs();}}
function buildModel(state){
  const bars=chartBars(state,stock,tf),reuse=model?.bars===bars&&model?.params===params;
  const fills=new Map();
  const days=view.detailed?state.history.map(r=>[r.day,r.trades]):[];
  if(view.detailed&&state.phase==='open')days.push([state.day,state.fills]);
  for(const [day,rows] of days)for(const order of rows){
    if(order.i!==stock)continue;
    const target=(order.tapeKey??tradeKey(state,day,order.step||0))+(order.second||0)/300;
    let left=0,right=bars.length;while(left<right){const middle=(left+right)>>1;if(bars[middle].key<=target)left=middle+1;else right=middle;}
    if(!left)continue;const key=bars[left-1].key;
    if(!fills.has(key))fills.set(key,[]);fills.get(key).push(order);
  }
  const data=view.detailed?(reuse&&model.data?model.data:calculate(bars,params)):null;
  model={bars,params,tf,digits:digits(),currency:stocks[stock].currency,average:averagePurchasePrice(state,stock),
    fills,data,target:state.orders[stock]?state.orderPrices[stock]:null};
  view.offset=Math.max(0,Math.min(bars.length-view.count,view.offset));
  if(view.selected!=null)view.selected=Math.min(bars.length-1,view.selected);
}
const activeLegend=()=>{
  const items=[];
  if(params.bb.on)items.push(['band','BB '+params.bb.n+' · '+params.bb.k+'σ'],['mid','중심선']);
  if(params.sma.on)items.push(['sma','SMA '+params.sma.n]);
  if(params.ema.on)items.push(['ema','EMA '+params.ema.n]);
  if(params.vwap.on&&isIntra())items.push(['vwap','VWAP']);
  for(const [key,label,color] of [['wma','WMA','wma'],['don','DC','dcHi'],['kelt','KC','kcHi']])if(params[key].on)items.push([color,label+' '+params[key].n]);
  const legend=items.map(([key,label])=>({color:colors[key],label}));
  if(model.fills.size)legend.push({label:'▲ 매수',className:'plot-buy-mark'},{label:'▼ 매도',className:'plot-sell-mark'});
  if(model.target!=null)legend.push({color:colors.mark,label:'지정가 '+quote(model.target)});
  return legend;
};

function periodLabel(state,bar){
  const day=isIntra()?tapeCivilDay(bar.day,bar.step):bar.day;
  if(day>=firstGameDay(state)){
    if(isIntra())return calendar(bar.day,bar.step,state);
    if(tf==='D')return dayLabel(state,day);
  }
  return candlePeriod(bar,tf);
}
function setInspection(open){
  view.inspecting=open;
  const box=document.getElementById('candle-inspect');
  if(!box)return;
  box.hidden=!open;
  const quote=box.previousElementSibling;
  if(quote)quote.inert=open;
  if(open)canvas?.setAttribute('aria-describedby','ohlc');
  else canvas?.removeAttribute('aria-describedby');
}
function dismissInspection(){if(view.inspecting)setInspection(false);}
function updateReadout(i) {
  if(detailIndex===i)return;
  detailIndex=i;
  const b=model.bars[i],t=b.c>b.o?'up':b.c<b.o?'down':'even';
  const values=view.detailed?[['시작',b.o],['최고',b.h],['마지막',b.c],['최저',b.l]]:[['가격',b.c]];
  chartReadouts.publish({tone:t,prices:values.map(([title,value])=>[title,quote(value)])});
}
function paint(){
  if(!canvas?.isConnected||canvas.clientWidth<80)return;
  if(view.detailed){
    view.drawings=activeDrawings();
    if(view.tool&&view.points.length)view.drawings.push({tool:view.tool,points:view.points});
  }
  const plotted=plotChart(canvas,model,view);
  if(!plotted)return;
  metric=plotted;
  const description=(metric.end-metric.start)+(view.detailed?'개 봉 표시':'개 가격 표시')+(metric.selectedDate?' · 선택 '+metric.selectedDate:'')+
    (model.average!=null?' · 평균 매수가 '+fmtMoney(model.average,model.currency):'');
  if(canvas.getAttribute('aria-description')!==description)canvas.setAttribute('aria-description',description);
  updateReadout(metric.chosen);
}
function repaint(){
  if(!frame)frame=requestAnimationFrame(()=>{frame=0;paint();});
}
export const interacting=()=>!!gestures?.active;
export function refreshChart(state,q){
  if(!canvas?.isConnected||interacting())return;
  const average=averagePurchasePrice(state,stock);
  if(view.offset>0){
    if(model.average!==average){model.average=average;repaint();}
    return;
  }
  const key=q.price+'/'+q.volume;
  if(key===chartQuoteKey&&model.average===average)return;
  chartQuoteKey=key;
  buildModel(state);detailIndex=null;repaint();
}
function drawStatus(){
  const el=document.getElementById('draw-status');if(!el)return;
  const spec=toolById[view.tool];
  el.textContent=spec?spec[1]+' · '+(spec[2]===1?'가격창에서 위치를 선택해.':(view.points.length+1)+'번째 점을 선택해. 총 '+spec[2]+'개'):(activeDrawings().length?'저장된 작도 '+activeDrawings().length+'개':'');
}
function pickMark(idx,y){
  const key=drawKey(),point={key:model.bars[idx].key,v:money(metric.valueAt(y))};
  if(view.points.length+1<toolById[view.tool][2]){view.points.push(point);}
  else {
    const list=activeDrawings();list.push({tool:view.tool,points:[...view.points,point]});drawings[key]=list.slice(-24);
    view.tool=null;view.points=[];saveDrawings();
  }
  drawStatus();
}
function canvasPoint(e) {const b=canvas.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top];}
export function unmount(){
  chartListeners?.abort();chartListeners=null;
  observer?.disconnect();observer=null;if(frame)cancelAnimationFrame(frame);frame=0;gestures?.dispose();gestures=null;canvas=null;metric=null;
}
export function mount(){
  canvas=document.getElementById('terminal-plot');if(!canvas)return;
  detailIndex=null;drawStatus();paint();
  setInspection(view.inspecting);
  chartListeners=new AbortController();
  const signal=chartListeners.signal;
  const options={signal,capture:true,passive:true};
  const outside=e=>{if(e.target!==canvas)dismissInspection();};
  for(const event of ['pointerdown','click','focusin'])document.addEventListener(event,outside,options);
  for(const event of ['scroll','wheel'])document.addEventListener(event,dismissInspection,options);
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'||e.key==='PageDown'||e.key==='PageUp')dismissInspection();
  },options);
  if(typeof ResizeObserver!=='undefined'){
    const observed=canvas;
    let width=observed.clientWidth;
    observer=new ResizeObserver(()=>{
      if(canvas!==observed||width===observed.clientWidth)return;
      width=observed.clientWidth;
      repaint();
    });
    observer.observe(observed);
  }
  gestures=bindCandleGestures(canvas,{
    range:()=>metric&&{total:model.bars.length,count:view.count,offset:view.offset,left:metric.left,right:metric.right,unit:metric.unit},
    dismiss:dismissInspection,
    change(count,offset){dismissInspection();view.count=count;view.offset=offset;view.selected=null;repaint();},
    point(e,hover){
      const [x,y]=canvasPoint(e);
      if(!metric)return;
      if(x<metric.left||x>=metric.right){if(!hover)dismissInspection();return;}
      if(hover&&(view.tool||!view.inspecting))return;
      view.selected=metric.indexAt(x);
      if(view.tool){if(!hover&&y<metric.priceH)pickMark(view.selected,y);}
      else if(!hover)setInspection(true);
      repaint();
    },
    finish:savePrefs
  });
  canvas.addEventListener('keydown',e=>{
    if(!metric)return;
    if(['ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();view.selected=Math.max(0,Math.min(model.bars.length-1,metric.chosen+(e.key==='ArrowLeft'?-1:1)));
      if(view.selected<metric.start)view.offset++;
      if(view.selected>=metric.end)view.offset--;
      setInspection(true);repaint();
    }else if(e.key==='Enter'||e.key===' '){
      e.preventDefault();view.selected=metric.chosen;setInspection(true);repaint();
    }else if(e.key==='End'||e.key==='Home'){e.preventDefault();dismissInspection();view.offset=e.key==='Home'?Math.max(0,model.bars.length-view.count):0;view.selected=null;repaint();}
  },{signal});
}
export function setChartDetail(detailed){
  view.detailed=detailed;
  view.inspecting=false;view.selected=null;view.tool=null;view.points=[];
  savePrefs();
}
export function adjust(action,value){
  if(action==='interval'){
    if(isIntraday(value)||longFrames.some(([id])=>id===value)){
      tf=value;
      if(isIntra())intradayFrame=tf;
      resetView();savePrefs();
    }
    return 'render';
  }
  if(action==='draw'){
    dismissInspection();
    if(value==='reset'){
      view.tool=null;view.points=[];
      const key=drawKey();
      if(Object.hasOwn(drawings,key)){delete drawings[key];saveDrawings();}
    }else if(toolById[value]){view.tool=view.tool===value?null:value;view.points=[];}
    drawStatus();
  }
  paint();return 'paint';
}
export function orderLevels(state,i){
  const bars=chartBars(state,i,tf),data=(i===stock&&model?.bars===bars&&model.data)||calculate(bars,params);
  const at=i===stock&&view.selected!=null&&model?.bars===bars?Math.max(0,Math.min(bars.length-1,view.selected)):bars.length-1;
  return {levels:[['선택 종가',bars[at].c],['BB 하단',data.lower[at]],['BB 상단',data.upper[at]]].filter(([,v])=>finite(v)&&v>.004).map(([title,v])=>[title,snapPrice(i,v)]),date:periodLabel(state,bars[at])};
}
const upperIndicators=['sma','bb','ema','wma','vwap','don','kelt'];
export const settingsSnapshot=()=>({tools,active:view.tool,canReset:Boolean(view.tool||activeDrawings().length),upperIndicators,params});
export function chooseStudyPane(form,name){
  for(const pane of form.querySelectorAll('[data-study-pane]')){
    pane.hidden=pane.dataset.studyPane!==name;
    if(!pane.hidden)pane.scrollTop=0;
  }
  for(const tab of form.querySelectorAll('[data-act="study-pane"]'))tab.setAttribute('aria-pressed',String(tab.dataset.value===name));
}
export function applyForm(form){
  const raw={};
  function invalid(text,name){const field=form.elements[name],pane=field?.closest('[data-study-pane]');if(pane)chooseStudyPane(form,pane.dataset.studyPane);if(field?.closest('details'))field.closest('details').open=true;return [text,name];}
  for(const s of studySpecs){
    const row={on:form.elements[s.id+'_on'].checked};
    for(const [key,label,,lo,hi] of s.fields){
      const name=s.id+'_'+key,field=form.elements[name];
      if(!field.validity.valid)return invalid(s.title+' '+label+' 값을 '+lo+'~'+hi+' 범위에서 확인해.',name);
      row[key]=field.valueAsNumber;
    }
    raw[s.id]=row;
  }
  if(raw.macd.fast>=raw.macd.slow)return invalid('MACD 단기 기간은 장기 기간보다 작아야 해.','macd_fast');
  if(raw.rsi.low>=raw.rsi.high)return invalid('RSI 하단은 상단보다 낮아야 해.','rsi_low');
  params=readStudies(raw);savePrefs();return null;
}
export function resetForm(form) {
  const p=defaultStudies();
  for(const s of studySpecs){
    form.elements[s.id+'_on'].checked=p[s.id].on;
    for(const [key] of s.fields)form.elements[s.id+'_'+key].value=p[s.id][key];
  }
  form.querySelector('.study-error').textContent='';
}

export function chartView(state){
  buildModel(state);
  return {detailed:view.detailed,legend:view.detailed?activeLegend():[],minuteFrames,longFrames,tf,intradayFrame,isIntraday:isIntra()};
}
export function repaintChart(){detailIndex=null;repaint();}
