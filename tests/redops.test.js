// Red Ops: a chain of choices scored deterministically, never a dice roll —
// same discipline as every other grade in this project.

import test from 'node:test';
import assert from 'node:assert/strict';

import { RED_OPS, hasRedOps, redOpsFor } from '../src/data/redops.js';
import { SCENARIOS } from '../src/data/scenarios/index.js';
import { TACTIC_COVERAGE } from '../src/data/estate.js';
import { scoreRedRun, tacticDetectionPct, withRedOpsTarget, compareRedBlue } from '../src/engine/redops.js';
import { dealShift } from '../src/engine/deal.js';

test('every Red Ops scenario id is a real scenario in the library', () => {
  for (const id of Object.keys(RED_OPS)) {
    assert.ok(SCENARIOS.some((s) => s.id === id), `${id} is not in SCENARIOS`);
  }
});

test('every stage tactic is one the Dashboard actually tracks', () => {
  const known = new Set(TACTIC_COVERAGE.map((t) => t.tactic));
  for (const [id, ops] of Object.entries(RED_OPS)) {
    for (const stage of ops.stages) {
      assert.ok(known.has(stage.tactic), `${id}/${stage.id} uses an untracked tactic "${stage.tactic}"`);
    }
  }
});

test('every stage has exactly one canonical choice', () => {
  for (const [id, ops] of Object.entries(RED_OPS)) {
    for (const stage of ops.stages) {
      const canonical = stage.choices.filter((c) => c.canonical).length;
      assert.equal(canonical, 1, `${id}/${stage.id} has ${canonical} canonical choices, expected 1`);
    }
  }
});

test('every choice has a stealth score between 0 and 100', () => {
  for (const [id, ops] of Object.entries(RED_OPS)) {
    for (const stage of ops.stages) {
      for (const choice of stage.choices) {
        assert.ok(choice.stealth >= 0 && choice.stealth <= 100, `${id}/${stage.id}/${choice.id}: ${choice.stealth}`);
      }
    }
  }
});

test('hasRedOps / redOpsFor agree with the data', () => {
  assert.equal(hasRedOps('malicious-powershell-precursor'), true);
  assert.equal(hasRedOps('not-a-real-scenario'), false);
  assert.equal(redOpsFor('not-a-real-scenario'), null);
});

test('tacticDetectionPct reads the same numbers the Dashboard shows, live', () => {
  for (const { tactic, pct } of TACTIC_COVERAGE) {
    assert.equal(tacticDetectionPct(tactic), pct);
  }
  assert.equal(tacticDetectionPct('Not A Real Tactic'), null);
});

test('the evasion score is the average stealth of the choices actually made', () => {
  const ops = redOpsFor('malicious-powershell-precursor');
  const ids = ops.stages.map((s) => s.choices[0].id);
  const result = scoreRedRun(ops, ids);
  const expected = Math.round(ops.stages.reduce((sum, s) => sum + s.choices[0].stealth, 0) / ops.stages.length);
  assert.equal(result.evasionScore, expected);
  assert.equal(result.breakdown.length, ops.stages.length);
});

test('playing every canonical choice is flagged as matching the real incident', () => {
  const ops = redOpsFor('phishing-bec-ambiguous');
  const ids = ops.stages.map((s) => s.choices.find((c) => c.canonical).id);
  const result = scoreRedRun(ops, ids);
  assert.equal(result.matchesCanonical, true);
  assert.ok(result.breakdown.every((b) => b.canonical));
});

test('a run is deterministic — same choices, same score, every time', () => {
  const ops = redOpsFor('aws-key-leak');
  const ids = ops.stages.map((s) => s.choices[1].id);
  const a = scoreRedRun(ops, ids);
  const b = scoreRedRun(ops, ids);
  assert.deepEqual(a, b);
});

test('withRedOpsTarget adds the scenario only if it is missing, sorted into the queue', () => {
  const seed = Date.UTC(2026, 4, 12, 9, 30);
  const hand = dealShift(seed, 0);
  const missing = SCENARIOS.find((s) => !hand.some((h) => h.id === s.id));
  assert.ok(missing, 'need at least one scenario not in this hand to test injection');

  const withTarget = withRedOpsTarget(hand, missing.id, SCENARIOS);
  assert.equal(withTarget.length, hand.length + 1);
  assert.ok(withTarget.some((s) => s.id === missing.id));

  // Already present: no duplicate.
  const already = hand[0].id;
  assert.equal(withRedOpsTarget(hand, already, SCENARIOS).length, hand.length);

  // No target: unchanged.
  assert.equal(withRedOpsTarget(hand, null, SCENARIOS), hand);
});

test('compareRedBlue picks the higher score, or a tie', () => {
  assert.equal(compareRedBlue(80, 60), 'red');
  assert.equal(compareRedBlue(60, 80), 'blue');
  assert.equal(compareRedBlue(70, 70), 'tie');
});
