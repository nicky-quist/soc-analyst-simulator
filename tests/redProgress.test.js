// Red Ops career: breadth at a standard, finishing counts, and a rank once
// earned is a checkpoint that a reset never takes back.

import test from 'node:test';
import assert from 'node:assert/strict';

import { RED_OPS } from '../src/data/redops.js';
import { SCENARIOS } from '../src/data/scenarios/index.js';
import { playStage, scoreRun, startRun, abortRun } from '../src/engine/redopsRun.js';
import {
  HISTORY_LIMIT, MAX_RECENT_FAILURES, OPERATOR_CLEARED, RECENT_RUNS, RED_BAR, RED_RANKS, SENIOR_GHOST_OPERATIONS,
  advanceRedCheckpoint, bestCompleted, buildRedRecord, emptyRedProgress, recordRedRun,
  redStats, redStatus, resetRedProgress,
} from '../src/engine/redProgress.js';
import { RED_PROGRESS_KEY, loadRedProgress, saveRedProgress } from '../src/engine/redProgressStore.js';

const IDS = Object.keys(RED_OPS);
const quietest = (stage) => [...stage.choices].sort((a, b) => b.stealth - a.stealth)[0];
const loudest = (stage) => [...stage.choices].sort((a, b) => a.stealth - b.stealth)[0];

function play(ops, pickFn) {
  let run = startRun();
  for (const stage of ops.stages) {
    if (run.status !== 'active') break;
    run = playStage(run, ops, pickFn(stage).id);
  }
  return run;
}

const resultFor = (id, pickFn) => scoreRun(RED_OPS[id], play(RED_OPS[id], pickFn));
const record = (id, pickFn, at = 0) => buildRedRecord(id, resultFor(id, pickFn), at);

function progressWith(records, checkpointRankIndex = 0) {
  return records.reduce((p, r) => recordRedRun(p, r), { ...emptyRedProgress(), checkpointRankIndex });
}

test('the quietest possible run of every operation clears the bar, or the ladder is unreachable', () => {
  for (const id of IDS) {
    const r = record(id, quietest);
    assert.equal(r.outcome, 'complete', id);
    assert.ok(r.score >= RED_BAR, `${id} tops out at ${r.score}, below the bar of ${RED_BAR}`);
    assert.equal(r.ghost, true, `${id}: the quietest path is a ghost run`);
  }
});

test('a fresh operator starts as a Recruit with the Operator criteria showing', () => {
  const s = redStatus([], IDS, 0);
  assert.equal(s.rank, 'Recruit');
  assert.equal(s.next, 'Red Team Operator');
  assert.equal(s.criteria.length, 1);
  assert.equal(s.viaCheckpoint, false);
});

test('Operator asks for OPERATOR_CLEARED different operations, and replaying one is padding', () => {
  assert.equal(OPERATOR_CLEARED, 3);
  const one = progressWith([record(IDS[0], quietest)]);
  assert.equal(redStatus(one.history, IDS).rankIndex, 0);
  const same = progressWith(Array.from({ length: 5 }, () => record(IDS[0], quietest)));
  assert.equal(redStatus(same.history, IDS).rankIndex, 0, 'replaying the same operation is padding');
  const two = progressWith([record(IDS[0], quietest), record(IDS[1], quietest)]);
  assert.equal(redStatus(two.history, IDS).rankIndex, 0, 'two operations are one short');
  const three = progressWith(IDS.slice(0, OPERATOR_CLEARED).map((id) => record(id, quietest)));
  assert.equal(redStatus(three.history, IDS).rankIndex, 1);
});

test('the Operator rung asks for about the same share of the content as the analyst Tier 1', () => {
  // Blue asks for 10 of the library; Red should ask for a similar fraction of its operations.
  const blueShare = 10 / SCENARIOS.length;
  const redShare = OPERATOR_CLEARED / IDS.length;
  assert.ok(Math.abs(blueShare - redShare) <= 0.1, `blue ${blueShare.toFixed(2)} vs red ${redShare.toFixed(2)}`);
});

test('a burned or aborted run is recorded but can never clear an operation', () => {
  const burned = record(IDS[0], loudest);
  assert.equal(burned.outcome, 'burned');
  assert.equal(bestCompleted([burned])[IDS[0]], undefined);
  const ops = RED_OPS[IDS[0]];
  const aborted = buildRedRecord(IDS[0], scoreRun(ops, abortRun(playStage(startRun(), ops, quietest(ops.stages[0]).id))), 0);
  assert.equal(aborted.outcome, 'aborted');
  assert.equal(bestCompleted([aborted])[IDS[0]], undefined);
  const stats = redStats([burned, aborted], IDS);
  assert.equal(stats.burned, 1);
  assert.equal(stats.aborted, 1);
  assert.equal(stats.cleared, 0);
});

test('best score counts, so a worse later run does not lower it', () => {
  const good = record(IDS[0], quietest);
  const worse = { ...good, score: good.score - 20 };
  assert.equal(bestCompleted([good, worse])[IDS[0]], good.score);
  assert.equal(bestCompleted([worse, good])[IDS[0]], good.score);
});

