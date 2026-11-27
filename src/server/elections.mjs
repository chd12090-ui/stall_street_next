import {progressSql} from './room-progress.mjs';
import {electionRound,electionSchedule,roomElectionRound} from './election-calendar.mjs';
import {actualTimestamp,gameDayStart,gameTime} from '../game/clock-calendar.mjs';

const electionPath = '/api/elections';
const electionCandidates = new Set(['progressive', 'conservative']);
const electionReply = (body, status = 200) => Response.json(body, {
  status, headers: {'Cache-Control': 'private, no-store'},
});
const electionError = (error, status = 400) => electionReply({error}, status);

function winnerOf(row) {
  if(!row||row.progressive===row.conservative)return null;
  return row.progressive>row.conservative?'progressive':'conservative';
}

async function electionView(db, userId, schedule, roomCode, now) {
  const {openingDay,active,last,next} = schedule;
  const [activeRows, results] = await db.batch([
    db.prepare(`
      SELECT count(*) AS votes, max(CASE WHEN member_id=?1 THEN candidate END) AS ownVote,
        (SELECT count(*) FROM server_election_resets WHERE member_id=?1 AND election_at=?2) AS generation
      FROM server_election_votes WHERE election_at=?2 AND room_code=?3
    `).bind(userId, active?.id??null, roomCode),
    db.prepare(`
      SELECT election_at AS id,
        sum(candidate='progressive') AS progressive,
        sum(candidate='conservative') AS conservative
      FROM server_election_votes WHERE election_at<=? AND room_code=?
      GROUP BY election_at ORDER BY election_at
    `).bind(last?.id??null, roomCode),
  ]);
  const current = activeRows.results[0];
  const totals=new Map(results.results.map(row=>[row.id,row]));
  const rounds=openingDay===undefined?[...totals.keys()].map(electionRound):
    Array.from({length:last?.number??0},(_,index)=>roomElectionRound(openingDay,index+1));
  if(last&&openingDay===undefined&&!totals.has(last.id))rounds.push(last);
  const history=rounds.map(({id,number,startsAt,endsAt})=>{
    const row=totals.get(id);
    return {number,startsAt,endsAt,progressive:row?.progressive??0,
      conservative:row?.conservative??0,winner:winnerOf(row)};
  });
  const terms=history.flatMap(result=>result.winner?[{candidate:result.winner,effectiveAt:result.endsAt}]:[]);
  const lastResult=history.at(-1)??null;
  const publishedToday=Boolean(lastResult&&openingDay!==undefined&&gameTime(now).day===gameTime(lastResult.endsAt).day);
  const ballot = active && {
    startsAt:active.startsAt,
    endsAt:active.endsAt,
    roundId:active.id,
    number:active.number,
    votes: current.votes,
    ownVote: current.ownVote,
    generation: current.generation,
  };
  return electionReply({openingDay,ballot,lastResult,publishedToday,history:history.reverse(),
    nextNumber:next.number,nextStartsAt:next.startsAt,nextEndsAt:next.endsAt,terms});
}

export async function serveElections(request, db, now = Date.now(), member=null) {
  if (new URL(request.url).pathname !== electionPath)
    return electionError('대통령 선거는 한국 서버에서 열려.', 404);
  const userId = member?.id??request.headers.get('oai-authenticated-user-id');
  const roomCode=member?.code??'', progress=member?.progressId??'';
  if (!userId) return electionError('로그인한 계정으로 투표할 수 있어.', 401);
  if (!db) return electionError('선거 저장소를 불러오지 못했어. 잠시 뒤 다시 시도해 줘.', 503);

  // Returning solo saves may predate the server-side reset of their calendar.
  // Only a private game can supply its saved Day 1. Shared ballots stay on the room clock.
  let openedAt=member?.openedAt;
  const openingDay=request.headers.get('x-stall-opening-day');
  if(member?.mode==='guest'&&openingDay!==null&&/^\d+$/.test(openingDay)){
    const day=Number(openingDay);
    if(day>=gameTime(openedAt).day&&day<=gameTime(now).day)openedAt=actualTimestamp(gameDayStart(day));
  }
  const schedule=electionSchedule(now,openedAt);
  if (request.method === 'GET') return electionView(db, userId, schedule, roomCode, now);
  if (request.method !== 'POST') return electionError('지원하지 않는 요청이야.', 405);
  if (request.headers.get('sec-fetch-site') === 'cross-site' ||
      !request.headers.get('content-type')?.startsWith('application/json'))
    return electionError('게임에서 투표를 다시 시도해 줘.', 403);

  const body = await request.json().catch(() => null);
  if(body?.action==='reset'){
    const {resetAt,resetId}=body;
    if(!Number.isSafeInteger(resetAt)||resetAt<0||resetAt>now+60000||
      typeof resetId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(resetId))
      return electionError('초기화 기록을 확인해 줘.');
    const election=schedule.active?.id;
    if(election!==undefined&&electionSchedule(resetAt,openedAt).active?.id===election){
      // A repeated offline request must never remove the replacement vote.
      await db.batch([
        db.prepare(`DELETE FROM server_election_votes WHERE election_at=?1 AND member_id=?2 AND cast_at<=?4
          AND ${progressSql('?2')}=?5
          AND NOT EXISTS(SELECT 1 FROM server_election_resets WHERE election_at=?1 AND member_id=?2 AND reset_id=?3)`)
          .bind(election,userId,resetId,resetAt,progress),
        db.prepare('INSERT OR IGNORE INTO server_election_resets(election_at,member_id,reset_id) SELECT ?1,?2,?3 WHERE '+progressSql('?2')+'=?4')
          .bind(election,userId,resetId,progress),
      ]);
    }
    return electionView(db,userId,schedule,roomCode,now);
  }
  if (body?.action !== 'vote' || !electionCandidates.has(body.candidate) ||
      (!Number.isSafeInteger(body.election)||(body.generation!==undefined&&!Number.isSafeInteger(body.generation))))
    return electionError('후보를 확인하고 다시 투표해 줘.');
  const {active} = schedule;
  if(!active||(body.election!==active.id&&body.election!==active.startsAt))
    return electionError('이번 선거 투표 시간이 끝났어.', 409);

  const vote = await db.prepare(`
    INSERT INTO server_election_votes (election_at, member_id, candidate, cast_at, room_code)
    SELECT ?1,?2,?3,?4,?6 WHERE ${progressSql('?2')}=?7 AND (?5 IS NULL OR ?5=(
      SELECT count(*) FROM server_election_resets WHERE election_at=?1 AND member_id=?2))
    ON CONFLICT(election_at, member_id) DO NOTHING
  `).bind(active.id, userId, body.candidate, now,body.generation??null,roomCode,progress).run();
  if (!vote.meta.changes) {
    const existing = await db.prepare(`
      SELECT candidate FROM server_election_votes WHERE election_at=? AND member_id=?
    `).bind(active.id, userId).first();
    if(!existing)return electionError('투표용지가 갱신됐어. 다시 골라 줘.',409);
    if (existing.candidate !== body.candidate) return electionError('이미 한 표를 던졌어.', 409);
  }
  return electionView(db, userId, schedule, roomCode, now);
}
