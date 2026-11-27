import test from 'node:test';
import assert from 'node:assert/strict';
import {ECON,dailyBonus,estimateDailySpending,grossAssets,initial,netWealth,reconcileFinancialMood,takeDeskLoan} from '../src/game/market.mjs';
import {rollDeskRate} from '../src/game/loan-desk.mjs';
import {characterPoses,handOrigins,whenHomePoseReady,petDuration} from '../src/game/player-character.mjs';
import {setBankDesk} from '../src/game/credit-view.mjs';
import {negotiateSalary} from '../src/game/salary-negotiation.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';
const {BankPage,DeskPage,FinanceBody}=await loadJsx(new URL('../src/ui/finance.jsx',import.meta.url));
const {HomePage,HomeCharacter,AssetsPage,MentalBody,DayReview}=await loadJsx(new URL('../src/ui/home.jsx',import.meta.url));
import {fmtMoney} from '../src/game/world.mjs';

test('home updates headlines, day and fortune while keeping the same artwork and pet target',()=>{
  const state={...initial(),day:0,openingDay:0,mental:75}, options={latest:{id:'old',title:'이전 기사',category:'stock'}};
  const home=()=>renderView(HomePage,{state,options});
  const salaryDue=/data-act="salary-negotiation"[^>]*data-today-action=""/;
  const fortuneDue=/data-act="fortune"[^>]*data-today-action=""/;
  const before=home();
  assert.match(before,salaryDue);
  assert.match(before,fortuneDue);
  assert.ok(negotiateSalary(state,10,()=>.99));
  state.luck='bingo';
  const completed=home();
  assert.doesNotMatch(completed,salaryDue);
  assert.doesNotMatch(completed,fortuneDue);
  state.day++;state.luck=null;state.phase='closed';
  assert.doesNotMatch(home(),/data-today-action=""/);
  state.phase='open';
  assert.match(home(),fortuneDue);
  state.luck='bingo';options.latest={id:'next',title:'새 기사',category:'market'};
  const after=home();
  assert.match(after,salaryDue);
  const figure=html=>html.match(/<figure class="pov-character-stage">.*?<\/figure>/)?.[0];
  assert.ok(figure(before)?.includes('data-act="pet-cat"'));
  assert.equal(figure(before),figure(after));
  assert.match(after,/data-pov-day="">Day 2</);
  assert.match(after,/data-pov-fortune="">운세 확인</);
  assert.match(after,/data-act="article" data-value="next"/);
  assert.match(after,/data-headline="">새 기사</);
  assert.match(after,/data-act="spending"[^>]*><span[^>]*><i[^>]+i-receipt[^>]*><\/i><b>오늘 소비<\/b>/);
  assert.match(after,/<button[^>]+data-act="salary-negotiation"[^>]*><i[^>]+i-salary-raise[^>]*><\/i><span>연봉협상<\/span><\/button><button[^>]+data-tab="election"/);
  assert.doesNotMatch(after,/analysis-archive|분석 메모/);
});

test('the home widgets follow their column order and the net assets match the statement',()=>{
  const state=initial();
  assert.equal(rollDeskRate(state,()=>0),'');
  assert.equal(takeDeskLoan(state,1_000_000),'');
  assert.ok(netWealth(state)<grossAssets(state));
  const home=renderView(HomePage,{state,options:{}});
  const assets=renderView(AssetsPage,{state,view:'overview'});
  const amount=fmtMoney(netWealth(state));
  const netCard=home.match(/data-tab="assets">(.+?)<\/button>/)?.[1]??'';
  assert.match(netCard,/i-coin[^>]*><\/i><b>내 순자산<\/b>/);
  assert.ok(netCard.includes('data-pov-net="">'+amount));
  assert.ok(assets.includes('data-status-net="">'+amount));
  assert.match(home,/class="pov-time".*?class="pov-budget-stack".*?data-tab="assets".*?data-act="spending"/);
  assert.match(home,/data-act="settings".*?data-act="mental".*?data-act="salary-negotiation"/);
  const gauge=home.match(/<svg class="pov-mental-gauge"[^>]*>.*?<\/svg>/)[0];
  assert.equal(gauge.match(/<rect /g).length,15);
  assert.equal(gauge.match(/fill="currentColor"/g).length,11);
});

