import {displayNickname,validNickname,nicknameHint} from '../game/nickname.mjs';
import {serveRoomProgress,repairLegacyRitual,progressChanged} from './room-progress.mjs';
import {serveRituals} from './rituals.mjs';
import {serveElections} from './elections.mjs';
import {readChatBody,serveFriendChat} from './friend-chat.mjs';
import {serveDeskReports} from './desk-reports.mjs';
import {serveDeskIntimidations} from './desk-intimidations.mjs';

const roomAlphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const roomPattern=/^[A-HJ-NP-Z2-9]{16}$/;
const guestUuid=/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const roomResponse=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export const roomError=(error,status,reason)=>roomResponse(reason?{error,reason}:{error},status);
const normalizedCode=code=>typeof code==='string'?code.toUpperCase().replace(/[\s-]/g,''):'';

async function roomDigest(value){
  return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
}

async function roomIdentity(request){
  const secret=request.headers.get('x-stall-guest');
  const account=request.headers.get('oai-authenticated-user-id');
  if(secret!==null&&!guestUuid.test(secret))return null;
  if(!secret&&!account)return null;
  const bytes=await roomDigest(secret?'guest/'+secret.toLowerCase():'account/'+account);
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}

async function roomContext(db,code,identity){
  const id='room/'+code+'/'+identity;
  // Rooms created before the start gate have no mode and were playable immediately.
  const member=await db.prepare(`SELECT m.nickname,COALESCE(r.game_mode,'multiplayer') AS mode,
    r.host_id=m.member_id AS host,(r.game_mode IS NULL OR r.started_at IS NOT NULL) AS started,
    COALESCE(r.started_at,r.created_at) AS openedAt,COALESCE(g.reset_id,'') AS progressId,
    COALESCE(g.ritual_floor,0) AS ritualFloor,g.ritual_repair_id AS ritualRepairId,COALESCE(g.intimidation_floor,0) AS intimidationFloor,
    COALESCE(g.spy_floor,0) AS spyFloor,
    (SELECT COUNT(*) FROM friend_room_members p WHERE p.room_code=m.room_code AND p.rowid<=m.rowid) AS number,
    (SELECT COUNT(*) FROM friend_room_members p WHERE p.room_code=m.room_code) AS participants
    FROM friend_room_members m JOIN friend_rooms r ON r.code=m.room_code
    LEFT JOIN room_member_progress g ON g.member_id=m.member_id
    WHERE m.room_code=? AND m.member_id=?`).bind(code,id).first();
  return member?{
    ...member,id,code,nickname:displayNickname(member.nickname,member.number),
    host:Boolean(member.host),started:Boolean(member.started),
  }:null;
}

function roomStatus({code,nickname,mode,host,participants,started,progressId}){
  return roomResponse({code,nickname,mode,host,participants,started,...(progressId?{progressId}:{})});
}

async function startGameRoom(db,code,identity,now){
  const member=await roomContext(db,code,identity);
  if(!member)return roomError('이 방에 먼저 참가해 줘.',403);
  if(!member.host)return roomError('방장만 게임을 시작할 수 있어.',403,'host_only');
  if(member.started)return roomStatus(member);
  await db.prepare(`UPDATE friend_rooms SET started_at=?1
    WHERE code=?2 AND host_id=?3 AND started_at IS NULL AND game_mode='multiplayer'
      AND EXISTS (SELECT 1 FROM friend_room_members WHERE room_code=?2 AND member_id<>?3)`)
    .bind(now,code,member.id).run();
  const current=await roomContext(db,code,identity);
  if(!current.started)return roomError('친구가 한 명 이상 참가하면 시작할 수 있어.',409,'waiting_for_players');
  return roomStatus(current);
}

