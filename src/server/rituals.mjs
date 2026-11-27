import {progressSql,progressChanged} from './room-progress.mjs';
import {readChatBody} from './friend-chat.mjs';
import {deskRequestId} from '../game/desk-charges.mjs';
import {accountTick,gameTime,marketDayOffset} from '../game/clock-calendar.mjs';
import {ritualTarget,ritualCost,ritualChance,drawRitualOutcome,ritualDailyLimitMessage} from '../game/ritual-rules.mjs';
import {ritualMarketCap,ritualQuoteClock} from '../game/ritual-valuation.mjs';

const reply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const columns='sequence,request_id AS id,code,tick,minute_offset AS minuteOffset,strength AS bps';
const dailyReceipt='SELECT request_id,progress_aware FROM market_rituals WHERE room_code=? AND member_id=? AND tick>=? AND tick<? AND sequence>?';
export async function serveRituals(request,db,now,member){
  if(!member)return reply({error:'방에 입장해 줘.'},403);
  const wall=gameTime(now),firstTick=wall.day*288-marketDayOffset;
  const dailyArgs=[member.code,member.id,firstTick,firstTick+288,member.ritualFloor];
  if(request.method==='GET'){
    const after=Number(new URL(request.url).searchParams.get('after')??0);
    if(!Number.isSafeInteger(after)||after<0)return reply({error:'소식을 다시 열어 줘.'},400);
    const [news,today]=await db.batch([
      db.prepare('SELECT '+columns+' FROM market_rituals WHERE room_code=? AND success=1 AND sequence>? ORDER BY sequence LIMIT 101').bind(member.code,after),
      db.prepare(dailyReceipt+' ORDER BY sequence DESC LIMIT 1').bind(...dailyArgs),
    ]);
    const used=today.results[0];
    return reply({events:news.results.slice(0,100),more:news.results.length>100,usedDay:used?wall.day:null,
      usedRequestId:used?.request_id??null,legacyRitualReceipt:used?.progress_aware===0,ritualRepairId:member.ritualRepairId||null});
  }
  if(request.method!=='POST')return reply({error:'지원하지 않는 요청이야.'},405);
  if(request.headers.get('sec-fetch-site')==='cross-site'||!request.headers.get('content-type')?.startsWith('application/json'))return reply({error:'게임 안에서 굿을 시작해 줘.'},403);
  const body=await readChatBody(request);
  if(!deskRequestId(body?.id)||!Number.isSafeInteger(body.wealth)||body.wealth<=0||
    !Number.isSafeInteger(body.cost)||body.cost<1||
    !Number.isFinite(body.mental)||body.mental<=0||body.mental>100)return reply({error:'제물과 정신력을 다시 확인해 줘.'},400);
  const read=db.prepare('SELECT '+columns+',success,cost,mental,member_id FROM market_rituals WHERE room_code=? AND request_id=?').bind(member.code,body.id);
  // A reconnect may replay a paid offering from before a rule change.
  let row=await read.first();
  if(row&&row.sequence<=member.ritualFloor)return reply({error:'초기화 이전 굿 기록이야.'},409);
  if(!row){
    if(!ritualTarget(body.code))return reply({error:'개별 회사 주식을 골라 줘.'},400);
    if(body.day!==wall.day)return reply({error:'게임 날짜가 바뀌었어. 오늘 제물로 다시 준비해 줘.'},409);
    const priceChanged=()=>reply({error:'제물이 바뀌었어. 금액을 다시 확인해 줘.'},400);
    const nowQuotedAt=accountTick(wall.day,wall.cursor,wall.minute%5*60+wall.second);
    if(!Number.isSafeInteger(body.quotedAt)||body.quotedAt<accountTick(wall.day,0)||body.quotedAt>nowQuotedAt+2)return priceChanged();
    const priceClock=ritualQuoteClock(body.quotedAt);
    if(priceClock.day!==wall.day)return priceChanged();
    // Clients from the previous release did not send their 0.8%p quote.
    const previousChance=body.mental*.8,chance=body.chance??previousChance;
    if(chance!==ritualChance(body.mental)&&chance!==previousChance)return reply({error:'성공 확률이 바뀌었어. 새로고침한 뒤 다시 확인해 줘.'},400);
    const {results:ritualEvents}=await db.prepare('SELECT '+columns+' FROM market_rituals WHERE room_code=? AND code=? AND success=1 AND tick<? ORDER BY tick,minute_offset,request_id')
      .bind(member.code,body.code,firstTick+priceClock.cursor).all();
    const marketCap=ritualMarketCap({...priceClock,ritualEvents},body.code);
    if(body.cost!==ritualCost(body.wealth,marketCap))return priceChanged();
    const tick=firstTick+wall.cursor;
    const {success,bps}=drawRitualOutcome(chance);
    // Check and insert in a single SQLite write. Historical same-day rows also count.
    const insert=db.prepare('INSERT INTO market_rituals(room_code,member_id,request_id,code,cost,mental,tick,minute_offset,strength,success,progress_aware) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE '+progressSql('?')+'=? AND NOT EXISTS ('+dailyReceipt+') ON CONFLICT(room_code,request_id) DO NOTHING')
      .bind(member.code,member.id,body.id,body.code,body.cost,body.mental,tick,wall.minute%5,bps,Number(success),Number(request.headers.has('x-stall-progress')),member.id,member.progressId,...dailyArgs);
    const [,receipt]=await db.batch([insert,read]);
    row=receipt.results[0];
    if(!row){
      const [generation,today]=await db.batch([
        db.prepare('SELECT '+progressSql('?')+' AS id').bind(member.id),
        db.prepare(dailyReceipt+' ORDER BY sequence DESC LIMIT 1').bind(...dailyArgs),
      ]);
      const current=generation.results[0].id;
      if(current!==member.progressId)return progressChanged(current);
      return reply({error:ritualDailyLimitMessage,usedDay:wall.day,
        legacyRitualReceipt:today.results[0]?.progress_aware===0,ritualRepairId:member.ritualRepairId||null},409);
    }
  }
  if(row.member_id!==member.id||row.code!==body.code||row.cost!==body.cost||row.mental!==body.mental)return reply({error:'굿 기록이 일치하지 않아.'},409);
  return reply({result:{id:row.id,code:row.code,tick:row.tick,minuteOffset:row.minuteOffset,bps:row.bps,success:Boolean(row.success)}});
}
