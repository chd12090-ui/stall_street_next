import React,{useEffect,useMemo,useRef,useState} from 'react';
import {valuationComparison} from '../game/broker.mjs';
import {filingMarketTick,publicCompanyHistory} from '../game/company-filings.mjs';
import {financialHistory,getValuation} from '../game/analysis-metrics.mjs';
import {cash,number,shortValue} from '../game/broker-data.mjs';
import {currencies,stocks} from '../game/world.mjs';
import {quoteInfo} from '../game/tape.mjs';

const valuationMetrics=[['pe','PER'],['pb','PBR'],['ps','PSR']];
const filingPeriods=[['quarter','분기'],['annual','연간']];
const performance=[['eps','주당순이익','share'],['revenue','매출','amount']];
const finances=[['revenue','매출','amount'],['operatingProfit','영업이익','amount'],['netIncome','순이익','amount']];
const stability=[['debtRatio','부채비율','ratio'],['currentRatio','유동비율','ratio']];
const bankStability=[['bankCapitalShare','자기자본비율','ratio'],['bankCashShare','현금 비중','ratio']];
const analysisSection={profitability:'performance',growth:'performance',liquidity:'stability',
  activity:'finances',cash:'finances',valuation:'valuation'};
const investmentMetrics=[
  ['marketCap','시가총액','cap'],['dividendYield','배당수익률','ratio'],['pb','PBR','multiple'],
  ['pe','PER','multiple'],['roe','ROE','ratio'],['ps','PSR','multiple'],
];

function MetricSwitch({label,items,selected,onSelect,className='bk-segment bk-finance-switch'}){
  return <div className={className} role="group" aria-label={label}>
    {items.map(([id,name])=><button type="button" key={id} className={selected===id?'active':undefined}
      aria-pressed={selected===id} onClick={()=>onSelect(id)}>{name}</button>)}
  </div>;
}