test('pose transitions wait for the drawing and the current stroke and cancel stale loads',async t=>{
  const requests=[];
  t.mock.timers.enable({apis:['setTimeout']});
  class TestImage{constructor(){requests.push(this);}}
  const previous=Object.getOwnPropertyDescriptor(globalThis,'Image');
  Object.defineProperty(globalThis,'Image',{value:TestImage,configurable:true});
  t.after(()=>previous?Object.defineProperty(globalThis,'Image',previous):delete globalThis.Image);
  let current=characterPoses[1],petting=true;
  const next=characterPoses.at(-1);
  const cancel=whenHomePoseReady(next,()=>petting,pose=>{current=pose;});
  assert.equal(requests.length,1);
  assert.equal(current.id,'2');
  assert.match(requests[0].src,/pose-5\.svg$/);
  requests[0].onload();
  assert.equal(current.id,'2');
  petting=false;
  t.mock.timers.tick(petDuration);
  assert.equal(current.id,'5');
  const html=renderView(HomeCharacter,{pose:current});
  assert.ok(html.includes('viewBox="0 0 184 172"'));
  assert.ok(html.includes(`translate(${handOrigins[next.id].join(' ')})`));
  assert.ok(html.includes(`--cat-support:${next.support.join('px ')}px`));
  assert.ok(html.includes('aria-description="'+next.alt+'"'));
  cancel();
  const cancelled=whenHomePoseReady(characterPoses[2],()=>false,pose=>{current=pose;});
  const loaded=requests[1].onload;
  cancelled();loaded();t.mock.timers.tick(petDuration);
  assert.equal(current.id,'5');
});

test('both desks keep their stable scene separate from bank navigation and changing loan controls',()=>{
  const state=initial();
  const bank=()=>renderView(BankPage,{state});
  const deskArt=page=>page.match(/<div class="desk-pet-stage".*?<\/svg><button[^>]*data-act="pet-desk-cat"[^>]*><\/button><\/div><\/div>/)?.[0];
  try{
    setBankDesk('menu');
    const menu=bank(),art=deskArt(menu);
    assert.ok(art);
    assert.match(menu,/class="detail-back counter-back" data-act="tab" data-tab="assets" aria-label="뒤로가기"/);
    assert.doesNotMatch(menu,/>자산으로</);
    assert.match(menu,/data-act="bank-loan"[^>]*><i[^>]*class="ico i-loan"><\/i><span>대출하기<\/span>/);
    assert.match(menu,/data-act="rehabilitation" aria-haspopup="dialog"><i[^>]*class="ico i-ddakji"><\/i><span>회생신청<\/span>/);
    assert.match(menu,/data-act="fx"><i[^>]*class="ico i-exchange"><\/i><span>환전<\/span>/);
    assert.doesNotMatch(menu,/계좌 조회|미리보기/);
    setBankDesk('history');
    const history=bank();
    assert.equal(deskArt(history),art);
    assert.match(history,/class="detail-back counter-back" data-act="tab" data-tab="credit" aria-label="뒤로가기"/);
    assert.match(history,/대출 거래/);
    setBankDesk('account');
    assert.equal(bank(),menu);
  }finally{setBankDesk('menu');}
  const page=renderView(DeskPage,{state}),panel=renderView(FinanceBody,{state,kind:'desk-loan'});
  assert.match(page,/class="detail-back counter-back" data-act="tab" data-tab="assets" aria-label="뒤로가기"/);
  assert.doesNotMatch(page,/>자산으로</);
  assert.match(page,/data-act="desk-loan"><i[^>]*class="ico i-loan"><\/i><span>대출하기<\/span>/);
  assert.match(page,/data-act="desk-intimidation"[^>]*><i[^>]*class="ico i-intimidate"><\/i><span>협박하기<\/span>/);
  assert.match(page,/data-act="desk-spy"[^>]*><i[^>]*class="ico i-spy"><\/i><span>염탐하기<\/span>/);
  assert.match(panel,/data-loan-stage="amount"/);
  assert.doesNotMatch(panel,/loan-desk-scene/);
});

