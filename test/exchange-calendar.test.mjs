import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarDay,calendarEvents} from '../src/game/exchange-calendar.mjs';
import {civilDate} from '../src/game/clock-calendar.mjs';
import {filingOnDay,publicCompanyHistory} from '../src/game/company-filings.mjs';
import {initial} from '../src/game/market.mjs';
import {stocks,symbolIndex} from '../src/game/world.mjs';
import {loadJsx,renderView} from '../test-support/render-jsx.mjs';

test('exchange dates use listing records and the same releases as public filings',()=>{
  const state=initial();
  assert.equal(calendarDay('2026-11-31'),null);
  assert.deepEqual(calendarEvents(state,'invalid'),[]);
  const asset=stocks[symbolIndex.BMEM];
  assert.ok(calendarEvents(state,asset.listed).some(event=>event.kind==='listing'&&event.title===asset.name+' 상장'));

  const day=Array.from({length:4},(_,i)=>state.day+i).find(day=>filingOnDay(day));
  const filing=filingOnDay(day),date=civilDate(day);
  const result=calendarEvents(state,date).find(event=>event.kind==='earnings');
  assert.equal(result.time,filing.time);
  assert.ok(result.companies.includes(asset.name));
  const released=publicCompanyHistory(symbolIndex.BMEM,filing.tick).current;
  assert.equal(released.publishedTick,filing.tick);
  assert.equal(released.publishedLabel,date+' '+result.time);
  assert.ok(publicCompanyHistory(symbolIndex.BMEM,filing.tick-1).current.publishedTick<filing.tick);
});

test('a calendar day sheet shows disclosure details or a message for an empty date',async()=>{
  const {CalendarDaySheet}=await loadJsx(new URL('../src/ui/exchange-calendar.jsx',import.meta.url));
  const state={...initial(),day:calendarDay('2026-11-25')};
  const listing=renderView(CalendarDaySheet,{state,date:'2026-11-27'});
  assert.match(listing,/상장공시.*10:00 · 예정.*한강 중소형주 ETF 상장 예비공시/);
  const merger=renderView(CalendarDaySheet,{state,date:'2026-11-29'});
  assert.match(merger,/2026년 11월 29일/);
  assert.match(merger,/합병공시.*11:00 · 예정.*이음철도 물류 자회사 흡수합병 추진/);
  const day=Array.from({length:7},(_,i)=>state.day+i).find(day=>!calendarEvents(state,civilDate(day)).length);
  assert.match(renderView(CalendarDaySheet,{state,date:civilDate(day)}),/이날 등록된 일정은 없어/);
});
