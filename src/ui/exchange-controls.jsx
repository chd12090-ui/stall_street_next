import React,{useEffect,useLayoutEffect,useRef,useReducer} from 'react';
import {isSpot} from '../game/securities-data.mjs';
import {fundHistoryReady,loadFundHistory} from '../game/tape.mjs';
import {Icon} from './controls.jsx';

export function Select({value,children,className,...props}){
  const ref=useRef(null);
  useLayoutEffect(()=>{
    if(ref.current.value!==String(value))ref.current.value=value;
  });
  return <select {...props} className={['ui-control','ui-select',className].filter(Boolean).join(' ')} ref={ref} defaultValue={value}>{children}</select>;
}

// A game tick may replace the saved game object while the player is typing or reading.
export function useViewUpdate(initial,stream){
  const lastProp=useRef(initial),current=useRef(initial);
  const [,redraw]=useReducer(n=>n+1,0);
  if(lastProp.current!==initial){current.current=initial;lastProp.current=initial;}
  useLayoutEffect(()=>stream.subscribe(next=>{current.current=next;redraw();}),[stream]);
  return current.current;
}

export function useFundHistory(index){
  const [,redraw]=useReducer(n=>n+1,0),ready=fundHistoryReady(index);
  useEffect(()=>{
    if(ready)return;
    let mounted=true;
    void loadFundHistory(index).then(()=>{if(mounted)redraw();});
    return ()=>{mounted=false;};
  },[index,ready]);
  return ready;
}

export function ShareButton({kind,content=''}){
  return <button type="button" className="friend-chat-icon-button friend-chat-share" data-act="chat-share" data-kind={kind} data-value={content} aria-label="친구 채팅에 공유" aria-haspopup="dialog"><i className="ico i-share" aria-hidden="true"/></button>;
}
export function CompanyMark({asset,size=32}){
  if(asset.bond||asset.option)return <Icon name={asset.bond?'news':'spark'}/>;
  return <img className={isSpot(asset)?'bk-badge-art':'bk-badge-art bk-pixel-mark'} src={'/art/companies/'+asset.id+'.webp'} width={size} height={size} alt="" decoding="async" loading="lazy" draggable={false}/>;
}
