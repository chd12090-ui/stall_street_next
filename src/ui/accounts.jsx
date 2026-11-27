import React, {useLayoutEffect, useRef} from 'react';
import {DataRow, Icon} from './controls.jsx';
import {clockText, dayLabel, firstGameDay, usesKst} from '../game/clock-calendar.mjs';
import {flagPath} from '../game/country-flags.mjs';
import {exchangeCurrencies, fxQuote} from '../game/fx.mjs';
import {activityNames, activityValue, collectActivity, relativeDay} from '../game/investment-activity.mjs';
import {deskLoanBalance} from '../game/loan-desk.mjs';
import {balance, creditStatus, exchangeable, localRates, netWealth, stockValue} from '../game/market.mjs';
import {amountFromText} from '../game/number-entry.mjs';
import {listingDescription} from '../game/securities-data.mjs';
import {quoteInfo} from '../game/tape.mjs';
import {currencies, fmtMoney, quantityUnit, stocks} from '../game/world.mjs';

const won = value => fmtMoney(value, 'KRW');
const signedWon = value => (value > 0 ? '+' : '') + won(value);
const signedNumber = value => (value > 0 ? '+' : '') + value.toLocaleString('ko-KR', {maximumFractionDigits: 2});
const quantity = (value, index) => Math.abs(value).toLocaleString('ko-KR', {maximumFractionDigits: 8}) + quantityUnit(index);
const tone = value => value > 0 ? 'gain' : value < 0 ? 'loss' : '';

function Flag({country}) {
  const src = flagPath(country);
  return src ? <img className="country-flag" src={src} width="24" height="16" decoding="async" alt=""/> : null;
}

const currencyLabel = code => code === 'KRW' ? '원화' : currencies[code].name;
const fxDirection = code => code === 'KRW' ? '원화 → 달러' : '달러 → 원화';

export function FxBody({state, modal}) {
  const {from, to, needed, returning, amount: text = ''} = modal;
  const digits = currencies[from].digits;
  const rates = localRates(state);
  const amount = amountFromText(text, digits);
  const offered = fxQuote(rates, from, to, amount);
  const sample = fxQuote(rates, from, to, 10000);
  const free = exchangeable(state, from);
  const dollarRate = sample && (from === 'KRW' ? 1 / sample.rate : sample.rate);
  const error = state.phase === 'closed' ? '다음 날을 시작하면 환전할 수 있어요.'
    : amount > free ? '사용 가능한 돈보다 큰 금액이에요.'
    : text && (!offered || offered.received <= 0) ? '통화의 최소 단위와 받을 금액을 확인해 주세요.' : '';
  const input = useRef(null);
  useLayoutEffect(() => {
    // Commit the displayed terms before a funding conversion can be submitted.
    modal.offered = offered;
    if (input.current.value !== text) input.current.value = text;
  });
  return <form id="exchange-form">
    {Boolean(needed) && <div className="data-box">
      <DataRow label={stocks[returning.i].name + ' 매수 부족액'}>{fmtMoney(needed, to)}</DataRow>
    </div>}
    <div className="fx-balances">{exchangeCurrencies.map(c => <div key={c}><span>{currencyLabel(c)} 잔액</span><b>{fmtMoney(balance(state, c), c)}</b></div>)}</div>
    {returning ? <p className="fx-direction-label">{fxDirection(from)}</p> :
      <div className="fx-directions" role="group" aria-label="환전 방향">
        {exchangeCurrencies.map(code => <button type="button" className="ui-control" key={code} data-act="fx-direction" data-value={code}
          aria-pressed={from === code}>{fxDirection(code)}</button>)}
      </div>}
    <div className="fx-box">
      <label>보낼 {currencyLabel(from)}<input required id="fx-amount" type="text" autoComplete="off" inputMode={digits ? 'decimal' : 'numeric'}
        placeholder="0" defaultValue={text} ref={input}/></label>
      <div className="fx-presets"><small id="fx-free">환전 가능 {fmtMoney(free, from)}</small>
        <button type="button" className="ui-control ui-compact" data-act="fx-part" data-value=".5">절반</button>
        <button type="button" className="ui-control ui-compact" data-act="fx-part" data-value="1">전액</button></div>
      <div className="fx-receive"><span>받을 {currencyLabel(to)}</span><b id="fx-receive">{fmtMoney(offered?.received ?? 0, to)}</b></div>
    </div>
    {dollarRate && <div className="fx-info" id="fx-rate">{'적용 환율 1달러 = ' +
      dollarRate.toLocaleString('ko-KR', {maximumFractionDigits: 2}) + '원' +
      (offered ? ' · 환전 비용 약 ' + won(offered.cost) : '')}</div>}
    <p id="fx-error" className="trade-error" role="status">{error}</p>
    <button className="btn primary full" type="submit" id="fx-submit" disabled={Boolean(error) || !offered || offered.received <= 0}>
      {returning ? '환전하고 주문으로' : '환전 확정'}
    </button>
    {returning && <button className="btn light full" type="button" data-act="dismiss">주문으로 돌아가기</button>}
  </form>;
}

