import React from 'react';
import {readElection, canRepairOldBallot, presidentialElectionTitle} from '../game/election.mjs';
import {civilDate, dayLabel, gameTime} from '../game/clock-calendar.mjs';
import {candidates} from '../game/election-policy.mjs';

const choices=Object.values(candidates);
function ElectionDay({state,value}) {
  const {day}=gameTime(value);
  return <time dateTime={civilDate(day)}>{dayLabel(state,day)}</time>;
}

function Candidate({candidate,index,ballot,posting}) {
  const selected=ballot?.ownVote===candidate.id;
  return <article className={'election-candidate '+candidate.id} data-party-side={candidate.id}>
    <div className="election-candidate-name"><span className="election-number" aria-label={'기호 '+(index+1)}>{index+1}</span>
      <h3>{candidate.name}</h3></div>
    <p className="election-party">{candidate.party}</p>
    <img className="election-portrait sprite" src={'/art/pixel/election-'+candidate.id+'.webp'} width="88" height="88" alt="" />
    {selected?<strong className="election-stamp election-own" role="status" tabIndex={-1}>
      <i className="ico i-election-mark" aria-hidden="true" /><span className="sr-only">내가 투표한 후보 · {candidate.name}</span></strong>
      :ballot&&!ballot.ownVote?<button type="button" className="election-stamp" aria-label={candidate.name+'에게 한 표'}
        data-act="election-vote" data-value={candidate.id} aria-disabled={posting?true:undefined} data-posting={posting===candidate.id?'':undefined} />
      :<span className="election-stamp" aria-hidden="true" />}
  </article>;
}

function resultLabel({progressive,conservative,winner}) {
  return winner?candidates[winner].name+' 당선':progressive||conservative?'동률':'투표 없음';
}
function PreviousResult({state,result}) {
  return <section className="election-result"><header><h3>{result.number?'제 '+result.number+'대 선거':'대통령 선거'}</h3>
    <p className="election-note"><ElectionDay state={state} value={result.endsAt}/></p></header>
    <strong>{resultLabel(result)}</strong>
    <dl>{choices.map(candidate=><div key={candidate.id} data-party-side={candidate.id}><dt>{candidate.name}</dt><dd>{result[candidate.id]}표</dd></div>)}</dl>
  </section>;
}
function ElectionHistory({snapshot,state}) {
  const history=snapshot.history??(snapshot.lastResult?[snapshot.lastResult]:[]);
  const president=candidates[snapshot.terms.at(-1)?.candidate];
  return <details className="election-history"><summary className="ui-control ui-disclosure">이전 선거</summary>
    <section className="election-presidency"><span>현 정부</span><b data-party-side={president?.id}>
      {president?`${president.name} 대통령(${president.party})`:'공석'}</b></section>
    {history.length?history.map(result=><PreviousResult key={result.startsAt??result.endsAt} state={state} result={result}/>)
      :<p className="election-note">첫 선거 결과 공표 대기</p>}
  </details>;
}
function BallotPaper({snapshot,state,posting}) {
  const {ballot,lastResult,nextStartsAt,nextEndsAt,publishedToday}=snapshot;
  const end=ballot?.endsAt??nextEndsAt;
  const title=publishedToday?'결과 공표':ballot?.ownVote?'투표 완료':ballot?'투표 진행 중':'다음 선거';
  return <>
    <div className="election-phase">
      <span>{title}</span>
      <p className="election-period">{publishedToday
        ? <ElectionDay state={state} value={lastResult.endsAt}/>
        : <><ElectionDay state={state} value={ballot?.startsAt??nextStartsAt}/> ~ <ElectionDay state={state} value={end-1}/></>}
      </p>
    </div>
    <section className="election-paper" aria-labelledby="election-paper-title">
      <header className="election-paper-heading"><h2 id="election-paper-title">투표용지</h2>
        {ballot&&<span>{ballot.votes}명 참여</span>}
      </header>
      <div className="election-choices">{choices.map((candidate,index)=><Candidate key={candidate.id}
        candidate={candidate} index={index} ballot={ballot} posting={posting} />)}</div>
    </section>
  </>;
}
function ElectionPromises() {
  return <details className="election-promises"><summary className="ui-control ui-disclosure">후보 공약</summary><dl>
    {choices.map(candidate=><div key={candidate.id} data-party-side={candidate.id}><dt>{candidate.name} <span>{candidate.orientation}</span></dt>
      <dd>{candidate.platform}</dd></div>)}</dl></details>;
}
export function ElectionPage({state}) {
  const {snapshot,posting,notice}=readElection();
  const ballot=snapshot?.ballot;
  const instruction=posting?'투표용지를 넣고 있어.':ballot?.ownVote?'한 표를 넣었어. 투표가 끝나면 여기서 결과를 볼 수 있어.':
    ballot?'원하는 후보의 기표란을 누르면 한 표가 들어가.':snapshot?.publishedToday?resultLabel(snapshot.lastResult):
    snapshot?'':'선거 일정을 확인하고 있어.';
  return <div className="election-page">
    <header className="view-heading election-heading"><h1>{presidentialElectionTitle()}</h1>
      <button className="election-close ui-control ui-icon" type="button" data-act="tab" data-tab="home" aria-label="선거 화면 닫기"><i className="ico i-close" aria-hidden="true"/></button>
    </header>
    <div className="election-booth">
      {notice&&<p className="election-notice" role="status">{notice}</p>}
      {snapshot&&<BallotPaper snapshot={snapshot} state={state} posting={posting}/>}
    </div>
    <div className="election-ballot-box">
      <div className="election-lid" aria-hidden="true">
        <div className="election-ticket-feed"><span className="election-ticket"><i className="ico i-election-mark"/></span></div>
        <div className="election-slot"/>
      </div>
      <div className="election-box-front">
        <div className="election-box-header">
          <i className="ico i-election-mark election-box-mark" aria-hidden="true"/>
          <h2>투표함</h2>{instruction&&<p className="election-instruction" role="status">{instruction}</p>}
          {canRepairOldBallot(state)&&<button type="button" className="election-repair ui-control ui-compact" data-act="election-repair">이전 초기화에 남은 표 지우기</button>}
        </div>
        {snapshot&&<ElectionPromises/>}
        <details className="election-rules"><summary className="ui-control ui-disclosure">선거 규칙</summary><ul>
          <li>{snapshot?.openingDay!=null&&snapshot.openingDay!==state.openingDay
            ?'친구방의 선거 일정은 모든 참가자가 공유해. 화면의 날짜는 내 게임 시작일 기준이야.'
            :'Day 3과 Day 4에 첫 투표를 하고, Day 5에 결과를 알려 줘.'}</li>
          <li>이후 14일마다 선거가 열려. 방 참가자마다 한 표를 던질 수 있어.</li>
          <li>가장 많은 표를 받은 후보가 당선돼. 동률이거나 투표가 없으면 기존 상태가 이어져.</li>
          <li>당선된 정당은 한국의 외교 의제와 일부 긍정적인 기사에 조금 영향을 줘.</li>
        </ul></details>
        {snapshot&&<ElectionHistory snapshot={snapshot} state={state}/>}
      </div>
    </div>
  </div>;
}
