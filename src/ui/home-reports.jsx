import React, {useLayoutEffect,useRef,useState} from 'react';
import {dayLabel, realTime, clockText} from '../game/clock-calendar.mjs';
import {mentalBurdenCap, mentalDebtBurdenCap, mentalConnectionReduction, todayLiveSpending, spendingBase, spendingPerPoint, spendingWealthMaxRate, creditStatus, dailyBonus} from '../game/market.mjs';
import {scoreLabel, sheetValues} from '../game/mental-sheet.mjs';
import {bingoReductions} from '../game/fortune-rules.mjs';
import {spendDetails, spendingPeriod, spendPercent} from '../game/home-desk.mjs';
import {closedAmounts, reviewValues} from '../game/day-report.mjs';
import {dailySalary} from '../game/salary-negotiation.mjs';
import {activityValue} from '../game/investment-activity.mjs';
import {deskLoanBalance} from '../game/loan-desk.mjs';
import {wageLabel} from '../game/living.mjs';
import {fmtMoney,stocks} from '../game/world.mjs';
import {Icon,LabDialog} from './controls.jsx';
import {Select} from './exchange-controls.jsx';
import {MentalBrain} from './home-art.jsx';

const won=amount=>fmtMoney(amount,'KRW');

function Line({label,children,...props}) {
  return <div {...props}><dt>{label}</dt><dd>{children}</dd></div>;
}
function MentalField({name,value}) {
  return <span data-mental-field={name}>{value}</span>;
}

function MentalFactors({values}) {
  const [open,setOpen]=useState(null);
  const anchor=useRef(null);
  useLayoutEffect(()=>{
    if(!open)return;
    const trigger=anchor.current, row=trigger.closest('dd').parentElement;
    const sheet=row.closest('.sheet'), hint=document.getElementById(trigger.getAttribute('aria-controls'));
    const place=()=>{
      const panel=sheet.getBoundingClientRect(), bounds=row.getBoundingClientRect();
      const above=bounds.top-panel.top-5,below=panel.bottom-bounds.bottom-5;
      hint.dataset.side=below>=above?'below':'above';
      hint.style.maxHeight=Math.max(0,Math.max(above,below))+'px';
    };
    const closeOutside=event=>{
      if(!trigger.parentElement.contains(event.target))setOpen(null);
    };
    place();
    sheet.addEventListener('scroll',place,{passive:true});
    window.addEventListener('resize',place);
    document.addEventListener('pointerdown',closeOutside);
    document.addEventListener('focusin',closeOutside);
    return ()=>{
      sheet.removeEventListener('scroll',place);
      window.removeEventListener('resize',place);
      document.removeEventListener('pointerdown',closeOutside);
      document.removeEventListener('focusin',closeOutside);
    };
  },[open]);
  const row=(id,label,note)=>{
    const active=open===id,hintId='mental-hint-'+id;
    return <div><dt>{label}</dt><dd onKeyDown={event=>{
      if(active&&event.key==='Escape'){
        event.preventDefault();event.stopPropagation();setOpen(null);anchor.current.focus({preventScroll:true});
      }
    }}>
      <MentalField name={id} value={values[id]}/>
      <button type="button" className="lab-help" aria-label={label+' 계산 방법'} aria-expanded={active}
        aria-controls={hintId} aria-describedby={active?hintId:undefined}
        onClick={event=>{anchor.current=event.currentTarget;setOpen(active?null:id);}}>
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
          <circle cx="8" cy="8" r="7.2"/><path d="M7 4h2v5H7zM7 10h2v2H7z"/>
        </svg>
      </button>
      <span className="lab-hint" id={hintId} role="note" hidden={!active} tabIndex={active?0:undefined}>{note}</span>
    </dd></div>;
  };
  const capNote=cap=>'최대 '+cap+'p이며, 순자산이 0 이하면 상한을 써.';
  return <dl className="lab-slip" aria-label="게임 시간당 정신력 변화 요인">
    {row('base','기본 정신력 소모','다른 효과를 적용하기 전, 게임 시간당 정신력 변화는 '+values.base+'야.')}
    {row('investment','투자 영향','당일 순손실 ÷ 순자산 × 기본 소모. 실현손익·평가손익 변동·배당을 합쳐 손실일 때만 적용해. '+capNote(mentalBurdenCap))}
    {row('debt','대출 부담','은행·대부 잔액 ÷ 순자산 × 기본 소모. 빚이 순자산의 절반이면 시간당 0.75p가 더 들어. 빚이 없으면 0p야. '+capNote(mentalDebtBurdenCap))}
    {row('connection','접속 버프','게임 화면을 보는 동안 시간당 정신력 소모가 '+mentalConnectionReduction+'p 줄어.')}
    {row('fortune','운세뽑기','오늘 빙고가 0·1·2·3줄이면 시간당 총소모가 각각 '+bingoReductions.join('·')+'% 줄어. 효과는 게임 시각 자정까지야.')}
  </dl>;
}

