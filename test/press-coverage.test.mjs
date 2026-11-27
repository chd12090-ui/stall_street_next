import test from 'node:test';
import assert from 'node:assert/strict';
import {publishers} from '../src/game/press-data.mjs';
import {articleById,events,tradeNewsLinks,visibleStories} from '../src/game/world.mjs';
import {countries} from '../src/game/atlas-data.mjs';
import {newsAction,newsChange,newsTime,newsDayLabel,publicationLabel,publicationMinute,isTranslated} from '../src/game/newsroom.mjs';
import {visibleWireStories,archivedBulletin,incidentImpacts,incidentStance} from '../src/game/press-wire.mjs';
import {newsCategory} from '../src/game/news-category.mjs';
import {relatedIndustryIds} from '../src/game/news-relations.mjs';
import {initial} from '../src/game/market.mjs';

import {loadJsx,renderView} from '../test-support/render-jsx.mjs';
const {NewsPage}=await loadJsx(new URL('../src/ui/newspaper.jsx',import.meta.url));
const articlePage=(state,articleId,articleView)=>renderView(NewsPage,{state,articleId,articleView});
const kiosk=state=>renderView(NewsPage,{state});

const stateAt=tick=>({...initial(),day:Math.floor(tick/288),cursor:tick%288});

test('the stand and saved article links exclude Japanese and Chinese publishers and coverage',()=>{
  const state=stateAt(2600);
  for(const id of ['wire-north-0','wire-africa-0','t2-lumen-settlement-2','w2-gas-storage-2','t3-nova-power-2']){
    const article=articleById(state,id);
    assert.ok(article.en?.title&&article.ko?.title,id);
    assert.ok(Object.hasOwn(publishers,article.outletInfo.publisher));
    const header=articlePage(state,id).match(/<div class="nr-paper-top">(.*?)<\/div>/)[1];
    assert.match(header,/<time>Day -?\d+(?:\([^<]+\))?<\/time>/);
    assert.ok(!header.includes(article.outletInfo.name));
  }
  const printed=visibleStories(state);
  assert.deepEqual([...new Set(printed.map(s=>s.outletInfo.nation))].sort(),['arden','mora']);
  assert.ok(printed.every(story=>!story.countries.some(id=>['haeon','chai'].includes(id))));
  for(const id of ['m1-strait-7','m2-cold-vans-2','wire-pacific-0','wire-europe-0','dispatch-1060-0','incident-1483-0']){
    assert.equal(articleById(state,id),null,id);
  }
  assert.doesNotMatch(kiosk(state),/日本新聞|中国新闻|동북아시아연합|일본 |중국 /);
});

test('one paper arrives per variable 40–60 game minutes and keeps a stable link after leaving the stand',()=>{
  for(const start of [0,1050,2500]){
    let previous,stamp;
    const gaps=new Set(),seen=new Set();
    for(let tick=start;tick<start+360;tick++){
      const state=stateAt(tick),stand=visibleStories(state),latest=stand[0];
      assert.ok(stand.every(s=>s.publishedAt<=tick));
      if(previous){
        const current=new Set(previous.map(s=>s.id)),arrivals=stand.filter(s=>!current.has(s.id));
        assert.ok(arrivals.length<=1);
        if(arrivals.length){
          assert.equal(latest.id,arrivals[0].id);
          assert.equal(latest.publishedAt,tick);
          assert.ok(!seen.has(latest.id));
          if(stamp!==undefined)gaps.add((tick-stamp)*5);
          stamp=tick;
          assert.equal(articleById(state,latest.id).publishedAt,tick);
          assert.equal(articleById(stateAt(tick-1),latest.id),null);
          assert.equal(articleById(stateAt(tick+600),latest.id).publishedAt,tick);
        }
      }
      seen.add(latest.id);
      previous=stand;
    }
    assert.deepEqual([...gaps].sort((a,b)=>a-b),[40,45,50,55,60]);
  }
});

test('continuing international coverage has its own tag, keeps the participants and adds no price shock',()=>{
  const opening=1291;
  for(let n=0;n<6;n++){
    const tick=opening+n*96,id='incident-'+tick+'-0';
    const next=archivedBulletin(id,tick);
    assert.ok(next?.ko.body.length,id);
    assert.equal(archivedBulletin(id,tick-1),null);
    assert.equal(newsCategory(next),'international');
    assert.deepEqual(visibleWireStories(tick-1,tick)[0].id,id);
    assert.deepEqual(incidentImpacts(tick-1,tick),[]);
    if(n===2){
      assert.deepEqual(next.countries,['lumen','chai']);
      assert.equal(next.outletInfo.name,'中国新闻');
      assert.equal(articleById(stateAt(tick),id),null);
    }
  }
  for(const id of ['dispatch-1062-0','incident-1276-0','incident-1296-0'])assert.equal(newsCategory(archivedBulletin(id,2000)),'international',id);
  assert.match(articlePage(stateAt(2000),'wire-north-0'),/data-news-category="international"/);
});

