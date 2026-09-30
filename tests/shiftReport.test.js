// The shift report card: it gathers what the grader, the progress engine and the
// handoff builder already know, so these tests check the gathering (counts,
// skill verdicts, lean, handoff, empty and partial shifts), that the report
// survives storage, and that its text never prints "undefined" or "NaN".

import test from 'node:test';
import assert from 'node:assert/strict';

import { SCENARIOS } from '../src/data/scenarios/index.js';
import { EGGS } from '../src/data/easterEggs.js';
import { RED_OPS } from '../src/data/redops.js';
import { scoreCase } from '../src/engine/scoring.js';
import { emptyProgress } from '../src/engine/progress.js';
import { emptyRedProgress } from '../src/engine/redProgress.js';
import { buildBoards } from '../src/engine/leaderboard.js';
import {
  buildShiftReport, escalationLabel, formatReportText, standingFromBoards,
} from '../src/engine/shiftReport.js';
import { REPORT_KEY, clearLastReport, loadLastReport, saveLastReport } from '../src/engine/shiftReportStore.js';

const NOW = Date.UTC(2026, 8, 29, 20, 0, 0);
const HEADER = { label: 'Tuesday 29 September 2026', window: 'Swing shift · 15:00–23:00' };

const byEscalation = (value) => SCENARIOS.find((s) => s.truth.escalation === value);
const ir = byEscalation('escalate_ir');
const tier2 = byEscalation('escalate_tier2');
const benign = byEscalation('close_no_escalation');

// A closed case file, graded by the real grader. `escalation` overrides the
// call so a case can be under- or over-escalated on purpose.
function closedCase(scenario, { escalation, elapsedMs = 8 * 60_000, actions } = {}) {
  const truth = scenario.truth;
  const submission = {
    classification: truth.classification,
    severity: truth.severity,
    mitreTechnique: truth.mitreTechnique,
    escalation: escalation ?? truth.escalation,
    summary: '',
    remediation: '',
  };
  const score = scoreCase(scenario, submission, {
    searchesRun: [...(truth.requiredSearches || [])],
    intelChecked: [...(truth.requiredIntel || [])],
    actionsTaken: actions ?? [...(truth.requiredActions || [])],
    noiseSearches: 0,
    assisted: false,
    elapsedMs,
  });
  return { startedAt: NOW - elapsedMs, searches: [], intel: [], actions: [], timeline: [], result: { submission, score, attempt: 1 } };
}

const build = (scenarios, cases, extra = {}) => buildShiftReport({ scenarios, cases, header: HEADER, now: NOW, ...extra });

test('an empty shift makes a report that says nothing happened, without inventing numbers', () => {
  const scenarios = SCENARIOS.slice(0, 7);
  const report = build(scenarios, {});
  assert.equal(report.counts.total, 7);
  assert.equal(report.counts.closed, 0);
  assert.equal(report.counts.open, 7);
  assert.equal(report.avgScore, null);
  assert.equal(report.mttrMs, null);
  assert.equal(report.teamLead, null);
  assert.equal(report.lean.direction, null);
  assert.ok(report.skills.every((s) => s.verdict === 'n/a'));
  assert.ok(report.cases.every((c) => c.status === 'new' && c.score === null));
  assert.equal(report.handoff.length, 0);
  const text = formatReportText(report);
  assert.ok(!/undefined|NaN|null/.test(text), text);
});

test('closed cases give counts, an average and a mean time to decision', () => {
  const scenarios = [ir, tier2, benign];
  const cases = {
    [ir.id]: closedCase(ir, { elapsedMs: 6 * 60_000 }),
    [tier2.id]: closedCase(tier2, { elapsedMs: 10 * 60_000 }),
    [benign.id]: closedCase(benign, { elapsedMs: 5 * 60_000 }),
  };
  const report = build(scenarios, cases);
  assert.equal(report.counts.closed, 3);
  assert.equal(report.counts.open, 0);
  const scores = report.cases.map((c) => c.score);
  assert.equal(report.avgScore, Math.round(scores.reduce((n, v) => n + v, 0) / 3));
  assert.equal(report.mttrMs, Math.round((6 + 10 + 5) / 3 * 60_000));
  assert.ok(report.teamLead && report.teamLead.message);
});

test('each case row carries the calls you made and whether the clock was met', () => {
  const report = build([ir], { [ir.id]: closedCase(ir, { elapsedMs: 3 * 60_000 }) });
  const row = report.cases[0];
  assert.equal(row.status, 'closed');
  assert.equal(row.reportedSeverity, ir.alert.reportedSeverity);
  assert.equal(row.yourSeverity, ir.truth.severity);
  assert.equal(row.escalation, 'correct');
  assert.equal(row.escalatedTo, escalationLabel(ir.truth.escalation));
  assert.equal(row.slaMet, true);
  const slow = build([ir], { [ir.id]: closedCase(ir, { elapsedMs: (ir.alert.slaMinutes + 5) * 60_000 }) }).cases[0];
  assert.equal(slow.slaMet, false);
});

test('under-escalating shows up as a lean and a slipped escalation skill', () => {
  const cases = {
    [ir.id]: closedCase(ir, { escalation: 'close_no_escalation' }),
    [tier2.id]: closedCase(tier2, { escalation: 'close_no_escalation' }),
    [benign.id]: closedCase(benign),
  };
  const report = build([ir, tier2, benign], cases);
  assert.equal(report.lean.under, 2);
  assert.equal(report.lean.over, 0);
  assert.equal(report.lean.direction, 'under');
  const escalation = report.skills.find((s) => s.id === 'escalation');
  assert.equal(escalation.attempts, 3);
  assert.equal(escalation.correct, 1);
  assert.equal(escalation.verdict, 'slipped');
});