export function MetricsSection({headingId,title,rows,details=false,children}){
  return <section className="bk-finance-section" aria-labelledby={headingId}>
    <header className="bk-finance-heading"><h2 id={headingId}>{title}</h2></header>
    <dl className={'bk-investment-metrics'+(details?' bk-fund-metadata':'')}>{rows.map(([label,value])=>
      <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {children}
  </section>;
}

function InvestmentMetrics({state,index,bundle,currency}){
  const values=getValuation(bundle,quoteInfo(state,index).price);
  const rows=investmentMetrics.map(([id,label,unit])=>[label,metricValue(values[id],unit,currency,2)]);
  return <MetricsSection headingId="bk-investment-heading" title="투자 지표" rows={rows}/>;
}

function Valuation({state,index,bundle}){
  const [metric,setMetric]=useState('pe');
  const {value,eps,average}=valuationComparison(state,index,bundle,metric);
  const scale=Math.max(value??0,average??0,.001);
  const values=[
    [stocks[index].name,value,metric==='pe'&&Number.isFinite(eps)&&eps<0?'적자':'자료 없음'],
    ['산업 평균',average,'비교 자료 없음'],
  ];
  return <section className="bk-finance-section" id="bk-valuation" aria-labelledby="bk-valuation-heading">
    <header className="bk-finance-heading"><h2 id="bk-valuation-heading">가치평가지표</h2><span>{bundle.profile.group}</span></header>
    <MetricSwitch label="가치평가지표 종류" items={valuationMetrics} selected={metric} onSelect={setMetric}/>
    <dl className="bk-valuation-rows">{values.map(([label,amount,fallback],i)=><div key={label} className={i===0?'issuer':''}>
      <dt>{label}</dt>
      <dd><strong>{Number.isFinite(amount)?number(amount,2)+'배':fallback}</strong>
        <span aria-hidden="true" className="bk-valuation-track"><i style={{width:(amount??0)/scale*100+'%'}}/></span></dd>
    </div>)}</dl>
  </section>;
}

function metricValue(value,unit,currency,ratioDigits=1){
  if(!Number.isFinite(value))return '자료 없음';
  if(unit==='share')return cash(value,currency);
  if(unit==='cap')return currency==='USD'?'$'+shortValue(value,'',1):shortValue(value,currencies[currency].name,1);
  if(unit==='ratio')return number(value,ratioDigits)+'%';
  if(unit==='multiple')return number(value,2)+'배';
  return shortValue(value,currencies[currency].name);
}
function chartScale(rows,fields){
  const values=rows.flatMap(row=>fields.map(([key])=>row[key])).filter(Number.isFinite);
  const min=Math.min(0,...values),max=Math.max(0,...values),range=max-min||1;
  const bottom=min<0?min-range*.08:0,top=max+range*.14;
  return value=>(value-bottom)/(top-bottom)*100;
}
function trendPath(rows,key,position){
  let connected=false;
  return rows.map((row,i)=>{
    if(!Number.isFinite(row[key])){connected=false;return '';}
    const x=(i+.5)/rows.length*100,y=100-position(row[key]);
    const command=(connected?'L':'M')+' '+x+' '+y;
    connected=true;
    return command;
  }).join(' ');
}
function FilingChart({rows,fields,kind,selected,onSelect,currency}){
  const position=chartScale(rows,fields),zero=position(0),barChart=kind==='bars';
  return <div className={'bk-filing-chart bk-filing-'+kind} role="group" aria-label="공시 기간 선택"
    style={{'--filing-count':rows.length,'--filing-zero':zero+'%'}}>
    <div className="bk-filing-grid" aria-hidden="true"/>
    {kind==='line'&&<svg className="bk-filing-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d={trendPath(rows,fields[0][0],position)} vectorEffect="non-scaling-stroke"/>
    </svg>}
    {rows.map(row=>{
      const period=row.quarter?row.year+'년 '+row.quarter+'분기':row.year+'년';
      const values=fields.map(([key,label,unit,description=label])=>description+' '+metricValue(row[key],unit,currency)).join(', ');
      return <button key={row.id} type="button" className="bk-filing-point" aria-pressed={row===selected}
        aria-label={period+' '+values} onClick={()=>onSelect(row.id)}>
        <span className="bk-filing-marks" aria-hidden="true">
          {fields.map(([key,,unit],i)=>{
            const height=Number.isFinite(row[key])?position(row[key]):null;
            return <span key={key} className="bk-filing-slot" data-series={i}>
              {height!==null&&<i style={{bottom:(barChart?Math.min(height,zero):height)+'%',
                height:barChart?Math.abs(height-zero)+'%':undefined}}/>}
              {kind==='line'&&height!==null&&<b data-below={height>=75||undefined}
                style={{'--filing-position':height+'%'}}>{metricValue(row[key],unit,currency)}</b>}
            </span>;
          })}
        </span>
        <time className="bk-filing-label" dateTime={row.end} aria-hidden="true">{row.quarter?row.end.slice(2,7).replace('-','.'):row.year}</time>
      </button>;
    })}
  </div>;
}

function FilingPanel({id,title,history,currency,fields,kind,defaultMetric}){
  const [period,setPeriod]=useState('quarter');
  const [metric,setMetric]=useState(defaultMetric??fields[0][0]);
  const [selected,setSelected]=useState(null);
  const rows=history[period];
  const displayed=kind==='bars'?fields:fields.filter(([key])=>key===metric);
  if(kind==='dots'){
    const [,label,unit]=displayed[0];
    displayed.unshift([metric+'Estimate','예상치',unit,label+' 예상치']);
  }
  const active=rows.find(row=>row.id===selected)??rows.at(-1);
  const hasValues=rows.some(row=>displayed.some(([key])=>Number.isFinite(row[key])));
  return <section className="bk-finance-section" id={'bk-'+id} aria-labelledby={'bk-'+id+'-heading'}>
    <header className="bk-finance-heading"><h2 id={'bk-'+id+'-heading'}>{title}</h2>
      <MetricSwitch className="bk-choice-switch bk-finance-period" label={title+' 조회 기간'}
        items={filingPeriods} selected={period} onSelect={next=>{setPeriod(next);setSelected(null);}}/>
    </header>
    {kind!=='bars'&&<MetricSwitch label={title+' 지표'} items={fields} selected={metric} onSelect={setMetric}/>}
    {hasValues?<><FilingChart rows={rows} fields={displayed} kind={kind} selected={active} onSelect={setSelected} currency={currency}/>
      {kind!=='line'&&<dl className={'bk-filing-values'+(kind==='dots'?' bk-filing-pair':'')}>{displayed.map(([key,label,unit],i)=><div key={key} data-series={i}>
        <dt>{label}</dt><dd>{metricValue(active[key],unit,currency)}</dd>
      </div>)}</dl>}</>:<p className="bk-finance-note">선택한 기간의 공개 자료가 없어.</p>}
  </section>;
}

export function CompanyFinancials({state,index,focus}){
  const tick=filingMarketTick(state),root=useRef(null);
  const bundle=useMemo(()=>publicCompanyHistory(index,tick,16),[index,tick]);
  const history=useMemo(()=>({quarter:financialHistory(bundle),annual:financialHistory(bundle,true)}),[bundle]);
  const target=Object.hasOwn(analysisSection,focus?.question)?analysisSection[focus.question]:null;
  useEffect(()=>{
    if(!target)return;
    const frame=requestAnimationFrame(()=>root.current?.querySelector('#bk-'+target)?.scrollIntoView({block:'start'}));
    return ()=>cancelAnimationFrame(frame);
  },[index,target,focus?.articleId]);
  const profile=bundle.profile,currency=stocks[index].currency;
  return <div className="bk-financials" ref={root}>
    <InvestmentMetrics state={state} index={index} bundle={bundle} currency={currency}/>
    <Valuation state={state} index={index} bundle={bundle}/>
    <FilingPanel id="performance" title="실적" history={history} currency={currency} fields={performance} kind="dots" defaultMetric="revenue"/>
    <FilingPanel id="finances" title="재무" history={history} currency={currency} fields={finances} kind="bars"/>
    <FilingPanel id="stability" title="안정성" history={history} currency={currency}
      fields={profile.financial?bankStability:stability} kind="line"/>
  </div>;
}
