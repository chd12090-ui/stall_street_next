import {fmtMoney,stocks} from './world.mjs';

const won=value=>fmtMoney(value,'KRW');
const signed=value=>(value>0?'+':'')+won(value);
const tone=value=>value>0?'gain':value<0?'loss':'';
export const activityNames={orders:'주문 내역',sales:'판매수익',dividends:'배당금·이자',analysis:'수익분석'};

export function collectActivity(s,day,includeRows=true){
  const orders=[],sales=[],dividends=[];
  let orderCount=0,saleProfit=0,dividendIncome=0,incomplete=false,estimated=false;
  const addOrder=(r,d,status)=>{
    if(!stocks[r.i]||!r.qty)return;
    const at=Number.isFinite(r.placedAt)?r.placedAt:d*86400+Math.min(86399,(r.step??0)*300+(r.second??0));
    // An order stays on its submission day, even if it is filled or canceled later.
    if(day!==null&&Math.floor(at/86400)!==day)return;
    orderCount++;
    if(includeRows)orders.push({...r,at,status});
  };
  const addSale=(r,d,automatic=false)=>{
    if(!stocks[r.i]||(day!==null&&d!==day))return;
    if(Number.isFinite(r.realizedKRW))saleProfit+=r.realizedKRW;
    else incomplete=true;
    if(r.estimated)estimated=true;
    if(includeRows)sales.push({...r,day:d,step:automatic?288:r.step,automatic});
  };
  function collect(d,trades,expired,cancelled){
    for(const r of trades??[]){
      addOrder(r,d,'체결');
      if(r.qty<0)addSale(r,d);
    }
    for(const r of expired??[])addOrder(r,d,'만료');
    for(const r of cancelled??[])addOrder(r,d,'취소');
  }
  for(let i=s.history.length-1;i>=0;i--){
    const h=s.history[i];
    if(day!==null&&h.day<day)break;
    collect(h.day,h.trades,h.expired,h.cancelled);
    if(day!==null&&h.day!==day)continue;
    for(const r of h.bill?.sales??[])addSale(r,h.day,true);
    for(const r of h.dividends??[]){
      if(!stocks[r.i])continue;
      dividendIncome+=r.amountKRW;
      if(includeRows)dividends.push({...r,day:h.day});
    }
  }
  if(s.phase==='open')collect(s.day,s.fills,s.expired,s.cancelled);
  s.orders.forEach((qty,i)=>{
    if(qty)addOrder({i,qty,limit:s.orderPrices[i],placedAt:s.orderTime?.[i],step:s.cursor},s.day,'대기');
  });
  if(includeRows){
    orders.sort((a,b)=>b.at-a.at||(b.seq??0)-(a.seq??0));
    sales.sort((a,b)=>b.day-a.day||(b.step??0)-(a.step??0)||(b.seq??0)-(a.seq??0));
    dividends.sort((a,b)=>b.day-a.day||a.i-b.i);
  }
  return {orders,sales,dividends,orderCount,saleProfit,dividendIncome,incomplete,estimated};
}

export const dailyActivity=(s,day=s.day)=>collectActivity(s,day);
const arrow='<span class="activity-arrow" aria-hidden="true">›</span>';
export function activityValue(key,activity){
  if(key==='orders')return activity.orderCount.toLocaleString('ko-KR')+'건';
  if(key==='sales')return activity.incomplete?'기록 일부 없음':signed(activity.saleProfit);
  return won(activity.dividendIncome);
}
export function activityLinks(s){
  const activity=collectActivity(s,null,false);
  return '<section class="bk-activity" aria-label="전체 투자 내역">'+Object.entries(activityNames).map(([key,label])=>
    '<button type="button" data-act="activity" data-value="'+key+'"><strong>'+label+'</strong>'+
    (key==='analysis'?'':'<span class="activity-value"><b class="'+(key==='sales'&&!activity.incomplete?tone(activity.saleProfit):'')+'">'+activityValue(key,activity)+'</b></span>')+arrow+'</button>'
  ).join('')+'</section>';
}

export function relativeDay(s,day){
  const ago=s.day-day;
  return ago===0?'오늘':ago===1?'어제':ago.toLocaleString('ko-KR')+'일 전';
}
