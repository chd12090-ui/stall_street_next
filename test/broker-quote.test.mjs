import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {selectSymbol,handleBroker,matchingInstruments,searchInstruments,currentPositions,reg,
  instrumentSectors,sectorOptions,findRows,brokerChange} from '../src/game/broker.mjs';
import {selectStock} from '../src/game/terminal.mjs';
import {shortValue} from '../src/game/broker-data.mjs';
import {plotChart} from '../src/game/plot.mjs';
import {calculate,defaultStudies} from '../src/game/studies.mjs';
import {chartBars,fundHistoryReady,loadFundHistory,quoteInfo,quoteTrend,sessionBars} from '../src/game/tape.mjs';
import {packHistory,unpackHistory,historySignature} from '../src/game/chart-archive-codec.mjs';
import {fundHistoryLoaders} from '../src/game/fund-history/index.mjs';
import {initial,localRates,placeOrder,position} from '../src/game/market.mjs';
import {publicCompanyHistory} from '../src/game/company-filings.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';
const {MarketPage,MarketSearchSheet}=await loadJsx(new URL('../src/ui/exchange.jsx',import.meta.url));
const detail=(state,assetId)=>renderView(MarketPage,{state,assetId});
const {ActivityBody,FxBody}=await loadJsx(new URL('../src/ui/accounts.jsx', import.meta.url));
const activityBody=(state,kind)=>renderView(ActivityBody,{state,modal:{kind}});
import {actualTimestamp,continuousTradingDay,gameDayStart} from '../src/game/clock-calendar.mjs';
import {startLive,syncLiveClock} from '../src/game/live-clock.mjs';
import {stocks,markets,symbolIndex,previousSession} from '../src/game/world.mjs';
import {instrumentIndustryIds,isSpot} from '../src/game/securities-data.mjs';
import {industryLabels} from '../src/game/industries.mjs';

test('the exchange opens all active listings with a calendar and two supported currencies',()=>{
  const state=initial(),market=detail(state,null);
  const active=stocks.filter(asset=>!asset.archiveOnly);
  const listed=stocks.filter(asset=>!asset.archiveOnly&&asset.kind==='주식');
  assert.equal(listed.length,16);
  assert.equal(market.match(/data-live-symbol="\d+"/g).length,active.length);
  assert.equal(market.match(/class="bk-spark"/g).length,active.length);
  for(const fund of active.filter(asset=>asset.reference)){
    const path='art/companies/'+fund.id+'.webp';
    assert.ok(market.includes('src="/'+path+'"'),fund.name);
    assert.ok(existsSync(new URL('../public/'+path,import.meta.url)),path);
  }
  assert.match(market,/data-tab="market\/calendar" aria-label="캘린더"/);
  assert.match(market,/aria-label="시장 지수".*한국지수.*data-act="market-search" aria-haspopup="dialog".*i-search.*aria-label="캘린더"/);
  assert.match(market,/class="bk-index-change [^"]+">[+-]?[\d.]+%<\/span>/);
  assert.match(market,/<h2>보유 종목<\/h2>.*class="bk-empty-hold-cat" aria-hidden="true".*보유한 종목이 없어요/);
  assert.doesNotMatch(market,/bk-product-tabs|data-act="chat-share"|bk-wallet-exchange|<input[^>]*id="bk-search"|거래량순/);
  const calendar=renderView(MarketPage,{state,assetId:null,calendar:true});
  assert.match(calendar,/data-tab="market" aria-label="뒤로가기"/);
  assert.match(calendar,/aria-label="이전 달".*aria-label="다음 달"/);
  assert.match(calendar,/상장공시.*합병공시.*실적발표/);
  assert.ok(calendar.match(/data-act="calendar-day"/g).length>=28);
  assert.doesNotMatch(calendar,/bk-search|bk-results|data-act="chat-share"/);
  const firstRow=market.slice(market.indexOf('class="bk-listrow"'));
  assert.ok(firstRow.indexOf('class="bk-spark"')<firstRow.indexOf('data-live-price'));
  assert.match(firstRow,/class="bk-rank" aria-hidden="true">1<\/span><span class="bk-symbol-art"[^>]*>.*?class="country-flag"/);
  assert.doesNotMatch(market,/data-act="favorite"/);
  assert.match(detail(state,symbolIndex.MOON),/data-act="favorite"[^>]+aria-label="달밤물류 관심 추가" aria-pressed="false"><i[^>]+class="ico i-star"/);
  assert.match(market,/<div class="bk-wallet-pair"><button[^>]+data-act="fx" data-value="KRW"[^>]+>.*?<\/button><button[^>]+data-act="fx" data-value="USD"/);
  assert.equal(market.match(/data-act="fx"/g).length,2);
  assert.doesNotMatch(market,/계좌 상세|종목 더 보기|일본|중국|JPY|CNY/);
  assert.ok(listed.every(asset=>asset.formerNames));
  assert.match(market,/클릭파인드 종목 상세[^>]*>.*?art\/companies\/altq\.webp/);
  for(const a of listed){
    const label=a.market==='arden'?a.ticker:a.name;
    assert.ok(market.includes('class="bk-instrument-name" title="'+a.name+'"><b>'+label+'</b>'));
  }
  assert.match(detail(state,symbolIndex.FLFX),/<h1 class="bk-symbol-name">플레어폭스<\/h1>/);
  const foreign=renderView(FxBody,{state,modal:{from:'USD',to:'KRW',amount:'20'}});
  assert.match(foreign,/data-value="USD" aria-pressed="true">달러 → 원화/);
  assert.match(foreign,/보낼 달러.*inputMode="decimal".*받을 원화/);
  assert.doesNotMatch(foreign,/<select|JPY|CNY|환전 내역/);
  const funding=renderView(FxBody,{state,modal:{from:'KRW',to:'USD',returning:{i:symbolIndex.ARC},needed:10}});
  assert.doesNotMatch(funding,/data-act="fx-direction"/);
  assert.match(funding,/원화 → 달러.*환전하고 주문으로/);
});

