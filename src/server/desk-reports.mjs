import {deskRequestId,spyFee,spyWindowMs} from '../game/desk-charges.mjs';
import {gameTimestamp} from '../game/clock-calendar.mjs';
import {readChatBody} from './friend-chat.mjs';
import {progressChanged,progressSql} from './room-progress.mjs';

const spyPath='/api/desk-reports';
const spyReply=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
const spyError=(error,status=400)=>spyReply({error},status);
const positiveSafe=n=>Number.isFinite(n)&&n>0&&n<=Number.MAX_SAFE_INTEGER;
const spyCode=code=>typeof code==='string'&&/^[A-Z0-9]{1,12}$/.test(code);
const moneyInteger=n=>Number.isSafeInteger(n)&&n>=0;
const spySummaryCols='id, target_number AS friendNumber, issued_at AS issuedAt, cost';

async function storeTradingSnapshot(db,user,body,now,progressId){
  const {capturedAt,positions,trades}=body;
  const gameNow=gameTimestamp(now);
  if(!Number.isSafeInteger(capturedAt)||Math.abs(capturedAt-gameNow)>300_000||
     !Array.isArray(positions)||positions.length>256||!Array.isArray(trades))
    return spyError('거래 기록을 다시 동기화해 줘.');
  const codes=new Set(),holdings=[],fills=[];
  for(const row of positions){
    if(!spyCode(row?.code)||codes.has(row.code)||!positiveSafe(row.qty)||
      !Number.isFinite(row.average)||row.average<0||!moneyInteger(row.costKRW))return spyError('보유 종목을 확인해 줘.');
    codes.add(row.code);
    holdings.push({code:row.code,qty:row.qty,average:row.average,costKRW:row.costKRW});
  }
  for(const row of trades){
    if(!spyCode(row?.code)||!positiveSafe(Math.abs(row.qty))||typeof row.qty!=='number'||
      !Number.isSafeInteger(row.at)||row.at<capturedAt-spyWindowMs||row.at>capturedAt||
      !(row.price===null||positiveSafe(row.price))||typeof row.currency!=='string'||!/^[A-Z]{3}$/.test(row.currency))
      return spyError('체결 기록을 확인해 줘.');
    fills.push({at:row.at,code:row.code,qty:row.qty,price:row.price,currency:row.currency,forced:row.forced===true});
  }
  const stored=await db.prepare(`
    INSERT INTO friend_trading_snapshots (member_id,captured_at,positions,trades)
    SELECT ?1,?2,?3,?4 WHERE EXISTS (SELECT 1 FROM friend_room_members WHERE member_id=?1) AND ${progressSql('?1')}=?5
    ON CONFLICT(member_id) DO UPDATE SET captured_at=excluded.captured_at,positions=excluded.positions,trades=excluded.trades
    WHERE excluded.captured_at>=friend_trading_snapshots.captured_at
  `).bind(user,capturedAt,JSON.stringify(holdings),JSON.stringify(fills),progressId).run();
  if(!stored.meta.changes){
    const current=await db.prepare('SELECT '+progressSql('?1')+' AS id').bind(user).first();
    if(current.id!==progressId)return progressChanged(current.id);
  }
  return spyReply({ok:true});
}

async function storedSpyReport(db,user,id,floor){
  const record=await db.prepare(`SELECT ${spySummaryCols}, captured_at AS capturedAt, positions, trades
    FROM friend_spy_reports WHERE buyer_id=? AND id=? AND rowid>?`).bind(user,id,floor).first();
  if(!record)return null;
  return {...record,positions:JSON.parse(record.positions),trades:JSON.parse(record.trades)};
}

async function spyArchive(db,user,before,floor){
  const size=24;
  let cutoff='';
  const args=[user,floor];
  if(before){
    if(!deskRequestId(before))return spyError('보고서 위치를 확인해 줘.');
    const cursor=await db.prepare('SELECT issued_at FROM friend_spy_reports WHERE buyer_id=? AND id=? AND rowid>?').bind(user,before,floor).first();
    if(!cursor)return spyError('보고서 위치를 찾지 못했어.',404);
    cutoff=' AND (issued_at,id)<(?,?)';
    args.push(cursor.issued_at,before);
  }
  const {results}=await db.prepare(`SELECT ${spySummaryCols} FROM friend_spy_reports
    WHERE buyer_id=? AND rowid>?${cutoff} ORDER BY issued_at DESC,id DESC LIMIT ?`).bind(...args,size+1).all();
  const reports=results.slice(0,size);
  return spyReply({reports,next:results.length>size?reports.at(-1).id:null});
}

