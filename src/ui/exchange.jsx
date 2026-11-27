import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import * as broker from '../game/broker.mjs';
import * as terminal from '../game/terminal.mjs';
import {marketQuotes,chartReadouts} from '../game/exchange-events.mjs';
import {quoteInfo,quoteTrend} from '../game/tape.mjs';
import {stocks,symbolIndex} from '../game/world.mjs';
import {localRates} from '../game/market.mjs';
import {hasGlasses} from '../game/ai-glasses.mjs';
import {cash,cls,number,percent,shareCount} from '../game/broker-data.mjs';
import {ActivityLinks} from './accounts.jsx';
import {countries} from '../game/atlas-data.mjs';
import {watch} from '../game/discovery.mjs';
import {Flag} from './news-marks.jsx';
import {InstrumentListRow} from './exchange-list.jsx';
import {HistoryPanel,FlowPanel,InstrumentInfo,InstrumentNews} from './exchange-panels.jsx';
import {BrokerAccount} from './exchange-account.jsx';
import {Select,useFundHistory,useViewUpdate,ShareButton,CompanyMark} from './exchange-controls.jsx';
import {Icon,Sheet} from './controls.jsx';
import {ExchangeCalendar} from './exchange-calendar.jsx';
export {NewsPage} from './newspaper.jsx';
export {ChartSettings} from './chart-settings.jsx';

