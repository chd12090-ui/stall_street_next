import React, {memo,useEffect,useRef,useState} from 'react';
import {characterPose} from '../game/player-character.mjs';

export const PixelArt=memo(function PixelArt({id,className='',alt='',width,height,eager=false,animated=true}) {
  const path='/art/pixel/'+id;
  const image=<img className={className} src={path+'.webp'} width={width} height={height} alt={alt}
    decoding="async" draggable={false} fetchPriority={eager?'high':undefined} loading={eager?undefined:'lazy'}/>;
  return animated?<picture className="pixel-art">
    <source media="(prefers-reduced-motion: reduce)" srcSet={path+'-still.webp'}/>
    {image}
  </picture>:image;
});

export function MentalBrain({value}) {
  const pose=characterPose(value);
  return <i className="mental-brain" data-brain-stage={pose.brainStage??pose.id} aria-hidden="true"/>;
}

export function MentalGauge({value,className='pov-mental-gauge'}) {
  const segments=15,width=segments*4-2,filledSegments=Math.round(value*segments/100);
  return <svg className={className} width={width} height="18" viewBox={`0 0 ${width} 18`} shapeRendering="crispEdges" aria-hidden="true">
    {Array.from({length:segments},(_,index)=><rect key={index} x={index*4} width="2" height="18" fill={index<filledSegments?'currentColor':'#3f513f'}/>)}
  </svg>;
}

export function StallIllustration({interactive=false}) {
  const [checking, setChecking] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  function checkPrice() {
    clearTimeout(timer.current);
    setChecking(true);
    timer.current = setTimeout(() => setChecking(false), 1100);
  }
  return <div className="room-illustration" data-checking={interactive && checking ? '' : undefined}>
    <div className="room-scene">
      <img className="room-set" src="/art/player/landing-stall.webp" width="1728" height="1098"
        alt="반쯤 닫힌 화장실 칸의 문틈으로 휴지를 들고 우는 고양이가 보인다. 옆 칸 문에는 ‘근무시간 중 주식 금지’ 공고가 붙어 있다." />
      <div className="room-seat">
        <svg className="room-cat-shadow" viewBox="0 0 220 172" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
          <path fill="#40584b" opacity=".30" d="M5 145H15V142H77V145H96V148H106V153H94V157H19V154H6V151H1V148H5Z"/>
        </svg>
        <svg className="room-mascot" viewBox="0 0 220 172" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
          <use href="/art/player/pose-4.svg#cat"/><use href="/art/player/pose-4.svg#wipe"/>
        </svg>
        {interactive && <>
          <svg className="room-mascot room-smug" viewBox="0 0 140 172" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
            <use href="/art/player/pose-1.svg#cat"/><use href="/art/player/pose-1.svg#phone"/>
          </svg>
          <button type="button" className="room-check-price" aria-label="고양이와 몰래 시세 확인하기" onClick={checkPrice}/>
          <span className="sr-only" role="status">{checking ? '고양이가 몰래 시세를 확인하고 선글라스를 썼어.' : ''}</span>
        </>}
      </div>
      <img className="room-door" src="/art/player/landing-stall-door.webp" width="162" height="324" alt="" />
    </div>
  </div>;
}

