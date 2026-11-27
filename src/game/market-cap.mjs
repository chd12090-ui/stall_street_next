import {publicCompanyHistory} from './company-filings.mjs';
import {isSpot} from './securities-data.mjs';

// Use the last public share count, ETF units, or circulating coins, in listing currency.
export function instrumentMarketCap(asset,state,price){
  if(!Number.isFinite(price)||price<=0)return null;
  const units=asset.kind==='주식'?publicCompanyHistory(asset,state,1).current?.shares.end??asset.shares:
    asset.reference?asset.units:isSpot(asset)?asset.circulating:null;
  return Number.isFinite(units)&&units>0?price*units:null;
}
