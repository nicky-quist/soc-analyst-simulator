// Fast Triage has to hold three things: the pool is well-formed, every dealt
// run keeps its mix (including both trap types), and scoring treats a missed
// intrusion as worse than a needless escalation.

import test from 'node:test';
import assert from 'node:assert/strict';

import { FAST_ALERTS, DISPOSITIONS } from '../src/data/fasttriage.js';
import {
  COST, RUN_SIZE, dealRun, gradeFor, outcomeOf, scoreRun,
} from '../src/engine/fasttriage.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => 1_000 + i * 7919);
const VALID = new Set(DISPOSITIONS.map((d) => d.value));

test('every alert is well-formed', () => {
  const ids = new Set();
  for (const a of FAST_ALERTS) {
    assert.ok(!ids.has(a.id), `duplicate id ${a.id}`);
    ids.add(a.id);
    assert.ok(VALID.has(a.disposition), `${a.id} disposition`);
    assert.ok(a.source && a.rule && a.tell && a.theme, `${a.id} missing text`);
    assert.ok(a.facts.length >= 3, `${a.id} needs facts to decide on`);
    for (const [label, value] of a.facts) assert.ok(label && value, `${a.id} empty fact`);
    assert.ok([null, 'overstated', 'understated'].includes(a.trap), `${a.id} trap`);
  }
});

test('traps point the direction they claim', () => {
  const RANK = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
  for (const a of FAST_ALERTS.filter((x) => x.trap === 'overstated')) {
    assert.equal(a.disposition, 'close', `${a.id} overstated must close`);
    assert.ok(RANK[a.severity] >= RANK.HIGH, `${a.id} should read scary`);
  }
  for (const a of FAST_ALERTS.filter((x) => x.trap === 'understated')) {
    assert.notEqual(a.disposition, 'close', `${a.id} understated must be real`);
    assert.ok(RANK[a.severity] <= RANK.MEDIUM, `${a.id} should read routine`);
  }
});

test('the pool is big enough to deal a run without repeating', () => {
  assert.ok(FAST_ALERTS.length >= RUN_SIZE * 1.5);
  for (const d of DISPOSITIONS) {
    assert.ok(FAST_ALERTS.filter((a) => a.disposition === d.value).length >= 4, d.value);
  }
});

test('every run is the right size with no alert dealt twice', () => {
  for (const seed of SEEDS) {
    const run = dealRun(seed);
    assert.equal(run.length, RUN_SIZE);
    assert.equal(new Set(run.map((a) => a.id)).size, RUN_SIZE);
  }
});

test('every run holds the mix and both trap types', () => {
  for (const seed of SEEDS) {
    const run = dealRun(seed);
    const count = (fn) => run.filter(fn).length;
    assert.ok(count((a) => a.disposition === 'close') >= 8, 'needs closes');
    assert.ok(count((a) => a.disposition === 'ir') >= 3, 'needs IR pages');
    assert.ok(count((a) => a.disposition === 'tier2') >= 5, 'needs Tier 2');
    assert.ok(count((a) => a.trap === 'overstated') >= 2, 'needs overstated');
    assert.ok(count((a) => a.trap === 'understated') >= 2, 'needs understated');
  }
});

test('the deal is reproducible from its seed but varies across seeds', () => {
  assert.deepEqual(dealRun(42).map((a) => a.id), dealRun(42).map((a) => a.id));
  const distinct = new Set(SEEDS.map((s) => dealRun(s).map((a) => a.id).join()));
  assert.ok(distinct.size > SEEDS.length * 0.9);
});

test('every alert in the pool is eventually dealt', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const a of dealRun(seed)) seen.add(a.id);
  assert.equal(seen.size, FAST_ALERTS.length);
});

const answerAll = (run, fn) =>
  Object.fromEntries(run.map((a) => [a.id, { choice: fn(a), ms: 20_000 }]));

test('a perfect run scores 100 and grades A', () => {
  const run = dealRun(5);
  const r = scoreRun(run, answerAll(run, (a) => a.disposition));
  assert.equal(r.score, 100);
  assert.equal(r.grade, 'A');
  assert.equal(r.correct, RUN_SIZE);
  assert.equal(r.missedThreats, 0);
  assert.equal(r.trapsMissed, 0);
});