export function MentalBody({state}) {
  const values=sheetValues(state), score=state.mental;
  const field=name=><MentalField name={name} value={values[name]}/>;
  const trace=score===0?'M0 10H64':score<25?'M0 10h14l3-2 3 2h8l3-4 3 6 3-2h27':
    'M0 10h9l3-2 3 2h6l4-8 4 15 4-9 3 2h7l3-4 4 4h14';
  return <LabDialog title="정신력">
    <div className="lab-instrument">
      <div className="lab-chamber" aria-hidden="true">
        <div className="lab-vat"><span className="lab-sample"><MentalBrain value={score}/></span></div>
      </div>
      <div className="lab-scope">
        <div className="lab-signal"><b>{field('mood')}</b>
          <svg viewBox="0 0 64 20" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d={trace}/>{score>0&&<path className="lab-scan" d={trace} pathLength="100"/>}
          </svg>
        </div>
        <div className="lab-value" data-fraction={Number.isInteger(score)?undefined:''}>
          <strong>{field('score')}</strong><small>/100</small>
        </div>
        <span className={'gauge big'+(score<25?' low':'')} role="img" aria-label={scoreLabel(score)}>
          {Array.from({length:10},(_,i)=>{
            const points=score-i*10;
            return <b key={i} className={points>0?'fill':undefined}
              style={points>0&&points<10?{'--segment-fill':points*10+'%'}:undefined}/>;
          })}
        </span>
        <div className="lab-rate" aria-label={values.rateLabel}>
          <span><span className="lab-rate-clock">게임 </span>시간당 감소</span><b>{field('rate')}</b>
        </div>
      </div>
    </div>
    <div className="lab-printer">
      <MentalFactors values={values}/>
    </div>
    <div className="lab-keys">
      <button className="ui-control lab-test" type="button" data-act="character-test" aria-haspopup="dialog" aria-label="캐릭터 표정 미리보기">미리보기</button>
      <button className="ui-control lab-recover" type="button" data-act="watch-recovery" disabled={!values.canRecover}>
        <i className="lab-cross" aria-hidden="true"/>{field('recovery')}</button>
    </div>
    <p className="lab-remaining">{field('remaining')}</p>
  </LabDialog>;
}

function RecentPayments({recent}){
  if(!recent?.length)return <p className="day-no-charge">아직 오늘 결제한 내역이 없어.</p>;
  return <dl className="day-expense-lines">{recent.slice().reverse().map((row,i)=>{
    const {cursor,minute,second}=realTime(row.gameAt??row.at);
    const time=clockText(cursor,true,minute)+':'+String(second).padStart(2,'0');
    return <Line key={row.seq??row.at??i} label={<>{time} <small>· 정신력 {row.mental}</small></>}>−{won(row.amount)}</Line>;
  })}</dl>;
}

export function SpendingBody({state}) {
  const {rate,extra,estimate}=spendDetails(state),spending=todayLiveSpending(state);
  return <div className="day-spending live-spending">
    <div className="spent-total"><span><Icon name="receipt"/>오늘 소비</span><strong data-spend-total="">{won(spending?.total??0)}</strong></div>
    <section className="day-living"><dl className="day-expense-lines">
      <div><dt>현재 소비 속도</dt><dd data-spend-rate="">{rate}</dd></div>
      <div><dt>자산 합계 비례 추가분</dt><dd data-spend-wealth="">{extra}</dd></div>
      <div><dt>하루 예상 소비금액</dt><dd data-spend-estimate="">{estimate}</dd></div>
    </dl>
      <p className="fineprint">정신력 100점이면 분당 {spendingBase}원. 1점 낮을 때마다 {spendingPerPoint}원씩 늘고, 자산 합계의 최대 {spendPercent.format(spendingWealthMaxRate)}가 더해져.</p>
    </section>
    <section className="day-living"><h3 id="recent-payments-heading">최근 결제</h3><div className="recent-payment-scroll" data-spend-recent="" role="region" aria-labelledby="recent-payments-heading" tabIndex={0}><RecentPayments recent={spending?.recent}/></div></section>
    <p className="fineprint">화면을 보는 동안 {spendingPeriod}마다 원화로 결제돼.<br/>예상액은 현재 정신력으로 종일 볼 때 기준이야.<br/>일급은 게임 시각 자정에 들어와.</p>
  </div>;
}

