import {displayNickname} from '../game/nickname.mjs';
const chatPath = '/api/friends';
const chatAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const chatPattern = /^[A-HJ-NP-Z2-9]{16}$/;
const chatPageSize = 60;
const chatReply = (data, status=200) => Response.json(data, {
  status, headers:{'Cache-Control':'private, no-store'},
});
const chatError = (error,status=400) => chatReply({error},status);

function chatCode() {
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes,byte=>chatAlphabet[byte&31]).join('');
}

async function chatLatest(db, userId) {
  const room=await db.prepare(`
    SELECT room_code FROM friend_room_members WHERE member_id=? ORDER BY visited_at DESC, rowid DESC LIMIT 1
  `).bind(userId).first();
  return room?.room_code ?? '';
}

async function chatRoomView(db, code, userId, before=null) {
  const {results:roster}=await db.prepare(`
    SELECT row_number() OVER (ORDER BY rowid) AS number, nickname, member_id=?2 AS own
    FROM friend_room_members WHERE room_code=?1 AND EXISTS (
      SELECT 1 FROM friend_room_members WHERE room_code=?1 AND member_id=?2
    ) ORDER BY rowid
  `).bind(code,userId).all();
  if (!roster.length) return chatError('이 채팅방에 먼저 참여해 줘.',404);
  const members=roster.map(({number,nickname,own})=>({number,nickname:displayNickname(nickname,number),own:Boolean(own)}));
  const {results}=await db.prepare(`
    SELECT m.id, m.kind, m.content, m.amount, m.assets_total AS assetsTotal, m.debt_total AS debtTotal,
      m.sent_at AS sentAt, (m.author_id=?2) AS own,
      (SELECT count(*) FROM friend_room_members p WHERE p.room_code=?1 AND p.rowid<=a.rowid) AS sender
    FROM friend_messages m
    JOIN friend_room_members a ON a.room_code=m.room_code AND a.member_id=m.author_id
    WHERE m.room_code=?1 AND (?3 IS NULL OR m.id<?3) ORDER BY m.id DESC LIMIT ?4
  `).bind(code,userId,before,chatPageSize+1).all();
  const messages=results.slice(0,chatPageSize).reverse().map(({assetsTotal,debtTotal,...message})=>({
    ...message,...(assetsTotal!==null&&debtTotal!==null&&{assetsTotal,debtTotal}),
    senderName:members[message.sender-1]?.nickname,
  }));
  return chatReply({code,participants:members.length,members,messages,earlier:results.length>chatPageSize});
}

async function chatCreate(db, userId, now) {
  const current=await chatLatest(db,userId);
  if (current) return chatRoomView(db,current,userId);
  await db.batch([
    db.prepare('INSERT INTO friend_rooms (code,host_id,created_at) VALUES (?,?,?) ON CONFLICT(host_id) DO NOTHING').bind(chatCode(),userId,now),
    db.prepare(`
      INSERT OR IGNORE INTO friend_room_members (room_code,member_id,joined_at,visited_at)
      SELECT code, ?1, ?2, ?2 FROM friend_rooms WHERE host_id=?1
    `).bind(userId,now),
  ]);
  const joined=await chatLatest(db,userId);
  return joined ? chatRoomView(db,joined,userId) : chatError('채팅방을 만들지 못했어.',503);
}

async function chatJoin(db, code, userId, now) {
  await db.prepare(`
    INSERT INTO friend_room_members (room_code,member_id,joined_at,visited_at)
    SELECT code, ?2, ?3, ?3 FROM friend_rooms WHERE code=?1 AND game_mode IS NULL AND host_id NOT LIKE 'room/%'
    ON CONFLICT(room_code,member_id) DO UPDATE SET visited_at=excluded.visited_at
  `).bind(code,userId,now).run();
  return chatRoomView(db,code,userId);
}

