import {canonicalCountry} from './atlas-data.mjs';
import {continuousTradingDay} from './clock-calendar.mjs';
import {industryIdsForSector} from './industries.mjs';

// These five-minute ranges preserve candles from before continuous trading.
function venue(name,country,engName,currency,zone,sessions,exchange){
  return {name,country,engName,currency,zone,sessions,venue:exchange||name+' 증권거래소'};
}
export const markets={
  mora:{...venue('한국','대한민국','Korea','KRW','국내',[[0,78]]),board:'HANX'},
  arden:{...venue('미국','미국','US','USD','북아메리카',[[174,252]]),board:'AMRX'},
  lumen:venue('영국','영국','UK','GBP','유럽',[[96,198]]),
  haeon:{...venue('일본','일본','Japan','JPY','아시아',[[0,30],[42,78]]),board:'NHX'},
  coin:{...venue('한국 코인','대한민국','Korea Digital Assets','KRW','국내',[[0,288]],'한국 디지털자산시장'),continuous:true},
  ardenCoin:{...venue('미국 코인','미국','US Digital Assets','USD','북아메리카',[[0,288]],'미국 디지털자산거래소'),continuous:true,countryId:'arden',board:'AMDX'},
  chai:{...venue('중국','중국','China','CNY','아시아',[[18,42],[60,84]]),board:'CLX'},
  indara:venue('인도','인도','India','INR','아시아',[[45,120]]),
  vietlan:venue('베트남','베트남','Vietnam','VND','아시아',[[24,54],[72,93]]),
  francen:venue('프랑스','프랑스','France','EUR','유럽',[[96,198]]),
  germar:venue('독일','독일','Germany','EUR','유럽',[[96,198]]),
  espara:venue('스페인','스페인','Spain','EUR','유럽',[[96,198]]),
  kanora:venue('캐나다','캐나다','Canada','CAD','북아메리카',[[174,252]]),
  brazin:venue('브라질','브라질','Brazil','BRL','남아메리카',[[156,251]]),
  azania:venue('남아프리카공화국','남아프리카공화국','South Africa','ZAR','아프리카',[[84,180]]),
  austran:venue('호주','호주','Australia','AUD','오세아니아',[[0,72]],'호주 브리즈 증권시장')
};
function currency(code,name,symbol,base,market,digits=2){return {code,name,symbol,base,market,digits};}
export const currencies={
  KRW:currency('KRW','원','₩',1,'mora',0),USD:currency('USD','달러','$',1380,'arden'),
  GBP:currency('GBP','파운드','£',1640,'lumen'),JPY:currency('JPY','엔','¥',9.5,'haeon',0),
  CNY:currency('CNY','위안','CN¥',194,'chai'),EUR:currency('EUR','유로','€',1510,'francen'),
  INR:currency('INR','루피','₹',16.2,'indara'),VND:currency('VND','동','₫',.055,'vietlan',0),
  CAD:currency('CAD','캐나다달러','C$',990,'kanora'),BRL:currency('BRL','헤알','R$',242,'brazin'),
  ZAR:currency('ZAR','랜드','R',77,'azania'),AUD:currency('AUD','호주달러','A$',915,'austran')
};
export const fmtMoney=(amount,code='KRW')=>{
  const c=currencies[code];
  if(!c||!Number.isFinite(amount))return '—';
  const n=Math.abs(amount).toLocaleString('ko-KR',{minimumFractionDigits:c.digits,maximumFractionDigits:c.digits});
  const sign=amount<0?'−':'';
  return code==='KRW'?sign+n+'원':code==='VND'?sign+n+'₫':sign+c.symbol+n;
};
const share=(code,ticker,name,enName,market,sector,listed,base,shares,annualDividend,eps,bookPerShare,extra={})=>({
 id:code.toLowerCase(),code,ticker,name,enName,market,sector,listed,base,shares,annualDividend,eps,bookPerShare,
 country:market,currency:markets[market].currency,kind:'주식',lot:1,exposure:[],...extra,
 industryIds:Object.freeze(extra.industryIds??industryIdsForSector(sector))
});
function etf(code,ticker,name,enName,market,listed,base,reference,factor,underlying,units,fee,annualDividend,navOffset){
  return {id:code.toLowerCase(),code,ticker,name,enName,market,country:market,sector:'ETF',listed,base,reference,factor,underlying,
    units,fee,annualDividend,navOffset,issuer:market==='mora'?'한강자산운용':'Meridian Asset Management',
    currency:markets[market].currency,kind:'추종상품',lot:1,exposure:[]};
}
function spot(code,ticker,name,enName,sector,listed,base,lot,circulating,maxSupply,market='coin'){
  return {id:code.toLowerCase(),code,ticker,name,enName,sector,listed,base,lot,circulating,maxSupply,country:markets[market].countryId||market,market,
    currency:markets[market].currency,kind:'현물 코인',exposure:[],industryIds:Object.freeze(['digital-assets'])};
}
// Retain the raw scenario tape and archived ETF inputs. Only the traded unit is redenominated.
export const nyangUnitsPerLegacyCoin=400;
const coinTape={base:122813000,market:'coin',currency:'KRW'};
// Outstanding shares, distributions, per-share earnings and book are fictional scenario disclosures, in listing currency.
// Append new listings so existing holdings and order indices stay stable.
const previousListings=[
  share('MOON','003840','한결로지스','Hangyeol Logistics','mora','종합물류','1968-05-20',22000,68400000,600,1920,28400,{exposure:['chai','haeon']}),
  share('MART','029160','대한리테일','Daehan Retail','mora','식품·유통','1971-09-13',20000,48000000,520,1470,23800,{exposure:['vietlan','brazin']}),
  share('RAIL','014760','한국철도','Korea Rail','mora','철도운송','1957-06-24',28000,92000000,720,2100,35100),
  share('VOLT','018530','한성전력','Hanseong Electric Power','mora','전력·공공시설','1962-04-02',24000,415000000,450,1800,38400,{exposure:['lumen','austran']}),
  share('ARC','NSSC','노스스타 세미컨덕터','Northstar Semiconductor','arden','반도체','1983-05-16',171,784000000,.84,6.18,31.8,{exposure:['haeon','mora','chai']}),
  share('NOVA','STRS','스트라투스 클라우드','Stratus Cloud','arden','클라우드 인프라','2004-06-07',124,392000000,0,2.27,17.1,{exposure:['indara','lumen']}),
  share('HARB','WHVN','웨스트헤이븐 시핑','Westhaven Shipping','arden','컨테이너 해운','1974-08-26',77,64800000,2.4,7.62,89.5,{exposure:['panaro','haeon','brazin']}),
  share('CROWN','KGB','킹스브리지 은행','Kingsbridge Bank','lumen','상업은행','1952-10-27',19.5,1450000000,.89,1.76,21.4,{exposure:['arden','indara','azania']}),
  share('NORD','NME','노스미어 에너지','Northmere Energy','lumen','천연가스','1978-11-06',16.75,563000000,.66,1.21,13.9,{exposure:['mora','ruska','misran']}),
  share('TIDE','7046','미나토중공업','Minato Heavy Industries','haeon','조선·해양설비','1956-09-03',3260,196000000,72,188,2430,{exposure:['mora','austran']}),
  share('CORL','4183','세이와소재','Seiwa Materials','haeon','배터리 소재','1982-11-15',2140,84700000,58,121,1830,{exposure:['chai','chilena','anderu']}),
  {...spot('BIT','NYAN','냥이코인','Nyangcoin','디지털 자산','2010-07-19',coinTape.base/nyangUnitsPerLegacyCoin/currencies.USD.base,.0001,19980000*nyangUnitsPerLegacyCoin,21000000*nyangUnitsPerLegacyCoin,'ardenCoin'),id:'nyan',tape:coinTape},
  spot('ETH','ETH','이더리움','Ethereum','스마트계약 플랫폼','2015-08-10',4562000,.0001,120600000,null),
  etf('MOR4','342100','한강 한국대표주','Hangang Korea Leaders ETF','mora','1999-03-15',25000,['MOON','MART','RAIL','VOLT'],1,'한국 대표 4종 동일가중지수',74000000,.15,430,.00065),
  etf('MOR2','375260','한강 대표주 레버리지','Hangang Leaders Daily 2X','mora','2005-06-13',18000,['MOON','MART','RAIL','VOLT'],2,'한국 대표 4종 동일가중지수',24000000,.58,0,-.0008),
  etf('MORI','375270','한강 대표주 인버스','Hangang Leaders Daily Inverse','mora','2005-06-13',21000,['MOON','MART','RAIL','VOLT'],-1,'한국 대표 4종 동일가중지수',17000000,.49,0,.0009),
  etf('BITF','498210','한강 냥이코인 현물','Hangang Nyangcoin Spot ETF','mora','2015-03-16',17000,['BIT'],1,'냥이코인 현물',46000000,.28,0,-.0012),
  etf('BIT2','499820','한강 냥이코인 2X','Hangang Nyangcoin Daily 2X','mora','2017-04-10',12000,['BIT'],2,'냥이코인 현물',9100000,.88,0,.0018),
  etf('BITI','499830','한강 냥이코인 인버스','Hangang Nyangcoin Daily Inverse','mora','2017-04-10',14000,['BIT'],-1,'냥이코인 현물',7100000,.79,0,-.0016),
  etf('ETHF','498610','한강 이더리움 현물','Hangang Ether Spot ETF','mora','2017-10-09',12000,['ETH'],1,'이더리움 현물',12800000,.35,0,-.0005),
  etf('ATE2','MATX','메리디언 테크 2X','Meridian Tech Daily 2X','arden','2008-02-04',90,['ARC','NOVA'],2,'미국 기술주 동일가중지수',24900000,.87,0,.0005),
  etf('ATEI','MATI','메리디언 테크 인버스','Meridian Tech Daily Inverse','arden','2008-02-04',100,['ARC','NOVA'],-1,'미국 기술주 동일가중지수',6800000,.78,0,-.0006),
  share('JHMI','603729','징하이신소재','Jinghai Advanced Materials','chai','첨단소재','1994-06-20',42.6,576000000,.55,2.26,16.4,{exposure:['haeon','mora']}),
  share('SVHT','SVHT','사비타 헬스케어','Savita Healthcare','indara','제네릭 의약품','1985-02-11',1378.25,319000000,16,48,251,{exposure:['arden','kenara']}),
  share('LMX','LUMO','루미에르 모빌리테','Lumière Mobilité','francen','철도 장비','1969-06-06',71.46,162000000,1.9,4.31,35.2,{exposure:['germar','maghren']}),
  share('RTKW','RTW','라인탈 베르케','Rheintal Werke AG','germar','산업용 기계','1963-11-04',129.5,83200000,3.15,7.66,62.7,{exposure:['chai','espara']}),
  share('MNRD','MNR','메이플 노던 레일','Maple Northern Rail','kanora','화물 철도','1965-04-12',112.8,287000000,2.4,5.21,39.5,{exposure:['arden','mexara']}),
  share('VRS','VZMA3','바르제아 미네라상','Várzea Mineração S.A.','brazin','철광석·광물','1978-08-14',56.8,493000000,3.14,6.12,38.8,{exposure:['chai','chilena']}),
  share('KRV','KRU','카루 리소시스','Karoo Resources Ltd.','azania','광물 채굴','1972-10-02',168.4,226000000,6.25,14.3,89.5,{exposure:['naijar','germar']}),
  share('SCMT','SCM','서던크로스 메탈스','Southern Cross Metals','austran','철광석·구리','1964-07-06',31.42,674000000,1.11,2.24,15.7,{exposure:['chai','papura','saloma']}),
  share('NETP','492370','넥스트포토닉스','Next Photonics','mora','광통신 부품','2006-11-06',35250,16000000,0,640,6850,{exposure:['arden']}),
  share('FVT','VHT','비엣하이 터미널','Viet Hai Terminals JSC','vietlan','항만 물류','2003-10-20',34700,158000000,1350,2610,18200,{exposure:['chai','mora']}),
  share('IBPT','IAP','이베라 푸에르토스','Íbera Puertos','espara','항만·여객터미널','1983-02-14',16.42,194000000,.52,1.16,8.6,{exposure:['cubara','maghren','panaro']}),
  share('MEXL','NOCM','노르테 카블레스 ADR','Norte Cables ADR','arden','전선·자동차 부품','1998-07-13',29.45,84000000,.42,1.84,13.2,{country:'mexara',instrument:'ADR',exposure:['arden'],
    industryIds:['auto-parts','electrical-equipment']}),
  share('ANDB','ANCO','안데스 코브레 ADR','Andes Cobre ADR','arden','구리 광산','1992-03-23',44.83,192000000,1.16,3.81,26.4,{country:'chilena',instrument:'ADR',exposure:['anderu','chai']}),
  share('PAMP','PLAT','라플라타 세미야스 ADR','La Plata Semillas ADR','arden','곡물 종자','1999-11-08',18.25,97200000,.31,1.52,12.2,{country:'argentel',instrument:'ADR',exposure:['brazin','colmera']}),
  share('NILD','NLD','나일 델타 로지스틱스 GDR','Nile Delta Logistics GDR','lumen','운하·항만 물류','1996-09-16',9.64,108000000,.24,.71,6.38,{country:'misran',instrument:'GDR',exposure:['kenara','maghren']}),
  share('ORK','ORC','오리노코 카페 ADR','Orinoco Café ADR','arden','커피 가공·수출','1998-04-06',22.8,41600000,.72,1.47,10.38,{country:'colmera',instrument:'ADR',exposure:['brazin','arden']}),
  share('ORUR','OUR','오우라 데어리','Oura Dairy Group','austran','유가공','1984-02-13',8.92,178000000,.32,.65,4.16,{country:'zelanda',instrument:'교차상장',exposure:['austran','fijara']}),
  share('PACI','PTR','퍼시픽 트레이드라인스','Pacific Tradelines','austran','도서 간 화물운송','1994-05-09',4.35,189000000,.10,.28,2.22,{exposure:['fijara','saloma','papura','zelanda']}),
  share('NGNT','NDN','나이저 델타 네트웍스 GDR','Niger Delta Networks GDR','lumen','통신망','2004-05-10',4.85,389000000,.12,.29,2.31,{country:'naijar',instrument:'GDR',exposure:['kenara']}),
  share('ATLS','ATM','아틀라스 포스파츠 GDR','Atlas Phosphates GDR','lumen','인광석·비료','1993-09-06',11.24,139000000,.45,1.16,6.8,{country:'maghren',instrument:'GDR',exposure:['brazin','indara']}),
  share('KGEO','KGR','케냐 지오서멀 GDR','Kenya Geothermal GDR','lumen','지열 발전','2005-03-07',3.16,249000000,.06,.23,1.95,{country:'kenara',instrument:'GDR',exposure:['francen']}),
  share('PACP','ISPL','이스모 파시피코 ADR','Istmo Pacífico Logistics ADR','arden','운하 물류','1991-08-19',33.9,43100000,.84,2.34,16.4,{country:'panaro',instrument:'ADR',exposure:['arden','colmera']}),
  share('URUQ','ACQ','안데스 퀴노아 GDR','Andes Quinua Foods GDR','lumen','식품 원료','2004-04-19',7.25,67400000,.16,.53,4.29,{country:'anderu',instrument:'GDR',exposure:['chilena','espara']})
];
const listings=[
  ...previousListings,
  share('BMEM','011840','백산메모리','Baeksan Memory','mora','메모리 반도체','1987-05-11',138400,510000000,1200,11650,71300,{exposure:['arden','chai','haeon']}),
  share('SGMO','010630','세광모터스','Segwang Motors','mora','완성차','1976-06-21',212000,325000000,6800,22100,195400,{exposure:['arden','haeon']}),
  share('WJBT','373680','원진배터리','Wonjin Battery','mora','이차전지','2014-02-17',148700,193000000,450,5370,81200,{exposure:['chai','brazin']}),
  share('YJRX','018650','유정제약','Yujeong Pharma','mora','의약품','1981-03-09',47800,75400000,550,2850,22800,{exposure:['arden','indara']}),
  share('ONTL','033250','온누리텔레콤','Onnuri Telecom','mora','통신·데이터센터','1998-06-15',39600,131000000,2250,3890,46800,
    {industryIds:['telecommunications','data-centers']}),
  share('GGPM','089070','금강정밀','Geumgang Precision','mora','반도체 장비','2001-10-22',32500,49800000,410,2470,18400,{exposure:['haeon','chai']}),
  share('SLYD','098450','세림조선','Serim Shipyards','mora','조선','1978-04-10',63200,116000000,820,5190,36300,{exposure:['haeon','arden']}),
  share('DHCP','029310','동해캐피탈','Donghae Capital','mora','금융·캐피탈','1991-08-19',12580,148000000,780,1780,18180),
  share('MRGM','173280','모래내게임즈','Moraenae Games','mora','게임','2011-05-16',25600,51600000,0,1370,11600,{exposure:['haeon']}),
  share('SBEN','285640','솔빛에너지','Solbit Energy','mora','태양광·전력망','2010-11-22',78400,83200000,1300,4640,48100,{exposure:['germar','arden']}),
  share('KAON','439150','카온시스템즈','Kaon Systems','mora','방산 전자·통신','2008-11-17',50900,61000000,510,3200,27200,{exposure:['arden','germar']}),
  share('DYFD','023410','대영식품','Daeyoung Foods','mora','가공식품','1984-07-09',18240,61100000,750,910,22400,{exposure:['vietlan','argentel']}),
  share('RWDV','RWDV','레드우드 디바이스','Redwood Devices','arden','스마트기기','1980-11-24',192.87,3800000000,1.1,9.23,51.2,{exposure:['mora','haeon','chai']}),
  share('HZMA','HZMA','호라이즌 모빌리티','Horizon Mobility','arden','전기차','2011-07-11',164.11,708000000,0,3.12,31.47,
    {exposure:['mora','chai'],industryIds:['automotive','electrical-equipment']}),
  share('ALTQ','ALTQ','알토서치','Alto Search','arden','검색·광고','2005-09-12',148.6,940000000,0,7.18,29.7,{exposure:['lumen','germar']}),
  share('QRGR','QRGR','쿼리 그리드','Quarry Grid','arden','전력·설비','1986-08-04',51.25,265000000,1.55,4.19,28.37),
  share('BWTX','BWTX','브라이어우드 테라퓨틱스','Briarwood Therapeutics','arden','바이오·의약','1999-04-05',86.32,171000000,.46,3.66,26.72,{exposure:['indara','mora']}),
  share('JNFD','JNFD','주니퍼 푸즈','Juniper Foods','arden','식품·소비재','1977-02-14',94.32,529000000,2.15,5.04,34.1,{exposure:['brazin','kanora']}),
  share('MDRA','MDRA','메리디언 에어로','Meridian Aero','arden','항공·방산','1960-06-20',139.84,447000000,2.36,7.49,40.4,{exposure:['germar','mora']}),
  share('VXPM','VXPM','버텍스 페이먼츠','Vertex Payments','arden','결제망','2001-03-19',112.19,289000000,1.21,6.02,20.8),
  share('BWSC','BWSC','브레이크워터 시큐리티','Breakwater Security','arden','보안 소프트웨어','2014-09-22',67.28,161000000,0,2.15,14.32),
  share('WFBK','WFBK','웨스트필드 은행','Westfield Bancorp','arden','은행','1974-02-11',63.49,842000000,2.54,5.12,54.8,{exposure:['lumen','kanora']}),
  share('IRPK','IRPK','아이언피크 로보틱스','Ironpeak Robotics','arden','산업용 로봇','2005-08-15',76.7,177000000,.36,3.58,23.5,{exposure:['mora','haeon']}),
  share('SBCG','SBCG','스톤브리지 컨슈머','Stonebridge Consumer','arden','생활용품','1973-01-08',118.62,231000000,2.28,5.51,44.2),
  share('KMTD','7268','구모토 자동차','Kumoto Motors','haeon','자동차','1968-11-04',2956,248000000,108,236,2380,{exposure:['chai','arden']}),
  share('ASMZ','6963','아사미즈 전자','Asamizu Electronics','haeon','정밀 전자','1980-07-21',8430,194000000,140,612,4435,{exposure:['chai','mora']}),
  share('DHDG','688572','둥후디지털','Donghu Digital','chai','산업 자동화','2008-06-23',58.36,251000000,.38,2.92,23.16,{exposure:['haeon','mora']}),
  {...etf('SAMX','MSAX','메리디언 남미시장 ETF','Meridian South America Index ETF','arden','2011-05-16',38.4,
    ['ANDB','PAMP','ORK'],1,'남미 대표 예탁증서 동일가중지수',18500000,.64,.48,.00065),exposure:['brazin','chilena','argentel','anderu','colmera']},
  {...etf('AFRX','BAFX','영국 아프리카시장 ETF','UK Africa Index ETF','lumen','2012-09-17',23.75,
    ['NILD','NGNT','ATLS','KGEO'],1,'아프리카 대표 예탁증서 동일가중지수',12400000,.71,.52,.0007),exposure:['misran','naijar','azania','kenara','maghren']},
];
export const tradingCountries=['mora','arden'];
export const tradingVenues=[...tradingCountries,'ardenCoin'];
export const marketGroup=market=>markets[market].countryId||market;
export const isSpot=asset=>asset.kind==='현물 코인';
export const marketProduct=asset=>asset.bond?'bonds':asset.option?'options':'stocks';
export function listingDescription(asset){
  const venue=markets[asset.market],board=venue.board??venue.name;
  if(asset.bond||asset.option)return board+' · '+asset.kind;
  if(asset.reference)return board+' · ETF';
  if(isSpot(asset))return board+' · '+asset.currency+' 현물';
  return board;
}
function indexTracker(code,ticker,name,enName,market,issuer,base,units,fee,annualDividend){
  const members=listings.filter(asset=>asset.market===market&&asset.country===market&&asset.kind==='주식').map(asset=>asset.code);
  const underlying=markets[market].name+' 종합지수 · '+members.length+'종 동일가중';
  return {...etf(code,ticker,name,enName,market,'2026-10-05',base,members,1,underlying,units,fee,annualDividend,0),
    issuer,indexTracker:true};
}
const indexListings=[...listings,
  indexTracker('HRIDX','482260','한강 한국 종합 ETF','Hangang Korea Broad Market ETF','mora','한강자산운용',15000,38000000,.15,0),
  indexTracker('CLIDX','588260','룽허 중국 종합 ETF','Longhe China Broad Market ETF','chai','룽허자산운용',12.5,56000000,.23,0),
  indexTracker('NHIDX','2638','호시노 일본 종합 ETF','Hoshino Japan Broad Market ETF','haeon','호시노자산운용',1950,42000000,.17,0),
  indexTracker('AMIDX','MAMX','메리디언 미국 종합 ETF','Meridian US Broad Market ETF','arden','Meridian Asset Management',48,54000000,.12,0),
];
// Keep the existing index baskets and all saved instrument positions fixed.
const earlierCatalog=[...indexListings,
  share('FLFX','FLFX','플레어폭스 게임즈','Flarefox Games','arden','게임','2026-09-14',
    6.25,9800000,0,-.31,1.54,{floatShares:2400000}),
];
function marketListing(code,name,enName,market,base,terms){
  return {id:code.toLowerCase(),code,ticker:code,name,enName,market,base,listed:'2026-10-05',
    country:market,currency:markets[market].currency,lot:1,exposure:[],...terms};
}
const catalog=[...earlierCatalog,
  marketListing('KTB3Y','국고채 3년','Korea Treasury 3Y','mora',99_700,{
    kind:'채권',sector:'국채',units:1_350_000,annualDividend:3_100,
    bond:{type:'government',issuer:'대한민국',face:100_000,term:3}
  }),
  marketListing('ONB5Y','온빛전력채 5년','Onbit Power Bond 5Y','mora',98_600,{
    kind:'채권',sector:'회사채',units:480_000,annualDividend:4_400,
    bond:{type:'corporate',issuer:'온빛전력',issuerCode:'VOLT',face:100_000,term:5}
  }),
  marketListing('UST10Y','미국 국채 10년','US Treasury 10Y','arden',98.65,{
    kind:'채권',sector:'국채',units:2_100_000,annualDividend:4.2,
    bond:{type:'government',issuer:'미국',face:100,term:10}
  }),
  marketListing('MOONC','달밤물류 콜','Moonline Call','mora',1_350,{
    kind:'옵션',sector:'콜 옵션',
    option:{side:'call',underlying:'MOON',strike:22_000,premium:1_350}
  }),
  marketListing('MOONP','달밤물류 풋','Moonline Put','mora',1_350,{
    kind:'옵션',sector:'풋 옵션',
    option:{side:'put',underlying:'MOON',strike:22_000,premium:1_350}
  }),
  marketListing('NSCC','노스스타 콜','Northstar Call','arden',9.5,{
    kind:'옵션',sector:'콜 옵션',
    option:{side:'call',underlying:'ARC',strike:171,premium:9.5}
  }),
  marketListing('NSCP','노스스타 풋','Northstar Put','arden',9.5,{
    kind:'옵션',sector:'풋 옵션',
    option:{side:'put',underlying:'ARC',strike:171,premium:9.5}
  }),
];
// Older version 3 saves store arrays aligned to these exact earlier catalog sizes.
export const previousListingCounts=[previousListings.length,listings.length,indexListings.length,earlierCatalog.length,catalog.length];
const dailyFunds=[
  ['USL2','미국지수 레버리지 2X','US Index Daily 2X','arden',40,'AMIDX',2,'미국지수'],
  ['USI2','미국지수 인버스 2X','US Index Daily Inverse 2X','arden',40,'AMIDX',-2,'미국지수'],
  ['BMEML2','백산칩 레버리지 2X','Baeksan Chips Daily 2X','mora',12000,'BMEM',2,'백산칩'],
  ['BMEMI2','백산칩 인버스 2X','Baeksan Chips Daily Inverse 2X','mora',12000,'BMEM',-2,'백산칩'],
  ['ARCL3','노스스타 칩스 레버리지 3X','Northstar Chips Daily 3X','arden',24,'ARC',3,'노스스타'],
  ['ARCI2','노스스타 칩스 인버스 2X','Northstar Chips Daily Inverse 2X','arden',24,'ARC',-2,'노스스타'],
  ['HZMAL2','대시 EV 레버리지 2X','Dash EV Daily 2X','arden',24,'HZMA',2,'대시 EV'],
  ['HZMAI3','대시 EV 인버스 3X','Dash EV Daily Inverse 3X','arden',24,'HZMA',-3,'대시 EV'],
].map(([code,name,enName,market,base,member,factor,underlying])=>({
  ...etf(code,code,name,enName,market,'2026-11-16',base,[member],factor,underlying,5_000_000,.85,0,0),
  dailyFund:true,
}));
// Switch the existing Korea funds at the continuous-market boundary without repricing earlier candles.
const indexTracking={
  MOR2:{reference:['HRIDX'],factor:2,underlying:'한국지수'},
  MORI:{reference:['HRIDX'],factor:-2,underlying:'한국지수'},
};
export const fundTracking=(asset,day)=>day>=continuousTradingDay?indexTracking[asset.code]??asset:asset;
export const trackedFundMember=asset=>asset.dailyFund?asset.reference[0]:indexTracking[asset.code]?.reference[0];
// The exchange names its current listings here. The ordered catalog also backs earlier accounts and charts.
const listedCompanyNames={
  MOON:['달밤물류','Moonline Logistics'],
  MART:['장터마트','Jangteo Mart'],
  RAIL:['이음철도','Ieum Rail'],
  VOLT:['온빛전력','Onbit Power'],
  BMEM:['백산칩','Baeksan Chips'],
  WJBT:['한칸전지','OneCell Battery'],
  YJRX:['맑음제약','Clearday Pharma'],
  DHCP:['물결금융','Tideway Finance'],
  MOR2:['한국지수 2X','Korea Index Daily 2X','한국지수 레버리지 2X','한강 대표주 2X'],
  MORI:['한국지수 인버스 2X','Korea Index Daily Inverse 2X'],
  HRIDX:['한국지수','Korea Index','한강 코리아 ETF','Hangang Korea ETF'],
  ARC:['노스스타','Northstar Chips','노스스타 칩스','북극성칩'],
  NOVA:['클라우드리프트','Cloudlift Servers','구름서버'],
  HARB:['웨일라인','Whale Line','고래해운'],
  HZMA:['대시 EV','Dash EV','질주EV'],
  ALTQ:['클릭파인드','Clickfind','딱찾기'],
  QRGR:['쿼리 파워','Quarry Power','돌담전력'],
  WFBK:['필드라인','Fieldline Bank','필드라인 뱅크','들판은행'],
  FLFX:['플레어폭스','Flarefox Games','불여우게임'],
  AMIDX:['미국지수','US Index','메리디언 미국 ETF','Meridian US ETF'],
  USL2:['미국지수 2X','US Index Daily 2X'],
  BMEML2:['백산칩 2X','Baeksan Chips Daily 2X'],
  ARCL3:['노스스타 3X','Northstar Chips Daily 3X','노스스타 레버리지 3X'],
  ARCI2:['노스스타 인버스 2X','Northstar Chips Daily Inverse 2X'],
  HZMAL2:['대시 EV 2X','Dash EV Daily 2X'],
};
export const stocks=[...catalog,...dailyFunds].map(stock=>{
  const names=listedCompanyNames[stock.code];
  const country=canonicalCountry(stock.country==='coin'?'mora':stock.country);
  const exposure=[...new Set(stock.exposure.map(canonicalCountry))].filter(id=>id&&id!==country);
  const asset={...stock,country,exposure};
  if(names){
    const [name,enName,...aliases]=names;
    const formerNames=[...new Set([stock.name,stock.enName,...aliases])].filter(alias=>alias&&alias!==name&&alias!==enName);
    return {...asset,name,enName,formerNames};
  }
  return stock.code==='BIT'||stock.dailyFund?asset:{...asset,archiveOnly:true};
});
export const symbolIndex=Object.fromEntries(stocks.map((s,i)=>[s.code,i]));
export function instrumentIndustryIds(asset,day){
  if(!asset||asset.indexTracker)return [];
  if(asset.industryIds)return asset.industryIds;
  const {reference}=fundTracking(asset,day);
  const source=asset.option?.underlying??asset.bond?.issuerCode??(reference?.length===1?reference[0]:null);
  return stocks[symbolIndex[source]]?.industryIds??[];
}
export const quantityRound=q=>Number(q.toFixed(8));
const wonCoinTick=p=>p>=2000000?1000:p>=1000000?500:p>=500000?100:p>=100000?50:p>=10000?10:p>=1000?1:p>=100?.1:.01;
export const priceTick=(i,p)=>{
  const s=stocks[i];
  if(isSpot(s)&&s.currency==='KRW')return wonCoinTick(p);
  if(s.bond&&s.currency==='KRW')return 10;
  if(s.currency==='KRW')return s.reference?(p<2000?1:5):p<2000?1:p<5000?5:p<20000?10:p<50000?50:p<200000?100:p<500000?500:1000;
  if(s.currency==='JPY')return p<3000?1:p<5000?5:p<30000?10:p<50000?50:100;
  if(s.currency==='VND')return p<10000?10:p<50000?50:100;
  if(s.currency==='INR')return .05;
  return .01;
};
const snapTick=(value,tick)=>Math.max(tick,Math.round(Math.round(value/tick)*tick*10000)/10000);
export const snapPrice=(i,value)=>snapTick(value,priceTick(i,value));
// The raw tape stays in its original KRW units for archived fund references.
export const tapePrice=(i,value)=>stocks[i].tape?snapTick(value,wonCoinTick(value)):snapPrice(i,value);