test('the newspaper prints the related industries above the country chips',()=>{
  const state=stateAt(2600),id='wire-north-0',article=articleById(state,id);
  assert.deepEqual(relatedIndustryIds(article),['insurance','shipping','rail-transport']);
  const body=articlePage(state,id),industries=body.indexOf('<h2>관련 업종</h2>'),countries=body.indexOf('<h2>관련 국가·연합</h2>');
  assert.ok(industries>=0&&industries<countries);
  assert.match(body.slice(industries,countries),/data-industry-id="insurance">보험<\/li>.*data-industry-id="shipping">해운<\/li>/);
  const relay={related:['ARC','BMEM','WFBK'],event:{day:0,shock:{DHCP:.1}}};
  assert.deepEqual(relatedIndustryIds(relay),['semiconductors','banking']);
  const charging=visibleWireStories(4100,4500).find(story=>story.event.operatingDisclosure?.code==='HZMA');
  assert.ok(charging);
  assert.deepEqual(relatedIndustryIds(charging),['electrical-equipment']);
});

test('newspapers change Day at game midnight and the stand offers the topic filter in its header',()=>{
  const start=5,midnight=start*288+180;
  const before={...stateAt(midnight-1),openingDay:start};
  const after={...stateAt(midnight+12),openingDay:start};
  assert.match(kiosk(before),/<h2>Day 1 신문<\/h2>/);
  assert.doesNotMatch(kiosk(before),/Day 2 신문/);
  const stand=kiosk(after);
  assert.match(stand,/<header class="nr-header">.*id="edition-topic".*<\/header>/);
  assert.match(stand,/<h2>Day 2 신문<\/h2>.*<h2>Day 1 신문<\/h2>/);
  assert.doesNotMatch(stand,/news-pro|\d{2}\/\d{2} 신문/);
  assert.match(stand,/<time class="nr-cover-date">Day 2\([^<]+ 전\)<\/time>/);
  assert.match(stand,/<time class="nr-cover-date">Day 1<\/time>/);
  assert.match(kiosk({...after,openingDay:start+2}),/<time class="nr-cover-date">Day -1\([^<]+ 전\)<\/time>/);
  assert.equal(newsDayLabel(start-12,start),'Day -12');
  const article=visibleStories(after).findLast(s=>s.publishedAt>=midnight);
  const time='Day 2 00:'+String((article.publishedAt-midnight)*5).padStart(2,'0');
  assert.equal(newsTime(article,after),time);
  assert.match(articlePage(after,article.id),/<div class="nr-paper-top"><time>Day 2\([^<]+ 전\)<\/time>/);
});

test('the stand and reader show same-day age in game minutes and drop it at midnight',()=>{
  const stateAtMinute=(day,wallMinute)=>({...initial(),openingDay:7,clockMode:'kst',day,wallMinute,cursor:Math.floor(wallMinute/5)});
  const id='dispatch-2555-0';
  const state=stateAtMinute(9,410);
  const story=articleById(state,id);
  assert.equal(story.publishedAt,2560);
  for(const [minute,date] of [[380,'Day 3(방금 전)'],[410,'Day 3(30분 전)'],[411,'Day 3(31분 전)'],[440,'Day 3(1시간 전)'],[1440,'Day 3']]){
    const next=stateAtMinute(9+Math.floor(minute/1440),minute%1440);
    assert.equal(publicationLabel(story,publicationMinute(next),7),date);
    assert.ok(articlePage(next,id).includes('<time>'+date+'</time>'));
    const card=kiosk(next).match(/data-value="dispatch-2555-0">(.*?)<\/button>/)?.[1];
    assert.ok(card?.includes('<time class="nr-cover-date">'+date+'</time>'),date);
  }
});

test('the reader uses one analysis panel below the complete article body',()=>{
  const state=stateAt(144);
  for(const id of ['brief-5-0','m2-cold-vans-0']){
    const html=articlePage(state,id);
    const lastParagraph=html.lastIndexOf('class="nr-body"');
    const panel=html.indexOf('id="article-analysis"');
    assert.ok(lastParagraph>=0 && panel>lastParagraph,id);
    assert.equal(html.match(/id="article-analysis"/g).length,1);
    assert.match(html,/aria-expanded="false" aria-controls="article-analysis">기사 분석<\/button>/);
    assert.match(html,/<summary class="ui-disclosure">기사 분석<\/summary>/);
    assert.doesNotMatch(html,/기사 해석|무엇이 달라질까|게임 속 기사|윤서진 기자|nr-insight|nr-passage/);
  }
});