export function DaySlip({title, date, tag, leading, centered=false, focusHeading=false, children}) {
  const close=<button className="day-close ui-control ui-icon ui-compact" type="button" data-act="dismiss" aria-label="닫기"><Icon name="close"/></button>;
  return <section className={'day-paper-dialog'+(centered?' day-centered':'')} role="dialog" aria-modal="true" aria-labelledby="dialog-title">
    {!centered&&close}
    <article className="sheet day-slip">
      <header className="day-slip-head">
        {leading}
        <div className="day-slip-title">{tag&&<span className="sheet-tag">{tag}</span>}<h2 id="dialog-title" tabIndex={focusHeading?-1:undefined}>{title}</h2></div>
        {date&&<span className="day-slip-date">{date}</span>}{centered&&close}
      </header>
      {children}
    </article>
  </section>;
}

export function DayReview({state}) {
  const {extras,rehabilitation,values}=reviewValues(state);
  const field=name=><span data-day-field={name}>{values[name]}</span>;
  return <div className="day-summary">
    <dl className="day-balance">
      <Line label="정신력"><strong>{field('mental')}<small>/100</small></strong></Line>
      <Line label="투자 손익"><strong>{field('profit')}</strong></Line>
    </dl>
    <section className="day-midnight" aria-label="예상 정산">
      <dl className="day-cash-flow"><Line label="하루 예상 소비금액">{field('estimate')}</Line>
        <Line data-day-extra="" hidden={!extras} label="기타 지출">{field('extra')}</Line>
        {rehabilitation>0&&<Line label="받은 회생 지원금">{field('rehabilitation')}</Line>}
        <Line label="일급 입금 예정">{field('income')}</Line>
        <Line label="보너스 입금 예정">{field('bonus')}</Line>
      </dl>
      <dl className="day-cash-flow day-net"><Line label="예상 합계">{field('net')}</Line></dl>
    </section>
    <button className="day-last ui-control" type="button" data-act="settlement-history">
      <Icon name="receipt"/>지난 정산 보고서 보기
    </button>
  </div>;
}

function ReportSection({title,children}) {
  return <section className="day-living"><h3>{title}</h3><dl className="day-expense-lines">{children}</dl></section>;
}
function ReportTotal({amount}) {
  return <div className="spent-total"><span><Icon name="receipt"/>순자산 합계</span><strong>{won(amount)}</strong></div>;
}

function SettlementDate({state,row}){
  return <div className="settlement-day-select">
    <Select className="ui-compact" value={row.day} id="settlement-date" aria-label="정산 날짜 선택">
      {state.history.map(record=><option key={record.day} value={record.day}>{dayLabel(state,record.day)}</option>)}
    </Select>
  </div>;
}