const view=broker.brokerView;
const marketIndices=[symbolIndex.HRIDX,symbolIndex.AMIDX];
const indexRefreshMs=900,readingsPerIndex=5;
const readIndexQuotes=state=>marketIndices.map(index=>quoteInfo(state,index));
function Favorite({index}){
  const asset=stocks[index],saved=watch.has(asset.code);
  return <button type="button" className="bk-fave" data-act="favorite" data-value={asset.code} aria-label={asset.name+' 관심 '+(saved?'해제':'추가')}
    aria-pressed={saved}><Icon name={saved?'star-filled':'star'}/></button>;
}
function ActionTabs({items,action,current}){
  return items.map(([id,name])=><button key={id} type="button" data-act={action} data-value={id} aria-pressed={id===current} className={id===current?'active':''}>{name}</button>);
}
function Results({initial,scope}){
  const state=useViewUpdate(initial,marketQuotes),root=useRef(null),ranking=useRef(null);
  const rates=localRates(state),rate=rates[view.money];
  // Live value rankings stay in place while a row has focus.
  const liveRank=view.sort==='turn'||view.sort==='cap';
  const keepOrder=ranking.current?.scope===scope&&(!liveRank||root.current?.contains(document.activeElement));
  const visible=keepOrder?
    ranking.current.visible.map(row=>({...row,q:quoteInfo(state,row.i),rate:rates[row.a.currency]||1})):broker.findRows(state,scope);
  const total=visible.length;
  ranking.current={scope,visible};
  return <div id="bk-results" ref={root}>
    <div className="bk-listcap"><span>종목 <b>{total}</b></span></div>
    {visible.map(({a,i,q,rate:quoteRate},rank)=><InstrumentListRow key={i} asset={a} index={i} rank={rank+1}
      trend={quoteTrend(state,i,q)} price={cash(q.price*quoteRate/rate,view.money)} change={percent(q.pct,true)} tone={cls(q.change)}/>)}
    {!total&&<p className="bk-empty">조건에 맞는 종목이 없어.</p>}</div>;
}
function Account({initial}){
  const state=useViewUpdate(initial,marketQuotes);
  return <BrokerAccount state={state}/>;
}
function IndexReading({index,quote,outgoing=false}){
  return <span className="bk-index-line" data-outgoing={outgoing?'':undefined} aria-hidden={outgoing||undefined}>
    <b>{stocks[index].name}</b><span>{number(quote.price,2)}</span>
    <span className={'bk-index-change '+cls(quote.pct)}>{percent(quote.pct,true)}</span>
  </span>;
}
function IndexTicker({initial}){
  const latest=useRef(initial);
  const [frame,setFrame]=useState(()=>({reading:0,quotes:readIndexQuotes(initial)}));
  useEffect(()=>{
    latest.current=initial;
    return marketQuotes.subscribe(state=>{latest.current=state;});
  },[initial]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      const quotes=readIndexQuotes(latest.current);
      setFrame(previous=>({reading:previous.reading+1,quotes}));
    },indexRefreshMs);
    return ()=>clearInterval(timer);
  },[]);
  const step=Math.floor(frame.reading/readingsPerIndex),current=step%marketIndices.length;
  const previous=(current+marketIndices.length-1)%marketIndices.length;
  return <div className="bk-index-ticker" role="group" aria-label="시장 지수">
    <div className="bk-index-window" key={current} data-moving={step>0?'':undefined}>
      {step>0&&<IndexReading index={marketIndices[previous]} quote={frame.quotes[previous]} outgoing/>}
      <IndexReading index={marketIndices[current]} quote={frame.quotes[current]}/>
    </div>
  </div>;
}
export function MarketSearchSheet({state:initial}){
  const state=useViewUpdate(initial,marketQuotes);
  const [query,setQuery]=useState('');
  const results=broker.searchInstruments(query);
  return <Sheet title="종목 검색" theme="bk-search-sheet">
    <label className="bk-search-entry">
      <Icon name="search"/>
      <input id="bk-search" type="search" aria-label="종목명, 티커, 시장 검색"
        placeholder="종목명, 티커, 시장 검색" autoComplete="off" value={query} onChange={event=>setQuery(event.target.value)}/>
    </label>
    {query.trim()&&<p className="bk-search-count" role="status">{results.length?'검색 결과 '+results.length+'개':'검색 결과가 없어요'}</p>}
    {results.length>0&&<ul className="bk-search-results" aria-label="종목 검색 결과">
      {results.map(({a,i})=><li key={a.code}><button type="button" data-act="symbol" data-id={i}>
        <span className="bk-mark" aria-hidden="true"><CompanyMark asset={a}/></span>
        <span className="bk-search-name"><b>{a.name}</b>{!a.indexTracker&&<small>{a.ticker}</small>}</span>
        <strong>{cash(quoteInfo(state,i).price,a.currency)}</strong>
      </button></li>)}
    </ul>}
  </Sheet>;
}
function MarketFilters({scope}){
  const hasSectors=view.group!=='fund'&&view.group!=='coin';
  return <>
    <div className="bk-heading bk-explore-heading">
      <h2>시장 탐색</h2>
      <div className="bk-selects">
        {hasSectors&&<Select className="ui-compact" id="bk-sector" aria-label="섹터" value={view.sector}>
          {broker.sectorOptions(scope).map(([id,label])=><option key={id} value={id}>{label}</option>)}
        </Select>}
        <Select className="ui-compact" id="bk-sort" aria-label="종목 정렬" value={view.sort}>
          {broker.sortOrders.map(([id,name])=><option key={id} value={id}>{name}</option>)}
        </Select>
      </div>
    </div>
    <div className="bk-category-strip" role="group" aria-label="상품 종류">
      {broker.productFilters.map(([id,label,icon])=><button key={id} type="button" data-act="bk-group"
        data-value={id} aria-pressed={id===view.group}>
        <Icon name={icon}/><span>{label}</span>
      </button>)}
    </div>
    {view.group==='fund'&&<div className="bk-filter bk-etf-filter" role="group" aria-label="ETF 종류">
      <ActionTabs items={broker.etfFilters} action="bk-fund" current={view.fundType}/>
    </div>}
  </>;
}
function Overview({initial:state}){
  const scope=broker.matchingInstruments();
  return <div className="broker bk-overview"><header className="bk-toolbar view-heading"><h1>거래소</h1>
    <IndexTicker initial={state}/>
    <div className="bk-toolbar-actions">
      <button className="bk-toolbar-button" type="button" data-act="market-search"
        aria-haspopup="dialog" aria-label="종목 검색 열기" title="종목 검색"><Icon name="search"/></button>
      <button className="bk-toolbar-button" type="button" data-act="tab" data-tab="market/calendar" aria-label="캘린더" title="캘린더"><Icon name="calendar"/></button>
    </div></header>
    <svg className="bk-spark-ink" width="0" height="0" aria-hidden="true" focusable="false"><defs>
      <linearGradient id="bk-trend-fill" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="3" y2="30">
        <stop stopColor="var(--px-pine)" stopOpacity=".21"/>
        <stop offset=".55" stopColor="var(--scene-accent-edge)" stopOpacity=".24"/>
        <stop offset="1" stopColor="var(--scene-accent-edge)" stopOpacity="0"/>
      </linearGradient>
    </defs></svg>
    <div className="bk-overview-sections">
      <Account initial={state}/>
      <section className="bk-explore"><MarketFilters scope={scope}/><Results initial={state} scope={scope}/></section>
      <ActivityLinks state={state}/>
    </div></div>;
}