function WalletHolding({state, index}) {
  const asset = stocks[index], quote = quoteInfo(state, index);
  const percent = quote.pct.toLocaleString('ko-KR', {maximumFractionDigits: 2, minimumFractionDigits: 2, signDisplay: 'exceptZero'});
  return <div className="wallet-holding"><small>{quantity(state.holdings[index], index)} 보유</small>
    <div className="related-row"><button data-act="symbol" data-id={index}>
      <span><b>{asset.name}</b><small><Flag country={asset.country}/> {listingDescription(asset)}</small></span>
      <span><b>{fmtMoney(quote.price, asset.currency)}</b><small className={tone(quote.pct)}>{percent}%</small></span>
    </button></div>
  </div>;
}
export function WalletBody({state}) {
  const debt = creditStatus(state).loan, desk = deskLoanBalance(state);
  const wallets = Object.keys(currencies).filter(c => c === 'KRW' || c === 'USD' || balance(state, c) > 0);
  const holdings = state.holdings.flatMap((shares, index) => shares ? [index] : []);
  return <>
    <div className="money-callout"><Icon name="coin"/><strong>{won(netWealth(state))}</strong><span>원화로 본 순자산</span></div>
    <div className="data-box">
      {wallets.map(code => <DataRow key={code} label={currencies[code].name + ' · ' + code}>{fmtMoney(balance(state, code), code)}</DataRow>)}
      <DataRow label="보유 종목의 현재 가치">{won(stockValue(state))}</DataRow>
      {Boolean(debt?.total) && <><DataRow label="은행에서 빌린 돈">−{won(debt.principal)}</DataRow>
        <DataRow label="아직 안 낸 은행 이자">−{won(debt.interest)}</DataRow></>}
      {Boolean(desk?.total) && <DataRow label="대부 창구에 갚을 돈">−{won(desk.total)}</DataRow>}
      <DataRow label="누적 투자 손익">{signedNumber(state.profit)}원</DataRow>
    </div>
    <button className="btn primary full" data-act="fx">환전하기</button>
    <button className="btn light full" data-act="tab" data-tab="credit">대출 신청 · 갚기</button>
    <button className="btn light full" data-act="orders">주문 내역</button>
    {holdings.length > 0 && <><h3 className="subhead">보유 종목</h3>{holdings.map(i => <WalletHolding key={i} state={state} index={i}/>)}</>}
  </>;
}

export function ActivityLinks({state}) {
  const activity = collectActivity(state, null, false);
  return <section className="bk-activity" aria-label="전체 투자 내역">
    {Object.entries(activityNames).map(([kind, label]) => <button type="button" data-act="activity" data-value={kind} key={kind}>
      <strong>{label}</strong>
      {kind !== 'analysis' && <span className="activity-value"><b className={kind === 'sales' && !activity.incomplete ? tone(activity.saleProfit) : ''}>
        {activityValue(kind, activity)}</b></span>}
      <span className="activity-arrow" aria-hidden="true">›</span>
    </button>)}
  </section>;
}

function ActivityRow({name, detail, value, amountClass = '', children}) {
  return <li><div><strong>{name}</strong><small>{detail}</small></div><div><b className={amountClass}>{value}</b>{children}</div></li>;
}
function ActivityOrders({state, orders}) {
  if (!orders.length) return <p className="activity-empty">아직 낸 주문이 없어.</p>;
  return <ol className="activity-history">{orders.map((r, index) => {
    const day = Math.floor(r.at / 86400), seconds = r.at - day * 86400;
    const time = clockText(Math.floor(seconds / 300), usesKst(state), usesKst(state) ? Math.floor(seconds / 60) : null);
    const stock = stocks[r.i], currency = r.currency ?? stock.currency;
    const orderPrice = r.limit == null ? '시장가' : '지정가 ' + fmtMoney(r.limit, currency);
    const execution = r.status === '체결' && Number.isFinite(r.price) ? ' · 체결가 ' + fmtMoney(r.price, currency) : '';
    return <ActivityRow key={[r.i, r.at, r.seq ?? index].join('-')} name={stock.name}
      detail={relativeDay(state, day) + ' ' + time + ' · ' + orderPrice + execution}
      value={(r.qty > 0 ? '매수 ' : '매도 ') + quantity(r.qty, r.i)}>
      {r.status === '대기' ? <><small>체결 대기</small>
        <button type="button" className="ui-control ui-compact" data-act="trade" data-id={r.i}>주문 수정</button></> :
        <small>{r.reason === '주문 변경' ? '변경으로 취소' : r.status}{r.fee>0?' · 수수료 '+fmtMoney(r.fee,currency):''}</small>}
    </ActivityRow>;
  })}</ol>;
}

