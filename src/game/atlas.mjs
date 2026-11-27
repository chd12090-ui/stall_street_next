import {tapeEpochDay,marketClock,marketElapsed} from './clock-calendar.mjs';
import {continents,countries,canonicalCountry,relations,relationKinds,relationStances} from './atlas-data.mjs';
import './atlas-dialog.mjs';
import {countryPins,regionBoxes,mapBounds,northCoast} from './atlas-map.mjs';
import {incidentStance} from './press-wire.mjs';
import {diplomaticAgenda,electedAt} from './election-policy.mjs';
import {stocks} from './world.mjs';

const allCountries=Object.values(countries);
const searchAliases={mora:['한국'],chai:['동아시아연합','East Asian Union']};
const view={country:'mora',region:'world',kind:'all',stance:'all',partner:null,zoom:1,center:null,more:false,panel:null,section:'profile',viaCountry:false};
const mapSize={width:380,height:560};
const labelInset=4,labelTextX=22;
let measuredLabelFont='',labelTextWidths;
export function atlasRouteSuffix(){
  if(view.panel==='country')return '/'+view.country;
  if(view.panel==='pair')return '/'+view.country+'~'+view.partner;
  return '';
}
export function openAtlasRoute(item){
  if(!item){view.panel=null;view.partner=null;return;}
  const [from,to]=String(item).split('~').map(canonicalCountry);
  if(!from){view.panel=null;view.partner=null;return;}
  const same=view.country===from;
  if(!same){view.region='world';view.center=null;view.zoom=1;view.section='profile';}
  const [lon,lat]=point(countries[from]),[x,y,w,h]=mapBox();
  const nearest=lon+360*Math.round((x+w/2-lon)/360);
  if(nearest<x||nearest>x+w||lat<y||lat>y+h)view.center=[lon,lat];
  view.country=from;view.partner=null;view.panel='country';
  if(to&&byCountry(from).some(r=>other(r,from).id===to)){view.partner=to;view.panel='pair';view.viaCountry=false;}
}
const byCountry=id=>relations.filter(r=>r.a===id||r.b===id);
const other=(r,id)=>countries[r.a===id?r.b:r.a];
const xy=(x,y)=>[x.toFixed(2),y.toFixed(2)].join(' ');
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const [mapNorth,mapSouth]=mapBounds;
const mapControlSpace=62;
const wrap=x=>((x%360)+360)%360;
const clampCenterY=(y,h)=>clamp(y,mapNorth+h/2,mapSouth-h/2);
const point=c=>countryPins[c.id];
const nearestPin=Object.fromEntries(allCountries.map(({id})=>{
  const [x,y]=countryPins[id];
  const distances=allCountries.filter(p=>p.id!==id).map(p=>{
    const [px,py]=point(p),dx=Math.abs(px-x);
    return Math.hypot(Math.min(dx,360-dx),py-y);
  });
  return [id,Math.min(...distances)];
}));
const stance=(r,tick)=>incidentStance(r.a,r.b,tick)||(r.kind==='alliance'?'allied':r.kind==='tension'?'hostile':'neutral');
const dialogue=(r,tick)=>stance(r,tick)==='hostile'?null:diplomaticAgenda(r.a,r.b,tick);
const politicalTick=s=>{const {day,cursor}=marketClock(s);return day*288+cursor+(marketElapsed(s)??0)/300;};

