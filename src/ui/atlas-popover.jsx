import {atlasView,allCountries,searchAliases,atlasSections,politicalTick,other,byCountry,stance,dialogue,
  dayBadge,eventDay,electedPresident,latestUpdate,relatedSecurities} from '../game/atlas.mjs';
import {continents,countries,relationStances,relationKinds} from '../game/atlas-data.mjs';
import {countryAnimals} from '../game/country-animals.mjs';
import {mapBiomes} from '../game/atlas-map.mjs';
import {marketClock,usesKst,dayLabel} from '../game/clock-calendar.mjs';
import {tapeCivilDay} from '../game/tape.mjs';
import {currencies,visibleStories} from '../game/world.mjs';
import {isExchangeCurrency,fxRates} from '../game/fx.mjs';
import {listingDescription} from '../game/securities-data.mjs';
import {newsDate} from '../game/newsroom.mjs';
import {presidentialElectionTitle} from '../game/election.mjs';
import {PixelArt} from './home-art.jsx';
import {Flag,TopicBadge} from './news-marks.jsx';

function Heading({title,children,level=3}) {
  const Tag='h'+level;
  return <div className="atlas-heading"><Tag>{title}</Tag><small>{children}</small></div>;
}

function ArticleButton({story,state}) {
  return <button className="atlas-article" data-act="article" data-value={story.id}>
    <span><em>{newsDate(story,state)}</em></span>
    <span className="news-story-title"><TopicBadge story={story}/><b lang="ko">{story.title}</b></span>
  </button>;
}

function Securities({country,peer}) {
  const matches=relatedSecurities(country,peer);
  if (!matches.length && peer) return null;
  return <section className="atlas-subsection"><Heading title="관련 종목">발행국·사업 연관</Heading>
    {matches.length?<div className="atlas-instruments">{matches.slice(0,4).map(({stock,i,tag})=>
      <button key={i} data-act="symbol" data-id={i}><span><b>{stock.name}</b>
        <small>{listingDescription(stock)+(stock.kind==='주식'?' · '+stock.sector:'')}</small></span><em>{tag}</em></button>)}</div>
      :<p className="atlas-empty">이 나라와 관련된 거래소 종목이 없어.</p>}
  </section>;
}

function Currency({country,state}) {
  const code=country.currency,clock=marketClock(state);
  const rate=currencies[code] && code!=='KRW' ? fxRates(clock.day,clock.cursor)[code] : null;
  const text=rate?'1 '+code+' = '+rate.toLocaleString('ko-KR',{maximumFractionDigits:4})+'원':'';
  return <div className="atlas-currency"><div><small>법정 통화</small><b>{country.currencyName+' · '+code}</b></div>
    {text&&(isExchangeCurrency(code)?<button className="ui-control ui-compact" data-act="fx" data-value={code}>{text+' · 환전'}</button>:<span>{text}</span>)}
  </div>;
}

function ElectionInfo({country,state}) {
  if (country.id==='mora') return <div className="atlas-election">
    <div><small>서버 정치 일정</small><h3>{presidentialElectionTitle()}</h3></div>
    <button className="ui-control ui-compact" data-act="tab" data-tab="election">일정과 결과</button></div>;
  const scheduled=eventDay(country.electionDate);
  const delta=scheduled-(usesKst(state)?state.day:tapeCivilDay(state.day,state.cursor));
  return <div className="atlas-election"><div><div className="atlas-election-date">
    <small>게임 정치 일정</small><time dateTime={country.electionDate}>{dayLabel(state,scheduled)}</time></div>
    <h3>{country.election}</h3></div><b className={delta>=0&&delta<=7?'soon':''}>{dayBadge(delta)}</b></div>;
}

