export const fortuneSymbols={coupon:'ticket',shield:'shield',calm:'cup',meal:'lunch'};
export const fortuneRerollAdSeconds=5;
const hasDailyReroll=state=>state.phase==='open'&&Boolean(state.luck)&&!state.fortuneRerollUsed;
export const canUnlockFortuneReroll=state=>hasDailyReroll(state)&&!state.fortuneRerollReady;
export const canDrawFortune=(state,reroll=false)=>
  reroll?hasDailyReroll(state)&&state.fortuneRerollReady===true:state.phase==='open'&&!state.luck;
export function unlockFortuneReroll(state){
  if(!canUnlockFortuneReroll(state))return false;
  state.fortuneRerollReady=true;
  return true;
}
const kinds=Object.keys(fortuneSymbols);
export const idleGrid=[['coupon','shield','meal'],['calm','meal','coupon'],['shield','coupon','calm']];
// The six extra jackpot points come from single-line draws.
export const bingoOdds=[20,50,20,10];
export const bingoReductions=[0,15,25,50];
export const lineWins=grid=>grid.map((row,i)=>row.every(value=>value===row[0])?i:-1).filter(i=>i>=0);
export function spinGrid(symbol,random=Math.random,forcedLines=null){
  const chance=random()*100;
  let count=0,threshold=bingoOdds[0];
  while(count<bingoOdds.length-1&&chance>=threshold)threshold+=bingoOdds[++count];
  count=forcedLines??count;
  const reward=symbol??kinds[Math.floor(random()*kinds.length)];
  const order=[0,1,2];
  for(let i=order.length-1;i>0;i--){
    const j=Math.floor(random()*(i+1));
    [order[i],order[j]]=[order[j],order[i]];
  }
  const wins=order.slice(0,count).sort((a,b)=>a-b);
  const other=kinds.filter(kind=>kind!==reward);
  return [0,1,2].map(row=>{
    if(wins[0]===row)return Array(3).fill(reward);
    if(wins.includes(row))return Array(3).fill(other[(wins.indexOf(row)-1)%other.length]);
    const first=Math.floor(random()*kinds.length), different=1+Math.floor(random()*(kinds.length-1));
    return [kinds[first],kinds[(first+different)%kinds.length],kinds[Math.floor(random()*kinds.length)]];
  });
}
export function isFortuneGrid(grid){
  return Array.isArray(grid)&&grid.length===3&&grid.every(row=>Array.isArray(row)&&row.length===3&&row.every(cell=>kinds.includes(cell)));
}

export function fortuneGridFor(state){
  if(!state.luck)return null;
  let grid=state.fortuneGrid;
  if(!isFortuneGrid(grid)){
    // Before reels were saved a daily draw represented one winning symbol.
    if(!kinds.includes(state.luck))return null;
    grid=spinGrid(state.luck,()=>.2,1);
  }
  // The reels stop left to right. Reveal an existing pair before its odd symbol.
  return grid.map(row=>{
    const [left,center,right]=row;
    if(left===right)return [left,right,center];
    if(center===right)return [center,right,left];
    return row;
  });
}
export function bingoReduction(state){
  return state.luck==='bingo'&&state.fortuneGrid?bingoReductions[lineWins(state.fortuneGrid).length]:0;
}