const eventDay=date=>Date.parse(date+'T00:00:00Z')/86400000-tapeEpochDay;
function dayBadge(d){
  return d===0?'오늘':d<0?'일정 경과':d<=90?'D−'+d:'예정';
}
const statusUpdates={
  'mora/haeon':{'m1-strait':'야간 항행 제한','w1-convoy':'주간 통항 명단 공개','f2-strait-renewal':'야간 항행 재개 시각 발표'},
  'mora/lumen':{'t2-lumen-settlement':'가스대금 결제 시범','w2-gas-storage':'공동 저장고 인출 시작'},
  'haeon/arden':{'f1-yard-contract':'선박 정비계약 체결'},
  'chai/arden':{'h3-chip-export':'저전력 제품 수출허가'},
  'mora/chai':{'wire-asia':'원산지 전자서류 시범'},
  'arden/kanora':{'wire-north':'냉장 운송 보험 갱신'},
};
function latestUpdate(r,news){
  const incident=news.find(story=>story.event.diplomacy&&story.countries?.slice(0,2).includes(r.a)&&story.countries?.slice(0,2).includes(r.b));
  if(incident)return {story:incident,text:incident.title};
  const updates=statusUpdates[r.a+'/'+r.b]||statusUpdates[r.b+'/'+r.a];
  if(!updates)return null;
  const story=news.find(n=>updates[n.event.id]);
  return story?{story,text:updates[story.event.id]}:null;
}
function baseBox(){
  const ratio=mapSize.width/mapSize.height;
  if(view.region==='world'){
    // The land begins behind the floating controls. Labels keep their own clearance.
    const headroom=Math.min(12/mapSize.height,.04);
    const height=Math.min(179/ratio,(mapSouth-northCoast)/(1-headroom));
    return [282,northCoast+height*(.5-headroom),height*ratio];
  }
  const [x,y,w,h]=regionBoxes[view.region];
  // Leave room for floating touch controls without distorting the geography.
  const fitHeight=Math.max(110,mapSize.height-mapControlSpace*2);
  return [x+w/2,y+h/2,Math.max(w+10,h*mapSize.width/fitHeight,ratio*20)];
}
function mapBox(){
  const [bx,by,bw]=baseBox(),ratio=mapSize.width/mapSize.height;
  const w=Math.min(bw/view.zoom,(mapSouth-mapNorth)*ratio),h=w/ratio;
  const [cx,cy]=view.center||[bx,by];
  return [cx-w/2,clampCenterY(cy,h)-h/2,w,h];
}
function routeCurve(c,p){
  const [x,y]=point(c),[raw,ey]=point(p);
  const ex=raw-x>180?raw-360:raw-x< -180?raw+360:raw;
  const mx=(x+ex)/2,my=(y+ey)/2-Math.min(23,Math.max(2,Math.abs(ex-x)*.13));
  return 'M'+xy(x,y)+'Q'+xy(mx,my)+' '+xy(ex,ey);
}
function overlaps([x,y,w,h],placed){
  return placed.some(([ax,ay,aw,ah])=>x<ax+aw+2&&x+w+2>ax&&y<ay+ah+2&&y+h+2>ay);
}
function screenPoint(lon,lat,vx,vy,w,ux,uy){
  const wrapped=lon+Math.round((vx+w/2-lon)/360)*360;
  return [(wrapped-vx)/ux,(lat-vy)/uy];
}
function measureLabels(svg){
  if(!svg)return;
  const {fontWeight,fontSize,fontFamily}=getComputedStyle(svg);
  const font=fontWeight+' '+fontSize+' '+fontFamily;
  if(font===measuredLabelFont)return;
  const context=document.createElement('canvas').getContext('2d');
  if(!context)return;
  context.font=font;
  labelTextWidths=new Map(allCountries.map(({id,name})=>{
    const metrics=context.measureText(name);
    return [id,Math.ceil(metrics.actualBoundingBoxRight||metrics.width)];
  }));
  measuredLabelFont=font;
}
function labelPositions(c,box,screenWidth,screenHeight){
  const [vx,vy,w,h]=box,ux=w/screenWidth,uy=h/screenHeight;
  const local=view.region==='world'?allCountries:allCountries.filter(p=>p.continent===view.region);
  const candidates=[c,...(view.partner?[countries[view.partner]]:[]),...local];
  const seen=new Set(),placed=[];
  return candidates.map(p=>{
    if(seen.has(p.id))return null;seen.add(p.id);
    const [px,py]=screenPoint(...point(p),vx,vy,w,ux,uy);
    if(px<0||px>screenWidth||py<0||py>screenHeight)return null;
    const textWidth=labelTextWidths?.get(p.id)??p.name.length*13;
    const width=labelTextX+textWidth+labelInset,height=22,gap=4,margin=2;
    const spots=[[px+gap,py-height-gap],[px-width-gap,py-height-gap],[px+gap,py+gap],[px-width-gap,py+gap],[px-width/2,py-height-gap],[px-width/2,py+gap]];
    const clamped=spots.map(([x,y])=>[clamp(x,margin,screenWidth-width-margin),clamp(y,margin,screenHeight-height-margin)]);
    const chosen=clamped.find(([x,y])=>y>=mapControlSpace&&y+height<=screenHeight-mapControlSpace&&!overlaps([x,y,width,height],placed));
    if(!chosen)return null;
    const [x,y]=chosen;placed.push([x,y,width,height]);
    return {country:p,x:vx+x*ux,y:vy+y*uy,width,height,scaleX:ux,scaleY:uy};
  }).filter(Boolean);
}
const electedPresident=(c,tick)=>c.id==='mora'?electedAt(tick):null;
function relatedSecurities(country,peer=null){
  return stocks.flatMap((stock,i)=>{
    if(stock.archiveOnly||stock.bond||stock.option)return [];
    const issuer=canonicalCountry(stock.country||stock.market);
    const linked=id=>issuer===id||stock.exposure?.some(member=>canonicalCountry(member)===id);
    const a=linked(country.id),b=peer&&linked(peer.id);
    if(!a&&!b)return [];
    const domestic=issuer===country.id||issuer===peer?.id;
    const tag=peer?(a&&b?'양국 연관':a?country.name:peer.name):domestic?'발행국':'사업 연관';
    return [{stock,i,tag,score:Number(!!(a&&b))*4+Number(domestic)*2+Number(!stock.reference)}];
  }).sort((a,b)=>b.score-a.score);
}
const sections=[['profile','개요'],['relations','관계'],['stocks','종목'],['news','보도']];
const regionEntries=[['world','전 세계'],...Object.entries(continents).map(([k,v])=>[k,v.name])];
function zoomAround(delta){
  const [x,y,w,h]=mapBox();
  view.center=[x+w/2,y+h/2];
  view.zoom=clamp(view.zoom+(delta>0?1:-1),1,6);
}
export function handleAtlas(name,el,state){
  if(!name.startsWith('atlas-'))return false;
  const value=el.dataset.value??el.value;
  if(name==='atlas-country'&&Object.hasOwn(countries,value)){
    const previous=view.country,fromSearch=view.panel==='search';
    view.country=value;view.partner=null;view.more=false;view.section='profile';view.panel='country';view.kind='all';view.stance='all';
    if(view.region!=='world'&&countries[value].continent!==view.region){view.region=countries[value].continent;view.zoom=1;view.center=null;}
    if((fromSearch||previous!==value&&view.zoom>1)&&!el.closest?.('.atlas-map-svg'))view.center=point(countries[value]);
  }else if(name==='atlas-region'&&(value==='world'||Object.hasOwn(continents,value))){
    view.region=value;view.partner=null;view.panel=null;view.zoom=1;view.center=null;view.more=false;
    if(value!=='world'&&countries[view.country].continent!==value)view.country=allCountries.find(c=>c.continent===value).id;
  }else if(name==='atlas-layer'&&(value==='all'||Object.hasOwn(relationStances,value))){
    view.stance=value;view.partner=null;view.panel=null;
  }else if(name==='atlas-kind'&&(value==='all'||Object.hasOwn(relationKinds,value))){
    view.kind=value;view.partner=null;
  }else if(name==='atlas-search'||name==='atlas-legend'){view.panel=name==='atlas-search'?'search':'legend';view.partner=null;}
  else if(name==='atlas-section'&&sections.some(([k])=>k===value)){view.section=value;view.panel='country';view.more=false;}
  else if(name==='atlas-close'){view.panel=null;view.partner=null;}
  else if(name==='atlas-back'){view.panel='country';view.section='relations';view.partner=null;}
  else if(name==='atlas-edge'){
    const [a,b]=String(value).split('~');
    if(!relations.some(r=>r.a===a&&r.b===b))return false;
    if(view.country===b){view.country=b;view.partner=a;}else{view.country=a;view.partner=b;}
    view.viaCountry=false;view.panel='pair';
  }else if(name==='atlas-relation'&&byCountry(view.country).some(r=>other(r,view.country).id===value)){
    view.partner=value;view.viaCountry=true;view.panel='pair';
  }else if(name==='atlas-more')view.more=!view.more;
  else if(name==='atlas-zoom')zoomAround(Number(value));
  else if(name==='atlas-reset'){view.zoom=1;view.region='world';view.partner=null;view.panel=null;view.center=null;}
  else return false;
  return true;
}

