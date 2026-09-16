// Cross-shift progress and the adaptive deal.
//
// Two properties matter more than the rest. The record has to be honest (only
// first, unassisted attempts; no weakness named from one bad case), and the
// adaptive deal must never break what makes a shift a shift: the mix quotas,
// and a saved shift re-dealing to the same hand after a reload.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SCENARIOS } from '../src/data/scenarios/index.js';
import { HAND_SIZE, dealShift } from '../src/engine/deal.js';
import { scoreCase } from '../src/engine/scoring.js';
import {
  MIN_ATTEMPTS, MAX_WEIGHT, HISTORY_LIMIT, SKILLS,
  buildRecord, emptyProgress, escalationTendency, planFocus, recordCase,
  skillSummary, smoothedRate, weakestSkill,
} from '../src/engine/progress.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => Date.UTC(2026, 0, 1) + i * 9 * 3600_000);

// A submission that makes every *call* correctly. The report text is left empty
// on purpose; the tests below that care about the report say so.
function correctCalls(scenario) {
  const { truth } = scenario;
  return {
    classification: truth.classification,
    escalation: truth.escalation,
    severity: truth.severity,
    mitreTechnique: truth.mitreTechnique,
    summary: '',
    remediation: '',
  };
}

function closeCase(scenario, submission, { attempt = 1, assisted = false, shift = 1, deal = 0, caseFile = {} } = {}) {
  const score = scoreCase(scenario, submission, { assisted, ...caseFile });
  return buildRecord({ scenario, submission, score, attempt, closedAt: shift * 1000, shiftStartedAt: shift, deal });
}

// Fabricated outcomes for testing the statistics without scoring real cases.
function outcomeRecord(i, outcomes, escalation = 'correct', scenarioId = SCENARIOS[i % SCENARIOS.length].id) {
  const all = Object.fromEntries(SKILLS.map((s) => [s.id, true]));
  return { key: `k${i}`, scenarioId, attempt: 1, assisted: false, overallScore: 80, resolved: true, escalation, outcomes: { ...all, ...outcomes } };
}

// ── recording ───────────────────────────────────────────────────────────────

test('a closed case is broken into the individual calls the grader makes', () => {
  const scenario = SCENARIOS[0];
  const record = closeCase(scenario, correctCalls(scenario));
  assert.equal(record.outcomes.classification, true);
  assert.equal(record.outcomes.escalation, true);
  assert.equal(record.outcomes.severity, true);
  assert.equal(record.outcomes.mitre, true);
  assert.equal(record.escalation, 'correct');
  for (const skill of SKILLS) assert.ok(skill.id in record.outcomes, `missing skill ${skill.id}`);
});

test('escalation direction is recorded, not just right or wrong', () => {
  const ir = SCENARIOS.find((s) => s.truth.escalation === 'escalate_ir');
  const closable = SCENARIOS.find((s) => s.truth.escalation.startsWith('close_'));
  const under = closeCase(ir, { ...correctCalls(ir), escalation: 'close_no_escalation' });
  const over = closeCase(closable, { ...correctCalls(closable), escalation: 'escalate_ir' });
  assert.equal(under.escalation, 'under');
  assert.equal(under.outcomes.escalation, false);
  assert.equal(over.escalation, 'over');
});

test('only first attempts count: a retry comes after the debrief showed the answer', () => {
  const scenario = SCENARIOS[1];
  const { progress, recorded, reason } = recordCase(emptyProgress(), closeCase(scenario, correctCalls(scenario), { attempt: 2 }));
  assert.equal(recorded, false);
  assert.equal(reason, 'retry');
  assert.equal(progress.history.length, 0);
});

test('a case worked with Learn mode open does not count', () => {
  const scenario = SCENARIOS[2];
  const { recorded, reason } = recordCase(emptyProgress(), closeCase(scenario, correctCalls(scenario), { assisted: true }));
  assert.equal(recorded, false);
  assert.equal(reason, 'assisted');
});

test('the same case in the same shift is recorded once', () => {
  const scenario = SCENARIOS[3];
  const record = closeCase(scenario, correctCalls(scenario));
  const once = recordCase(emptyProgress(), record).progress;
  const twice = recordCase(once, record);
  assert.equal(twice.recorded, false);
  assert.equal(twice.progress.history.length, 1);
});

test('the same scenario in a different shift is a new record', () => {
  const scenario = SCENARIOS[3];
  let progress = recordCase(emptyProgress(), closeCase(scenario, correctCalls(scenario), { shift: 1 })).progress;
  progress = recordCase(progress, closeCase(scenario, correctCalls(scenario), { shift: 2 })).progress;
  assert.equal(progress.history.length, 2);
});