async function issueSpyReport(db,user,body,now,floor,progressId){
  const {id,room,buyerSlot,target,assets,available,cost}=body;
  if(!deskRequestId(id)||!Number.isSafeInteger(target)||target<1||!Number.isSafeInteger(buyerSlot)||buyerSlot<1||
     typeof room!=='string'||!/^[A-HJ-NP-Z2-9]{16}$/.test(room)||
     !moneyInteger(assets)||!moneyInteger(available)||available>assets||cost!==spyFee(assets)||available<cost)
    return spyError('친구와 발급 비용을 다시 확인해 줘.');
  const saved=await storedSpyReport(db,user,id,floor);
  if(saved)return spyReply(saved);

  const buyer=await db.prepare('SELECT 1 AS own FROM friend_room_members WHERE rowid=? AND member_id=?').bind(buyerSlot,user).first();
  if(!buyer)return spyError('구매를 시작한 친구방 계정으로 로그인해 줘.',401);

  const at=gameTimestamp(now);
  // The same insert freezes both the paid report and its unread anonymous notification.
  await db.prepare(`
    INSERT INTO friend_spy_reports
      (id,buyer_id,recipient_id,room_code,target_number,cost,issued_at,captured_at,positions,trades,notice_id)
    SELECT ?1,?2,m.member_id,m.room_code,
      (SELECT count(*) FROM friend_room_members n WHERE n.room_code=m.room_code AND n.rowid<=m.rowid),
      ?3,?4,p.captured_at,p.positions,
      (SELECT json_group_array(json(j.value)) FROM json_each(p.trades) j
       WHERE json_extract(j.value,'$.at') BETWEEN ?5 AND ?4),?6
    FROM friend_room_members m JOIN friend_trading_snapshots p ON p.member_id=m.member_id
    WHERE m.rowid=?7 AND m.room_code=?8 AND m.member_id<>?2
      AND ?9=(SELECT rowid FROM friend_room_members WHERE member_id=?2 ORDER BY visited_at DESC,rowid DESC LIMIT 1)
      AND EXISTS (SELECT 1 FROM friend_room_members b WHERE b.rowid=?9 AND b.room_code=m.room_code AND b.member_id=?2)
      AND p.captured_at<=?4 AND ${progressSql('?2')}=?10
    ON CONFLICT(id) DO NOTHING
  `).bind(id,user,cost,at,at-spyWindowMs,crypto.randomUUID(),target,room,buyerSlot,progressId).run();
  const report=await storedSpyReport(db,user,id,floor);
  return report?spyReply(report):spyError('친구방이나 거래 기록이 바뀌었어. 다시 선택해 줘.',409);
}

export async function serveDeskReports(request,db,now=Date.now(),member=null){
  const url=new URL(request.url);
  if(url.pathname!==spyPath)return spyError('지원하지 않는 요청이야.',404);
  const user=member?.id??request.headers.get('oai-authenticated-user-id');
  if(!user)return spyError('친구방 계정으로 로그인해 줘.',401);
  if(!db)return spyError('보고서 보관함에 연결하지 못했어.',503);
  const floor=member?.spyFloor??0, progressId=member?.progressId??'';
  if(request.method==='GET'){
    const id=url.searchParams.get('id');
    if(id===null)return spyArchive(db,user,url.searchParams.get('before'),floor);
    const report=deskRequestId(id)?await storedSpyReport(db,user,id,floor):null;
    return report?spyReply(report):spyError('이 보고서를 찾지 못했어.',404);
  }
  if(request.method!=='POST')return spyError('지원하지 않는 요청이야.',405);
  if(request.headers.get('sec-fetch-site')==='cross-site'||!request.headers.get('content-type')?.startsWith('application/json'))
    return spyError('게임에서 다시 선택해 줘.',403);
  const body=await readChatBody(request,1_500_000);
  if(body?.action==='sync')return storeTradingSnapshot(db,user,body,now,progressId);
  if(body?.action==='buy')return issueSpyReport(db,user,body,now,floor,progressId);
  if(body?.action==='ack'&&Array.isArray(body.ids)&&body.ids.length<=100&&body.ids.every(deskRequestId)){
    if(body.ids.length)await db.prepare(`UPDATE friend_spy_reports SET acknowledged_at=?1
      WHERE recipient_id=?2 AND acknowledged_at IS NULL AND notice_id IN (SELECT value FROM json_each(?3))
      AND rowid>?4 AND ${progressSql('?2')}=?5`
    ).bind(now,user,JSON.stringify(body.ids),floor,progressId).run();
    return spyReply({ok:true});
  }
  return spyError('보고서 요청을 확인해 줘.');
}
