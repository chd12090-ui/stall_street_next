import React from 'react';
import {clockText, dayLabel, usesKst} from '../game/clock-calendar.mjs';
import {householdLedger, householdSnapshot, investmentReturn, gainTone, signed, ledgerIcons} from '../game/status.mjs';
import {currencies, fmtMoney} from '../game/world.mjs';
import {balance, dailyBonus} from '../game/market.mjs';
import {dailySalary} from '../game/salary-negotiation.mjs';
import {Icon} from './controls.jsx';
import {PixelArt} from './home-art.jsx';
import {ShareButton} from './exchange-controls.jsx';

const won=amount=>fmtMoney(amount,'KRW');

function Detail({label,children,className}) {
  return <div className="st-line"><dt>{label}</dt><dd className={className}>{children}</dd></div>;
}

function AssetOverview({state}) {
  const snap=householdSnapshot(state);
  const {credit,desk,balances,securities}=snap;
  const loan=credit.loan;
  const investment=investmentReturn(state,securities);
  const earned=state.history.reduce((total,{bill})=>total+(Number.isFinite(bill?.income)?bill.income:0),0);
  const bonus=state.phase==='closed'
    ? state.history.findLast(({day})=>day===state.day)?.bill?.bonus??0
    : dailyBonus(state);
  return <>
    <section className="st-statement" aria-label="자산 명세">
      <strong className="st-wealth-head">내 순자산</strong>
      <strong className="st-balance" data-status-net="">{won(snap.net)}</strong>
      <ShareButton kind="assets"/>
      <div className="st-breakdown"><span>자산 합계 <b data-status-assets="">{won(snap.assetsTotal)}</b></span>
        <span>갚을 돈 합계 <b>{won(snap.loanTotal)}</b></span></div>
    </section>
    <nav className="st-offices" aria-label="대출 창구">
      <button className="st-bank" data-act="tab" data-tab="credit" aria-label="은행 창구 열기">
        <PixelArt id="bank" width={108} height={192}/><span><strong>은행 창구</strong></span>
      </button><button className="st-bank st-private" data-act="tab" data-tab="loan-desk" aria-label="대부 창구 열기">
        <PixelArt id="loan-office" width={108} height={192}/><span><strong>대부 창구</strong></span>
      </button>
    </nav>
    <section className="st-detail-group" data-status-investment=""><h2>투자</h2>
      <dl className="st-data">
        <Detail label="투자한 돈">{won(investment.principal)}</Detail>
        <Detail label="현재 수익률"><span data-status-return="" className={investment.tone}>
          {investment.principal?won(investment.profit)+'('+investment.text+')':investment.text}
        </span></Detail>
        <Detail label="누적 판매수익" className={gainTone(state.realizedKRW)||undefined}>{signed(state.realizedKRW,won)}</Detail>
      </dl>
      {(state.realizedEstimated||state.basisEstimated.some(Boolean))&&<p className="st-note">이전 거래는 남아 있는 기록을 기준으로 계산했어.</p>}
    </section>
    <section className="st-detail-group"><h2>소득</h2>
      <dl className="st-data">
        <Detail label="일급">{won(dailySalary(state))}</Detail>
        <Detail label="보너스">{won(bonus)}</Detail>
        <Detail label="누적급여">{won(earned)}</Detail>
      </dl>
    </section>
    <section className="st-detail-group"><h2>계좌 잔액</h2>
      <dl className="st-data">
        <Detail label="원화 잔액" className="st-krw-balance">{won(snap.cash)}</Detail>
        <Detail label="외화 잔액">{fmtMoney(balance(state,'USD'),'USD')}</Detail>
        {balances.filter(b=>b.currency!=='KRW'&&b.currency!=='USD'&&b.amount).map(b=>
          <Detail key={b.currency} label={currencies[b.currency].name+' · '+b.currency}>{fmtMoney(b.amount,b.currency)}</Detail>)}
      </dl>
    </section>
    <section className="st-detail-group"><h2>갚을 돈</h2>
      <dl className="st-data">
        <Detail label="빌린 돈">{won(snap.principal)}</Detail>
        <Detail label="쌓인 이자">{won(snap.interest)}</Detail>
        {desk?.upfrontInterest>0 && <Detail label="남은 대부 선이자">{won(desk.upfrontInterest)}</Detail>}
        {loan?<Detail label="은행 대출 금리">연 {loan.apr.toFixed(2)}%</Detail>
          :credit.used?<Detail label="은행 대출">모두 갚음</Detail>:null}
        {desk&&<><Detail label="대부 창구에 갚을 돈">{won(desk.total)}</Detail><Detail label="대부 창구 금리">연 {desk.aprBps/100}%</Detail></>}
      </dl>
    </section>
  </>;
}

function LedgerEntry({row,live}){
  const when=row.step==null?'':row.step===288?'23:59':clockText(row.step,live);
  const icon=row.type==='consumption'?'spark':ledgerIcons[row.category]||'receipt';
  const cash=row.type==='rehabilitation-settlement'?{currency:'KRW',amount:-row.clearedAssets}:
    row.type==='retired-fx'?row.legs[1]:row.fxCost===undefined?row.legs[0]:{currency:'KRW',amount:-row.fxCost};
  const sign=cash?.amount<0?'−':cash?.amount>0?'+':'';
  const tone=sign==='−'||row.accruedInterest?' st-out':sign==='+'?' st-in':'';
  const amount=cash?sign+fmtMoney(Math.abs(cash.amount),cash.currency):row.accruedInterest?won(row.accruedInterest):'—';
  return <li className="st-entry"><span className={'st-entry-icon entry-'+row.category}><Icon name={icon}/></span>
    <div className="st-entry-text"><h3>{row.title}</h3>{when&&<div className="st-entry-meta">{when}{row.clearedDebt>0&&' · 대출 '+won(row.clearedDebt)+' 정리'}</div>}</div>
    <b className={'st-entry-amount'+tone}>{amount}</b>
  </li>;
}

function Ledger({state}){
  const groups=new Map(),live=usesKst(state);
  for(const row of householdLedger(state)){
    if(!groups.has(row.day))groups.set(row.day,[]);
    groups.get(row.day).push(row);
  }
  return [...groups].sort(([a],[b])=>(b??-1)-(a??-1)).map(([day,rows])=>
    <section key={day??'archive'} className="st-ledger-day"><h2>{day===null?'이전 기록':dayLabel(state,day)}</h2>
      <ul className="st-ledger-list" role="list">{rows.map(row=><LedgerEntry key={row.id} row={row} live={live}/>)}</ul>
    </section>);
}

export function AssetsPage({state,view='overview'}) {
  const overview=view==='overview';
  return <div className="status-desk"><header className="st-header view-heading"><h1>자산</h1></header>
    <nav className="st-tabs ui-tabs" aria-label="자산 메뉴">
      <button data-act="status-view" data-value="overview" aria-pressed={overview}>자산 현황</button>
      <button data-act="status-view" data-value="ledger" aria-pressed={!overview}>내역</button>
    </nav>
    {overview?<AssetOverview state={state}/>:<Ledger state={state}/>}
  </div>;
}
