import test from 'node:test';
import assert from 'node:assert/strict';
import {drawCredit,creditStatus,financialMood,initial,loadable,netWealth,placeOrder,reconcileFinancialMood,settle,takeCredit,takeDeskLoan} from '../src/game/market.mjs';
import {deskLoanBalance,rollDeskRate} from '../src/game/loan-desk.mjs';
import {startLive,syncLiveClock} from '../src/game/live-clock.mjs';
import {actualTimestamp,gameDayStart} from '../src/game/clock-calendar.mjs';
import {householdLedger,householdSnapshot} from '../src/game/status.mjs';
import {applyForRehabilitation,leaveRehabilitationSession,rehabilitationPosition,rehabilitationReward,rehabilitationView,startRehabilitationRound,stopRehabilitationRound} from '../src/game/rehabilitation.mjs';

const now=actualTimestamp(gameDayStart(8)+3_600_000);
function indebted(shortfall){
  const state=startLive(null,now);
  assert.equal(drawCredit(state,1_500_000,()=>0),'');
  assert.equal(takeCredit(state,0),'');
  state.cash=1_500_000-shortfall;
  reconcileFinancialMood(state);
  assert.equal(netWealth(state),0-shortfall);
  return state;
}
function begin(state,at,beginning=applyForRehabilitation){
  const previous=rehabilitationView(state);
  assert.ok(beginning(state,previous.token,at));
  const next=rehabilitationView(state);
  assert.notEqual(next.token,previous.token);
  assert.equal(next.stage,'playing');
  assert.ok(loadable(state));
  return next;
}
function stop(state,round,win){
  const target=(round.perfectStart+round.perfectEnd)/2;
  return stopRehabilitationRound(state,round.token,round.startedAt+(win?target*round.duration:0));
}

test('preview cannot clear balances at zero or positive net worth including holdings and foreign cash',()=>{
  for(const state of [initial(),indebted(0)]){
    const saved=structuredClone(state);
    assert.equal(rehabilitationView(state).stage,'preview');
    assert.equal(applyForRehabilitation(state,null,now),false);
    assert.equal(startRehabilitationRound(state,null,now),false);
    assert.equal(stopRehabilitationRound(state,null,now),null);
    assert.deepEqual(state,saved);
  }
  const state=indebted(100);
  assert.ok(rehabilitationView(state).canApply);
  assert.ok(!rehabilitationView(state).canStart);
  assert.equal(startRehabilitationRound(state,null,now),false);
  state.wallets.USD=1;
  assert.equal(rehabilitationView(state).stage,'preview');
  state.wallets.USD=0;
  state.holdings[0]=1;
  assert.equal(rehabilitationView(state).stage,'preview');
  assert.equal(applyForRehabilitation({...state,cash:0,phase:'closed'},null,now),false);
});

test('one confirmed application clears cash, foreign balances, holdings, orders and both loans in a single staged save',()=>{
  const state=indebted(200_000);
  assert.equal(rollDeskRate(state,()=>.3),'');
  assert.equal(takeDeskLoan(state,5_000_000),'');
  const appliedAt=now+3_600_000;
  syncLiveClock(state,appliedAt);
  const bankInterest=creditStatus(state).loan.interest,deskInterest=deskLoanBalance(state).interest;
  assert.ok(bankInterest>0&&deskInterest>0);
  state.cash=700_000;
  state.wallets.USD=123.45;
  state.holdings[0]=2;
  state.costs[0]=500_000;
  state.costsKRW[0]=500_000;
  assert.equal(placeOrder(state,0,-1,200_000),'');
  assert.equal(placeOrder(state,1,1,10_000),'');
  reconcileFinancialMood(state);
  const {assetsTotal,loanTotal}=householdSnapshot(state);
  const {profit}=financialMood(state);
  const before=structuredClone(state),staged={...state};
  assert.equal(applyForRehabilitation(staged,'stale-token',now),false);
  assert.deepEqual(staged,before);
  const round=begin(staged,appliedAt);
  assert.deepEqual(state,before);
  assert.equal(round.netWorth,0);
  const cleared=householdSnapshot(staged);
  assert.deepEqual([cleared.net,cleared.cash,cleared.foreignKRW,cleared.securities,cleared.assetsTotal,cleared.loanTotal],[0,0,0,0,0,0]);
  assert.ok(Object.values(staged.wallets).every(amount=>amount===0));
  assert.equal(staged.credit.loan,null);
  assert.equal(staged.credit.application,null);
  assert.equal(staged.loanDesk.loan,null);
  assert.deepEqual(staged.credit.ledger,before.credit.ledger);
  assert.deepEqual(staged.loanDesk.ledger,before.loanDesk.ledger);
  for(const field of ['holdings','costs','costsKRW','orders','orderFees']){
    assert.ok(staged[field].every(amount=>amount===0));
  }
  assert.ok(staged.orderPrices.every(price=>price===null));
  assert.ok(staged.orderTime.every(time=>time===null));
  assert.deepEqual(staged.cancelled.map(row=>[row.qty,row.reason]),[[-1,'회생으로 취소'],[1,'회생으로 취소']]);
  assert.deepEqual(financialMood(staged),{profit,debt:0,investmentPoints:0,debtPoints:0});
  assert.deepEqual(householdLedger(staged).find(row=>row.type==='rehabilitation-settlement').legs,
    [{currency:'KRW',amount:-700_000},{currency:'USD',amount:-123.45}]);
  assert.deepEqual(staged.rehabilitationSettlements[0],{day:staged.day,step:staged.cursor,seq:before.cashSequence+1,
    balances:{KRW:700_000,USD:123.45},assets:assetsTotal,debt:loanTotal});
  assert.equal(applyForRehabilitation(staged,null,now),false);
  assert.equal(staged.rehabilitationSettlements.length,1);
  settle(staged);
  const {credit,loanDesk}=staged.history.at(-1);
  assert.deepEqual([credit.total,loanDesk.total,credit.paidToday,loanDesk.paidToday],[0,0,0,0]);
  assert.deepEqual([credit.interestToday,loanDesk.interestToday],[bankInterest,deskInterest]);
});