test('over-escalating is a lean in the other direction', () => {
  const report = build([benign], { [benign.id]: closedCase(benign, { escalation: 'escalate_ir' }) });
  assert.equal(report.lean.over, 1);
  assert.equal(report.lean.direction, 'over');
  assert.equal(report.cases[0].escalation, 'over');
});

test('skills that every closed case got right are held, and untested skills are n/a', () => {
  const report = build([ir], { [ir.id]: closedCase(ir) });
  const classification = report.skills.find((s) => s.id === 'classification');
  assert.equal(classification.verdict, 'held');
  assert.equal(classification.correct, classification.attempts);
  for (const skill of report.skills) {
    assert.ok(['held', 'slipped', 'n/a'].includes(skill.verdict), skill.id);
    assert.ok(skill.correct <= skill.attempts, skill.id);
  }
});

test('harmful actions are counted from the cases that took them', () => {
  const harmful = ir.actions.find((a) => a.verdict === 'harmful');
  const report = build([ir], { [ir.id]: closedCase(ir, { actions: [...ir.truth.requiredActions, harmful.id] }) });
  assert.equal(report.harmfulActions, 1);
  assert.equal(report.cases[0].harmful, 1);
  assert.equal(report.cases[0].resolved, false, 'a damaging response is never a resolved case');
});

test('open work is listed as open and handed off; escalated cases are handed off too', () => {
  const started = { startedAt: NOW - 60_000, searches: [{ query: 'x' }], intel: [], actions: [], timeline: [] };
  const cases = {
    [ir.id]: closedCase(ir),
    [tier2.id]: started,
  };
  const report = build([ir, tier2, benign], cases);
  assert.deepEqual(report.cases.map((c) => c.status), ['closed', 'in_progress', 'new']);
  assert.equal(report.counts.open, 2);
  const refs = report.handoff.map((h) => h.ref);
  assert.ok(refs.includes(ir.alert.ref), 'an escalated case is handed to IR');
  assert.ok(refs.includes(tier2.alert.ref), 'a case still in progress is handed to the next shift');
  assert.ok(!refs.includes(benign.alert.ref), 'an untouched case needs no handoff');
});

test('the practice-next line and standing pass straight through', () => {
  const nextFocus = { label: 'Escalation', summary: 'Escalation: 3 of your 5 scored cases missed.' };
  const boards = buildBoards({
    progress: emptyProgress(), redProgress: emptyRedProgress(), found: [], fastRuns: [],
    library: SCENARIOS, operationIds: Object.keys(RED_OPS), secretsTotal: EGGS.length,
  });
  const standing = standingFromBoards(boards);
  const report = build([ir], { [ir.id]: closedCase(ir) }, { nextFocus, standing });
  assert.deepEqual(report.practiceNext, nextFocus);
  for (const key of ['blue', 'red', 'fast', 'secrets']) {
    assert.ok(standing[key].label && standing[key].rank >= 1 && standing[key].of === boards.blue.length, key);
  }
  const text = formatReportText(report);
  assert.match(text, /Practice next: Escalation/);
  assert.match(text, /Blue: Trainee, #\d+ of 11/);
  assert.match(text, /Fast Triage: No runs yet/);
});

test('the report is reproducible and survives a JSON round trip unchanged', () => {
  const cases = { [ir.id]: closedCase(ir), [tier2.id]: closedCase(tier2, { escalation: 'close_no_escalation' }) };
  const a = build([ir, tier2, benign], cases);
  const b = build([ir, tier2, benign], cases);
  assert.deepEqual(a, b);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
});

test('the report text lists every case and never prints undefined, NaN or null', () => {
  const cases = { [ir.id]: closedCase(ir), [tier2.id]: closedCase(tier2, { escalation: 'close_no_escalation' }) };
  const report = build([ir, tier2, benign], cases);
  const text = formatReportText(report);
  for (const c of report.cases) assert.ok(text.includes(c.ref), c.ref);
  assert.ok(!/undefined|NaN|null/.test(text), text);
  assert.match(text, /Escalation lean: you under-escalated 1 of 2/);
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

test('the last report round-trips through storage and can be cleared', () => {
  withFakeStorage((data) => {
    assert.equal(loadLastReport(), null);
    const report = build([ir], { [ir.id]: closedCase(ir) });
    saveLastReport(report);
    assert.deepEqual(loadLastReport(), report);
    clearLastReport();
    assert.equal(loadLastReport(), null);
    assert.ok(!data.has(REPORT_KEY));
  });
});

test('corrupt or foreign storage loads as no report', () => {
  withFakeStorage((data) => {
    data.set(REPORT_KEY, '{nope');
    assert.equal(loadLastReport(), null);
    data.set(REPORT_KEY, JSON.stringify({ version: 2, cases: [], skills: [], counts: {} }));
    assert.equal(loadLastReport(), null, 'an unknown version is not trusted');
    data.set(REPORT_KEY, JSON.stringify({ hello: 'world' }));
    assert.equal(loadLastReport(), null);
  });
});

test('the team lead note admits when part of the queue was never worked', () => {
  const partial = build([ir, tier2, benign], { [ir.id]: closedCase(ir) });
  assert.match(partial.teamLead.message, /2 of 3 alerts were still open, and they carry into the next shift\./);
  const full = build([ir], { [ir.id]: closedCase(ir) });
  assert.ok(!/still open/.test(full.teamLead.message), 'a fully closed shift gets the plain note');
});
