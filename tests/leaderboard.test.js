// The three leaderboards: a well-formed roster, ranking that handles ties, your
// standing read from the same engines that show it elsewhere, and every board
// beatable by a perfect player but never by a new one.

import test from 'node:test';
import assert from 'node:assert/strict';

import { EGGS } from '../src/data/easterEggs.js';
import { ROSTER } from '../src/data/leaderboard.js';
import { RED_OPS } from '../src/data/redops.js';
import { SCENARIOS } from '../src/data/scenarios/index.js';
import { PROMOTION_SCORE_BAR, SKILLS, advanceCheckpoint, emptyProgress } from '../src/engine/progress.js';
import { advanceRedCheckpoint, emptyRedProgress, resetRedProgress } from '../src/engine/redProgress.js';
import { buildBoards, fastStanding, rankEntries, standingText } from '../src/engine/leaderboard.js';

const IDS = Object.keys(RED_OPS);

function boardsFor({ progress = emptyProgress(), redProgress = emptyRedProgress(), found = [], fastRuns = [] } = {}) {
  return buildBoards({
    progress, redProgress, found, fastRuns, library: SCENARIOS, operationIds: IDS, secretsTotal: EGGS.length,
  });
}

const you = (rows) => rows.find((r) => r.isYou);

// A history in which every case type was cleared at the given score.
function historyAt(score) {
  return SCENARIOS.map((s, i) => ({
    key: `k${i}`, scenarioId: s.id, closedAt: i, attempt: 1, assisted: false,
    overallScore: score, resolved: true, outcomes: Object.fromEntries(SKILLS.map((k) => [k.id, true])), escalation: 'correct',
  }));
}

function perfectRed() {
  const history = [];
  for (let n = 0; n < 2; n += 1) {
    for (const operationId of IDS) history.push({ operationId, at: n, outcome: 'complete', score: 64, caught: 0, moves: 4, dwellDays: 0, ghost: true });
  }
  return advanceRedCheckpoint({ history, checkpointRankIndex: 0 }, IDS);
}

test('the roster is well-formed and has fixed, distinct people', () => {
  assert.ok(ROSTER.length >= 8);
  assert.equal(new Set(ROSTER.map((p) => p.id)).size, ROSTER.length);
  for (const p of ROSTER) {
    assert.ok(p.name && p.role, p.id);
    assert.ok([0, 1, 2].includes(p.blue.rankIndex), p.id);
    assert.ok([0, 1, 2].includes(p.red.rankIndex), p.id);
    assert.ok(Number.isInteger(p.secrets) && p.secrets >= 0, p.id);
  }
});

test('roster standings stay true as the library grows', () => {
  const b = boardsFor().blue;
  for (const row of b.filter((r) => !r.isYou)) {
    assert.ok(row.cleared <= SCENARIOS.length, row.id);
    if (row.rankIndex === 2) assert.equal(row.cleared, SCENARIOS.length, 'senior means every case type cleared');
    if (row.rankIndex === 1) assert.ok(row.cleared < SCENARIOS.length, 'a Tier 1 has not cleared them all');
  }
  const r = boardsFor().red;
  for (const row of r.filter((x) => !x.isYou)) {
    assert.ok(row.cleared <= IDS.length, row.id);
    if (row.rankIndex === 2) assert.equal(row.cleared, IDS.length);
  }
  for (const row of boardsFor().secrets) assert.ok(row.count <= EGGS.length, row.id);
});

test('each board lists the whole roster plus you, exactly once', () => {
  const boards = boardsFor();
  for (const key of ['blue', 'red', 'fast', 'secrets']) {
    assert.equal(boards[key].length, ROSTER.length + 1, key);
    assert.equal(boards[key].filter((r) => r.isYou).length, 1, key);
  }
  assert.equal(boards.totals.blue, SCENARIOS.length);
  assert.equal(boards.totals.red, IDS.length);
  assert.equal(boards.totals.secrets, EGGS.length);
});

test('ranking shares a rank on ties, skips the next, and lists you first among equals', () => {
  const entries = [
    { id: 'a', name: 'Ana', count: 5 },
    { id: 'b', name: 'Ben', count: 9 },
    { id: 'you', name: 'You', isYou: true, count: 5 },
    { id: 'd', name: 'Dee', count: 1 },
  ];
  const ranked = rankEntries(entries, (x, y) => y.count - x.count);
  assert.deepEqual(ranked.map((r) => r.id), ['b', 'you', 'a', 'd']);
  assert.deepEqual(ranked.map((r) => r.rank), [1, 2, 2, 4]);
});

