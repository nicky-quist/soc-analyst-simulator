// Online leaderboard

import test from 'node:test';
import assert from 'node:assert/strict';

import { RED_OPS } from '../src/data/redops.js';
import { SCENARIOS } from '../src/data/scenarios/index.js';
import { buildOnlineBoards, standingPayload } from '../src/engine/online.js';
import { emptyProgress } from '../src/engine/progress.js';
import { emptyRedProgress } from '../src/engine/redProgress.js';

const IDS = Object.keys(RED_OPS);

const payloadFor = (over = {}) => standingPayload({
  progress: emptyProgress(), redProgress: emptyRedProgress(), found: [], fastRuns: [],
  library: SCENARIOS, operationIds: IDS, ...over,
});

const row = (name, over = {}) => ({
  display_name: name, club_member: false, is_me: false,
  blue_rank: 0, blue_cleared: 0, blue_avg: null,
  red_rank: 0, red_cleared: 0, red_ghosts: 0, red_best: null,
  fast_best: null, fast_avg_seconds: null, fast_runs: 0,
  secrets: 0, ...over,
});

test('a brand-new player publishes an empty standing, with nulls for "no data"', () => {
  const p = payloadFor();
  assert.equal(p.blue_rank, 0);
  assert.equal(p.blue_cleared, 0);
  assert.equal(p.blue_avg, null);
  assert.equal(p.red_best, null);
  assert.equal(p.fast_best, null);
  assert.equal(p.fast_runs, 0);
  assert.equal(p.secrets, 0);
});

test('the payload carries standings only, never case text or history', () => {
  const keys = Object.keys(payloadFor()).sort();
  assert.deepEqual(keys, [
    'blue_avg', 'blue_cleared', 'blue_rank', 'fast_avg_seconds', 'fast_best', 'fast_runs',
    'red_best', 'red_cleared', 'red_ghosts', 'red_rank', 'secrets',
  ]);
});

test('fast triage and secrets flow into the payload within server limits', () => {
  const p = payloadFor({
    fastRuns: [{ score: 72, avgSeconds: 41.234 }, { score: 91, avgSeconds: 30.04 }],
    found: ['a', 'b', 'c'],
  });
  assert.equal(p.fast_best, 91);
  assert.equal(p.fast_avg_seconds, 30);
  assert.equal(p.fast_runs, 2);
  assert.equal(p.secrets, 3);
});

test('online blue board ranks by career rank, then cleared, then average', () => {
  const { blue } = buildOnlineBoards([
    row('Low', { blue_rank: 0, blue_cleared: 9, blue_avg: 99 }),
    row('High', { blue_rank: 1, blue_cleared: 2, blue_avg: 50 }),
    row('HighAvg', { blue_rank: 1, blue_cleared: 2, blue_avg: 80 }),
  ]);
  assert.deepEqual(blue.map((r) => r.name), ['HighAvg', 'High', 'Low']);
  assert.deepEqual(blue.map((r) => r.rank), [1, 2, 3]);
  assert.equal(blue[0].rankLabel, 'Tier 1 Analyst');
});

test('players with no Fast Triage run are left off that board only', () => {
  const boards = buildOnlineBoards([
    row('Runner', { fast_best: 88, fast_avg_seconds: 20, fast_runs: 3 }),
    row('Newbie'),
  ]);
  assert.deepEqual(boards.fast.map((r) => r.name), ['Runner']);
  assert.equal(boards.fast[0].grade, 'B');
  assert.equal(boards.blue.length, 2);
});

test('numeric strings from the server are read as numbers, and you are flagged', () => {
  const { blue } = buildOnlineBoards([row('Me', { is_me: true, blue_avg: '84.5' })]);
  assert.equal(blue[0].avg, 84.5);
  assert.equal(blue[0].isYou, true);
});

test('club members are labelled, and ties share a rank', () => {
  const { secrets } = buildOnlineBoards([
    row('A', { club_member: true, secrets: 4 }),
    row('B', { secrets: 4 }),
    row('C', { secrets: 1 }),
  ]);
  assert.equal(secrets[0].role, 'Club member');
  assert.equal(secrets[1].role, 'Player');
  assert.deepEqual(secrets.map((r) => r.rank), [1, 1, 3]);
});

test('an out-of-range rank from the server falls back to the first rank label', () => {
  const { blue, red } = buildOnlineBoards([row('Odd', { blue_rank: 9, red_rank: 9 })]);
  assert.equal(blue[0].rankLabel, 'Trainee');
  assert.equal(red[0].rankLabel, 'Recruit');
});