function CountryProfile({state,country,news}) {
  const result=country.id==='austran'?news.find(n=>n.event.id==='zelanda-election'):null;
  const president=electedPresident(country,politicalTick(state));
  const vacant=country.id==='mora'&&!president;
  const [orientation,...priorities]=country.orientation.split(' · ');
  const priority=president?.priority??priorities.join(' · ');
  const facts=[['권력 구조',country.leadership],['정당·이해관계',president?.opposition??country.counterweight],
    ['지리',country.geography],['종교·사회',country.society],['주요 교역',country.trade],['참여 기구',country.blocs.join(' · ')]];
  return <section className="atlas-profile"><article className="atlas-leadership" data-party-side={president?.id??country.partySide}>
    <header className="atlas-leader-heading"><p>{continents[country.continent].name+' · '+country.government}</p>
      <h3>{president?`${president.name} 대통령(${president.party})`:country.leader}</h3></header>
    {!vacant&&<div className="atlas-leader-body">{president
      ?<img className="atlas-leader-art" src={'/art/pixel/election-'+president.id+'.webp'} width={156} height={156} alt={president.name+' 초상화'}/>
      :<PixelArt id={'leader-'+country.id} className="atlas-leader-art" width={156} height={156} alt={countryAnimals[country.id]+' 지도자 초상화'}/>}
      <div className="atlas-party-summary"><small>{'집권당 · '+(president?.orientation??orientation)}</small>
        <b>{president?.party??country.party}</b>{priority&&<p>{priority}</p>}</div></div>}</article>
    <div className="atlas-country-facts"><ElectionInfo country={country} state={state}/>
      {result&&<button className="atlas-election-result" data-act="article" data-value={result.id}>
        {'뉴질랜드 지역의회 잠정 개표 · '+newsDate(result,state)+' 보도 보기'}</button>}
      <Currency country={country} state={state}/></div>
    <details className="atlas-facts"><summary className="ui-disclosure">정치·사회와 무역</summary>
      <dl>{facts.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </details></section>;
}

function Relations({state,country,news}) {
  const rows=byCountry(country.id).filter(r=>atlasView.kind==='all'||r.kind===atlasView.kind);
  const tick=politicalTick(state);
  const kinds=[['all','전체'],...Object.entries(relationKinds).map(([k,v])=>[k,v.name])];
  return <section className="atlas-subsection"><Heading title="양국 관계" level={2}>{rows.length+'개 관계'}</Heading>
    <div className="atlas-kind-tabs" aria-label="관계 유형">{kinds.map(([id,name])=>
      <button className="ui-control ui-compact" key={id} aria-pressed={id===atlasView.kind} data-act="atlas-kind" data-value={id}>{name}</button>)}</div>
    {rows.length?rows.map(r=>{
      const peer=other(r,country.id),tone=relationStances[stance(r,tick)],agenda=dialogue(r,tick);
      const selected=peer.id===atlasView.partner;
      return <button key={peer.id} className={'atlas-pair '+(selected?'selected':'')} data-act="atlas-relation" data-value={peer.id} aria-expanded={selected}>
        <span className="atlas-edge-type" style={{'--edge':tone.color}}>{tone.name}</span>
        <span><b><Flag nation={peer.id}/>{peer.name}</b><small>{r.title}</small>
          {agenda&&<small className="atlas-cooperation-label">{agenda[0]}</small>}</span>
        {latestUpdate(r,news)&&<i className="atlas-fresh" title="공개된 관계 뉴스"/>}<span className="atlas-disclose" aria-hidden="true"/>
      </button>;
    }):<p className="atlas-empty">공개된 이 유형의 협정이나 분쟁이 없어.</p>}
  </section>;
}

function Delegations({governments,tick}) {
  return <ul className="atlas-delegations" aria-label="참여 국가의 집권당">{governments.map(c=>{
    const president=electedPresident(c,tick),side=president?.id??c.partySide;
    return <li key={c.id} data-party-side={side}><small><Flag nation={c.id}/>{side==='vacant'?c.name:c.name+' · '+(side==='progressive'?'진보':'보수')}</small>
      <b>{president?.party??c.party}</b></li>;
  })}</ul>;
}

function PairDetails({state,country,peer,news}) {
  const relation=byCountry(country.id).find(r=>other(r,country.id).id===peer.id);
  if(!relation)return null;
  const tick=politicalTick(state),tone=relationStances[stance(relation,tick)],fresh=latestUpdate(relation,news),agenda=dialogue(relation,tick);
  const relevant=news.find(n=>n.countries?.includes(peer.id));
  const governments=[country,peer];
  return <article className="atlas-pair-detail" style={{'--edge':tone.color}}>
    <header><span><Flag nation={country.id}/>{country.name+' · '}<Flag nation={peer.id}/>{peer.name+' · '+tone.name}</span></header>
    <h3>{relation.title}</h3><p>{relation.detail}</p>
    {agenda&&<div className="atlas-pair-coverage atlas-cooperation"><small>새 정부의 첫 협의 안건</small><b>{agenda[0]}</b><p>{agenda[1]}</p></div>}
    {relation.kind==='party'&&<Delegations governments={governments} tick={tick}/>}
    <div className="atlas-exposure">관련 산업 <b>{relation.sector}</b></div>
    {fresh?<button className="atlas-current-story" data-act="article" data-value={fresh.story.id}>
      <small>{newsDate(fresh.story,state)}</small>
      <span className="news-story-title"><TopicBadge story={fresh.story}/><b>{fresh.text}</b></span></button>
      :relevant&&<div className="atlas-pair-coverage"><small>양국 관련 보도</small><ArticleButton story={relevant} state={state}/></div>}
    <div className="atlas-pair-countries">{governments.map(c=>
      <button key={c.id} className="atlas-open-country ui-control ui-compact" data-act="atlas-country" data-value={c.id}>{c.name} 국가 정보</button>)}</div>
  </article>;
}

function CountryContent({state,country,news}) {
  switch(atlasView.section){
    case 'relations':return <Relations country={country} state={state} news={news}/>;
    case 'stocks':return <Securities country={country}/>;
    case 'news':return <section className="atlas-subsection"><Heading title="관련 기사">{news.length}건</Heading>
      {news.length?news.slice(0,atlasView.more?news.length:4).map(item=><ArticleButton key={item.id} story={item} state={state}/>)
        :<p className="atlas-empty">이 시각까지 도착한 관련 보도가 없어.</p>}
      {news.length>4&&<button className="atlas-more ui-control" data-act="atlas-more">{atlasView.more?'접기':'기사 '+(news.length-4)+'건 더 보기'}</button>}
    </section>;
    default:return <CountryProfile state={state} country={country} news={news}/>;
  }
}

function Search() {
  return <>
    <label className="atlas-query-line"><span>국가명·대륙·통화</span>
      <input type="search" autoComplete="off" className="atlas-query" placeholder="한국, 유럽연합, USD…"/></label>
    <p className="atlas-find-counter" aria-live="polite" data-search-count="">{allCountries.length}개 국가·연합</p>
    <div className="atlas-find-list">{allCountries.map(c=>{
      const region=continents[c.continent].name;
      const keywords=[c.name,c.en,c.currency,c.currencyName,region,...(searchAliases[c.id]??[])];
      return <button key={c.id} className="atlas-find-result" data-act="atlas-country" data-value={c.id} data-search={keywords.join(' ')}>
        <span><Flag nation={c.id}/><b>{c.name}</b> <span lang="en">{c.en}</span></span><small>{region}</small></button>;
    })}<p data-search-empty="" hidden>일치하는 국가가 없어.</p></div>
  </>;
}

const sources=[
  ['https://data.ipu.org/compare/?field=designation_mode&structure=any__lower_chamber','의회 구성 방식 · IPU Parline'],
  ['https://data.wto.org/dataset/ext_rta','지역무역협정 구조 · WTO'],
  ['https://pes.eu/members/','국제 정당 협력 · PES'],
  ['https://pacificconferenceofchurches.org/climate-change-is-real/','태평양 교회와 기후 이주 · PCC'],
];

function Legend({country}) {
  const layers=[['all',{name:country.name+'의 모든 관계',color:'#b4d590'}],...Object.entries(relationStances)];
  return <>
    <div className="atlas-layer-list">{layers.map(([id,kind])=>
      <button key={id} className="ui-control" data-act="atlas-layer" data-value={id} aria-pressed={atlasView.stance===id}>
        <i style={{'--edge':kind.color}}/>{kind.name}<b aria-hidden="true">{id===atlasView.stance?'✓':''}</b></button>)}</div>
    <ul className="atlas-biomes" aria-label="지도 기후와 지형">{mapBiomes.map(([label,color])=>
      <li key={label}><i style={{'--terrain':color}}/>{label}</li>)}</ul>
    <details className="atlas-sources"><summary className="ui-disclosure">세계관과 자료</summary>
      <p>게임 속 {allCountries.length}개 국가·연합이 참여해. 관계는 기사에 나온 협정과 사건에 따라 달라져.</p>
      {sources.map(([url,text])=><a key={url} href={url} target="_blank" rel="noopener noreferrer">{text}</a>)}
    </details>
  </>;
}

export function AtlasPopover({state,country}) {
  const {panel,section,partner,viaCountry}=atlasView;
  let key,title,content;
  if(panel==='search'){key='search';title='국가 찾기';content=<Search/>;}
  else if(panel==='legend'){key='legend';title='지도 범례';content=<Legend country={country}/>;}
  else {
    const news=visibleStories(state).filter(n=>n.countries?.includes(country.id));
    if(panel==='pair'){
      const peer=countries[partner];
      if(!peer)return null;
      key='pair:'+country.id+'~'+peer.id;title='양국 관계';
      content=<>{viaCountry&&<button className="atlas-pair-back" data-act="atlas-back">‹ {country.name} 관계 목록</button>}
        <PairDetails state={state} country={country} peer={peer} news={news}/><Securities country={country} peer={peer}/></>;
    } else if(panel==='country'){
      key='country:'+country.id+':'+section;
      title=<><Flag nation={country.id}/><strong>{country.name}</strong><span lang="en">{country.en}</span></>;
      content=<CountryContent state={state} country={country} news={news}/>;
    } else return null;
  }
  return <atlas-popover key={key} data-key={key}>
    <section className={'atlas-dialog'+(panel==='country'?' atlas-country-dialog':'')} role="dialog" aria-modal="true" aria-labelledby="atlas-dialog-title">
      <div className="atlas-sheet-head"><h2 id="atlas-dialog-title" data-atlas-initial="" tabIndex={-1}>{title}</h2>
        <button className="atlas-dismiss ui-control ui-compact ui-icon" data-act="atlas-close" aria-label="지도 상세 닫기">×</button></div>
      {panel==='country'&&<nav className="atlas-profile-tabs" aria-label="국가 정보 분야">{atlasSections.map(([id,name])=>
        <button key={id} data-act="atlas-section" data-value={id} aria-current={id===section?'true':undefined}>{name}</button>)}</nav>}
      <div className="atlas-sheet-body" data-atlas-scroll="">{content}</div>
    </section>
  </atlas-popover>;
}
