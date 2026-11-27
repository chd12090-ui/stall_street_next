import React from 'react';
import {balance,localRates} from '../game/market.mjs';
import {exchangeCurrencies} from '../game/fx.mjs';
import {currencies} from '../game/world.mjs';
import {brokerView as view,currentPositions,reg,currencyAction,signedCash} from '../game/broker.mjs';
import {cash,shareCount,percent,cls} from '../game/broker-data.mjs';
import {Select} from './exchange-controls.jsx';
import {InstrumentListRow} from './exchange-list.jsx';

const holdingGroups=[['domestic','국내증권'],['overseas','해외증권'],['coin','코인'],['archive','이전 보유분']];
const currencyLabel=code=>code==='KRW'?'원화':currencies[code].name;

function groupHoldings(positions){
  const groups=holdingGroups.map(([id,label])=>({
    id,label,positions:positions.filter(p=>reg(p.a)===id),weight:0,remainder:0,
  })).filter(group=>group.positions.length);
  const total=positions.reduce((sum,p)=>sum+p.valueKRW,0);
  if(total<=0)return groups;

  // Allocate leftover percentage points to the largest fractional shares.
  let remaining=100;
  for(const group of groups){
    const scaled=group.positions.reduce((sum,p)=>sum+p.valueKRW,0)*100;
    group.weight=Math.floor(scaled/total);
    group.remainder=scaled%total;
    remaining-=group.weight;
  }
  const byRemainder=[...groups].sort((a,b)=>b.remainder-a.remainder);
  for(const group of byRemainder.slice(0,remaining))group.weight++;
  return groups;
}

function HoldingGroup({id,label,positions,rate,weight}){
  const heading='bk-hold-'+id;
  return <section className="bk-hold-group" aria-labelledby={heading}>
    <h3 className="bk-listcap" id={heading}><span>{label} <span className="bk-sr">평가액 비중 </span><b>{weight}%</b></span></h3>
    {positions.map(({a,i,profitKRW,qty,estimated,valueKRW,pctKRW},rank)=>
      <InstrumentListRow key={i} asset={a} index={i} rank={rank+1}
        price={cash(valueKRW/rate,view.money)} change={signedCash(profitKRW/rate,view.money)+' ('+percent(pctKRW)+')'}
        tone={cls(profitKRW)} quantity={shareCount(qty,i)+(estimated?' · 평균단가 추정':'')}/>)}
  </section>;
}

export function BrokerAccount({state}){
  const positions=currentPositions(state).sort((a,b)=>view.holdingSort==='profit'?b.pctKRW-a.pctKRW:b.valueKRW-a.valueKRW);
  const rate=positions.length?localRates(state)[view.money]:1;
  const groups=groupHoldings(positions);
  return <>
    <div className="bk-account">
      <div className="bk-heading"><h2>내 계좌</h2></div>
      <div className="bk-wallet-pair">
        {exchangeCurrencies.map(code=>{
          const label=currencyLabel(code),amount=cash(balance(state,code),code);
          return <button type="button" key={code} data-act="fx" data-value={code}
            aria-label={label+'로 환전 · 잔액 '+amount} aria-haspopup="dialog">
            <span className="bk-wallet-label">{label}</span>
            <b data-bk-krw={code==='KRW'?'':undefined}>{amount}</b>
          </button>;
        })}
      </div>
    </div>
    <section className="bk-holdings"><div className="bk-heading"><h2>보유 종목</h2>
      <div className="bk-investment-controls">
        <Select className="ui-compact" id="bk-hold-sort" aria-label="보유 종목 정렬" value={view.holdingSort}>
          <option value="value">평가금액순</option><option value="profit">수익률순</option>
        </Select>
        <div className="bk-currency bk-choice-switch" role="group" aria-label="시세 표시 통화">
          {exchangeCurrencies.map(code=><button type="button" data-act="bk-currency" key={code} data-value={code}
            aria-label={currencyAction[code]} aria-pressed={view.money===code}>{currencyLabel(code)}</button>)}
        </div>
      </div>
    </div>
    {positions.length?<div className="bk-hold-groups">
      {groups.map(({id,label,positions,weight})=><HoldingGroup key={id} id={id} label={label} rate={rate}
        weight={weight} positions={positions}/>)}
      </div>:
      <div className="bk-empty-hold">
        <span className="bk-empty-hold-cat" aria-hidden="true"/>
        <p>보유한 종목이 없어요</p>
      </div>}
    </section>
  </>;
}
