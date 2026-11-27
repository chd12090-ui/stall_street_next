import {currentReportRow} from '../game/spy-snapshot.mjs';
import React, {useEffect, useLayoutEffect} from 'react';
import {exchangeable,netWealth} from '../game/market.mjs';
import {currencies,fmtMoney,quantityUnit,stocks,symbolIndex} from '../game/world.mjs';
import {spyWindowMs} from '../game/desk-charges.mjs';
import {spyOffer,reportName,reportTime} from '../game/desk-reports.mjs';
import {intimidationOffer} from '../game/desk-intimidation.mjs';
import {CompanyMark,Select} from './exchange-controls.jsx';

const quantity=n=>Math.abs(n).toLocaleString('ko-KR',{maximumFractionDigits:8});

function ServiceForm({offer}){
  const {id,description,targets,selected,cost,available,terms,status,success,action,disabled,quoted}=offer;
  const targetId=id+'-target';
  return <form id={id+'-form'} className="desk-service-form">
    <p className="desk-service-description">{description}</p>
    <div className="desk-service-target"><label htmlFor={targetId}>대상 친구</label>
      <Select id={targetId} name="target" value={selected}>{targets.map(({value,label})=><option key={value} value={value}>{label}</option>)}</Select>
    </div>
    <dl className="desk-service-cost">
      <div><dt>이용 비용</dt><dd>{fmtMoney(cost)}</dd></div>
      <div><dt>사용 가능한 돈</dt><dd>{fmtMoney(available)}</dd></div>
    </dl>
    <p className="desk-service-terms">{terms}</p>
    {status&&<p className="desk-service-status" role="status">{status}</p>}
    {success&&<p className="desk-service-description" role="status">{success}</p>}
    <button type="submit" className="btn primary full" data-cost={quoted?cost:undefined} disabled={disabled}>{action}</button>
  </form>;
}

function SpyArchive({state,modal}){
  const reports=[...(state.botSpyReports??[]),...modal.archive].sort((a,b)=>b.issuedAt-a.issuedAt);
  return <section className="spy-archive"><h3>보관한 보고서</h3>
    {reports.map(report=><button key={report.id} type="button" className="spy-file" data-act="spy-read" data-value={report.id}>
      <i className="ico i-receipt" aria-hidden="true"/><span><b>{reportName(report)}</b><small>{reportTime(state,report.issuedAt)}</small></span><span className="spy-file-read">열기</span></button>)}
    {!reports.length&&!modal.loadingArchive&&!modal.archiveError&&<p className="spy-empty">아직 발급한 보고서가 없어.</p>}
    {modal.loadingArchive&&<p className="spy-empty" role="status">보관함을 불러오는 중…</p>}
    {modal.archiveError&&<button type="button" className="btn light full" data-act="spy-load">보관함 다시 불러오기</button>}
    {modal.more&&!modal.loadingArchive&&!modal.archiveError&&<button type="button" className="btn light full" data-act="spy-load">이전 보고서 더 보기</button>}
  </section>;
}
function ReportSection({title,count,children}){
  return <section className="spy-section"><header><h3>{title}</h3><span>{count}</span></header>{children}</section>;
}
function SpyReport({state,report}){
  const holdings=report.positions.map(currentReportRow).filter(row=>Object.hasOwn(symbolIndex,row.code)).sort((a,b)=>b.costKRW-a.costKRW);
  const fills=report.trades.map(currentReportRow).filter(row=>Object.hasOwn(symbolIndex,row.code)).sort((a,b)=>b.at-a.at);
  return <><article className="spy-report">
    <header className="spy-report-head"><span><i className="ico i-receipt" aria-hidden="true"/> {reportName(report)}</span><time>발급 · {reportTime(state,report.issuedAt)}</time></header>
    <ReportSection title="보유 포트폴리오" count={holdings.length+'종목'}>
      {holdings.length?<ul className="spy-data">{holdings.map(row=>{
        const i=symbolIndex[row.code],stock=stocks[i];
        return <li key={row.code}><CompanyMark asset={stock} size={28}/>
          <span className="spy-asset"><strong>{stock.name}</strong><small>평균 매입가 {fmtMoney(row.average,stock.currency)}</small></span>
          <span className="spy-amount"><b>{quantity(row.qty)}{quantityUnit(i)}</b><small>투자한 돈 {fmtMoney(row.costKRW)}</small></span></li>;
      })}</ul>:<p className="spy-empty">보유 중인 종목이 없어.</p>}
      {report.capturedAt<report.issuedAt-60_000&&<p className="spy-asof">보유 기록 동기화 · {reportTime(state,report.capturedAt)}</p>}
    </ReportSection>
    <ReportSection title="최근 3일 거래" count={fills.length+'건'}>
      <p className="spy-period">{reportTime(state,report.issuedAt-spyWindowMs)} ~ {reportTime(state,report.issuedAt)} · 게임 시각</p>
      {fills.length?<ul className="spy-data">{fills.map((row,index)=>{
        const i=symbolIndex[row.code],stock=stocks[i];
        const currency=Object.hasOwn(currencies,row.currency)?row.currency:stock.currency;
        const price=Number.isFinite(row.price)?fmtMoney(row.price,currency):'체결가 미기록';
        return <li key={index}><span className={'spy-side '+(row.qty<0?'sell':'buy')}>{row.forced?'자동 매도':row.qty<0?'매도':'매수'}</span>
          <span className="spy-asset"><strong>{stock.name}</strong><small>{reportTime(state,row.at)}</small></span>
          <span className="spy-amount"><b>{quantity(row.qty)}{quantityUnit(i)}</b><small>{price}</small></span></li>;
      })}</ul>:<p className="spy-empty">이 기간에 체결된 거래가 없어.</p>}
    </ReportSection></article><button type="button" className="btn light full spy-back" data-act="spy-back">보관함으로</button></>;
}
const useCommittedOffer=typeof document==='undefined'?useEffect:useLayoutEffect;
function SpyService({state,modal,view}){
  const offer=spyOffer(state,view,modal);
  // Submit verifies the same quote the player actually saw before reserving funds.
  useCommittedOffer(()=>{
    modal.target=offer.selected;
    modal.offer={target:offer.selected,assets:offer.assets,cost:offer.cost};
  },[modal,offer.selected,offer.assets,offer.cost]);
  return <><ServiceForm offer={offer}/><SpyArchive state={state} modal={modal}/></>;
}
export function DeskServices({state,modal,view,kind}){
  if(kind==='desk-intimidation')return <ServiceForm offer={intimidationOffer(view,state,netWealth(state),exchangeable(state,'KRW'),modal)}/>;
  if(modal.report)return <SpyReport state={state} report={modal.report}/>;
  return <SpyService state={state} modal={modal} view={view}/>;
}
