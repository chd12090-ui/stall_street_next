import assert from 'node:assert/strict';
import test from 'node:test';
import {atlasRouteSuffix,openAtlasRoute,handleAtlas} from '../src/game/atlas.mjs';
import {countries} from '../src/game/atlas-data.mjs';
import {candidates,setElectedPolicy} from '../src/game/election-policy.mjs';
import {initial} from '../src/game/market.mjs';

import {loadJsx,renderView} from '../test-support/render-jsx.mjs';
const {AtlasPage}=await loadJsx(new URL('../src/ui/atlas.jsx',import.meta.url));
const atlasPage=state=>renderView(AtlasPage,{state});
const governmentCard=state=>atlasPage(state).match(/<article class="atlas-leadership".*?<\/article>/s)[0];

test('retired atlas links open the successor and collapse domestic pairs',()=>{
  openAtlasRoute('germar~mora');
  assert.equal(atlasRouteSuffix(),'/lumen~mora');
  openAtlasRoute('francen~germar');
  assert.equal(atlasRouteSuffix(),'/lumen');
  const card=governmentCard(initial());
  assert.ok(card.includes(countries.lumen.leader));
  assert.ok(card.includes(countries.lumen.party));
  openAtlasRoute('ruska');
  assert.equal(atlasRouteSuffix(),'/chai');
  assert.match(atlasPage(initial()),/<strong>동북아시아연합<\/strong><span lang="en">Northeast Asian Union<\/span>/);
});

test('the elected government changes party name, color and portrait together',t=>{
  t.after(()=>setElectedPolicy([]));
  const state=initial();
  openAtlasRoute('mora');
  for(const winner of Object.values(candidates)){
    setElectedPolicy({candidate:winner.id,effectiveAt:1});
    const card=governmentCard(state);
    assert.ok(card.includes(winner.name+' 대통령'));
    assert.ok(card.includes(winner.party));
    assert.ok(card.includes('data-party-side="'+winner.id+'"'));
    assert.ok(card.includes('src="/art/pixel/election-'+winner.id+'.webp"'));
  }
  setElectedPolicy([]);
  assert.match(governmentCard(state),/data-party-side="vacant".*대통령 공석/);
  assert.doesNotMatch(governmentCard(state),/leader-mora\.webp|조현덕|윤준오|시민미래당|자유경제당/);
});


test('search aliases, legend, country tabs and bilateral sheets keep their navigable controls',()=>{
  const state=initial(),act=(name,value)=>handleAtlas('atlas-'+name,{dataset:{value}},state);
  openAtlasRoute('mora');
  act('search');
  const search=atlasPage(state);
  assert.match(search,/data-search="[^"]*동아시아연합 East Asian Union"/);
  assert.equal((search.match(/class="atlas-find-result"/g)||[]).length,Object.keys(countries).length);
  act('legend');
  assert.match(atlasPage(state),/data-act="atlas-layer" data-value="all" aria-pressed="true"/);
  act('country','mora');
  act('section','stocks');
  assert.match(atlasPage(state),/class="atlas-instruments"><button data-act="symbol"/);
  act('section','relations');
  assert.match(atlasPage(state),/data-act="atlas-relation" data-value="haeon"/);
  act('relation','haeon');
  const pair=atlasPage(state);
  assert.match(pair,/data-key="pair:mora~haeon"/);
  assert.match(pair,/class="atlas-pair-back" data-act="atlas-back"/);
  assert.match(pair,/class="atlas-exposure"/);
  act('back');
  assert.match(atlasPage(state),/data-key="country:mora:relations"/);
});