const initialReadout={prices:[],tone:'even'};
function CandlePrices(){
  const reading=useViewUpdate(initialReadout,chartReadouts);
  return <dl id="ohlc" className="ohlc">{reading.prices.map(([label,num])=><div key={label}><dt>{label}</dt><dd className={reading.tone}>{num}</dd></div>)}</dl>;
}
function Chart({state}){
  const chart=terminal.chartView(state),{tf,detailed,minuteFrames,longFrames,intradayFrame}=chart;
  useLayoutEffect(()=>{
    terminal.mount();
    return terminal.unmount;
  },[detailed,tf]);
  useLayoutEffect(()=>{terminal.repaintChart();});
  const menuItem=(id,label,selected)=><button key={id} type="button" data-act="interval" data-value={id} aria-pressed={selected} className={selected?'active':''}>{label}</button>;
  const chartName=detailed?'캔들 차트':'선형 가격 차트';
  return <section className="terminal pro-chart" aria-label="가격 차트">
    <div className="chart-tools-row"><label className="chart-mode"><input type="checkbox" id="chart-detailed" defaultChecked={detailed} key={String(detailed)}/>자세한 차트</label>
    {detailed&&<div className="analysis-toolbar">{[['draw-settings','그리기 도구','pencil'],['study-settings','지표 설정','settings']].map(([act,title,icon])=>
      <button type="button" key={act} className="t-setting ui-control ui-icon ui-compact" data-act={act} aria-haspopup="dialog" aria-label={title} title={title}><Icon name={'chart-'+icon}/></button>)}</div>}</div>
    {detailed&&<div id="draw-status" role="status"/>}{chart.legend.length>0&&<div className="plot-legend">
      {chart.legend.map(({label,color,className})=><span key={label} className={className}>{color&&<i style={{'--swatch':color}}/>}{label}</span>)}
    </div>}
    <canvas id="terminal-plot" tabIndex={0} role="application" aria-controls="candle-inspect" aria-label={chartName+'. 탭하거나 방향키를 누르면 선택한 가격을 확인해. 두 손가락, 마우스 휠 또는 +와 −로 확대·축소하고 좌우로 밀어 이동해.'}/>
    <div className="tf-tabs" role="group" aria-label="봉 주기"><span className="tf-intraday">
      {menuItem(intradayFrame,minuteFrames.find(([id])=>id===intradayFrame)[1],chart.isIntraday)}
      <label className="tf-period-picker"><Select className="ui-compact" id="chart-intraday" aria-label="틱·분봉 주기" value={intradayFrame}>
        {minuteFrames.map(([id,name])=><option key={id} value={id}>{name}</option>)}</Select></label></span>
      {longFrames.map(([id,label])=>menuItem(id,label,tf===id))}</div>
  </section>;
}