function chatMessage(body) {
  const {kind,nonce,amount,assetsTotal,debtTotal}=body;
  const fields=['action','kind','nonce','content','amount','assetsTotal','debtTotal'];
  if (Object.keys(body).some(key=>!fields.includes(key)) ||
      typeof nonce!=='string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(nonce) ||
      typeof body.content!=='string') return null;
  const content=body.content.trim();
  if (amount!==null && amount!==undefined && (kind!=='assets' || !Number.isSafeInteger(amount) || Math.abs(amount)>1e12)) return null;
  if ((assetsTotal!==undefined||debtTotal!==undefined)&&
      (kind!=='assets'||!Number.isSafeInteger(assetsTotal)||!Number.isSafeInteger(debtTotal)||
       assetsTotal<0||debtTotal<0||amount!==assetsTotal-debtTotal)) return null;
  if (kind==='text' && content.length>0 && content.length<=600) return {kind,nonce,content};
  if (kind==='news' && /^[a-z0-9][a-z0-9-]{1,79}$/.test(content)) return {kind,nonce,content};
  if (kind==='stock' && /^[A-Z0-9]{1,12}$/.test(content)) return {kind,nonce,content};
  if ((kind==='market'||kind==='assets') && !content) return {kind,nonce,content,amount,assetsTotal,debtTotal};
  return null;
}

async function chatSend(db, code, userId, now, body) {
  const message=chatMessage(body);
  if (!message) return chatError('메시지나 공유할 항목을 확인해 줘.');
  await db.prepare(`
    INSERT INTO friend_messages (room_code,author_id,nonce,kind,content,amount,sent_at,assets_total,debt_total)
    SELECT room_code, member_id, ?3, ?4, ?5, ?6, ?7, ?8, ?9
    FROM friend_room_members WHERE room_code=?1 AND member_id=?2
    ON CONFLICT(room_code,author_id,nonce) DO NOTHING
  `).bind(code,userId,message.nonce,message.kind,message.content,message.amount??null,now,
    message.assetsTotal??null,message.debtTotal??null).run();
  return chatRoomView(db,code,userId);
}

export async function readChatBody(request,maxBytes=8192) {
  if (!request.body) return null;
  const reader=request.body.getReader(), decoder=new TextDecoder();
  let size=0, payload='';
  try {
    for (;;) {
      const {done,value}=await reader.read();
      if (done) break;
      size+=value.byteLength;
      if (size>maxBytes) { await reader.cancel(); return null; }
      payload+=decoder.decode(value,{stream:true});
    }
    const body=JSON.parse(payload+decoder.decode());
    return body && typeof body==='object' && !Array.isArray(body) ? body : null;
  } catch { return null; }
}

export async function serveFriendChat(request, db, now=Date.now(), member=null) {
  const url=new URL(request.url), {pathname,searchParams}=url;
  const code=pathname.slice(chatPath.length+1);
  if (pathname!==chatPath&&!chatPattern.test(code)) return chatError('초대 링크를 확인해 줘.',404);
  if(member&&code&&code!==member.code)return chatError('현재 방의 친구 채팅을 열어 줘.',403);
  const userId=member?.id??request.headers.get('oai-authenticated-user-id');
  if (!userId) return chatError('로그인한 계정으로 채팅에 참여할 수 있어.',401);
  if (!db) return chatError('채팅 저장소에 연결하지 못했어.',503);

  if (request.method==='GET') {
    const selected=code||member?.code||await chatLatest(db,userId);
    const before=searchParams.get('before');
    if (before!==null&&(!/^\d{1,15}$/.test(before)||Number(before)<1)) return chatError('메시지 위치를 확인해 줘.');
    return selected ? chatRoomView(db,selected,userId,before===null?null:Number(before)) : chatReply({code:null,messages:[],earlier:false});
  }
  if (request.method!=='POST') return chatError('지원하지 않는 요청이야.',405);
  if (request.headers.get('sec-fetch-site')==='cross-site'||
      !request.headers.get('content-type')?.startsWith('application/json')) return chatError('게임에서 요청을 다시 보내 줘.',403);
  const body=await readChatBody(request);
  if (!body) return chatError('메시지는 텍스트나 게임 공유만 보낼 수 있어.');
  if (!code && body.action==='create') return member?chatRoomView(db,member.code,userId):chatCreate(db,userId,now);
  if (!code) return chatError('채팅방을 먼저 열어 줘.');
  if (body.action==='join') return member?chatRoomView(db,code,userId):chatJoin(db,code,userId,now);
  if (body.action==='send') return chatSend(db,code,userId,now,body);
  return chatError('지원하지 않는 채팅 요청이야.');
}
