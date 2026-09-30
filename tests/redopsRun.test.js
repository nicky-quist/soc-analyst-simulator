// The interactive Red Ops operation: catches are a comparison, not a roll, the
// SOC's alertness compounds, and finishing has to pay more than quitting.

import test from 'node:test';
import assert from 'node:assert/strict';

import { RED_OPS, redOpsFor } from '../src/data/redops.js';
import { TACTIC_COVERAGE } from '../src/data/estate.js';
import {
  BURN_LEVEL, DARK_LIMIT, DETECTION_FACTOR, DWELL_PENALTY, PENALTY_PER_LEVEL,
  abortRun, canGoDark, detectionThreshold, goDark, playStage, scoreRun, startRun,
} from '../src/engine/redopsRun.js';

const quietest = (stage) => [...stage.choices].sort((a, b) => b.stealth - a.stealth)[0];
const loudest = (stage) => [...stage.choices].sort((a, b) => a.stealth - b.stealth)[0];

function play(ops, pickFn) {
  let run = startRun();
  for (const stage of ops.stages) {
    if (run.status !== 'active') break;
    run = playStage(run, ops, pickFn(stage, run).id);
  }
  return run;
}

test('the detection threshold is a fixed share of the Dashboard coverage for that tactic', () => {
  for (const { tactic, pct } of TACTIC_COVERAGE) {
    assert.equal(detectionThreshold(tactic), Math.round(pct * DETECTION_FACTOR));
  }
  assert.equal(detectionThreshold('Not A Real Tactic'), 0);
});

test('a first move is caught exactly when it is quieter than the threshold', () => {
  for (const [id, ops] of Object.entries(RED_OPS)) {
    const stage = ops.stages[0];
    for (const choice of stage.choices) {
      const run = playStage(startRun(), ops, choice.id);
      assert.equal(run.picks[0].caught, choice.stealth < detectionThreshold(stage.tactic), `${id}/${choice.id}`);
    }
  }
});

test('every stage offers a move that slips past a clean run and one that gets caught', () => {
  for (const [id, ops] of Object.entries(RED_OPS)) {
    for (const stage of ops.stages) {
      const t = detectionThreshold(stage.tactic);
      assert.ok(stage.choices.some((c) => c.stealth >= t), `${id}/${stage.id} is impossible to slip past`);
      assert.ok(stage.choices.some((c) => c.stealth < t), `${id}/${stage.id} can never be caught`);
    }
  }
});

test('playing the quietest move every time completes the operation unseen', () => {
  for (const [id, ops] of Object.entries(RED_OPS)) {
    const run = play(ops, quietest);
    assert.equal(run.status, 'complete', id);
    assert.equal(run.detections, 0, id);
    const result = scoreRun(ops, run);
    assert.equal(result.outcome, 'complete');
    assert.equal(result.notReached.length, 0);
  }
});

test('playing the loudest move every time burns the operation before it finishes', () => {
  for (const [id, ops] of Object.entries(RED_OPS)) {
    const run = play(ops, loudest);
    assert.equal(run.status, 'burned', id);
    assert.equal(run.detections, BURN_LEVEL, id);
    assert.equal(run.picks.length, BURN_LEVEL, id);
    const result = scoreRun(ops, run);
    assert.equal(result.outcome, 'burned');
    assert.ok(result.notReached.length > 0, `${id}: burned before the last stage`);
  }
});

test('each level of SOC alertness makes the next move louder', () => {
  const ops = redOpsFor('malicious-powershell-precursor');
  let run = playStage(startRun(), ops, loudest(ops.stages[0]).id);
  assert.equal(run.detections, 1);
  run = playStage(run, ops, quietest(ops.stages[1]).id);
  const pick = run.picks[1];
  assert.equal(pick.penalty, PENALTY_PER_LEVEL);
  assert.equal(pick.effectiveStealth, pick.stealth - PENALTY_PER_LEVEL);
});

test('going dark drops one alertness level, once, at a flat score cost', () => {
  const ops = redOpsFor('malicious-powershell-precursor');
  let run = startRun();
  assert.equal(canGoDark(run), false, 'nothing to hide from yet');
  run = playStage(run, ops, loudest(ops.stages[0]).id);
  assert.equal(canGoDark(run), true);
  run = goDark(run);
  assert.equal(run.detections, 0);
  assert.equal(run.dwellDays, 1);
  assert.equal(canGoDark(run), false);
  assert.equal(DARK_LIMIT, 1);
  assert.equal(goDark(run), run, 'a second attempt changes nothing');

  const rest = ops.stages.slice(1);
  for (const stage of rest) run = playStage(run, ops, quietest(stage).id);
  assert.equal(run.status, 'complete');
  const paid = scoreRun(ops, run).evasionScore;
  const free = scoreRun(ops, { ...run, dwellDays: 0 }).evasionScore;
  assert.equal(free - paid, DWELL_PENALTY);
});

test('aborting keeps what you have but scores it as unfinished', () => {
  const ops = redOpsFor('aws-key-leak');
  let run = playStage(startRun(), ops, quietest(ops.stages[0]).id);
  run = abortRun(run);
  const result = scoreRun(ops, run);
  assert.equal(result.outcome, 'aborted');
  assert.equal(result.notReached.length, ops.stages.length - 1);
  const full = scoreRun(ops, play(ops, quietest));
  assert.ok(result.evasionScore < full.evasionScore, 'finishing has to pay more than quitting');
});

test('a finished run is never touched by later calls', () => {
  const ops = redOpsFor('aws-key-leak');
  const done = play(ops, quietest);
  assert.equal(playStage(done, ops, ops.stages[0].choices[0].id), done);
  assert.equal(abortRun(done), done);
});

test('an unknown choice id changes nothing', () => {
  const ops = redOpsFor('aws-key-leak');
  const run = startRun();
  assert.equal(playStage(run, ops, 'not-a-choice'), run);
});

test('the run is deterministic and its result fits what the debrief reads', () => {
  const ops = redOpsFor('phishing-bec-ambiguous');
  const a = scoreRun(ops, play(ops, (s) => s.choices[1]));
  const b = scoreRun(ops, play(ops, (s) => s.choices[1]));
  assert.deepEqual(a, b);
  for (const key of ['evasionScore', 'breakdown', 'matchesCanonical', 'outcome', 'detections']) {
    assert.ok(key in a, key);
  }
  for (const row of a.breakdown) {
    for (const key of ['stageLabel', 'choiceLabel', 'stealth', 'tactic', 'tacticDetectionPct', 'note', 'canonical', 'caught']) {
      assert.ok(key in row, key);
    }
  }
  assert.ok(a.evasionScore >= 0 && a.evasionScore <= 100);
});

test('the canonical path is caught at least once, which is what really happened', () => {
  for (const [id, ops] of Object.entries(RED_OPS)) {
    const run = play(ops, (s) => s.choices.find((c) => c.canonical));
    assert.ok(run.picks.some((p) => p.caught), `${id}: the real incident was detected`);
  }
});
