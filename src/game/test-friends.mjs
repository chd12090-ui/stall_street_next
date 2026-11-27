import {actualTimestamp,gameTimestamp} from './clock-calendar.mjs';
import {finishIntimidation,intimidationCooldownDays,intimidationPoints,reserveIntimidation} from './desk-intimidation-state.mjs';

export const testFriends=[
  {name:'새벽호가',room:'bot-bid',mental:75,
    reply:'확인했어. 호가창 새로고침하고 있을게.'},
  {name:'반등기원',room:'bot-rebound',mental:85,
    reply:'좋아. 이번엔 진짜 반등일지도 몰라.'},
  {name:'분할매수',room:'bot-scale',mental:90,
    reply:'급하게 들어가진 않을게. 오늘 몫만 샀어.'},
  {name:'배당냥이',room:'bot-dividend',mental:80,
    reply:'나는 배당일에 맞춰 달력부터 확인할게.'},
  {name:'차트산책',room:'bot-chart',mental:70,
    reply:'방금 산책 끝났어. 이제 차트 좀 볼게.'},
];

export const testFriend=room=>testFriends.find(friend=>friend.room===room);

export function testFriendMental(state,friend){
  const mental=state.testFriendIntimidations?.[friend.room]?.mental;
  return Number.isInteger(mental)&&mental>=0&&mental<=100?mental:friend.mental;
}

export function testFriendNextAt(state,friend){
  const nextAt=state.testFriendIntimidations?.[friend.room]?.nextAt;
  return Number.isSafeInteger(nextAt)&&nextAt>0?nextAt:0;
}

export function intimidateTestFriend(state,friend,{id,cost,now}){
  if(testFriendNextAt(state,friend)>now)return null;
  const before=testFriendMental(state,friend);
  const after=Math.max(0,before-intimidationPoints);
  const nextAt=Math.ceil(actualTimestamp(gameTimestamp(now)+intimidationCooldownDays*86_400_000));
  reserveIntimidation(state,{id,cost});
  state.intimidationCharges=[...(state.intimidationCharges??[])];
  finishIntimidation(state,id,true);
  state.testFriendIntimidations={...state.testFriendIntimidations,[friend.room]:{mental:after,nextAt}};
  return {target:friend.room,before,after};
}