test('history is capped so storage cannot grow without bound', () => {
  let progress = emptyProgress();
  for (let i = 0; i < HISTORY_LIMIT + 25; i += 1) progress = recordCase(progress, outcomeRecord(i, {})).progress;
  assert.equal(progress.history.length, HISTORY_LIMIT);
  assert.equal(progress.history.at(-1).key, `k${HISTORY_LIMIT + 24}`, 'the newest records are the ones kept');
});

// ── statistics ──────────────────────────────────────────────────────────────

test('smoothing keeps one miss from reading as a 0% skill', () => {
  assert.equal(smoothedRate(0, 1), 1 / 3);
  assert.equal(smoothedRate(0, 0), 0.5);
});

test('a skill that had nothing to test is skipped, not counted as a miss', () => {
  const history = [outcomeRecord(0, { sla: null }), outcomeRecord(1, { sla: null })];
  const sla = skillSummary(history).find((s) => s.id === 'sla');
  assert.equal(sla.attempts, 0);
  assert.equal(sla.rate, null);
});

test('no weakness is named before a skill has enough attempts', () => {
  const history = Array.from({ length: MIN_ATTEMPTS - 1 }, (_, i) => outcomeRecord(i, { severity: false }));
  assert.equal(weakestSkill(skillSummary(history)), null);
});

test('the weakest skill is the one missed most, once it has enough attempts', () => {
  const history = Array.from({ length: 8 }, (_, i) =>
    outcomeRecord(i, { severity: i % 2 === 0, mitre: i % 4 !== 0 })
  );
  const weak = weakestSkill(skillSummary(history));
  assert.equal(weak.id, 'severity');
});

test('an analyst getting everything right has no weakness', () => {
  const history = Array.from({ length: 12 }, (_, i) => outcomeRecord(i, {}));
  assert.equal(weakestSkill(skillSummary(history)), null);
});

test('trend compares recent cases against everything before them', () => {
  const history = [
    ...Array.from({ length: 5 }, (_, i) => outcomeRecord(i, { report: false })),
    ...Array.from({ length: 5 }, (_, i) => outcomeRecord(10 + i, { report: true })),
  ];
  const report = skillSummary(history).find((s) => s.id === 'report');
  assert.equal(report.trend, 1);
});

test('escalation tendency needs a pattern, not a single miss', () => {
  assert.equal(escalationTendency([outcomeRecord(0, {}, 'under')]).direction, null);
  const history = [outcomeRecord(0, {}, 'under'), outcomeRecord(1, {}, 'under'), outcomeRecord(2, {}, 'over')];
  assert.equal(escalationTendency(history).direction, 'under');
});

// ── focus planning ──────────────────────────────────────────────────────────

test('no focus without a weakness', () => {
  assert.equal(planFocus([], SCENARIOS), null);
  assert.equal(planFocus(Array.from({ length: 10 }, (_, i) => outcomeRecord(i, {})), SCENARIOS), null);
});

