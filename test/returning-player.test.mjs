import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {loadable, upgrade} from '../src/game/market.mjs';
import {startLive} from '../src/game/live-clock.mjs';
import {articleById,stocks} from '../src/game/world.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';

const oldGame = readFileSync(new URL('./fixtures/v74-returning-game.json', import.meta.url), 'utf8').trim();
const gameKey = 'stall-street:pixel-week:1';
const guest = 'e18defbb-ad8e-419f-95c2-6a69cc800fee';
const room = {code:'ABCD2345EFGH6789',nickname:'이전 주주',mode:'multiplayer',host:false,started:true,participants:3};
const scope = createHash('sha256').update(guest).digest('hex').slice(0,24);
const scoped = key => key + ':room:' + room.code + ':' + scope;
const savedAt = Date.parse('2026-11-19T01:35:00Z');
const articleId = 't3-nova-power-2';

function memoryStorage(t, name, values = {}) {
  const existing = Object.getOwnPropertyDescriptor(globalThis, name);
  const entries = new Map(Object.entries(values));
  const storage = {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: key => entries.delete(key),
  };
  Object.defineProperty(globalThis, name, {configurable:true,value:storage});
  t.after(() => existing ? Object.defineProperty(globalThis,name,existing) : delete globalThis[name]);
  return storage;
}

test('a returning v74 player reopens the pinned room with its muted game, debts, orders, fortune and chat intact', async t => {
  const otherRoom = {...room,code:'BBCD2345EFGH6789',scope};
  const thread = 'stall-street:friend-thread:2:bot-bid';
  const message = {content:'재접속 전 보낸 메시지',kind:'text',own:true,sentAt:savedAt - 5000};
  const store = memoryStorage(t,'localStorage',{
    'stall-street:guest:1:identity':guest,
    'stall-street:guest:1:room':JSON.stringify(otherRoom),
    [gameKey]:JSON.stringify({...JSON.parse(oldGame),cash:1,sound:true}),
    [scoped(gameKey)]:oldGame,
    [scoped(thread)]:JSON.stringify([message]),
  });
  memoryStorage(t,'sessionStorage',{'stall-street:guest:1:room':JSON.stringify({...room,scope})});
  t.mock.method(globalThis,'fetch',async (url,options)=>{
    assert.equal(url,'./api/rooms');
    assert.equal(options.method ?? 'GET','GET');
    assert.equal(options.headers.get('X-Stall-Guest'),guest);
    assert.equal(options.headers.get('X-Stall-Room'),room.code);
    return Response.json(room);
  });
  const session = await import('../src/game/room-session.mjs');
  assert.deepEqual(await session.restoreRoom(),room);
  const key = await session.migrateLegacyGame(gameKey,loadable);
  assert.equal(key,scoped(gameKey));
  assert.equal(store.getItem(key),oldGame);
  const previous = JSON.parse(store.getItem(key));
  assert.ok(loadable(previous));
  const game = startLive(upgrade(previous),savedAt,savedAt);
  for (const field of ['sound','resetId','cash','wallets','credit','loanDesk',
    'fills','fxLog','fortuneGrid','luck','liveSpending','cashSequence']) {
    assert.deepEqual(game[field],previous[field],field);
  }
  for(const [field,empty] of Object.entries({holdings:0,orders:0,costs:0,orderPrices:null})){
    assert.deepEqual(game[field].slice(0,previous[field].length),previous[field],field);
    assert.equal(game[field].length,stocks.length);
    assert.ok(game[field].slice(previous[field].length).every(value=>value===empty),field);
  }
  assert.equal(game.sound,false);
  assert.equal(game.loanDesk.loan.upfrontInterest,3760);
  const {SettingsBody,FortuneBody} = await loadJsx(new URL('../src/ui/extras.jsx',import.meta.url));
  const settings = renderView(SettingsBody,{state:game});
  assert.ok(settings.includes(room.nickname) && settings.includes(room.code));
  assert.match(settings,/<p class="settings-storage">내 플레이 기록은 따로 저장돼\.<\/p>/);
  const audioButton = settings.match(/<button[^>]+data-act="sound"[^>]*>.*?<\/button>/s)?.[0] ?? '';
  assert.match(audioButton,/aria-pressed="false"/);
  assert.match(audioButton,/꺼짐/);
  const fortune = renderView(FortuneBody,{state:game,modal:{}});
  assert.match(fortune,/1줄 빙고/);
  assert.match(fortune,/5초 광고 보고 다시뽑기/);
  assert.doesNotMatch(fortune,/data-act="sound"/);
  const {threadRows} = await import('../src/game/friend-threads.mjs');
  assert.deepEqual(threadRows('bot-bid',savedAt),[message]);
});

test('the chart, reader and watchlist restore v74 selections and write updates into the same keys', async t => {
  const chartKey = 'stall-street:chart-settings:1';
  const newsKey = 'stall-street:newsroom:1';
  const watchKey = 'stall-street:watchlist:1';
  const drawing = {tool:'trend',points:[{key:430,v:43000},{key:540,v:44500}]};
  const preset = {calendar:2,priceScale:3,bitcoinCurrency:'USD',indicatorLayout:2,
    detailed:false,stock:1,tf:'W',intradayFrame:'10',count:65,studies:{sma:{n:45,on:true}},drawings:{'1/W':[drawing]}};
  const store = memoryStorage(t,'localStorage',{
    [chartKey]:JSON.stringify(preset),
    [newsKey]:JSON.stringify({interpretationOn:false,translateByDefault:true,translationExceptions:[articleId]}),
    [watchKey]:JSON.stringify(['MOON','VOLT']),
  });
  const state = JSON.parse(oldGame);
  const chart = await import('../src/game/terminal.mjs?v74=chart');
  assert.equal(chart.chartView(state).detailed,false);
  chart.setChartDetail(true);
  const saved = JSON.parse(store.getItem(chartKey));
  for (const k of ['stock','tf','intradayFrame','count','drawings']) assert.deepEqual(saved[k],preset[k]);
  assert.deepEqual(saved.studies.sma,preset.studies.sma);
  assert.equal(saved.detailed,true);
  const reader = await import('../src/game/newsroom.mjs?v74=reader');
  const article = articleById(state,articleId);
  assert.equal(reader.language(article),'en');
  reader.newsAction('news-translation',{closest:()=>({dataset:{articleId}})},state);
  assert.equal(reader.language(article),'ko');
  assert.deepEqual(JSON.parse(store.getItem(newsKey)),{translateByDefault:true,translationExceptions:[]});
  const discovery = await import('../src/game/discovery.mjs?v74=watchlist');
  assert.deepEqual([...discovery.watch],['MOON','VOLT']);
  discovery.toggleWatch('MOON');
  assert.deepEqual(JSON.parse(store.getItem(watchKey)),['VOLT']);
});

test('old per-article translations keep their original language selection', async t => {
  const store = memoryStorage(t,'localStorage',{
    'stall-street:newsroom:1':JSON.stringify({pro:false,translated:[articleId]}),
  });
  const state = JSON.parse(oldGame);
  const reader = await import('../src/game/newsroom.mjs?v74=old-reader');
  assert.equal(reader.language(articleById(state,articleId)),'ko');
  assert.equal(reader.language(articleById(state,'w2-gas-storage-2')),'en');
  reader.newsAction('news-translation',{closest:()=>({dataset:{articleId}})},state);
  assert.equal(reader.language(articleById(state,articleId)),'en');
  assert.deepEqual(JSON.parse(store.getItem('stall-street:newsroom:1')),{
    translateByDefault:false,translationExceptions:[],
  });
});
