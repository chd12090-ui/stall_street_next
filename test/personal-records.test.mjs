import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,drawCredit} from '../src/game/market.mjs';

const base='stall-street:personal-records:1',game='stall-street:pixel-week:1';
const rooms=['ABCD2345EFGH6789','BBCD2345EFGH6789'];
const marker='stall-street:guest:1:';
const articleId='t3-nova-power-2';

function memoryStorage(t,key){
  const values=new Map();
  const store={getItem:name=>values.get(name)??null,setItem:(name,value)=>values.set(name,String(value)),removeItem:name=>values.delete(name)};
  const original=Object.getOwnPropertyDescriptor(globalThis,key);
  Object.defineProperty(globalThis,key,{configurable:true,value:store});
  t.after(()=>original?Object.defineProperty(globalThis,key,original):delete globalThis[key]);
  return store;
}

test('private selections follow the active room and committed game through migration, reset and re-entry',async t=>{
  const store=memoryStorage(t,'localStorage');
  memoryStorage(t,'sessionStorage');
  const put=(key,value)=>store.setItem(key,JSON.stringify(value));
  const read=key=>JSON.parse(store.getItem(key));
  const guest='e18defbb-ad8e-419f-95c2-6a69cc800fee';
  store.setItem(marker+'identity',guest);
  t.mock.method(globalThis,'fetch',async(_url,options)=>{
    const {code}=JSON.parse(options.body);
    return Response.json({code,started:true,nickname:'테스트',participants:2});
  });

  const old=initial(),drawings={'1/W':[{tool:'level',points:[{key:430,v:43000}]}]};
  assert.equal(drawCredit(old,200000,()=>0.25),'');
  const application=old.credit.application;
  const option=application.offers[0];
  const signature=[application.day,application.step,application.amount,...application.offers.map(o=>o.id+'-'+o.aprBps)].join('/');
  put('stall-street:chart-settings:1',{calendar:2,priceScale:3,bitcoinCurrency:'USD',tf:'W',detailed:false,drawings});
  put('stall-street:newsroom:1',{pro:false,translated:[articleId]});
  put('stall-street:watchlist:1',['MOON','VOLT']);
  put('stall-street:credit-offer-choice:1',{key:signature,id:option.id});

  const {enterRoom,roomStorageKey}=await import('../src/game/room-session.mjs');
  await enterRoom({action:'join',code:rooms[0]});
  const {bindPersonalRecords}=await import('../src/game/personal-records.mjs');
  const chart=await import('../src/game/terminal.mjs'),discovery=await import('../src/game/discovery.mjs');
  const news=await import('../src/game/newsroom.mjs'),bank=await import('../src/game/credit-view.mjs');
  const oldRoom=roomStorageKey(base);
  const bind=state=>{put(roomStorageKey(game),state);bindPersonalRecords(state);};
  bind(old);
  assert.deepEqual([...discovery.watch],['MOON','VOLT']);
  assert.deepEqual(chart.chartDrawings(),drawings);
  assert.deepEqual(news.articleTranslationChoices(),[articleId]);
  assert.equal(bank.bankViewState(old).offer.id,option.id);
  assert.equal(read('stall-street:chart-settings:1').drawings,undefined);
  assert.equal(read('stall-street:newsroom:1').translateByDefault,false);
  assert.equal(store.getItem('stall-street:watchlist:1'),null);
  discovery.toggleWatch('VOLT');

  await enterRoom({action:'join',code:rooms[1]});
  bind(old);
  assert.deepEqual([...discovery.watch],[]);
  assert.deepEqual(chart.chartDrawings(),{});
  assert.equal(bank.bankViewState(old).offer,undefined);
  discovery.toggleWatch('VOLT');
  const otherRoom=roomStorageKey(base);
  assert.deepEqual(read(otherRoom).watch,['VOLT']);
  await enterRoom({action:'join',code:rooms[0]});
  bind(old);
  assert.deepEqual([...discovery.watch],['MOON']);
  const fresh={...old,resetId:crypto.randomUUID()};
  bind(fresh);
  assert.deepEqual(chart.chartDrawings(),{});
  assert.deepEqual([...discovery.watch],[]);
  assert.deepEqual(news.articleTranslationChoices(),[]);
  assert.equal(chart.chartView(fresh).detailed,false);
  assert.equal(bank.bankViewState(fresh).offer,undefined);
  assert.deepEqual(read(otherRoom).watch,['VOLT']);
  discovery.toggleWatch('VOLT');
  bindPersonalRecords(fresh);
  bindPersonalRecords(old); // A late previous-generation observer must not erase new favorites.
  assert.equal(read(oldRoom).run,fresh.resetId);
  assert.deepEqual([...discovery.watch],['VOLT']);

  const later={...old,resetId:crypto.randomUUID()};
  put(roomStorageKey(game),later);
  put(oldRoom,{run:later.resetId}); // A second tab has already committed another reset.
  discovery.toggleWatch('MOON');
  assert.deepEqual(read(oldRoom),{run:later.resetId});
  bindPersonalRecords(later);
  assert.deepEqual([...discovery.watch],[]);
});
