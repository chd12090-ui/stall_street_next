import test from 'node:test';
import assert from 'node:assert/strict';
import {plotChart} from '../src/game/plot.mjs';
import {defaultStudies,calculate} from '../src/game/studies.mjs';
import {averagePurchasePrice,initial,position,placeOrder,advanceMarket} from '../src/game/market.mjs';
import {symbolIndex} from '../src/game/world.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';

test('the chart mode and explicitly enabled SMA survive reloads, with SMA off by default',async()=>{
  const store=new Map();
  globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};
  const state=initial(),i=symbolIndex.MOON;
  const chart=await import('../src/game/terminal.mjs?chart-test-default');
  chart.selectStock(i);
  assert.equal(chart.chartView(state).detailed,true);
  assert.doesNotMatch(chart.chartView(state).legend.map(item=>item.label).join(' '),/SMA/);
  chart.adjust('interval','W');
  chart.setChartDetail(false);
  const reloaded=await import('../src/game/terminal.mjs?chart-test-restored');
  const simple=reloaded.chartView(state);
  assert.equal(simple.detailed,false);
  assert.equal(simple.tf,'W');
  assert.deepEqual(simple.legend,[]);
  assert.ok(reloaded.orderLevels(state,i).levels.length);
  reloaded.setChartDetail(true);
  assert.deepEqual(reloaded.chartView(state).legend,[]);

  // A returning player who enabled SMA keeps it in the detailed chart.
  const prefsKey='stall-street:chart-settings:1',prefs=JSON.parse(store.get(prefsKey));
  prefs.studies.sma.on=true;
  store.set(prefsKey,JSON.stringify(prefs));
  const {MarketPage}=await loadJsx(new URL('../src/ui/exchange.jsx',import.meta.url));
  const mounted=await import('../src/game/terminal.mjs'),render=()=>renderView(MarketPage,{state,assetId:i});
  assert.match(render(),/id="chart-detailed" checked=""/);
  assert.match(render(),/class="plot-legend".*?SMA 60/);
  mounted.setChartDetail(false);
  const simpleHtml=render();
  assert.match(simpleHtml,/id="chart-detailed"\/>자세한 차트/);
  assert.match(simpleHtml,/data-value="W" aria-pressed="true"/);
  assert.doesNotMatch(simpleHtml,/class="plot-legend"|class="readouts"|data-act="study-settings"/);
  delete globalThis.localStorage;
});

test('resetting drawings clears the current symbol and interval and cancels the selected tool',async t=>{
  const chart=await import('../src/game/terminal.mjs?drawing-reset');
  const mark={tool:'level',points:[{key:288,v:102}]};
  const selected=symbolIndex.MOON+'/D',weekly=symbolIndex.MOON+'/W',other=symbolIndex.CORL+'/D';
  const remaining={[weekly]:[mark],[other]:[mark]};
  const writes=[];
  chart.bindChartDrawings({drawings:{...remaining,[selected]:[mark,mark]}},records=>writes.push(structuredClone(records)));
  globalThis.document={getElementById:()=>null};
  t.after(()=>delete globalThis.document);
  chart.selectStock(symbolIndex.MOON);
  chart.adjust('interval','D');
  chart.adjust('draw','trend');
  assert.equal(chart.settingsSnapshot().canReset,true);
  chart.adjust('draw','reset');
  assert.equal(chart.settingsSnapshot().active,null);
  assert.equal(chart.settingsSnapshot().canReset,false);
  assert.deepEqual(chart.chartDrawings(),remaining);
  chart.adjust('draw','reset');
  assert.deepEqual(writes,[remaining]);
});

function draw(average,detailed,prices=[101,104,99,103]){
  const bars=prices.map((c,day)=>({key:day*288,step:0,o:c-1,c,h:c+2,l:c-2,v:100,day}));
  const texts=[],strokes=[];
  let path=[],dash=[];
  const ctx=new Proxy({
    measureText:text=>({width:text.length*7}),
    fillText(text,x,y){texts.push({text,x,y,font:this.font});},
    beginPath(){path=[];},moveTo(x,y){path.push([x,y]);},lineTo(x,y){path.push([x,y]);},
    setLineDash(pattern){dash=pattern;},
    stroke(){strokes.push({color:this.strokeStyle,path:[...path],dash:[...dash]});}
  },{get:(target,key)=>key in target?target[key]:()=>{}});
  const params=defaultStudies(),model={bars,tf:'D',params,data:detailed?calculate(bars,params):null,
    currency:'USD',digits:2,average,fills:new Map(),target:null};
  const metric=plotChart({isConnected:true,clientWidth:310,style:{},getContext:()=>ctx},model,
    {count:10,offset:0,selected:null,detailed,drawings:[]});
  return {metric,texts,strokes};
}

