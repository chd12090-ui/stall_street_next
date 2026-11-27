import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {HomePage,AssetsPage,MentalBody,SpendingBody,DayReview,DaySlip,SettlementSummary} from './home.jsx';
import {MarketPage,MarketSearchSheet,NewsPage,ChartSettings} from './exchange.jsx';
import {FriendsPage,ElectionPage,FriendRanking,FriendProfileBody,ShareBody,InviteBody} from './social.jsx';
import {BankPage,DeskPage,FinanceBody} from './finance.jsx';
import {FortuneBody,AdBody,CharacterPreviewDialog,SettingsBody,ResetBody} from './extras.jsx';
import {FxBody,WalletBody,ActivityBody} from './accounts.jsx';
import {OrderScreen} from './order.jsx';
import {CalendarDaySheet} from './exchange-calendar.jsx';
import {ForecastBody,ShopSheet} from './shop.jsx';
import {RehabilitationSheet} from './rehabilitation.jsx';
import {SalarySheet} from './salary-negotiation.jsx';
import {FieldGuide} from './field-guide.jsx';
import {Icon,Sheet} from './controls.jsx';
import {dayLabel} from '../game/clock-calendar.mjs';
import {activityNames} from '../game/investment-activity.mjs';
import {findFriendProfile} from '../game/league-profile.mjs';
import {fortuneRerollAdSeconds} from '../game/fortune-rules.mjs';
import {deskRerollAdSeconds} from '../game/loan-desk.mjs';
import {currencies} from '../game/world.mjs';
import {getRoomSession} from '../game/room-session.mjs';

const roots=new WeakMap();
function commit(host,element){
  let root=roots.get(host);
  if(!root){root=createRoot(host);roots.set(host,root);}
  // The game can move focus or start canvas/lever gestures immediately after a route change.
  flushSync(()=>root.render(element));
}
export function paintNavigation(host,tabs,selected,feed){
  commit(host,tabs.map(([id,name,label])=><button key={id} className={'tab '+(id===selected?'on':'')}
    data-act="tab" data-tab={id==='news'?'news/'+feed:id} aria-current={id===selected?'page':undefined}><Icon name={name}/><span>{label}</span></button>));
}
function GamePage({tab,state,options,assetsView,articleId,articleView,assetId,marketCalendar,leagueView,chatInvite}){
  switch(tab){
    case 'home':return <HomePage state={state} options={options}/>;
    case 'assets':return <AssetsPage state={state} view={assetsView}/>;
    case 'market':return <MarketPage state={state} assetId={assetId} calendar={marketCalendar}/>;
    case 'news':case 'international':case 'ritual':return <NewsPage ritual={tab==='ritual'} state={state} world={tab==='international'} articleId={articleId} articleView={articleView}/>;
    case 'credit':return <BankPage state={state}/>;
    case 'loan-desk':return <DeskPage state={state}/>;
    case 'league':return <FriendsPage state={state} view={leagueView} invite={chatInvite}/>;
    case 'election':return <ElectionPage state={state}/>;
  }
}
export function paintScreen(host,props){commit(host,<GamePage {...props}/>);}

