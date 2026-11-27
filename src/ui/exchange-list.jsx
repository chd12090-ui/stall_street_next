import {memo} from 'react';
import {instrumentListLabel} from '../game/broker-data.mjs';
import {CompanyMark} from './exchange-controls.jsx';
import {Flag} from './news-marks.jsx';
import {QuoteSparkline} from './quote-sparkline.jsx';

export const InstrumentListRow=memo(function InstrumentListRow({asset,index,rank,trend,price,change,tone,quantity=null}){
  const label=instrumentListLabel(asset);
  const detail=(label===asset.name?label:label+' · '+asset.name)+' 종목 상세';
  const holding=quantity!==null;
  return <div className="bk-listrow">
    <button type="button" className="bk-instrument" data-act="symbol" data-id={index} data-etf={asset.reference?'':undefined}
      data-live-symbol={holding?undefined:index} data-live-holding={holding?index:undefined}
      aria-label={holding?detail+' · '+quantity+' · '+price+' · '+change:detail}>
      <span className="bk-rank" aria-hidden="true">{rank}</span>
      <span className="bk-symbol-art" aria-hidden="true">
        <span className="bk-mark"><CompanyMark asset={asset}/></span>
        <Flag nation={asset.country}/>
      </span>
      <span className="bk-instrument-name" title={asset.name}><b>{label}</b>{holding&&<small>{quantity}</small>}</span>
      {!holding&&<QuoteSparkline prices={trend}/>}
      <span className="bk-last"><b data-live-price="">{price}</b><small data-live-change="" className={tone}>{change}</small></span>
    </button>
  </div>;
});