function ActivitySales({state, sales}) {
  if (!sales.length) return <p className="activity-empty">아직 판매한 종목이 없어.</p>;
  return <ol className="activity-history">{sales.map((r, index) => <ActivityRow key={index} name={stocks[r.i].name}
    detail={relativeDay(state, r.day) + ' · ' + quantity(r.qty, r.i) + (r.automatic ? ' · 이전 정산 자동 판매' : ' 판매')}
    value={Number.isFinite(r.realizedKRW) ? signedWon(r.realizedKRW) : '기록 부족'} amountClass={tone(r.realizedKRW)}/>)}</ol>;
}
function ActivityDividends({state, dividends}) {
  if (!dividends.length) return <p className="activity-empty">아직 받은 배당금이나 채권 이자가 없어.</p>;
  return <ol className="activity-history">{dividends.map((r, index) => <ActivityRow key={index} name={stocks[r.i].name+(stocks[r.i].bond?' 이자':'')}
    detail={relativeDay(state, r.day) + ' · ' + quantity(r.qty, r.i) + ' 보유'} value={fmtMoney(r.amount, r.currency)}>
    {r.currency !== 'KRW' && <small>원화로 {won(r.amountKRW)}</small>}
  </ActivityRow>)}</ol>;
}
function Analysis({activity}) {
  const total = activity.saleProfit + activity.dividendIncome;
  const incomeLabel=activity.dividends.some(r=>stocks[r.i]?.bond)?'배당금·채권 이자':'배당금';
  let profit = 0, loss = 0;
  for (const sale of activity.sales) {
    if (sale.realizedKRW > 0) profit += sale.realizedKRW;
    if (sale.realizedKRW < 0) loss += sale.realizedKRW;
  }
  return <><div className="activity-total"><span>판매수익과 {incomeLabel} 합계</span>
    <strong className={tone(total)}>{activity.incomplete ? '기록 부족' : signedWon(total)}</strong></div>
    <dl className="activity-breakdown">
      <div><dt>팔아서 번 돈</dt><dd className={tone(profit)}>{signedWon(profit)}</dd></div>
      <div><dt>팔아서 잃은 돈</dt><dd className={tone(loss)}>{signedWon(loss)}</dd></div>
      <div><dt>받은 {incomeLabel}</dt><dd>{won(activity.dividendIncome)}</dd></div>
      <div><dt>판매 횟수</dt><dd>{activity.sales.length.toLocaleString('ko-KR')}건</dd></div>
    </dl></>;
}
function DayButton({value, label, disabled}) {
  return <button type="button" className="square-btn ui-control ui-icon ui-compact" data-act="activity-day" data-value={value} aria-label={label} disabled={disabled}>
    <Icon name="down"/></button>;
}

export function ActivityBody({state, modal}) {
  const {kind} = modal;
  const first = Math.min(state.day, firstGameDay(state), state.history[0]?.day ?? state.day);
  const selected = kind === 'analysis' ? Math.max(first, Math.min(modal.day ?? state.day, state.day)) : null;
  const activity = collectActivity(state, selected);
  const labels = {orders: '전체 주문', sales: '누적 판매수익', dividends: '누적 배당금·채권 이자'};
  return <div className="investment-activity">
    {kind === 'analysis' ? <nav className="activity-period" aria-label="투자 기록 날짜">
      <DayButton value={selected - 1} label="이전 날" disabled={selected === first}/>
      <strong aria-live="polite">{dayLabel(state, selected)}</strong>
      <DayButton value={selected + 1} label="다음 날" disabled={selected === state.day}/>
    </nav> : <div className="activity-total"><span>{labels[kind]}</span>
      <strong className={kind === 'sales' && !activity.incomplete ? tone(activity.saleProfit) : ''}>{activityValue(kind, activity)}</strong></div>}
    {kind === 'orders' && <ActivityOrders state={state} orders={activity.orders}/>}
    {kind === 'dividends' && <><ActivityDividends state={state} dividends={activity.dividends}/>
      <p className="activity-note">월말에 보유한 수량에 따라 연 배당금이나 채권 이자의 1/12을 종목의 통화로 받아. 합계는 입금 당시 원화 기준이야.</p></>}
    {(kind === 'sales' || kind === 'analysis') && <>
      {kind === 'sales' ? <ActivitySales state={state} sales={activity.sales}/> : <Analysis activity={activity}/>}
      <p className="activity-note">{kind === 'sales' ? '판매수익은 판 금액에서 그 수량을 사는 데 쓴 돈을 뺀 값이야.' : '아직 보유 중인 종목의 가격 변화는 이 합계에서 제외해.'} 외화 거래는 거래 당시 환율로 계산해.</p>
      {(activity.incomplete || activity.estimated) && <p className="activity-note">
        {activity.incomplete ? '일부 이전 거래의 매입 기록이 부족해. 확인 가능한 금액만 세부 내역에 표시했어.' : '이전 거래 일부는 남아 있는 기록을 바탕으로 계산했어.'}
      </p>}
    </>}
  </div>;
}
