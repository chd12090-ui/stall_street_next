import {useLayoutEffect,useRef,useState} from 'react';
import {Icon} from './controls.jsx';
import {MentalBrain,MentalGauge,StallIllustration} from './home-art.jsx';
import {TopicBadge} from './news-marks.jsx';
import {QuoteSparkline} from './quote-sparkline.jsx';
import {canBuy,canContinue,firstAvailablePage,guideSteps,inputLimit,lastGuidePage,practiceAmounts,practiceMental,practiceQuote,practiceStocks,practiceTicker,restorePractice} from '../game/field-guide-model.mjs';
import {clockText} from '../game/clock-calendar.mjs';
import {dailyMentalRecoveryMinute,dailyMentalRecoveryPoints,recoverDailyMental,spendingPerTick} from '../game/mental-rules.mjs';
import {playGameSound,prepareGameAudio} from '../game/game-audio.mjs';

const won=amount=>amount.toLocaleString('ko-KR')+'원';
const cutscenes={
  stall:{title:'회사 화장실',copy:'회사에는 가짜 변비 환자로 가득하다. 옆 칸에서 끔찍한 절규가 들려온다. 그렇다. 사내에 대주식 열풍이 분 것이다.'},
  ranks:{title:'사내 비공식 서열',copy:'투자 실력이 곧 서열이다. 선배, 동기, 후배를 제치고 비공식 사장에 오르는 게 목표다.'},
  stakes:{title:'투자만 알면 된다고?',copy:'그렇지 않다. 회사원에게 무엇보다 중요한 건 정신력 관리다.'},
  retire:{title:<>비공식 사장 타이틀을 달고<br/>멋지게 은퇴해 보자!</>},
};

function CutsceneArt({step}){
  return <div className={'guide-art guide-art--'+step} aria-hidden="true">
    {step==='stall'&&<><StallIllustration/><span className="guide-shout">으아악!</span></>}
    {step==='ranks'&&<>
      <div className="guide-podium">
        {['선배','동기','후배'].map((rank,i)=><figure key={rank}>
          {rank==='후배'&&<span className="guide-crown"/>}
          <img src={'/art/pixel/avatar-'+i+'-still.webp'} width="26" height="26" alt=""/>
          <figcaption>{rank}</figcaption>
        </figure>)}
      </div>
    </>}
    {step==='stakes'&&<div className="guide-stakes-figure">
      <div className="guide-stakes-signal"><MentalBrain value={15}/><MentalGauge value={15} className="guide-mental-gauge"/></div>
      <svg className="guide-stakes-cat" viewBox="0 0 172 172" shapeRendering="crispEdges" focusable="false">
        <use href="/art/player/pose-6.svg#cat"/>
      </svg>
    </div>}
    {step==='retire'&&<div className="guide-award">
      <span className="guide-crown"/>
      <img src="/art/player/pose-1.svg" width="140" height="212" alt=""/>
      <span className="guide-award-label">비공식 사장</span>
    </div>}
  </div>;
}

const evidenceChoices=[
  ['contract','냉장차 8대가 운행을 시작할 때'],
  ['freight','돌아오는 차에 유료 화물을 실을 때'],
];
const resultChoices=[
  ['valuation','보유 주식의 평가액이 줄었다'],
  ['cash','남은 현금에서 손실만큼 빠졌다'],
];
const answerSound=correct=>correct?'fill':'guideWrong';

