import {isPublishedStory} from './news-relations.mjs';
import {deskBrief,firstEdition,visibleWireStories} from './press-wire.mjs';
import {ritualStory} from './ritual-news.mjs';

function hash(n){
  n=Math.imul(n^(n>>>16),0x45d9f3b);
  n=Math.imul(n^(n>>>16),0x45d9f3b);
  return (n^(n>>>16))>>>0;
}
// Each edition is at most one five-minute tick either side of its nominal slot.
// Adjacent print times are therefore 8–12 ticks apart, including across midnight.
const printTick=issue=>issue===0?0:issue*10+hash(issue)%3-1;
function firstIssueAt(tick){
  const candidate=Math.max(0,Math.round(tick/10));
  return printTick(candidate)<tick?candidate+1:candidate;
}
export const printedTick=story=>story.publishedAt??story.event.day*288+story.event.minute/5;

export function pressSchedule(stories){
  const archive=new Map(),issueById=new Map(),cache=new Map();
  const leads=firstEdition(Infinity).flatMap(e=>e.stories).filter(isPublishedStory);
  for(const story of [...stories,...leads].sort((a,b)=>a.event.tick-b.event.tick)){
    let issue=firstIssueAt(story.event.tick);
    while(archive.has(issue))issue++;
    archive.set(issue,story);
    issueById.set(story.id,issue);
  }
  function edition(issue){
    if(cache.has(issue))return cache.get(issue);
    const tick=printTick(issue);
    let story=archive.get(issue);
    if(!story){
      const pool=visibleWireStories(issue?printTick(issue-1):-1,tick)
        .filter(s=>!issueById.has(s.id)&&isPublishedStory(s));
      story=pool.length?pool[hash(issue+137)%pool.length]:deskBrief(issue,tick);
    }
    const printed={...story,publishedAt:tick};
    if(cache.size>=192)cache.delete(cache.keys().next().value);
    cache.set(issue,printed);
    return printed;
  }
  function ritualIssues(rows){
    const pending=new Map();
    for(const row of rows){
      // The immediate receipt remains readable; the stand gets the next available edition.
      let issue=firstIssueAt(row.tick+1);
      while(archive.has(issue)||pending.has(issue))issue++;
      pending.set(issue,row);
    }
    return pending;
  }
  function visible(now,rows){
    const last=firstIssueAt(now+1)-1,rituals=ritualIssues(rows);
    const issues=new Set([...archive.keys(),...rituals.keys()].filter(i=>i<=last));
    for(let i=Math.max(0,last-43);i<=last;i++)issues.add(i);
    return [...issues].sort((a,b)=>b-a).map(i=>rituals.has(i)
      ?{...ritualStory(rituals.get(i)),publishedAt:printTick(i)}:edition(i));
  }
  function lookup(story,now,rows){
    const known=issueById.get(story.id);
    const issue=known??firstIssueAt(story.event.tick);
    const selected=edition(issue);
    // Old saved links to stories outside the new selection still open their original articles.
    if(selected.id!==story.id||ritualIssues(rows).has(issue))return story;
    return selected.publishedAt<=now?selected:null;
  }
  function brief(id,now,rows){
    const match=/^brief-(\d+)-0$/.exec(id);
    if(!match)return null;
    const issue=Number(match[1]);
    if(!Number.isSafeInteger(issue)||printTick(issue)>now||ritualIssues(rows).has(issue))return null;
    const story=edition(issue);
    return story.id===id?story:null;
  }
  function ritual(row,now,rows){
    const slots=ritualIssues(rows);
    for(const [issue,queued] of slots)if(queued.id===row.id&&printTick(issue)<=now)
      return {...ritualStory(row),publishedAt:printTick(issue)};
    return ritualStory(row);
  }
  return {visible,lookup,brief,ritual};
}