test('holdings use the quote rows and show the share of total holdings by market, independent of purchase cost',()=>{
  const state=initial();
  for(const [code,qty] of [['MOON',3],['ARC',2],['NOVA',1],['BIT',0.01],['CROWN',1]]){
    const i=symbolIndex[code];
    state.holdings[i]=qty;
    state.costsKRW[i]=1_000_000;
  }
  const positions=currentPositions(state);
  const html=detail(state,null),held=html.slice(html.indexOf('class="bk-hold-groups"'),html.indexOf('class="bk-explore"'));
  assert.doesNotMatch(held,/bk-fold|aria-expanded|bk-spark/);
  for(const [id,label,weight] of [['domestic','국내증권',9],['overseas','해외증권',87],['coin','코인',0],['archive','이전 보유분',4]]){
    const rows=positions.filter(p=>reg(p.a)===id);
    const group=held.match(new RegExp('aria-labelledby="bk-hold-'+id+'">(.*?)<\\/section>'))?.[1];
    assert.ok(group?.includes(label+' <span class="bk-sr">평가액 비중 </span><b>'+weight+'%</b>'));
    assert.equal(group.match(/class="bk-listrow"/g).length,rows.length);
    for(const {i} of rows)assert.ok(group.includes('data-live-holding="'+i+'"'));
  }
});

test('holding groups share leftover percentage points without exceeding 100 percent',()=>{
  const state=initial();
  // Independent rounding would show 34%, 34%, and 33%.
  for(const [code,targetValue] of [['MOON',335_100_000],['ARC',337_200_000],['BIT',327_700_000]]){
    const i=symbolIndex[code];
    state.holdings[i]=1;
    state.holdings[i]=Math.round(targetValue/position(state,i).valueKRW);
  }
  const html=detail(state,null);
  const weights=[...html.matchAll(/id="bk-hold-(\w+)"><span>[^<]*<span class="bk-sr">평가액 비중 <\/span><b>(\d+)%<\/b>/g)];
  assert.deepEqual(weights.map(([,id,weight])=>[id,Number(weight)]),[['domestic',33],['overseas',34],['coin',33]]);
});

