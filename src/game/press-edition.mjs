import {reportingOutlet} from './press-data.mjs';
import {englishEditions} from './press-english.mjs';
import {factFiles} from './press-facts.mjs';
export {openingBriefs,electionBulletin} from './press-regions.mjs';

export function prepareEvent(event){
 const doc=factFiles[event.id];
 const stories=event.stories.map(story=>{
   const countries=story.countries??doc?.countries??event.countries??[];
   const outlet=reportingOutlet(story.outlet,countries);
   const ko=story.ko??{title:story.title,lead:story.lead,body:story.body};
   const en=story.en??englishEditions[event.id]?.[story.outlet];
   if(doc&&outlet.lean==='해외'&&!en)throw new Error('Missing English original '+event.id+'/'+story.outlet);
   return {...story,...(en??ko),outlet:outlet.id,title:ko.title,lang:en?'en':'ko',ko,en,countries,document:doc};
 });
 const countries=[...new Set(stories.flatMap(story=>story.countries))];
 return {...event,countries,stories};
}
