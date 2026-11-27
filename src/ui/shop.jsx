import {useLayoutEffect,useRef,useState} from 'react';
import {fmtMoney,stocks} from '../game/world.mjs';
import {aiGlassesAccuracy,aiGlassesAssetPercent,aiGlassesBasePrice,glassesPrice,hasGlasses} from '../game/ai-glasses.mjs';
import {clockText,dayLabel} from '../game/clock-calendar.mjs';
import {Icon} from './controls.jsx';
import {PixelArt} from './home-art.jsx';
import {PetHand,PetTarget} from './petting.jsx';
import {petCharacter,petDuration} from '../game/player-character.mjs';
import {playGameSound} from '../game/game-audio.mjs';

const products=[
  {id:'ai-glasses',name:'AI 안경',
    description:'거래소 종목 화면에서 현재가 대비 게임 시간 1시간 뒤의 상승·하락 확률을 볼 수 있어.'},
  {id:'tissue',name:'별빛 휴지',price:3500,description:'별 무늬가 박힌 두툼한 휴지. 칸 안에 한 상자 두기 좋아.'},
  {id:'coffee',name:'자정 커피',price:4800,description:'밤샘할 때 마시기 좋은 진한 커피. 고소하고 끝맛이 쌉싸름해.'},
  {id:'lamp',name:'잔불 무드등',price:18500,description:'불씨처럼 옅은 주황빛을 내는 작은 조명이야.'},
  {id:'radio',name:'픽셀 라디오',price:29000,description:'접이식 안테나가 달린 손바닥 크기의 라디오야.'},
  {id:'safe',name:'금고 저금통',price:12000,description:'동전을 넣을 때마다 달그락거리는 소형 금고 모양 저금통이야.'},
  {id:'cushion',name:'고양이 쿠션',price:16800,description:'귀가 뾰족하고 볼이 통통한 고양이 모양 쿠션이야.'},
];

function ProductArt({product}){
  return <span className="shop-product-art"><img className="sprite" src={'/art/shop/'+product.id+'.webp'} width="56" height="56" alt=""/></span>;
}