test('a brand-new player is on every board, and not near the top of any', () => {
  const boards = boardsFor();
  for (const key of ['blue', 'red', 'fast', 'secrets']) {
    assert.ok(you(boards[key]).rank > 1, `${key}: a new player should not lead`);
  }
  assert.equal(you(boards.secrets).count, 0);
  assert.equal(you(boards.blue).rankLabel, 'Trainee');
  assert.equal(you(boards.red).rankLabel, 'Recruit');
});

test('a perfect player takes first place on every board', () => {
  const progress = advanceCheckpoint({ ...emptyProgress(), history: historyAt(100) }, SCENARIOS);
  const boards = boardsFor({
    progress,
    redProgress: perfectRed(),
    found: EGGS.map((e) => e.id),
    fastRuns: [{ at: 1, score: 100, grade: 'A', correct: 20, total: 20, closedLive: 0, avgSeconds: 12 }],
  });
  for (const key of ['blue', 'red', 'fast', 'secrets']) {
    assert.equal(you(boards[key]).rank, 1, `${key}: the top is reachable`);
  }
  assert.equal(you(boards.blue).cleared, SCENARIOS.length);
  assert.equal(you(boards.red).cleared, IDS.length);
});

test('your blue standing is read from history: cleared types and average best score', () => {
  const progress = { ...emptyProgress(), history: historyAt(PROMOTION_SCORE_BAR - 1).slice(0, 5) };
  const row = you(boardsFor({ progress }).blue);
  assert.equal(row.cleared, 0, 'below the bar does not count as cleared');
  assert.equal(row.avg, PROMOTION_SCORE_BAR - 1);
  const cleared = { ...emptyProgress(), history: historyAt(PROMOTION_SCORE_BAR).slice(0, 5) };
  assert.equal(you(boardsFor({ progress: cleared }).blue).cleared, 5);
});

test('Reset everything keeps ranks but clears the record behind them', () => {
  const earned = perfectRed();
  const reset = resetRedProgress(earned);
  const row = you(boardsFor({ redProgress: reset }).red);
  assert.equal(row.rankLabel, 'Senior Operator — Team Lead ready', 'the rank is a checkpoint');
  assert.equal(row.cleared, 0);
  assert.equal(row.ghosts, 0);

  const blueEarned = advanceCheckpoint({ ...emptyProgress(), history: historyAt(100) }, SCENARIOS);
  const blueReset = { ...emptyProgress(), checkpointRankIndex: blueEarned.checkpointRankIndex };
  const blue = you(boardsFor({ progress: blueReset }).blue);
  assert.equal(blue.rankLabel, 'Senior Analyst — Tier 2 ready');
  assert.equal(blue.cleared, 0);
});

test('the secrets board follows the found list and Reset everything does not touch it', () => {
  const found = EGGS.slice(0, 7).map((e) => e.id);
  const row = you(boardsFor({ found }).secrets);
  assert.equal(row.count, 7);
  // The found list is not an input to any reset, so a reset leaves the count.
  const afterReset = you(boardsFor({ found, progress: emptyProgress(), redProgress: emptyRedProgress() }).secrets);
  assert.equal(afterReset.count, 7);
});