function Choices({label,items,answer,correct,select}){
  return <div className="guide-choices" role="group" aria-label={label}>
    {items.map(([id,text])=><button key={id} type="button" className="guide-choice" aria-pressed={answer===id}
      data-state={answer===id?(id===correct?'right':'wrong'):undefined}
      data-guide-sound={answerSound(id===correct)} onClick={()=>select(id)}>
      <span className="guide-radio" aria-hidden="true">{answer===id?(id===correct?'✓':'×'):''}</span>{text}
    </button>)}
  </div>;
}
function Feedback({success,children}){
  const feedback=useRef(null);
  useLayoutEffect(()=>{
    if(!children)return;
    const message=feedback.current,scroller=message.closest('.guide-body');
    const overflow=message.getBoundingClientRect().bottom-scroller.getBoundingClientRect().bottom;
    if(overflow>0)scroller.scrollTop+=overflow+6;
  },[children]);
  return <p ref={feedback} className="guide-feedback" role="status" data-tone={children?(success?'right':'hint'):undefined}>{children}</p>;
}
function NewsPractice({practice,update}){
  const {evidence,paperOpen}=practice;
  return <>
    <article className="guide-paper-sample">
      <div className="guide-masthead"><span><Icon name="news"/>보수신문</span><TopicBadge story={{event:{id:'m2-cold-vans'}}}/></div>
      <button type="button" className="guide-paper-title" aria-expanded={paperOpen} aria-controls="guide-paper-text"
        onClick={()=>update({...practice,paperOpen:!paperOpen})}>
        <span>달밤물류·장터마트, 냉장차 공동 운행</span><Icon name={paperOpen?'minus':'plus'}/>
      </button>
      <p id="guide-paper-text" hidden={!paperOpen}>두 회사가 냉장차 8대를 함께 쓴다. 달밤물류는 복귀편에 실은 화물의 양만큼 운임을 받는다.</p>
    </article>
    {paperOpen&&<>
      <Choices label="운임이 늘어나는 조건" items={evidenceChoices} answer={evidence} correct="freight"
        select={value=>update({...practice,evidence:value})}/>
      <Feedback success={evidence==='freight'}>{evidence==='freight'?'정답! 돌아오는 차에 짐을 실어야 추가 운임이 붙는다.':
        evidence==='contract'?'빈 차로 돌아오면 추가 운임은 없다.':null}</Feedback>
    </>}
  </>;
}

const practiceQuotes={
  MART:{price:18400,change:'−0.86%',trend:[18,22,20,24,19,20,16,19,14,16]},
  MOON:{price:practiceQuote.buyPrice,change:'+2.17%',trend:[14,18,16,21,17,21,19,25,22,26]},
  VOLT:{price:32150,change:'+0.47%',trend:[16,19,17,22,18,20,16,23,21,22]},
};

function MarketPractice({practice,update}){
  const {market}=practice,correct=market===practiceTicker;
  return <>
    <div className="guide-market-list" role="group" aria-label="연습 종목 목록">
      {practiceStocks.map(([ticker,name])=>{
        const selected=ticker===market,{price,change,trend}=practiceQuotes[ticker];
        return <button type="button" className="guide-market-row" key={ticker} aria-pressed={selected}
          data-state={selected?(correct?'right':'wrong'):undefined}
          data-guide-sound={answerSound(ticker===practiceTicker)} onClick={()=>update({...practice,market:ticker})}>
          <img src={'/art/companies/'+ticker.toLowerCase()+'.webp'} width="32" height="32" alt=""/>
          <span><strong>{name}</strong><small>{ticker}</small></span>
          <QuoteSparkline prices={trend} fill="currentColor" fillOpacity=".11"/>
          <span className="guide-market-price"><b>{won(price)}</b><small className={change.startsWith('+')?'gain':'loss'}>{change}</small></span>
        </button>;
      })}
    </div>
    <Feedback success={correct}>{correct?'달밤물류를 찾았다. 주문 전에 1주 가격을 확인하자.':market?'기사에서 복귀편 운임을 받는 회사를 다시 찾아보자.':null}</Feedback>
  </>;
}

