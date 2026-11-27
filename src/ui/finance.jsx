import React, {memo, useEffect, useRef, useReducer, useState} from 'react';
import {flushSync} from 'react-dom';
import {accountCalendar, dayLabel, weekStart} from '../game/clock-calendar.mjs';
import {fmtMoney} from '../game/world.mjs';
import {bankViewState, bankLoanContract} from '../game/credit-view.mjs';
import {privateLoanViewState, rollSummary} from '../game/loan-desk-view.mjs';
import {deskDieSize, deskLoanMaximum, deskRerollAdSeconds} from '../game/loan-desk.mjs';
import {loanContractBody} from '../game/loan-flow.mjs';
import {amountFromText} from '../game/number-entry.mjs';
import {diceDisplay} from '../game/loan-dice.mjs';
import {petDuration} from '../game/player-character.mjs';
import {DeskServices} from './finance-services.jsx';
import {PetHand} from './petting.jsx';
import {Icon} from './controls.jsx';

const won=n=>fmtMoney(n,'KRW');
const percent=n=>Number(n).toLocaleString('ko-KR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const deskRate=bps=>'연 '+bps/100+'%';
const steps=[['amount','금액 입력'],['rate','금리 뽑기'],['review','대출 확인']];
const amountPresets=[['25%',.25],['50%',.5],['최대',1]];

function CounterBack({to='assets'}){
  return <button type="button" className="detail-back counter-back" data-act="tab" data-tab={to} aria-label="뒤로가기">
    <Icon name="down"/>
  </button>;
}

const DeskScene=memo(function DeskScene({privateDesk=false}){
  const art='/art/pixel/'+(privateDesk?'loan-office':'bank');
  const label=privateDesk?'대부 창구 실장':'은행 직원';
  const description=privateDesk?'무 회장 초상이 걸린 대부 창구의 봄베이 고양이 실장':'은행 창구의 턱시도 무늬 고양이 직원';
  return <div className="desk-pet-stage" data-pet-stage="" style={{'--pet-duration':petDuration+'ms'}}>
    <div className="desk-art-plane">
      <img className="desk-room" src={art+'-room.webp'} width="108" height="192" alt="" draggable="false" fetchPriority="high"/>
      <span className="desk-employee"><picture className="pixel-art">
        <source media="(prefers-reduced-motion: reduce)" srcSet={art+'-staff-still.webp'}/>
        <img className="" src={art+'-staff.webp'} width="45" height="51" alt="" decoding="async" draggable="false" fetchPriority="high"/>
      </picture></span>
      <img className="desk-counter-art" src={art+'-counter.webp'} width="45" height="51" alt="" draggable="false"/>
      <PetHand className="desk-hand-anchor"/>
      <button type="button" className="desk-pet-target" data-act="pet-desk-cat" aria-label={label+' 쓰다듬기'} aria-description={description}/>
    </div>
  </div>;
});

function BankMenu({status}){
  const amount=status.application&&!status.application.declined&&status.application.amount;
  const loan=status.loan?{action:'bank-repay',label:'대출 갚기'}:status.used?{action:'tab',label:'대출 내역'}:
    {action:'bank-loan',label:amount?'금리 제안 확인':'대출하기'};
  return <nav className="bank-menu" aria-label="창구 업무 선택">
    <button className="bank-choice bank-primary ui-control ui-primary" data-act={loan.action} data-tab={loan.action==='tab'?'credit/history':undefined} aria-haspopup={loan.action==='bank-repay'?'dialog':undefined}><Icon name="loan"/><span>{loan.label}</span></button>
    <button className="bank-choice ui-control" data-act="rehabilitation" aria-haspopup="dialog"><Icon name="ddakji"/><span>회생신청</span></button>
    <button className="bank-choice ui-control" data-act="fx"><Icon name="exchange"/><span>환전</span></button>
  </nav>;
}

function BankHistory({state,status}){
  const rows=status.ledger, names={borrow:'대출 입금',repay:'직접 갚음',maturity:'만기 정산'};
  const first=weekStart(state.day);
  const weeklyInterest=rows.reduce((sum,row)=>sum+(row.day>=first?row.interest:0),0);
  return <><div className="bank-speech"><b>창구 직원</b>
    <p>{rows.length?'대출 거래 내역을 준비했어요. 빌린 돈과 낸 이자를 함께 확인해 주세요.':'아직 대출 거래가 없습니다.'}</p></div>
    {rows.length>0&&<section className="loan-ledger bank-slip">
      <div className="loan-heading"><h2>대출 거래 내역</h2><small>{rows.length}건</small></div>
      <p className="loan-section-note">이번 주 낸 이자 {won(weeklyInterest)}</p>
      <details open><summary className="ui-disclosure">빌린 돈과 이자 내역 보기</summary>{[...rows].reverse().map((row,index)=><div className="loan-log-line" key={rows.length-index}>
        <span><strong>{names[row.type]||row.type}</strong><small>{accountCalendar(state,row.day,row.step)} · {row.bank}</small></span>
        <b>{won(row.amount)}<small>{row.type==='borrow'?'빌린 돈 ':'빌린 돈 중 갚은 금액 '}{won(row.principal)} · 이자 {won(row.interest)}</small></b>
      </div>)}</details>
    </section>}
  </>;
}

export function BankPage({state}){
  const {desk,status}=bankViewState(state);
  return <div className="credit-page" data-desk={desk}>
    <header className="counter-heading view-heading"><h1 className="sr-only">은행 창구</h1>
      <CounterBack to={desk==='menu'?'assets':'credit'}/>
    </header>
    <div className="bank-scene"><DeskScene/></div>
    <div className="bank-counter">{desk==='history'?<BankHistory state={state} status={status}/>:<BankMenu status={status}/>}</div>
  </div>;
}

export function DeskPage({state}){
  return <article className="loan-desk-page" aria-labelledby="loan-desk-title">
    <header className="counter-heading view-heading"><h1 className="sr-only" id="loan-desk-title">대부 창구</h1>
      <CounterBack/>
    </header>
    <div className="loan-desk-scene"><DeskScene privateDesk/></div>
    <div className="loan-desk-controls">
      <button type="button" className="loan-desk-service loan-desk-primary ui-control ui-primary" aria-haspopup="dialog" data-act="desk-loan"><Icon name="loan"/><span>{state.loanDesk?.loan?'대출 갚기':'대출하기'}</span></button>
      <button type="button" className="loan-desk-service loan-desk-intimidate ui-control" data-act="desk-intimidation" aria-haspopup="dialog"><Icon name="intimidate"/><span>협박하기</span></button>
      <button type="button" className="loan-desk-service ui-control" data-act="desk-spy" aria-haspopup="dialog"><Icon name="spy"/><span>염탐하기</span></button>
    </div>
  </article>;
}

function LoanStep({step,children}){
  return <section className="loan-flow" data-loan-stage={step}>
    <ol className="loan-progress" aria-label="대출 과정">{steps.map(([id,label])=><li key={id} aria-current={id===step?'step':undefined} tabIndex={id===step?-1:undefined}>{label}</li>)}</ol>
    {children}
  </section>;
}
function RequestTotal({label,amount}){
  return <div className="loan-request-total"><div className="loan-total"><span>{label}</span><strong>{won(amount)}</strong></div></div>;
}
function LoanTerms({rows,style='loan-review-card'}){
  return <dl className={'loan-terms '+style}>{rows.map(([label,value,field])=><div className="loan-term" key={label}><dt>{label}</dt><dd data-loan-value={field}>{value}</dd></div>)}</dl>;
}
function Review({amount,rate,interest,maturity,lender,upfrontInterest}){
  const rows=[['받을 금액',won(amount)],['대출 금리',rate]];
  if(upfrontInterest!==undefined)rows.push(['상환 시 선이자',won(upfrontInterest)]);
  rows.push(['하루 예상 이자',won(interest)]);
  if(lender)rows.push(['대출 기관',lender]);
  rows.push(['만기',maturity]);
  return <LoanTerms rows={rows}/>;
}
function LoanPaper({rows,account,stamp}){
  return <><LoanTerms rows={rows} style="loan-contract-terms"/>
    <div className="loan-contract-payment"><dl><dt>{account}</dt><dd>원화 계좌</dd></dl>
      <span className="loan-contract-stamp">{stamp}<br/>완료</span></div>
    <footer className="loan-contract-footer"><button type="button" className="btn light" data-act="dismiss">확인</button></footer>
  </>;
}
function Action({act,secondary=false,disabled,id,children}){
  return <button type={act?'button':'submit'} className={'btn '+(secondary?'light':'primary')+' full'} id={id} data-act={act} disabled={disabled}>{children}</button>;
}
function AmountInput({id,value,bank=false,invalid,limitId}){
  return <div className="loan-input-box"><input type="text" name={id==='credit-amount'?undefined:'amount'} id={id}
    inputMode="numeric" pattern={bank?'[0-9,]*':undefined} autoComplete="off" maxLength="18" aria-describedby={[limitId,id+'-error'].filter(Boolean).join(' ')}
    aria-invalid={Boolean(invalid)} defaultValue={value} placeholder="0"/><span aria-hidden={bank?undefined:true}>원</span></div>;
}
function LoanAmountHeading({id,inputId,maximum,children}){
  const [open,setOpen]=useState(false);
  const heading=useRef(null),trigger=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const closeOutside=event=>{if(!heading.current?.contains(event.target))setOpen(false);};
    // Collapsing on pointerdown or focus would move the next control before its click.
    document.addEventListener('click',closeOutside);
    return ()=>document.removeEventListener('click',closeOutside);
  },[open]);
  return <div ref={heading} onKeyDown={event=>{
    if(open&&event.key==='Escape'){
      event.preventDefault();event.stopPropagation();setOpen(false);trigger.current.focus({preventScroll:true});
    }
  }}>
    <div className="loan-field-line"><label htmlFor={inputId}>빌릴 금액</label>
      <div className="loan-limit">
        <strong id={id+'-amount'}><span className="sr-only">대출 한도 </span>최대 {won(maximum)}</strong>
        <button className="loan-limit-help" type="button" ref={trigger} aria-label="심사 기준과 한도"
          aria-expanded={open} aria-controls={id} onClick={event=>{
            event.currentTarget.focus({preventScroll:true});setOpen(value=>!value);
          }}><span aria-hidden="true">!</span></button>
      </div>
    </div>
    <section className="loan-limit-popover" id={id} aria-labelledby={id+'-title'} hidden={!open} tabIndex={open?0:undefined}>
      <h3 id={id+'-title'}>심사 기준과 한도</h3>{children}
    </section>
  </div>;
}
function AmountField({id,amount,maximum,bank=false,disablePresets,error,criteria}){
  const limitId=id+'-limit';
  return <div className="loan-field">
    <LoanAmountHeading id={limitId} inputId={id} maximum={maximum}>{criteria}</LoanAmountHeading>
    <AmountInput id={id} value={amount} bank={bank} invalid={amount&&error} limitId={limitId+'-amount'}/>
    <div className="loan-presets" role="group" aria-label="대출 한도 기준 빠른 입력">{amountPresets.map(([label,share])=>{
      const value=Math.floor(maximum*share);
      return <button key={label} className="ui-control ui-compact" type="button" data-act={bank?'credit-preset':'loan-desk-preset'}
        data-value={value} disabled={disablePresets||value<1}>{label}</button>;
    })}</div>
    <p id={id+'-error'} className="loan-error" role="status" aria-live={bank?'polite':undefined}>{error}</p></div>;
}
function Repayment({details,id,inputId,rate}){
  const {loan,maximum,available,text,error}=details;
  const rows=[['갚을 돈 합계',won(loan.total),'total'],['남은 원금',won(loan.principal),'principal'],['쌓인 이자',won(loan.interest),'interest']];
  if(loan.upfrontInterest)rows.push(['남은 선이자',won(loan.upfrontInterest),'upfrontInterest']);
  rows.push(['대출 금리',rate]);
  const payable=error?null:amountFromText(text);
  return <form id={id} data-mode="repay" className="loan-repay-form"><LoanTerms rows={rows}/>
    <div className="loan-field"><div className="loan-field-line"><label htmlFor={inputId}>갚을 금액</label>
      <small className="loan-repay-available">사용 가능한 돈 <strong data-loan-value="available">{won(available)}</strong></small></div>
      <div className="loan-repay-input"><AmountInput id={inputId} value={text} invalid={text&&error}/>
        <div className="loan-presets"><button className="ui-control ui-compact" type="button" data-act="loan-repay-max" data-value={maximum} data-loan-max="" aria-label="갚을 수 있는 최대 금액" disabled={maximum<1}>최대</button></div></div>
      <p id={inputId+'-error'} className="loan-error" role="status">{text&&error}</p></div>
    <Action disabled={!(payable>0)}>{payable>0?won(payable)+' 갚기':'갚기'}</Action>
  </form>;
}

