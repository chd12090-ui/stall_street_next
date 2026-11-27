import {balance} from '../game/market.mjs';
import {stocks,currencies,fmtMoney,unit,quantityUnit} from '../game/world.mjs';
import {quoteInfo} from '../game/tape.mjs';
import {number,percent,shareCount} from '../game/broker-data.mjs';
import {groupAmount} from '../game/number-entry.mjs';
import {AmountField,Icon} from './controls.jsx';
import {CompanyMark} from './exchange-controls.jsx';

function QuantityKeys({fractional,max}){
  const keys=['1','2','3','4','5','6','7','8','9',fractional?'.':'00','0','backspace'];
  return <div className="trade-entry">
    <div className="trade-shortcuts" role="group" aria-label="최대 수량 기준 빠른 입력">
      {[10,25,50,100].map(value=><button key={value} type="button" className="ui-control ui-compact"
        data-act="qty-proportion" data-value={value} disabled={!max}>{value===100?'최대':value+'%'}</button>)}
    </div>
    <div className="trade-keypad" role="group" aria-label="수량 숫자 키패드">
      {keys.map(key=><button key={key} type="button" data-act="qty-key" data-value={key}
        aria-label={key==='backspace'?'한 자리 지우기':key==='.'?'소수점':undefined}>
        {key==='backspace'?<Icon name="down"/>:key}</button>)}
    </div>
  </div>;
}

export function OrderScreen({state,modal,math}){
  const {i,qty,side,kind}=modal,asset=stocks[i],currency=asset.currency,q=quoteInfo(state,i);
  const format=value=>fmtMoney(value,currency),sell=side==='sell',market=kind==='market';
  const {valid,max,available,feeRate,fee,total,fitsLot,funding}=math;
  const pending=state.orders[i],limit=state.orderPrices[i],digits=currencies[currency].digits;
  const changed=q.pct>0?'rise':q.pct<0?'fall':'even';
  const over=sell?qty>max:available<0;
  const message=!valid?'주문 가격을 확인해 줘.':qty>0&&!fitsLot?'수량 단위를 확인해 줘.':
    over&&!funding?sell?'보유 수량을 초과했어.':'주문 가능 현금이 부족해.':'';
  const submit=funding?'달러 환전 후 계속':sell?'매도 주문':'매수 주문';
  const amount=Number.isFinite(qty)?number(qty,8):'';

  return <section className="sheet trade-screen" role="dialog" aria-modal="true" aria-labelledby="dialog-title" data-side={side}>
    <header className="trade-heading">
      <button type="button" className="trade-back" data-act="dismiss" aria-label="뒤로가기"><Icon name="down"/></button>
      <div className="trade-security">
        <h2 id="dialog-title" title={asset.name}>{asset.name}</h2>
        <span><b>{format(q.price)}</b><small className={'trade-'+changed}>{percent(q.pct,true)}</small></span>
      </div>
      <span className="trade-logo" aria-hidden="true"><CompanyMark asset={asset}/></span>
    </header>
    <div className="trade-body">
      <div className="trade-account">
        <div className="trade-account-name">
          <Icon name="coin"/><span>{currency==='KRW'?'원화':currencies[currency].name} 계좌</span>
          {!sell&&currency==='USD'&&<button type="button" className="trade-fx" data-act="order-fx" data-value="USD">환전</button>}
        </div>
        <div className="trade-switch" role="group" aria-label="주문 방향">
          {[['buy','매수'],['sell','매도']].map(([id,label])=><button key={id} type="button" data-act="side"
            data-value={id} disabled={id==='buy'&&asset.archiveOnly} aria-pressed={side===id}>{label}</button>)}
        </div>
      </div>
      <section className="trade-card" aria-labelledby="order-price-heading">
        <div className="trade-card-heading">
          <h3 id="order-price-heading">주문 가격</h3>
          <div className="trade-modes" role="group" aria-label="가격 입력 방식">
            <button type="button" data-act="order-kind" data-value="limit" aria-pressed={!market}>지정가</button>
            <button type="button" data-act="order-current">현재가 입력</button>
            <button type="button" data-act="order-kind" data-value="market" aria-pressed={market}>시장가</button>
          </div>
        </div>
        {market?<div className="trade-number trade-market-price">{format(q.price)} <small>예상가</small></div>:
          <label className="trade-number">
            <AmountField id="limit-price" aria-label="지정가" inputMode={digits?'decimal':'numeric'}
              placeholder="0" text={groupAmount(modal.price,digits)}/><span>{unit(i)}</span>
          </label>}
      </section>
      <section className="trade-card" aria-labelledby="order-quantity-heading">
        <div className="trade-card-heading"><h3 id="order-quantity-heading">수량</h3></div>
        <label className="trade-number">
          <AmountField id="order-qty" aria-label="주문 수량" aria-describedby="order-max" inputMode="none"
            placeholder="0" text={modal.qtyText??amount}/><span>{quantityUnit(i)}</span>
        </label>
        <p className="trade-capacity" id="order-max">
          {sell?'보유 '+shareCount(state.holdings[i],i):'계좌 잔액 '+format(balance(state,currency))}
          <span>최대 <b>{shareCount(max,i)}</b></span>
        </p>
      </section>
      <QuantityKeys fractional={asset.lot<1} max={max}/>
      {Boolean(pending)&&<div className="trade-pending">
        <span>{pending>0?'매수':'매도'} 대기 {shareCount(Math.abs(pending),i)} · {limit===null?'시장가':format(limit)}</span>
        <button type="button" className="trade-fx" data-act="cancel-order">주문 취소</button>
      </div>}
    </div>
    <footer className="trade-footer">
      {message&&<p className="trade-message" role="status">{message}</p>}
      <dl className="trade-estimate">
        {!sell&&<div><dt>수수료{feeRate>0?' '+percent(feeRate*100):''}</dt><dd>{valid?format(fee):'—'}</dd></div>}
        <div><dt>{sell?'예상 수령액':'예상 결제액'}</dt><dd id="order-total">{format(total)}</dd></div>
      </dl>
      <button type="button" className="trade-submit ui-control" data-act="submit-order"
        disabled={!valid||!fitsLot||over&&!funding}>{submit}</button>
    </footer>
  </section>;
}
