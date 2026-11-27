export const deskRequestId=id=>typeof id==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id);
export const spyFee=assets=>1_000_000+Math.round(Math.max(0,assets)*.005);
export const spyWindowMs=3*86_400_000;

export function reserveDeskCharge(state,pendingKey,pending){
  state.cash-=pending.cost;
  state.startWealth-=pending.cost;
  state.cashSequence=(state.cashSequence||0)+1;
  state[pendingKey]={...pending,day:state.day,step:state.cursor,seq:state.cashSequence};
}

export function finishDeskCharge(state,pendingKey,chargesKey,id,accepted){
  const pending=state[pendingKey];
  if(pending?.id!==id)return false;
  if(accepted){
    const {cost,day,step,seq}=pending;
    state[chargesKey]=[...(state[chargesKey]??[]),{id,cost,day,step,seq}];
  }else{
    state.cash+=pending.cost;
    state.startWealth+=pending.cost;
  }
  delete state[pendingKey];
  return true;
}
