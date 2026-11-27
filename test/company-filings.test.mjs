import assert from 'node:assert/strict';
import test from 'node:test';
import {stocks,symbolIndex} from '../src/game/securities-data.mjs';
import {companyFilings,companyProfile,publicCompanyHistory,filingEventImpact} from '../src/game/company-filings.mjs';
import {journalForInterval} from '../src/game/company-events.mjs';
import {events} from '../src/game/world.mjs';

test('all listed and archived equity statements balance with traceable operating cash and inventory',()=>{
  for(const asset of stocks.filter(s=>s.kind==='주식')){
    const account=publicCompanyHistory(asset,4_980);
    assert.ok(account.profile.product,asset.code);
    assert.equal(account.history.length,9);
    for(const [index,filing] of account.history.entries()){
      const {opening,closing,income,cashflow,shares}=filing;
      assert.equal(closing.liabilities+closing.equity,closing.assets);
      assert.equal(income.revenue-income.costOfSales-income.sga,income.operatingProfit);
      assert.equal(income.operatingProfit+income.financialOther-income.tax,income.netIncome);
      assert.equal(opening.cash+cashflow.cfo+cashflow.cfi+cashflow.cff+cashflow.adjustments,closing.cash);
      assert.equal(income.netIncome+cashflow.noncash-cashflow.changeReceivables-cashflow.changeInventory+
        cashflow.changePayables+cashflow.otherOperating,cashflow.cfo);
      assert.equal(closing.equity,opening.equity+income.netIncome+cashflow.shareProceeds-cashflow.dividendsPaid);
      assert.equal(opening.ppe+cashflow.capex-income.depreciation-cashflow.soldBookValue,closing.ppe);
      assert.equal(opening.intangibles+cashflow.intangiblePurchases-income.amortization,closing.intangibles);
      assert.equal(opening.inventory+income.inventoryPurchases-income.inventoryConsumed,closing.inventory);
      assert.equal(opening.interestDebt+cashflow.borrowing+income.debtRevaluation,closing.interestDebt);
      assert.equal(shares.weightedAverage,opening.shares+shares.newShares/filing.period.days);
      assert.ok(cashflow.capex>=0&&income.costOfSales>=0&&closing.cash>=0&&income.inventoryPurchases>=0,filing.id);
      assert.ok(filing.events.every(e=>e.publishedTick<=e.recognizedTick&&e.recognizedTick<=filing.periodEndTick));
      if(index)assert.deepEqual(opening,account.history[index-1].closing);
    }
  }
});

test('statements appear only after closing and publication, independent of quote, account, UI and KST offset',async()=>{
  const tick=2*288+72,old=publicCompanyHistory('MOON',tick-1);
  const current=publicCompanyHistory('MOON',tick);
  assert.equal(current.current.publishedTick,tick);
  assert.notEqual(old.current.id,current.current.id);
  assert.ok(old.history.every(f=>f.publishedTick<tick));
  assert.deepEqual(old,publicCompanyHistory(symbolIndex.MOON,{day:2,cursor:71,holdings:[999],cash:1,price:1e9}));
  assert.deepEqual(current,publicCompanyHistory('MOON',{day:2,cursor:72+108,clockMode:'kst',cash:0}));
  assert.equal(current.previous,old.current);
  const historical=JSON.stringify(current);
  publicCompanyHistory('MOON',tick+10*1152);
  assert.equal(JSON.stringify(current),historical);
  assert.equal(JSON.stringify(publicCompanyHistory('MOON',tick)),historical);
  const fresh=await import('../src/game/company-filings.mjs?fresh-set-of-books');
  assert.equal(JSON.stringify(fresh.publicCompanyHistory('MOON',tick)),historical);
  assert.throws(()=>{current.current.income.revenue=1;},TypeError);
});

