import React from 'react';
import {chartPreview,previewViewBox} from '../game/chart-previews.mjs';
import {studySpecs} from '../game/studies.mjs';
import {settingsSnapshot} from '../game/terminal.mjs';
import {Icon} from './controls.jsx';

function Preview({id,tool=false}){
  return <svg className="chart-option-preview" viewBox={previewViewBox} fill="none" aria-hidden="true" focusable="false">
    {chartPreview(id,tool).map(({type:Shape,props},i)=><Shape key={i} {...props}/>)}
  </svg>;
}
function OptionCopy({title,detail}){
  return <span className="chart-option-copy"><strong>{title}</strong>{detail&&<small>{detail}</small>}</span>;
}
function OptionCheck(){
  return <span className="chart-option-check" aria-hidden="true"><Icon name="check"/></span>;
}
function Study({spec,settings}){
  return <div className="study-item">
    <label className="study-toggle chart-option">
      <input className="sr-only" type="checkbox" name={spec.id+'_on'} defaultChecked={settings.on}/>
      <Preview id={spec.id}/><OptionCheck/>
      <OptionCopy title={spec.title} detail={spec.short!==spec.title?spec.short:null}/>
    </label>
    <details className="study-details">
      <summary className="ui-disclosure ui-compact">상세설정</summary>
      <div className="study-details-body">
        {spec.fields.length>0&&<div className="study-fields">{spec.fields.map(([key,title,,lo,hi,step])=>
          <label key={key}>{title}<input type="number" required name={spec.id+'_'+key} min={lo} max={hi} step={step} defaultValue={settings[key]} inputMode={step<1?'decimal':'numeric'}/></label>)}</div>}
        <p>{spec.note}</p>
      </div>
    </details>
  </div>;
}
export function ChartSettings({kind}){
  const {tools,active,canReset,upperIndicators,params}=settingsSnapshot();
  if(kind==='drawings')return <div className="draw-settings-body">
    <div className="draw-palette chart-option-grid">{tools.map(([id,label,points])=>
      <button key={id} type="button" className="ui-control chart-option" data-act="draw" data-value={id} aria-pressed={active===id}>
        <Preview id={id} tool/><OptionCheck/><OptionCopy title={label} detail={'점 '+points+'개'}/>
      </button>)}</div>
    <button type="button" className="ui-control draw-reset" data-act="draw" data-value="reset" disabled={!canReset}
      title="현재 종목과 봉 주기의 작도를 지워요">초기화 하기</button>
  </div>;
  const upper=upperIndicators.map(id=>studySpecs.find(spec=>spec.id===id)),lower=studySpecs.filter(spec=>!upperIndicators.includes(spec.id));
  return <form id="study-form" noValidate>
    <div className="chart-study-tabs ui-tabs" role="group" aria-label="지표 표시 위치">
      <button type="button" data-act="study-pane" data-value="upper" aria-pressed="true">상단 지표</button>
      <button type="button" data-act="study-pane" data-value="lower" aria-pressed="false">하단 지표</button>
    </div>
    {[upper,lower].map((group,i)=><section className="chart-option-grid" data-study-pane={i?'lower':'upper'} hidden={i===1} key={i}>
      {group.map(spec=><Study key={spec.id} spec={spec} settings={params[spec.id]}/>)}
    </section>)}
    <footer className="study-apply">
      <p className="study-error" role="alert"/>
      <button type="button" className="ui-control" data-act="study-default">기본값</button>
      <button type="submit" className="ui-control ui-primary">차트에 적용</button>
    </footer>
  </form>;
}
