import {ECON, netWealth, rivals} from './market.mjs';
import {rehabilitationIncomeOnDay} from './status.mjs';
import {roomObservers} from './community.mjs';
import {fmtMoney} from './world.mjs';
import {usesKst,weekStart,weekdayIndex} from './clock-calendar.mjs';

export const won = value => fmtMoney(value, 'KRW');
export const signed = value => (value > 0 ? '+' : '') + won(value);
export const color = value => value > 0 ? 'gain' : value < 0 ? 'loss' : 'flat';
export const rate = profit => (profit > 0 ? '+' : '') + (100 * profit / ECON.initial).toFixed(2) + '%';
export const weekRecords=state=>usesKst(state)?state.history.filter(row=>row.day>=weekStart(state.day)):state.history;
export const badge = p => (p.tied ? '공동 ' : '') + p.rank + '위';
function closingWealth(state) {
  if (state.phase === 'closed') return netWealth(state);
  // These deposits adjust today's opening basis after the previous settlement.
  const refund = weekdayIndex(state.day) >= 5 ? state.discountToday : 0;
  return state.startWealth - (refund || 0) - rehabilitationIncomeOnDay(state,state.day);
}

export function ranking(state) {
  const records=weekRecords(state),count=records.length,last=records.at(-1);
  const settledDays=usesKst(state)?records.map(row=>row.day):null;
  const botDays=count?settledDays:[Math.max(0,state.day-1)];
  const self = {
    key:'self', name:'나', me:true,
    profit:records.reduce((sum, day) => sum + day.gains, 0),
    assets:count ? closingWealth(state) : null,
    debt:(last?.credit?.total||0)+(last?.loanDesk?.total||0)
  };
  // Before the player settles, the simulated bots can still show a completed session.
  const peers = rivals(count||1,botDays).map(({key,name,profit}) => ({
    key,name,profit, assets:ECON.initial+profit, debt:0
  }));
  const people = (count?[self,...peers]:peers).sort((a, b) => b.profit - a.profit);
  const ranked = people.map(person => ({
    ...person,
    rank:people.findIndex(p => p.profit === person.profit) + 1,
    tied:people.some(p => p.key !== person.key && p.profit === person.profit)
  }));
  return count?ranked:[...ranked,{...self,rank:null,tied:false}];
}

export function muralRoster(state) {
  return [...ranking(state),...roomObservers()];
}

export function findFriendProfile(state,key) {
  return muralRoster(state).find(person=>person.key===key);
}