test('pending charges finish before the clearance and old receipt balances are left intact on upgrade',()=>{
  const state=indebted(200_000),seq=++state.cashSequence;
  state.rehabilitation={stage:'won',round:1,token:'v51',wins:1,misses:0,day:state.day,startedAt:now-2000,stoppedAt:now-1000,lastResult:'won'};
  state.rehabilitationPayments=[{day:state.day,step:state.cursor,seq,amount:rehabilitationReward}];
  const restored=startLive(JSON.parse(JSON.stringify(state)),now);
  assert.equal(rehabilitationView(restored).stage,'ready');
  assert.equal(restored.cash,state.cash);
  assert.equal(stopRehabilitationRound(restored,'v51',now),null);
  for(const pending of ['ritualPending','spyPending','intimidationPending']){
    const charging={...restored,[pending]:{id:'pending-example'}};
    assert.equal(rehabilitationView(charging).waitingForPayment,true);
    assert.equal(applyForRehabilitation(charging,null,now),false);
    assert.equal(charging.cash,state.cash);
  }
  begin(restored,now);
  assert.equal(restored.cash,0);
  assert.deepEqual(restored.rehabilitationPayments,state.rehabilitationPayments);
  assert.equal(restored.rehabilitation,undefined);
});

test('each successful stop pays exactly once and continues from zero into positive funds',()=>{
  let state=indebted(1_000_000);
  const baseline=state.startWealth,profit=financialMood(state).profit;
  const one=begin(state,now),seq=state.cashSequence;
  assert.equal(rehabilitationPosition(now,one.duration,now),0);
  assert.equal(rehabilitationPosition(now,one.duration,now+one.duration),1);
  assert.equal(rehabilitationPosition(now,one.duration,now+1.5*one.duration),.5);
  assert.equal(stopRehabilitationRound(state,one.token,now-1),null);
  assert.equal(stopRehabilitationRound(state,'other-tab',now),null);
  assert.equal(stop(state,one,true),'won');
  assert.equal(stop(state,one,true),null);
  assert.equal(state.cash,rehabilitationReward);
  assert.equal(state.startWealth,baseline+rehabilitationReward);
  assert.equal(financialMood(state).profit,profit);
  assert.equal(state.rehabilitationPayments[0].seq,seq+1);
  state=startLive(JSON.parse(JSON.stringify(state)),now);
  const two=begin(state,now+1800,startRehabilitationRound);
  assert.ok(two.duration<one.duration);
  assert.ok(two.perfectEnd-two.perfectStart<one.perfectEnd-one.perfectStart);
  assert.equal(stopRehabilitationRound(state,one.token,now+2000),null);
  assert.equal(stop(state,two,true),'won');
  assert.equal(netWealth(state),1_000_000);
  assert.equal(state.rehabilitationSettlements.length,1);
  assert.deepEqual(state.rehabilitationPayments.map(row=>row.amount),[500_000,500_000]);
  assert.equal(rehabilitationView(state).wins,2);
  assert.ok(rehabilitationView(state).canStart);
  assert.ok(loadable(state));
});