test('the four article topics combine independently with each newspaper tab',()=>{
  const state=stateAt(1463),stories=visibleStories(state);
  const select=topic=>newsChange({id:'edition-topic',value:topic});
  const tab=lean=>newsAction('news-lean',{dataset:{value:lean}});
  try{
    for(const topic of ['stock','market','international','politics','all']){
      assert.equal(select(topic),true);
      for(const lean of ['보수','진보','해외','전체']){
        tab(lean);
        const html=kiosk(state);
        const expected=stories.filter(s=>(lean==='전체'||s.outletInfo.lean===lean)&&(topic==='all'||newsCategory(s)===topic));
        const ids=Array.from(html.matchAll(/class="nr-cover cover-[^"]+" type="button" data-act="article" data-value="([^"]+)"/g),m=>m[1]);
        assert.deepEqual(new Set(ids),new Set(expected.map(s=>s.id)),topic+' / '+lean);
        if(!expected.length)assert.match(html,/선택한 조건에 맞는 기사가 없어/);
        if(topic!=='all')assert.ok(html.includes('value="'+topic+'" selected'));
      }
    }
    assert.equal(select('arden'),false);
  }finally{select('all');tab('전체');}
});


test('regional source records preserve diplomatic history while the public paper keeps its permitted country links',()=>{
  const regionIds=new Set(Object.keys(countries));
  const assertLinks=articles=>{
    const covered=new Set();
    for(const article of articles){
      assert.ok(article.countries.length,article.id);
      assert.equal(article.countries.length,new Set(article.countries).size,article.id);
      for(const id of article.countries){
        assert.ok(regionIds.has(id),article.id+' / '+id);
        covered.add(id);
      }
    }
    assert.deepEqual(covered,regionIds);
  };
  assertLinks(events.flatMap(event=>event.stories));
  assertLinks(visibleWireStories(1290,1291+8*96));
  const archived=archivedBulletin('incident-1867-0',1867);
  assert.deepEqual(tradeNewsLinks(archived).direct,[]);
  assert.match(archived.ko.title,/동북아시아연합/);
  assert.match(archived.en.body.join(' '),/Northeast Asian Union/);
  for(const [tick,ticker] of [[1293,'HARB'],[1485,'CORL']]){
    const regional=archivedBulletin('incident-'+tick+'-0',tick);
    assert.ok(regional.related.includes(ticker));
    assert.deepEqual(tradeNewsLinks(regional).direct,ticker==='HARB'?['HARB']:[]);
    assert.deepEqual(incidentImpacts(tick-1,tick),[]);
  }
  const state=stateAt(2700),report=articlePage(state,'wire-africa-0');
  for(const id of ['azania','misran']){
    assert.ok(report.includes('data-act="open-atlas" data-value="'+id+'"'));
    assert.ok(report.includes(countries[id].name));
  }
  const election=articleById(state,'zelanda-election-0');
  assert.deepEqual(election.countries,['austran']);
  assert.match(election.ko.title,/뉴질랜드 지역의회/);
  assert.equal(incidentStance('chai','lumen',1062),'hostile');
  assert.equal(incidentStance('ruska','germar',1062),'hostile');
  assert.equal(incidentStance('lumen','germar',1062),null);
  for(const [a,b,tick] of [['chai','vietlan',1276],['arden','kanora',3591],['chai','arden',7915]]){
    assert.equal(incidentStance(a,b,tick-1),null);
    assert.equal(incidentStance(b,a,tick),'hostile');
    assert.equal(archivedBulletin('incident-'+tick+'-0',tick).event.diplomacy,'hostile');
  }
});

test('article reader preserves an open analysis panel when switching languages',()=>{
  const state=stateAt(2700),id='dispatch-1058-0',article=articleById(state,id);
  const translate=()=>newsAction('news-translation',{closest:()=>({dataset:{articleId:id}})},state);
  const check=(language,translated)=>{
    const html=articlePage(state,id,{impactOpen:true});
    assert.ok(html.includes('data-act="news-translation" aria-pressed="'+translated+'"'));
    assert.match(html,/aria-expanded="true" aria-controls="article-analysis">기사 분석/);
    assert.match(html,/id="article-analysis" class="nr-evidence" open=""/);
    assert.ok(html.includes('class="nr-copy" lang="'+language+'"'));
  };
  const initialMarkup=articlePage(state,id);
  assert.match(initialMarkup,/role="group" aria-label="기사 읽기 설정".*?news-translation" aria-pressed="true".*?aria-controls="article-analysis"/s);
  assert.doesNotMatch(initialMarkup,/Pro 옵션|nr-options/);
  check('ko',true);
  assert.match(articlePage(state,'dispatch-1059-0'),/disabled="">한국어 원문/);
  try{
    translate();
    check('en',false);
    translate();
    check('ko',true);
  }finally{
    if(!isTranslated(article))translate();
  }
});