test('the mental sheet keeps the same controls as its live score, rate and recovery availability change',()=>{
  const state=initial(), draw=()=>renderView(MentalBody,{state});
  const initialBody=draw();
  const slip=initialBody.match(/<dl class="lab-slip".*?<\/dl>/)[0];
  assert.deepEqual([...slip.matchAll(/<dt>([^<]+)<\/dt>/g)].map(match=>match[1]),
    ['기본 정신력 소모','투자 영향','대출 부담','접속 버프','운세뽑기']);
  for(const [id,value] of Object.entries({base:'−1.5p',investment:'0p',debt:'0p',connection:'0p',fortune:'0% 속도 감소'})){
    assert.ok(slip.includes('data-mental-field="'+id+'">'+value+'<'));
    assert.ok(slip.includes('aria-expanded="false" aria-controls="mental-hint-'+id+'"'));
    assert.ok(slip.includes('id="mental-hint-'+id+'" role="note" hidden=""'));
  }
  assert.match(slip,/id="mental-hint-investment"[^>]*>[^<]*최대 12p/);
  assert.match(slip,/id="mental-hint-debt"[^>]*>[^<]*최대 16p/);
  assert.equal(draw(),initialBody);
  state.mentalConnectedAt=1_700_000_000_000;
  assert.match(draw(),/aria-label="게임 시간당 0.75점 감소".*?data-mental-field="rate">−0.75p</);
  reconcileFinancialMood(state);
  state.mental=18;
  state.realizedKRW=-500_000;
  state.adRecovery={day:0,count:5};
  state.luck='bingo';state.fortuneGrid=Array.from({length:3},()=>['meal','meal','meal']);
  const changed=draw();
  assert.match(changed,/data-mental-field="investment">−[0-9.]+p</);
  for(const [field,value] of Object.entries({score:'18',mood:'지침',connection:'+0.75p',fortune:'50% 속도 감소',remaining:'오늘 남은 횟수 0/5'}))
    assert.ok(changed.includes('data-mental-field="'+field+'">'+value+'<'));
  assert.match(changed,/data-act="watch-recovery" disabled=/);
  assert.match(changed,/class="gauge big low".*?aria-label="정신력 18퍼센트"/);
  assert.equal(changed.match(/<b class="fill"/g)?.length,2);
  assert.match(changed,/class="fill" style="--segment-fill:80%"/);
  assert.match(changed,/class="lab-vat">.*?data-brain-stage="5"/);
  assert.match(changed,/data-act="character-test" aria-haspopup="dialog"/);
  state.mental=0;
  assert.doesNotMatch(draw(),/class="lab-scan"|<b class="fill"/);
  state.mental=100;
  state.adRecovery={day:0,count:0};
  const full=draw();
  assert.equal(full.match(/<b class="fill"/g)?.length,10);
  assert.match(full,/data-act="watch-recovery" disabled=/);
  assert.match(full,/정신력이 가득 찼어/);
});

test('the daily review updates running charges once without changing the arrangement of its fields',()=>{
  const state=initial(), draw=()=>renderView(DayReview,{state});
  const before=draw(),estimate=estimateDailySpending(state.mental,state.cash,state.cash),bonus=dailyBonus(state);
  assert.match(before,/<section class="day-midnight"[\s\S]*하루 예상 소비금액[\s\S]*일급 입금 예정[\s\S]*보너스 입금 예정[\s\S]*예상 합계/);
  assert.doesNotMatch(before,/자정 정산|예상 정산 합계|오늘 거래·입출금|종량제|장보기|day-breakdown/);
  assert.match(before,/data-day-extra="" hidden=""/);
  state.liveSpending={day:state.day,total:10_000};
  state.dayStartMental=state.mental+1.25;
  state.spyCharges=[{day:state.day,cost:120_000},{day:state.day-1,cost:200_000}];
  const after=draw();
  assert.doesNotMatch(after,/오늘 결제한 소비|1\.25점|data-day-field="(?:paid|change)"/);
  const values=html=>Object.fromEntries([...html.matchAll(/data-day-field="([^"]+)">([^<]*)/g)].map(([,id,value])=>[id,value]));
  const old=values(before),updated=values(after);
  assert.deepEqual(Object.keys(old),Object.keys(updated));
  assert.deepEqual(Object.keys(updated).filter(key=>old[key]!==updated[key]),['extra','net']);
  assert.equal(updated.extra,'−120,000원');
  assert.equal(updated.estimate,fmtMoney(-estimate));
  assert.equal(updated.bonus,'+'+fmtMoney(bonus));
  const net=ECON.salary+bonus-estimate-120_000;
  assert.equal(updated.net,(net>0?'+':'')+fmtMoney(net));
  assert.match(after,/data-day-extra="">/);
});