test('multiple outlets share one recognized journal entry and separate versioned developments',()=>{
  const first=events.find(e=>e.id==='m1-strait'),next=events.find(e=>e.id==='w1-convoy');
  const forecast={id:'forecast',tick:0,operatingDisclosure:{code:'MOON',type:'outlook',quantity:30,sign:1},shock:{MOON:.99}};
  const version1=filingEventImpact(first,'MOON'),version2=filingEventImpact(next,'MOON');
  assert.equal(version1.eventId,version2.eventId);
  assert.ok(version1.eventVersion<version2.eventVersion);
  const initial=journalForInterval([first,{...first,stories:[{id:'different-outlet'}]},forecast],0,100);
  assert.equal(initial.get('MOON').length,1);
  assert.deepEqual(initial.get('MOON'),journalForInterval([{...first,shock:{MOON:1e6}}],0,100).get('MOON'));
  assert.equal(journalForInterval([first],0,54).get('MOON'),undefined);
  assert.equal(filingEventImpact(forecast,'MOON'),null);
  assert.equal(filingEventImpact(events.find(e=>e.id==='m3-arden-rates'),'MOON'),null);
  assert.equal(filingEventImpact(first,'BIT'),null);
});

test('supply contract is received as an advance, recognized on acceptance, and does not bill twice',()=>{
  const repair=events.find(e=>e.id==='f1-yard-contract');
  const first=journalForInterval([repair],repair.tick,repair.tick+24).get('TIDE');
  assert.deepEqual(first.map(e=>e.account),['advance']);
  const later=journalForInterval([repair,repair],repair.tick+25,repair.tick+400).get('TIDE');
  assert.deepEqual(later.map(e=>e.account),['sale','advance']);
  assert.equal(first[0].fraction,-later[1].fraction);
  const closed=publicCompanyHistory('TIDE',3*1152).history;
  assert.ok(closed.some(filing=>filing.events.some(row=>row.eventId===repair.id)));
});

test('shares are common shares outstanding, bank books use loan/deposit entries and instruments select comparable peers',()=>{
  const peers=companyFilings('MOON',1_500);
  assert.ok(peers.peers.length>0);
  assert.ok(peers.peers.every(x=>x.asset.currency===peers.asset.currency&&x.profile.group===peers.profile.group&&x.current.period.end===peers.current.period.end));
  const flfx=publicCompanyHistory('FLFX',0).current;
  assert.equal(flfx.shares.end,stocks[symbolIndex.FLFX].shares);
  assert.notEqual(flfx.shares.end,stocks[symbolIndex.FLFX].floatShares);
  assert.equal(companyProfile('WFBK').financial,true);
  const bank=publicCompanyHistory('WFBK',1200).current;
  assert.ok(bank.closing.loansToCustomers>0&&bank.closing.customerDeposits>0&&bank.income.depositInterest>0);
  assert.equal(bank.closing.inventory,0);
  for(const code of ['HRIDX','BIT'])assert.deepEqual(publicCompanyHistory(code,1200).history,[]);
});

test('development funding, share issues and foreign currency remeasurement enter the proper journals',()=>{
  const flfx=publicCompanyHistory('FLFX',14*1152).history;
  const issue=flfx.find(f=>f.shares.newShares>0);
  assert.ok(issue);
  assert.ok(issue.shares.weightedAverage<issue.shares.end);
  assert.ok(issue.cashflow.shareProceeds>0);
  assert.equal(issue.shares.issueDate,issue.period.end);
  const files=publicCompanyHistory('BMEM',12*1152).history;
  assert.ok(files.some(f=>f.income.exportRevaluation!==0&&f.income.importRevaluation!==0&&f.income.debtRevaluation!==0));
  assert.ok(files.some(f=>f.cashflow.disposals>0&&f.cashflow.disposalGain!==f.cashflow.disposals));
  assert.equal(files[0].terms.fixedRate,files.at(-1).terms.fixedRate);
  assert.notEqual(files[0].terms.resetRate,files.at(-1).terms.resetRate);
});
