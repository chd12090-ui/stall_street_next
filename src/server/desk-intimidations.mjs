import {displayNickname} from '../game/nickname.mjs';
import {readChatBody} from './friend-chat.mjs';
import {progressSql} from './room-progress.mjs';
import {actualTimestamp,gameTime,gameTimestamp} from '../game/clock-calendar.mjs';
import {intimidationCooldownDays,intimidationFee,intimidationId,intimidationPoints} from '../game/desk-intimidation-state.mjs';

const intimidationPath='/api/intimidations';
const intimidationDayMs=86_400_000;
const intimidationCooldown=intimidationCooldownDays*intimidationDayMs;
const intimidationRoom=/^[A-HJ-NP-Z2-9]{16}$/;
const intimidationReply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const intimidationError=(error,status=400)=>intimidationReply({error},status);

const recentIntimidationRoom=`SELECT room_code FROM friend_room_members WHERE member_id=?1 ORDER BY visited_at DESC,rowid DESC LIMIT 1`;

async function viewIntimidations(db,user,now,floor,spyFloor){
  const [{results:members},{results:events},{results:recent},{results:spyNotices}]=await db.batch([
    db.prepare(`
      SELECT m.room_code AS room,m.rowid AS slot,m.member_id,m.nickname,(m.member_id=?1) AS own,(s.member_id IS NOT NULL) AS synced,
        (SELECT count(*) FROM friend_room_members p WHERE p.room_code=m.room_code AND p.rowid<=m.rowid) AS number
      FROM friend_room_members m LEFT JOIN friend_trading_snapshots s ON s.member_id=m.member_id
      WHERE m.room_code=(${recentIntimidationRoom})
      ORDER BY m.rowid
    `).bind(user),
    db.prepare(`
      SELECT id,created_at AS at,game_day AS day FROM friend_intimidations
      WHERE recipient_id=? AND rowid>? AND acknowledged_at IS NULL ORDER BY created_at,id LIMIT 100
    `).bind(user,floor),
    db.prepare(`
      SELECT recipient_id AS recipient,MAX(game_at) AS at FROM friend_intimidations
      WHERE sender_id=?1 AND game_at>?2 AND rowid>?3 GROUP BY recipient_id
    `).bind(user,gameTimestamp(now)-intimidationCooldown,floor),
    db.prepare('SELECT notice_id AS id FROM friend_spy_reports WHERE recipient_id=? AND rowid>? AND acknowledged_at IS NULL ORDER BY issued_at LIMIT 100').bind(user,spyFloor),
  ]);
  const nextAt=at=>Math.ceil(actualTimestamp(at+intimidationCooldown));
  const nextByRecipient=new Map(recent.map(row=>[row.recipient,nextAt(row.at)]));
  return intimidationReply({
    room:members[0]?.room??null,
    targets:members.filter(m=>!m.own).map(({slot,number,nickname,member_id})=>({
      slot,number,nickname:displayNickname(nickname,number),nextAt:nextByRecipient.get(member_id)??0
    })),
    selfSlot:members.find(m=>m.own)?.slot??null,
    spyReady:members.filter(m=>!m.own&&m.synced).map(m=>m.slot),
    spyNotices:spyNotices.map(n=>n.id),
    incoming:events.map(event=>({...event,points:intimidationPoints})),
    nextAt:recent.reduce((latest,row)=>Math.max(latest,nextAt(row.at)),0),
  });
}

function validIntimidationIntent(body){
  return intimidationId(body.id)&&intimidationRoom.test(body.room)&&Number.isSafeInteger(body.target)&&body.target>0&&
    Number.isSafeInteger(body.wealth)&&Number.isSafeInteger(body.available)&&body.available>=0&&
    Number.isSafeInteger(body.cost)&&body.cost===intimidationFee(body.wealth)&&body.available>=body.cost;
}
async function registeredIntimidation(db,user,id,floor){
  const row=await db.prepare(`
    SELECT nonce AS id,cost,game_at AS gameAt FROM friend_intimidations WHERE sender_id=? AND nonce=? AND rowid>?
  `).bind(user,id,floor).first();
  return row?intimidationReply({id:row.id,cost:row.cost,nextAt:Math.ceil(actualTimestamp(row.gameAt+intimidationCooldown))}):null;
}

async function submitIntimidation(db,user,body,now,floor,progressId){
  if(!validIntimidationIntent(body))return intimidationError('대상과 게임 원화 잔액을 확인해 줘.');
  const requested=await registeredIntimidation(db,user,body.id,floor);
  if(requested)return requested;

  const at=gameTimestamp(now),day=gameTime(now).day;
  await db.prepare(`
    INSERT INTO friend_intimidations (id,nonce,room_code,sender_id,recipient_id,cost,created_at,game_at,game_day)
    SELECT ?2,?3,m.room_code,?1,m.member_id,?6,?7,?8,?9
    FROM friend_room_members m
    WHERE m.rowid=?4 AND m.room_code=?5 AND m.member_id<>?1 AND m.room_code=(${recentIntimidationRoom})
      AND ${progressSql('?1')}=?12 AND NOT EXISTS (
        SELECT 1 FROM friend_intimidations WHERE sender_id=?1 AND recipient_id=m.member_id AND game_at>?10 AND rowid>?11
      )
    ON CONFLICT (sender_id,nonce) DO NOTHING
  `).bind(user,crypto.randomUUID(),body.id,body.target,body.room,body.cost,now,at,day,at-intimidationCooldown,floor,progressId).run();

  return await registeredIntimidation(db,user,body.id,floor)??intimidationError('아직 다시 이용할 수 없거나 친구방이 바뀌었어.',409);
}

async function acknowledgeIntimidations(db,user,ids,now,floor,progressId){
  if(!Array.isArray(ids)||ids.length>100||!ids.every(intimidationId))return intimidationError('처리한 기록을 확인해 줘.');
  if(ids.length)await db.prepare(`
    UPDATE friend_intimidations SET acknowledged_at=?3
    WHERE recipient_id=?1 AND acknowledged_at IS NULL AND id IN (SELECT value FROM json_each(?2))
      AND rowid>?4 AND ${progressSql('?1')}=?5
  `).bind(user,JSON.stringify(ids),now,floor,progressId).run();
  return intimidationReply({ok:true});
}

export async function serveDeskIntimidations(request,db,now=Date.now(),member=null){
  if(new URL(request.url).pathname!==intimidationPath)return intimidationError('지원하지 않는 요청이야.',404);
  const user=member?.id??request.headers.get('oai-authenticated-user-id');
  if(!user)return intimidationError('로그인한 계정으로 친구를 선택해 줘.',401);
  if(!db)return intimidationError('대부 창구에 연결하지 못했어.',503);
  const floor=member?.intimidationFloor??0,progressId=member?.progressId??'';
  if(request.method==='GET')return viewIntimidations(db,user,now,floor,member?.spyFloor??0);
  if(request.method!=='POST')return intimidationError('지원하지 않는 요청이야.',405);
  if(request.headers.get('sec-fetch-site')==='cross-site'||
    !request.headers.get('content-type')?.startsWith('application/json'))return intimidationError('게임에서 다시 선택해 줘.',403);
  const body=await readChatBody(request);
  if(body?.action==='send')return submitIntimidation(db,user,body,now,floor,progressId);
  if(body?.action==='ack')return acknowledgeIntimidations(db,user,body.ids,now,floor,progressId);
  return intimidationError('지원하지 않는 요청이야.');
}
