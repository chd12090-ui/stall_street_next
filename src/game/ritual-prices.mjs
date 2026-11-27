import {stocks,snapPrice} from './securities-data.mjs';

const schedules=new WeakMap();
const adjustedSessions=new WeakMap();
const empty={key:'',steps:[]};

export function ritualPressure(events,i){
  if(!events?.length)return empty;
  if(!schedules.has(events)){
    const byCode=new Map();
    // The first eligible print belongs to the bar after publication. Earlier prints stay intact.
    for(const event of events){
      if(!event.bps)continue;
      const pressure=byCode.get(event.code)??{key:'',steps:[]};
      const last=pressure.steps.at(-1);
      pressure.steps.push({from:event.tick+1,factor:(last?.factor??1)*(1-event.bps/10000)});
      pressure.key+=event.tick+':'+event.bps+',';
      byCode.set(event.code,pressure);
    }
    schedules.set(events,byCode);
  }
  const asset=stocks[i];
  return schedules.get(events).get(asset.option?.underlying??asset.code)??empty;
}

export function pressuredBars(bars,i,pressure){
  const steps=pressure?.steps;
  if(!steps?.length||!bars.length||bars.at(-1).key<steps[0].from)return bars;
  const prior=adjustedSessions.get(bars);
  if(prior?.key===pressure.key)return prior.rows;
  let j=0,factor=1;
  const rows=bars.map(b=>{
    while(j<steps.length&&steps[j].from<=b.key)factor=steps[j++].factor;
    if(factor===1)return b;
    const price=value=>snapPrice(i,value*factor);
    return {...b,o:price(b.o),h:price(b.h),l:price(b.l),c:price(b.c),pv:b.pv*factor,
      ...(b.tracking&&{tracking:{...b.tracking,multiplier:factor}})};
  });
  adjustedSessions.set(bars,{key:pressure.key,rows});
  return rows;
}
