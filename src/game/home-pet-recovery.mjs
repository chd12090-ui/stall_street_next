const patsPerPoint=100, pointsPerDay=5;

export function validHomePetRecovery(state){
  const progress=state.petRecovery;
  return progress===undefined||!!progress&&Number.isSafeInteger(progress.day)&&progress.day<=state.day
    &&Number.isInteger(progress.pats)&&progress.pats>=0&&progress.pats<patsPerPoint
    &&Number.isInteger(progress.points)&&progress.points>=0&&progress.points<=pointsPerDay;
}

export function afterHomePat(state){
  if(state.phase!=='open')return null;
  const previous=state.petRecovery;
  const points=previous?.day===state.day?previous.points:0;
  if(points>=pointsPerDay)return null;
  const pats=((previous?.pats??0)+1)%patsPerPoint;
  const gain=pats===0&&state.mental<100?1:0;
  return {...state,mental:Math.min(100,state.mental+gain),petRecovery:{day:state.day,pats,points:points+gain}};
}
