import test from 'node:test';
import assert from 'node:assert/strict';
import {initial} from '../src/game/market.mjs';
import {stocks,symbolIndex} from '../src/game/world.mjs';
import {fundFacts} from '../src/game/broker-data.mjs';
import {newsData,selectSymbol,valuationComparison} from '../src/game/broker.mjs';
import {analyzeCompany,financialHistory,getValuation} from '../src/game/analysis-metrics.mjs';
import {companyFilings,filingMarketTick,publicCompanyHistory} from '../src/game/company-filings.mjs';
import {quoteInfo} from '../src/game/tape.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';

test('broker facts and the equity analysis use the very same published earnings, price and book values',()=>{
  const state={...initial(),day:9,cursor:182}, index=symbolIndex.MOON;
  const facts=fundFacts(state,index),bundle=companyFilings(stocks[index],state);
  const model=analyzeCompany(bundle,{price:quoteInfo(state,index).price,quoteTick:filingMarketTick(state)});
  assert.ok(bundle.current.publishedLabel);
  assert.ok(facts.marketCap>0&&Number.isFinite(facts.book));
  for(const [key,id] of Object.entries({eps:'eps',pe:'pe',pb:'pb',book:'bps',yieldPct:'dividendYield',marketCap:'marketCap'})){
    assert.equal(facts[key],model.metrics[id].value);
  }
});

test('the financial overview compares published multiples and aggregates only completed fiscal years',()=>{
  const state=initial(),index=symbolIndex.BMEM,peer=symbolIndex.ARC;
  const bundle=publicCompanyHistory(index,state,16),valuation=getValuation(bundle,quoteInfo(state,index).price);
  const revenue=bundle.history.slice(-4).reduce((sum,filing)=>sum+filing.income.revenue,0);
  assert.equal(valuation.ps,valuation.marketCap/revenue);
  const publishedYear=bundle.history.slice(-4);
  const profit=publishedYear.reduce((sum,row)=>sum+row.income.commonIncome,0);
  const averageEquity=(publishedYear[0].opening.commonEquity+publishedYear.at(-1).closing.commonEquity)/2;
  assert.equal(valuation.roe,profit/averageEquity*100);
  const comparison=valuationComparison(state,index,bundle,'ps');
  const peerMultiple=getValuation(publicCompanyHistory(peer,state),quoteInfo(state,peer).price).ps;
  assert.deepEqual(comparison,{value:valuation.ps,eps:valuation.eps,average:peerMultiple,count:1});

  const quarterly=financialHistory(bundle);
  assert.equal(quarterly.length,5);
  const current=quarterly.at(-1),filing=bundle.current;
  assert.equal(current.eps,filing.income.commonIncome/filing.shares.weightedAverage);
  assert.equal(current.epsEstimate,filing.estimate.commonIncome/filing.opening.shares);
  assert.equal(current.revenueEstimate,filing.estimate.revenue);
  assert.ok(current.revenueEstimate>0);
  assert.notEqual(current.epsEstimate,current.eps);
  assert.equal(current.currentRatio,filing.closing.currentAssets/filing.closing.currentLiabilities*100);
  const annual=financialHistory(bundle,true);
  assert.deepEqual(annual.map(row=>[row.year,row.quarter]),[[2024,null],[2025,null]]);
  const year=bundle.history.filter(row=>row.period.year===2025);
  assert.equal(annual.at(-1).revenue,year.reduce((sum,row)=>sum+row.income.revenue,0));
  assert.equal(annual.at(-1).revenueEstimate,year.reduce((sum,row)=>sum+row.estimate.revenue,0));
  const fiscalDays=year.reduce((sum,row)=>sum+row.period.days,0);
  const estimateShares=year.reduce((sum,row)=>sum+row.opening.shares*row.period.days,0)/fiscalDays;
  assert.equal(annual.at(-1).epsEstimate,year.reduce((sum,row)=>sum+row.estimate.commonIncome,0)/estimateShares);
  assert.equal(annual.at(-1).debtRatio,year.at(-1).closing.liabilities/year.at(-1).closing.equity*100);
});

