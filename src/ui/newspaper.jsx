import React,{memo,useLayoutEffect,useMemo,useRef,useState} from 'react';
import * as news from '../game/newsroom.mjs';
import {articleById,visibleStories,printedTick,tradeNewsLinks,symbolIndex,stocks,fmtMoney} from '../game/world.mjs';
import {newsCategories} from '../game/news-category.mjs';
import {relatedIndustryIds} from '../game/news-relations.mjs';
import {industryLabels} from '../game/industries.mjs';
import {firstGameDay} from '../game/clock-calendar.mjs';
import {desks} from '../game/press-desks.mjs';
import {countries} from '../game/atlas-data.mjs';
import {Flag,TopicBadge,StorefrontArt} from './news-marks.jsx';
export {TopicBadge};
import {localRates} from '../game/market.mjs';
import {listingDescription} from '../game/securities-data.mjs';
import {quoteInfo} from '../game/tape.mjs';
import {newspaperUpdates} from '../game/exchange-events.mjs';
import {Select,useViewUpdate,ShareButton} from './exchange-controls.jsx';
import {RitualPage} from './ritual.jsx';
import {PetHand,PetTarget} from './petting.jsx';
import {petCharacter,petDuration} from '../game/player-character.mjs';
import {playGameSound} from '../game/game-audio.mjs';
import {AtlasPage} from './atlas.jsx';
import {ArticleImpact} from './news-evidence.jsx';

const PaperCover=memo(function PaperCover({story,date,arriving}){
  return <button className={'nr-cover cover-'+story.outletInfo.publisher+(arriving?' nr-arriving':'')} type="button" data-act="article" data-value={story.id}>
    <span className="nr-cover-top"><time className="nr-cover-date">{date}</time><TopicBadge story={story}/></span>
    <strong lang="ko">{news.headline(story)}</strong><i className="nr-cover-print" aria-hidden="true"/></button>;
});

// Capture the reader's visible paper before React inserts a newly published edition.
class PaperShelves extends React.Component{
  node=React.createRef();
  getSnapshotBeforeUpdate(){
    const stacks=this.node.current,screen=stacks?.closest('#screen');
    if(!screen)return null;
    const top=screen.getBoundingClientRect().top,active=document.activeElement;
    const anchor=stacks.getBoundingClientRect().top<top&&Array.from(stacks.querySelectorAll('.nr-cover')).find(p=>p.getBoundingClientRect().bottom>top);
    return {screen,anchor,y:anchor&&anchor.getBoundingClientRect().top,focused:stacks.contains(active)?active:null};
  }
  componentDidUpdate(old,state,snapshot){
    if(!snapshot)return;
    const {screen,anchor,y,focused}=snapshot;
    if(anchor?.isConnected)screen.scrollTop+=anchor.getBoundingClientRect().top-y;
    if(focused&&!focused.isConnected)(this.node.current.querySelector('.nr-cover')||screen.querySelector('#edition-topic'))?.focus({preventScroll:true});
  }
  render(){
    const {groups,openingDay,minute,through,previous}=this.props;
    return <div className="nr-stacks" data-through={through} ref={this.node}>{groups.size?[...groups].map(([day,stories])=>{
      const date=news.newsDayLabel(day,openingDay);
      return <section className="nr-shelf-section" data-day={day} key={day}><h2>{date} 신문</h2><div className="nr-shelves">
        {stories.map(story=><PaperCover key={story.id} story={story} date={news.publicationLabel(story,minute,openingDay)} arriving={printedTick(story)>previous&&printedTick(story)<=through}/>)}</div></section>;
    }):
      <p className="nr-empty">{news.emptyMessage()}</p>}</div>;
  }
}

function Storefront({sound}){
  function pet(button){
    if(petCharacter(button)&&sound)playGameSound('pet');
  }
  return <div className="nr-storefront" data-pet-stage="" style={{'--pet-duration':petDuration+'ms'}}>
    <StorefrontArt/>
    <PetHand className="nr-hand-anchor"/>
    <PetTarget className="nr-seller-target" label="가판대 고양이 쓰다듬기" onPet={pet}/>
  </div>;
}