test('search opens as its own dialog and finds listings by their new or former names and tickers',()=>{
  const dialog=renderView(MarketSearchSheet,{state:initial()});
  assert.match(dialog,/role="dialog" aria-modal="true".*종목 검색.*id="bk-search"/);
  const cases=[
    ['HARB',['웨일라인','Whale Line','고래해운','웨스트헤이븐 시핑','WHVN']],
    ['AMIDX',['메리디언 미국 ETF','MAMX']],
    ['HRIDX',['한강 코리아 ETF','482260']],
    ['WFBK',['필드라인','필드라인 뱅크']],
    ['ARCI2',['노스스타 인버스 2X','노스스타칩스인버스2x']],
    ['ARCL3',['노스스타 3X','노스스타 칩스 레버리지 3X']],
    ['BIT',['냥이코인']],
  ];
  for(const [code,queries] of cases){
    for(const value of queries)assert.deepEqual(searchInstruments(value).map(({a})=>a.code),[code]);
  }
  for(const [name,codes] of [
    ['노스스타',['ARC','ARCL3','ARCI2']],
    ['한국지수',['MOR2','MORI','HRIDX']],['미국지수',['AMIDX','USL2','USI2']],
  ])assert.deepEqual(searchInstruments(name).map(({a})=>a.code),codes);
  assert.deepEqual(searchInstruments('   '),[]);
  assert.deepEqual(searchInstruments('국고채 3년'),[]);
  assert.match(detail(initial(),symbolIndex.ARCI2),/<h1 class="bk-symbol-name">노스스타 인버스 2X<\/h1>/);
});

test('the exchange uses the five icon categories and separates stock venues and ETF types',()=>{
  const state=initial();
  const market=detail(state,null);
  assert.match(market,/aria-label="상품 종류">.*i-market-grid.*>전체<.*>국내주식<.*>해외주식<.*>ETF<.*>코인</);
  assert.match(market,/<h2>시장 탐색<\/h2><div class="bk-selects">.*id="bk-sector".*id="bk-sort"/);
  assert.doesNotMatch(market,/aria-label="ETF 종류"|모든 시장|>관심<|>채권<|>옵션</);
  try{
    for(const [group,domestic] of [['domestic',true],['overseas',false]]){
      handleBroker('bk-group',{dataset:{value:group}});
      const expected=stocks.filter(asset=>!asset.archiveOnly&&asset.kind==='주식'&&(asset.market==='mora')===domestic);
      assert.deepEqual(matchingInstruments().map(({a})=>a),expected);
    }
    handleBroker('bk-group',{dataset:{value:'fund'}});
    const funds=detail(state,null);
    assert.match(funds,/aria-label="ETF 종류">.*>지수<.*>레버리지<.*>인버스</);
    assert.match(funds,/title="한국지수"><b>한국지수<\/b>/);
    assert.match(funds,/title="미국지수"><b>미국지수<\/b>/);
    assert.doesNotMatch(funds,/MAMX|한강 코리아 ETF/);
    for(const [type,codes] of [
      ['index',['HRIDX','AMIDX']],
      ['leverage',['MOR2','USL2','BMEML2','ARCL3','HZMAL2']],
      ['inverse',['MORI','USI2','BMEMI2','ARCI2','HZMAI3']],
    ]){
      handleBroker('bk-fund',{dataset:{value:type}});
      assert.deepEqual(matchingInstruments().map(({a})=>a.code),codes);
    }
    handleBroker('bk-group',{dataset:{value:'coin'}});
    assert.deepEqual(matchingInstruments().map(({a})=>a.code),['BIT']);
    assert.match(detail(state,null),/냥이코인 종목 상세[^>]*>.*?art\/companies\/nyan\.webp/);
    assert.ok(stocks.filter(asset=>asset.bond||asset.option).every(asset=>asset.archiveOnly));
  }finally{
    handleBroker('bk-group',{dataset:{value:'all'}});
    handleBroker('bk-fund',{dataset:{value:'index'}});
  }
});

