import {useLayoutEffect,useRef} from 'react';
import {rehabilitationAtlas,rehabilitationPaperMotions,rehabilitationScene} from '../game/rehabilitation-motion.mjs';

const scenes = {
  idle: '은행 후문에 서 있는 인절미 고양이와 은행원 고양이. 인절미가 빨간 딱지를 쥐고 있고 바닥에는 파란 딱지가 놓여 있다.',
  win: '인절미가 빨간 딱지를 내려쳐 파란 딱지를 뒤집었다.',
  slap: '은행원이 인절미의 볼을 한 번 치고, 인절미는 볼을 감싸며 눈물을 흘린다.',
};
const {width,height}=rehabilitationScene;
const atlas=rehabilitationAtlas;
const spritePosition=pose=>100*pose/(atlas.frames-1)+'% 0';
const atlasStyle={
  left:atlas.left/width*100+'%',top:atlas.top/height*100+'%',
  width:atlas.width/width*100+'%',height:atlas.height/height*100+'%',
  backgroundSize:atlas.frames*100+'% 100%',
};

export function RehabilitationArt({motion='idle',animationKey,onFinish}){
  const actors=useRef(null);
  const sequence=rehabilitationPaperMotions[motion];
  useLayoutEffect(()=>{
    if(!animationKey||!sequence)return;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches||!actors.current.animate){
      onFinish(animationKey);
      return;
    }
    const {duration,frames}=sequence;
    const keyframes=frames.map(([at,pose])=>({offset:at/duration,backgroundPosition:spritePosition(pose),easing:'steps(1, end)'}));
    keyframes.push({offset:1,backgroundPosition:spritePosition(frames.at(-1)[1])});
    const animation=actors.current.animate(keyframes,{duration,fill:'both'});
    animation.onfinish=()=>onFinish(animationKey);
    return ()=>{
      animation.onfinish=null;
      animation.cancel();
    };
  },[animationKey,sequence,onFinish]);

  const pose=sequence?.frames.at(-1)[1]??0;
  return <div className="rehab-alley-art" role="img" aria-label={scenes[motion]}>
    <img className="rehab-alley-wall" src="/art/pixel/rehab-alley.webp" width={width} height={height}
      alt="" draggable={false}/>
    <div ref={actors} data-motion={motion} className="rehab-paper-actors rehab-paper-poses" aria-hidden="true"
      style={{...atlasStyle,backgroundPosition:spritePosition(pose)}}/>
  </div>;
}