test('closing everything scores far worse than escalating everything', () => {
  const run = dealRun(5);
  const closeAll = scoreRun(run, answerAll(run, () => 'close'));
  const irAll = scoreRun(run, answerAll(run, () => 'ir'));
  assert.ok(closeAll.score < irAll.score, `${closeAll.score} vs ${irAll.score}`);
  assert.ok(closeAll.closedLive > 0);
});

test('an unanswered run is scored as skipped, not as correct', () => {
  const run = dealRun(5);
  const r = scoreRun(run, {});
  assert.equal(r.skipped, RUN_SIZE);
  assert.equal(r.correct, 0);
  assert.ok(r.score < 100);
});

test('cost is strictly worse for missing an intrusion than for over-escalating', () => {
  assert.ok(COST.ir.close > COST.close.ir);
  assert.ok(COST.ir.close > COST.ir.tier2);
  assert.ok(COST.tier2.close > COST.close.tier2);
  for (const truth of Object.keys(COST)) assert.equal(COST[truth][truth], 0);
});

test('outcomes are classified by direction', () => {
  assert.equal(outcomeOf('ir', 'close'), 'undertriage');
  assert.equal(outcomeOf('ir', 'tier2'), 'undertriage');
  assert.equal(outcomeOf('tier2', 'close'), 'undertriage');
  assert.equal(outcomeOf('close', 'tier2'), 'overtriage');
  assert.equal(outcomeOf('tier2', 'ir'), 'overtriage');
  assert.equal(outcomeOf('ir', 'skipped'), 'skipped');
  assert.equal(outcomeOf('ir', 'ir'), 'correct');
});

test('closing a live threat caps the grade at C', () => {
  assert.equal(gradeFor(95, 1, 0), 'C');
  assert.equal(gradeFor(85, 1, 0), 'C');
  assert.equal(gradeFor(95, 0, 0), 'A');
  assert.equal(gradeFor(60, 1, 0), 'D');
});

test('one missed IR page on an otherwise clean run cannot grade above C', () => {
  const run = dealRun(11);
  const victim = run.find((a) => a.disposition === 'ir');
  const r = scoreRun(run, answerAll(run, (a) => (a === victim ? 'close' : a.disposition)));
  assert.equal(r.closedLive, 1);
  assert.equal(r.missedThreats, 1);
  assert.equal(r.grade, 'C');
});

test('review groups mistakes by theme, most common first', () => {
  const run = dealRun(5);
  const r = scoreRun(run, answerAll(run, () => 'close'));
  assert.ok(r.byTheme.length > 0);
  for (let i = 1; i < r.byTheme.length; i += 1) {
    assert.ok(r.byTheme[i - 1].count >= r.byTheme[i].count);
  }
});

// ── saved runs and "Reset everything" ───────────────────────────────────────

function withFakeStorage(fn) {
  const data = new Map();
  const previous = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { data.set(k, String(v)); },
      removeItem: (k) => { data.delete(k); },
    },
  };
  try { fn(data); } finally { globalThis.window = previous; }
}

test('saved runs round-trip and keep only the most recent', async () => {
  const store = await import('../src/engine/fasttriageStore.js');
  withFakeStorage(() => {
    const runs = Array.from({ length: store.KEEP_RUNS + 5 }, (_, i) => ({ at: i, score: i }));
    store.saveFastTriageRuns(runs);
    const loaded = store.loadFastTriageRuns();
    assert.equal(loaded.length, store.KEEP_RUNS);
    assert.equal(loaded.at(-1).score, runs.at(-1).score);
  });
});

test('clearing the runs is what Reset everything relies on', async () => {
  const store = await import('../src/engine/fasttriageStore.js');
  withFakeStorage((data) => {
    store.saveFastTriageRuns([{ at: 1, score: 80 }]);
    assert.equal(store.loadFastTriageRuns().length, 1);
    store.clearFastTriageRuns();
    assert.equal(store.loadFastTriageRuns().length, 0);
    assert.ok(!data.has(store.FASTTRIAGE_KEY));
  });
});

test('unreadable or corrupt storage loads as an empty history', async () => {
  const store = await import('../src/engine/fasttriageStore.js');
  withFakeStorage((data) => {
    data.set(store.FASTTRIAGE_KEY, '{not json');
    assert.deepEqual(store.loadFastTriageRuns(), []);
    data.set(store.FASTTRIAGE_KEY, JSON.stringify([{ at: 1, score: 'x' }, { at: 2, score: 70 }]));
    assert.equal(store.loadFastTriageRuns().length, 1);
  });
});