test('market-cap ordering compares shares, ETF units and circulating coins in the same currency',()=>{
  const state=initial(),rates=localRates(state);
  assert.equal(brokerChange({id:'bk-sort',value:'cap'}),true);
  try{
    assert.match(detail(state,null),/<option value="cap" selected="">시가총액순<\/option>/);
    const rows=findRows(state);
    for(const {a,i,q,marketCap} of rows){
      const units=a.reference?a.units:isSpot(a)?a.circulating:publicCompanyHistory(i,state).current?.shares.end??a.shares;
      const expected=Number.isFinite(q.price)&&q.price>0?q.price*units*rates[a.currency]:null;
      assert.equal(marketCap,expected,a.code);
    }
    const order=rows.map(({marketCap})=>marketCap);
    assert.deepEqual(order,order.slice().sort((a,b)=>(b??-1)-(a??-1)));
    const funds=rows.filter(({a})=>a.reference&&a.factor<0);
    assert.ok(funds.length);
    handleBroker('bk-group',{dataset:{value:'fund'}});
    handleBroker('bk-fund',{dataset:{value:'inverse'}});
    assert.deepEqual(findRows(state).map(({a})=>a.code),funds.map(({a})=>a.code));
  }finally{
    handleBroker('bk-group',{dataset:{value:'all'}});
    handleBroker('bk-fund',{dataset:{value:'index'}});
    brokerChange({id:'bk-sort',value:'turn'});
  }
});

test('an ETF opens its own price archive without changing the live quote or loading another fund',async()=>{
  const state=initial(),index=symbolIndex.MOR2,other=symbolIndex.AMIDX;
  const quote=quoteInfo(state,index);
  assert.equal(fundHistoryReady(index),false);
  assert.equal(fundHistoryReady(symbolIndex.MOON),true);
  selectSymbol(index);selectStock(index);
  assert.match(detail(state,index),/이전 시세를 불러오는 중/);

  const loading=loadFundHistory(index);
  assert.equal(loadFundHistory(index),loading);
  await loading;

  assert.equal(fundHistoryReady(index),true);
  assert.equal(fundHistoryReady(other),false);
  assert.deepEqual(quoteInfo(state,index),quote);
  assert.ok(chartBars(state,index,'D')[0].day<0);
  assert.match(detail(state,index),/id="terminal-plot"/);
});

test('ETF archive compression preserves the previous format’s prices, volume and turnover',()=>{
  const start=174,legacy='A8gBrAKWAfoBGJ5C';
  const first={day:-2,step:start,key:-402,partial:false,o:1,h:1.5,l:.75,c:1.25,v:12,pv:14.13};
  assert.deepEqual(unpackHistory(legacy,start),[first]);
  const later={...first,day:-1,key:-114,o:1.23,h:1.28,l:1.17,c:1.18,v:10,pv:3599/300};
  const rows=[first,later];
  assert.deepEqual(unpackHistory(packHistory(rows),start),rows);
  assert.throws(()=>unpackHistory(legacy.slice(0,8),start),/Incomplete candle history/);
});

test('an incomplete ETF archive falls back to historical tape prices',async t=>{
  const state=initial(),index=symbolIndex.CLIDX,signature=historySignature(stocks[index],stocks,markets);
  const original=chartBars(state,index,'D');
  t.mock.method(fundHistoryLoaders,'CLIDX',async()=>({default:[signature,'v2:gA==']}));
  await loadFundHistory(index);
  assert.deepEqual(chartBars(state,index,'D'),original);
});

