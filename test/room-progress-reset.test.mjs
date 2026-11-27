import assert from 'node:assert/strict';
import test from 'node:test';
import {gameTime} from '../src/game/clock-calendar.mjs';
import {DB} from '../test-support/game-db.mjs';
import {serveGameApi} from '../src/server/game-api.mjs';
import {ritualOffer} from '../test-support/ritual-offer.mjs';

const now = Date.UTC(2026, 10, 21, 3);
const progressPath = '/api/progress/reset';
const ritualPath = '/api/rituals';

function request(path, player, body, db = DB) {
  const headers = {'Content-Type':'application/json', 'X-Stall-Guest':player.guest};
  if (player.room) headers['X-Stall-Room'] = player.room;
  if (player.progressId) headers['X-Stall-Progress'] = player.progressId;
  return serveGameApi(new Request('https://game.example'+path, {
    method:body ? 'POST' : 'GET', headers, body:body && JSON.stringify(body),
  }), db, now);
}

async function ok(response) {
  const result = await response;
  const value = await result.json();
  assert.ok(result.ok, JSON.stringify(value));
  return value;
}

async function newRoom(guest = crypto.randomUUID()) {
  const {code} = await ok(request('/api/rooms', {guest}, {action:'create', requestId:crypto.randomUUID()}));
  const owner = {guest, room:code}, peer = {guest:crypto.randomUUID(), room:code};
  await ok(request('/api/rooms', peer, {action:'join', code}));
  await ok(request('/api/rooms', owner, {action:'start'}));
  return {owner, peer};
}

const offer = () => ritualOffer(now);
const reset = (previousId = '') => ({previousId, resetId:crypto.randomUUID(), resetAt:now});

test('restarting one room member reopens their daily ritual while published shocks, peers and a second room remain intact', async t => {
  const {owner, peer} = await newRoom(), elsewhere = (await newRoom(owner.guest)).owner;
  t.mock.method(crypto,'getRandomValues',array => array.fill(0));
  const old = offer(), other = offer(), remote = offer(), today = gameTime(now).day;
  const receipt = (await ok(request(ritualPath,owner,old))).result;
  await ok(request(ritualPath,peer,other));
  await ok(request(ritualPath,elsewhere,remote));
  assert.equal((await ok(request(ritualPath,owner))).usedDay,today);

  const next = reset(), restarted = {...owner, progressId:next.resetId};
  const acknowledgments = await Promise.all([ok(request(progressPath,owner,next)),ok(request(progressPath,owner,next))]);
  assert.equal(acknowledgments[0].progressId,next.resetId);
  assert.deepEqual(acknowledgments[0],acknowledgments[1]);
  assert.equal((await ok(request(progressPath,owner))).progressId,next.resetId);
  assert.equal((await request(progressPath,owner,reset())).status,409);
  assert.equal((await request(ritualPath,owner,offer())).status,409);
  assert.equal((await request(ritualPath,owner)).status,409);
  const fresh = await ok(request(ritualPath,restarted));
  assert.equal(fresh.usedDay,null);
  assert.deepEqual(fresh.events.map(event=>event.id),[old.id,other.id]);
  assert.equal(fresh.events[0].bps,receipt.bps);
  assert.equal(fresh.events[0].tick,receipt.tick);
  assert.equal((await ok(request(ritualPath,peer))).usedDay,today);
  assert.equal((await ok(request(ritualPath,elsewhere))).usedDay,today);
  assert.deepEqual((await ok(request(ritualPath,elsewhere))).events.map(event=>event.id),[remote.id]);
  assert.equal((await request(ritualPath,restarted,old)).status,409);
  assert.equal((await ok(request(ritualPath,restarted))).usedDay,null);

  const pledges = [offer(),offer()];
  const results = await Promise.all(pledges.map(pledge=>request(ritualPath,restarted,pledge)));
  assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
  const paid = pledges[results.findIndex(result=>result.ok)];
  assert.equal((await ok(request(ritualPath,restarted,paid))).result.id,paid.id);
  const news = await ok(request(ritualPath,peer));
  assert.deepEqual(news.events.map(event=>event.id),[old.id,other.id,paid.id]);
  assert.equal((await ok(request(ritualPath,restarted))).usedDay,today);

  const later = reset(next.resetId), latest = {...owner, progressId:later.resetId};
  assert.equal((await ok(request(progressPath,restarted,later))).progressId,later.resetId);
  const staleReset = await request(progressPath,owner,next);
  assert.equal(staleReset.status,409);
  assert.equal((await staleReset.json()).progressId,later.resetId);
  assert.equal((await ok(request(ritualPath,latest))).usedDay,null);
  assert.deepEqual((await ok(request(ritualPath,peer))).events,news.events);
});

