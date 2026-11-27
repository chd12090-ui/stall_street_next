import test from 'node:test';
import assert from 'node:assert/strict';
import {DB} from '../test-support/game-db.mjs';
import {serveElections} from '../src/server/elections.mjs';
import {actualTimestamp,gameDayStart,gameTime} from '../src/game/clock-calendar.mjs';

const electionStart = Date.UTC(2026, 10, 20, 9);
const week = 7 * 86400000;
const closesAfter = 51 * 3600000;
const endpoint = 'https://stall.example/api/elections';

function request(member, now, body, fetchSite = 'same-origin') {
  const headers = {'Content-Type': 'application/json', 'Sec-Fetch-Site': fetchSite};
  if (member) headers['OAI-Authenticated-User-Id'] = member;
  return serveElections(new Request(endpoint, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body && JSON.stringify(body),
  }), DB, now);
}

function vote(member, election, time, candidate) {
  return request(member, time, {action: 'vote', election, candidate});
}

async function accepted(responsePromise) {
  const response = await responsePromise;
  const body = await response.json();
  assert.equal(response.status, 200, body.error);
  return body;
}

test('reset restores a blank ballot for the same account and counts one replacement vote', async () => {
  const member = 'resetting-player', friend = 'other-player';
  await accepted(vote(member, electionStart, electionStart + 1, 'progressive'));
  const both = await accepted(vote(friend, electionStart, electionStart + 2, 'conservative'));
  assert.equal(both.ballot.votes, 2);

  const resetAt = electionStart + 100;
  const reset = {action: 'reset', resetAt, resetId: crypto.randomUUID()};
  const cleared = await accepted(request(member, resetAt, reset));
  assert.equal(cleared.ballot.ownVote, null);
  assert.equal(cleared.ballot.votes, 1);
  assert.equal((await accepted(request(friend, resetAt))).ballot.ownVote, 'conservative');

  const replacement = await accepted(vote(member, electionStart, resetAt, 'conservative'));
  assert.equal(replacement.ballot.votes, 2);
  assert.equal(replacement.ballot.ownVote, 'conservative');
  // A lost response can prompt a retry after another tab has already voted again.
  const retried = await accepted(request(member, resetAt + 10, reset));
  assert.equal(retried.ballot.ownVote, 'conservative');
  assert.equal(retried.ballot.votes, 2);
  assert.equal((await vote(member, electionStart, resetAt + 15, 'progressive')).status, 409);

  const end = electionStart + closesAfter;
  const closed = await accepted(request(member, end));
  assert.deepEqual(closed.lastResult, {
    startsAt: electionStart, endsAt: end, progressive: 0, conservative: 2, winner: 'conservative',
  });
  const late = await accepted(request(member, end, {...reset, resetId: crypto.randomUUID()}));
  assert.equal(late.ballot, null);
  assert.deepEqual(late.lastResult, closed.lastResult);
});

test('an offline reset replay cannot clear a newer vote or change an older result', async () => {
  const member = 'offline-reset-player';
  const first = electionStart + 2 * week, next = first + week;
  await accepted(vote(member, first, first + 5, 'progressive'));
  const reset = {action: 'reset', resetAt: first + 10, resetId: crypto.randomUUID()};
  const newBallot = await accepted(vote(member, next, next + 1, 'conservative'));
  const delayed = await accepted(request(member, next + 10, reset));
  assert.equal(delayed.ballot.ownVote, 'conservative');
  assert.equal(delayed.ballot.votes, 1);
  assert.deepEqual(delayed.lastResult, newBallot.lastResult);
  assert.equal(delayed.lastResult.progressive, 1);

  const olderOnSameDay = {action: 'reset', resetAt: next, resetId: crypto.randomUUID()};
  const concurrent = await accepted(request(member, next + 20, olderOnSameDay));
  assert.equal(concurrent.ballot.ownVote, 'conservative');
});

test('reset authenticates the caller and ignores another member supplied by the client', async () => {
  const first = electionStart + 4 * week;
  const victim = 'original-voter', other = 'another-voter';
  await accepted(vote(victim, first, first + 1, 'progressive'));
  const reset = {action: 'reset', resetAt: first + 5, resetId: crypto.randomUUID(), memberId: victim};
  assert.equal((await request(null, first + 5, reset)).status, 401);
  assert.equal((await request(victim, first + 5, reset, 'cross-site')).status, 403);
  assert.equal((await request(victim, first + 5, {...reset, resetAt: first + 65_005})).status, 400);
  assert.equal((await request(victim, first + 5, {...reset, resetAt: 'unknown'})).status, 400);
  await accepted(request(other, first + 5, reset));
  const untouched = await accepted(request(victim, first + 6));
  assert.equal(untouched.ballot.ownVote, 'progressive');
  assert.equal(untouched.ballot.votes, 1);
});

test('an outstanding vote from before reset cannot fill the replacement ballot', async () => {
  const election = electionStart + 6 * week, member = 'delayed-ballot';
  const original = (await accepted(request(member, election))).ballot;
  await accepted(request(member, election + 1, {action: 'reset', resetId: crypto.randomUUID(), resetAt: election + 1}));
  const post = {action: 'vote', election, candidate: 'progressive', generation: original.generation};
  assert.equal((await request(member, election + 2, post)).status, 409);
  const fresh = (await accepted(request(member, election + 3))).ballot;
  assert.equal(fresh.ownVote, null);
  assert.equal(fresh.votes, 0);
  assert.equal(fresh.generation, original.generation + 1);
  const cast = await accepted(request(member, election + 4, {...post, generation: fresh.generation}));
  assert.equal(cast.ballot.ownVote, 'progressive');
  assert.equal(cast.ballot.votes, 1);
});

test('new elections run for exactly two whole game days while keeping the old round key', async () => {
  const id=electionStart+week,day=gameTime(id).day;
  const start=actualTimestamp(gameDayStart(day)),end=actualTimestamp(gameDayStart(day+2));
  const member='first-day-player',late='second-day-player';
  const before=await accepted(request(member,start-1));
  assert.equal(before.ballot,null);
  assert.equal(before.nextStartsAt,start);
  assert.equal(before.nextEndsAt,end);
  assert.equal(before.lastResult.endsAt,electionStart+closesAfter);
  assert.equal((await vote(member,id,start-1,'progressive')).status,409);

  const open=await accepted(vote(member,start,start,'progressive'));
  assert.equal(open.ballot.roundId,id);
  assert.equal(open.ballot.startsAt,start);
  assert.equal(open.ballot.endsAt,end);
  assert.equal(open.ballot.votes,1);
  const lastMinute=await accepted(vote(late,id,end-1,'progressive'));
  assert.equal(lastMinute.ballot.votes,2);
  assert.equal((await vote('after-close',id,end,'conservative')).status,409);

  const closed=await accepted(request(member,end));
  assert.equal(closed.ballot,null);
  assert.deepEqual(closed.lastResult,{startsAt:start,endsAt:end,progressive:2,conservative:0,winner:'progressive'});
  assert.deepEqual(closed.terms.at(-1),{candidate:'progressive',effectiveAt:end});
  assert.equal(gameTime(closed.nextStartsAt).day,day+14);
});
