import {RITUAL_SPRITE,RITUAL_TIMELINE,ritualFinalHitMs,ritualDanceMs} from './ritual-choreography.mjs';

// Positions are on the same 108-pixel grid as the bank counter and the room artwork.
export const ritualRoom = {width:108, height:86, footX:54, footY:69};
// Both the blade and all character states share this centered, raised room layer.
export const ritualForeground = {scale:7/8, top:3};
const left=(ritualRoom.width-ritualRoom.width*ritualForeground.scale)/2;
const frameEnds = [];
let total = 0;
for (const [,length] of RITUAL_TIMELINE) frameEnds.push(total += length);

export function ritualFrameAt(elapsed) {
  let first=0,last=frameEnds.length-1;
  while(first<last){
    const middle=(first+last)>>>1;
    if(elapsed<frameEnds[middle])last=middle;
    else first=middle+1;
  }
  return {frame:RITUAL_TIMELINE[first][0], until:frameEnds[first]};
}

const landingEdges = [65, 160, 270, 420];
function paintLanding(ctx, elapsed) {
  const step = landingEdges.findIndex(end => elapsed < end);
  if (elapsed < 0 || step < 0) return Infinity;
  // Two ripples travel down the steel and the candle tips lift at the final downbeat.
  const distance = [6,12,19,23][step], width = [8,6,4,2][step];
  ctx.fillStyle = ['#efcf94','#e3bf81','#cbad7b','#b4a285'][step];
  for (const x of [54-distance-width,54+distance]) ctx.fillRect(x,69,width,1);
  for (const side of [-1,1]) {
    ctx.fillRect(54+side*(16+step*3),65-step*2,step<2?2:1,1);
    if (step<3) ctx.fillRect(54+side*(21+step*2),62-step*3,1,2);
  }
  if (step < 2) {
    ctx.fillStyle = step ? '#e1bb87' : '#f3d799';
    // The candles belong to the fixed room. Project their glints into the smaller canvas.
    const {scale,top}=ritualForeground;
    for (const x of [14,95]) ctx.fillRect(Math.round((x-left)/scale),
      Math.round(((step ? 42 : 41)-top)/scale),1,step ? 2 : 3);
  }
  return ritualFinalHitMs + landingEdges[step];
}

// The room stays on its own layer. Only the actor and the small landing accent redraw.
export function paintRitualFrame(ctx, atlas, elapsed) {
  const {frame,until} = ritualFrameAt(elapsed);
  const {width,height,columns,feetX,feetY} = RITUAL_SPRITE;
  ctx.clearRect(0,0,ritualRoom.width,ritualRoom.height);
  const nextAccent = paintLanding(ctx,elapsed-ritualFinalHitMs);
  ctx.drawImage(atlas,frame%columns*width,Math.floor(frame/columns)*height,width,height,
    ritualRoom.footX-feetX,ritualRoom.footY-feetY,width,height);
  return Math.min(until,nextAccent,elapsed<ritualFinalHitMs?ritualFinalHitMs:ritualDanceMs);
}
