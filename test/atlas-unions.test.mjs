import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalCountry, countries, relations, relationKinds} from '../src/game/atlas-data.mjs';
import {countryPins, territoryPaths, borderPath} from '../src/game/atlas-map.mjs';
import {flagPath} from '../src/game/country-flags.mjs';

const expected=['arden','austran','azania','brazin','chai','haeon','kanora','lumen','misran','mora','vietlan'];
const formerMembers={
  austran:['zelanda','papura','fijara','saloma'],azania:['maghren','naijar','kenara'],
  brazin:['argentel','chilena','anderu','colmera'],chai:['ruska'],kanora:['mexara','cubara','panaro'],
  lumen:['francen','germar','espara'],vietlan:['indara'],
};

test('the atlas publishes eleven playable territories, with a unique flag and a pin on its own land',()=>{
  for(const source of [countries,countryPins,territoryPaths]){
    assert.deepEqual(Object.keys(source).sort(),expected);
  }
  const flags=new Set();
  for(const id of expected){
    assert.equal(canonicalCountry(id),id);
    assert.ok((id==='mora'?['vacant']:['progressive','conservative']).includes(countries[id].partySide),id);
    const flag=readFileSync(new URL('../public/'+flagPath(id),import.meta.url));
    assert.equal(flag.readUInt32BE(16),96);
    assert.equal(flag.readUInt32BE(20),64);
    flags.add(flag.toString('base64'));
    const [x,y]=countryPins[id];
    const strips=territoryPaths[id].matchAll(/M([\d.-]+) ([\d.-]+)h([\d.]+)v([\d.]+)H[\d.-]+Z/g);
    const containsPin=Array.from(strips,m=>m.slice(1).map(Number)).some(([left,top,width,height])=>
      left<=x&&x<left+width&&top<=y&&y<top+height);
    assert.ok(containsPin,'Pin is outside '+id);
  }
  assert.equal(flags.size,expected.length);
  assert.ok(borderPath.includes('L'));
});

test('old members resolve to the same territory and flag as their union',()=>{
  for(const [union,members] of Object.entries(formerMembers)){
    for(const member of members){
      assert.equal(canonicalCountry(member),union);
      assert.equal(flagPath(member),flagPath(union));
    }
  }
  for(const unknown of [null,'','__proto__','constructor','invalid']){
    assert.equal(canonicalCountry(unknown),null);
    assert.equal(flagPath(unknown),'');
  }
});

test('diplomatic relations connect distinct playable governments and cover every government',()=>{
  const connected=new Set(),pairs=new Set();
  for(const {a,b,kind} of relations){
    assert.ok(countries[a]&&countries[b]&&relationKinds[kind]);
    connected.add(a).add(b);
    assert.notEqual(a,b);
    const pair=[a,b].sort().join('/');
    assert.ok(!pairs.has(pair),pair);
    pairs.add(pair);
  }
  assert.deepEqual([...connected].sort(),expected);
});