function Dialog(props){
  const {modal,state,notices}=props,kind=modal.type;
  const finance=<FinanceBody kind={kind} state={state} modal={modal} intimidationView={props.intimidationView}/>;
  switch(kind){
    case 'fx':return <Sheet title={modal.needed?currencies[modal.to].name+' 부족분을 환전할까?':'통화 환전'} theme="counter-sheet bank-service-sheet fx-sheet"><FxBody state={state} modal={modal}/></Sheet>;
    case 'friend':{
      const person=findFriendProfile(state,modal.key);
      const title=person?.me?'내 프로필':person?person.name+' 프로필':'친구 프로필';
      return <Sheet title={title} tag="친구"><FriendProfileBody state={state} person={person}/></Sheet>;
    }
    case 'chat-share':return <Sheet title="친구 채팅에 공유"><ShareBody modal={modal}/></Sheet>;
    case 'friend-rank':return <FriendRanking state={state} initialPage={modal.rankPage}/>;
    case 'chat-invite':return <Sheet title="친구 초대"><InviteBody/></Sheet>;
    case 'desk-spy':return <Sheet title={modal.report?'염탐 보고서':'염탐하기'} theme="counter-sheet desk-service-sheet spy-sheet">{finance}</Sheet>;
    case 'desk-intimidation':return <Sheet title="협박하기" theme="counter-sheet desk-service-sheet">{finance}</Sheet>;
    case 'bank-loan':case 'bank-repay':return <Sheet title={kind==='bank-loan'?'대출하기':'대출 갚기'}
      tag={kind==='bank-repay'?'은행 창구':undefined} theme="counter-sheet loan-popup bank-loan-popup">{finance}</Sheet>;
    case 'desk-loan':return modal.reroll?
      <Sheet title="주사위 다시 굴리기" tag="게임 속 광고" theme="recovery-sheet"><AdBody state={state} duration={deskRerollAdSeconds}/></Sheet>:
      <Sheet title={state.loanDesk?.loan?'대출 갚기':'대출하기'}
      tag={state.loanDesk?.loan?'대부 창구':undefined} theme="counter-sheet loan-popup desk-loan-popup">{finance}</Sheet>;
    case 'loan-paper':return <Sheet title={modal.title} tag={modal.lender} theme={'loan-contract-sheet counter-sheet '+modal.theme}>{finance}</Sheet>;
    case 'rehabilitation':return <RehabilitationSheet state={state} modal={modal}/>;
    case 'market-calendar-day':return <CalendarDaySheet state={state} date={modal.date}/>;
    case 'market-search':return <MarketSearchSheet state={state}/>;
    case 'day-summary':return <DaySlip title="하루 정산" date={dayLabel(state)}><DayReview state={state}/></DaySlip>;
    case 'shop':return <ShopSheet sound={state.sound} state={state} problem={modal.problem}/>;
    case 'ai-forecast':return <Sheet title="AI 안경" theme="ai-forecast-sheet"><ForecastBody state={state} index={modal.index} prediction={modal.prediction}/></Sheet>;
    case 'settlement-report':return <SettlementSummary state={state} day={modal.day} notices={notices}/>;
    case 'reset-save':return <Sheet title="게임 기록 초기화"><ResetBody modal={modal}/></Sheet>;
    case 'spending':return <DaySlip title="실시간 소비" date={dayLabel(state)}><SpendingBody state={state}/></DaySlip>;
    case 'salary-negotiation':return <SalarySheet key={state.salaryNegotiation?.day??'first-offer'} state={state} modal={modal}/>;
    case 'recovery-ad':return <Sheet title="광고 보기" tag="게임 속 광고" theme="recovery-sheet"><AdBody state={state}/></Sheet>;
    case 'fortune-ad':return <Sheet title="운세 다시 뽑기" tag="게임 속 광고" theme="recovery-sheet"><AdBody state={state} duration={fortuneRerollAdSeconds}/></Sheet>;
    case 'drawings':case 'studies':return <Sheet title={kind==='studies'?'지표 설정':'그리기 도구'} theme="chart-popup"><ChartSettings kind={kind}/></Sheet>;
    case 'fortune':return <section className="sheet fortune-sheet" role="dialog" aria-modal="true" aria-label="오늘의 운세" tabIndex={-1}>
      <FortuneBody state={state} modal={modal}/>
    </section>;
    case 'mental':return <MentalBody state={state}/>;
    case 'character-test':return <CharacterPreviewDialog state={state} characterPreview={props.characterPreview}/>;
    case 'trade':return <OrderScreen {...props}/>;
    case 'settings':return <Sheet title="게임 설정" theme="settings-sheet"><SettingsBody state={state}/></Sheet>;
    case 'tutorial-replay':return <FieldGuide replay sound={state.sound} nickname={getRoomSession()?.nickname} onExit={props.closeGuide}/>;
    case 'wallet':return <Sheet title="내 지갑"><WalletBody state={state}/></Sheet>;
    case 'activity':return <Sheet title={activityNames[modal.kind]} theme="bk-activity-sheet"><ActivityBody state={state} modal={modal}/></Sheet>;
  }
}
export function paintDialog(host,props){commit(host,props?<Dialog key={props.session} {...props}/>:null);}
export function paintNotice(host,message){
  host.hidden=!message;
  commit(host,message?<><p role="status">{message}</p><button type="button" className="ui-control ui-compact ui-primary" data-act="spy-notice-ack">확인</button></>:null);
}
export function paintFeedback(host,message){commit(host,message);}