function NewspaperStand({initial}){
  const state=useViewUpdate(initial,newspaperUpdates),filters=news.newspaperFilters,through=news.publicationTick(state);
  const groups=useMemo(()=>news.shelfGroups(state),[through,filters.lean,filters.topic,state.ritualEvents]);
  const previous=useRef(through),prior=previous.current;previous.current=through;
  return <section className="nr-kiosk news-stand"><header className="nr-header">
    <Storefront sound={state.sound}/>
    <div className="nr-controls"><nav aria-label="신문 성향">{['전체','보수','진보','해외'].map(lean=>
      <button type="button" className="ui-control ui-compact" key={lean} data-act="news-lean" data-value={lean} aria-pressed={lean===filters.lean}>{lean}</button>)}</nav>
      <label className="nr-topic"><Select className="ui-compact" aria-label="기사 종류" id="edition-topic" value={filters.topic}><option value="all">전체 주제</option>
        {Object.entries(newsCategories).map(([id,{label}])=><option key={id} value={id}>{label}</option>)}</Select></label>
    </div></header><PaperShelves openingDay={firstGameDay(state)} minute={news.publicationMinute(state,through)} through={through} previous={prior} groups={groups}/></section>;
}
function ArticleDate({story,state:initial}){
  const state=useViewUpdate(initial,newspaperUpdates);
  return <time>{news.publicationLabel(story,news.publicationMinute(state),firstGameDay(state))}</time>;
}
function ReadingOptions({article,impactOpen,toggleImpact}){
  return <div className="nr-reading-toggles" role="group" aria-label="기사 읽기 설정">
    {news.bilingual(article)?<button type="button" className="ui-control ui-compact" data-act="news-translation" aria-pressed={news.isTranslated(article)}>한국어 번역</button>:<button type="button" className="ui-control ui-compact" disabled>한국어 원문</button>}
    <button type="button" className="ui-control ui-compact" aria-expanded={impactOpen} aria-controls="article-analysis" onClick={toggleImpact}>기사 분석</button></div>;
}
function RelatedStocks({state,title,codes}){
  const format=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2,minimumFractionDigits:2,signDisplay:'exceptZero'});
  return codes.length?<section className="nr-related"><h2>{title}</h2><div className="nr-quotes">{codes.map(c=>{
    const i=symbolIndex[c],a=stocks[i],q=quoteInfo(state,i);
    return <div key={c} className="related-row"><button data-act="symbol" data-id={i}><span><b>{a.name}</b><small><Flag nation={a.country}/> {listingDescription(a)}</small></span>
      <span><b>{fmtMoney(q.price,a.currency)}</b><small className={q.pct>0?'gain':q.pct<0?'loss':''}>{format.format(q.pct)}%</small></span></button></div>;
  })}</div></section>:null;
}
function ReadingCopy({article}){
  return <div className="nr-copy" lang={news.language(article)}>
    {news.articleBody(article).map((text,i)=><p className="nr-body" key={i}>{text}</p>)}
  </div>;
}
function RelatedMarkets({state,article,children}){
  const ids=(article.countries||[]).filter(c=>countries[c]),{direct,indirect}=tradeNewsLinks(article);
  const industries=relatedIndustryIds(article);
  const dollarRate=article.event.fx.USD===undefined?null:localRates(state).USD;
  return <div className="nr-related-groups">{industries.length>0&&<section className="nr-related">
    <h2>관련 업종</h2><ul className="nr-chips nr-industries">{industries.map(id=>
      <li className="nr-industry" key={id} data-industry-id={id}>{industryLabels[id]}</li>)}</ul>
    </section>}
    {ids.length>0&&<section className="nr-related"><h2>관련 국가·연합</h2><div className="nr-chips">{ids.map(id=>
      <button className="ui-control ui-compact" key={id} data-act="open-atlas" data-value={id}><Flag nation={id}/>{countries[id].name}</button>)}</div></section>}
    <RelatedStocks state={state} title="관련 종목" codes={direct}/><RelatedStocks state={state} title="간접 영향 종목" codes={indirect}/>
    {dollarRate!==null&&<section className="nr-related"><h2>관련 환율 <small>현재 원화 기준</small></h2><div className="nr-chips">
      <button className="ui-control ui-compact" data-act="fx">{'1달러 · '+dollarRate.toLocaleString('ko-KR',{maximumFractionDigits:2})+'원'}</button>
    </div></section>}
    {children}
  </div>;
}
function Article({state,article:a,view}){
  const d=desks[a.outlet],peers=visibleStories(state).filter(p=>p.id!==a.id&&p.event.id===a.event.id);
  const [impactOpen,setImpactOpen]=useState(view?.impactOpen??false);
  const impactHeading=useRef(null),jumpToImpact=useRef(false);
  useLayoutEffect(()=>{
    if(!impactOpen||!jumpToImpact.current)return;
    jumpToImpact.current=false;
    impactHeading.current?.focus({preventScroll:true});
    impactHeading.current?.scrollIntoView({block:'start'});
  },[impactOpen]);
  function toggleImpact(){
    jumpToImpact.current=!impactOpen;
    setImpactOpen(!impactOpen);
  }
  return <div className="page nr-article" data-article-id={a.id}><header className="nr-reader-bar view-heading"><button className="detail-back" type="button" data-act="article-back" aria-label="뒤로가기"><i className="ico i-down" aria-hidden="true"/></button>
    <ReadingOptions article={a} impactOpen={impactOpen} toggleImpact={toggleImpact}/></header><article className={'nr-paper nr-'+d.layout} lang="ko">
    <header><div className="nr-paper-top"><ArticleDate story={a} state={state}/><TopicBadge story={a}/></div>
      <h1>{news.headline(a)}</h1></header>
    <ReadingCopy article={a}/></article>
    <ArticleImpact state={state} story={a} open={impactOpen} onOpenChange={setImpactOpen} summaryRef={impactHeading} initialCode={view?.impactCode}/>
    <div className="nr-share"><ShareButton kind="news" content={a.id}/></div>
    <RelatedMarkets state={state} article={a}>
      {peers.length>0&&<section className="nr-related"><h2>같은 사건, 다른 보도</h2>{peers.map(story=><button key={story.id} className="nr-line" type="button" data-act="article" data-value={story.id}><span className="nr-line-meta"><ArticleDate story={story} state={state}/><TopicBadge story={story}/></span><span className="news-story-title"><strong lang="ko">{news.headline(story)}</strong></span></button>)}</section>}
    </RelatedMarkets>
  </div>;
}
export function NewsPage({state,articleId,articleView,world,ritual}){
  if(!world&&!ritual&&articleId){const article=articleById(state,articleId);return article?<Article key={articleId} state={state} article={article} view={articleView}/>:<NewspaperStand initial={state}/>;}
  const heading=<header className={'feed-switch view-heading'+(ritual?' ritual-heading':world?'':' newsstand-heading')}><h1>{ritual?'살굿':'소식'}</h1><nav aria-label="소식 분야">
    {[['paper','news','신문'],['world','globe','국제'],['ritual','spark','살굿']].map(([id,pic,label])=><button key={id} type="button" data-act="tab" data-tab={'news/'+id} aria-current={id===(ritual?'ritual':world?'world':'paper')?'page':undefined}>
      <i className={'ico i-'+pic+' '} aria-hidden="true"/>{label}</button>)}</nav></header>;
  return <>{heading}{ritual?<RitualPage state={state}/>:world?<AtlasPage state={state}/>:<NewspaperStand initial={state}/>}</>;
}