if(typeof customElements!=='undefined'&&!customElements.get('atlas-map-canvas')){
  class AtlasMapCanvas extends HTMLElement{
    connectedCallback(){
      measureLabels(this.firstElementChild);
      this.queuePaint=()=>{
        if(this.frame)return;
        this.frame=requestAnimationFrame(()=>{this.frame=0;this.paint();});
      };
      this.addEventListener('wheel',this.onWheel,{passive:false});
      this.observer=new ResizeObserver(this.queuePaint);this.observer.observe(this);this.queuePaint();
    }
    disconnectedCallback(){
      this.removeEventListener('wheel',this.onWheel);
      this.observer?.disconnect();cancelAnimationFrame(this.frame);this.frame=0;
    }
    onWheel(e){
      if(e.ctrlKey||(!e.deltaX&&!e.deltaY))return;
      e.preventDefault();
      const [x,y,w,h]=mapBox();
      const unit=e.deltaMode===1?16:e.deltaMode===2?mapSize.height:1;
      const sideways=e.shiftKey&&!e.deltaX;
      const dx=(sideways?e.deltaY:e.deltaX)*unit*w/mapSize.width;
      const dy=(sideways?0:e.deltaY)*unit*h/mapSize.height;
      view.center=[wrap(x+w/2+dx),clampCenterY(y+h/2+dy,h)];
      this.queuePaint();
    }
    paint(){
      const rect=this.getBoundingClientRect();if(!rect.width||!rect.height)return;
      mapSize.width=rect.width;mapSize.height=rect.height;
      measureLabels(this.firstElementChild);
      this.dispatchEvent(new Event('atlas-paint'));
    }
  }
  customElements.define('atlas-map-canvas',AtlasMapCanvas);
}

