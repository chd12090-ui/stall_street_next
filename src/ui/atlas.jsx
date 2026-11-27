import React, {memo,useLayoutEffect,useReducer,useRef} from 'react';
import {atlasView,allCountries,regionEntries,mapBox,mapSize,mapNorth,mapSouth,politicalTick,
  labelPositions,point,routeCurve,stance,dialogue,other,byCountry,nearestPin} from '../game/atlas.mjs';
import {countries,relationStances} from '../game/atlas-data.mjs';
import {territoryPaths} from '../game/atlas-map.mjs';
import {flagPath} from '../game/country-flags.mjs';
import {Select} from './exchange-controls.jsx';
import {AtlasPopover} from './atlas-popover.jsx';

function RepeatWorld({children}){
  return [-360,0,360].map(offset=><g key={offset} transform={`translate(${offset} 0)`}>{children}</g>);
}

const MapLand=memo(function MapLand({country,partner}){
  return <RepeatWorld>{allCountries.map(c=><path key={c.id} className={'atlas-shape '+(c.id===country?'current':c.id===partner?'peer':'')}
    data-region={c.continent} data-act="atlas-country" data-value={c.id} d={territoryPaths[c.id]}><title>{c.name}</title></path>)}</RepeatWorld>;
});

const MapRelations=memo(function MapRelations({country,partner,layer,tick}){
  const focus=byCountry(country).filter(relation=>partner?other(relation,country).id===partner:layer==='all'||layer===stance(relation,tick));
  return <RepeatWorld>{focus.map(relation=>{
    const from=countries[relation.a],to=countries[relation.b],path=routeCurve(from,to);
    const tone=stance(relation,tick),kind=relationStances[tone],agenda=dialogue(relation,tick);
    const code=from.id+'~'+to.id;
    return <g key={code} className="atlas-arc" data-stance={tone} data-cooperation={agenda?'expanded':undefined} data-act="atlas-edge" data-value={code}>
      <title>{from.name+' · '+to.name+' · '+kind.name+(agenda?' · '+agenda[0]:'')}</title>
      <path className="arc-under" d={path}/><path className="arc-line" d={path} stroke={kind.color}/><path className="arc-target" d={path}/>
    </g>;
  })}</RepeatWorld>;
});

const MapPins=memo(function MapPins({country,partner,scale}){
  return <RepeatWorld>{allCountries.map(c=>{
    const active=c.id===country,peer=c.id===partner,r=scale*2.7*(active?1.5:peer?1.25:1),[x,y]=point(c);
    const hit=Math.max(r*1.65,Math.min(scale*17,nearestPin[c.id]*.46));
    return <g key={c.id} className="atlas-country-pin" data-act="atlas-country" data-value={c.id} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
      <title>{c.name}</title>{active&&<circle className="atlas-halo" r={r*2.9}/>}
      <circle className={'atlas-dot '+(active?'current':peer?'peer':'')} r={r}/><circle className="atlas-hit" r={hit}/>
    </g>;
  })}</RepeatWorld>;
});

function WorldMap({state}){
  const host=useRef(null),[,redraw]=useReducer(count=>count+1,0),tick=politicalTick(state);
  useLayoutEffect(()=>{
    const node=host.current;node.addEventListener('atlas-paint',redraw);
    return ()=>node.removeEventListener('atlas-paint',redraw);
  },[]);
  const box=mapBox(),{country,partner,stance:layer}=atlasView;
  const labels=labelPositions(countries[country],box,mapSize.width,mapSize.height);
  return <atlas-map-canvas ref={host} class="atlas-map-canvas can-pan" data-political-tick={tick}>
    <svg className="atlas-map-svg" tabIndex={0} viewBox={box.join(' ')} preserveAspectRatio="none" role="group" aria-label="세계 관계 지도. 방향키로 이동하고 국가 검색으로 상세 정보를 열 수 있습니다.">
      <defs><image id="atlas-terrain" className="atlas-pixels" href="/art/atlas-terrain.webp" width={360} y={mapNorth} height={mapSouth-mapNorth} preserveAspectRatio="none"/></defs>
      <RepeatWorld><use href="#atlas-terrain"/></RepeatWorld><MapLand country={country} partner={partner}/>
      <MapRelations country={country} partner={partner} layer={layer} tick={tick}/>
      <MapPins country={country} partner={partner} scale={box[2]/mapSize.width}/>
      <g className="atlas-map-overlays">{labels.map(({country:c,x,y,width,height,scaleX,scaleY})=>
        <svg key={c.id} className={'atlas-geo-label '+(c.id===country?'current':'')} x={x} y={y} width={width*scaleX} height={height*scaleY}
          viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" data-act="atlas-country" data-value={c.id}>
          <rect x=".5" y=".5" width={width-1} height={height-1} rx="1"/><image href={flagPath(c.id)} x={4} y={6} width={15} height={10}/>
          <text x={22} y={16}>{c.name}</text></svg>)}</g>
    </svg>
  </atlas-map-canvas>;
}

export function AtlasPage({state}){
  const {country,panel,region,zoom,stance:layer}=atlasView;
  return <div className="page atlas-page atlas-full"><WorldMap state={state}/>
    <div className="atlas-floating-top"><button type="button" className="atlas-launch-search ui-control" data-act="atlas-search" aria-haspopup="dialog">
      <i className="atlas-search-icon" aria-hidden="true"/>국가 찾기</button>
      <label className="atlas-region-choice"><span className="visually-hidden-atlas">대륙 선택</span>
        <Select aria-label="대륙 선택" id="atlas-continent-select" value={region}>
          {regionEntries.map(([id,name])=><option key={id} value={id}>{name}</option>)}</Select></label></div>
    <div className="atlas-floating-bottom"><button type="button" className="atlas-layer-launch ui-control" data-act="atlas-legend" aria-haspopup="dialog">
      <i className="atlas-stance-key" aria-hidden="true"/>{layer==='all'?'범례':relationStances[layer].name}</button>
      <div className="atlas-scale-tools"><button className="ui-control" data-act="atlas-zoom" data-value="-1" aria-label="지도 축소" disabled={zoom<=1}>−</button>
        <button className="ui-control" data-act="atlas-zoom" data-value="1" aria-label="지도 확대" disabled={zoom>=6}>+</button><button className="ui-control" data-act="atlas-reset" aria-label="지도 기본 배율로 돌아가기">전체</button></div>
    </div>{panel&&<AtlasPopover state={state} country={countries[country]}/>}</div>;
}