test('the copied standing names all three boards and the live link', () => {
  const text = standingText(boardsFor({ found: EGGS.slice(0, 3).map((e) => e.id) }));
  assert.match(text, /Blue: Trainee, #\d+ of 11/);
  assert.match(text, /Red: Recruit, #\d+ of 11/);
  assert.match(text, new RegExp(`Secrets: 3 of ${EGGS.length}, #\\d+ of 11`));
  assert.match(text, /Fast Triage: no runs yet, #\d+ of 11/);
  const withRun = standingText(boardsFor({ fastRuns: [{ score: 88, grade: 'B', avgSeconds: 20 }] }));
  assert.match(withRun, /Fast Triage: best 88, #\d+ of 11/);
  assert.match(text, /^SEA SOC Analyst Console/);
  assert.match(text, /https:\/\/nicky-quist\.github\.io\/soc-analyst-simulator\//);
});

// ── the roster reads the way the org chart does ─────────────────────────────

const order = (rows) => rows.filter((r) => !r.isYou).map((r) => r.id);

test('analyst-judgment boards put the most experienced analysts first', () => {
  const expected = [
    'jordan-reyes', 'priya-anand', 'marcus-bell', 'marcus-ibe', 'tom-alvarez',
    'sarah-okafor', 'kenji-watanabe', 'dev-malhotra', 'aisha-rahman', 'david-reyes',
  ];
  const boards = boardsFor();
  assert.deepEqual(order(boards.blue), expected, 'Blue Team');
  assert.deepEqual(order(boards.fast), expected, 'Fast Triage');
});

test('the Red Team board puts adversary-savvy roles first', () => {
  assert.deepEqual(order(boardsFor().red), [
    'marcus-bell', 'marcus-ibe', 'jordan-reyes', 'tom-alvarez', 'priya-anand',
    'dev-malhotra', 'kenji-watanabe', 'sarah-okafor', 'aisha-rahman', 'david-reyes',
  ]);
});

test('the Secrets board favors the engineers who poke at tools', () => {
  assert.deepEqual(order(boardsFor().secrets), [
    'marcus-ibe', 'jordan-reyes', 'dev-malhotra', 'marcus-bell', 'tom-alvarez',
    'kenji-watanabe', 'priya-anand', 'sarah-okafor', 'aisha-rahman', 'david-reyes',
  ]);
});

test('on every board the technical security roles outrank the business roles, and the CEO is last', () => {
  const security = ['jordan-reyes', 'priya-anand', 'marcus-bell', 'marcus-ibe', 'tom-alvarez'];
  const business = ['aisha-rahman', 'david-reyes'];
  const boards = boardsFor();
  for (const key of ['blue', 'red', 'fast', 'secrets']) {
    const ids = order(boards[key]);
    for (const a of security) {
      for (const b of business) assert.ok(ids.indexOf(a) < ids.indexOf(b), `${key}: ${a} should outrank ${b}`);
    }
    assert.equal(ids.at(-1), 'david-reyes', `${key}: the CEO is last`);
  }
});

test('the Tier 2 analyst outranks the team lead on the judgment boards', () => {
  const boards = boardsFor();
  for (const key of ['blue', 'fast']) {
    const ids = order(boards[key]);
    assert.ok(ids.indexOf('jordan-reyes') < ids.indexOf('priya-anand'), key);
  }
});

// ── Fast Triage board ───────────────────────────────────────────────────────

test('your Fast Triage standing is your best run and the pace of that run', () => {
  assert.deepEqual(fastStanding([]), { best: null, grade: null, avgSeconds: null, runs: 0 });
  const runs = [
    { score: 70, grade: 'C', avgSeconds: 30 },
    { score: 91, grade: 'A', avgSeconds: 25 },
    { score: 80, grade: 'B', avgSeconds: 15 },
  ];
  assert.deepEqual(fastStanding(runs), { best: 91, grade: 'A', avgSeconds: 25, runs: 3 });
  const tied = fastStanding([{ score: 90, grade: 'A', avgSeconds: 30 }, { score: 90, grade: 'A', avgSeconds: 18 }]);
  assert.equal(tied.avgSeconds, 18, 'among equal scores, the faster run represents you');
});

test('Fast Triage ranks by score, then by faster pace', () => {
  const jordan = ROSTER.find((p) => p.id === 'jordan-reyes').fast;
  const same = boardsFor({ fastRuns: [{ score: jordan.best, grade: 'A', avgSeconds: jordan.avgSeconds - 5 }] }).fast;
  assert.equal(same[0].isYou, true, 'the same score at a faster pace ranks above');
  const slower = boardsFor({ fastRuns: [{ score: jordan.best, grade: 'A', avgSeconds: jordan.avgSeconds + 5 }] }).fast;
  assert.equal(slower[0].id, 'jordan-reyes');
  assert.equal(slower[1].isYou, true);
});

test('a new player with no runs sorts below everyone who has one', () => {
  const fast = boardsFor().fast;
  assert.equal(fast.at(-1).isYou, true);
  assert.equal(fast.at(-1).best, null);
});

test('Reset everything clears Fast Triage runs, so the board shows no runs again', () => {
  const played = you(boardsFor({ fastRuns: [{ score: 88, grade: 'B', avgSeconds: 20 }] }).fast);
  assert.equal(played.best, 88);
  const afterReset = you(boardsFor({ fastRuns: [] }).fast);
  assert.equal(afterReset.best, null);
  assert.equal(afterReset.runs, 0);
});