test('an under-escalator is dealt cases whose alert undersells how serious they are', () => {
  const history = Array.from({ length: 8 }, (_, i) =>
    outcomeRecord(i, { escalation: i % 2 === 0 }, i % 2 === 0 ? 'correct' : 'under', 'vuln-scan-false-positive')
  );
  const focus = planFocus(history, SCENARIOS);
  assert.equal(focus.skill, 'escalation');
  assert.match(focus.summary, /under-escalate/);

  const rank = (sev) => ['INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(sev);
  const understated = SCENARIOS.filter((s) => s.truth.escalation.startsWith('escalate_')
    && rank(s.truth.severity) > rank(s.alert.reportedSeverity));
  const honest = SCENARIOS.filter((s) => s.truth.escalation.startsWith('escalate_')
    && rank(s.truth.severity) <= rank(s.alert.reportedSeverity));
  assert.ok(understated.length && honest.length, 'library should contain both kinds');

  for (const s of understated) {
    assert.ok(focus.weights[s.id] > 1, `${s.id} should be boosted`);
    assert.match(focus.reasons[s.id], /arrives as .* but is .* has to go to/);
  }
  // Needing escalation alone is not a reason: most of the library needs it.
  for (const s of honest) assert.equal(focus.weights[s.id], 1, `${s.id} reports its severity honestly`);

  // The bigger the undersell, the bigger the boost.
  const gap = (s) => rank(s.truth.severity) - rank(s.alert.reportedSeverity);
  const byGap = [...understated].sort((a, b) => gap(a) - gap(b));
  assert.ok(focus.weights[byGap.at(-1).id] > focus.weights[byGap[0].id]);
});

test('an over-escalator is dealt cases that should be closed', () => {
  const history = Array.from({ length: 8 }, (_, i) =>
    outcomeRecord(i, { escalation: i % 2 === 0 }, i % 2 === 0 ? 'correct' : 'over')
  );
  const focus = planFocus(history, SCENARIOS);
  for (const s of SCENARIOS.filter((x) => x.truth.escalation.startsWith('close_'))) {
    assert.ok(focus.weights[s.id] >= 3, `${s.id} should be boosted for an over-escalator`);
  }
});

test('a severity weakness targets alerts whose reported severity is wrong', () => {
  const history = Array.from({ length: 8 }, (_, i) => outcomeRecord(i, { severity: i % 3 === 0 }));
  const focus = planFocus(history, SCENARIOS);
  assert.equal(focus.skill, 'severity');
  const trap = SCENARIOS.find((s) => s.alert.reportedSeverity !== s.truth.severity);
  const honest = SCENARIOS.find((s) => s.alert.reportedSeverity === s.truth.severity);
  assert.ok(trap && honest, 'library should contain both kinds');
  assert.ok(focus.weights[trap.id] > focus.weights[honest.id]);
});

test('a scenario you missed before comes back more often', () => {
  const target = SCENARIOS[5].id;
  const history = Array.from({ length: 8 }, (_, i) =>
    outcomeRecord(i, { mitre: i % 2 === 0 }, 'correct', i % 2 === 0 ? SCENARIOS[0].id : target)
  );
  const focus = planFocus(history, SCENARIOS);
  assert.equal(focus.skill, 'mitre');
  assert.ok(focus.weights[target] > focus.weights[SCENARIOS[0].id]);
  assert.match(focus.reasons[target], /missed/);
});

test('no scenario is ever weighted past the cap', () => {
  const history = Array.from({ length: 20 }, (_, i) =>
    outcomeRecord(i, { escalation: false }, 'under', SCENARIOS.find((s) => s.truth.escalation === 'escalate_ir').id)
  );
  const focus = planFocus(history, SCENARIOS);
  assert.ok(Math.max(...Object.values(focus.weights)) <= MAX_WEIGHT);
});

// ── the adaptive deal ───────────────────────────────────────────────────────

const underEscalatorFocus = () => planFocus(
  Array.from({ length: 8 }, (_, i) => outcomeRecord(i, { escalation: i % 2 === 0 }, i % 2 === 0 ? 'correct' : 'under')),
  SCENARIOS
);

test('without a focus, every hand is identical to the deal before focus existed', () => {
  // Saved shifts are re-dealt from (startedAt, deal) on reload. If the
  // unfocused deal changed at all, a shift in progress when focus shipped would
  // re-deal a different hand and drop the analyst's open cases. The golden file
  // was generated from the pre-focus implementation, so this comparison keeps
  // holding after that implementation is gone from HEAD.
  const golden = JSON.parse(readFileSync(new URL('./fixtures/deal-golden.json', import.meta.url), 'utf8'));
  let compared = 0;
  for (const [key, expected] of Object.entries(golden.hands)) {
    const [seed, variant] = key.split(':').map(Number);
    assert.deepEqual(dealShift(seed, variant).map((s) => s.id), expected, `hand changed for seed ${seed}, variant ${variant}`);
    compared += 1;
  }
  assert.equal(compared, golden.seeds * golden.variants.length, 'golden file is incomplete');
});

test('a focused hand still keeps every mix quota', () => {
  const focus = underEscalatorFocus();
  for (const seed of SEEDS) {
    const hand = dealShift(seed, 0, SCENARIOS, focus);
    const esc = hand.map((s) => s.truth.escalation);
    assert.equal(hand.length, HAND_SIZE);
    assert.equal(new Set(hand.map((s) => s.id)).size, HAND_SIZE);
    assert.ok(esc.some((e) => e.startsWith('close_')), 'a focused shift still has something to close');
    assert.ok(esc.includes('escalate_ir'));
    assert.ok(esc.filter((e) => e === 'escalate_tier2').length >= 2);
    assert.ok(hand.some((s) => s.difficulty === 1));
    assert.ok(hand.some((s) => s.difficulty === 3));
  }
});

test('a focused hand is stable for the same shift, so a reload keeps the queue', () => {
  const focus = underEscalatorFocus();
  const frozen = JSON.parse(JSON.stringify(focus)); // what localStorage hands back
  for (const seed of SEEDS.slice(0, 50)) {
    assert.deepEqual(
      dealShift(seed, 3, SCENARIOS, focus).map((s) => s.id),
      dealShift(seed, 3, SCENARIOS, frozen).map((s) => s.id)
    );
  }
});

test('focus measurably shifts what gets dealt', () => {
  const focus = underEscalatorFocus();
  const boosted = new Set(Object.entries(focus.weights).filter(([, w]) => w >= 3).map(([id]) => id));
  const count = (f) => SEEDS.reduce((n, seed) => n + dealShift(seed, 0, SCENARIOS, f).filter((s) => boosted.has(s.id)).length, 0);
  const plain = count(null);
  const focused = count(focus);
  assert.ok(focused > plain * 1.1, `boosted scenarios dealt ${focused} times focused vs ${plain} unfocused`);
});

test('the adaptive plan is plain data that survives a storage round-trip', () => {
  const focus = underEscalatorFocus();
  assert.deepEqual(JSON.parse(JSON.stringify(focus)), focus);
});

test('recorded cases feed the plan end to end', () => {
  // Real scoring, real records: an analyst who closes every IR case without
  // escalating. They also run no searches and write no report, so those skills
  // are missed on *every* case, and the plan must name the worst of them rather
  // than the escalation miss this test happens to be about.
  const ir = SCENARIOS.filter((s) => s.truth.escalation === 'escalate_ir');
  const others = SCENARIOS.filter((s) => s.truth.escalation !== 'escalate_ir');
  let progress = emptyProgress();
  let shift = 1;
  for (const s of [...ir, ...ir, ...others.slice(0, 3)]) {
    const submission = s.truth.escalation === 'escalate_ir'
      ? { ...correctCalls(s), escalation: 'close_no_escalation' }
      : correctCalls(s);
    progress = recordCase(progress, closeCase(s, submission, { shift: shift++ })).progress;
  }

  const summary = skillSummary(progress.history);
  const escalation = summary.find((s) => s.id === 'escalation');
  assert.equal(escalation.attempts, ir.length * 2 + 3);
  assert.equal(escalation.correct, 3, 'only the non-IR cases were escalated correctly');
  assert.equal(escalationTendency(progress.history).direction, 'under');

  const focus = planFocus(progress.history, SCENARIOS);
  assert.equal(focus.skill, weakestSkill(summary).id, 'the plan targets the weakest recorded skill');
  const worst = Math.min(...summary.filter((s) => s.attempts >= MIN_ATTEMPTS).map((s) => s.smoothed));
  assert.equal(summary.find((s) => s.id === focus.skill).smoothed, worst);
});

// ── does the focus actually do anything? ────────────────────────────────────
// A banner saying "this shift leans toward X" is a promise. Each structural
// rule has to move its most-boosted scenario's chance of being dealt by a
// margin a trainee would feel, not a rounding error. An earlier version boosted
// every scenario that needed escalating, which is 11 of 13, and moved the odds
// by 0.07 while the banner claimed a focus.

function dealRate(focus, id, seeds) {
  return seeds.filter((seed) => dealShift(seed, 0, SCENARIOS, focus).some((s) => s.id === id)).length / seeds.length;
}

const EFFECT_SEEDS = Array.from({ length: 1000 }, (_, i) => Date.UTC(2026, 0, 1) + i * 9 * 3600_000);
// Misses all land on one scenario, which is then left out of the measurement,
// so what's measured is the structural rule and not the missed-before boost.
const MISS_SITE = 'insider-after-hours-ambiguous';

const RULES = {
  'under-escalation': (i) => ({ o: { escalation: i % 2 === 0 }, e: i % 2 ? 'under' : 'correct' }),
  'over-escalation': (i) => ({ o: { escalation: i % 2 === 0 }, e: i % 2 ? 'over' : 'correct' }),
  severity: (i) => ({ o: { severity: i % 2 === 0 }, e: 'correct' }),
  classification: (i) => ({ o: { classification: i % 2 === 0 }, e: 'correct' }),
  response: (i) => ({ o: { response: i % 2 === 0 }, e: 'correct' }),
};

for (const [name, make] of Object.entries(RULES)) {
  test(`${name} focus lifts its most-boosted scenario's deal rate by at least 0.10`, () => {
    const history = Array.from({ length: 8 }, (_, i) => {
      const m = make(i);
      return outcomeRecord(i, m.o, m.e, MISS_SITE);
    });
    const focus = planFocus(history, SCENARIOS);
    const [top] = Object.entries(focus.weights)
      .filter(([id]) => id !== MISS_SITE)
      .sort((a, b) => b[1] - a[1]);
    assert.ok(top[1] > 1, `${name}: no structural boost at all`);
    const lift = dealRate(focus, top[0], EFFECT_SEEDS) - dealRate(null, top[0], EFFECT_SEEDS);
    assert.ok(lift >= 0.10, `${name}: ${top[0]} lifted only ${lift.toFixed(3)}`);
  });
}

test('a structural rule targets a minority of the library, or it is not a focus', () => {
  for (const [name, make] of Object.entries(RULES)) {
    const history = Array.from({ length: 8 }, (_, i) => {
      const m = make(i);
      return outcomeRecord(i, m.o, m.e, MISS_SITE);
    });
    const focus = planFocus(history, SCENARIOS);
    const boosted = Object.entries(focus.weights).filter(([id, w]) => id !== MISS_SITE && w > 1).length;
    assert.ok(boosted <= Math.ceil(SCENARIOS.length * 0.7), `${name} boosts ${boosted} of ${SCENARIOS.length}`);
  }
});
