import test from 'node:test';
import assert from 'node:assert/strict';
import {stories,events,articleById,visibleStories} from '../src/game/world.mjs';
import {visibleWireStories} from '../src/game/press-wire.mjs';
import {eventIdentity} from '../src/game/disclosure-event.mjs';
import {articleEvidence,companyNewsEvidence,isOutlook,publicNewsLinks} from '../src/game/news-analysis.mjs';
import {journalForInterval} from '../src/game/company-events.mjs';

const at=tick=>({day:Math.floor(tick/288),cursor:tick%288,phase:'open'});
const first=stories.find(s=>s.event.id==='m2-cold-vans' && s.related.includes('MOON'));

test('a release is accessible at the publication tick and multiple newspapers share its economic effect',()=>{
  const t=visibleStories(at(first.event.tick+60)).find(story=>story.id===first.id).publishedAt;
  assert.equal(articleEvidence(at(t-1),first.id,'MOON'),null);
  const facts=articleEvidence(at(t),first.id,'MOON');
  assert.equal(facts.publishedTick,t);
  assert.equal(facts.source,first.document.ko.source);
  assert.equal(facts.question,'growth');
  assert.match(facts.conditions,/만차/);
  assert.doesNotMatch(JSON.stringify(facts),/shock|fraction|recognizedTick/);
  assert.equal(articleEvidence(at(t),first.id,'BIT'),null);
  const edition=stories.find(s=>s.event===first.event && s.id!==first.id && s.related.includes('MOON'));
  const second=visibleStories(at(t+60)).find(story=>story.id===edition.id);
  assert.ok(second.publishedAt>t);
  assert.equal(articleEvidence(at(second.publishedAt),edition.id,'MOON').releaseId,facts.releaseId);
  const cards=companyNewsEvidence(at(second.publishedAt),'MOON',99);
  assert.equal(cards.filter(card=>card.releaseId===facts.releaseId).length,1);
  const same=journalForInterval([first.event,edition.event],0,t+500);
  assert.deepEqual(same,journalForInterval([first.event],0,t+500));
});

test('price shocks and later partnership announcements cannot create public article evidence',()=>{
  const story={related:['ARC'],event:{id:'demo',tick:10,shock:{BMEM:.3,BIT:-.2}}};
  assert.ok(!publicNewsLinks(story).indirect.includes('BMEM'));
  assert.ok(!publicNewsLinks(story).indirect.includes('BIT'));
  assert.ok(publicNewsLinks({...story,event:{...story.event,tick:4*288}}).indirect.includes('BMEM'));
  assert.deepEqual(publicNewsLinks({related:['TIDE','HARB'],event:{tick:4*288}}).direct,['HARB']);
});

test('later stages carry a stable incident ID and independent public release versions',()=>{
  const list=['m1-strait','w1-convoy','f2-strait-renewal'].map(id=>eventIdentity(events.find(e=>e.id===id)));
  assert.deepEqual(list.map(x=>x.eventVersion),[1,2,3]);
  assert.equal(new Set(list.map(x=>x.eventId)).size,1);
  const wire=[1058,1061,1066].map(t=>articleById(at(1300),'dispatch-'+t+'-0'));
  assert.equal(new Set(wire.map(story=>eventIdentity(story.event).eventId)).size,1);
  assert.deepEqual(wire.map(story=>eventIdentity(story.event).eventVersion),[1,2,3]);
});

test('public forecasts keep forecasts as possibilities, and reporters may report a follow-up without an economic effect',()=>{
  const wire=visibleWireStories(1300,1410);
  const forecast=visibleStories(at(1350)).find(story=>story.event.operatingDisclosure?.type==='outlook' &&
    story.id.endsWith('-0')&&publicNewsLinks(story).direct.length>0);
  assert.ok(isOutlook(forecast));
  const evidence=articleEvidence(at(forecast.publishedAt),forecast.id,forecast.related[0]);
  assert.match(evidence.business,/예상|전망/);
  const editorial=wire.find(story=>story.event.editorialOnly);
  assert.ok(editorial);
  assert.equal(journalForInterval([forecast.event,editorial.event],0,4000).size,0);
});
