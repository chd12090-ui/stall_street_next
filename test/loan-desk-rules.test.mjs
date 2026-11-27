import test from 'node:test';
import assert from 'node:assert/strict';
import {actualTimestamp,gameDayStart} from '../src/game/clock-calendar.mjs';
import {startLive} from '../src/game/live-clock.mjs';
import {deskLoanBalance,deskLoanQuote,deskLoanRequestError,rollDeskRate} from '../src/game/loan-desk.mjs';
import {exchange,loadable,netWealth,nextDay,repayDeskLoan,settle,takeDeskLoan} from '../src/game/market.mjs';
import {householdLedger} from '../src/game/status.mjs';
import {closedAmounts} from '../src/game/day-report.mjs';

const morning=actualTimestamp(gameDayStart(8)+10*3600_000);

test('two d20s produce 2% to 40%, and a saved draw survives reload until the player rolls again',()=>{
  const low=startLive(null,morning),high=startLive(null,morning);
  for(const amount of [1,105_003,50_000_000])assert.equal(deskLoanRequestError(high,amount),'');
  for(const invalid of [-1,0,1.5,50_000_001])assert.notEqual(deskLoanRequestError(high,invalid),'');
  assert.equal(rollDeskRate(low,()=>0),'');
  assert.deepEqual(low.loanDesk.rateDice,[1,1]);
  assert.equal(deskLoanQuote(low,100_000).aprBps,200);
  const samples=[.6,.95];
  assert.equal(rollDeskRate(low,()=>samples.shift()),'');
  assert.deepEqual(low.loanDesk.rateDice,[13,20]);

  assert.equal(rollDeskRate(high,()=>1-Number.EPSILON),'');
  assert.deepEqual(high.loanDesk.rateDice,[20,20]);
  assert.deepEqual(deskLoanQuote(high,50_000_000),{amount:50_000_000,aprBps:4000,upfrontInterest:10_000_000,dailyInterest:54795});
  assert.equal(loadable(high),true);
  assert.equal(loadable({...high,loanDesk:{...high.loanDesk,rateDice:[20,21]}}),false);

  const resumed=startLive(structuredClone(high),morning);
  assert.deepEqual(resumed.loanDesk.rateDice,[20,20]);
  assert.equal(rollDeskRate(resumed,()=>0),'');
  assert.deepEqual(resumed.loanDesk.rateDice,[1,1]);
  assert.equal(rollDeskRate(resumed,()=>1-Number.EPSILON),'');
  assert.equal(takeDeskLoan(resumed,50_000_000),'');
  assert.equal(resumed.loanDesk.rateDice,undefined);
  assert.equal(deskLoanBalance(resumed).aprBps,4000);
  assert.equal(loadable(resumed),true);
  assert.notEqual(repayDeskLoan(resumed,60_000_000),'');
  resumed.cash+=5_000_000;
  assert.equal(repayDeskLoan(resumed,60_000_000),'');
  assert.equal(rollDeskRate(resumed,()=>0),'');
  assert.deepEqual(resumed.loanDesk.rateDice,[1,1]);
});

test('older dice draws and pre-dice debts keep their original rates when loaded',()=>{
  const state=startLive(null,morning);
  assert.equal(rollDeskRate(state,()=>0),'');
  state.loanDesk.rateDice=[2,10];
  assert.equal(loadable(state),true);
  const resumed=startLive(structuredClone(state),morning);
  assert.equal(deskLoanQuote(resumed,500_000).aprBps,1200);
  assert.equal(takeDeskLoan(resumed,500_000),'');
  assert.equal(loadable(resumed),true);
  assert.equal(deskLoanBalance(startLive(structuredClone(resumed),morning)).aprBps,1200);

  const beforeFee=structuredClone(resumed);
  delete beforeFee.loanDesk.loan.upfrontInterest;
  assert.equal(loadable(beforeFee),true);
  const olderDice=startLive(structuredClone(beforeFee),morning);
  assert.equal(deskLoanBalance(olderDice).total,500_000);
  delete beforeFee.loanDesk.loan.dice;
  beforeFee.loanDesk.loan.aprBps=1000;
  assert.equal(loadable(beforeFee),true);
  const legacy=startLive(beforeFee,morning);
  assert.equal(deskLoanBalance(legacy).aprBps,1000);
  assert.equal(deskLoanBalance(legacy).principal,500_000);
  assert.equal(repayDeskLoan(legacy,500_000),'');
});

test('the one-time fee is collected at repayment and survives a partial payment and reload',()=>{
  const state=startLive(null,morning),amount=1_000_000,opening=state.cash;
  assert.equal(rollDeskRate(state,()=>.45),'');
  assert.equal(takeDeskLoan(state,amount),'');
  assert.equal(state.cash,opening+amount);
  assert.equal(netWealth(state),opening-100_000);
  assert.equal(repayDeskLoan(state,40_000),'');
  assert.equal(state.loanDesk.ledger.at(-1).principal,0);
  assert.equal(deskLoanBalance(state).upfrontInterest,60_000);
  assert.equal(loadable(state),true);

  const noon=actualTimestamp(gameDayStart(8)+12*3600_000);
  const resumed=startLive(structuredClone(state),noon);
  const {upfrontInterest,interest,total}=deskLoanBalance(resumed);
  assert.equal(upfrontInterest,60_000);
  assert.ok(interest>0);
  const beforeRepayment=netWealth(resumed);
  assert.equal(repayDeskLoan(resumed,total),'');
  assert.equal(netWealth(resumed),beforeRepayment);
  assert.equal(resumed.loanDesk.loan,null);
  assert.deepEqual(resumed.loanDesk.ledger.slice(1).map(row=>[row.principal,row.interest,row.upfrontInterest]),[
    [0,0,40_000],[amount,interest,60_000],
  ]);
  assert.equal(repayDeskLoan(resumed,1),'갚을 대출이 없어.');
  const rows=householdLedger(resumed).filter(row=>row.type==='upfront-interest');
  assert.deepEqual(rows.map(row=>row.legs[0].amount),[-60_000,-40_000]);
  settle(resumed);
  const receipt=resumed.history.at(-1),closing=netWealth(resumed);
  assert.equal(receipt.loanDesk.interestToday,interest);
  assert.equal(receipt.loanDesk.upfrontInterestPaid,100_000);
  assert.equal(receipt.netAssets,closing);
  nextDay(resumed);
  assert.equal(exchange(resumed,'KRW','USD',700_000),'');
  assert.equal(closedAmounts(resumed,receipt).netAssets,closing);
  // Older receipts must also resolve against the saved position at that close.
  delete receipt.netAssets;
  assert.equal(closedAmounts(resumed,receipt).netAssets,closing);
});
