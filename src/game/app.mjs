import {paintDialog,paintFeedback,paintNavigation,paintNotice,paintScreen} from '../ui/game.jsx';
import {activityNames} from './investment-activity.mjs';
import {householdSnapshot} from './status.mjs';
import {stocks,roll,projected,limit,orderAmounts,orderFeeRate,localRates,placeOrder,loadable,upgrade,exchangeable,exchange,netWealth,takeDeskLoan,repayDeskLoan,chargeLiveSpending,spendingInterval,todayLiveSpending,mentalDecayRate} from './market.mjs';
import {quoteAt} from './tape.mjs';
import * as terminal from './terminal.mjs';
import {currencies,symbolIndex,quantityUnit,articleById,fmtMoney,snapPrice,quantityRound} from './world.mjs';
import * as discover from './discovery.mjs';
import * as broker from './broker.mjs';
import {calendarDay} from './exchange-calendar.mjs';
import * as news from './newsroom.mjs';
import {newsCategory} from './news-category.mjs';
import {handleAtlas,openAtlasRoute,atlasRouteSuffix} from './atlas.mjs';
import {creditAction,creditInput,setBankDesk,bankLoanContract} from './credit-view.mjs';
import {loanDeskInput,loanDeskPreset,refreshLoanDesk,clearLoanDeskDraft,deskLoanDraftAmount,loanDeskNext,loanDeskStage,deskLoanContract,setLoanDeskToss,loanDiceTiming} from './loan-desk-view.mjs';
import {deskLoanBalance,deskLoanRequestError,deskRerollAdSeconds,rollDeskRate} from './loan-desk.mjs';
import {loanContractBody,loanRepaymentBody,refreshFinancialView} from './loan-flow.mjs';
import {characterPoses,petCharacter} from './player-character.mjs';
import {findFriendProfile} from './league-profile.mjs';
import {communityRoute,chatCode,refreshChat,changeChat,paintChat,setChatDraft,shareTarget,refreshPresence} from './community.mjs';
import {bindElectionCalendar,refreshElection,useElectionReset,canRepairOldBallot,voteInElection} from './election.mjs';
import {finishIntimidation,intimidationFee,intimidationReportNotices,markIntimidationReportsRead,queueIntimidations,reserveIntimidation} from './desk-intimidation-state.mjs';
import {acknowledgeIntimidations,fetchIntimidations,sendIntimidation} from './desk-intimidation.mjs';
import {finishDeskCharge,reserveDeskCharge} from './desk-charges.mjs';
import {botTradingSnapshot,tradingSnapshot} from './spy-snapshot.mjs';
import {spyQuote,spyRequest,validSpyReport} from './desk-reports.mjs';
import {intimidateTestFriend,testFriend,testFriends} from './test-friends.mjs';
import {sendBotChat,threadForStorage} from './friend-threads.mjs';
import {bindFortuneLever} from './fortune.mjs';
import {canDrawFortune,canUnlockFortuneReroll,fortuneRerollAdSeconds,lineWins,unlockFortuneReroll} from './fortune-rules.mjs';
import {muteGame,bindSelectionAudio,playGameSound,prepareGameAudio,preparePaperAudio,stopPaperAudio,stopFortuneAudio,prepareRitualAudio,playRitualAudio,stopRitualAudio} from './game-audio.mjs';
import {mentalRecoveryDue,startLive,syncLiveClock} from './live-clock.mjs';
import {gameClockRate,gameTime,gameTimestamp,usesKst} from './clock-calendar.mjs';
import {amountFromText,applyAmountGrouping,groupAmount} from './number-entry.mjs';
import {fxDebitFor,isExchangeCurrency} from './fx.mjs';
import {recoveryStatus,grantRecovery,watchGameAd} from './recovery-ad.mjs';
import {negotiateSalary,negotiationAdSeconds,salaryQuote,todaysNegotiation} from './salary-negotiation.mjs';
import {applyForRehabilitation,leaveRehabilitationSession,rehabilitationView,startRehabilitationRound,stopRehabilitationRound} from './rehabilitation.mjs';
import {afterHomePat} from './home-pet-recovery.mjs';
import {buyGlasses,forecastWithGlasses,hasGlasses} from './ai-glasses.mjs';
import {reserveRitual,localRitualResult,finishRitual,cancelRitual,ritualUsedToday} from './ritual.mjs';
import {readRoomRituals,mergeRoomRituals,sendRoomRitual,sharedRituals} from './ritual-room.mjs';
import {getRoomSession,migrateLegacyGame,resetRoomProgress,setRoomProgressId,getConfirmedRoomProgressId,repairRoomRitual,roomFetch,gameSaveBase} from './room-session.mjs';
import {acknowledgeProgressReset,adoptRoomProgress,legacyRitualOrphan,repairGuestRitual,restartProgress,sharedRitualRepairDue} from './game-progress.mjs';
import {bindPersonalRecords} from './personal-records.mjs';
import {homeClockUpdates,newspaperUpdates} from './exchange-events.mjs';



const $ = selector => document.querySelector(selector);
const frame = $('#frame'), screen = $('#screen'), tabbar = $('#tabbar'), overlay = $('#overlay');
const storeKey=await migrateLegacyGame(gameSaveBase,loadable);
const savedGame=await openSavedProgress();
setRoomProgressId(savedGame?.roomProgressId??'');
let [intimidationView,openingRituals]=savedGame?.roomProgressResets?.length?[null,null]:
  await Promise.all([fetchIntimidations(900),readRoomRituals(savedGame?.ritualCursor??0,900)]);
let connectedSince=Date.now();
const openingState=readState()??startLive(null,connectedSince,connectedSince);
if(openingState.resetId!==savedGame?.resetId){intimidationView=null;openingRituals=null;}
mergeRoomRituals(openingState,openingRituals);
if(intimidationView)queueIntimidations(openingState,intimidationView.incoming);
let state=startLive(openingState,connectedSince,connectedSince);
bindElectionCalendar(state);
setRoomProgressId(state.roomProgressId??'');
bindPersonalRecords(state);
function readState(){
  try{
    const saved=JSON.parse(localStorage.getItem(storeKey));
    if(!loadable(saved))return null;
    const game=upgrade(saved);
    if(getRoomSession()?.mode==='guest')repairGuestRitual(game);
    return game;
  }catch{return null;}
}

async function openSavedProgress(){
  const saved=readState(),confirmed=getConfirmedRoomProgressId();
  if(confirmed===undefined||confirmed===(saved?.roomProgressId??'')||saved?.roomProgressResets?.length)return saved;
  // Re-check online while holding the same lock as resets, since the lobby may have been open
  // while another tab reset. Offline or a failed read must leave the local game intact.
  return withSaveLock(async()=>{
    const current=readState();
    if(current?.roomProgressResets?.length)return current;
    try{
      const response=await roomFetch('./api/progress/reset',{cache:'no-store',signal:AbortSignal.timeout(5000)});
      if(!response.ok)return current;
      const {progressId}=await response.json();
      const latest=readState();
      if(latest?.resetId!==current?.resetId||latest?.roomProgressResets?.length||typeof progressId!=='string'||
         progressId===(latest?.roomProgressId??''))return latest;
      // A new, empty server database may not have received the local reset yet.
      const aligned=progressId?adoptRoomProgress(latest,progressId,{shared:sharedRituals()}):
        {...latest,roomProgressResets:[{previousId:'',resetId:latest.roomProgressId,resetAt:latest.progressStartedAt??Date.now()}]};
      localStorage.setItem(storeKey,JSON.stringify(aligned));
      return aligned;
    }catch{return readState();}
  });
}

const tabs = [
  ['home','home','홈'], ['assets','coin','자산'], ['news','news','소식'], ['market','market','거래소'], ['league','users','친구'],
];
let tab='home', lastFeed='paper', assetId=null, articleId=null, leagueView='', modal = null, returnFocus = null, toastTimer = 0;
let assetsView='overview',marketCalendar=false;
let chatInvite='',dialogSession=0;
let deferredSettlementNotice=false,deferredDayReport=false,chartRenderPending=false;
const spinTimers=[];
let headlineIndex=0,homeNews=[];
let characterPreview='auto';
let spendingTimer=0,nextSpendingAt=0,pausedSpending=null;
const spendingPauseKey=storeKey+':paused-spending';
const won=n=>fmtMoney(n,'KRW');
const quantity=q=>q.toLocaleString('ko-KR',{maximumFractionDigits:8});