function OrderPractice({practice,update}){
  const {qty,filled}=practice;
  const [attempted,setAttempted]=useState(false);
  const {cost,cashLeft}=practiceAmounts(qty);
  const validOrder=canBuy(qty);
  function changeQty(value){
    if(!Number.isInteger(value)||value<0||value>inputLimit)return;
    setAttempted(false);
    update({...practice,qty:value,filled:false,conclusion:null});
  }
  function submit(){
    if(validOrder)update({...practice,filled:true});
    else setAttempted(true);
  }
  const feedback=filled?`${qty}주 체결. 남은 현금은 ${won(cashLeft)}이다.`:
    cashLeft<0?'주문 금액이 연습 자금을 넘는다. 수량을 줄여 보자.':
    attempted?`현금이 목표보다 ${won(practiceQuote.reserve-cashLeft)} 부족하다. 수량을 줄여 보자.`:null;
  return <>
    <div className="guide-order-slip">
      <div className="guide-quote"><img src="/art/companies/moon.webp" width="34" height="34" alt=""/>
        <div><strong>달밤물류</strong><small>1주 가격</small></div><b>{won(practiceQuote.buyPrice)}</b></div>
      <div className="guide-quantity"><label htmlFor="guide-quantity">주문 수량</label>
        <div className="guide-stepper">
          <button type="button" aria-label="수량 줄이기" disabled={filled||qty===0} onClick={()=>changeQty(qty-1)}>−</button>
          <input id="guide-quantity" type="number" inputMode="numeric" min="0" max={inputLimit} step="1"
            value={qty||''} placeholder="0" disabled={filled} onChange={e=>changeQty(Number(e.target.value))}/>
          <button type="button" aria-label="수량 늘리기" disabled={filled||qty===inputLimit} onClick={()=>changeQty(qty+1)}>+</button>
        </div><span aria-hidden="true">주</span></div>
      <dl className="guide-totals"><div><dt>주문 금액</dt><dd>{won(cost)}</dd></div>
        <div><dt>{cashLeft<0?'부족한 현금':'주문 후 현금'}</dt><dd data-low={cashLeft<practiceQuote.reserve?'yes':undefined}>{won(Math.abs(cashLeft))}</dd></div></dl>
      <div className="guide-reserve-meter" data-low={cashLeft<practiceQuote.reserve?'yes':undefined}
        style={{'--guide-cash-width':Math.max(0,Math.min(100,100*cashLeft/practiceQuote.cash))+'%',
          '--guide-reserve-line':100*practiceQuote.reserve/practiceQuote.cash+'%'}}>
        <div className="guide-meter-track" aria-hidden="true"><i/><b/></div><small>남길 현금 5만 원</small>
      </div>
      <button type="button" className="ui-control guide-buy" disabled={filled||qty===0||cashLeft<0}
        data-guide-sound={!filled&&qty>0&&cashLeft>=0?answerSound(validOrder):undefined} onClick={submit}>
        {filled?qty+'주 체결 완료':qty?qty+'주 연습 매수':'연습 매수'}</button>
    </div>
    <Feedback success={filled}>{feedback}</Feedback>
  </>;
}

function PriceDropChart(){
  return <figure className="guide-price-chart" aria-label="달밤물류 주가 차트. 매수 직후보다 현재 주가가 낮다.">
    <svg viewBox="0 0 280 52" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="guide-price-grid" d="M0 10H280 M0 26H280 M0 42H280"/>
      <path className="guide-price-area" d="M8 10H110L176 42H272V52H8Z"/>
      <path className="guide-price-line" d="M8 10H110L176 42H272"/>
      <circle cx="8" cy="10" r="3"/><circle cx="272" cy="42" r="3"/>
    </svg>
    <figcaption><span>매수 직후</span><span>현재</span></figcaption>
  </figure>;
}

