import test from 'node:test';
import assert from 'node:assert/strict';
import {canBuy,canContinue,firstAvailablePage,guideSteps,practiceAmounts,practiceTicker,restorePractice} from '../src/game/field-guide-model.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';

const {FieldGuide}=await loadJsx(new URL('../src/ui/field-guide.jsx',import.meta.url));
const page=step=>guideSteps.indexOf(step);
const render=(step,practice,options={})=>renderView(FieldGuide,{initialPage:page(step),initialPractice:practice,onExit(){},...options});
const proceed=html=>html.match(/<button[^>]+class="ui-control ui-primary guide-next"[^>]*>/)[0];
const learned=restorePractice({evidence:'freight'});
const ready=restorePractice({...learned,market:practiceTicker});
const receipt=/<section[^>]+class="guide-receipt"[^>]*>([\s\S]*?)<\/section>/;

test('standalone cutscenes keep the skip button and use the current room nickname',()=>{
  const scene=render('stall',null,{nickname:'복슬냥'});
  assert.match(scene,/data-mode="cutscene"/);
  assert.match(scene,/<bdi>복슬냥<\/bdi> 씨의 회사 화장실/);
  assert.match(scene,/회사에는 가짜 변비 환자로 가득하다/);
  assert.match(scene,/pose-4\.svg#cat.*landing-stall-door\.webp/);
  assert.match(scene,/건너뛰기 \(SKIP\)/);
  assert.match(scene,/class="guide-count"[^>]*>1 \/ 9<\/span><button class="guide-skip"/);
  assert.doesNotMatch(scene.split('<footer')[1],/guide-count/);
  assert.doesNotMatch(scene,/막차가 끊긴 밤|<header\b|guide-lesson/);
  assert.doesNotMatch(proceed(scene),/disabled/);
  assert.match(render('ranks',null),/<figcaption>선배<\/figcaption>.*<figcaption>동기<\/figcaption>.*class="guide-crown".*<figcaption>후배<\/figcaption>/);
});

test('news, market, order and portfolio steps require their own completed decision before continuing',()=>{
  const paper=render('news',null);
  assert.match(paper,/aria-expanded="false"/);
  assert.match(paper,/data-news-category="stock"/);
  assert.match(paper,/사내 주식 열풍에서 살아남으려면 단서부터 찾아야 한다\. 기사를 펼쳐 달밤물류의 운임이 언제 늘어나는지 알아보자\./);
  assert.doesNotMatch(paper,/소식 › 신문|guide-location/);
  for(const evidence of [null,'contract'])assert.match(proceed(render('news',{evidence})),/disabled/);
  assert.doesNotMatch(proceed(render('news',learned)),/disabled/);
  for(const market of [null,'MART','VOLT'])assert.match(proceed(render('market',{...learned,market})),/disabled/);
  assert.doesNotMatch(proceed(render('market',ready)),/disabled/);
  assert.equal((render('market',ready).match(/class="bk-spark"/g)||[]).length,3);
  for(const qty of [0,1,2,3,4,5]){
    const order=render('order',{...ready,qty});
    assert.match(proceed(order),/disabled/);
    assert.match(order,/남길 현금 5만 원/);
    assert.doesNotMatch(order,/10만 원|guide-budget-line|guide-location/);
  }
});

test('missing evidence, zero shares, reserve shortfalls and over-budget orders cannot unlock the result on restore',()=>{
  for(const practice of [null,{conclusion:'valuation'},{evidence:'contract',qty:2,filled:true}]){
    const resumed=render('account',practice);
    assert.match(proceed(resumed),/disabled/);
    assert.match(resumed,/<article\b/);
    assert.equal(firstAvailablePage(restorePractice(practice)),page('news'));
  }
  assert.equal(firstAvailablePage(restorePractice({...ready,market:'MART',qty:2,filled:true})),page('market'));
  for(const qty of [0,3,4,5,99,-1,1.5]){
    const invalid={...ready,qty,filled:true,conclusion:'valuation'};
    const resumed=restorePractice(invalid);
    assert.equal(canBuy(qty),false);
    assert.equal(resumed.filled,false);
    assert.equal(resumed.conclusion,null);
    assert.equal(firstAvailablePage(resumed),page('order'));
    assert.equal(canContinue(page('order'),resumed),false);
    assert.doesNotMatch(render('account',invalid),receipt);
    const order=render('order',resumed);
    assert.doesNotMatch(order,/data-guide-sound="fill"/);
    assert.equal(order.includes('data-guide-sound="guideWrong"'),qty===3||qty===4);
  }
});

test('the newspaper, market and account answer buttons pick the correct or wrong cue',()=>{
  const newspaper=render('news',{paperOpen:true});
  const market=render('market',learned);
  const account=render('account',{...ready,qty:1,filled:true});
  assert.match(newspaper,/data-guide-sound="guideWrong"[^>]*>.*?냉장차 8대가 운행을 시작할 때<\/button>/);
  assert.match(newspaper,/data-guide-sound="fill"[^>]*>.*?돌아오는 차에 유료 화물을 실을 때<\/button>/);
  assert.match(market,/data-guide-sound="guideWrong"[^>]*>[^<]*<img src="\/art\/companies\/volt\.webp"/);
  assert.match(market,/data-guide-sound="fill"[^>]*>[^<]*<img src="\/art\/companies\/moon\.webp"/);
  assert.match(account,/data-guide-sound="fill"[^>]*>.*?보유 주식의 평가액이 줄었다<\/button>/);
  assert.match(account,/data-guide-sound="guideWrong"[^>]*>.*?남은 현금에서 손실만큼 빠졌다<\/button>/);
});

const orders=[
  {qty:1,cost:23500,cashLeft:76500,value:22500,gain:-1000},
  {qty:2,cost:47000,cashLeft:53000,value:45000,gain:-2000},
];
const won=n=>n.toLocaleString('ko-KR')+'원';

for(const {qty,cost,cashLeft,value,gain} of orders){
  test(qty+'-share order keeps its cash and valuation through review and replay',()=>{
    const bought={...ready,qty,filled:true};
    const success={...bought,conclusion:'valuation'};
    assert.equal(canBuy(qty),true);
    assert.deepEqual(practiceAmounts(qty),{cost,cashLeft,value,gain});
    assert.deepEqual(restorePractice(success),success);
    assert.match(render('order',{...ready,qty}),/data-guide-sound="fill"/);
    assert.doesNotMatch(render('order',bought),/data-guide-sound=/);
    assert.doesNotMatch(proceed(render('order',bought)),/disabled/);
    for(const draft of [bought,{...bought,conclusion:'cash'},{...success,filled:false}]){
      const screen=render('account',draft);
      assert.match(proceed(screen),/disabled/);
      assert.doesNotMatch(screen,receipt);
    }
    const portfolio=render('account',bought);
    assert.ok(portfolio.includes(won(value)));
    assert.ok(portfolio.includes(won(cashLeft)));
    assert.match(portfolio,/class="guide-price-chart"/);
    assert.doesNotMatch(portfolio,/1주 가격|guide-location/);
    for(const replay of [false,true]){
      const completed=render('account',success,{replay});
      assert.doesNotMatch(completed,receipt);
      assert.match(completed,/주가가 내리면 뭐가 달라질까\?/);
      assert.match(completed,/class="guide-price-chart"/);
      assert.match(completed,/data-state="right".*role="status" data-tone="right">정답!/);
      assert.ok(completed.includes(won(cashLeft)));
      assert.doesNotMatch(proceed(completed),/disabled/);
    }
    assert.doesNotMatch(render('order',success),receipt);
    assert.doesNotMatch(proceed(render('order',success)),/disabled/);
  });
}

test('mental practice demonstrates spending changes and requires recovery before the closing scene',()=>{
  const traded={...ready,qty:1,filled:true,conclusion:'valuation'};
  assert.match(render('stakes',traded),/투자만 알면 된다고\?/);
  assert.match(render('mental',traded),/손실 상태로 시간 보내기/);
  assert.match(render('mental',traded),/정신력이 낮아질수록 과소비가 심해진다/);
  assert.match(render('mental',traded),/class="guide-loss-icon"/);
  assert.doesNotMatch(render('mental',traded),/순자산 100만 원 예시/);
  assert.doesNotMatch(render('mental',traded),/data-guide-sound=/);
  const drained={...traded,mental:'drained'};
  const cost=render('mental',drained);
  assert.match(cost,/216원.*294원.*분당 78원 증가/);
  assert.match(cost,/data-guide-sound="petRecovery">자정 00:00으로 넘기기/);
  assert.match(cost,/빙고.*00:00.*정신력 50점/);
  assert.match(proceed(render('retire',drained)),/disabled/);
  const recovered={...traded,mental:'recovered'};
  const result=render('mental',recovered);
  assert.match(result,/<strong>100<small>/);
  assert.match(result,/294원.*30원.*분당 264원 감소/);
  assert.doesNotMatch(result,/data-guide-sound=/);
  assert.doesNotMatch(proceed(result),/disabled/);
  assert.match(render('retire',recovered),/멋지게 은퇴해 보자!/);
  assert.match(render('retire',recovered,{replay:true}),/시작하기/);
});