export function ShopSheet({sound,state,problem}) {
  const [purchases,setPurchases]=useState([]);
  const [notice,setNotice]=useState('');
  const [product,setProduct]=useState(null);
  const opener=useRef(null),detailClose=useRef(null);
  const glasses=state&&hasGlasses(state),special=product?.id==='ai-glasses';
  const price=state?glassesPrice(state):aiGlassesBasePrice;
  useLayoutEffect(()=>{
    if(product)detailClose.current?.focus();
    else opener.current?.focus({preventScroll:true});
  },[product]);
  function petVendor(button){
    if(!petCharacter(button))return;
    if(sound)playGameSound('pet');
    setNotice('마눌고양이가 귀를 눕히고 살짝 눈을 감았어.');
  }
  function priceLabel(item){
    if(item.id==='ai-glasses')return glasses?'1회 사용 가능':fmtMoney(price,'KRW');
    return purchases.includes(item.id)?'구매 완료':fmtMoney(item.price,'KRW');
  }
  return <section className="sheet shop-sheet" role={product?undefined:'dialog'} aria-modal={product?undefined:true}
    aria-labelledby={product?undefined:'shop-title'} onKeyDown={event=>{
      if(product&&event.key==='Escape'){event.preventDefault();event.stopPropagation();setProduct(null);}
    }}>
    <div className="shop-main" inert={product?'':undefined}>
    <button type="button" className="shop-close ui-control ui-icon" data-act="dismiss" aria-label="닫기"><Icon name="close"/></button>
    <div className="shop-scroll">
      <header className="shop-scene">
        <div className="shop-alley" data-pet-stage="" style={{'--pet-duration':petDuration+'ms'}}>
          <PixelArt id="black-market" className="shop-backdrop sprite" width={108} height={126} eager
            alt="깊고 어두운 골목 끝, 문틈에서 새는 누런빛이 마눌고양이의 귀와 앞발 가장자리에 걸린다. 그림자 속에서 검은 봉투가 살짝 흔들린다."/>
          <img className="shop-pet-face sprite" src="/art/pixel/black-market-pet.webp" width="8" height="8" draggable={false} alt=""/>
          <PetHand className="shop-pet-hand"/>
          <PetTarget className="shop-pet-target" label="암시장 마눌고양이 쓰다듬기" onPet={petVendor}/>
        </div>
        <h2 id="shop-title">암시장</h2>
      </header>
      <ul className="shop-products" aria-label="상품 목록">
        {products.map(item=><li key={item.id}><button className="shop-product" type="button" aria-haspopup="dialog"
          onClick={event=>{opener.current=event.currentTarget;setProduct(item);}}>
          <ProductArt product={item}/>
          <span className="shop-product-name">{item.name}</span>
          <span className="shop-product-price">{priceLabel(item)}</span>
        </button></li>)}
      </ul>
    </div>
    <p className="shop-status" role="status">{notice}</p>
    </div>
    {product&&<div className="shop-detail-layer" onClick={event=>{if(event.target===event.currentTarget)setProduct(null);}}>
      <section className="shop-detail" role="dialog" aria-modal="true" aria-labelledby="shop-product-title" aria-describedby="shop-product-about">
        <header className="shop-detail-head"><h3 id="shop-product-title">{product.name}</h3>
          <button ref={detailClose} type="button" className="shop-buy ui-control ui-icon ui-compact"
            aria-label="상품 설명 닫기" onClick={()=>setProduct(null)}><Icon name="close"/></button>
        </header>
        <ProductArt product={product}/>
        <p id="shop-product-about">{product.description}</p>
        {special&&<p className="shop-detail-note">
          가격은 {fmtMoney(aiGlassesBasePrice,'KRW')}에 총자산의 {aiGlassesAssetPercent}%를 더한 금액이야.
          예측 방향의 정답률은 {aiGlassesAccuracy}%이고, 한 번 예측하면 안경은 소모돼.
        </p>}
        {special&&!glasses&&problem&&<p role="alert" className="shop-detail-error">{problem}</p>}
        <div className="shop-detail-actions">
          <b aria-live="polite">{priceLabel(product)}</b>
          {special?(!glasses&&<button type="button" className="shop-buy ui-control" data-act="shop-glasses-buy"
            data-value={price}>구매하기</button>):
          <button type="button" className="shop-buy ui-control" disabled={purchases.includes(product.id)}
            onClick={()=>setPurchases(current=>current.includes(product.id)?current:[...current,product.id])}>구매하기</button>}
        </div>
      </section>
    </div>}
  </section>;
}

function forecastTime(state,stamp){
  const day=Math.floor(stamp/86400),minute=Math.floor(stamp/60)-day*1440;
  return dayLabel(state,day)+' '+clockText(0,true,minute);
}

export function ForecastBody({state,index,prediction}){
  const asset=stocks[index],{from,until,price,up}=prediction;
  const upPercent=up?aiGlassesAccuracy:100-aiGlassesAccuracy;
  return <div className="ai-forecast-body">
    <h3>{asset.name} · 1시간 뒤 가격 방향</h3>
    <dl className="ai-forecast-data">
      <div><dt>기준가</dt><dd>{fmtMoney(price,asset.currency)}</dd></div>
      <div><dt>기준 시각</dt><dd>{forecastTime(state,from)}</dd></div>
      <div><dt>예측 시각</dt><dd>{forecastTime(state,until)}</dd></div>
    </dl>
    {up===null?<p>상승·하락 신호가 뚜렷하지 않아. AI 안경을 다른 종목에 쓸 수 있어.</p>:
      <dl className="ai-forecast-odds">
        <div><dt>상승</dt><dd>{upPercent}%</dd></div>
        <div><dt>하락</dt><dd>{100-upPercent}%</dd></div>
      </dl>}
    {up!==null&&<p className="ai-forecast-note">AI 안경을 사용했어. 예측 방향의 정답률은 {aiGlassesAccuracy}%야.</p>}
  </div>;
}
