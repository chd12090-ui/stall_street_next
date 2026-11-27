import {roomStorageKey} from './room-session.mjs';
import {testFriend,testFriends} from './test-friends.mjs';

export const reactions={
  cheer:{name:'응원',icon:'heart'},
  clap:{name:'축하',icon:'spark'},
  sorry:{name:'유감',icon:'drop'},
  tease:{name:'조롱',icon:'cup'},
};
const keyPrefix='stall-street:friend-thread:2:';
const legacyKey=()=>roomStorageKey('stall-street:sample-chats:1');
let runSuffix='',boundRoom='';
const threadKey=room=>roomStorageKey(keyPrefix+room)+runSuffix;

export function bindBotThreads(state){
  const nextRoom=roomStorageKey(keyPrefix);
  const nextSuffix=state.roomProgressId?':run:'+state.resetId:'';
  if(boundRoom===nextRoom&&runSuffix===nextSuffix)return;
  if(nextSuffix){
    // v120 conversations used the room key. Only the player's reset retires them.
    try{
      for(const friend of testFriends){
        const base=roomStorageKey(keyPrefix+friend.room);
        localStorage.removeItem(base);
        if(boundRoom===nextRoom&&runSuffix&&runSuffix!==nextSuffix)localStorage.removeItem(base+runSuffix);
      }
      localStorage.removeItem(legacyKey());
    }catch{}
  }
  fallback.clear();
  boundRoom=nextRoom;
  runSuffix=nextSuffix;
}
const fallback=new Map();
const kindSet=new Set(['text','reaction','market','stock','news','assets']);
const starts={
  'bot-bid':[
    [48,false,'어제 걸어 둔 주문, 아침에 보니까 체결됐더라.'],
    [43,true,'나도 체결 내역부터 봐야겠다.'],
    [17,false,'응. 난 지금 달밤물류 호가창 보는 중이야.'],
  ],
  'bot-rebound':[
    [164,false,'장 열리면 뭐부터 봐?'],
    [151,true,'나는 밤사이 나온 기사부터 읽어.'],
    [124,false,'나도 오늘은 신문부터 펼쳐 봤어. 전력주 기사 봤어?'],
  ],
  'bot-scale':[
    [83,false,'오늘은 한국지수 조금만 담았어.'],
    [59,false,'남은 돈은 내일 가격 보고 쓸 거야.'],
  ],
  'bot-dividend':[
    [96,false,'나 배당 준다는 공시만 보면 저장해 둬.'],
    [36,false,'이번엔 달력 날짜도 확인했어.'],
  ],
  'bot-chart':[
    [26,false,'동네 한 바퀴 돌고 왔는데 차트가 아까랑 다르네.'],
    [8,false,'창 닫기 전에 오늘 시세만 적어 둘게.'],
  ],
};
const replies={
  'bot-bid':['응, 보고 있어.','나도 방금 주문 내역 열어봤어.','잠깐 자리 비웠다 왔어. 계속 얘기해.'],
  'bot-rebound':['응, 듣고 있어.','나도 그 생각 했어.','조금 더 보고 얘기하자.'],
  'bot-scale':['나는 한 번에 다 사는 것보다 나눠 사는 게 편하더라.','오늘 살 몫은 이 정도면 됐어.'],
  'bot-dividend':['응, 그 종목 공시도 확인해 볼게.','배당 날짜 바뀌면 또 알려 줘.'],
  'bot-chart':['잠깐만, 차트에서 어디쯤인지 찾아볼게.','방금 봤어. 어제 가격도 궁금하네.'],
};
const reactionReplies={cheer:'고마워. 힘난다!',clap:'고마워!',sorry:'마음 써 줘서 고마워.',tease:'두고 봐. 다음엔 내가 웃을걸.'};
function read(key){
  try{return JSON.parse(localStorage.getItem(key));}catch{return null;}
}
function persist(room,rows){
  fallback.set(room,rows);
  try{localStorage.setItem(threadKey(room),JSON.stringify(rows));return true;}catch{return false;}
}
function valid(row){
  return row&&kindSet.has(row.kind)&&typeof row.content==='string'&&Number.isSafeInteger(row.sentAt)&&
    row.sentAt>=0&&row.sentAt<=8.64e15&&(row.kind!=='reaction'||Object.hasOwn(reactions,row.content));
}
function replyFor(friend,message,count){
  if(message.kind==='reaction')return reactionReplies[message.content];
  if(message.kind!=='text')return message.kind==='stock'?'종목 열어봤어. 차트도 같이 볼게.':'보내 준 거 열어봤어.';
  if(/안녕|반가/.test(message.content))return '안녕! 오늘 장도 같이 보자.';
  if(/고마|감사/.test(message.content))return '별말을. 또 얘기하자.';
  return replies[friend.room][count%replies[friend.room].length];
}
function migrateThreads(now){
  const legacy=runSuffix?null:read(legacyKey());
  let stored=true;
  for(const friend of testFriends){
    const room=friend.room;
    if(Array.isArray(read(threadKey(room))))continue;
    if(fallback.has(room)){stored=persist(room,fallback.get(room))&&stored;continue;}
    const old=(Array.isArray(legacy?.[room])?legacy[room]:[]).filter(valid);
    const start=old.length?Math.min(now,old[0].sentAt):now;
    const rows=starts[room].map(([minutes,own,content])=>({kind:'text',own,content,sentAt:Math.max(0,start-minutes*60000)}));
    for(const row of old)rows.push({...row,own:true},{kind:'text',own:false,content:row.kind==='text'?friend.reply:'공유 카드 열어봤어.',sentAt:row.sentAt});
    stored=persist(room,rows)&&stored;
  }
  if(legacy&&stored){try{localStorage.removeItem(legacyKey());}catch{}}
}
export function threadRows(room,now=Date.now()){
  if(!testFriend(room))return [];
  const rows=read(threadKey(room));
  if(Array.isArray(rows))return rows.filter(valid);
  migrateThreads(now);
  return fallback.get(room)??[];
}
export async function sendBotChat(room,message,now=Date.now()){
  const friend=testFriend(room);
  if(!friend||!message||typeof message.content!=='string')return {};
  const content=message.content.trim(),sentAt=now;
  if(!valid({...message,content,sentAt})||message.kind==='text'&&(!content||content.length>600))return {};
  const startedKey=threadKey(room);
  const write=()=>{
    if(threadKey(room)!==startedKey)return {};
    const rows=threadRows(room,now);
    const own={kind:message.kind,content,own:true,sentAt};
    if(message.kind==='assets'&&Number.isSafeInteger(message.amount)){
      own.amount=message.amount;
      if(Number.isSafeInteger(message.assetsTotal)&&Number.isSafeInteger(message.debtTotal)){
        own.assetsTotal=message.assetsTotal;
        own.debtTotal=message.debtTotal;
      }
    }
    const reply={kind:'text',content:replyFor(friend,own,rows.filter(row=>row.own).length),own:false,sentAt};
    const updated=[...rows,own,reply];
    if(!persist(room,updated)){
      fallback.set(room,rows);
      return {error:'메시지를 저장하지 못했어. 다시 보내 줘.'};
    }
    return {changed:true,sent:true};
  };
  return globalThis.navigator?.locks?navigator.locks.request(startedKey,write):write();
}
export function presence(rows,now=Date.now()){
  const last=rows.findLast(row=>!row.own);
  if(!last)return '';
  const minutes=Math.max(0,Math.floor((now-last.sentAt)/60000));
  return minutes<3?'접속 중':minutes<60?minutes+'분 전 접속':Math.floor(minutes/60)+'시간 전 접속';
}
export const threadForStorage=key=>testFriends.find(friend=>threadKey(friend.room)===key)?.room??null;
