import test from 'node:test';
import assert from 'node:assert/strict';
import {actualTimestamp,gameDayStart,gameTimestamp} from '../src/game/clock-calendar.mjs';
import {startLive,syncLiveClock} from '../src/game/live-clock.mjs';
import {loadable,mentalDecayInterval,mentalDecayRate,roll} from '../src/game/market.mjs';

const noon=actualTimestamp(gameDayStart(8)+12*3600_000);
const atNoon=gameTimestamp(noon);
const connectedInterval=4_800_000;

test('an idle game connection subtracts 0.75 points per game hour through the first point',()=>{
  const state=startLive(null,noon,noon);
  assert.equal(state.mentalConnectedAt,atNoon);
  assert.equal(mentalDecayRate(state),.75);
  const deadline=atNoon+connectedInterval;
  assert.equal(state.mentalDecayAt,deadline);
  syncLiveClock(state,actualTimestamp(deadline-2),noon);
  assert.equal(state.mental,75);
  const tick=syncLiveClock(state,actualTimestamp(deadline),noon);
  assert.equal(tick.mentalChanged,true);
  assert.equal(state.mental,74);
  assert.equal(state.mentalDecayAt,deadline+connectedInterval);
  assert(loadable(state));
});

test('a persisted connection applies once across overlapping sessions and excludes offline time',()=>{
  const state=startLive(null,noon,noon);
  const checkpoint=atNoon+800_000;
  syncLiveClock(state,actualTimestamp(checkpoint),noon);
  const snapshot=structuredClone(state);
  const overlap=actualTimestamp(atNoon+400_000);
  const savedAgain=startLive(snapshot,actualTimestamp(checkpoint),overlap);
  assert.equal(savedAgain.mentalDecayAt,atNoon+connectedInterval);

  const offlineDeadline=checkpoint+(connectedInterval-800_000)/2;
  const reopenedAt=actualTimestamp(offlineDeadline);
  const offline=startLive(snapshot,reopenedAt);
  assert.equal(offline.mentalConnectedAt,undefined);
  assert.equal(offline.mental,74);
  assert.equal(mentalDecayRate(offline),1.5);
  assert.equal(offline.mentalDecayAt,offlineDeadline+mentalDecayInterval);

  const reopened=startLive(snapshot,reopenedAt,reopenedAt);
  assert.equal(reopened.mental,74);
  assert.equal(reopened.mentalConnectedAt,offlineDeadline);
  assert.equal(reopened.mentalDecayAt,offlineDeadline+connectedInterval);
  assert.equal(mentalDecayRate(reopened),.75);
  assert(loadable(reopened));
});

test('fortune scales the combined hourly rate after the connection discount',()=>{
  for(const [draw,rate] of [[.1,.75],[.4,.6375],[.8,.5625],[.98,.375]]){
    const state=startLive(null,noon,noon);
    roll(state,draw,atNoon);
    assert.equal(mentalDecayRate(state),rate);
    assert(loadable(state));
  }
});

test('the half-speed clock preserves partial progress across a reload, midnight and an offline period',()=>{
  const midnight=gameDayStart(9),start=midnight-3_600_000,session=actualTimestamp(start);
  const drawAt=start+1_200_000;
  const checkedAt=midnight-2;
  const state=startLive(null,session,session);
  roll(state,.98,drawAt);
  assert.equal(mentalDecayRate(state),.375);
  syncLiveClock(state,actualTimestamp(checkedAt),session);
  assert.equal(state.mental,75);
  assert.equal(state.mentalDecayAt,drawAt+7_200_000);
  assert(loadable(state));

  const resumed=startLive(structuredClone(state),actualTimestamp(midnight),session);
  assert.equal(resumed.mentalDecayAt,midnight+2_400_000);
  assert.equal(resumed.day,9);
  assert.equal(resumed.luck,null);
  assert.equal(resumed.mentalConnectedAt,midnight);
  assert.equal(mentalDecayRate(resumed),.75);
  assert(loadable(resumed));

  const offlineAt=drawAt+400_000;
  const paused=startLive(null,session,session);
  roll(paused,.98,drawAt);
  syncLiveClock(paused,actualTimestamp(offlineAt),session);
  const reopenedAt=offlineAt+600_000;
  const reopened=startLive(structuredClone(paused),actualTimestamp(reopenedAt),actualTimestamp(reopenedAt));
  assert.equal(reopened.mental,75);
  assert.equal(reopened.mentalDecayAt,reopenedAt+5_600_000);
  assert.equal(mentalDecayRate(reopened),.375);
  assert(loadable(reopened));
});

test('a three-line old save resumes its paused fraction at the new half-speed rate once',()=>{
  const old=startLive(null,noon,noon);
  roll(old,.98,atNoon);
  delete old.mentalRates;
  old.mentalFinance={day:old.day,opening:0,dividends:0,debt:{applied:0,target:0},investment:{applied:0,target:0}};
  old.mentalDecayAt=atNoon+mentalDecayInterval/2;
  const resumed=startLive(old,noon,noon);
  assert.equal(mentalDecayRate(resumed),.375);
  assert.equal(resumed.mentalDecayAt,atNoon+4_800_000);
  assert.equal(startLive(structuredClone(resumed),noon,noon).mentalDecayAt,resumed.mentalDecayAt);
});

test('a saved multiplier deadline converts once without losing partial progress',()=>{
  const checkpoint=atNoon+800_000;
  const old=startLive(null,noon);
  old.mentalConnectedAt=checkpoint;
  old.mentalDecayAt=atNoon+3_200_000;
  assert(loadable(old));
  const migrated=startLive(old,actualTimestamp(checkpoint),noon);
  assert.equal(migrated.mentalDecayAt,checkpoint+3_600_000);
  assert.equal(migrated.mental,75);
  assert.equal(mentalDecayRate(migrated),.75);
  const resumed=startLive(migrated,actualTimestamp(checkpoint+200),noon);
  assert.equal(resumed.mentalDecayAt,migrated.mentalDecayAt);
});

test('older activity saves migrate without dropping partial mental progress',()=>{
  const previous=startLive(null,noon);
  previous.mentalDecayAt=atNoon+mentalDecayInterval*2;
  previous.mentalBuffUntil=noon+5000;
  assert(loadable(previous));
  const reopenedAt=noon+4000;
  const migrated=startLive(previous,reopenedAt,reopenedAt);
  assert.equal(migrated.mentalBuffUntil,undefined);
  assert.equal(migrated.mentalConnectedAt,atNoon+8000);
  assert.equal(migrated.mentalDecayAt,atNoon+8000+(mentalDecayInterval-4000)*2);
  assert(loadable(migrated));

  const older={...startLive(null,noon),mentalActivity:{at:noon-30_000,elapsed:60_000}};
  delete older.mentalDecayAt;
  assert(loadable(older));
  const resumed=startLive(older,noon,noon);
  assert.equal(resumed.mentalDecayAt,atNoon+4_680_000);
  assert.equal(resumed.mentalActivity,undefined);
  assert(loadable(resumed));
});

test('a previous-version tab can save during rollout without invalidating the game',()=>{
  const state=startLive(null,noon,noon);
  const money=state.cash;
  state.mentalDecayAt=atNoon+connectedInterval*2;
  state.mentalBuffUntil=noon+5000;
  assert(loadable(state));
  syncLiveClock(state,noon+2000,noon);
  assert.equal(state.mentalBuffUntil,undefined);
  assert.equal(state.mentalConnectedAt,atNoon+4000);
  assert.equal(state.mentalDecayAt,atNoon+connectedInterval);
  assert.equal(state.cash,money);
  assert(loadable(state));
});
