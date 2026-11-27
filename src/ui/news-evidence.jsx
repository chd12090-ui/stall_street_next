import React,{useState} from 'react';
import {stocks,symbolIndex} from '../game/world.mjs';
import {articleEvidence,publicNewsLinks} from '../game/news-analysis.mjs';

function ImpactReading({state,story,codes,selected,select}) {
  const code=codes.includes(selected)?selected:codes[0];
  const evidence=articleEvidence(state,story.id,code);
  if (!evidence) return <p>이 기사에서 영향받을 기업을 특정할 자료가 아직 없어. 적용 대상이 적힌 후속 보도를 기다려 봐.</p>;
  return <>
    <label className="nr-analysis-choice">살펴볼 종목
      <select className="ui-control ui-select" aria-label="영향을 살펴볼 종목" value={code} onChange={e=>select(e.target.value)}>
        {codes.map(value=><option key={value} value={value}>{stocks[symbolIndex[value]].name}</option>)}
      </select>
    </label>
    <dl className="nr-impact-steps">
      <div><dt>보도된 사건</dt><dd>{evidence.fact}<small>{evidence.source}</small></dd></div>
      <div><dt>사업에서 달라질 점</dt><dd>{evidence.relation && <span>{evidence.relation} </span>}{evidence.business}</dd></div>
      <div><dt>예상되는 재무 영향</dt><dd>{evidence.financial}</dd></div>
      <div><dt>확인할 지표</dt><dd>{evidence.metric}</dd></div>
      <div><dt>해석이 달라지는 조건</dt><dd>{evidence.conditions}</dd></div>
    </dl>
    <div className="nr-evidence-actions">
      <button type="button" className="ui-control" data-act="analyze-article" data-value={story.id} data-id={symbolIndex[code]} data-question={evidence.question}>종목에서 확인</button>
    </div>
  </>;
}

export function ArticleImpact({state,story,open,onOpenChange,summaryRef,initialCode}) {
  const [selected,select]=useState(initialCode);
  const {direct,indirect}=publicNewsLinks(story);
  return <details id="article-analysis" className="nr-evidence" open={open} data-impact-code={selected}
    onToggle={e=>{if(e.target===e.currentTarget)onOpenChange(e.currentTarget.open);}}>
    <summary className="ui-disclosure" ref={summaryRef}>기사 분석</summary>
    {open && <div className="nr-evidence-content"><ImpactReading state={state} story={story} codes={[...direct,...indirect]} selected={selected} select={select}/></div>}
  </details>;
}