function Quote({initial,index}){
  const state=useViewUpdate(initial,marketQuotes),a=stocks[index],q=quoteInfo(state,index);
  return <div className="bk-quote-stack"><div className="bk-quote-default"><div className="bk-security-title"><div className="bk-title-line">
    <h1 className="bk-symbol-name">{a.name}</h1>
    {!a.indexTracker&&<span className="bk-ticker"><Flag nation={a.country}/><span className="bk-sr">{(countries[a.country]?.name||'')+' 티커 '}</span>{a.ticker||a.code}</span>}
    {broker.instrumentSectors(a,state.day).map(([id,label])=>
      <span className="bk-ticker bk-topic" key={id} data-sector-id={id}>{label}</span>)}
    </div></div>
    <strong className="bk-symbol-price" data-live-price="">{cash(q.price,a.currency)}</strong>
    <div className="bk-change"><span>전일 대비</span> <b data-live-change="" className={cls(q.change)}>{broker.sessionChange(q,a.currency)}</b></div></div>
    {broker.chartActive()&&<section className="candle-inspect" id="candle-inspect" aria-labelledby="candle-inspect-title" hidden>
      <div className="bar-heading"><b id="candle-inspect-title">선택한 구간의 가격</b></div><CandlePrices/>
    </section>}</div>;
}
function OrderActions({initial,index}){
  const state=useViewUpdate(initial,marketQuotes),a=stocks[index],quantity=state.holdings[index],order=state.orders[index];
  if(a.archiveOnly&&!quantity&&!order)return <div className="bk-order-actions"><div className="bk-closed"><b>이전 상장 종목</b><span>시세 조회</span></div></div>;
  return <div className="bk-order-actions">{!!(quantity||order)&&<div className="bk-order-held"><span>{quantity?'보유 '+shareCount(quantity,index):''}{quantity&&order?' · ':''}
    {!!order&&<span>{'대기 '+shareCount(Math.abs(order),index)}</span>}</span><button className="bk-link" data-act="orders">주문 내역 ›</button></div>}
    <div className="bk-order-buttons"><button className="sell ui-control ui-compact" data-act="trade" data-side="sell" data-id={index} disabled={a.archiveOnly&&!quantity}>매도</button>
      <button className="buy ui-control ui-compact" data-act="trade" data-side="buy" data-id={index} disabled={a.archiveOnly}>{a.archiveOnly?'매수 종료':'매수'}</button></div></div>;
}
function MarketBack({label}){
  return <button className="detail-back bk-back" type="button" data-act="tab" data-tab="market" aria-label={label}>
    <Icon name="down"/>
  </button>;
}
function Instrument({state,index}){
  if(view.symbol!==index)broker.selectSymbol(index);
  const a=stocks[index],tab=view.tab,Panel={history:HistoryPanel,flow:FlowPanel,info:InstrumentInfo}[tab];
  const ready=useFundHistory(['chart','history','flow'].includes(tab)?index:null);
  return <div className="broker bk-detail"><header className="bk-detail-top view-heading"><MarketBack label="종목 목록으로 돌아가기"/>
    <div>{hasGlasses(state)&&!a.archiveOnly&&<button type="button" className="bk-ai-glasses ui-control ui-compact"
      data-act="ai-forecast" data-id={index} aria-label="AI 안경으로 시세 예측" aria-haspopup="dialog">
      <img className="sprite" src="/art/shop/ai-glasses.webp" width="24" height="24" alt=""/>AI 안경
    </button>}<ShareButton kind="stock" content={a.code}/>{!a.archiveOnly&&<Favorite index={index}/>}</div></header><Quote initial={state} index={index}/>
    <nav className="bk-detail-tabs" aria-label="종목 정보 메뉴"><ActionTabs items={broker.detailTabs} action="bk-tab" current={tab}/></nav>
    <section className={'bk-panel bk-panel-'+tab} aria-busy={!ready||undefined}>
      {!ready?<p className="bk-note" role="status">이전 시세를 불러오는 중…</p>:
        tab==='chart'?<><Chart state={state}/><InstrumentNews state={state} index={index}/></>:<Panel state={state} index={index}/>}
    </section>
    <OrderActions initial={state} index={index}/></div>;
}
export function MarketPage({state,assetId,calendar}){
  if(calendar)return <ExchangeCalendar state={state}/>;
  return assetId===null?<Overview initial={state}/>:<Instrument key={assetId} state={state} index={assetId}/>;
}
