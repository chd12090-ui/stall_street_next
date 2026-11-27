import {newsCategories,newsCategory} from '../game/news-category.mjs';
import {flagPath} from '../game/country-flags.mjs';

export function Flag({nation}){
  const path=flagPath(nation);
  return path?<img className="country-flag" src={path} width="24" height="16" decoding="async" alt=""/>:null;
}
export function TopicBadge({story}){
  const id=newsCategory(story),{label,icon}=newsCategories[id];
  return <span className="news-category" data-news-category={id} title={label+' 뉴스'}><i className={'ico i-'+icon} aria-hidden="true"/>{label}</span>;
}

export function StorefrontArt(){
  return <>
    <img className="nr-booth" src="/art/pixel/kiosk-booth.webp" width="160" height="77" alt="" draggable={false}/>
    <picture className="nr-seller" aria-hidden="true">
      <source media="(prefers-reduced-motion: reduce)" srcSet="/art/pixel/kiosk-still.webp"/>
      <img src="/art/pixel/kiosk.webp" width="24" height="27" alt="" draggable={false}/>
    </picture><h2>신문 가판대</h2>
  </>;
}