test('the chart mode shares a row with drawing and indicator controls above the plot',()=>{
  const state=initial(),i=symbolIndex.CORL;
  selectSymbol(i);selectStock(i);
  const chart=detail(state,i);
  assert.match(chart,/bk-symbol-name">세이와소재<\/h1><span class="bk-ticker">.*?4183<\/span>/);
  assert.doesNotMatch(chart,/bk-en|bk-conversion|bk-badge-art|Seiwa Materials/);
  assert.ok(chart.indexOf('bk-quote-stack')<chart.indexOf('id="candle-inspect"'));
  assert.ok(chart.indexOf('id="candle-inspect"')<chart.indexOf('bk-detail-tabs'));
  assert.match(chart,/class="candle-inspect"[^>]* hidden="">/);
  assert.match(chart,/aria-labelledby="candle-inspect-title"[^>]*>.*?id="candle-inspect-title">선택한 구간의 가격<\/b>/);
  assert.match(chart,/class="chart-tools-row"><label class="chart-mode">.*?자세한 차트<\/label><div class="analysis-toolbar".*?data-act="draw-settings".*?data-act="study-settings".*?<\/div><\/div>.*?id="terminal-plot"/);
  assert.doesNotMatch(chart,/SMA 60|선택 봉의 지표 수치/);
  handleBroker('bk-tab',{dataset:{value:'info'}},state);
  assert.doesNotMatch(detail(state,i),/id="candle-inspect"/);
});

test('large monetary amounts retain their currency and decimal precision',()=>{
  assert.equal(shortValue(3936096,'원'),'393.61만원');
  assert.equal(shortValue(124092000000,'',1),'1,240.9억');
});

test('quote detail chips share the exchange filter sectors and cap multi-sector companies at three',()=>{
  const state=initial();
  for(const [code,labels] of [['WFBK',['금융']],['HZMA',['자동차','에너지·전력']],['HZMAI3',['자동차','에너지·전력']]]){
    const i=symbolIndex[code];
    selectSymbol(i);selectStock(i);
    const header=detail(state,i).match(/class="bk-title-line">.*?<\/div>/)[0];
    assert.ok(header.includes(code+'</span><span class="bk-ticker bk-topic"'));
    assert.deepEqual([...header.matchAll(/class="bk-ticker bk-topic"[^>]*>([^<]+)/g)].map(match=>match[1]),labels);
  }
  const electric=stocks[symbolIndex.HZMA];
  assert.deepEqual(instrumentSectors({...electric,industryIds:['banking','insurance','cloud','automotive','power']},state.day),
    [['finance','금융'],['tech','기술·통신'],['auto','자동차']]);
  try{
    assert.ok(brokerChange({id:'bk-sector',value:'energy'}));
    assert.ok(findRows(state).some(({a})=>a.code==='HZMA'));
    assert.ok(sectorOptions(matchingInstruments()).some(([id,label])=>id==='energy'&&label==='에너지·전력 (3)'));
  }finally{brokerChange({id:'bk-sector',value:'all'});}
  for(const asset of stocks){
    const ids=instrumentIndustryIds(asset,continuousTradingDay);
    if(asset.kind==='주식')assert.ok(ids.length,asset.code);
    assert.equal(new Set(ids).size,ids.length,asset.code);
    assert.ok(ids.every(id=>Object.hasOwn(industryLabels,id)),asset.code);
  }
  const bank=symbolIndex.WFBK;
  selectSymbol(bank);selectStock(bank);
  handleBroker('bk-tab',{dataset:{value:'info'}},state);
  const bankInfo=detail(state,bank);
  assert.match(bankInfo,/자기자본비율/);
  assert.doesNotMatch(bankInfo,/게임 내 공시/);
});

test('quote reuse follows the market clock across players and refreshes live volume',()=>{
  const day=8,i=symbolIndex.MOON,start=gameDayStart(day)+9*3_600_000;
  const state=startLive(null,actualTimestamp(start));
  const opening=quoteInfo(state,i);
  const otherPlayer={...state,cash:1234,holdings:state.holdings.map(()=>1)};
  const theirQuote=quoteInfo(otherPlayer,i);
  assert.deepEqual(theirQuote,opening);
  theirQuote.price=-1;
  assert.deepEqual(quoteInfo(state,i),opening);
  syncLiveClock(state,actualTimestamp(start+59_000));
  assert.ok(quoteInfo(state,i).volume>opening.volume);
  assert.deepEqual(quoteInfo(otherPlayer,i),opening);
});

test('continuous listings show regular buy and sell actions without the market-hours badge',()=>{
  const day=continuousTradingDay+1,at=hour=>actualTimestamp(gameDayStart(day)+hour*3600000);
  const state=startLive(null,at(18)),i=symbolIndex.MOON;
  selectSymbol(i);selectStock(i);
  assert.equal(handleBroker('bk-tab',{dataset:{value:'book'}},state),false);
  assert.match(detail(state,i),/전일 대비/);
  assert.match(detail(state,i),/매도<\/button>.*매수<\/button>/);
  assert.doesNotMatch(detail(state,i),/data-value="book"|bk-bookrow|time-sheet|장 마감|매수 예약|거래량/);

  assert.equal(placeOrder(state,i,1,1),'');
  assert.match(activityBody(state,'orders'),/체결 대기<\/small>.*주문 수정/);
  handleBroker('bk-tab',{dataset:{value:'history'}},state);
  assert.doesNotMatch(detail(state,i),/거래량/);

  const archived=symbolIndex.KGEO;
  selectSymbol(archived);selectStock(archived);
  assert.match(detail(state,archived),/이전 상장 종목/);
  assert.doesNotMatch(detail(state,archived),/data-act="trade"/);
});

test('the selected candle date fits between the other axis labels on every calendar interval',()=>{
  globalThis.window={devicePixelRatio:2};
  const state={...initial(),day:8,cursor:180};
  const i=symbolIndex.VOLT;
  const params=defaultStudies(),textWidth=text=>Array.from(text).length*8;
  const labels=[];
  const ctx=new Proxy({
    measureText:text=>({width:textWidth(text)}),
    fillText(text,x,y,maxWidth){labels.push({text,x,y,maxWidth});},
  },{get:(o,k)=>k in o?o[k]:()=>{}});
  const canvas={isConnected:true,clientWidth:300,style:{},getContext:()=>ctx};
  const patterns={Y:/^\d{4}년$/,M:/^\d{4}\.\d{2}$/,W:/^\d{4}\.\d{2}\.\d{2} 주$/,D:/^\d{4}\.\d{2}\.\d{2}$/};
  for(const [tf,pattern] of Object.entries(patterns)){
    const bars=chartBars(state,i,tf);
    const model={bars,tf,data:calculate(bars,params),params,fills:new Map(),digits:0};
    const view={count:24,offset:0,selected:null,drawings:[]};
    assert.equal(plotChart(canvas,model,view).selectedDate,null);
    for(const selected of [Math.max(0,bars.length-24),bars.length-9,bars.length-1]){
      labels.length=0;view.selected=selected;
      const metric=plotChart(canvas,model,view);
      assert.match(metric.selectedDate,pattern);
      const row=labels.filter(label=>label.y===metric.height-13);
      const badge=row.find(label=>label.maxWidth!==undefined);
      assert.equal(badge.text,metric.selectedDate);
      assert.ok(badge.x>=metric.left&&badge.x+badge.maxWidth<=metric.right);
      for(const tick of row.filter(label=>label!==badge)){
        assert.ok(tick.x+textWidth(tick.text)<=badge.x-6||tick.x>=badge.x+badge.maxWidth+6);
      }
    }
  }
});

test('row trends carry previous-session closes into opening and end at the observed trade',()=>{
  const day=8,i=symbolIndex.MOON,prior=previousSession(stocks[i].market,day);
  const at=minute=>actualTimestamp(gameDayStart(day)+minute*60_000+26000);
  const state=startLive(null,at(8*60));
  const previous=sessionBars(prior,i);
  const before=quoteTrend(state,i);
  assert.deepEqual(before,previous.slice(-24).map(b=>b.c));
  assert.equal(quoteTrend(state,i),before);
  syncLiveClock(state,at(9*60+12));
  const rows=sessionBars(day,i),quote=quoteInfo(state,i);
  const live=quoteTrend(state,i,quote);
  assert.deepEqual(live,[...previous.slice(-21).map(b=>b.c),rows[0].c,rows[1].c,quote.price]);
  assert.equal(quoteTrend(state,i),live);
});