const closed = () => state.phase === 'closed';
const feedback = msg => {
  const toast = $('#toast');
  clearTimeout(toastTimer);paintFeedback(toast,msg);toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2100);
};
function save(value=state,{syncPortfolio=true}={}) {
  try {
    const current=localStorage.getItem(storeKey);
    if(current&&JSON.parse(current)?.resetId!==state.resetId)return false;
    localStorage.setItem(storeKey,JSON.stringify(value));
    if(syncPortfolio&&intimidationView?.selfSlot)queueMicrotask(syncSpyProfile);
    return true;
  } catch {return false;}
}
function beep(cue, detail) {
  if (state.sound) playGameSound(cue, detail);
}
function renderNavigation() {
  const navSection=['credit','loan-desk'].includes(tab)?'assets':['international','ritual'].includes(tab)?'news':tab==='election'?'home':tab;
  if(frame.dataset.section!==tab)frame.dataset.section=tab;
  const navKey=navSection+'/'+lastFeed;
  if(tabbar.dataset.route===navKey)return;
  tabbar.dataset.route=navKey;
  paintNavigation(tabbar,tabs,navSection,lastFeed);
}
function homeOptions() {
  const feed=discover.homeHeadlines(state).map(story=>({id:story.id,title:news.headline(story),category:newsCategory(story)}));
  if(feed[0]?.id!==homeNews[0]?.id)headlineIndex=0;
  homeNews=feed;
  headlineIndex=homeNews.length?headlineIndex%homeNews.length:0;
  return {latest:homeNews[headlineIndex],characterPreview};
}
function rotateHeadline(){
  if(tab!=='home'||modal||document.hidden||homeNews.length<2)return;
  const button=screen.querySelector('.pov-headline');
  if(!button||document.activeElement===button)return;
  headlineIndex=(headlineIndex+1)%homeNews.length;
  renderScreen();
}
function renderScreen(rebuildHeadlines=false){
  const options=tab==='home'?(rebuildHeadlines?homeOptions():{latest:homeNews[headlineIndex],characterPreview}):undefined;
  paintScreen(screen,{tab,state,options,assetsView,articleId,articleView:articleViews.get(articleId),assetId,marketCalendar,leagueView,chatInvite});
}
function render(){
  chartRenderPending=false;
  const last=screen.scrollTop;
  const chat=screen.querySelector('.friend-chat-log');
  const chatTop=chat&&chat.scrollHeight-chat.scrollTop-chat.clientHeight>=80?chat.scrollTop:null;
  renderNavigation();
  renderScreen(true);
  screen.scrollTop=last;
  const transcript=screen.querySelector('.friend-chat-log');
  if(transcript)transcript.scrollTop=chatTop??transcript.scrollHeight;
}
const viewingChat=()=>tab==='league'&&['','chat'].includes(leagueView);
function showChatUpdate(update){
  if(!viewingChat()||!update.changed)return;
  if(!paintChat(screen,chatInvite,{...update,reset:update.roomChanged}))render();
}
async function chatPulse(){
  if(document.hidden||tab!=='league')return;
  if(!leagueView||testFriend(leagueView))refreshPresence();
  if(viewingChat())showChatUpdate(await refreshChat());
}
async function chatAction(action,value){
  const update=await changeChat(action,value);
  if(update.joined)void intimidationPulse();
  if(update.joined&&viewingChat()){setChatDraft('');route('league/chat');return;}
  showChatUpdate(update);
}
async function sendChatForm(form){
  const input=form.elements.message, content=input.value.trim();
  if(!content)return;
  const view=leagueView;
  const submit=form.querySelector('[type="submit"]');
  submit.disabled=true;
  try {
    const message={kind:'text',content};
    const person=testFriend(view);
    const update=person?await sendBotChat(view,message):await changeChat('send',message);
    if(update.sent&&input.value.trim()===content){
      input.value='';setChatDraft('',view);
    }
    if(person){
      if(update.error)feedback(update.error);
      if(update.sent&&leagueView===view)paintChat(screen,'',{sent:true,view});
    }else showChatUpdate(update);
  } finally { submit.disabled=false; }
}
async function sendChatShare(){
  const active=modal;
  if(active?.type!=='chat-share'||active.pending)return;
  const {kind,content}=active.target;
  active.pending=true;active.error='';
  updateModal();
  const message={kind,content,...active.assetTotals};
  const room=testFriend(active.recipient)?active.recipient:'chat';
  const result=room==='chat'?await changeChat('send',message):await sendBotChat(room,message);
  if(modal!==active)return;
  if(result.sent){go('league/'+room);feedback('친구 채팅에 보냈어.');return;}
  active.pending=false;active.error=result.error||'잠시 후 다시 보내 줘.';updateModal();
}
function chatKeyboard(){
  const frame=$('#frame'), viewport=window.visualViewport;
  const focused=document.activeElement?.id==='friend-chat-input';
  const height=viewport?.height??innerHeight;
  const active=focused&&viewport?.scale===1&&innerHeight-height>100;
  if(active)frame.style.setProperty('--chat-keyboard-height',Math.floor(height)+'px');
  else frame.style.removeProperty('--chat-keyboard-height');
  frame.toggleAttribute('data-chat-keyboard',active);
}
function showElectionUpdate({changed,policy,stamped}){
  if(tab==='election'&&changed){
    const panels=['.election-promises','.election-rules','.election-history'].map(selector=>[selector,screen.querySelector(selector)]);
    const focused=document.activeElement;
    const candidate=focused?.dataset.act==='election-vote'?focused.dataset.value:null;
    render();
    for(const [selector,panel] of panels){
      const next=screen.querySelector(selector);
      if(!next)continue;
      if(panel?.open)next.open=true;
      if(panel?.contains(focused))next.querySelector('summary')?.focus({preventScroll:true});
    }
    const stamp=screen.querySelector('.election-own');
    if(stamped&&stamp){
      stamp.classList.add('election-stamp-hit');
      const ticket=screen.querySelector('.election-ticket');
      ticket?.classList.add('election-ticket-in');
      ticket?.addEventListener('animationend',()=>ticket.classList.remove('election-ticket-in'),{once:true});
      beep('ballotStamp');
    }
    if(candidate){
      const button=[...screen.querySelectorAll('[data-act="election-vote"]')].find(entry=>entry.dataset.value===candidate);
      (button||stamp)?.focus({preventScroll:true});
    }else if(focused?.classList.contains('election-own'))stamp?.focus({preventScroll:true});
  }else if(policy&&!modal&&['home','news','international'].includes(tab)){
    const current=location.hash.slice(1);
    if(tab==='news'&&!articleId&&current.startsWith('news/paper/')&&articleById(state,current.split('/')[2])){
      route(current);return;
    }
    render();
  }else if(tab==='home'&&changed){
    renderScreen();
  }
}
async function repairOldBallot(){
  const game=state.resetId;
  await withSaveLock(()=>{
    if(!stillCurrentGame(game)||!canRepairOldBallot(state))return;
    const next={...state,electionResetVersion:1,electionReset:{resetId:game,resetAt:Date.now()}};
    if(!save(next)){feedback('투표 초기화를 저장하지 못했어. 다시 시도해 줘.');return;}
    state=next;
    useElectionReset(next.electionReset);
    showElectionUpdate({changed:true});
  });
  await electionPulse();
}
async function electionPulse(){
  if(state.roomProgressResets?.length&&!await syncProgressResets())return;
  const game=state.resetId,update=await refreshElection();
  if(state.resetId!==game)return;
  if(update.acknowledgedReset){
    await withSaveLock(()=>{
      restoreLatestState();
      if(state.electionReset?.resetId===update.acknowledgedReset){delete state.electionReset;save();}
    });
  }
  showElectionUpdate(update);
}
const listPosition={market:0,news:0};
const articleViews=new Map();
function rememberArticleView() {
  const impact=screen.querySelector('.nr-article .nr-evidence');
  articleViews.delete(articleId);
  articleViews.set(articleId,{
    scrollTop:screen.scrollTop,
    impactOpen:impact?.open??false,
    impactCode:impact?.dataset.impactCode,
  });
  if(articleViews.size>12)articleViews.delete(articleViews.keys().next().value);
}
const validSection=section=>['status','credit','loan-desk','international','ritual','election'].includes(section)||tabs.some(([id])=>id===section);
function route(path,write=false){
  const [first,second,third]=path.split('/');
  const isWorld=first==='international'||(first==='news'&&second==='world');
  const isRitual=first==='ritual'||(first==='news'&&second==='ritual');
  if(first==='credit'&&second==='account')return route('assets',write);
  const section=isRitual?'ritual':isWorld?'international':first==='status'?'assets':first==='league'&&second==='election'?'election':first;
  const item=first==='news'&&(second==='paper'||second==='world'||second==='ritual')?third:second;
  if(!validSection(section))return;
  if(tab==='news'&&(section!=='news'||(item||null)!==articleId))stopPaperAudio();
  if(section==='news'&&state.sound)preparePaperAudio();
  if(tab==='ritual'&&!isRitual)stopRitualAudio();
  if(isRitual&&state.sound&&state.mental>0&&!state.ritualPending&&!ritualUsedToday(state))prepareRitualAudio();
  if(first==='news'||isWorld||isRitual)lastFeed=isRitual?'ritual':isWorld?'world':'paper';
  const returningFromRank=modal?.type==='friend-rank'&&section==='league'&&!item;
  const fromMarket=tab==='market';
  const viewingList=(fromMarket&&assetId===null&&!marketCalendar)||(tab==='news'&&articleId===null);
  if(viewingList)listPosition[tab]=screen.scrollTop;
  const returning=section===tab&&!viewingList;
  if(articleId&&(section!=='news'||item!==articleId))rememberArticleView();
  dismiss(false);tab=section;
  assetId=section==='market'&&Object.hasOwn(symbolIndex,item)?symbolIndex[item]:null;
  if(assetId!==null&&stocks[assetId].archiveOnly&&!state.holdings[assetId]&&!state.orders[assetId])assetId=null;
  marketCalendar=section==='market'&&item==='calendar';
  articleId=section==='news'&&item&&articleById(state,item)?item:null;
  const pendingArticle=section==='news'&&!articleId&&/^(?:dispatch-\d+-1|ritual-[a-f0-9-]{36})$/.test(item||'')?item:null;
  const rankEntry=section==='league'&&item==='rank';
  leagueView=section==='league'&&!rankEntry?communityRoute(item):'';
  chatInvite=leagueView==='chat'?chatCode(third):'';
  if(assetId!==null){
    terminal.selectStock(assetId);broker.selectSymbol(assetId);
    if(third?.split('?')[0]==='analysis'){
      const query=new URLSearchParams(third.split('?')[1]||'');
      const article=query.get('article');
      broker.brokerView.analysisFocus={code:stocks[assetId].code,question:query.get('question')||null,articleId:article&&articleById(state,article)?article:null};
      broker.brokerView.tab='info';
    }
  }
  if(section==='assets')assetsView=item==='ledger'?'ledger':'overview';
  const bankEntry=section==='credit'&&['loan','repay','rehabilitation'].includes(item)?item:null;
  if(section==='credit')setBankDesk(bankEntry?'menu':item||'menu');
  if(isWorld)openAtlasRoute(item);
  const investmentSection=section==='assets'&&['investment','holdings'].includes(item);
  const paperId=articleId||pendingArticle;
  const canonical=isRitual?'news/ritual':bankEntry?'credit':isWorld?'news/world'+atlasRouteSuffix():section==='news'?'news/paper'+(paperId?'/'+paperId:''):section==='assets'?'assets'+(investmentSection?'/investment':item==='ledger'?'/ledger':''):section==='league'?'league'+(rankEntry?'/rank':leagueView?'/'+leagueView:'')+(chatInvite?'/'+chatInvite:''):section==='election'?'election':marketCalendar?'market/calendar':section==='market'&&assetId===null?'market':path;
  if(location.hash.slice(1)!==canonical&&(write||location.hash||section==='election')){
    const entry=write&&rankEntry?{openedRank:true}:write&&articleId?{openedArticle:articleId}:null;
    try{history[write?'pushState':'replaceState'](entry,'','#'+canonical);}catch{}
  }
  render();
  const returningToList=returning&&(section==='market'?assetId===null&&!marketCalendar:!item);
  screen.scrollTop=articleViews.get(articleId)?.scrollTop??(returningToList?listPosition[section]||0:0);
  screen.focus({preventScroll:true});
  if(investmentSection)screen.querySelector('[data-status-investment]')?.scrollIntoView({block:'start'});
  if(bankEntry)openModal(bankEntry==='rehabilitation'?bankEntry:'bank-'+bankEntry);
  if(rankEntry||returningFromRank)screen.querySelector('[data-act="friend-rank"]')?.focus({preventScroll:true});
  if(rankEntry)openModal('friend-rank');
  if(tab==='election')void electionPulse();
  if(tab==='ritual'||pendingArticle?.startsWith('ritual-'))void ritualPulse();
  if(viewingChat())void chatPulse();
}
function go(id){route(id,true);}
function syncAtlasRoute(action) {
  const path='news/world'+atlasRouteSuffix(), previous=location.hash.slice(1);
  if(path===previous)return;
  try {
    if(action==='atlas-close'||action==='atlas-back'||action==='atlas-reset'){
      if(history.state?.worldParent===path){history.back();return;}
      history.replaceState(null,'','#'+path);
    }else history.pushState({worldParent:previous},'','#'+path);
  }catch{}
}
function openLoanPaper(title,lender,body,theme){
  openModal('loan-paper',{title,lender,body,theme});
}
function openRepaymentPaper(row,remaining,theme){
  openLoanPaper(remaining?'상환 확인서':'완납 확인서',row.bank,loanRepaymentBody(state,row,remaining),theme);
}
function openModal(type, data={}) {
  const bankContract=type==='bank-loan'?bankLoanContract(state):null;
  if(bankContract)return openLoanPaper('대출 계약서',bankContract.lender,loanContractBody(bankContract),'bank-loan-popup');
  if(type==='bank-repay'&&!state.credit?.loan){
    const payment=state.credit?.ledger.at(-1);
    if(payment&&payment.type!=='borrow')return openRepaymentPaper(payment,0,'bank-loan-popup');
  }
  if(modal?.type==='friend-rank'&&['friend','day-summary'].includes(type)){
    const sheet=overlay.querySelector('.friend-ranking');
    data={...data,rankScroll:sheet.scrollTop,rankPage:Number(sheet.dataset.witnessPage)||0};
  }
  if (!modal) returnFocus=document.activeElement;
  if (modal?.type==='fortune') stopFortuneAudio();
  modal?.stopAd?.();
  clearSpinTimers();
  modal={type,...data};dialogSession++;
  overlay.dataset.dialog=type;
  overlay.hidden=false; screen.inert=true; tabbar.inert=true;
  updateModal();
  if(data.rankScroll!==undefined||['settlement-report','day-summary','market-calendar-day'].includes(type))overlay.querySelector('.sheet').scrollTop=0;
  const focusTarget=type==='fortune'?'.fortune-sheet':
    type==='tutorial-replay'?'#guide-step-title':
    type==='reset-save'?'[data-act="reset-cancel"]':
    type==='market-search'?'#bk-search':
    type==='settlement-report'||type==='loan-paper'?'#dialog-title':'[data-act="dismiss"]';
  overlay.querySelector(focusTarget)?.focus({preventScroll:true});
}
function dismiss(restore=true) {
  clearSpinTimers();
  if(!modal) return;
  if(restore&&modal.type==='salary-negotiation'&&['history','ad'].includes(modal.stage)){returnToSalaryOffer();return;}
  if(restore&&modal.type==='fortune-ad'){returnToFortune();return;}
  if(restore&&modal.type==='desk-loan'&&modal.reroll){
    closeDeskRerollAd(modal);
    renderLoanSheet();
    overlay.querySelector('[data-act="loan-desk-reroll-ad"]:not(:disabled)')?.focus();
    return;
  }
  if(restore&&modal.type==='rehabilitation'){
    if(modal.inputPending)return;
    if(modal.leaving){showRehabilitationExit(false);return;}
    if(rehabilitationView(state).canLeave){showRehabilitationExit(true);return;}
  }
  if(modal.type==='fortune') stopFortuneAudio();
  if(restore&&modal.type==='friend-rank'){
    if(history.state?.openedRank)history.back();
    else route('league');
    return;
  }
  if(restore&&location.hash==='#league/rank'){
    const {key,rankScroll=0,rankPage=0}=modal;
    if(modal.type==='settlement-report')acknowledgeSettlement(modal);
    openModal('friend-rank',{rankPage});
    overlay.querySelector('.sheet').scrollTop=rankScroll;
    const selector=key?'[data-act="friend-profile"][data-value="'+key+'"]':'[data-act="day-summary"]';
    overlay.querySelector(selector)?.focus({preventScroll:true});return;
  }
  if(restore&&modal.type==='character-test'){openModal('mental');overlay.querySelector('[data-act="character-test"]')?.focus({preventScroll:true});return;}
  if(restore&&modal.type==='fx'&&modal.returning){openModal('trade',modal.returning);return;}
  modal.stopAd?.();
  const returning=modal.type;
  const resume=restore&&returning==='settlement-report'?modal.resume:null;
  if(restore&&returning==='settlement-report')acknowledgeSettlement(modal);
  modal=null; overlay.hidden=true;delete overlay.dataset.dialog;paintDialog(overlay,null);
  screen.inert=false;tabbar.inert=false;
  if(restore){
    const target=returnFocus?.isConnected ? returnFocus : returning==='fortune' ? screen.querySelector('.pov-fortune')||screen : screen;
    target.focus({preventScroll:true});
  }
  returnFocus=null;
  if(resume)openModal(resume);
  if(deferredDayReport||(restore&&deferredSettlementNotice))queueMicrotask(()=>{
    if(!modal&&(deferredDayReport||deferredSettlementNotice))showSettlementReport(!deferredDayReport);
  });
}
function updateModal() {
  if(!modal)return;
  if(modal.type==='salary-negotiation')modal.recordDay=state.salaryNegotiation?.day;
  if(modal.type==='rehabilitation'&&modal.confirming&&rehabilitationView(state).stage!=='ready')modal.confirming=false;
  const old=overlay.querySelector('.sheet');
  const y=modal.type==='loan-paper'&&!old?.classList.contains('loan-contract-sheet')?0:old?.scrollTop||0;
  const focused=overlay.contains(document.activeElement) ? document.activeElement : null;
  const key=focused?.dataset.act, val=focused?.dataset.value;
  const notices=modal.type==='settlement-report'&&modal.day===undefined?intimidationReportNotices(state):[];
  if(modal.type==='settlement-report')modal.noticeIds=notices.map(notice=>notice.id);
  paintDialog(overlay,{state,modal,session:dialogSession,characterPreview,notices,intimidationView,closeGuide:()=>go('home'),
    math:modal.type==='trade'?orderMath():undefined});
  const sheet=overlay.querySelector('.sheet');
  if(sheet.scrollTop!==y)sheet.scrollTop=y;
  if(!focused||focused.isConnected)return;
  if(key) [...overlay.querySelectorAll('[data-act]')].find(el=>el.dataset.act===key && (val===undefined || el.dataset.value===val) && !el.disabled)?.focus({preventScroll:true});
  if(focused?.id==='spy-target')overlay.querySelector('#spy-target')?.focus({preventScroll:true});
  else if(focused?.id==='intimidation-target')overlay.querySelector('#intimidation-target')?.focus({preventScroll:true});
  else if(focused?.id==='dialog-title'&&(modal.type==='settlement-report'||modal.type==='loan-paper'))overlay.querySelector('#dialog-title')?.focus({preventScroll:true});
}
function clearSpinTimers(){
  spinTimers.forEach(clearTimeout);
  spinTimers.length=0;
}
function returnToFortune(){
  openModal('fortune');
  overlay.querySelector('.fortune-action:not(:disabled)')?.focus({preventScroll:true});
}
function pullFortune(progress=0){
  const target=modal;
  if(target?.type!=='fortune'||target.pullPending||target.spinning)return;
  const reroll=Boolean(state.luck);
  if(canDrawFortune(state,reroll)){
    if(state.sound)prepareGameAudio();
    return spinFortune(target,progress,reroll);
  }
  if(!canUnlockFortuneReroll(state))return;
  openModal('fortune-ad',{day:state.day,resetId:state.resetId});
  const ad=modal;
  ad.stopAd=watchGameAd(overlay,()=>{void finishFortuneAd(ad);},fortuneRerollAdSeconds);
}
function finishFortuneAd(ad){
  if(modal!==ad||ad.day!==state.day||ad.resetId!==state.resetId)return;
  return writeToday(()=>{
    if(modal!==ad)return;
    const next={...state};
    if(unlockFortuneReroll(next)){
      if(save(next,{syncPortfolio:false}))state=next;
      else feedback('재뽑기 기회를 저장하지 못했어. 다시 시도해 줘.');
    }
    render();returnToFortune();
  });
}
async function spinFortune(target,pullProgress,reroll){
  const day=state.day,resetId=state.resetId;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const latchDelay=reduced||pullProgress===1?0:150;
  target.pullPending=true;
  try{
    await withSaveLock(()=>{
      if(!stillCurrentGame(resetId))return;
      const now=Date.now(),tick=syncAndSave(false,now);
      if(state.day!==day){renderDayChange();return;}
      if(modal!==target)return;
      const next=structuredClone(state),rolled=roll(next,Math.random,gameTimestamp(now),{reroll});
      if(!rolled||!save(next,{syncPortfolio:false})){
        if(rolled)feedback('운세를 저장하지 못했어. 다시 시도해 줘.');
        render();updateModal();
        return;
      }
      state=next;
      if(tick.filled)beep('fill');
      const wins=lineWins(state.fortuneGrid).length;
      Object.assign(target,{spinning:true,hasSpun:true,pullProgress,reelsStopped:0});
      render();updateModal();
      stopFortuneAudio();
      beep('lever',latchDelay/1000);
      overlay.querySelector('[data-act="dismiss"]')?.focus({preventScroll:true});
      const stopDelays=reduced?[60,80,80]:[1850,1270,1420];
      const schedule=(delay,play)=>spinTimers.push(setTimeout(play,delay));
      if(!reduced){
        const spinTime=stopDelays.reduce((sum,delay)=>sum+delay,0);
        schedule(latchDelay,()=>beep('reels',(spinTime-latchDelay)/1000));
      }
      function reveal(){
        if(modal!==target)return;
        target.spinning=false;clearSpinTimers();updateModal();
        overlay.querySelector('.fortune-action:not(:disabled)')?.focus({preventScroll:true});
        beep(['noBingo','fortune','doubleBingo','jackpot'][wins]);
      }
      function stopReel(index){
        if(modal!==target)return;
        target.reelsStopped=index+1;
        updateModal();beep('reelStop',index);
        // Relative waits preserve each brake and the last recoil after a throttled frame.
        if(index<2)schedule(stopDelays[index+1],()=>stopReel(index+1));
        else schedule(reduced?60:520,reveal);
      }
      schedule(stopDelays[0],()=>stopReel(0));
    });
  }finally{target.pullPending=false;}
}
function startRecovery(){
  const {remaining,gain}=recoveryStatus(state);
  if(modal?.type!=='mental'||!remaining||!gain||closed())return;
  openModal('recovery-ad',{day:state.day});
  const ad=modal;
  ad.stopAd=watchGameAd(overlay,()=>{
    void writeToday(()=>{
      if(modal!==ad||ad.day!==state.day)return;
      const points=grantRecovery(state);
      if(points){save();beep('money');}
      render();openModal('mental');
      feedback(points?'정신력 '+points+'점 회복':'오늘 남은 회복 횟수를 확인해 줘.');
    });
  });
}
function showSalarySubview(stage){
  modal.offerScroll=overlay.querySelector('.sheet').scrollTop;
  modal.stage=stage;
  updateModal();
  overlay.querySelector('.sheet').scrollTop=0;
  overlay.querySelector(stage==='history'?'#salary-history-title':'#salary-ad-title')?.focus({preventScroll:true});
}
function returnToSalaryOffer(){
  const proposal=modal;
  if(proposal?.type!=='salary-negotiation'||!['ad','history'].includes(proposal.stage))return;
  const previous=proposal.stage;
  proposal.stopAd?.();
  delete proposal.stopAd;
  delete proposal.stage;
  updateModal();
  overlay.querySelector('.sheet').scrollTop=proposal.offerScroll??0;
  overlay.querySelector(previous==='history'?'[data-act="salary-history"]':'[data-act="salary-watch"]')?.focus({preventScroll:true});
}
function focusSalaryOutcome(){
  const outcome=overlay.querySelector('#salary-outcome');
  outcome?.focus({preventScroll:true});
  outcome?.parentElement.scrollIntoView({block:'nearest'});
}
function startSalaryAd(raise){
  const proposal=modal;
  if(proposal?.type!=='salary-negotiation'||proposal.stage||closed())return;
  if(todaysNegotiation(state)){updateModal();return;}
  if(!Number.isSafeInteger(salaryQuote(state,raise)?.offeredSalary)){feedback('요청 인상률을 낮춰 줘.');return;}
  Object.assign(proposal,{raise,day:state.day});
  showSalarySubview('ad');
  proposal.stopAd=watchGameAd(overlay,()=>finishSalaryAd(proposal),negotiationAdSeconds);
}
function finishSalaryAd(proposal){
  if(modal!==proposal||!['ad','retry'].includes(proposal.stage))return;
  proposal.stage='saving';
  updateModal();
  void writeToday(()=>{
    if(modal!==proposal)return;
    if(proposal.day!==state.day){renderDayChange();return;}
    const next={...state};
    const attempted=negotiateSalary(next,proposal.raise,()=>proposal.roll??=Math.random());
    if(attempted&&!save(next,{syncPortfolio:false})){
      proposal.stage='retry';updateModal();
      overlay.querySelector('[data-act="salary-save"]')?.focus();
      return;
    }
    if(attempted){
      state=next;
      render();
    }
    delete proposal.stage;
    delete proposal.stopAd;
    updateModal();
    focusSalaryOutcome();
    if(attempted)beep(next.salaryNegotiation.success?'fill':'guideWrong');
  });
}
async function playRehabilitation(action,button){
  const sheet=modal;
  if(sheet?.type!=='rehabilitation'||sheet.inputPending||sheet.leaving)return;
  const token=button.dataset.token||null;
  const stopping=action==='rehab-stop',applying=action==='rehab-confirm';
  if(applying&&!sheet.confirming)return;
  // Judge the frame that the player saw, even when another tab briefly holds the save lock.
  const stoppedAt=Number(button.dataset.stoppedAt)||Date.now();
  sheet.inputPending=true;
  try{
    await writeToday(()=>{
      if(modal!==sheet)return;
      const next={...state};
      const result=stopping?stopRehabilitationRound(next,token,stoppedAt):
        applying?applyForRehabilitation(next,token):startRehabilitationRound(next,token);
      if(!result)return;
      if(!save(next,{syncPortfolio:stopping||applying})){
        feedback('게임을 저장하지 못했어. 다시 눌러 줘.');
        return;
      }
      state=next;
      if(applying){
        sheet.confirming=false;
        clearLoanDeskDraft();
      }
      if(stopping){
        beep('ddakji',{outcome:result,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
      }
      if(applying||stopping)render();
    });
  }finally{
    if(modal===sheet){
      sheet.inputPending=false;
      sheet.inputRevision=(sheet.inputRevision??0)+1;
      updateModal();
      if(applying&&!sheet.confirming)overlay.querySelector('[data-act="rehab-stop"]')?.focus({preventScroll:true});
    }
  }
}
function showRehabilitationExit(leaving){
  modal.leaving=leaving;
  updateModal();
  overlay.querySelector(leaving?'[data-act="rehab-stay"]':'[data-act="dismiss"]')?.focus({preventScroll:true});
}
async function leaveRehabilitation(token){
  const sheet=modal,game=state.resetId;
  if(sheet?.type!=='rehabilitation'||!sheet.leaving||sheet.inputPending)return;
  sheet.inputPending=true;
  try{
    await withSaveLock(()=>{
      if(modal!==sheet||!stillCurrentGame(game))return;
      syncAndSave();
      if(rehabilitationView(state).canLeave){
        const next={...state};
        if(!leaveRehabilitationSession(next,token)){
          feedback('얻은 돈을 다시 확인해 줘.');
          return;
        }
        if(!save(next,{syncPortfolio:false})){
          feedback('게임을 저장하지 못했어. 다시 눌러 줘.');
          return;
        }
        state=next;
        render();
      }
      sheet.leaving=false;
      sheet.inputPending=false;
      dismiss();
    });
  }finally{
    if(modal===sheet){
      sheet.inputPending=false;
      updateModal();
    }
  }
}
function priceDraft(draft=modal){
  if(draft.kind==='market')return null;
  const p=amountFromText(draft.price,currencies[stocks[draft.i].currency].digits);
  return Number.isFinite(p)&&p>0&&p<=1e13&&Math.abs(p-snapPrice(draft.i,p))<1e-7?p:NaN;
}
function orderMath(draft=modal){
  const {i,qty,side}=draft,stock=stocks[i],price=priceDraft(draft);
  const estimate=price??quoteAt(state,i),valid=Number.isFinite(estimate)&&estimate>0;
  const max=valid?limit(state,i,side,price):0;
  const signed=Number.isFinite(qty)?qty*(side==='sell'?-1:1):0;
  const next=state.orders.slice(),levels=state.orderPrices.slice();next[i]=signed;levels[i]=price;
  const available=valid?projected(state,next,levels,stock.currency,i):NaN;
  const fitsLot=Number.isFinite(qty)&&qty>0&&Math.abs(qty/stock.lot-Math.round(qty/stock.lot))<1e-6;
  const foreignBuy=side==='buy'&&!stock.archiveOnly&&stock.currency!=='KRW'&&isExchangeCurrency(stock.currency);
  const feeRate=orderFeeRate(state,i,signed,price);
  const amounts=orderAmounts(i,signed,valid?estimate:NaN,feeRate);
  const funding=foreignBuy&&fitsLot&&available<0?-available:0;
  return {valid,max,available,fitsLot,foreignBuy,funding,feeRate,...amounts};
}
function defaultOrderQuantity(i,side){
  const queued=state.orders[i];
  if(queued&&((queued<0)===(side==='sell')))return Math.abs(queued);
  return side==='sell'?Math.min(1,state.holdings[i]):1;
}
const orderQuantityDigits=i=>Math.round(-Math.log10(stocks[i].lot));
function setOrderQuantity(qty){
  modal.qty=qty;
  modal.qtyText=undefined;
  modal.replaceQuantity=true;
  updateModal();
}
function enterOrderDigit(key){
  const digits=orderQuantityDigits(modal.i);
  const text=modal.replaceQuantity?'':(modal.qtyText??groupAmount(modal.qty,digits)).replaceAll(',','');
  const next=key==='backspace'?text.slice(0,-1):text+key;
  modal.qtyText=groupAmount(next,digits);
  modal.qty=amountFromText(modal.qtyText,digits)??NaN;
  modal.replaceQuantity=false;
  updateModal();
}
const orderStamp=i=>[state.orders[i],state.orderPrices[i],state.orderTime?.[i]].join('/');
function openFunding(draft,needed){
  const from='KRW',to=stocks[draft.i].currency,originalOrder=orderStamp(draft.i);
  const debit=fxDebitFor(localRates(state),from,to,needed);
  // Preserve a very large order without truncating its suggested debit to a different amount.
  const amount=debit<1e13?groupAmount(debit,currencies[from].digits):'';
  openModal('fx',{returning:draft,needed,from,to,amount,orderStamp:originalOrder});
  overlay.querySelector('.sheet').scrollTop=0;
}
function showSettlementReport(onlyForNotice=false){
  if(onlyForNotice&&!intimidationReportNotices(state).length){deferredSettlementNotice=false;return;}
  if(onlyForNotice&&modal&&(modal.type!=='settlement-report'||modal.day!==undefined)){deferredSettlementNotice=true;return;}
  deferredSettlementNotice=false;
  if(!onlyForNotice)deferredDayReport=false;
  if(modal?.type==='settlement-report')updateModal();
  else openModal('settlement-report',{resume:!onlyForNotice&&['bank-loan','bank-repay','desk-loan'].includes(modal?.type)?modal.type:null});
}
function acknowledgeSettlement(report){
  const {noticeIds}=report;
  if(!noticeIds?.length)return;
  const resetId=state.resetId;
  void withSaveLock(()=>{
    if(!stillCurrentGame(resetId))return;
    if(markIntimidationReportsRead(state,noticeIds))save();
  });
}
function selectSettlementDay(day){
  if(modal?.type!=='settlement-report'||!state.history.some(record=>record.day===day))return;
  acknowledgeSettlement(modal);
  modal.day=day;
  updateModal();
  overlay.querySelector('.sheet').scrollTop=0;
}
function bindGameProgress(fresh){
  state=fresh;
  bindElectionCalendar(fresh);
  setRoomProgressId(fresh.roomProgressId??'');
  bindPersonalRecords(fresh);
  useElectionReset(fresh.electionReset);
}

function applyGameReset(fresh){
  // Other open tabs must leave the previous game's dialogs, event queues and paints too.
  bindGameProgress(fresh);
  stopRitualAudio();stopFortuneAudio();
  location.replace('?lobby=1');
}

let progressSync=null;
function syncProgressResets(){
  if(!state.roomProgressResets?.length)return Promise.resolve(true);
  if(!progressSync)progressSync=drainProgressResets().finally(()=>{progressSync=null;});
  return progressSync;
}
async function drainProgressResets(){
  while(state.roomProgressResets?.length){
    const next=state.roomProgressResets[0];
    let confirmed=next.resetId,conflict=false;
    try{
      await resetRoomProgress(next.previousId,next.resetId,next.resetAt);
    }catch(error){
      if(error.reason!=='progress_changed'||typeof error.progressId!=='string')return false;
      confirmed=error.progressId;conflict=true;
    }
    const persisted=await withSaveLock(()=>{
      restoreLatestState();
      const changed={...state};
      if(!acknowledgeProgressReset(changed,confirmed)){
        if(!state.roomProgressResets?.some(r=>r.resetId===next.resetId))return true;
        if(!conflict)return false;
        if(!confirmed&&next.previousId){
          changed.roomProgressResets=[{...next,previousId:''},...state.roomProgressResets.slice(1)];
        }else if(confirmed){
          // A different restart won. Replaying this obsolete request against its new ID
          // would erase another run. Join the authoritative room generation instead.
          changed.roomProgressId=confirmed;
          delete changed.roomProgressResets;
        }else return false;
      }
      if(!save(changed,{syncPortfolio:false}))return false;
      state=changed;setRoomProgressId(changed.roomProgressId??'');
      return true;
    });
    if(!persisted)return false;
  }
  return true;
}
async function resetGame(){
  const confirmation=modal;
  if(confirmation?.type!=='reset-save'||confirmation.pending)return;
  confirmation.pending=true;updateModal();
  let reset=false;
  try{
    reset=await withSaveLock(()=>{
      const game=state.resetId;
      if(!stillCurrentGame(game)||modal!==confirmation)return false;
      if(state.ritualPending){feedback('굿의 결과를 확인한 뒤 초기화할 수 있어.');return false;}
      if(state.spyPending){feedback('염탐 보고서 발급이 끝난 뒤 초기화할 수 있어.');return false;}
      if(state.intimidationPending){feedback('협박 비용 처리 중에는 초기화할 수 없어.');return false;}
      const fresh=restartProgress(state,{shared:sharedRituals()});
      if(!save(fresh,{syncPortfolio:false})){feedback('기록을 저장할 수 없어. 잠시 뒤 다시 시도해 줘.');return false;}
      bindGameProgress(fresh);
      return true;
    });
    if(reset){
      // The new run and its idempotent reset intent are already durable if we go offline.
      if(navigator.onLine!==false)await syncProgressResets();
      location.replace('?lobby=1');
    }
  }finally{
    if(!reset&&modal===confirmation){confirmation.pending=false;updateModal();}
  }
}
function restoreLatestState(){
  const saved=readState();
  if(saved){
    const updated=usesKst(saved)?saved:startLive(saved);
    if(state.resetId!==updated.resetId)applyGameReset(updated);
    else{
      state=updated;
      setRoomProgressId(updated.roomProgressId??'');
    }
    return true;
  }
  return false;
}
function stillCurrentGame(resetId){
  restoreLatestState();
  return state.resetId===resetId;
}
function withSaveLock(action){
  return navigator.locks ? navigator.locks.request(storeKey+':credit',action) : action();
}
function syncAndSave(spend=false,now=Date.now(),checkpoint=false){
  const previousConnection=state.mentalConnectedAt;
  const tick=syncLiveClock(state,now,connectedSince);
  tick.spent=spend?chargeLiveSpending(state,now):0;
  if(tick.financeChanged||tick.mentalClockChanged||tick.intimidationsChanged||tick.advanced||tick.filled||tick.expired||tick.spent)save();
  else if(checkpoint&&state.mentalConnectedAt!==previousConnection)save(state,{syncPortfolio:false});
  return tick;
}
function renderDayChange(){
  headlineIndex=0;
  if(location.hash==='#league/rank'&&modal||['market-calendar-day','market-search','shop','ai-forecast','rehabilitation','trade'].includes(modal?.type)||modal?.type==='fx'&&modal.returning){
    deferredDayReport=true;
    render();updateModal();return;
  }
  if(modal?.type==='settlement-report'&&modal.day!==undefined){
    render();updateModal();return;
  }
  dismiss(false);
  render();showSettlementReport();
}
function paintLive(clockOnly=false){
  if(tab==='home'){
    if(clockOnly)homeClockUpdates.publish(state);
    else renderScreen();
  }
  if(tab==='market'&&(!modal||modal.type==='market-search'))broker.refreshLive(screen,state,assetId);
}
function publishClock(tick){
  if(tick.rolled){renderDayChange();void electionPulse();beep('morning');return;}
  if(tick.filled)beep('fill');
  // Home headlines follow market slots. The live paint handles minute and second changes.
  const changed=tick.advanced||tick.filled||tick.expired;
  const summaryChanged=changed||tick.minuteChanged&&tab==='home';
  let homePainted=false;
  const kioskUpdated=tab==='news'&&!articleId&&(changed||chartRenderPending||tick.minuteChanged)&&news.refreshKiosk(screen,state);
  if(tab==='news'&&articleId&&(changed||tick.minuteChanged))newspaperUpdates.publish(state);
  if((changed||chartRenderPending)&&!kioskUpdated){
    const focusedControl=screen.contains(document.activeElement)&&document.activeElement.matches('input,select,textarea,[data-pov-investment],.nr-reading-toggles button');
    if(terminal.interacting())chartRenderPending=true;
    else if(tab!=='loan-desk'&&(tab==='home'||!focusedControl)){
      render();
      homePainted=tab==='home';
    }
  }
  if((changed||tick.spent||tick.markHoldings||tick.mentalChanged||tick.financeChanged)&&modal?.type==='day-summary')updateModal();
  if(summaryChanged&&modal?.type==='activity')updateModal();
  else if(tick.minuteChanged&&modal?.type==='activity'&&modal.kind==='orders')updateModal();
  if(tick.spent&&tab==='assets')renderScreen();
  if(tab==='ritual'&&(tick.spent||tick.mentalChanged||tick.markHoldings||tick.repriceRitual))renderScreen();
  if((changed||tick.spent||tick.mentalChanged||tick.financeChanged||tick.markHoldings)&&modal?.type==='spending')updateModal();
  if(modal?.type==='rehabilitation'&&(changed||tick.spent||tick.financeChanged||tick.markHoldings))updateModal();
  if((changed||tick.spent)&&modal?.type==='fx')updateModal();
  if(modal?.type==='trade'&&(changed||tick.spent||tick.minuteChanged))updateModal();
  if(tick.spent&&modal?.type==='wallet')updateModal();
  if((tick.markHoldings||tick.mentalChanged||tick.mentalClockChanged||tick.financeChanged||tick.spent||tick.advanced)&&modal?.type==='mental')updateModal();
  if(tick.mentalChanged&&modal?.type==='character-test'&&characterPreview==='auto')updateModal();
  if((changed||tick.spent||tick.markHoldings||tick.financeChanged)&&
    ['desk-loan','bank-loan','bank-repay'].includes(modal?.type))refreshFinancialView(overlay,state);
  if(!homePainted)paintLive(tick.clockOnly);
}
async function clockPulse(checkpoint=false){
  const now=Date.now(),wall=gameTime(now);
  const intimidationDue=state.intimidationInbox?.[0]?.at<=now;
  const gameAt=gameTimestamp(now);
  const mentalDue=mentalRecoveryDue(state,gameAt)||(gameAt>=state.mentalDecayAt&&mentalDecayRate(state)>0);
  const quoteChanged=Math.floor(wall.second/5)!==Math.floor(state.wallSecond/5);
  const markHoldings=state.holdings.some(Boolean)&&quoteChanged;
  const repriceRitual=tab==='ritual'&&(quoteChanged||wall.minute!==state.wallMinute);
  if(!checkpoint&&state.mentalConnectedAt!==undefined&&!markHoldings&&wall.day===state.day&&wall.cursor===state.cursor&&!mentalDue&&!intimidationDue&&!state.orders.some(Boolean)){
    const minuteChanged=wall.minute!==state.wallMinute;
    state.wallMinute=wall.minute;state.wallSecond=wall.second;
    publishClock({minuteChanged,clockOnly:true,repriceRitual});return;
  }
  await withSaveLock(()=>{
    const day=state.day;
    restoreLatestState();
    const tick=syncAndSave(false,Date.now(),checkpoint);publishClock({...tick,markHoldings,repriceRitual,rolled:tick.rolled||state.day!==day});
  });
}
function armSpending(due){
  clearTimeout(spendingTimer);
  nextSpendingAt=due;
  spendingTimer=setTimeout(()=>void spendPulse(due),Math.max(0,due-Date.now()));
}
function pauseSpending(){
  if(!nextSpendingAt)return;
  clearTimeout(spendingTimer);
  pausedSpending={run:state.resetId,paidAt:state.liveSpending?.at??0,
    remaining:Math.max(0,Math.min(spendingInterval,nextSpendingAt-Date.now()))};
  nextSpendingAt=0;
  try{sessionStorage.setItem(spendingPauseKey,JSON.stringify(pausedSpending));}catch{}
}
function resumeSpending(){
  if(document.hidden||nextSpendingAt)return;
  try{
    pausedSpending??=JSON.parse(sessionStorage.getItem(spendingPauseKey));
    sessionStorage.removeItem(spendingPauseKey);
  }catch{}
  const saved=pausedSpending;
  pausedSpending=null;
  const resume=saved&&saved.run===state.resetId&&saved.paidAt===(state.liveSpending?.at??0)&&
    Number.isInteger(saved.remaining)&&saved.remaining>=0&&saved.remaining<=spendingInterval;
  armSpending(Date.now()+(resume?saved.remaining:spendingInterval));
}
async function spendPulse(due){
  await withSaveLock(()=>{
    if(document.hidden||due!==nextSpendingAt)return;
    const now=Date.now(),day=state.day;
    restoreLatestState();
    const tick=syncAndSave(true,now,true);
    const sharedDue=(state.liveSpending?.at??0)+spendingInterval;
    armSpending(sharedDue>now?sharedDue:now+spendingInterval);
    publishClock({...tick,rolled:tick.rolled||state.day!==day});
  });
}
function patHomeCat(button){
  if(!petCharacter(button))return;
  beep('pet');
  const day=gameTime().day,resetId=state.resetId;
  void withSaveLock(()=>{
    if(!stillCurrentGame(resetId))return;
    const tick=syncAndSave();
    if(tick.rolled||tick.advanced||tick.minuteChanged||tick.filled||tick.expired||tick.mentalChanged||tick.financeChanged)publishClock(tick);
    if(state.day!==day)return;
    const next=afterHomePat(state);
    if(!next||!save(next,{syncPortfolio:false}))return;
    const gained=next.mental>state.mental;
    state=next;
    if(gained){
      beep('petRecovery');
      if(tab==='home')renderScreen();
    }
  });
}
function writeToday(action){
  const day=state.day,resetId=state.resetId;
  return withSaveLock(()=>{
    if(!stillCurrentGame(resetId))return;
    syncAndSave();
    if(day!==state.day){renderDayChange();return;}
    action();
  });
}
function purchaseGlasses(offeredPrice){
  const shop=modal;
  if(shop?.type!=='shop')return;
  return writeToday(()=>{
    if(modal!==shop)return;
    const next={...state};
    shop.problem=buyGlasses(next,offeredPrice);
    if(!shop.problem){
      if(save(next)){
        state=next;
        beep('money');
        renderScreen();
      }else shop.problem='변경 사항을 저장하지 못했어. 다시 시도해 줘.';
    }
    updateModal();
    if(!shop.problem)overlay.querySelector('[aria-label="상품 설명 닫기"]')?.focus({preventScroll:true});
  });
}
function openGlassesForecast(index){
  if(tab!=='market'||assetId!==index||modal||!hasGlasses(state))return;
  return writeToday(()=>{
    if(tab!=='market'||assetId!==index||modal||!hasGlasses(state))return;
    const next={...state};
    const prediction=forecastWithGlasses(next,index);
    if(!prediction){feedback('지금은 이 종목의 방향을 예측할 수 없어.');return;}
    if(prediction.up!==null){
      if(!save(next,{syncPortfolio:false})){feedback('예측을 저장하지 못했어. 다시 시도해 줘.');return;}
      state=next;
    }
    openModal('ai-forecast',{index,prediction});
    if(prediction.up!==null)renderScreen();
  });
}
let ritualPosting=false,ritualReading=false,ritualRepairing=false;
async function repairPreviousRitual(manual=false){
  if(ritualRepairing||!sharedRituals()||!legacyRitualOrphan(state)||state.ritualUsedDay!==state.day||state.legacyRoomRitualDay!==state.day||
    !manual&&!sharedRitualRepairDue(state))return;
  ritualRepairing=true;
  const game=state.resetId,day=state.day;
  try{
    const result=await repairRoomRitual(game,day);
    await withSaveLock(()=>{
      if(!stillCurrentGame(game)||result.repairId!==game||result.day!==day)return;
      const next={...state};
      if(!mergeRoomRituals(next,{...result,ritualRepairId:result.repairId,events:[]})||!save(next,{syncPortfolio:false}))return;
      state=next;
      if(tab==='ritual')renderScreen();
    });
  }catch{if(manual)feedback('방에 연결한 뒤 다시 시도해 줘.');}
  finally{ritualRepairing=false;}
}
async function startRitual(code,previous){
  let reserved=false;
  await writeToday(()=>{
    if(tab!=='ritual'||(state.ritualLast?.id??'')!==previous)return;
    if(sharedRituals()&&state.roomProgressResets?.length){feedback('방 기록을 동기화한 뒤 살굿을 시작할 수 있어.');void ritualPulse();return;}
    const next={...state},error=reserveRitual(next,code,crypto.randomUUID(),Date.now());
    if(error){feedback(error);renderScreen();return;}
    const started=next.ritualPending.started;
    if(!sharedRituals())finishRitual(next,localRitualResult(next.ritualPending));
    if(!save(next)){feedback('굿을 저장하지 못했어. 다시 시도해 줘.');return;}
    state=next;reserved=true;render();
    screen.scrollTop=0;
    if(state.sound)void playRitualAudio(started,matchMedia('(prefers-reduced-motion: reduce)').matches);
  });
  if(reserved)void deliverRitual();
}
async function deliverRitual(){
  if(ritualPosting||!state.ritualPending||!sharedRituals()||state.roomProgressResets?.length)return;
  ritualPosting=true;
  try{
    const pending=state.ritualPending,reply=await sendRoomRitual(pending);
    if(!reply)return;
    await withSaveLock(()=>{
      restoreLatestState();
      if(state.ritualPending?.id!==pending.id)return;
      const next={...state};
      if(reply.rejected){cancelRitual(next,pending.id);mergeRoomRituals(next,reply);}
      else if(!finishRitual(next,reply.result))return;
      if(!save(next))return;
      state=next;render();
      if(reply.rejected){stopRitualAudio();feedback(reply.rejected);}
    });
  }finally{ritualPosting=false;}
}
async function ritualPulse(){
  if(document.hidden||!sharedRituals()||state.roomProgressResets?.length&&!await syncProgressResets())return;
  void deliverRitual();
  if(ritualReading)return;
  ritualReading=true;
  try{
    let more;
    do{
      const game=state.resetId,page=await readRoomRituals(state.ritualCursor??0);
      if(!page||state.resetId!==game)return;
      // Empty polls are common between articles. Only lock/re-read the full save for a change.
      if(!mergeRoomRituals({...state},page))break;
      await withSaveLock(()=>{
        if(!stillCurrentGame(game))return;
        const next={...state};
        if(!mergeRoomRituals(next,page)||!save(next))return;
        state=next;
        const link=location.hash.slice(1);
        if(!articleId&&link.startsWith('news/paper/ritual-')&&articleById(state,link.split('/')[2]))route(link);
        else render();
      });
      more=page.more&&page.events.length>0&&(state.ritualCursor??0)>=page.events.at(-1).sequence;
    }while(more&&!document.hidden);
    if(sharedRitualRepairDue(state))await repairPreviousRitual();
  }finally{ritualReading=false;}
}

let intimidationBusy=false,intimidationNoticeWaiting=false;
let spyUploadBusy=false,spyUploadKey='',spyPurchaseBusy=false;
let spyAcknowledging=false;
const seenSpyNotices=new Set();

async function syncSpyProfile(){
  if(spyUploadBusy||state.roomProgressResets?.length||!intimidationView?.selfSlot)return;
  const now=gameTimestamp(Date.now());
  const key=[intimidationView.selfSlot,state.resetId,state.day,state.fills.length,state.phase,Math.floor(now/300_000)].join('/');
  if(key===spyUploadKey)return;
  spyUploadBusy=true;
  try{
    const {status}=await spyRequest({action:'sync',...tradingSnapshot(state,now)});
    if(status===200){
      spyUploadKey=key;
      // A fill or reset may have been saved while this snapshot was travelling.
      queueMicrotask(syncSpyProfile);
    }
  }finally{spyUploadBusy=false;}
}

function paintSpyNotice(){
  const notice=$('#spy-notice');
  const ids=(intimidationView?.spyNotices??[]).filter(id=>!seenSpyNotices.has(id));
  const message=ids.length===1?'누군가 내 투자 기록을 염탐했어.':ids.length?'내 투자 기록에 익명의 염탐 알림 '+ids.length+'건이 도착했어.':'';
  paintNotice(notice,message);
}

async function acknowledgeSpyNotice(){
  const ids=(intimidationView?.spyNotices??[]).filter(id=>!seenSpyNotices.has(id));
  if(spyAcknowledging||!ids.length)return;
  spyAcknowledging=true;
  try{
    const {status}=await spyRequest({action:'ack',ids});
    if(status!==200){feedback('알림을 확인하지 못했어. 다시 눌러 줘.');return;}
    for(const id of ids)seenSpyNotices.add(id);
    paintSpyNotice();
  }finally{spyAcknowledging=false;}
}

function redrawSpy(active,toTop=false){
  if(modal!==active||active?.type!=='desk-spy')return;
  updateModal();
  if(toTop){
    overlay.querySelector('.sheet').scrollTop=0;
    overlay.querySelector('#dialog-title').focus({preventScroll:true});
  }
}
async function loadSpyArchive(active){
  if(active?.type!=='desk-spy'||active.loadingArchive)return;
  active.loadingArchive=true;active.archiveError=false;redrawSpy(active);
  const {status,value}=await spyRequest(null,active.more?{before:active.more}:null);
  active.loadingArchive=false;
  if(status===200&&Array.isArray(value?.reports)){
    const byId=new Map([...active.archive,...value.reports].map(r=>[r.id,r]));
    active.archive=[...byId.values()];active.more=value.next;
  }else active.archiveError=status!==401;
  if(!active.report)redrawSpy(active);
}

function openSpyDesk(){
  const target=intimidationView?.spyReady?.[0]??testFriends[0].room;
  openModal('desk-spy',{target:String(target),archive:[],more:null});
  void loadSpyArchive(modal);void intimidationPulse();
}

function showSpyReport(active,report){
  active.reading=null;active.report=report;active.error='';
  redrawSpy(active,true);
}
async function readSpyFile(id){
  const active=modal;
  if(active?.type!=='desk-spy')return;
  active.reading=id;
  const sample=state.botSpyReports?.find(report=>report.id===id);
  if(sample){showSpyReport(active,sample);return;}
  const {status,value}=await spyRequest(null,{id});
  if(modal!==active||active.reading!==id)return;
  if(status===200&&value?.id===id&&validSpyReport(value))showSpyReport(active,value);
  else{active.reading=null;active.error='보고서를 불러오지 못했어. 다시 열어 줘.';redrawSpy(active);}
}

async function retrySpyPurchase(){
  if(state.roomProgressResets?.length)return;
  const pending=state.spyPending;
  if(spyPurchaseBusy||!pending)return;
  spyPurchaseBusy=true;
  try{
    const {id,room,buyerSlot,target,assets,available,cost}=pending;
    const {status,value}=await spyRequest({action:'buy',id,room,buyerSlot,target,assets,available,cost});
    const accepted=status===200&&value?.id===id&&value.cost===cost&&validSpyReport(value);
    if(!accepted&&![400,403,404,409,413].includes(status)){
      if(modal?.type==='desk-spy'&&!modal.report){
        modal.error=status===401?'보고서를 신청한 방에 다시 참가하면 결제를 확인할 수 있어.':'연결이 돌아오면 같은 결제 건을 다시 확인할게.';
        redrawSpy(modal);
      }
      return;
    }
    await withSaveLock(()=>{
      restoreLatestState();
      const next={...state};
      if(!finishDeskCharge(next,'spyPending','spyCharges',id,accepted)||!save(next))return;
      state=next;
      if(accepted){
        beep('money');
        if(modal?.type==='desk-spy'){
          modal.archive=[value,...modal.archive.filter(report=>report.id!==id)];
          if(!modal.report)showSpyReport(modal,value);
        }
        feedback('염탐 보고서를 보관했어.');
      }else{
        const error=typeof value?.error==='string'?value.error:'발급하지 못했어. 다시 선택해 줘.';
        if(modal?.type==='desk-spy'){modal.error=error;redrawSpy(modal);}
        feedback('발급이 취소되어 '+won(cost)+'을 돌려줬어.');
      }
      if(tab==='assets')render();
      if(modal?.type==='day-summary')updateModal();
      paintLive();
    });
  }finally{spyPurchaseBusy=false;}
}

async function submitSpy(form){
  const active=modal,selected=form.elements.target.value;
  if(active?.type!=='desk-spy'||active.pending||active.report)return;
  const offer=active.offer;
  if(!offer||offer.target!==selected||offer.cost!==Number(form.querySelector('[type="submit"]').dataset.cost))return;
  active.pending=true;active.error='';
  try{
    await writeToday(()=>{
      if(modal!==active||active.target!==selected||state.spyPending)return;
      const quote=spyQuote(state,intimidationView,selected);
      if(state.roomProgressResets?.length&&!testFriend(selected)){active.error='방 기록을 동기화한 뒤 이용할 수 있어.';return;}
      if(!quote.ready||state.phase!=='open'||quote.available<offer.cost){
        active.error='친구와 사용 가능한 돈을 다시 확인해 줘.';return;
      }
      const now=gameTimestamp(Date.now()),id=crypto.randomUUID(),next={...state};
      const bot=testFriend(selected);
      // Honour the displayed gross-asset quote despite intervening market ticks or living expenses.
      const {cost,assets}=offer,available=Math.min(quote.available,assets);
      reserveDeskCharge(next,'spyPending',{id,cost,assets,available,room:intimidationView?.room,buyerSlot:intimidationView?.selfSlot,target:Number(selected)});
      let report;
      if(bot){
        report={id,cost,botRoom:bot.room,issuedAt:now,...botTradingSnapshot(bot,now)};
        finishDeskCharge(next,'spyPending','spyCharges',id,true);
        next.botSpyReports=[report,...(next.botSpyReports??[])];
      }
      if(!save(next)){active.error='구매 기록을 저장할 수 없어. 다시 시도해 줘.';return;}
      state=next;
      if(report){beep('money');showSpyReport(active,report);}
      refreshLoanDesk(screen,state);
    });
  }finally{
    active.pending=false;
    if(!active.report)redrawSpy(active);
  }
  if(state.spyPending)void retrySpyPurchase();
}

async function intimidationPulse(){
  if(intimidationBusy||document.hidden||state.roomProgressResets?.length&&!await syncProgressResets())return;
  intimidationBusy=true;
  if(state.spyPending)void retrySpyPurchase();
  try{
    const pending=state.intimidationPending;
    if(pending){
      const outcome=await sendIntimidation(pending);
      if(outcome.accepted!==undefined){
        await withSaveLock(()=>{
          restoreLatestState();
          const updated={...state,intimidationCharges:[...(state.intimidationCharges??[])]};
          if(!finishIntimidation(updated,pending.id,outcome.accepted)||!save(updated))return;
          state=updated;
          if(outcome.accepted){
            if(intimidationView?.room===pending.room){
              intimidationView={...intimidationView,targets:intimidationView.targets.map(friend=>
                friend.slot===pending.target?{...friend,nextAt:outcome.nextAt}:friend)};
            }
            if(modal?.type==='desk-intimidation')dismiss();
            beep('money');feedback('협박 비용 '+won(pending.cost)+' 결제 완료');
          }else{feedback(outcome.error);if(modal?.type==='desk-intimidation')updateModal();}
          if(tab==='assets')render();
          if(modal?.type==='day-summary')updateModal();
          paintLive();
        });
      }
    }
    const game=state.resetId,view=await fetchIntimidations();
    if(game!==state.resetId)return;
    if(view){
      const oldTargets=JSON.stringify([intimidationView?.room,intimidationView?.targets]);
      const oldSpyTargets=JSON.stringify([intimidationView?.room,intimidationView?.targets,intimidationView?.spyReady]);
      intimidationView=view;
      paintSpyNotice();void syncSpyProfile();
      if(modal?.type==='desk-spy'&&!modal.report&&oldSpyTargets!==JSON.stringify([view.room,view.targets,view.spyReady]))redrawSpy(modal);
      await withSaveLock(()=>{
        if(!stillCurrentGame(game))return;
        const day=state.day;
        const unread=intimidationReportNotices(state).length;
        const queued=queueIntimidations(state,view.incoming);
        const tick=syncAndSave();
        if(queued||view.incoming.length){
          const applied=new Set((state.intimidationNotices??[]).map(event=>event.id));
          if(save())acknowledgeIntimidations(view.incoming.filter(event=>applied.has(event.id)).map(event=>event.id));
        }
        if(tick.rolled||state.day!==day)renderDayChange();
        else if(tick.mentalChanged)publishClock(tick);
        if(intimidationReportNotices(state).length>unread)intimidationNoticeWaiting=true;
      });
      if(modal?.type==='desk-intimidation'&&(modal.error||oldTargets!==JSON.stringify([view.room,view.targets]))){
        modal.error=false;updateModal();
      }
    }else if(modal?.type==='desk-intimidation'&&!intimidationView&&!modal.error){
      modal.error=true;updateModal();
    }
    if(intimidationNoticeWaiting&&(!modal||modal.type==='settlement-report')){
      intimidationNoticeWaiting=false;showSettlementReport(true);
    }
  }finally{intimidationBusy=false;}
}
async function submitIntimidation(form){
  const active=modal,view=intimidationView;
  if(active?.type!=='desk-intimidation'||active.pending)return;
  const selected=form.elements.target?.value;
  const bot=testFriend(selected), target=Number(selected);
  const friend=view?.targets.find(member=>member.slot===target);
  if(!bot&&(!view?.room||!friend||friend.nextAt>Date.now()))return;
  active.pending=true;
  try{
    await writeToday(()=>{
      if(modal!==active||state.intimidationPending||state.phase!=='open')return;
      if(state.roomProgressResets?.length&&!bot){feedback('방 기록을 동기화한 뒤 이용할 수 있어.');return;}
      const wealth=netWealth(state),available=exchangeable(state,'KRW'),cost=intimidationFee(wealth);
      if(available<cost){updateModal();return;}
      const updated={...state},id=crypto.randomUUID();
      const botResult=bot?intimidateTestFriend(updated,bot,{id,cost,now:Date.now()}):null;
      if(bot&&!botResult){updateModal();return;}
      if(!bot)reserveIntimidation(updated,{id,room:view.room,target,wealth,available,cost});
      if(!save(updated)){feedback('이용 비용을 저장할 수 없어. 다시 시도해 줘.');return;}
      state=updated;
      if(botResult){
        active.botResult=botResult;
        if(tab==='loan-desk')refreshLoanDesk(screen,state);
        beep('money');feedback(bot.name+'에게 협박을 전했어.');
      }
      updateModal();
      if(botResult)overlay.querySelector('#intimidation-target')?.focus({preventScroll:true});
    });
  }finally{active.pending=false;}
  if(!bot)void intimidationPulse();
}
let savingDeskLoan=false;
function renderLoanSheet(focusStage=false){
  updateModal();
  const sheet=overlay.querySelector('.sheet');
  if(!focusStage||!sheet)return;
  sheet.scrollTop=0;
  const target=sheet.querySelector('[aria-current="step"]')||sheet.querySelector('[data-act="dismiss"]');
  target?.focus({preventScroll:true});
}
function closeDeskRerollAd(active){
  active.stopAd?.();
  delete active.stopAd;
  delete active.reroll;
}
function startDeskRerollAd(){
  const active=modal,dice=state.loanDesk?.rateDice;
  if(active?.type!=='desk-loan'||active.reroll||savingDeskLoan||!dice||state.loanDesk?.loan||
    deskLoanRequestError(state,deskLoanDraftAmount()))return;
  const attempt={dice,day:state.day,resetId:state.resetId};
  active.reroll=attempt;
  renderLoanSheet(true);
  active.stopAd=watchGameAd(overlay,()=>{void rollDeskLoanRate(active,attempt);},deskRerollAdSeconds);
}
async function rollDeskLoanRate(active,attempt){
  if(savingDeskLoan||modal!==active||active?.type!=='desk-loan'||active.reroll!==attempt)return;
  const focused=document.activeElement;
  savingDeskLoan=true;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let tossed=false;
  try{
    await writeToday(()=>{
      if(modal!==active||active.reroll!==attempt)return;
      if(attempt){
        closeDeskRerollAd(active);
        renderLoanSheet(true);
      }
      const dice=state.loanDesk?.rateDice;
      const quoteChanged=attempt?
        state.day!==attempt.day||state.resetId!==attempt.resetId||!dice||dice.some((value,i)=>value!==attempt.dice[i]):
        Boolean(dice);
      if(quoteChanged||state.loanDesk?.loan){
        if(!attempt)renderLoanSheet();
        feedback('대출 조건이 바뀌었어. 최신 금리를 확인해 줘.');
        return;
      }
      const next={...state,loanDesk:state.loanDesk&&{...state.loanDesk}};
      const error=deskLoanRequestError(state,deskLoanDraftAmount())||rollDeskRate(next);
      if(error){feedback(error);return;}
      if(!save(next,{syncPortfolio:false})){feedback('금리를 저장하지 못했어. 다시 시도해 줘.');return;}
      state=next;
      tossed=!reduced;
      setLoanDeskToss(overlay,state,tossed?performance.now():null);
      if(reduced)beep('diceLand',1);
      else beep('diceToss');
    });
    if(tossed){
      loanDiceTiming.impacts.forEach(({at,die,strength})=>setTimeout(()=>{
        if(modal===active&&!document.hidden)beep('diceLand',{die,strength});
      },at));
      await new Promise(resolve=>setTimeout(resolve,loanDiceTiming.settled));
    }
  }finally{
    savingDeskLoan=false;
    if(tossed)setLoanDeskToss(overlay,state,null);
    if(modal===active&&(attempt||[focused,document.body].includes(document.activeElement))){
      overlay.querySelector('#loan-desk-rate-next:not(:disabled)')?.focus({preventScroll:true});
    }
  }
}
async function submitDeskLoan(form){
  if(modal?.type!=='desk-loan'||savingDeskLoan)return;
  if(form.dataset.mode==='amount'){
    if(loanDeskNext(state))renderLoanSheet(true);
    return;
  }
  const active=modal,seen=JSON.stringify(state.loanDesk??null);
  const amount=deskLoanDraftAmount(),repay=form.dataset.mode==='repay';
  savingDeskLoan=true;
  form.querySelector('button[type="submit"]').disabled=true;
  try{
    await writeToday(()=>{
      if(modal!==active)return;
      if(JSON.stringify(state.loanDesk??null)!==seen||repay!==Boolean(state.loanDesk?.loan)){
        clearLoanDeskDraft();feedback('대출 내역이 바뀌었어. 최신 잔액을 확인해 줘.');return;
      }
      const error=repay?repayDeskLoan(state,amount):takeDeskLoan(state,amount);
      if(error){feedback(error);return;}
      save();beep('money');clearLoanDeskDraft();render();
      if(repay){
        openRepaymentPaper(state.loanDesk.ledger.at(-1),deskLoanBalance(state)?.total??0,'desk-loan-popup');
      }else{
        const terms=deskLoanContract(state);
        openLoanPaper('대출 계약서',terms.lender,loanContractBody(terms),'desk-loan-popup');
      }
    });
  }finally{
    savingDeskLoan=false;
    if(modal===active)renderLoanSheet(true);
  }
}
function renderBank(focusStage=false){
  render();
  if(modal?.type==='bank-repay'){
    if(state.credit?.loan)refreshFinancialView(overlay,state);
    else openModal('bank-repay');
    return;
  }
  if(modal?.type!=='bank-loan')return;
  if(state.credit?.loan)openModal('bank-loan');
  else renderLoanSheet(focusStage);
}
const creditContext=()=>({
  render:renderBank,save,feedback,beep,
  repaid:(row,remaining)=>{render();openRepaymentPaper(row,remaining,'bank-loan-popup');},
  open:()=>modal?.type==='bank-loan',
});
async function sendReactionTo(room,kind){
  if(!testFriend(room))return;
  const result=await sendBotChat(room,{kind:'reaction',content:kind});
  if(result.error){feedback(result.error);return;}
  if(result.sent){
    beep('friend',kind);
    if(tab==='league'&&leagueView===room)paintChat(screen,'',{sent:true,view:room});
    else feedback('감정표현을 채팅에 보냈어.');
  }
}
const creditWrites=new Set(['credit-draw','credit-accept','credit-repay','credit-decline-confirm']);
let savingCredit=false;
async function changeCredit(name,el){
  if(savingCredit)return;
  const amountField=name==='credit-repay'?el.elements?.amount:null;
  if(name==='credit-repay'&&!amountField)return;
  savingCredit=true;
  const active=modal;
  const submitted=amountField?.value;
  const day=state.day,seenLoan=JSON.stringify(state.credit),resetId=state.resetId;
  const commit=()=>{
    if(name==='credit-accept'&&(active?.type!=='bank-loan'||modal!==active))return;
    if(name==='credit-repay'&&(active?.type!=='bank-repay'||modal!==active||amountField.value!==submitted))return;
    if(!stillCurrentGame(resetId))return;
    syncAndSave();
    if(state.day!==day){renderDayChange();return;}
    if(JSON.stringify(state.credit)!==seenLoan){
      renderBank();feedback('다른 창에서 대출 정보가 바뀌었어. 최신 조건을 확인해 줘.');return;
    }
    creditAction(name,el,state,creditContext());
  };
  try{
    await withSaveLock(commit);
  }finally{savingCredit=false;}
}
const dedicatedActionSounds=new Set([
  'article','ritual-start','loan-desk-roll','spin','sound','submit-order',
  'rehab-stop','credit-draw','credit-accept','credit-repay','friend-reaction','election-vote','pet-cat','pet-desk-cat',
]);
function act(name, el) {
  if(name!=='spin'&&(state.sound||name==='sound')){
    prepareGameAudio({unmuting:name==='sound'&&!state.sound});
  }
  if(!dedicatedActionSounds.has(name))beep('menu');
  const i=Number(el.dataset.id), v=el.dataset.value;
  if(name==='election-vote'){
    const game=state.resetId;
    if(state.roomProgressResets?.length){feedback('방 기록을 동기화한 뒤 투표할 수 있어.');void electionPulse();return;}
    void voteInElection(v,()=>showElectionUpdate({changed:true})).then(async update=>{
      if(update.stamped&&game&&!state.electionResetVersion){
        await withSaveLock(()=>{
          if(stillCurrentGame(game)){state.electionResetVersion=1;save();}
        });
      }
      showElectionUpdate(update);
    });return;
  }
  if(name==='status-view'&&(v==='ledger'||v==='overview')){go(v==='ledger'?'assets/ledger':'assets');return;}
  if(name==='loan-desk-roll'){void rollDeskLoanRate(modal);return;}
  if(name==='loan-desk-reroll-ad'){startDeskRerollAd();return;}
  if(name==='loan-desk-preset'){loanDeskPreset(el,overlay,state);return;}
  if(name==='loan-repay-max'){
    const field=el.form.elements.amount;
    field.value=groupAmount(el.dataset.value);
    if(!creditInput(field,state))loanDeskInput(field,state);
    return;
  }
  if(modal?.type==='desk-loan'&&!modal.reroll&&!savingDeskLoan&&loanDeskStage(name,state)){renderLoanSheet(true);return;}
  if(name==='desk-spy'){openSpyDesk();return;}
  if(name==='spy-notice-ack'){void acknowledgeSpyNotice();return;}
  if(name==='spy-read'){void readSpyFile(v);return;}
  if(name==='spy-load'){void loadSpyArchive(modal);return;}
  if(name==='spy-back'&&modal?.type==='desk-spy'){modal.report=null;redrawSpy(modal,true);return;}
  if(name==='desk-intimidation'){
    const target=intimidationView?.targets[0]?.slot??testFriends[0].room;
    openModal(name,{target:String(target)});void intimidationPulse();return;
  }
  if(creditWrites.has(name)){void changeCredit(name,el);return;}
  if(creditAction(name,el,state,creditContext()))return;
  if(broker.handleBroker(name,el)||news.newsAction(name,el,state)||handleAtlas(name,el,state)){
    if(tab==='international'&&name.startsWith('atlas-'))syncAtlasRoute(name);
    render();if(modal)updateModal();return;
  }
  switch(name) {
    case 'ritual-repair':void repairPreviousRitual(true);break;
    case 'ritual-start':void startRitual(v,el.dataset.previous);break;
    case 'tab':go(el.dataset.tab);break;
    case 'market-search':if(tab==='market'&&assetId===null&&!marketCalendar)openModal('market-search');break;
    case 'dismiss':dismiss();break;
    case 'change-room':location.assign('?lobby=1');break;
    case 'reset-save':if(modal?.type==='settings')openModal('reset-save');break;
    case 'reset-cancel':if(modal?.type==='reset-save')openModal('settings');break;
    case 'reset-confirm':void resetGame();break;
    case 'election-repair':void repairOldBallot();break;
    case 'chat-invite':openModal(name);break;
    case 'chat-join':if(chatCode(v)){void chatAction('join',v);}break;
    case 'chat-earlier':void chatAction('earlier');break;
    case 'chat-copy':{
      const input=$('#chat-invite-url');
      if(!input)break;
      const manual=()=>{input.focus();input.select();feedback('초대 링크를 선택했어. 복사해 줘.');};
      if(navigator.clipboard)void navigator.clipboard.writeText(input.value).then(()=>feedback('친구 초대 링크를 복사했어.'),manual);
      else manual();
      break;
    }
    case 'chat-share':{
      const target=shareTarget(el.dataset.kind,v,state);
      if(!target)break;
      if(target.kind==='assets'){
        const {net,assetsTotal,loanTotal}=householdSnapshot(state);
        openModal(name,{target,assetTotals:{amount:net,assetsTotal,debtTotal:loanTotal}});
      }else openModal(name,{target});
      break;
    }
    case 'chat-send-share':void sendChatShare();break;
    case 'friend-rank':go('league/rank');break;
    case 'friend-profile':if(findFriendProfile(state,v))openModal('friend',{key:v});break;
    case 'friend-reaction':void sendReactionTo(el.dataset.room,v);break;
    case 'sound':void writeToday(()=>{
      state.sound=!state.sound;muteGame(!state.sound);save();beep('soundOn');if(modal?.type==='settings'||modal?.type==='fortune')updateModal();
      feedback(state.sound?'효과음을 켰어.':'효과음을 껐어.');
    });break;
    case 'calendar-day':
      if(tab==='market'&&marketCalendar&&calendarDay(v)!==null)openModal('market-calendar-day',{date:v});
      break;
    case 'orders':openModal('activity',{kind:'orders'});break;
    case 'activity':if(Object.hasOwn(activityNames,v))openModal('activity',{kind:v});break;
    case 'activity-day':if(modal?.type==='activity'&&modal.kind==='analysis'&&Number.isSafeInteger(Number(v))){
      modal.day=Number(v);updateModal();overlay.querySelector('.sheet').scrollTop=0;
      const buttons=[...overlay.querySelectorAll('[data-act="activity-day"]:enabled')];
      (buttons.find(b=>b.getAttribute('aria-label')===el.getAttribute('aria-label'))??buttons[0])?.focus({preventScroll:true});
    }break;
    case 'settings':case 'wallet':case 'mental':case 'spending':case 'salary-negotiation':case 'tutorial-replay':openModal(name);break;
    case 'salary-watch':startSalaryAd(Number(v));break;
    case 'salary-history':if(modal?.type==='salary-negotiation'&&!modal.stage)showSalarySubview('history');break;
    case 'salary-back':returnToSalaryOffer();break;
    case 'salary-save':if(modal?.type==='salary-negotiation'&&modal.stage==='retry')finishSalaryAd(modal);break;
    case 'pet-desk-cat':if(petCharacter(el))beep('pet');break;
    case 'pet-cat':patHomeCat(el);break;
    case 'character-test':if(modal?.type==='mental')openModal('character-test');break;
    case 'character-preview':{
      if(modal?.type!=='character-test'||(v!=='auto'&&!characterPoses.some(({id})=>id===v))||v===characterPreview)break;
      characterPreview=v;
      renderScreen();
      updateModal();break;
    }
    case 'fortune':openModal('fortune');break;
    case 'rehabilitation':if(tab==='credit')openModal(name);break;
    case 'rehab-apply':case 'rehab-cancel':{
      if(modal?.type!=='rehabilitation'||modal.inputPending)break;
      if(name==='rehab-apply'&&!rehabilitationView(state).canApply)break;
      modal.confirming=name==='rehab-apply';
      updateModal();
      overlay.querySelector(modal.confirming?'[data-act="rehab-cancel"]':'[data-act="rehab-apply"]')?.focus({preventScroll:true});
      break;
    }
    case 'rehab-confirm':case 'rehab-start':case 'rehab-stop':void playRehabilitation(name,el);break;
    case 'rehab-stay':if(modal?.type==='rehabilitation'&&modal.leaving&&!modal.inputPending)showRehabilitationExit(false);break;
    case 'rehab-leave':void leaveRehabilitation(el.dataset.token);break;
    case 'bank-loan':case 'bank-repay':case 'desk-loan':openModal(name);break;
    case 'day-summary':openModal('day-summary');break;
    case 'shop':if(tab==='home')openModal('shop');break;
    case 'shop-glasses-buy':void purchaseGlasses(Number(v));break;
    case 'ai-forecast':void openGlassesForecast(i);break;
    case 'settlement-history':
      if(modal?.type==='day-summary')openModal('settlement-report',{day:state.history.at(-1)?.day,rankScroll:modal.rankScroll});
      break;
    case 'spin':void pullFortune();break;
    case 'watch-recovery':startRecovery();break;
    case 'analyze-article':{
      if(!stocks[i]||!articleById(state,v))break;
      const query=new URLSearchParams();
      query.set('article',v);
      if(el.dataset.question)query.set('question',el.dataset.question);
      go('market/'+stocks[i].code+'/analysis'+(query.toString()?'?'+query:''));
      screen.querySelector('.bk-panel-info')?.scrollIntoView({block:'start'});
      break;
    }
    case 'symbol':if(stocks[i])go('market/'+stocks[i].code);break;
    case 'article':if(articleById(state,v)){go('news/paper/'+v);beep('paper');}break;
    case 'article-back':
      if(articleId&&history.state?.openedArticle===articleId)history.back();
      else route('news/paper');
      break;
    case 'open-atlas':go('news/world/'+v);break;
    case 'favorite':discover.toggleWatch(v);render();if(modal)updateModal();break;
    case 'fx':case 'order-fx':{
      if(v&&!isExchangeCurrency(v))break;
      const returning=name==='order-fx'?{...modal}:null;
      const funding=returning&&orderMath(returning).funding;
      if(funding>0){openFunding(returning,funding);break;}
      const to=v||'USD',from=to==='KRW'?'USD':'KRW';
      openModal('fx',{from,to,amount:'',returning});break;
    }
    case 'fx-direction':{
      if(modal?.type!=='fx'||modal.returning||!isExchangeCurrency(v)||modal.from===v)break;
      modal.to=modal.from;modal.from=v;modal.amount='';
      updateModal();break;
    }
    case 'fx-part':{const digits=currencies[modal.from].digits,scale=10**digits;modal.amount=groupAmount((Math.floor(exchangeable(state,modal.from)*Number(v)*scale+1e-8)/scale).toFixed(digits),digits);updateModal();break;}
    case 'interval':
      if(terminal.adjust(name,v)==='render')render();break;
    case 'draw':
      terminal.adjust(name,v);dismiss();break;
    case 'draw-settings':openModal('drawings');break;
    case 'study-settings':openModal('studies');break;
    case 'study-pane':terminal.chooseStudyPane(overlay.querySelector('#study-form'),v);break;
    case 'study-default':terminal.resetForm(overlay.querySelector('#study-form'));break;
    case 'trade':{
      if(!stocks[i])break;
      const ord=state.orders[i],side=el.dataset.side||(ord<0||stocks[i].archiveOnly?'sell':'buy');
      if(stocks[i].archiveOnly&&(side==='buy'||!state.holdings[i]))break;
      const preset=el.dataset.price?Number(el.dataset.price):null;
      openModal('trade',{i,side,qty:defaultOrderQuantity(i,side),replaceQuantity:true,
        kind:preset===null&&ord&&state.orderPrices[i]===null?'market':'limit',
        price:preset??state.orderPrices[i]??snapPrice(i,quoteAt(state,i))});break;
    }
    case 'side':
      if(modal?.type!=='trade'||!['buy','sell'].includes(v)||v==='buy'&&stocks[modal.i].archiveOnly)break;
      if(modal.side!==v){modal.side=v;setOrderQuantity(defaultOrderQuantity(modal.i,v));}break;
    case 'order-kind':
      if(modal?.type==='trade'&&['limit','market'].includes(v)){modal.kind=v;updateModal();}break;
    case 'order-current':
      if(modal?.type==='trade'){
        modal.kind='limit';modal.price=snapPrice(modal.i,quoteAt(state,modal.i));updateModal();
      }break;
    case 'qty-key':
      if(modal?.type==='trade'&&(/^[0-9]$/.test(v)||v==='00'||v==='backspace'||v==='.'&&orderQuantityDigits(modal.i)))enterOrderDigit(v);
      break;
    case 'qty-proportion':{
      if(modal?.type!=='trade'||!['10','25','50','100'].includes(v))break;
      const {max}=orderMath(),{lot}=stocks[modal.i];
      const amount=Math.floor((max/lot)*Number(v)/100+1e-7)*lot;
      setOrderQuantity(Math.min(max,quantityRound(Math.max(lot,amount))));break;
    }
    case 'submit-order':case 'cancel-order':{
      if(modal?.type!=='trade')break;
      const active=modal,{side,qty:requested,i:id}=active;
      const submitting=name==='submit-order',qty=submitting?requested*(side==='buy'?1:-1):0;
      const price=submitting?priceDraft(active):null;
      if(submitting&&(!Number.isFinite(qty)||!qty||Number.isNaN(price)))break;
      const requestingFx=qty>0&&orderMath(active).funding>0,stamp=orderStamp(id);
      void writeToday(()=>{
        if(modal!==active||submitting&&(active.qty!==requested||active.side!==side||priceDraft(active)!==price))return;
        if(stamp!==orderStamp(id)){updateModal();feedback('기존 주문 상태가 바뀌었어. 주문을 다시 확인해 줘.');return;}
        if(qty>0){
          const {funding}=orderMath(active);
          if(funding>0){openFunding(active,funding);return;}
          if(requestingFx){updateModal();feedback('매수할 외화가 충분해. 주문을 확인해 줘.');return;}
        }
        const error=placeOrder(state,id,qty,price);
        if(error){feedback(error);return;}
        save();if(qty)beep('order');
        dismiss();render();feedback(qty?stocks[id].name+' '+quantity(Math.abs(qty))+quantityUnit(id)+' '+
          (qty>0?'매수':'매도')+' 주문 접수':'주문을 취소했어.');
      });break;
    }
  }
}
document.addEventListener('click', e => {
  if(e.target===overlay){dismiss();return;}
  const button=e.target.closest('button[data-act], svg [data-act]');
  if(button){if(!button.disabled)act(button.dataset.act,button);return;}
  if(e.target.closest('summary, button:not(:disabled):not([type="submit"])')&&
    !e.composedPath().some(node=>node.classList?.contains('guide-full'))){
    if(state.sound)prepareGameAudio();
    if(!e.target.closest('[data-pet-target]'))beep('menu');
  }
});
bindFortuneLever(overlay,pullFortune);
window.addEventListener('hashchange',()=>route(location.hash.slice(1)||'home'));
document.addEventListener('input',e=>{
  if(e.target.id==='friend-chat-input'){setChatDraft(e.target.value,leagueView);return;}
  if(loanDeskInput(e.target,state)||creditInput(e.target,state))return;
  if(modal?.type==='fx'&&e.target.id==='fx-amount'){modal.amount=applyAmountGrouping(e.target,currencies[modal.from].digits);updateModal();}
  if(modal?.type==='trade'&&e.target.id==='order-qty'){
    const digits=orderQuantityDigits(modal.i);
    modal.qtyText=applyAmountGrouping(e.target,digits);
    modal.qty=amountFromText(modal.qtyText,digits)??NaN;modal.replaceQuantity=false;updateModal();
  }
  if(modal?.type==='trade'&&e.target.id==='limit-price'){modal.price=applyAmountGrouping(e.target,currencies[stocks[modal.i].currency].digits);updateModal();}
  if(modal?.type==='studies'&&e.target.form?.id==='study-form')e.target.setCustomValidity('');
});
document.addEventListener('submit',e=>{
  if(e.target.id==='friend-chat-compose'){e.preventDefault();void sendChatForm(e.target);return;}
  if(e.target.id==='spy-form'){e.preventDefault();void submitSpy(e.target);return;}
  if(e.target.id==='intimidation-form'){e.preventDefault();void submitIntimidation(e.target);return;}
  if(e.target.id==='exchange-form'){
    e.preventDefault();if(modal?.type!=='fx')return;
    const active=modal,{from,to,offered}=active,amount=amountFromText(active.amount,currencies[from].digits);
    void writeToday(()=>{
      if(modal!==active||active.from!==from||active.to!==to||amountFromText(active.amount,currencies[from].digits)!==amount)return;
      if(active.needed){
        const draft=active.returning;
        if(orderStamp(draft.i)!==active.orderStamp||!orderMath(draft).funding){
          openModal('trade',draft);feedback('주문 조건이 바뀌었어. 최신 주문서를 확인해 줘.');return;
        }
      }
      const error=exchange(state,from,to,amount,offered??null);
      if(error){updateModal();feedback(error);return;}
      const back=active.returning;save();beep('money');render();if(back)openModal('trade',back);else{active.amount='';updateModal();}
      feedback('환전 완료 · '+fmtMoney(state.fxLog.at(-1).received,state.fxLog.at(-1).to)+' 입금');
    });return;
  }
  if(e.target.id==='credit-amount-form'){
    e.preventDefault();creditAction('credit-next',e.target,state,creditContext());return;
  }
  if(e.target.id==='bank-repay-form'){
    e.preventDefault();void changeCredit('credit-repay',e.target);return;
  }
  if(e.target.id==='loan-desk-form'){
    e.preventDefault();void submitDeskLoan(e.target);return;
  }
  if(e.target.id!=='study-form')return;e.preventDefault();
  const error=terminal.applyForm(e.target);
  if(error){e.target.querySelector('.study-error').textContent=error[0];const field=e.target.elements[error[1]];field.focus();return;}
  dismiss();render();feedback('차트에 지표 설정을 적용했어.');
});
bindSelectionAudio(frame,()=>state.sound&&!frame.dataset.roomGate);
document.addEventListener('change', e => {
  if(e.target.id==='settlement-date'){selectSettlementDay(Number(e.target.value));return;}
  if(e.target.id==='spy-target'&&modal?.type==='desk-spy'){modal.target=e.target.value;modal.error='';updateModal();return;}
  if(e.target.id==='intimidation-target'&&modal?.type==='desk-intimidation'){modal.target=e.target.value;updateModal();return;}
  if(e.target.id==='chat-share-recipient'&&modal?.type==='chat-share'){
    modal.recipient=testFriend(e.target.value)?e.target.value:'';return;
  }
  if(e.target.id==='chart-detailed'){terminal.setChartDetail(e.target.checked);render();$('#chart-detailed')?.focus({preventScroll:true});return;}
  if(e.target.id==='chart-intraday'){terminal.adjust('interval',e.target.value);render();$('#chart-intraday')?.focus({preventScroll:true});return;}
  if(news.newsChange(e.target)){news.refreshKiosk(screen,state);return;}
  if(broker.brokerChange(e.target,state)){
    render();if(e.target.id==='bk-sector')$('#bk-sector')?.focus({preventScroll:true});return;
  }
  if(e.target.id==='atlas-country-select'||e.target.id==='atlas-continent-select'){
    const action=e.target.id==='atlas-country-select'?'atlas-country':'atlas-region';handleAtlas(action,e.target,state);syncAtlasRoute(action);render();return;
  }
});
window.addEventListener('storage', e => {
  const thread=threadForStorage(e.key);
  if(thread&&tab==='league'){
    if(leagueView===thread)paintChat(screen,'',{view:thread});
    else if(!leagueView)render();
    return;
  }
  if (e.key !== storeKey || !e.newValue) return;
  const updated=readState();
  if(!updated)return;
  const previous=state,newDay=previous.day!==updated.day;
  setRoomProgressId(updated.roomProgressId??'');
  if(previous.resetId===updated.resetId&&previous.electionReset?.resetId!==updated.electionReset?.resetId){
    useElectionReset(updated.electionReset);
    queueMicrotask(electionPulse);
  }
  if(previous.resetId!==updated.resetId){applyGameReset(updated);return;}
  const spent=(todayLiveSpending(updated)?.total??0)-(todayLiveSpending(previous)?.total??0);
  state=usesKst(updated)?updated:startLive(updated);muteGame(!state.sound);
  if(tab==='ritual'&&(previous.ritualPending?.id!==state.ritualPending?.id||previous.ritualLast?.id!==state.ritualLast?.id))renderScreen();
  if(state.sound!==previous.sound&&(modal?.type==='settings'||modal?.type==='fortune'))updateModal();
  if(modal?.type==='desk-spy'&&!modal.report&&
    (previous.spyPending?.id!==state.spyPending?.id||previous.spyCharges?.length!==state.spyCharges?.length)){
    redrawSpy(modal);
    if(previous.spyPending&&!state.spyPending)void loadSpyArchive(modal);
  }
  const mentalChanged=state.mental!==previous.mental;
  if(newDay)renderDayChange();
  else if(modal?.type==='fortune-ad'&&(state.fortuneRerollReady||state.fortuneRerollUsed)){
    render();returnToFortune();
  }else if(modal?.type==='rehabilitation'){
    if(previous.rehabilitationSettlements?.length!==state.rehabilitationSettlements?.length)renderScreen();
    updateModal();
  }else if(modal?.type==='fortune'&&!modal.spinning&&
    (previous.luck!==state.luck||previous.fortuneRerollReady!==state.fortuneRerollReady||
      previous.fortuneRerollUsed!==state.fortuneRerollUsed)){
    render();updateModal();
  }else if(modal?.type==='salary-negotiation'&&modal.recordDay!==state.salaryNegotiation?.day){
    if(modal.stage==='history'){
      updateModal();
      overlay.querySelector('#salary-history-title')?.focus({preventScroll:true});
    }else{
      modal.stopAd?.();delete modal.stopAd;delete modal.stage;updateModal();
      focusSalaryOutcome();
    }
  }
  else if(modal?.type==='desk-loan'&&JSON.stringify(previous.loanDesk)!==JSON.stringify(state.loanDesk)){
    render();renderLoanSheet();
  }else if(['bank-loan','bank-repay'].includes(modal?.type)&&JSON.stringify(previous.credit)!==JSON.stringify(state.credit)){
    renderBank();
  }else if(spent>0||mentalChanged)publishClock({spent,mentalChanged,advanced:previous.cursor!==state.cursor,filled:state.fills.length>previous.fills.length,expired:state.expired.length>previous.expired.length});
  else if(modal?.type==='spending'&&state.cash!==previous.cash)updateModal();
  else if(modal?.type==='day-summary'||modal?.type==='shop')updateModal();
  else if(['desk-loan','bank-loan','bank-repay'].includes(modal?.type))refreshFinancialView(overlay,state);
  else if(!modal||modal.type==='activity'){
    const clockOnly=Object.keys(state).every(key=>
      ['mentalDecayAt','mentalConnectedAt','mentalConnectionFlat','wallMinute','wallSecond','petRecovery'].includes(key)||JSON.stringify(state[key])===JSON.stringify(previous[key]));
    if(!clockOnly){
      if(terminal.interacting())chartRenderPending=true;
      else render();
      if(modal?.type==='activity')updateModal();
    }
  }
});
document.addEventListener('keydown', e => {
  if(!modal){
    if(e.target.id==='friend-chat-input'&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229){
      e.preventDefault();e.target.form.requestSubmit();return;
    }
    const target=e.target.closest?.('svg [role="button"][data-act]');
    if(target&&(e.key==='Enter'||e.key===' ')){e.preventDefault();act(target.dataset.act,target);}
    return;
  }
  if(e.key==='Escape'){e.preventDefault();dismiss();return;}
  if(e.key!=='Tab')return;
  const items=[...overlay.querySelectorAll('button:not(:disabled),summary,input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el=>el.offsetParent!==null&&!el.closest('[inert]'));
  if(!items.length)return;
  if(e.shiftKey && (document.activeElement===items[0] || !items.includes(document.activeElement))){e.preventDefault();items.at(-1).focus();}
  else if(!e.shiftKey && document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}
});
void withSaveLock(()=>{
  restoreLatestState();
  if(state.resetId===openingState.resetId){
    if(intimidationView)queueIntimidations(state,intimidationView.incoming);
    mergeRoomRituals(state,openingRituals);
  }
  openingRituals=null;
  syncAndSave();save();
});
useElectionReset(state.electionReset);
muteGame(!state.sound);
if(state.sound)preparePaperAudio();
const initialHash=location.hash.slice(1), legacyElection=new URLSearchParams(location.search).has('election');
route(validSection(initialHash.split('/')[0])?initialHash:legacyElection?'election':'home');
if(state.history.length||deferredSettlementNotice||state.intimidationInbox?.length)showSettlementReport();
void electionPulse();
void intimidationPulse();
setInterval(rotateHeadline,3000);
setInterval(()=>{if(!document.hidden)void clockPulse();},1000/gameClockRate);
setInterval(()=>{if(document.hidden)void clockPulse(true);},10_000);
setInterval(()=>{if(!document.hidden)void electionPulse();},15000);
setInterval(()=>void chatPulse(),5000);
setInterval(()=>void intimidationPulse(),8000);
void ritualPulse();
setInterval(()=>void ritualPulse(),8000);
window.visualViewport?.addEventListener('resize',chatKeyboard);
document.addEventListener('focusin',chatKeyboard);
document.addEventListener('focusout',()=>queueMicrotask(chatKeyboard));
document.addEventListener('visibilitychange',()=>void chatPulse());
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){pauseSpending();stopPaperAudio();stopFortuneAudio();stopRitualAudio();}
  void clockPulse(true);
  if(!document.hidden){void electionPulse();void intimidationPulse();void ritualPulse();}
  resumeSpending();
});
window.addEventListener('pagehide',()=>{pauseSpending();stopPaperAudio();stopRitualAudio();void clockPulse(true);});
window.addEventListener('pageshow',event=>{
  if(event.persisted){connectedSince=Date.now();resumeSpending();void clockPulse(true);}
});
resumeSpending();