test('a first miss grants one last chance, keeps winnings and closes only after a second miss',()=>{
  let state=indebted(1_500_000);
  const one=begin(state,now);
  assert.equal(stop(state,one,false),'lastChance');
  assert.equal(state.cash,0);
  state=startLive(structuredClone(state),now);
  const two=begin(state,now+2000,startRehabilitationRound);
  assert.equal(two.misses,1);
  assert.ok(two.duration<one.duration&&two.perfectEnd-two.perfectStart<one.perfectEnd-one.perfectStart);
  assert.equal(stop(state,two,true),'won');
  state=startLive(structuredClone(state),now);
  const three=begin(state,now+4000,startRehabilitationRound);
  assert.equal(stop(state,three,false),'exhausted');
  assert.equal(state.cash,500_000);
  assert.equal(startRehabilitationRound(state,three.token,now+5000),false);
  assert.equal(applyForRehabilitation(state,three.token,now+5000),false);
  syncLiveClock(state,actualTimestamp(gameDayStart(state.day+1)));
  assert.equal(rehabilitationView(state).stage,'preview');
  assert.equal(rollDeskRate(state,()=>.1),'');
  assert.equal(takeDeskLoan(state,5_000_000),'');
  state.cash=0;
  assert.ok(netWealth(state)<0);
  const view=rehabilitationView(state);
  assert.deepEqual([view.stage,view.round,view.wins,view.misses],['ready',1,0,0]);
  assert.equal(applyForRehabilitation(state,three.token,now+60_000),true);
  assert.equal(state.rehabilitationSettlements.length,2);
  assert.ok(loadable(state));
});

test('a restored moving marker pays only inside the displayed target, in either direction',()=>{
  const sample=begin(indebted(1_500_000),now);
  for(const direction of ['forward','backward']){
    for(const [position,expected] of [[sample.perfectStart-.01,'lastChance'],[sample.perfectStart+.01,'won'],
      [sample.perfectEnd-.01,'won'],[sample.perfectEnd+.01,'lastChance']]){
      const state=indebted(1_500_000);
      const active=begin(state,now);
      const saved=startLive(JSON.parse(JSON.stringify(state)),now+100);
      assert.deepEqual(rehabilitationView(saved),active);
      const stopAt=now+(direction==='forward'?position:2-position)*active.duration;
      const shown=rehabilitationPosition(active.startedAt,active.duration,stopAt);
      assert.ok(Math.abs(shown-position)<.000001);
      assert.equal(stopRehabilitationRound(saved,active.token,stopAt),expected);
      assert.equal(rehabilitationView(saved).stoppedAt,stopAt);
    }
  }
});

test('leaving an active application keeps only settled winnings and invalidates both controls across reloads',()=>{
  for(const stage of ['playing','won','lastChance']){
    let state=indebted(1_500_000);
    const first=begin(state,now);
    assert.equal(stop(state,first,true),'won');
    const round=stage==='won'?first:begin(state,now+1800,startRehabilitationRound);
    if(stage==='lastChance')assert.equal(stop(state,round,false),'lastChance');
    const {cash,cashSequence,rehabilitationPayments}=state;
    const before=rehabilitationView(state);
    assert.equal(before.stage,stage);
    assert.equal(before.canLeave,true);
    assert.equal(leaveRehabilitationSession(state,'stale-token'),false);
    assert.equal(leaveRehabilitationSession(state,round.token),true);
    assert.ok(loadable(state));
    state=startLive(JSON.parse(JSON.stringify(state)),now+2200);
    const after=rehabilitationView(state);
    assert.deepEqual([after.stage,after.wins,after.misses,after.round],['withdrawn',before.wins,before.misses,before.round]);
    assert.equal(after.canLeave,false);
    assert.equal(stop(state,round,true),null);
    assert.equal(startRehabilitationRound(state,round.token,now+4000),false);
    assert.equal(leaveRehabilitationSession(state,round.token),false);
    assert.equal(state.cash,cash);
    assert.equal(state.cashSequence,cashSequence);
    assert.deepEqual(state.rehabilitationPayments,rehabilitationPayments);
  }
});

test('difficulty ramps over the first fifteen rounds while older saved rounds keep their timing',()=>{
  const state=indebted(200_000);
  let active=begin(state,now);
  const interval=view=>view.duration*(view.perfectEnd-view.perfectStart);
  const centers=[];
  for(let i=2;i<=15;i++){
    const previous=active;
    assert.equal(stop(state,active,true),'won');
    active=begin(state,now+i*2000,startRehabilitationRound);
    assert.ok(active.duration<previous.duration&&interval(active)<interval(previous));
    assert.ok(active.perfectStart>0&&active.perfectEnd<1);
    centers.push((active.perfectStart+active.perfectEnd)/2);
  }
  assert.ok(interval(active)>=32&&interval(active)<35);
  assert.ok(new Set(centers).size>1);
  delete state.rehabilitationSession.timing;
  const restored=startLive(JSON.parse(JSON.stringify(state)),now);
  const old=rehabilitationView(restored);
  assert.equal(old.duration,430+1100/(1+.18*14));
  assert.equal((old.perfectStart+old.perfectEnd)/2,.5);
  assert.ok(interval(old)>2.5*interval(active));
  assert.equal(stop(restored,old,true),'won');
});
