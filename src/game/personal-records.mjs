import {roomStorageKey} from './room-session.mjs';
import {bindBotThreads} from './friend-threads.mjs';
import {bindWatchlist,watch} from './discovery.mjs';
import {bindChartDrawings,chartDrawings,convertOldCoinDrawings} from './terminal.mjs';
import {bindArticleTranslations,articleTranslationChoices} from './newsroom.mjs';
import {bindBankChoice,bankOfferChoice} from './credit-view.mjs';

const base='stall-street:personal-records:1';
const legacyOwner=base+':legacy-owner';
let activeKey,activeRun;

function read(key){
  try{return JSON.parse(localStorage.getItem(key));}catch{return null;}
}

function removeLegacyRecords(){
  localStorage.removeItem('stall-street:watchlist:1');
  localStorage.removeItem('stall-street:credit-offer-choice:1');
  const chartKey='stall-street:chart-settings:1',readerKey='stall-street:newsroom:1';
  const chart=read(chartKey),reader=read(readerKey);
  if(chart&&Object.hasOwn(chart,'drawings')){
    delete chart.drawings;
    localStorage.setItem(chartKey,JSON.stringify(chart));
  }
  if(reader&&(Object.hasOwn(reader,'translated')||Object.hasOwn(reader,'translationExceptions'))){
    reader.translateByDefault??=!Array.isArray(reader.translated);
    delete reader.translated;
    delete reader.translationExceptions;
    localStorage.setItem(readerKey,JSON.stringify(reader));
  }
}

export function bindPersonalRecords(state){
  const key=roomStorageKey(base),run=state.resetId??'first-game';
  if(activeKey===key&&activeRun===run)return;
  const currentGame=read(roomStorageKey('stall-street:pixel-week:1'));
  if(currentGame&&(currentGame.resetId??'first-game')!==run)return;
  let records=read(key);
  if(!records||records.run!==run){
    let migrate=false;
    try{
      // Before room-scoped records existed, one set of choices was shared by this browser.
      // The first game opened after the upgrade adopts that existing set once.
      const owner=localStorage.getItem(legacyOwner);
      if(!records&&!activeKey&&!state.roomProgressId&&(!owner||owner===key+'/'+run)){
        if(!owner)localStorage.setItem(legacyOwner,key+'/'+run);
        migrate=true;
      }
    }catch{}
    records=migrate?{run,nyangUnits:true,watch:[...watch],drawings:chartDrawings(),translations:articleTranslationChoices(),bankChoice:bankOfferChoice()}:{run,nyangUnits:true};
    try{
      localStorage.setItem(key,JSON.stringify(records));
      if(migrate)removeLegacyRecords();
    }catch{}
  }
  if(!records.nyangUnits){
    convertOldCoinDrawings(records.drawings);
    records.nyangUnits=true;
    try{localStorage.setItem(key,JSON.stringify(records));}catch{}
  }
  activeKey=key;activeRun=run;
  const saveField=field=>value=>{
    // A delayed callback or a tab still on the previous run must not restore its records.
    const latest=read(key);
    if(latest?.run!==run)return;
    try{localStorage.setItem(key,JSON.stringify({...latest,[field]:value}));}catch{}
  };
  bindWatchlist(records,saveField('watch'));
  bindChartDrawings(records,saveField('drawings'));
  bindArticleTranslations(records,saveField('translations'));
  bindBankChoice(records,saveField('bankChoice'));
  bindBotThreads(state);
}
