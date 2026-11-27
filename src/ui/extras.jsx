import {gameClockRate} from '../game/clock-calendar.mjs';
import {fortuneSymbols,idleGrid,bingoOdds,bingoReductions,canDrawFortune,canUnlockFortuneReroll,fortuneGridFor,fortuneRerollAdSeconds,lineWins} from '../game/fortune-rules.mjs';
import {characterPose,characterPoses} from '../game/player-character.mjs';
import {recoveryDuration,recoverySpot} from '../game/recovery-ad.mjs';
import {getRoomSession} from '../game/room-session.mjs';
import {DataRow,Icon,LabDialog} from './controls.jsx';
import {PixelArt} from './home-art.jsx';

const symbolIcons = Object.values(fortuneSymbols);
const lampCount = 11;

function Celebration({wins}) {
  const jackpot = wins.length === 3;
  const sparkCount = jackpot ? 18 : wins.length === 2 ? 10 : 0;
  return <div className="fortune-celebration" aria-hidden="true">
    <i className="fortune-glint"/>
    {jackpot && <div className="fortune-fire"/>}
    {Array.from({length:sparkCount}, (_,i) => {
      const fromRight = i%2===1;
      const order = Math.floor(i/2);
      const inset = 3+(order*4)%13;
      return <i className="fortune-ember" key={i} style={{
        '--spark-x': (fromRight?100-inset:inset)+'%',
        '--spark-y': (jackpot?86+(order*3)%13:17+33*wins[order%wins.length])+'%',
        '--spark-dx': (fromRight?-1:1)*(4+(i*7)%23)+'px',
        '--spark-rise': (jackpot?30+(i*11)%62:13+(i*9)%26)+'px',
        '--spark-delay': (jackpot?200+i*62:105+i*33)+'ms',
        '--spark-time': (560+(i*49)%290)+'ms',
      }}/>;
    })}
  </div>;
}

function Reel({column,grid,wins,stopped}) {
  return <div className="fortune-reel" data-stopped={stopped?'':undefined} aria-hidden="true">
    <div className="fortune-track">{Array.from({length:7}, (_,i) =>
      <span className="fortune-symbol" key={i}><Icon name={symbolIcons[(column+i)%symbolIcons.length]}/></span>)}</div>
    <div className="fortune-cells">
      <span className="fortune-symbol reel-edge edge-before"><Icon name={fortuneSymbols[grid[2][column]]}/></span>
      {grid.map((row,i) =>
        <span key={i} className={'fortune-symbol'+(wins.includes(i)?' winning':'')} style={{'--slot-row':i}}>
          <Icon name={fortuneSymbols[row[column]]}/>
        </span>)}
      <span className="fortune-symbol reel-edge edge-after"><Icon name={fortuneSymbols[grid[0][column]]}/></span>
    </div>
  </div>;
}