function ClosedReport({row,amounts}) {
  const {bill,paid,purchase,live,refund,intimidation,spy,ritual,glasses,dividends,rehabilitation,
    repayment,bankInterest,deskInterest,exchangeCost,sales}=amounts;
  const bondInterest=(row.dividends??[]).reduce((sum,r)=>sum+(stocks[r.i]?.bond?r.amountKRW:0),0);
  const bank=row.credit,desk=row.loanDesk,conversions=bill?.conversions??[];
  return <><ReportSection title="입금"><Line label={wageLabel(bill)+' 입금'}>{Number.isFinite(bill?.income)?won(bill.income):'기록 없음'}</Line>
      {Number.isFinite(bill?.bonus)&&<Line label="그중 보너스">{won(bill.bonus)}</Line>}
      {dividends>bondInterest&&<Line label="받은 배당금 (원화로)">{won(dividends-bondInterest)}</Line>}
      {bondInterest>0&&<Line label="받은 채권 이자 (원화로)">{won(bondInterest)}</Line>}
      {refund>0&&<Line label="식비 환급">{won(refund)}</Line>}
      {rehabilitation>0&&<Line label="회생 지원금">{won(rehabilitation)}</Line>}
    </ReportSection>
    <ReportSection title="소비"><Line label="실시간 소비">{won(live)}</Line>
      {(paid>0||purchase?.amount>0)&&<Line label="이전 소비 기록">{won(paid+(purchase?.amount??0))}</Line>}
      {intimidation>0&&<Line label="협박 비용">{won(intimidation)}</Line>}
      {ritual>0&&<Line label="살굿 제물">{won(ritual)}</Line>}
      {glasses>0&&<Line label="AI 안경 구매">{won(glasses)}</Line>}
      {spy>0&&<Line label="염탐 보고서 발급">{won(spy)}</Line>}
    </ReportSection>
    <ReportSection title="대출"><Line label="이날 붙은 은행 이자">{won(bankInterest)}</Line><Line label="이날 붙은 대부 이자">{won(deskInterest)}</Line>
      {repayment>0&&<Line label="갚은 돈">{won(repayment)}</Line>}
      {bank?.maturityPaid>0&&<Line label="그중 만기에 자동으로 갚은 돈">{won(bank.maturityPaid)}</Line>}
      {desk?.upfrontInterestPaid>0&&<Line label="그중 납부한 대부 선이자">{won(desk.upfrontInterestPaid)}</Line>}
      {bank?.total>0&&<Line label="마감 때 남은 은행 대출">{won(bank.total)}</Line>}
      {desk?.total>0&&<Line label="마감 때 남은 대부 대출">{won(desk.total)}</Line>}
    </ReportSection>
    {(exchangeCost>0||conversions.length>0)&&<ReportSection title="정산 환전">
      {exchangeCost>0&&<Line label="일반 환전 비용">{won(exchangeCost)}</Line>}
      {conversions.map((q,i)=><Line key={i} label={<>자동 환전 · {fmtMoney(q.amount,q.from)}<br/><small>환전 비용 {won(q.cost)}</small></>}>+{won(q.received)}</Line>)}
    </ReportSection>}
    <ReportSection title="투자 손익">
      {Number.isFinite(row.gains)&&<Line label="이날 투자 손익">{row.gains>0?'+':''}{won(row.gains)}</Line>}
      <Line label="매도 손익">{activityValue('sales',sales)}</Line>
    </ReportSection>
  </>;
}

export function SettlementSummary({state,day,notices=[]}) {
  const row=state.history.find(record=>record.day===day)??state.history.at(-1);
  const amounts=row?closedAmounts(state,row):null;
  const leading=row?<SettlementDate state={state} row={row}/>:<span className="day-slip-date">{dayLabel(state)}</span>;
  const pastNotices=row?(state.intimidationNotices??[]).filter(notice=>notice.day===row.day&&!notices.some(current=>current.id===notice.id)):[];
  const visibleNotices=[...notices,...pastNotices];
  return <DaySlip title="정산보고서" leading={leading} tag={row?.legacy?'이전 모의 정산':undefined} centered focusHeading>
    <div className="day-spending settlement-report">
      {amounts&&<ReportTotal amount={amounts.netAssets}/>}
      {visibleNotices.length>0&&<section className="settlement-alert"><h3>익명의 협박</h3>{visibleNotices.map(notice=>
        <div className="settlement-incident" key={notice.id}><time>{dayLabel(state,notice.day)}</time><b>정신력 −{notice.points}점</b></div>)}</section>}
      {row?<ClosedReport row={row} amounts={amounts}/>:<>
        <p className="settlement-first">아직 정산한 날이 없어. 첫 보고서는 게임 시각 자정에 나와.</p>
        <ReportSection title="오늘 내역">
          <Line label="일급 입금 예정">{won(dailySalary(state))}</Line>
          <Line label="보너스 입금 예정">{won(dailyBonus(state))}</Line>
          <Line label="실시간 소비">{won(todayLiveSpending(state)?.total??0)}</Line>
        </ReportSection>
        <ReportSection title="쌓인 대출 이자"><Line label="은행 창구">{won(creditStatus(state).loan?.interest??0)}</Line><Line label="대부 창구">{won(deskLoanBalance(state)?.interest??0)}</Line></ReportSection>
      </>}
      <footer className="settlement-actions">
        <button type="button" className="btn primary full" data-act="dismiss">확인</button>
      </footer>
    </div>
  </DaySlip>;
}
