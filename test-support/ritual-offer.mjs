import {gameTime} from '../src/game/clock-calendar.mjs';
import {initial} from '../src/game/market.mjs';
import {ritualQuote} from '../src/game/ritual.mjs';

export function ritualOffer(when,code='FLFX',ritualEvents=[]){
  const {day,cursor,minute,second}=gameTime(when);
  const state={...initial(),day,cursor,clockMode:'kst',wallMinute:minute,wallSecond:second,mental:50,ritualEvents};
  const {wealth,cost,quotedAt,mental,chance}=ritualQuote(state,code);
  return {id:crypto.randomUUID(),code,day,wealth,cost,quotedAt,mental,chance};
}