export function FortuneBody({state,modal}) {
  const {spinning,pullProgress=0,reelsStopped=0} = modal;
  const drawn = fortuneGridFor(state);
  const grid = drawn ?? idleGrid;
  const shown = Boolean(drawn) && !spinning;
  const watchAd=canUnlockFortuneReroll(state);
  const canSpin=canDrawFortune(state,Boolean(state.luck));
  const blocked=spinning||!(watchAd||canSpin);
  const spinLabel=watchAd?fortuneRerollAdSeconds+'초 광고 보고 다시뽑기':
    canSpin?(state.luck?'다시 뽑기':'오늘 운세 뽑기'):'내일 다시 뽑을 수 있어';
  const wins = shown ? lineWins(grid) : [];
  const lines = wins.length;
  const celebrate = lines>0 && modal.hasSpun;
  const result = spinning ? '슬롯 회전 중' : shown ? (lines === 3 ? '3줄 잭팟' : lines+'줄 빙고') : '레버를 당겨 봐';
  const effect = lines ? '오늘 정신력이 떨어지는 속도 '+bingoReductions[lines]+'% 감소' : '정신력이 평소 속도로 줄어들어.';
  const status = spinning ? ' is-spinning'+(pullProgress===1?' is-fully-pulled':'')
    : shown ? ' is-revealed win-'+lines+(celebrate?' is-fresh-result':'') : '';
  return <div className={'fortune-chassis'+status} data-bingo={lines}
    style={spinning?{'--lever-from':(pullProgress*100)+'%', '--lever-latch':pullProgress===1?'0ms':'150ms'}:undefined}>
    <div className="fortune-cabinet">
      <PixelArt id="slot-cabinet" className="fortune-case-art" width={176} height={116} eager animated={false}/>
      <div className="fortune-hood">
        <div className="fortune-lights" aria-hidden="true">
          {Array.from({length:lampCount},(_,i)=><i key={i} style={{'--lamp-distance':Math.abs((lampCount-1)/2-i)}}/>)}
        </div>
        <button className="fortune-close ui-control ui-icon ui-compact" type="button" data-act="dismiss" aria-label="닫기"><Icon name="close"/></button>
      </div>
      <div className="fortune-machine">
        <div className="fortune-reels" role="img" aria-label={shown?'3행 3열, '+result:'3행 3열 슬롯'}>
          {[0,1,2].map(column=><Reel key={column} column={column} grid={grid} wins={wins} stopped={shown||column<reelsStopped}/>)}
          {lines>0 && <div className="fortune-paylines" aria-hidden="true">
            {wins.map(row=><i className="fortune-payline" key={row} style={{'--slot-row':row}}>
              {celebrate&&lines===2&&<span className="fortune-bingo-shine"/>}
            </i>)}
          </div>}
        </div>
        {celebrate && <Celebration wins={wins}/>}
      </div>
      <button className="fortune-lever" type="button" data-act="spin"
        data-slot-lever="" aria-label={watchAd?'레버로 재뽑기 광고 열기':'운세 레버를 아래로 당기기'} disabled={blocked}>
        <span className="fortune-lever-base"/><span className="fortune-lever-groove"><span className="fortune-handle"/></span>
      </button>
    </div>
    <div className="fortune-console">
      <div className="fortune-result" role="status">
        <strong>{result}</strong>
        {!spinning && <p>{shown?effect:'가로로 같은 그림 세 개가 맞으면 빙고.'}</p>}
      </div>
      <button className="fortune-action ui-control ui-primary" type="button" data-act="spin" disabled={blocked}>
        <Icon name={shown?'reload':'fortune-slot'}/><span>{spinning?'슬롯 회전 중':spinLabel}</span>
      </button>
      <details className="fortune-odds">
        <summary className="ui-disclosure ui-compact">빙고 효과와 확률</summary>
        <div className="fortune-odds-content">
          <p>가장 최근에 뽑은 효과가 게임 속 자정까지 적용돼.</p>
          {bingoOdds.map((chance,n)=><DataRow key={n} label={n+'줄 · '+(n?'정신력 감소 속도 −'+bingoReductions[n]+'%':'효과 없음')}>{chance}%</DataRow>)}
        </div>
      </details>
    </div>
    <div className="fortune-plinth" aria-hidden="true">
      <img src="/art/pixel/fortune-brass-plate.webp" width={64} height={16} alt=""/>
    </div>
  </div>;
}

export function AdBody({state,duration=recoveryDuration}) {
  const spot = recoverySpot(state);
  return <>
    <div className={'rest-ad rest-ad-'+spot.theme}>
      <div className="rest-ad-art" aria-hidden="true"><PixelArt id={spot.art} width={88} height={88}/></div>
      <div className="rest-ad-copy"><strong>{spot.brand}</strong><p>{spot.copy}</p></div>
    </div>
    <div className="rest-ad-progress">
      <progress aria-label="광고 재생 진행률" max={duration} value={0}/>
      <span data-ad-remaining="">{duration+'초'}</span>
    </div>
  </>;
}