function BankCriteria({status}){
  return <ul>
    <li>현재 순자산 {won(status.netWorth)}</li>
    <li>순자산의 35%, 일급 21일분, 300만원 중 가장 작은 금액이 한도야.</li>
    <li>신청액의 한도 대비 비율과 이전 투자 손실에 따라 금리 범위가 달라져.</li>
    <li>신청액 기준 예상 연 금리 {percent(status.aprMin)} ~ {percent(status.aprMax)}</li>
    <li>하루 한 번 금리 제안을 받고, 한 주에 대출 한 건을 받을 수 있어.</li>
  </ul>;
}
function RateMachine({offers,selected,spinning}){
  return <div className="loan-machine"><div className={'loan-reels '+(spinning?'spinning':'')} role="group" aria-label="은행별 연 금리 선택" aria-busy={spinning}>
    {(offers||[null,null,null]).map((offer,i)=>{
      const chosen=Boolean(offer&&offer.id===selected?.id),display=offer?percent(offer.apr):'—';
      const turns=spinning&&offer?[display,percent(offer.apr+.08),percent(offer.apr+.23),display]:[display];
      return <button key={offer?.id??i} type="button" className={'loan-reel '+(chosen?'chosen':'')}
        data-act={offer&&!spinning?'credit-select':undefined} data-value={offer&&!spinning?offer.id:undefined}
        disabled={!offer||spinning} aria-pressed={chosen} aria-label={offer?offer.bank+' 연 '+display+' 제안 선택':'금리 후보 '+(i+1)}>
        <small>{offer?.bank||'후보 '+(i+1)}</small>
        <span className="loan-digits" aria-hidden="true"><span className="loan-strip">{turns.map((value,index)=><span key={index}>{value}</span>)}</span></span>
        {offer&&<small>{chosen?'✓ 선택됨':'연 금리'}</small>}
      </button>;
    })}
  </div></div>;
}
function BankApplication({state,view}){
  const {status,step,requestText,amount,notice,validation,offer,spinning,confirmDecline}=view;
  const quote=status.application;
  if(quote?.declined)return <div className="loan-inactive"><b>오늘의 금리 제안을 거절했어.</b><p>다음 날 다시 신청할 수 있어.</p></div>;
  if(quote&&(state.phase!=='open'||state.cursor>=288))return <p className="loan-inactive">하루 정산으로 오늘 제안이 만료됐어.</p>;
  const error=<p className="loan-error" role="status">{notice||status.reason}</p>;
  if(quote&&offer&&step==='review')return <LoanStep step="review">
    <Review amount={quote.amount} rate={'연 '+percent(offer.apr)} interest={offer.dailyInterest} lender={offer.bank} maturity={dayLabel(state,weekStart(state.day)+6)+' 마감'}/>
    {error}<div className="loan-flow-actions"><Action act="credit-rates" secondary>이전</Action><Action act="credit-accept" disabled={!status.eligible}>대출받기</Action></div>
  </LoanStep>;
  if(quote||step==='rate')return <LoanStep step="rate">
    <RequestTotal label="빌릴 금액" amount={quote?.amount??amount}/>
    <RateMachine offers={quote?.offers} selected={offer} spinning={spinning}/>
    <p className="loan-section-note" role="status">{confirmDecline?'거절하면 오늘 이 제안으로 대출을 받을 수 없어.':
      spinning?'은행 세 곳의 금리를 확인 중…':quote?'금리 하나를 선택해 줘.':'금리를 뽑으면 오늘의 신청액과 금리가 확정돼.'}</p>
    {error}<div className="loan-flow-actions">{!quote?
      <><Action act="credit-amount-back" secondary>이전</Action><Action act="credit-draw" disabled={!status.eligible||amount===null}>금리 뽑기</Action></>:
      confirmDecline?
        <><Action act="credit-decline-cancel" secondary>취소</Action><Action act="credit-decline-confirm">거절 확정</Action></>:
        <><Action act="credit-decline" secondary disabled={spinning}>거절</Action>
          <Action act="credit-review" disabled={!offer||spinning||!status.eligible}>다음</Action></>}
    </div>
  </LoanStep>;
  return <LoanStep step="amount">
    <form id="credit-amount-form"><AmountField bank id="credit-amount" amount={requestText} maximum={status.max}
      disablePresets={state.phase!=='open'||state.cursor>=288} error={validation} criteria={<BankCriteria status={status}/>}/>
      <Action id="credit-next-button" disabled={Boolean(validation)||amount===null||!status.eligible}>다음</Action></form>
  </LoanStep>;
}
function BankBody({state,kind}){
  const view=bankViewState(state),{status}=view;
  let content;
  if(kind==='bank-repay')content=status.loan?<Repayment details={view.repayment} id="bank-repay-form" inputId="credit-repay-amount" rate={'연 '+percent(status.loan.apr)}/>:<p className="loan-inactive">갚을 대출이 없어.</p>;
  else{
    const contract=bankLoanContract(state);
    content=contract?<LoanPaper {...loanContractBody(contract)}/>:status.used?<p className="loan-inactive">이번 주 대출을 모두 갚았어.</p>:<BankApplication state={state} view={view}/>;
  }
  return <div id={kind==='bank-loan'?'bank-loan-sheet':undefined} className="credit-page credit-loan-sheet">{content}</div>;
}
function DeskRate({view}){
  const {amount,dice,diceTossAt,validation}=view,rolling=diceTossAt!==null;
  const tray=diceDisplay(dice,diceTossAt),disabled=rolling||Boolean(validation);
  return <LoanStep step="rate"><RequestTotal label="빌릴 금액" amount={amount}/>
    <loan-dice-tray class="loan-desk-dice-tray" aria-hidden="true" data-roll={tray.roll} data-tossed-at={tray.time}>
      <canvas width={tray.width} height={tray.height}/>
    </loan-dice-tray>
    <p className="loan-desk-dice-summary" data-loan-dice-result="" role="status">{rolling?'주사위를 굴리는 중…':rollSummary(dice)}</p>
    {dice&&!rolling&&<button type="button" className="loan-desk-reroll ui-control ui-compact" data-act="loan-desk-reroll-ad" disabled={disabled}>
      <Icon name="reload"/>{deskRerollAdSeconds}초 광고 보고 다시 굴리기
    </button>}
    <div className="loan-flow-actions">
      <Action act="loan-desk-amount-back" secondary disabled={rolling}>이전</Action>
      <Action act={dice?'loan-desk-review':'loan-desk-roll'} id="loan-desk-rate-next" disabled={disabled}>
        {rolling?'굴리는 중…':dice?'다음':'주사위 굴리기'}
      </Action>
    </div>
  </LoanStep>;
}
function PrivateLoan({state}){
  const view=privateLoanViewState(state),{quote,step,repayment,draft,validation}=view;
  let content;
  if(repayment)content=<Repayment details={repayment} id="loan-desk-form" inputId="loan-desk-amount" rate={deskRate(repayment.loan.aprBps)}/>;
  else if(step==='review'&&quote)content=<LoanStep step="review">
    <Review amount={quote.amount} rate={deskRate(quote.aprBps)} interest={quote.dailyInterest} upfrontInterest={quote.upfrontInterest} maturity="정해진 만기 없음"/>
    <form id="loan-desk-form" data-mode="review"><div className="loan-flow-actions"><Action act="loan-desk-rates" secondary>이전</Action><Action disabled={Boolean(validation)}>대출받기</Action></div></form>
  </LoanStep>;
  else if(step==='rate'||step==='review')content=<DeskRate view={view}/>;
  else content=<LoanStep step="amount">
    <form id="loan-desk-form" data-mode="amount">
      <AmountField id="loan-desk-amount" amount={draft} maximum={deskLoanMaximum}
        disablePresets={state.phase!=='open'||state.cursor>=288} error={draft?validation:''} criteria={<ul>
          <li>한 번에 최대 {won(deskLoanMaximum)}까지 빌릴 수 있어.</li>
          <li>{rollSummary()} 최대 {deskDieSize*2}%야.</li>
          <li>이용 중인 대출을 갚으면 다시 신청할 수 있어.</li>
        </ul>}/>
      <Action disabled={Boolean(validation)}>다음</Action></form></LoanStep>;
  return <div className="credit-page credit-loan-sheet loan-desk-loan">{content}</div>;
}

