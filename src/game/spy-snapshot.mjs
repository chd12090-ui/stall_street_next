import {gameDayStart,marketClock,realTime} from './clock-calendar.mjs';
import {spyWindowMs} from './desk-charges.mjs';
import {stocks,symbolIndex,nyangUnitsPerLegacyCoin,quantityRound} from './securities-data.mjs';
import {fxRates} from './fx.mjs';
import {quoteAt} from './tape.mjs';

// The report protocol keeps the denomination even if an older client submits a snapshot.
const reportCode=asset=>asset.code==='BIT'?asset.ticker:asset.code;
export function currentReportRow(row){
  if(row.code==='NYAN')return {...row,code:'BIT'};
  if(row.code!=='BIT')return row;
  const converted={...row,qty:quantityRound(row.qty*nyangUnitsPerLegacyCoin)};
  for(const key of ['average','price'])if(Number.isFinite(row[key]))converted[key]=row[key]/nyangUnitsPerLegacyCoin;
  return converted;
}
function appendFills(trades,rows,day,from,until,forced=false){
  for(const row of rows??[]){
    const stock=stocks[row.i];
    if(!stock||!Number.isFinite(row.qty)||!row.qty)continue;
    const at=gameDayStart(day)+(forced?288:(row.step??0))*300_000+(forced?0:(row.second??0))*1000;
    if(at<from||at>until)continue;
    const price=forced?row.amount/row.qty:row.price;
    trades.push({at,code:reportCode(stock),qty:forced?-row.qty:row.qty,price:Number.isFinite(price)?price:null,
      currency:row.currency??stock.currency,forced});
  }
}

// Only executed investment activity and open positions leave the player's device.
export function tradingSnapshot(state,capturedAt){
  const trades=[],from=capturedAt-spyWindowMs;
  for(let i=state.history.length-1;i>=0;i--){
    const record=state.history[i];
    if(gameDayStart(record.day+1)<from)break;
    appendFills(trades,record.trades,record.day,from,capturedAt);
    appendFills(trades,record.bill?.sales,record.day,from,capturedAt,true);
  }
  if(state.phase==='open')appendFills(trades,state.fills,state.day,from,capturedAt);
  const positions=state.holdings.flatMap((qty,i)=>qty>0?[{code:reportCode(stocks[i]),qty,average:state.costs[i]/qty,costKRW:state.costsKRW[i]}]:[]);
  return {capturedAt,positions,trades:trades.sort((a,b)=>b.at-a.at)};
}

const botStrategies={
  'bot-bid':{core:[['MOON',22],['ARC',8]],traded:'NOVA',qty:3,buyMinute:45,sellMinute:220},
  'bot-rebound':{core:[['VOLT',34],['MART',20]],traded:'RAIL',qty:8,buyMinute:570,sellMinute:855},
  'bot-scale':{core:[['HRIDX',25],['AMIDX',9]],traded:'MOON',qty:11,buyMinute:510,sellMinute:935},
  'bot-dividend':{core:[['VOLT',28],['MART',23]],traded:'HARB',qty:4,buyMinute:655,sellMinute:1070},
  'bot-chart':{core:[['NOVA',8],['RAIL',19]],traded:'ARC',qty:5,buyMinute:275,sellMinute:680},
};
function quoteClock(at){
  const {day,minute,cursor,second}=realTime(at);
  return {clockMode:'kst',phase:'open',day,cursor,wallMinute:minute,wallSecond:second};
}
function botPosition(code,qty,average,rate){
  return {code,qty,average,costKRW:Math.round(qty*average*rate)};
}

export function botDayProfit(friend,day){
  const {core,traded,qty,buyMinute,sellMinute}=botStrategies[friend.room];
  const start=gameDayStart(day);
  const worth=(code,minute,quantity)=>{
    const i=symbolIndex[code],at=quoteClock(start+minute*60000),market=marketClock(at);
    return quantity*quoteAt(at,i)*fxRates(market.day,market.cursor)[stocks[i].currency];
  };
  const held=core.reduce((sum,[code,quantity])=>sum+worth(code,1440,quantity)-worth(code,0,quantity),0);
  return Math.round(held+worth(traded,sellMinute,qty)-worth(traded,buyMinute,qty));
}

export function botTradingSnapshot(friend,issuedAt){
  const {core,traded,qty,buyMinute,sellMinute}=botStrategies[friend.room];
  const positions=core.map(([code,qty])=>{
    const stock=stocks[symbolIndex[code]];
    return botPosition(code,qty,stock.base,fxRates(0,0)[stock.currency]);
  });
  const trades=[],from=issuedAt-spyWindowMs;
  const stock=stocks[symbolIndex[traded]],today=realTime(issuedAt).day;
  for(let day=realTime(from).day;day<=today;day++){
    for(const [minute,quantity] of [[buyMinute,qty],[sellMinute,-qty]]){
      const at=gameDayStart(day)+minute*60_000;
      if(at<from||at>issuedAt)continue;
      const clock=quoteClock(at),price=quoteAt(clock,symbolIndex[traded]);
      trades.push({at,code:traded,qty:quantity,price,currency:stock.currency,forced:false});
      if(day===today&&quantity>0&&issuedAt<gameDayStart(day)+sellMinute*60_000){
        const market=marketClock(clock);
        positions.push(botPosition(traded,quantity,price,fxRates(market.day,market.cursor)[stock.currency]));
      }
    }
  }
  return {capturedAt:issuedAt,positions,trades:trades.reverse()};
}