test('an offering already in flight when the reset commits cannot publish a stale shock or consume the new daily slot', async t => {
  const {owner} = await newRoom(), next = reset(), restarted = {...owner,progressId:next.resetId};
  t.mock.method(crypto,'getRandomValues',array => array.fill(0));
  const atWrite = Promise.withResolvers(), resume = Promise.withResolvers();
  const delayed = {...DB, async batch(statements) {
    atWrite.resolve();
    await resume.promise;
    return DB.batch(statements);
  }};
  const oldOffering = request(ritualPath,owner,offer(),delayed);
  await atWrite.promise;
  try {
    await ok(request(progressPath,owner,next));
  } finally {
    resume.resolve();
  }
  assert.equal((await oldOffering).status,409);
  const fresh = await ok(request(ritualPath,restarted));
  assert.equal(fresh.usedDay,null);
  assert.deepEqual(fresh.events,[]);
  assert.equal((await ok(request(ritualPath,restarted,offer()))).result.success,true);
});

test('a legacy same-day receipt repair belongs to one member and cannot unlock a later offering twice', async t => {
  const {owner,peer} = await newRoom(), elsewhere = (await newRoom(owner.guest)).owner;
  t.mock.method(crypto,'getRandomValues',array=>array.fill(0));
  const path = '/api/progress/ritual-repair', today = gameTime(now).day;
  const currentClient = {...elsewhere,progressId:'initial'};
  const mine = offer(), theirs = offer(), elsewhereOffer = offer();
  await ok(request(ritualPath,owner,mine));
  await ok(request(ritualPath,peer,theirs));
  await ok(request(ritualPath,currentClient,elsewhereOffer));

  const repair = {resetId:crypto.randomUUID(),day:today,receiptId:mine.id};
  assert.equal((await ok(request(ritualPath,owner))).usedRequestId,mine.id);
  assert.ok(!(await request(path,owner,{...repair,day:today-1})).ok);
  assert.ok(!(await request(path,owner,{...repair,receiptId:theirs.id})).ok);
  assert.ok(!(await request(path,peer,repair)).ok);
  assert.ok(!(await request(path,elsewhere,repair)).ok);
  assert.ok(!(await request(path,currentClient,{...repair,receiptId:elsewhereOffer.id})).ok);
  assert.equal((await ok(request(ritualPath,currentClient))).usedDay,today);
  assert.equal((await ok(request(ritualPath,owner))).usedDay,today);

  await ok(request(path,owner,repair));
  const unlocked = await ok(request(ritualPath,owner));
  assert.equal(unlocked.usedDay,null);
  assert.equal(unlocked.ritualRepairId,repair.resetId);
  assert.deepEqual(unlocked.events.map(event=>event.id),[mine.id,theirs.id]);
  assert.equal((await ok(request(ritualPath,peer))).usedRequestId,theirs.id);
  assert.equal((await ok(request(ritualPath,elsewhere))).usedRequestId,elsewhereOffer.id);

  const fresh = offer();
  await ok(request(ritualPath,owner,fresh));
  await ok(request(path,owner,repair));
  assert.ok(!(await request(path,owner,{...repair,receiptId:fresh.id,resetId:crypto.randomUUID()})).ok);
  assert.equal((await ok(request(ritualPath,owner))).usedRequestId,fresh.id);
  assert.equal((await request(ritualPath,owner,offer())).status,409);

  const next = reset(), current = {...owner, progressId:next.resetId};
  await ok(request(progressPath,owner,next));
  const modern = offer();
  await ok(request(ritualPath,current,modern));
  assert.ok(!(await request(path,current,{...repair,resetId:crypto.randomUUID(),receiptId:modern.id})).ok);
  assert.equal((await ok(request(ritualPath,current))).usedRequestId,modern.id);
  assert.deepEqual((await ok(request(ritualPath,peer))).events.map(event=>event.id),[mine.id,theirs.id,fresh.id,modern.id]);
});
