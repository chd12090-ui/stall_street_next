import {useEffect,useRef,useState} from 'react';
import {maxRaise,negotiationAdSeconds,salaryHistory,salaryQuote,todaysNegotiation} from '../game/salary-negotiation.mjs';
import {dayLabel} from '../game/clock-calendar.mjs';
import {fmtMoney} from '../game/world.mjs';
import {playGameSound} from '../game/game-audio.mjs';
import {petCharacter,petDuration} from '../game/player-character.mjs';
import {Icon} from './controls.jsx';
import {AdBody} from './extras.jsx';
import {PetHand,PetTarget} from './petting.jsx';

const won=amount=>fmtMoney(amount,'KRW');
const annualPay=daily=>won(daily*365);

function NegotiationRoom({sound}){
  function pet(button){
    if(petCharacter(button)&&sound)playGameSound('pet');
  }
  return <header className="salary-scene" data-pet-stage="" style={{'--pet-duration':petDuration+'ms'}}>
    <img className="sprite" src="/art/pixel/negotiation-room.webp" width="108" height="86"
      alt="어두운 방에서 천장등이 고양이 협상가의 안경과 모은 앞발, 책상을 은은하게 비춘다."/>
    <img className="sprite salary-lamp" src="/art/pixel/negotiation-room-light.webp" width="108" height="86" alt="" draggable={false}/>
    <span className="salary-sitter pov-pet-body" aria-hidden="true">
      <img className="sprite" src="/art/pixel/negotiation-room-cat.webp" width="36" height="31" alt="" draggable={false}/>
      <img className="sprite salary-blink" src="/art/pixel/negotiation-room-blink.webp" width="36" height="31" alt="" draggable={false}/>
    </span>
    <PetHand className="salary-pet-hand"/>
    <PetTarget className="salary-pet-target" label="협상 고양이 쓰다듬기" onPet={pet}/>
    <div className="salary-heading"><h2 id="salary-title">연봉협상</h2>
      <button className="ui-control ui-icon" type="button" data-act="dismiss" aria-label="닫기"><Icon name="close"/></button></div>
  </header>;
}

function PayLine({label,children}){
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}

function PayComparison({before,after,settled=false}){
  return <dl className="salary-comparison">
    <PayLine label={settled?'협상 전 연봉':'현재 연봉'}>{annualPay(before)}</PayLine>
    <PayLine label="협상 성공 시 연봉">{annualPay(after)}</PayLine>
    <PayLine label={settled?'협상 전 일급':'현재 일급'}>{won(before)}</PayLine>
    <PayLine label="협상 성공 시 일급">{won(after)}</PayLine>
  </dl>;
}

function SalaryOffer({quote,onRaise,result}){
  const {raise,chance,correction,previousSalary,offeredSalary}=quote;
  const [helpOpen,setHelpOpen]=useState(false);
  const probability=useRef(null);
  useEffect(()=>{
    if(!helpOpen)return;
    const closeOutside=event=>{
      if(!probability.current?.contains(event.target))setHelpOpen(false);
    };
    document.addEventListener('pointerdown',closeOutside);
    return ()=>document.removeEventListener('pointerdown',closeOutside);
  },[helpOpen]);
  return <section className="salary-offer" aria-label="연봉 인상 제안">
    <div className="salary-picker">
      <div className="salary-terms">
        <div><label htmlFor="salary-rate">{result?'다음 요청 인상률':'요청 인상률'}</label><output htmlFor="salary-rate" aria-live="off">+{raise}%</output></div>
        <div className="salary-probability" ref={probability}>
          <div className="salary-chance-label">
            <span id="salary-chance-label">{result?'다음 성공 확률':'성공 확률'}</span>
            <button className="salary-help" type="button" aria-label="실패 보정 확률" aria-expanded={helpOpen}
              aria-controls="salary-failure-bonus" aria-describedby={helpOpen?'salary-failure-bonus':undefined}
              onClick={()=>setHelpOpen(!helpOpen)} onBlur={()=>setHelpOpen(false)} onKeyDown={event=>{
                if(helpOpen&&event.key==='Escape'){
                  event.preventDefault();event.stopPropagation();setHelpOpen(false);
                }
              }}>
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
                <circle cx="8" cy="8" r="7.2"/><path d="M7 4h2v5H7zM7 10h2v2H7z"/>
              </svg>
            </button>
          </div>
          <strong id="salary-chance" aria-live="polite">{chance}%</strong>
          <p className="salary-chance-hint" id="salary-failure-bonus" role="tooltip" hidden={!helpOpen}>실패 보정 확률 +{correction}%p</p>
        </div>
      </div>
      <div className="salary-scale">
        <input id="salary-rate" type="range" min="1" max={maxRaise} step="1" value={raise}
          aria-valuetext={raise+'% 인상'} aria-describedby="salary-chance-label salary-chance"
          style={{'--salary-fill':((raise-1)/(maxRaise-1)*100)+'%'}} onChange={event=>onRaise(Number(event.target.value))}/>
        <div className="salary-ends" aria-hidden="true"><span>최소 1%</span><span>최대 {maxRaise}%</span></div>
      </div>
    </div>
    {result?<PayComparison before={result.previousSalary} after={result.offeredSalary} settled/>:
      <PayComparison before={previousSalary} after={offeredSalary}/>}
  </section>;
}

