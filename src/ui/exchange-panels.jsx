import React,{useMemo} from 'react';
import {brokerView as view,historyData,historyDate,labelsPeriod,flowData,productInfo,newsData} from '../game/broker.mjs';
import {stocks,currencies,isSpot,symbolIndex} from '../game/world.mjs';
import {fundTracking} from '../game/securities-data.mjs';
import {number,cash,cls,percent} from '../game/broker-data.mjs';
import {dayLabel,firstGameDay,marketClock} from '../game/clock-calendar.mjs';
import {publicationLabel,publicationMinute,headline} from '../game/newsroom.mjs';
import {TopicBadge} from './news-marks.jsx';
import {Icon} from './controls.jsx';
import {useViewUpdate} from './exchange-controls.jsx';
import {marketQuotes} from '../game/exchange-events.mjs';
import {CompanyFinancials, MetricsSection} from './exchange-financials.jsx';

function Title({children,side}){
  return <div className="bk-panel-title"><h2>{children}</h2>{side}</div>;
}
function Segment({items,action,selected}){
  return <div className="bk-segment">{items.map(([id,title])=><button type="button" key={id} data-act={action} data-value={id} aria-pressed={id===selected} className={id===selected?'active':''}>{title}</button>)}</div>;
}
function Table({name,columns,children}){
  return <div className="bk-table-scroll" role="region" aria-label={name} tabIndex={0}><table className="bk-table"><thead><tr>{columns.map(title=><th scope="col" key={title}>{title}</th>)}</tr></thead>
    <tbody>{children}</tbody></table></div>;
}
export function HistoryPanel({state,index}){
  const {data,edge,selected,tf,maxPage,subset}=historyData(state,index),currency=stocks[index].currency;
  return <><Title side={<Segment items={Object.entries(labelsPeriod)} action="bk-period" selected={tf}/>}>시세</Title>
    {selected&&<div className="bk-history-summary">
      <dl className="bk-ohlc">{[['시작',selected.o],['최고',selected.h],['마지막',selected.c],['최저',selected.l]].map(([name,value])=>
        <div className="bk-stat" key={name}><dt>{name}</dt><dd>{cash(value,currency)}</dd></div>)}</dl></div>}
    <Table name="시세 내역" columns={['일시','종가','등락률']}>{subset.map((bar,j)=>{
      const prior=data[edge-j-2],change=prior?.c?(bar.c/prior.c-1)*100:null,date=historyDate(state,bar,tf),active=bar===selected;
      return <tr className={active?'sel':''} key={bar.key}><th scope="row"><button data-act="bk-bar" data-value={bar.key} aria-pressed={active} aria-label={date+' 가격 범위 보기'}>{date}</button></th>
        <td>{number(bar.c,currencies[currency]?.digits??2)}</td><td className={cls(change)}>{percent(change,true)}</td></tr>;
    })}</Table>{data.length?<nav className="bk-pages" aria-label="시세 내역 페이지">
      <button type="button" className="ui-control ui-icon ui-compact" data-act="bk-page" data-value="-1" aria-label="이전 페이지" disabled={view.historyPage===0}><Icon name="down"/></button>
      <span aria-live="polite">{number(view.historyPage+1)+' / '+number(maxPage+1)}</span>
      <button type="button" className="ui-control ui-icon ui-compact" data-act="bk-page" data-value="1" aria-label="다음 페이지" disabled={view.historyPage>=maxPage}><Icon name="down"/></button>
    </nav>:<p className="bk-empty">아직 완성된 봉이 없어.</p>}</>;
}
export function FlowPanel({state,index}){
  const {labels,totals,rows,high,fmt}=flowData(state,index);
  return <><Title side={<Segment items={[1,5,20].map(n=>[n,n+'일'])} action="bk-flow-range" selected={view.flowPeriod}/>}>투자자 동향</Title>
    <div className="bk-flow-bars">{totals.map(({net},j)=><div key={labels[j]}><span>{labels[j]}</span><i><em className={net>=0?'positive':'negative'} style={{'--width':Math.abs(net)/high*49+'%'}}/></i>
      <b className={cls(net)}>{(net>0?'+':'')+fmt(net)}</b></div>)}</div>
    <Table name="투자자별 순매수 내역" columns={['기준일',...labels]}>{[...rows].reverse().map(({b,net})=><tr key={b.key}><th scope="row">{dayLabel(state,b.day)}</th>
      {net.map((amount,i)=><td key={labels[i]} className={cls(amount)}>{(amount>0?'+':'')+fmt(amount)}</td>)}</tr>)}</Table>
    <details className="bk-explain"><summary className="ui-disclosure">모의 수급 집계 기준</summary><p>각 집단의 매수 금액에서 매도 금액을 뺀 추정치야. 금액은 봉의 대표가격으로 환산하고, 세 집단의 합계는 0이야. {isSpot(stocks[index])?'코인 집단은 게임 안의 주문 규모와 유동성 공급 역할로 구분해.':'외국인은 비거주자, 개인과 기관은 해당 시장의 거주자로 분류해.'}</p></details></>;
}
export function InstrumentInfo({state:initial,index}){
  const state=useViewUpdate(initial,marketQuotes);
  const issue=stocks[index],focus=view.analysisFocus?.code===issue.code?view.analysisFocus:null;
  if(issue.kind==='주식')return <CompanyFinancials state={state} index={index} focus={focus}/>;
  const {title,rows,metadata,explanation}=productInfo(state,index);
  const reference=fundTracking(issue,marketClock(state).day).reference;
  if(reference)return <div className="bk-financials">
    <MetricsSection headingId="bk-etf-heading" title={title} rows={rows}/>
    <MetricsSection headingId="bk-etf-operation-heading" title="운용 정보" rows={metadata} details>
      <p className="bk-finance-note">{explanation}</p>
      <details className="bk-explain"><summary className="ui-disclosure">{reference.length===1?'기초자산 보기':'구성자산과 기준 비중'}</summary>
        <ul className="bk-etf-components">{reference.map(code=>{
          const i=symbolIndex[code],member=stocks[i];
          return <li key={code}>{member.archiveOnly?<span>{member.name}</span>:<button type="button" data-act="symbol" data-id={i}>{member.name}</button>}
            <b>{percent(100/reference.length)}</b></li>;
        })}</ul></details>
    </MetricsSection>
  </div>;
  return <><Title>{title}</Title><dl className="bk-metrics bk-metrics-key">
    {rows.map(([label,value,wide])=><div className={wide?'bk-metric-wide':undefined} key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>{explanation&&<p className="bk-note">{explanation}</p>}</>;
}
const impactLabels={positive:'호재',negative:'악재',neutral:'중립'};
export function InstrumentNews({state:initial,index}){
  const state=useViewUpdate(initial,marketQuotes),{day,cursor}=marketClock(state);
  const minute=publicationMinute(state,day*288+cursor),openingDay=firstGameDay(state);
  const stories=useMemo(()=>newsData(state,index),[day,cursor,index,state.ritualEvents]);
  const rows=useMemo(()=>stories.map(({story,impact})=>
    <button type="button" className="bk-story" key={story.id} data-act="article" data-value={story.id}>
      <span className="bk-story-impact" data-impact={impact}><span className="bk-story-impact-label">{impactLabels[impact]}</span></span>
      <span className="bk-story-copy">
        <span className="bk-story-meta"><small>{publicationLabel(story,minute,openingDay)}</small><TopicBadge story={story}/></span>
        <span className="news-story-title"><b>{headline(story)}</b></span>
      </span>
    </button>),[stories,minute,openingDay]);
  return <section className="bk-chart-news" aria-labelledby="bk-chart-news-heading">
    <header className="bk-panel-title"><h2 id="bk-chart-news-heading">소식</h2></header>
    {rows.length?rows:<p className="bk-empty">현재 시각까지 발행된 관련 소식이 없어.</p>}
  </section>;
}