async function enterGameRoom(request,db,identity,now){
  if(request.headers.get('sec-fetch-site')==='cross-site'||!request.headers.get('content-type')?.startsWith('application/json'))
    return roomError('게임에서 방에 들어가 줘.',403);
  const body=await readChatBody(request);
  if(body?.action==='start'){
    const code=normalizedCode(request.headers.get('x-stall-room'));
    if(!roomPattern.test(code))return roomError('플레이할 방을 먼저 골라 줘.',403);
    return startGameRoom(db,code,identity,now);
  }
  if(!body||!['create','join','guest'].includes(body.action))return roomError('방 만들기, 참가하기 또는 게스트 모드를 골라 줘.',400);
  const nickname=typeof body.nickname==='string'?body.nickname.trim().normalize('NFC'):(body.nickname??'');
  if(!validNickname(nickname))return roomError(nicknameHint,400);
  const create=body.action!=='join';
  const mode=body.action==='guest'?'guest':'multiplayer';
  let code;
  if(create){
    if(!guestUuid.test(body.requestId??''))return roomError('방 만들기를 다시 시도해 줘.',400);
    const bytes=await roomDigest(body.action+'/'+identity+'/'+body.requestId.toLowerCase());
    code=Array.from(bytes.slice(0,16),b=>roomAlphabet[b&31]).join('');
  }else{
    code=normalizedCode(body.code);
    if(!roomPattern.test(code))return roomError('방 코드 16자리를 확인해 줘.',400);
  }
  const id='room/'+code+'/'+identity;
  const statements=[];
  if(create)statements.push(db.prepare(`INSERT INTO friend_rooms(code,host_id,created_at,game_mode,started_at)
    VALUES(?,?,?,?,?) ON CONFLICT(code) DO NOTHING`).bind(code,id,now,mode,mode==='guest'?now:null));
  statements.push(db.prepare(`INSERT INTO friend_room_members(room_code,member_id,joined_at,visited_at,nickname)
    SELECT code,?2,?3,?3,?4 FROM friend_rooms WHERE code=?1 AND host_id LIKE 'room/%'
      AND COALESCE(game_mode,'multiplayer')=?6 AND (?5=0 OR host_id=?2)
    ON CONFLICT(room_code,member_id) DO UPDATE SET visited_at=excluded.visited_at,
      nickname=CASE WHEN excluded.nickname='' THEN friend_room_members.nickname ELSE excluded.nickname END`)
    .bind(code,id,now,nickname,create?1:0,mode));
  await db.batch(statements);
  const member=await roomContext(db,code,identity);
  if(!member||member.mode!==mode)return roomError(create?'방을 만들지 못했어. 다시 시도해 줘.':'방을 찾지 못했어. 코드를 확인해 줘.',create?409:404);
  return roomStatus(member);
}

export async function serveGameApi(request,db,now=Date.now()){
  const {pathname}=new URL(request.url);
  const rooms=pathname==='/api/rooms';
  const hasRoom=request.headers.has('x-stall-room');
  let member=null;
  if(rooms||hasRoom||request.headers.has('x-stall-guest')){
    if(!db)return roomError('게임 서버에 연결하지 못했어.',503);
    const identity=await roomIdentity(request);
    if(!identity)return roomError('게스트로 다시 입장해 줘.',401);
    if(rooms&&request.method==='POST')return enterGameRoom(request,db,identity,now);
    if(rooms&&request.method!=='GET')return roomError('지원하지 않는 요청이야.',405);
    const code=normalizedCode(request.headers.get('x-stall-room'));
    if(!roomPattern.test(code))return roomError('플레이할 방을 먼저 골라 줘.',403);
    member=await roomContext(db,code,identity);
    if(!member)return roomError('이 방에 먼저 참가해 줘.',403);
    if(rooms)return roomStatus(member);
    if(!member.started)return roomError('방장이 게임을 시작할 때까지 기다려 줘.',409,'room_not_started');
  }
  if(pathname==='/api/progress/ritual-repair')return repairLegacyRitual(request,db,now,member);
  if(pathname==='/api/progress/reset')return serveRoomProgress(request,db,now,member);
  if(member&&['/api/rituals','/api/elections','/api/desk-reports','/api/intimidations'].includes(pathname)&&
    (request.headers.get('x-stall-progress')??'initial')!==(member.progressId||'initial'))return progressChanged(member.progressId);
  if(pathname==='/api/friends'||pathname.startsWith('/api/friends/'))
    return serveFriendChat(request,db,now,member);
  if(pathname==='/api/elections'||pathname.startsWith('/api/elections/'))
    return serveElections(request,db,now,member);
  if(pathname==='/api/intimidations')return serveDeskIntimidations(request,db,now,member);
  if(pathname==='/api/rituals')return serveRituals(request,db,now,member);
  if(pathname==='/api/desk-reports')return serveDeskReports(request,db,now,member);
  return roomError('요청을 찾지 못했어.',404);
}