test('instrument information uses metric tiles and period switches, and the chart lists tagged stories below its controls',async()=>{
  const {InstrumentInfo}=await loadJsx(new URL('../src/ui/exchange-panels.jsx',import.meta.url));
  const {MarketPage}=await loadJsx(new URL('../src/ui/exchange.jsx',import.meta.url));
  const state={...initial(),day:9,cursor:182},index=symbolIndex.BMEM;
  const info=renderView(InstrumentInfo,{state,index});
  for(const label of ['투자 지표','가치평가지표','실적','재무','안정성']){
    assert.match(info,new RegExp('>'+label+'</h2>'));
  }
  assert.match(info,/>PER<.*>PBR<.*>PSR</);
  assert.match(info,/^<div class="bk-financials"><section[^>]*aria-labelledby="bk-investment-heading".*투자 지표<\/h2>.*시가총액.*배당수익률.*PBR.*PER.*ROE.*PSR.*가치평가지표<\/h2>/);
  const tiles=info.match(/<dl class="bk-investment-metrics">(.*?)<\/dl>/)[1];
  assert.equal(tiles.match(/<div>/g).length,6);
  assert.match(info,/>주당순이익<.*>매출</);
  assert.match(info,/>부채비율<.*>유동비율</);
  assert.match(info,/aria-label="실적 조회 기간".*?aria-pressed="true">분기<\/button>.*?aria-pressed="false">연간<\/button>/);
  assert.match(info,/<dl class="bk-filing-values bk-filing-pair"><div data-series="0"><dt>예상치<\/dt><dd>[^<]+<\/dd><\/div><div data-series="1"><dt>매출<\/dt>/);
  assert.match(info,/<b data-below="true"[^>]*>[\d.,]+%<\/b>/);
  assert.doesNotMatch(info.split('id="bk-stability"')[1],/bk-filing-values/);
  assert.doesNotMatch(info,/쉽게 분석|공급망과 사업 가정|분석 시작|재무를 읽는 여섯 질문|관련 뉴스|공시·근거함|상장 정보|signature\.webp|게임 내 공시|동종 종목 \d+개 비교|bk-company-intro|<select/);

  selectSymbol(index);
  const chart=renderView(MarketPage,{state,assetId:index});
  assert.doesNotMatch(chart,/data-value="news"/);
  assert.match(chart,/class="tf-tabs".*class="bk-chart-news".*?>소식<\/h2>/);
  assert.match(chart,/data-impact="positive"><span class="bk-story-impact-label">호재<\/span>/);
  assert.match(chart,/data-impact="negative"><span class="bk-story-impact-label">악재<\/span>/);
  const dates=[...chart.matchAll(/<span class="bk-story-meta"><small>(.*?)<\/small>/g)];
  assert.ok(dates.length>0);
  assert.ok(dates.every(([,date])=>/^Day -?\d+$/.test(date)));
  const inverse=newsData(state,symbolIndex.BMEMI2).find(({story})=>story.id==='dispatch-1058-0');
  assert.equal(inverse?.impact,'positive');
  const today={...state,openingDay:7,clockMode:'kst',day:9,cursor:82,wallMinute:410};
  const todayChart=renderView(MarketPage,{state:today,assetId:index});
  assert.match(todayChart,/data-value="dispatch-2555-0">(?:(?!<\/button>).)*<small>Day 3\(30분 전\)<\/small>/);
  assert.match(todayChart,/data-value="f3-payrolls-0">(?:(?!<\/button>).)*<small>Day -2<\/small>/);

  for(const code of ['USL2','USI2','AMIDX']){
    const etf=renderView(InstrumentInfo,{state,index:symbolIndex[code]});
    assert.match(etf,/^<div class="bk-financials"><section[^>]*aria-labelledby="bk-etf-heading"/);
    const [metrics,operation]=[...etf.matchAll(/<dl class="bk-investment-metrics[^"]*">(.*?)<\/dl>/g)].map(match=>match[1]);
    assert.equal(metrics.match(/<div>/g).length,6);
    assert.equal(operation.match(/<div>/g).length,4);
    assert.match(metrics,/>1좌당 NAV<.*>괴리율<.*>일간 추종 배수</);
    assert.match(operation,/>기초자산<.*>운용사<.*>운용자산<.*>발행 좌수</);
    assert.match(etf,/<summary[^>]*>(기초자산 보기|구성자산과 기준 비중)<\/summary>/);
  }
});

test('settlement uses a single date picker and a confirmation button',async()=>{
  const {SettlementSummary,SpendingBody,DayReview}=await loadJsx(new URL('../src/ui/home-reports.jsx',import.meta.url));
  const state=initial();
  const html=renderView(SettlementSummary,{state,notices:[]});
  assert.match(html,/class="day-paper-dialog day-centered"/);
  assert.match(html,/<header class="day-slip-head">.*?aria-label="닫기"/);
  assert.match(renderView(SpendingBody,{state}),/class="recent-payment-scroll"[^>]*role="region"[^>]*tabindex="0"/i);
  const review=renderView(DayReview,{state});
  assert.match(review,/data-act="settlement-history"[^>]*>.*지난 정산 보고서 보기/);
  assert.doesNotMatch(review,/지난 마감표 보기|분석 복기/);
  const record={day:4,netAssets:5_098_960,bill:{income:120_000,bonus:20_000,conversions:[{from:'USD',amount:1,cost:20,received:1_400}]},
    dividends:[{i:symbolIndex.MOON,amountKRW:4_000}],gains:11_000,liveSpending:{total:30_000},
    trades:[{i:symbolIndex.MOON,qty:-1,realizedKRW:3_000}],credit:{interestToday:150,paidToday:1_200},
    loanDesk:{interestToday:50,paidToday:500,upfrontInterestPaid:100}};
  const withHistory={...state,openingDay:2,day:8,history:[{day:2},record,{day:7}],fxLog:[{day:4,cost:250}],
    credit:{ledger:[{day:4,interest:100}]},loanDesk:{ledger:[{day:4,interest:30,upfrontInterest:100}]}};
  const report=renderView(SettlementSummary,{state:withHistory,day:4});
  assert.equal((report.match(/<select /g)||[]).length,1);
  assert.match(report,/<option value="4" selected="">Day 3<\/option>/);
  assert.match(report,/<div class="day-spending settlement-report"><div class="spent-total"><span>.*?순자산 합계<\/span><strong>5,098,960원<\/strong>/);
  assert.doesNotMatch(report,/정산일 소비 합계/);
  assert.match(report,/투자 손익<\/h3>/);
  assert.match(report,/<footer class="settlement-actions"><button[^>]+class="btn primary full" data-act="dismiss">확인<\/button><\/footer>/);
  assert.doesNotMatch(report,/마감 내역|다음 정산보고서|분석 복기/);
  assert.match(renderView(SettlementSummary,{state:withHistory}),/<option value="7" selected="">Day 6<\/option>/);
});

test('returning from company analysis reopens the original article with the selected impact company',async()=>{
  const {NewsPage}=await loadJsx(new URL('../src/ui/newspaper.jsx',import.meta.url));
  const state={...initial(),day:9,cursor:170};
  const articleId='m2-cold-vans-0';
  assert.doesNotMatch(renderView(NewsPage,{state}),/공시·근거함|분기 재무제표|nr-archive/);
  const fresh=renderView(NewsPage,{state,articleId});
  assert.doesNotMatch(fresh,/aria-label="영향을 살펴볼 종목"/);
  const restored=renderView(NewsPage,{state,articleId,articleView:{impactOpen:true,impactCode:'MART'}});
  assert.match(restored,/<details id="article-analysis" class="nr-evidence" open="" data-impact-code="MART">/);
  assert.match(restored,/<option value="MART" selected="">장터마트<\/option>/);
  assert.doesNotMatch(restored,/분석 메모|analysis-start/);
  assert.match(restored,new RegExp('data-act="analyze-article" data-value="'+articleId+'" data-id="'+symbolIndex.MART+'"'));
});
