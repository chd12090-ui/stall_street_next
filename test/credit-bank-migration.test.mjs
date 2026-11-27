import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,drawCredit,takeCredit,loadable,upgrade} from '../src/game/market.mjs';

test('renamed lender keeps older offers, outstanding loans and payment history usable',()=>{
  const state=initial();
  assert.equal(drawCredit(state,200000,()=>.25),'');
  const old=structuredClone(state);
  old.credit.application.offers[0].bank='한려생활은행';
  assert.equal(loadable(old),true);
  const restored=upgrade(old);
  assert.deepEqual(restored.credit,state.credit);
  assert.equal(takeCredit(restored,0),'');
  restored.credit.loan.bank='한려생활은행';
  restored.credit.ledger[0].bank='한려생활은행';
  assert.equal(loadable(restored),true);
  const active=upgrade(restored);
  assert.equal(active.credit.loan.bank,'한국생활은행');
  assert.equal(active.credit.ledger[0].bank,'한국생활은행');
  assert.equal(active.credit.loan.principal,200000);
  assert.equal(active.cash,restored.cash);
  assert.equal(upgrade(active),active);
});
