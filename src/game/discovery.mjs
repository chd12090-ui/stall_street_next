import {stocks,visibleStories,symbolIndex} from './world.mjs';

const watchKey='stall-street:watchlist:1';
let saved=[];
try{const raw=JSON.parse(localStorage.getItem(watchKey));if(Array.isArray(raw))saved=raw.filter(code=>Object.hasOwn(symbolIndex,code));}catch{}
export let watch=new Set(saved);
let persistWatch=values=>{try{localStorage.setItem(watchKey,JSON.stringify(values));}catch{}};
export function bindWatchlist(records,write){
  watch=new Set(Array.isArray(records.watch)?records.watch.filter(code=>Object.hasOwn(symbolIndex,code)):[]);
  persistWatch=write;
}
export function toggleWatch(code){
  if(!Object.hasOwn(symbolIndex,code)||stocks[symbolIndex[code]].archiveOnly&&!watch.has(code))return;
  if(watch.has(code))watch.delete(code);else watch.add(code);
  persistWatch([...watch]);
}
export function homeHeadlines(state){
  const sorted=visibleStories(state),seen=new Set();
  return sorted.filter(story=>{
    if(seen.has(story.event.id))return false;
    seen.add(story.event.id);return true;
  }).slice(0,12);
}
