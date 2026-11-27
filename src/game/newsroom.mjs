import {newspaperUpdates} from './exchange-events.mjs';
import {firstGameDay,marketClock,shortDayLabel,usesKst} from './clock-calendar.mjs';
import {visibleStories,printedTick,articleById} from './world.mjs';
import {calendar,tapeCivilDay} from './tape.mjs';
import {pressContext} from './press-context.mjs';
import {newsCategories,newsCategory} from './news-category.mjs';

const prefsKey='stall-street:newsroom:1';
let stored={};
try{stored=JSON.parse(localStorage.getItem(prefsKey))||{};}catch{}
// Old readers saved the IDs they translated; new readers start with the Korean edition.
const translateByDefault=stored.translateByDefault??!Array.isArray(stored.translated);
const savedExceptions=stored.translationExceptions??stored.translated;
let translationExceptions=new Set(Array.isArray(savedExceptions)?savedExceptions.filter(id=>typeof id==='string'):[]);
let persistTranslations=null;
export const articleTranslationChoices=()=>[...translationExceptions];
export function bindArticleTranslations(records,write){
  translationExceptions=new Set(Array.isArray(records.translations)?records.translations.filter(id=>typeof id==='string'):[]);
  persistTranslations=write;
}
function saveReadingPrefs(){
  const prefs={translateByDefault};
  if(!persistTranslations)prefs.translationExceptions=[...translationExceptions];
  try{localStorage.setItem(prefsKey,JSON.stringify(prefs));}catch{}
}
const filters={lean:'전체',topic:'all'};
const bilingual=story=>story.lang==='en'&&Boolean(story.en&&story.ko);
const isTranslated=story=>bilingual(story)&&translateByDefault!==translationExceptions.has(story.id);
const language=story=>story.lang==='en'&&!isTranslated(story)?'en':'ko';
const edition=(story,lang=language(story))=>story[lang]||story.ko||story;
export const headline=s=>s.title;
export const summary=s=>edition(s).lead;
export const newsTime=(story,state)=>calendar(0,printedTick(story),state);
const newsDay=story=>tapeCivilDay(0,printedTick(story));
export {shortDayLabel as newsDayLabel};
export const newsDate=(story,state)=>shortDayLabel(newsDay(story),firstGameDay(state));
export function publicationLabel(story,minute,openingDay){
  const tick=printedTick(story),day=tapeCivilDay(0,tick);
  const date=shortDayLabel(day,openingDay),elapsed=minute-Math.round(tick*5);
  if(tapeCivilDay(0,minute/5)!==day||elapsed<0)return date;
  if(!elapsed)return date+'(방금 전)';
  return date+'('+(elapsed<60?elapsed+'분':Math.floor(elapsed/60)+'시간')+' 전)';
}
function shelfGroups(state){
  const days=new Map();
  for(const story of visibleStories(state)){
    if(filters.lean!=='전체'&&filters.lean!==story.outletInfo.lean)continue;
    if(filters.topic!=='all'&&filters.topic!==newsCategory(story))continue;
    const day=newsDay(story);
    if(!days.has(day))days.set(day,[]);
    days.get(day).push(story);
  }
  return days;
}
const emptyMessage=()=>filters.lean==='전체'&&filters.topic==='all'?'아직 진열된 신문이 없어.':'선택한 조건에 맞는 기사가 없어.';
const publicationTick=state=>{const {day,cursor}=marketClock(state);return day*288+cursor;};
export function publicationMinute(state,tick=publicationTick(state)){
  const minute=state.wallMinute;
  const withinSlot=usesKst(state)&&Math.floor(minute/5)===state.cursor?minute%5:0;
  return tick*5+withinSlot;
}
export function refreshKiosk(screen,state){
  if(!screen.querySelector('.nr-stacks'))return false;
  newspaperUpdates.publish(state);
  return true;
}
export function articleBody(article){
  const lang=language(article),txt=edition(article,lang);
  const body=txt.body.slice(),visibleText=body.join(' ');
  const added=(pressContext[article.event.id]?.[lang]||[]).filter(([cue])=>!cue.test(visibleText)).map(([,sentence])=>sentence);
  if(added.length)body.splice(1,0,added.join(' '));
  return body;
}
export function newsAction(name,el,state){
  if(name==='news-lean'&&['전체','보수','진보','해외'].includes(el.dataset.value)){filters.lean=el.dataset.value;return true;}
  if(name==='news-translation'){
    const reader=el.closest('.nr-article'),article=articleById(state,reader.dataset.articleId);
    if(!article||!bilingual(article))return false;
    if(translationExceptions.has(article.id))translationExceptions.delete(article.id);
    else translationExceptions.add(article.id);
    if(persistTranslations)persistTranslations([...translationExceptions]);
    else saveReadingPrefs();
    return true;
  }
  return false;
}
export function newsChange(el){
  if(el.id!=='edition-topic'||(el.value!=='all'&&!Object.hasOwn(newsCategories,el.value)))return false;
  filters.topic=el.value;
  return true;
}

export {filters as newspaperFilters, language, bilingual, isTranslated, shelfGroups, emptyMessage, publicationTick};