function SalaryHistory({state}){
  const records=salaryHistory(state).reverse();
  return <section className="sheet salary-sheet salary-history" role="dialog" aria-modal="true" aria-labelledby="salary-history-title">
    <header className="salary-subhead"><button type="button" className="detail-back" data-act="salary-back" aria-label="협상으로 돌아가기"><Icon name="down"/></button>
      <h2 id="salary-history-title" tabIndex={-1}>협상 기록</h2></header>
    {records.length?<table aria-labelledby="salary-history-title">
      <colgroup><col/><col/><col/><col/></colgroup>
      <thead><tr><th scope="col">게임 날짜</th><th scope="col">요청 인상률</th><th scope="col">성공 확률</th><th scope="col">결과</th></tr></thead>
      <tbody>{records.map(({day,raise,chance,success})=><tr key={day}><th scope="row">{dayLabel(state,day)}</th>
        <td>+{raise}%</td><td>{chance==null?<span title="당시 성공 확률 기록 없음" aria-label="당시 성공 확률 기록 없음">—</span>:chance+'%'}</td>
        <td><strong data-success={success}>{success?'성공':'실패'}</strong></td></tr>)}</tbody>
    </table>:<p className="salary-empty">아직 협상 기록이 없어.</p>}
  </section>;
}

function SalaryAd({state,modal}){
  const ad=modal.stage==='ad',retry=modal.stage==='retry';
  return <section className="sheet salary-sheet salary-ad" role="dialog" aria-modal="true" aria-labelledby="salary-ad-title">
    <header className="salary-subhead"><h2 id="salary-ad-title" tabIndex={-1}>{ad?'게임 속 광고':retry?'협상 결과 저장':'협상 중'}</h2>
      <button type="button" className="ui-control ui-icon" data-act={ad?'salary-back':'dismiss'} aria-label={ad?'광고 닫기':'닫기'}><Icon name="close"/></button></header>
    {ad?<AdBody state={state} duration={negotiationAdSeconds}/>:<div className="salary-saving">
      {retry?<><p>결과를 저장하지 못했어.</p><button className="btn ui-control" data-act="salary-save" type="button">다시 저장하기</button></>:
        <p role="status">제안에 대한 답을 기다리는 중이야.</p>}</div>}
  </section>;
}

export function SalarySheet({state,modal}){
  const result=todaysNegotiation(state);
  const [draft,setDraft]=useState(result?.raise??modal.raise??maxRaise);
  if(modal.stage==='history')return <SalaryHistory state={state}/>;
  if(modal.stage)return <SalaryAd state={state} modal={modal}/>;
  function changeRaise(value){
    if(value===draft)return;
    setDraft(value);
    if(state.sound)playGameSound('salaryTick');
  }
  return <section className="sheet salary-sheet" role="dialog" aria-modal="true" aria-labelledby="salary-title">
    <NegotiationRoom sound={state.sound}/>
    <div className="salary-body">
      <div className="salary-section-head"><h3 id="salary-result-title">{result?(result.success?'연봉 인상 합의':'연봉 협상 결렬'):'연봉 인상 제안'}</h3>
        <button type="button" className="ui-control ui-compact" data-act="salary-history" aria-haspopup="dialog">기록</button></div>
      <SalaryOffer quote={salaryQuote(state,draft)} onRaise={changeRaise} result={result}/>
      <footer className="salary-footer">
        {result&&<p id="salary-outcome" tabIndex={-1}>요청한 {result.raise}% 인상안이 {result.success?'받아들여졌어.':'거절됐어.'}</p>}
        {result||state.phase!=='open'?<button type="button" className="btn ui-control full" disabled>내일 다시 협상할 수 있어</button>:
          <button type="button" className="btn ui-control ui-primary full" data-act="salary-watch" data-value={draft}>
            <Icon name="ticket"/>{negotiationAdSeconds}초 광고 보고 협상하기</button>}
      </footer>
    </div>
  </section>;
}