export function CharacterPreviewDialog({state,characterPreview}) {
  const pose = characterPose(state.mental,characterPreview);
  // Seated sprites leave space above their ears for the home scene's petting hand.
  const top = pose.phoneOnSeat ? Math.min(pose.petBounds[1],pose.height-140) : 0;
  return <LabDialog title="캐릭터 표정 미리보기">
    <div className="expression-scope">
      <div className="expression-glass">
        <svg viewBox={`0 ${top} ${pose.width} ${pose.height-top}`} role="img" aria-label={pose.alt}
          className="expression-image" data-character-pose={pose.id} focusable="false">
          <image href={'/art/player/pose-'+pose.id+'.svg'} width={pose.width} height={pose.height}/>
        </svg>
      </div>
      <div className="expression-reading">
        <strong aria-live="polite" aria-atomic="true">{pose.label}</strong>
        <button className="ui-control ui-compact lab-test" data-act="character-preview" data-value="auto"
          aria-pressed={characterPreview==='auto'} title="현재 정신력에 맞춰 선택">자동</button>
      </div>
    </div>
    <div className="expression-keys" role="group" aria-label="캐릭터 표정">
      {characterPoses.map(({id,label},index)=><button className="ui-control lab-test" key={id} data-act="character-preview" data-value={id}
        aria-pressed={characterPreview===id}><span>{index+1}번</span><b>{label}</b></button>)}
    </div>
  </LabDialog>;
}

export function SettingsBody({state}) {
  const room = getRoomSession();
  const solo = room.mode==='guest';
  return <div className="settings-content">
    <dl className="settings-profile" aria-label="플레이 정보">
      <div><dt>게스트 이름</dt><dd>{room.nickname}</dd></div>
      <div>{solo?<><dt>플레이 방식</dt><dd>게스트 모드</dd></>:<><dt>방 코드</dt><dd>{room.code}</dd></>}</div>
    </dl>
    <section className="settings-group" aria-label="게임 옵션">
      <button type="button" className="settings-command ui-control" data-act="sound" aria-label="효과음" aria-pressed={Boolean(state.sound)}>
        <Icon name={state.sound?'speaker':'mute'}/>효과음
        <span className="settings-audio-value">{state.sound?'켜짐':'꺼짐'}<i aria-hidden="true"/></span>
      </button>
      <details className="settings-help">
        <summary className="settings-command ui-disclosure"><Icon name="info"/>플레이 방법</summary>
        <ol>
          <li>오늘 운세를 뽑고 새 기사를 읽어.</li><li>장이 열리면 주문의 체결가를 확인할 수 있어.</li>
          <li>게임 시계는 {gameClockRate}배속이야. 게임 시각 자정에 하루 정산과 손익 순위 갱신이 진행돼.</li>
        </ol>
      </details>
      <button type="button" className="settings-command ui-control" data-act="tutorial-replay">
        <Icon name="bookmark"/>튜토리얼 다시 보기<i className="settings-forward" aria-hidden="true"/>
      </button>
    </section>
    <section className="settings-group" aria-label="방과 기록">
      {!solo && <button type="button" className="settings-command ui-control" data-act="chat-invite">
        <Icon name="users"/>친구 초대<i className="settings-forward" aria-hidden="true"/>
      </button>}
      <button type="button" className="settings-command ui-control" data-act="change-room">
        <Icon name="home"/>시작 화면으로<i className="settings-forward" aria-hidden="true"/>
      </button>
      <button type="button" className="settings-command settings-reset ui-control" data-act="reset-save" aria-haspopup="dialog">
        <Icon name="reload"/>게임 기록 초기화<i className="settings-forward" aria-hidden="true"/>
      </button>
    </section>
    <p className="settings-storage">내 플레이 기록은 따로 저장돼.</p>
  </div>;
}

export function ResetBody({modal}) {
  return <>
    <p className="sheet-intro">이 방의 내 자산, 거래 내역, 대출을 지우고 시작화면으로 돌아가. 다른 방의 기록과 설정은 유지돼.</p>
    <div className="reset-actions"><button className="btn light full" data-act="reset-cancel">취소</button>
      <button className="btn primary full" data-act="reset-confirm" disabled={modal.pending}>초기화하기</button></div>
  </>;
}
