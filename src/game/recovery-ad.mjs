export const recoveryLimit=5,recoveryPoints=6;
export const recoveryDuration=24;

export function recoveryStatus(state){
  const used=state.adRecovery?.day===state.day?state.adRecovery.count:0;
  return {remaining:Math.max(0,recoveryLimit-used),gain:Math.min(recoveryPoints,100-state.mental)};
}
export function grantRecovery(state){
  const {remaining,gain}=recoveryStatus(state);
  if(state.phase!=='open'||!remaining||!gain)return 0;
  state.mental+=gain;
  state.adRecovery={day:state.day,count:recoveryLimit-remaining+1};
  return gain;
}
const adArt={tissue:'ad-tissue',coffee:'ad-tea',laundry:'ad-wash'};
const spots=[
  ['tissue','폭신한 3겹','급락장에도 찢어지지 않는 3겹.'],
  ['coffee','물타기 커피','커피의 물 비율만큼은 우리가 맞춥니다.'],
  ['laundry','보송세탁','빨간 옷과 파란 옷은 꼭 따로 넣으세요.'],
];
export function recoverySpot(state){
  const used=recoveryLimit-recoveryStatus(state).remaining;
  const index=((state.day+used)%spots.length+spots.length)%spots.length;
  const [theme,brand,copy]=spots[index];
  return {theme,brand,copy,art:adArt[theme]};
}
export function watchGameAd(root,onComplete,duration=recoveryDuration){
  const bar=root.querySelector('progress'),label=root.querySelector('[data-ad-remaining]');
  let elapsed=0,last=performance.now(),visible=!document.hidden,active=true;
  const stop=()=>{active=false;clearInterval(timer);document.removeEventListener('visibilitychange',update);};
  function update(){
    if(!active)return;
    const time=performance.now();
    if(visible)elapsed=Math.min(duration,elapsed+(time-last)/1000);
    last=time;visible=!document.hidden;
    bar.value=elapsed;label.textContent=Math.ceil(duration-elapsed)+'초';
    if(elapsed===duration){stop();onComplete();}
  }
  const timer=setInterval(update,120);
  document.addEventListener('visibilitychange',update);
  return stop;
}
