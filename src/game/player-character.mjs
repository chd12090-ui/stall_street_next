// Coordinates use the native SVG grid so the hand, tap target and contact point scale together.
// Extra canvas beneath the registered feet lets their shadow extend onto the floor.
export const floorBleed = 12;
export const characterPoses = [
  {id:'1',minMental:80,phoneOnSeat:true,label:'으쓱',width:140,height:200+floorBleed,alt:'선글라스를 쓰고 변기 위에 앉은 고양이',
    crown:[43,36],support:[52,132],petBounds:[2,16,133,119]},
  {id:'2',minMental:60,phoneOnSeat:true,label:'평온',width:140,height:200+floorBleed,alt:'두 눈을 뜨고 변기 위에 앉아 휴대폰을 보는 고양이',
    crown:[42,47],support:[52,132],petBounds:[0,28,123,107]},
  {id:'3',minMental:40,phoneOnSeat:true,label:'덤덤',width:140,height:190+floorBleed,alt:'변기 위에 발을 모으고 반쯤 눈을 뜬 고양이',
    crown:[40,67],support:[55,122],petBounds:[0,51,127,74]},
  {id:'4',minMental:20,label:'울컥',width:220,height:160+floorBleed,alt:'한쪽 앞발로 변기를 붙잡고 두루마리 휴지로 눈물을 닦으며 대성통곡하는 고양이',
    crown:[53,34],support:[50,150],petBounds:[0,18,129,135]},
  {id:'6',minMental:10,brainStage:'5',label:'분노',width:220,height:160+floorBleed,alt:'떨어진 휴대폰을 향해 등을 세우고 털을 곤두세운 고양이',
    crown:[127,67],support:[83,150],petBounds:[1,20,162,132]},
  {id:'5',minMental:0,label:'방전',width:184,height:160+floorBleed,alt:'떨어뜨린 휴대폰 옆 바닥에 몸을 붙이고 누운 고양이',
    crown:[104,96],support:[73,150],petBounds:[0,76,153,77]},
];

export function characterPose(mental, preview){
  return characterPoses.find(({id})=>id===preview)
    ?? characterPoses.find(({minMental})=>mental>=minMental)
    ?? characterPoses.at(-1);
}

// Top left of the 52 × 34 hand when its palm touches the crown.
export const handOrigins=Object.fromEntries(characterPoses.map(({id,crown:[x,y]})=>[id,[x-30,y-23]]));
export const petDuration=240;
const petCooldown=18;
const strokes=new WeakMap();
// A slow connection or a tap in progress must not leave the cat or its hand half-drawn.
export function whenHomePoseReady(pose,isPetting,display){
  const image=new Image(),url='/art/player/pose-'+pose.id+'.svg';
  let timer,active=true;
  const apply=()=>{
    if(!active)return;
    if(isPetting())timer=setTimeout(apply,petDuration);
    else display(pose);
  };
  image.onload=apply;
  image.onerror=()=>{if(active)timer=setTimeout(()=>{image.src=url;},1500);};
  image.src=url;
  return ()=>{
    active=false;
    image.onload=image.onerror=null;
    clearTimeout(timer);
  };
}

export function petCharacter(button,now=performance.now()){
  const sprite=button.closest('[data-pet-stage]');
  if(!sprite)return false;
  const previous=strokes.get(sprite);
  if(previous){
    if(now-previous.at<petCooldown)return false;
    clearTimeout(previous.timer);
    if(!previous.animations?.length||previous.animations.some(animation=>animation.playState==='idle')){
      previous.animations=sprite.getAnimations?.({subtree:true})
        .filter(({animationName})=>animationName?.startsWith('pet-'));
    }
    if(previous.animations?.length){
      // Reuse the running tracks and return straight to the contact pose.
      for(const animation of previous.animations){
        animation.currentTime=petDuration*.29;
        if(animation.playState==='finished')animation.play();
      }
    }else{
      sprite.classList.remove('petting');
      void sprite.offsetWidth;
      sprite.classList.add('petting');
    }
  }else sprite.classList.add('petting');
  const stroke=previous??{};
  stroke.at=now;
  stroke.timer=setTimeout(()=>{
    sprite.classList.remove('petting');
    strokes.delete(sprite);
  },petDuration+16);
  strokes.set(sprite,stroke);
  return true;
}