// Keep the same geographic location under the pointer throughout a drag, including seam crossings.
if(typeof document!=='undefined'){
  let drag=null,blockClickUntil=0;
  document.addEventListener('pointerdown',e=>{
    const host=e.target.closest?.('.atlas-map-canvas');if(!host||e.button!==0||drag)return;
    const rect=host.getBoundingClientRect();if(!rect.width||!rect.height)return;
    drag={id:e.pointerId,host,rect,box:mapBox(),x:e.clientX,y:e.clientY,moved:false};
  });
  document.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const d=drag,dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(!d.moved&&Math.abs(dx)+Math.abs(dy)<6)return;
    if(!d.moved){d.moved=true;d.host.setPointerCapture?.(e.pointerId);}
    const [x,y,w,h]=d.box;
    view.center=[wrap(x+w/2-dx*w/d.rect.width),clampCenterY(y+h/2-dy*h/d.rect.height,h)];
    d.host.queuePaint?.();
  });
  const stop=e=>{
    if(!drag||drag.id!==e.pointerId)return;
    if(drag.moved){blockClickUntil=performance.now()+220;if(drag.host.hasPointerCapture?.(e.pointerId))drag.host.releasePointerCapture(e.pointerId);}
    drag=null;
  };
  document.addEventListener('pointerup',stop);document.addEventListener('pointercancel',stop);
  document.addEventListener('click',e=>{if(performance.now()<blockClickUntil&&e.target.closest?.('.atlas-map-canvas')){e.preventDefault();e.stopImmediatePropagation();}},true);
  document.addEventListener('keydown',e=>{
    if(e.target.classList?.contains('atlas-map-svg')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      e.preventDefault();const [x,y,w,h]=mapBox();
      const dx=e.key==='ArrowRight'?.15:e.key==='ArrowLeft'?-.15:0,dy=e.key==='ArrowDown'?.15:e.key==='ArrowUp'?-.15:0;
      view.center=[wrap(x+w/2+w*dx),clampCenterY(y+h/2+h*dy,h)];e.target.closest('atlas-map-canvas')?.queuePaint();
    }
  });
}


export {view as atlasView,allCountries,regionEntries,searchAliases,sections as atlasSections,eventDay,dayBadge,latestUpdate,electedPresident,relatedSecurities,mapBox,mapSize,mapNorth,mapSouth,politicalTick,
  labelPositions,point,routeCurve,stance,dialogue,other,byCountry,nearestPin};