function AccountPractice({practice,update}){
  const {value,cashLeft}=practiceAmounts(practice.qty),answer=practice.conclusion;
  const correct=answer==='valuation';
  return <>
    <section className="guide-portfolio" aria-label="연습 계좌 현황">
      <div className="guide-account-heading"><Icon name="market"/><h3>달밤물류</h3><span>보유 {practice.qty}주</span></div>
      <PriceDropChart/>
      <div className="guide-accounts-pair"><div><span>보유 주식</span><b>{won(value)}</b><small>현재 평가액</small></div>
        <div><span>남은 현금</span><b>{won(cashLeft)}</b><small>인출 가능</small></div></div>
    </section>
    <Choices label="주가가 내린 뒤의 변화" items={resultChoices} answer={answer} correct="valuation"
      select={conclusion=>update({...practice,conclusion})}/>
    <Feedback success={correct}>{correct?'정답! 보유 주식의 평가액만 줄었고, 남은 현금은 그대로다.':
      answer==='cash'?`남은 현금은 매수 직후와 같은 ${won(cashLeft)}이다. 보유한 ${practice.qty}주의 평가액을 다시 보자.`:null}</Feedback>
  </>;
}
const recoveryTime=clockText(0,true,dailyMentalRecoveryMinute);
const practiceWealth=1_000_000;

function MentalPractice({practice,update}){
  const {mental}=practice,{initial,afterLoss}=practiceMental;
  const recovered=mental==='recovered';
  const score=recovered?recoverDailyMental(afterLoss):mental==='drained'?afterLoss:initial;
  const before=spendingPerTick(recovered?afterLoss:initial,practiceWealth);
  const spending=spendingPerTick(score,practiceWealth),change=spending-before;
  return <>
    <section className="guide-mental-panel" aria-label="연습 정신력과 소비">
      <div className="guide-mental-reading">
        <div className="guide-mental-value"><span>정신력</span><strong>{score}<small> / 100</small></strong></div>
        <div className="guide-mental-display" aria-hidden="true"><MentalBrain value={score}/><MentalGauge value={score} className="guide-mental-gauge"/></div>
      </div>
      <div className="guide-mental-spending" role="status">
        <b>실시간 소비</b>
        <div className="guide-spending-values">
          <div><small>{recovered?'회복 전':'오전'}</small><strong>{won(before)}<small>/분</small></strong></div>
          {mental&&<><span aria-hidden="true">→</span>
            <div data-change={recovered?'down':'up'}><small>{recovered?'회복 후':'시간 경과 후'}</small><strong>{won(spending)}<small>/분</small></strong></div>
          </>}
        </div>
        {mental&&<p className="guide-spending-change" data-change={recovered?'down':'up'}>
          분당 {won(Math.abs(change))} {recovered?'감소':'증가'}
        </p>}
      </div>
    </section>
    {!recovered&&<button type="button" className="ui-control guide-recover"
      data-guide-sound={mental==='drained'?'petRecovery':undefined}
      onClick={()=>update({...practice,mental:mental?'recovered':'drained'})}>
      {mental==='drained'?'자정 '+recoveryTime+'으로 넘기기':<>
        <svg className="guide-loss-icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
          <path d="M2 3v12h14M5 5l4 4 2-2 5 5m-4 0h4V8"/>
        </svg><span>손실 상태로 시간 보내기</span>
      </>}
    </button>}
    <ul className="guide-mental-tips">
      <li>남은 빚과 투자 손실이 순자산에서 차지하는 비율이 클수록 정신력이 더 빨리 줄어든다.</li>
      <li>운세 슬롯에서 빙고가 나오면 자정까지 정신력 감소가 느려진다.</li>
      <li>게임 시간 자정 <time dateTime={recoveryTime}>{recoveryTime}</time>에 <b>정신력 {dailyMentalRecoveryPoints}점</b>이 회복된다. 최대 100점이다.</li>
    </ul>
  </>;
}

