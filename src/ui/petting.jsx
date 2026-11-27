import React,{useRef} from 'react';

export function PetHand({className}){
  const hand='/art/player/petting-hand.svg';
  return <svg className={className} viewBox="0 0 78 51" aria-hidden="true" shapeRendering="crispEdges">
    <g className="pov-pet-hand"><use className="pet-open" href={hand+'#open'} width="78" height="51"/>
      <use className="pet-contact" href={hand+'#contact'} width="78" height="51"/></g>
  </svg>;
}

export function PetTarget({className,label,onPet}){
  const stroke=useRef(null),stroked=useRef(false);
  function begin(event){
    if(!event.isPrimary||event.button!==0)return;
    stroked.current=false;
    stroke.current={id:event.pointerId,x:event.clientX,y:event.clientY};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event){
    const start=stroke.current;
    if(start?.id!==event.pointerId)return;
    const dx=Math.abs(event.clientX-start.x),dy=Math.abs(event.clientY-start.y);
    if(dx>=10&&dx>=dy){
      start.x=event.clientX;
      start.y=event.clientY;
      stroked.current=true;
      onPet(event.currentTarget);
    }
  }
  return <button type="button" className={className} aria-label={label} data-pet-target=""
    onPointerDown={begin} onPointerMove={move} onLostPointerCapture={()=>{stroke.current=null;}}
    onClick={event=>{
      if(!stroked.current||event.detail===0)onPet(event.currentTarget);
      stroked.current=false;
    }}/>;
}
