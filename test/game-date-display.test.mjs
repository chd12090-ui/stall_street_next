import test from 'node:test';
import assert from 'node:assert/strict';
import {openAtlasRoute,handleAtlas} from '../src/game/atlas.mjs';
import {handleBroker,selectSymbol} from '../src/game/broker.mjs';
import {gameDayStart} from '../src/game/clock-calendar.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';
const {MarketPage}=await loadJsx(new URL('../src/ui/exchange.jsx',import.meta.url));
const {AtlasPage}=await loadJsx(new URL('../src/ui/atlas.jsx',import.meta.url));
const atlasPage=state=>renderView(AtlasPage,{state});
const {FinanceBody}=await loadJsx(new URL('../src/ui/finance.jsx',import.meta.url));
import {ECON,dailyBonus,initial,nextDay,settle,stockValue,upgrade} from '../src/game/market.mjs';
const {AssetsPage,SettlementSummary}=await loadJsx(new URL('../src/ui/home.jsx',import.meta.url));
import {fmtMoney,symbolIndex} from '../src/game/world.mjs';
import {householdSnapshot} from '../src/game/status.mjs';

test('game dates agree across the map, quote screens and report archive',()=>{
  const state={...initial(),day:8,cursor:182,openingDay:5};
  const assets=renderView(AssetsPage,{state});
  const assetsHeader=assets.match(/<header[^>]*>(.*?)<\/header>/s)[1];
  assert.match(assetsHeader,/<h1>자산<\/h1>/);
  assert.doesNotMatch(assetsHeader,/data-act="chat-share"/);
  assert.match(assets,/<section class="st-statement"[^>]*>.*data-act="chat-share" data-kind="assets".*갚을 돈 합계/);
  assert.doesNotMatch(assetsHeader,/Day|KST|\d{2}:\d{2}/);
  assert.match(assets,/<h2>투자<\/h2>.*?<h2>소득<\/h2>.*?<h2>계좌 잔액<\/h2>/);
  assert.match(assets,/누적급여<\/dt><dd>0원<\/dd>/);
  assert.doesNotMatch(assets,/보유 종목 분석|내 분석 메모/);
  openAtlasRoute('arden');
  assert.match(atlasPage(state),/게임 정치 일정<\/small><time[^>]*>Day \d+/);
  handleAtlas('atlas-section',{dataset:{value:'news'}},state);
  const coverage=atlasPage(state);
  assert.match(coverage,/<em>Day 4<\/em>/);
  assert.doesNotMatch(coverage,/<em>[월화수목금토일] /);
  const report={
    issuedAt:gameDayStart(7)+60000,
    capturedAt:gameDayStart(7)-120000,
    botRoom:'bot-bid',positions:[],
    trades:[{code:'MOON',at:gameDayStart(7)-60000,qty:1,price:20000,currency:'KRW'}],
  };
  const reportPage=renderView(FinanceBody,{kind:'desk-spy',state,modal:{report}});
  assert.match(reportPage,/발급 · Day 3 00:01/);
  assert.match(reportPage,/Day 2 23:59/);
  assert.match(reportPage,/시작 1일 전 00:01 ~ Day 3/);
  assert.doesNotMatch(reportPage,/2026\.11/);
  const i=symbolIndex.VOLT;
  selectSymbol(i);
  const page=tab=>{
    handleBroker('bk-tab',{dataset:{value:tab}},state);
    return renderView(MarketPage,{state,assetId:i});
  };
  const history=page('history');
  assert.match(history,/<div class="bk-history-summary"><dl class="bk-ohlc">/);
  assert.match(history,/aria-pressed="true" aria-label="Day 4 가격 범위 보기">Day 4<\/button>/);
  assert.match(history,/aria-label="Day -1 가격 범위 보기">Day -1<\/button>/);
  assert.match(history,/aria-label="이전 페이지" disabled=""><i [^>]*class="ico i-down"/);
  assert.match(history,/aria-label="다음 페이지"><i [^>]*class="ico i-down"/);
  handleBroker('bk-page',{dataset:{value:'1'}});
  assert.match(page('history'),/<span aria-live="polite">2 \/ [\d,]+<\/span>/);
  const flow=page('flow');
  assert.match(flow,/<th scope="row">Day 4/);
  assert.doesNotMatch(flow,/누적 순매수 금액/);
  assert.match(page('info'),/<time class="bk-filing-label" dateTime="\d{4}-\d{2}-\d{2}" aria-hidden="true">\d{2}\.\d{2}<\/time>/i);
});

test('the asset statement previews the same bonus that settlement pays and totals only credited wages',()=>{
  const state={...initial(),day:2,history:[
    {day:0,bill:{income:114_286},dividends:[{amount:900,currency:'KRW'}]},
    {day:1,bill:{income:ECON.salary+45_000,bonus:45_000}},
  ]};
  const income=()=>renderView(AssetsPage,{state}).match(/<h2>소득<\/h2>(.*?)<\/section>/)?.[1];
  const bonus=dailyBonus(state),bonusLine=value=>'<dt>보너스</dt><dd>'+fmtMoney(value)+'</dd>';
  assert.ok(bonus>=ECON.salary*ECON.bonusMin&&bonus<=ECON.salary*ECON.bonusMax);
  assert.equal(dailyBonus(upgrade(JSON.parse(JSON.stringify(state)))),bonus);
  assert.match(income(),/<dt>일급<\/dt><dd>300,000원<\/dd>.*<dt>누적급여<\/dt><dd>459,286원<\/dd>/);
  assert.ok(income().includes(bonusLine(bonus)));
  settle(state);
  assert.equal(state.history.at(-1).bill.bonus,bonus);
  assert.ok(income().includes(bonusLine(bonus)));
  assert.ok(income().includes('<dt>누적급여</dt><dd>'+fmtMoney(459_286+ECON.salary+bonus)+'</dd>'));
  nextDay(state);
  assert.ok(income().includes(bonusLine(dailyBonus(state))));
  const report=day=>renderView(SettlementSummary,{state,day});
  assert.doesNotMatch(report(0),/<dt>그중 보너스<\/dt>/);
  assert.match(report(1),/<dt>그중 보너스<\/dt><dd>45,000원<\/dd>/);
  assert.ok(report(2).includes('<dt>그중 보너스</dt><dd>'+fmtMoney(bonus)+'</dd>'));
});

test('asset share totals reconcile even when a foreign balance sits just below half a won',()=>{
  const state={...initial(),cash:500_000_000_000,cursor:1};
  state.wallets.USD=389.99;
  const snapshot=householdSnapshot(state);
  assert.equal(snapshot.assetsTotal-snapshot.loanTotal,snapshot.net);
});

test('the asset overview pairs current investment profit with its return and shows dollars at face value',()=>{
  const state=initial(),page=()=>renderView(AssetsPage,{state});
  state.wallets.USD=.08;
  assert.match(page(),/<dt>외화 잔액<\/dt><dd>\$0\.08<\/dd>/);
  assert.doesNotMatch(page(),/달러 · USD/);
  assert.match(page(),/data-status-return="" class="">—<\/span>/);
  const item=symbolIndex.VOLT;
  state.holdings[item]=1;
  const value=stockValue(state);
  state.costsKRW[item]=value-2_142;
  const gain=(2_142/state.costsKRW[item]*100).toFixed(2);
  assert.ok(page().includes('class="st-rise">2,142원(+'+gain+'%)</span>'));
  state.costsKRW[item]=value+2_142;
  const loss=(-2_142/state.costsKRW[item]*100).toFixed(2);
  assert.ok(page().includes('class="st-fall">−2,142원('+loss+'%)</span>'));
});
