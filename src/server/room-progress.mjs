import {readChatBody} from './friend-chat.mjs';
import {gameTime,marketDayOffset} from '../game/clock-calendar.mjs';
import {electionSchedule} from './election-calendar.mjs';

const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export const progressSql=user=>"COALESCE((SELECT reset_id FROM room_member_progress WHERE member_id="+user+"),'')";
export const progressChanged=progressId=>reply({
  error:'게임 기록이 초기화됐어. 새로고침한 뒤 다시 시도해 줘.',reason:'progress_changed',progressId,
},409);

export async function serveRoomProgress(request,db,now,member){
  if(!member)return reply({error:'게임 방에 먼저 입장해 줘.'},403);
  if(request.method==='GET')return reply({progressId:member.progressId});
  if(request.method!=='POST')return reply({error:'지원하지 않는 요청이야.'},405);
  if(request.headers.get('sec-fetch-site')==='cross-site'||!request.headers.get('content-type')?.startsWith('application/json'))
    return reply({error:'게임 안에서 초기화해 줘.'},403);
  const body=await readChatBody(request);
  const {previousId,resetId,resetAt}=body??{};
  if(typeof resetId!=='string'||!uuid.test(resetId)||typeof previousId!=='string'||(previousId!==''&&!uuid.test(previousId))||
     previousId===resetId||!Number.isSafeInteger(resetAt)||resetAt<0||resetAt>now+60000)
    return reply({error:'초기화 기록을 확인해 줘.'},400);
  const user=member.id, matches=progressSql('?1')+'=?2';
  const changes=[db.prepare('DELETE FROM friend_trading_snapshots WHERE member_id=?1 AND '+matches).bind(user,previousId)];
  // A solo room is reused by the start screen. Move its first election along with the new game.
  if(member.mode==='guest')changes.push(db.prepare(
    'UPDATE friend_rooms SET started_at=MAX(COALESCE(started_at,created_at),?4) WHERE host_id=?1 AND code=?3 AND '+matches
  ).bind(user,previousId,member.code,resetAt));
  const election=electionSchedule(now,member.openedAt).active?.id;
  if(election!==undefined&&electionSchedule(resetAt,member.openedAt).active?.id===election){
    changes.push(
      db.prepare('DELETE FROM server_election_votes WHERE member_id=?1 AND election_at=?3 AND '+matches).bind(user,previousId,election),
      db.prepare('INSERT OR IGNORE INTO server_election_resets(member_id,election_at,reset_id) SELECT ?1,?3,?4 WHERE '+matches)
        .bind(user,previousId,election,resetId),
    );
  }
  // Cut off only this member's personal views. The original rows also carry shared
  // news, effects and other buyers' paid evidence, so those must remain addressable.
  changes.push(db.prepare(`
    INSERT INTO room_member_progress(member_id,room_code,reset_id,ritual_floor,intimidation_floor,spy_floor)
    SELECT ?1,?3,?4,(SELECT COALESCE(MAX(sequence),0) FROM market_rituals),
      (SELECT COALESCE(MAX(rowid),0) FROM friend_intimidations),(SELECT COALESCE(MAX(rowid),0) FROM friend_spy_reports)
    WHERE `+matches+`
    ON CONFLICT(member_id) DO UPDATE SET reset_id=excluded.reset_id, ritual_floor=excluded.ritual_floor,
      intimidation_floor=excluded.intimidation_floor,spy_floor=excluded.spy_floor,ritual_repair_id=''
  `).bind(user,previousId,member.code,resetId));
  changes.push(db.prepare('SELECT reset_id AS progressId FROM room_member_progress WHERE member_id=?').bind(user));
  const rows=await db.batch(changes);
  const actual=rows.at(-1).results[0]?.progressId??'';
  return actual===resetId?reply({ok:true,progressId:actual}):progressChanged(actual);
}


// One-time repair for pre-generation games whose local reset copied a bare daily
// flag. Snapshot the exact owned receipt; retries cannot clear its replacement.
export async function repairLegacyRitual(request,db,now,member){
  if(!member||member.mode!=='multiplayer')return reply({error:'친구방에서 기록을 확인해 줘.'},403);
  if(request.method!=='POST')return reply({error:'지원하지 않는 요청이야.'},405);
  if(request.headers.get('sec-fetch-site')==='cross-site'||!request.headers.get('content-type')?.startsWith('application/json'))
    return reply({error:'게임 안에서 기록을 확인해 줘.'},403);
  if(member.progressId)return progressChanged(member.progressId);
  const {resetId,receiptId,day}=await readChatBody(request)??{};
  if(typeof resetId!=='string'||!uuid.test(resetId)||typeof receiptId!=='string'||!uuid.test(receiptId)||!Number.isSafeInteger(day))
    return reply({error:'초기화 이전 살굿 기록을 확인해 줘.'},400);
  const wall=gameTime(now);
  if(day!==wall.day)return reply({error:'게임 날짜가 바뀌었어. 살굿을 다시 열어 줘.'},409);
  const firstTick=wall.day*288-marketDayOffset;
  const receipts='FROM market_rituals WHERE room_code=?1 AND member_id=?2 AND tick>=?3 AND tick<?4';
  const args=[member.code,member.id,firstTick,firstTick+288];
  const [,status]=await db.batch([
    db.prepare(`
      INSERT INTO room_member_progress(room_code,member_id,reset_id,ritual_floor,ritual_repair_id,intimidation_floor,spy_floor)
      SELECT ?1,?2,'',sequence,?6,0,0 FROM (SELECT request_id,sequence,progress_aware `+receipts+` ORDER BY sequence DESC LIMIT 1)
      WHERE request_id=?5 AND progress_aware=0 ON CONFLICT(member_id) DO NOTHING
    `).bind(...args,receiptId,resetId),
    db.prepare(`
      SELECT reset_id AS generation,ritual_repair_id AS repairId,EXISTS(SELECT 1 `+receipts+` AND sequence>g.ritual_floor) AS used
      FROM room_member_progress g WHERE member_id=?2
    `).bind(...args),
  ]);
  const row=status.results[0];
  if(row?.generation)return progressChanged(row.generation);
  if(row?.repairId!==resetId)return reply({error:'이미 정리했거나 현재 기록과 일치하지 않아.'},409);
  return reply({ok:true,day,repairId:row.repairId,usedDay:row.used?day:null});
}