test('both chart modes plot the native average on a left-labeled dashed line; extreme basis leaves prices readable',()=>{
  globalThis.window={devicePixelRatio:2};
  for(const detail of [true,false]){
    const {metric,texts,strokes}=draw(102.5,detail);
    const avg=texts.find(v=>v.text==='평균 매수가 $102.50');
    const rule=strokes.find(s=>s.color==='#727873'&&s.dash.length);
    assert.ok(avg&&avg.x<=metric.left+8);
    assert.match(avg.font,/^14px /);
    assert.ok(texts.some(({y,font})=>y===metric.height-13&&font.startsWith('13px ')));
    if(detail)assert.ok(texts.some(({x,font})=>x===metric.right+4&&font.startsWith('13px ')));
    assert.deepEqual(rule.path.map(p=>p[0]),[metric.left,metric.right]);
    assert.ok(Math.abs(metric.valueAt(rule.path[0][1])-102.5)<.001);
    assert.ok(!draw(null,detail).texts.some(x=>x.text.includes('평균 매수가')));
    const distant=draw(12000,detail);
    assert.ok(distant.texts.some(x=>x.text==='↑ 평균 매수가 $12,000.00'));
    assert.ok(distant.metric.valueAt(15)<150,'an offscreen cost should not flatten the price trace');
  }
  const {texts,strokes}=draw(null,false);
  assert.ok(texts.some(x=>x.text==='최고 $104.00'));
  assert.ok(texts.some(x=>x.text==='최저 $99.00'));
  assert.ok(strokes.some(s=>s.path.length===4));
  assert.ok(!texts.some(x=>x.text.startsWith('VOL')));
  assert.ok(draw(null,false,[103]).texts.some(x=>x.text==='최고·최저 $103.00'));
  delete globalThis.window;
});

test('purchase average uses native filled cost and clears after the last sale',()=>{
  const s=initial(),i=symbolIndex.ARC;
  s.wallets.USD=5000;
  advanceMarket(s,174);
  assert.equal(averagePurchasePrice(s,i),null);
  for(const qty of [3,2,-1,-4]){
    assert.equal(placeOrder(s,i,qty),'');
    advanceMarket(s,1);
    if(s.holdings[i]){
      assert.equal(averagePurchasePrice(s,i),s.costs[i]/s.holdings[i]);
      assert.equal(averagePurchasePrice(s,i),position(s,i).average);
      assert.notEqual(averagePurchasePrice(s,i),s.costsKRW[i]/s.holdings[i]);
    }
  }
  assert.equal(s.fills.length,4);
  assert.equal(averagePurchasePrice(s,i),null);
});

test('long indicator legends stay inside a narrow chart and height is set only when it changes',()=>{
  globalThis.window={devicePixelRatio:2};
  const width=160,labels=[];
  const measure=text=>Array.from(text).length*9;
  const ctx=new Proxy({
    measureText:text=>({width:measure(text)}),
    fillText:(text,x,y,maxWidth)=>labels.push({text,x,y,end:x+Math.min(measure(text),maxWidth??Infinity)}),
  },{get:(target,key)=>key in target?target[key]:()=>{}});
  const bars=Array.from({length:60},(_,day)=>{
    const c=1e8+day*999_001;
    return {key:day*288,step:0,o:c-1,c,h:c+2,l:c-2,v:916_300_000,day};
  });
  const params=defaultStudies();
  params.macd.on=true;
  params.dmi.on=true;
  const model={bars,tf:'D',params,data:calculate(bars,params),currency:'KRW',digits:0,
    average:1_000_000_000,fills:new Map(),target:null};
  let height='',heightWrites=0;
  const style={get height(){return height;},set height(value){height=value;heightWrites++;}};
  const canvas={isConnected:true,clientWidth:width,style,getContext:()=>ctx};
  const view={count:10,offset:0,selected:null,drawings:[]};
  for(let i=0;i<2;i++){
    labels.length=0;
    plotChart(canvas,model,view);
    assert.ok(labels.some(({text})=>text.includes('평균 매수가')));
    for(const prefix of ['MACD ','M ','S ','H ','DMI ','ADX ','+ ','− ']){
      const legend=labels.find(({text})=>text.startsWith(prefix));
      assert.ok(legend,prefix);
      assert.ok(legend.x>=0&&legend.end<=width,legend.text);
      assert.ok(!labels.some(other=>other!==legend&&other.y===legend.y&&other.x<legend.end&&other.end>legend.x),legend.text);
    }
  }
  assert.equal(heightWrites,1);
  assert.equal(plotChart({...canvas,getContext:()=>null},model,view),null);
  delete globalThis.window;
});