test('Senior needs every operation, ghost runs on two operations, and a clean recent record', () => {
  const allClean = progressWith(IDS.map((id) => record(id, quietest)));
  const s = redStatus(allClean.history, IDS);
  assert.equal(s.rankIndex, 2);
  assert.equal(s.next, null);
  assert.equal(s.criteria.length, 0);

  // Everything cleared, but never a ghost run.
  const noGhost = progressWith(IDS.map((id) => {
    const r = record(id, quietest);
    return { ...r, ghost: false, caught: 1 };
  }));
  assert.equal(redStatus(noGhost.history, IDS).rankIndex, 1, 'operator, not senior, without a ghost run');

  // A ghost run on a single operation is not enough, and repeating it does not add a second.
  const oneGhost = progressWith(IDS.map((id, i) => {
    const r = record(id, quietest);
    return i === 0 ? r : { ...r, ghost: false, caught: 1 };
  }));
  const once = redStatus(oneGhost.history, IDS);
  assert.equal(once.rankIndex, 1, 'one ghosted operation is not enough');
  assert.equal(once.stats.ghostOperations, 1);
  const repeated = progressWith([...oneGhost.history, record(IDS[0], quietest), record(IDS[0], quietest)]);
  assert.equal(redStatus(repeated.history, IDS).stats.ghostOperations, 1, 'repeating the same operation adds nothing');

  // Ghosts on two different operations are.
  const twoGhosts = progressWith(IDS.map((id, i) => {
    const r = record(id, quietest);
    return i < SENIOR_GHOST_OPERATIONS ? r : { ...r, ghost: false, caught: 1 };
  }));
  assert.equal(redStatus(twoGhosts.history, IDS).rankIndex, 2);
});

test('too many recent burns hold Senior back even with everything else met', () => {
  const clean = IDS.map((id) => record(id, quietest));
  const burns = Array.from({ length: MAX_RECENT_FAILURES + 1 }, () => record(IDS[0], loudest));
  const tail = progressWith([...clean, ...burns]);
  const s = redStatus(tail.history, IDS);
  assert.equal(s.rankIndex, 1);
  const failing = s.criteria.find((c) => c.label.includes('burned or aborted'));
  assert.equal(failing.met, false);
  assert.equal(RECENT_RUNS, 6);

  // Recovering with clean runs pushes the burns out of the window again.
  const recovered = progressWith([...clean, ...burns, ...Array.from({ length: RECENT_RUNS }, () => record(IDS[1], quietest))]);
  assert.equal(redStatus(recovered.history, IDS).rankIndex, 2);
});

test('a rank is a checkpoint: resetting the runs never takes it back', () => {
  let p = progressWith(IDS.map((id) => record(id, quietest)));
  p = advanceRedCheckpoint(p, IDS);
  assert.equal(p.checkpointRankIndex, 2);

  const reset = resetRedProgress(p);
  assert.equal(reset.history.length, 0);
  assert.equal(reset.checkpointRankIndex, 2);
  const s = redStatus(reset.history, IDS, reset.checkpointRankIndex);
  assert.equal(s.rank, RED_RANKS[2].label);
  assert.equal(s.viaCheckpoint, true);
});

test('the checkpoint only ever moves up', () => {
  const p = { history: [], checkpointRankIndex: 1 };
  assert.equal(advanceRedCheckpoint(p, IDS), p);
  const promoted = advanceRedCheckpoint(progressWith(IDS.map((id) => record(id, quietest))), IDS);
  assert.equal(promoted.checkpointRankIndex, 2);
});

test('history is capped so storage cannot grow without bound', () => {
  const r = record(IDS[0], quietest);
  const p = progressWith(Array.from({ length: HISTORY_LIMIT + 25 }, () => r));
  assert.equal(p.history.length, HISTORY_LIMIT);
});

test('records carry what the career view needs', () => {
  const r = record(IDS[0], quietest, 123);
  for (const key of ['operationId', 'at', 'outcome', 'score', 'caught', 'moves', 'dwellDays', 'ghost']) {
    assert.ok(key in r, key);
  }
  assert.equal(r.at, 123);
});

// ── storage ─────────────────────────────────────────────────────────────────

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

test('progress round-trips through storage, checkpoint included', () => {
  withFakeStorage(() => {
    const p = { ...progressWith([record(IDS[0], quietest)]), checkpointRankIndex: 1 };
    saveRedProgress(p);
    assert.deepEqual(loadRedProgress(), p);
  });
});

test('corrupt or foreign storage loads as an empty career', () => {
  withFakeStorage((data) => {
    data.set(RED_PROGRESS_KEY, '{nope');
    assert.deepEqual(loadRedProgress(), emptyRedProgress());
    data.set(RED_PROGRESS_KEY, JSON.stringify({ history: 'x' }));
    assert.deepEqual(loadRedProgress(), emptyRedProgress());
    data.set(RED_PROGRESS_KEY, JSON.stringify({ history: [{ score: 'x' }, null, record(IDS[0], quietest)], checkpointRankIndex: 'two' }));
    const loaded = loadRedProgress();
    assert.equal(loaded.history.length, 1);
    assert.equal(loaded.checkpointRankIndex, 0);
  });
});