// Input grouping and clock ticks also arrive between parent renders. The event's
// snapshot comes from the same locked game transaction used for subsequent actions.
function useFinancialState(state,kind){
  const current=useRef({prop:state,live:state});
  const [,update]=useReducer(n=>n+1,0);
  if(current.current.prop!==state)current.current={prop:state,live:state};
  useEffect(()=>{
    if(!['desk-loan','bank-repay','bank-loan'].includes(kind))return;
    const overlay=document.getElementById('overlay');
    const onChange=event=>{
      current.current.live=event.detail;
      flushSync(update);
    };
    overlay?.addEventListener('finance-change',onChange);
    return ()=>overlay?.removeEventListener('finance-change',onChange);
  },[kind]);
  return current.current.live;
}
export function FinanceBody({kind,state,modal,intimidationView}){
  const latest=useFinancialState(state,kind);
  if(kind==='loan-paper')return <LoanPaper {...modal.body}/>;
  if(kind==='desk-spy'||kind==='desk-intimidation')return <DeskServices kind={kind} state={latest} modal={modal} view={intimidationView}/>;
  if(kind==='desk-loan')return <PrivateLoan state={latest}/>;
  return <BankBody key={kind+'-'+latest.resetId+'-'+latest.day} kind={kind} state={latest}/>;
}