const exercises={
  news:{title:'신문에서 단서 찾기',prompt:'사내 주식 열풍에서 살아남으려면 단서부터 찾아야 한다. 기사를 펼쳐 달밤물류의 운임이 언제 늘어나는지 알아보자.',View:NewsPractice},
  market:{title:'거래소에서 종목 찾기',prompt:'기사에는 복귀편 운임을 받는 회사가 나온다. 거래소에서 그 종목을 찾아보자.',View:MarketPractice},
  order:{title:'수량을 정해 매수하기',prompt:'주문 뒤에도 현금 5만 원은 남겨야 한다. 달밤물류를 1주 이상 사 보자.',View:OrderPractice},
  account:{title:'주가가 내리면 뭐가 달라질까?',prompt:'매수 뒤 주가가 떨어졌다. 연습 계좌에서 무엇이 달라졌는지 짚어 보자.',View:AccountPractice},
  mental:{title:'정신력이 낮으면 소비가 는다',prompt:'투자 손실이 있으면 시간당 정신력 소모가 늘어난다. 정신력이 낮아질수록 과소비가 심해진다. 손실이 난 채로 시간이 흐른 뒤와 자정에 회복한 뒤의 분당 소비를 비교해 보자.',View:MentalPractice},
};

export function FieldGuide({nickname,initialPage=0,initialPractice,onPage,onPractice,onExit,onStart=onExit,replay=false,sound=true}){
  const [practice,setPractice]=useState(()=>restorePractice(initialPractice));
  const [page,setPage]=useState(()=>Math.min(Math.max(0,Number.isInteger(initialPage)?initialPage:0),firstAvailablePage(practice)));
  const heading=useRef(null),body=useRef(null),step=guideSteps[page];
  const scene=cutscenes[step],exercise=exercises[step],Exercise=exercise?.View;
  const final=page===lastGuidePage;
  useLayoutEffect(()=>{
    if(body.current)body.current.scrollTop=0;
    heading.current?.focus({preventScroll:true});
  },[page]);
  function update(changes){
    const next=restorePractice(changes);
    setPractice(next);
    onPractice?.(next);
  }
  function turn(next){
    if(next<0||next>lastGuidePage||(next>page&&!canContinue(page,practice)))return;
    setPage(next);
    onPage?.(next);
  }
  return <section className={'guide-full'+(replay?' sheet guide-replay':'')} data-step={step} data-mode={scene?'cutscene':'practice'}
    role={replay?'dialog':undefined} aria-modal={replay?true:undefined} aria-labelledby="guide-step-title"
    onClickCapture={event=>{
      const button=event.target.closest('button:enabled');
      if(!sound||!button)return;
      prepareGameAudio();
      playGameSound(button.dataset.guideSound||'menu');
    }}
    onKeyDown={event=>{if(!replay&&event.key==='Escape'){event.preventDefault();onExit();}}}>
    {scene&&<CutsceneArt key={step} step={step}/>}
    <span className="guide-count" aria-label={'전체 '+guideSteps.length+'단계 중 '+(page+1)+'단계'}>{page+1} / {guideSteps.length}</span>
    <button className="guide-skip" type="button" onClick={onExit} aria-label="건너뛰기 (SKIP)"><span lang="en">SKIP</span></button>
    <div className="guide-body" ref={body}>
      {scene?<div className="guide-caption">
        <h2 ref={heading} id="guide-step-title" tabIndex={-1}>
          {step==='stall'&&nickname&&<><bdi>{nickname}</bdi> 씨의 </>}{scene.title}
        </h2>
        {scene.copy&&<p>{scene.copy}</p>}
      </div>:<div className="guide-lesson">
        <div className="guide-instruction">
          <h2 ref={heading} id="guide-step-title" tabIndex={-1}>{exercise.title}</h2>
          <p>{exercise.prompt}</p>
        </div>
        <Exercise practice={practice} update={update}/>
      </div>}
    </div>
    <footer className="guide-foot"><div className="guide-navigation">
      <button type="button" className="ui-control guide-previous" onClick={()=>turn(page-1)} disabled={page===0}>이전</button>
      <button type="button" className="ui-control ui-primary guide-next" disabled={!canContinue(page,practice)}
        onClick={final?onStart:()=>turn(page+1)}>{final?'시작하기':'다음'}</button>
    </div></footer>
  </section>;
}
