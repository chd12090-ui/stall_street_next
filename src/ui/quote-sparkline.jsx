import {memo} from 'react';

export const QuoteSparkline=memo(function QuoteSparkline({prices,fill='url(#bk-trend-fill)',fillOpacity}){
  const low=Math.min(...prices),high=Math.max(...prices),range=high-low;
  const points=prices.map((price,idx)=>{
    const x=prices.length===1?59:1+58*idx/(prices.length-1);
    const y=range?26-23*(price-low)/range:14.5;
    return x.toFixed(1)+' '+y.toFixed(1);
  });
  const line='M'+points.join(' L');
  return <svg className="bk-spark" viewBox="0 0 60 30" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    {points.length===1?<circle cx="59" cy="14.5" r="1" fill="currentColor"/>:points.length>1&&<>
      <path d={line+' V30 H1 Z'} fill={fill} fillOpacity={fillOpacity}/>
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
    </>}
  </svg>;
});
