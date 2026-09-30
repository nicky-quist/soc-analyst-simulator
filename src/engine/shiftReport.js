// The end-of-shift report card: one page that says how the shift actually went.
// Pure functions. Hand them the same records the console already keeps and get
// back a plain object the report view renders, prints, and copies.
//
// It grades nothing new. Every number here is something the case grader, the
// progress engine or the handoff builder already computed; this only gathers
// them for one shift and puts them side by side.

import { caseStatus, shiftCompliance } from './case.js';
import { buildShiftHandoff } from './handoff.js';
import { generateShiftSummary } from './personas.js';
import { SKILLS } from './progress.js';
import { isResolvedCorrectly, overEscalated, underEscalated } from './scoring.js';

const ESCALATION_LABEL = {
  escalate_ir: 'Incident Response',
  escalate_tier2: 'Tier 2',
  close_no_escalation: 'Closed, benign',
  close_false_positive: 'Closed, false positive',
};

export function escalationLabel(value) {
  return ESCALATION_LABEL[value] || 'Not decided';
}

function caseRow(scenario, caseFile) {
  const status = caseStatus(caseFile);
  const base = {
    scenarioId: scenario.id,
    ref: scenario.alert.ref,
    label: scenario.queueLabel,
    status,
    reportedSeverity: scenario.alert.reportedSeverity,
    slaMinutes: scenario.alert.slaMinutes,
  };
  if (status !== 'closed') return { ...base, score: null };

  const { score, submission } = caseFile.result;
  const elapsedMs = score.elapsedMs ?? null;
  return {
    ...base,
    score: score.overallScore,
    resolved: isResolvedCorrectly(score),
    yourSeverity: submission.severity || null,
    trueSeverity: scenario.truth.severity,
    severityCorrect: score.severityCorrect,
    classificationCorrect: score.classificationCorrect,
    escalationCorrect: score.escalationCorrect,
    escalation: underEscalated(scenario, submission) ? 'under' : overEscalated(scenario, submission) ? 'over' : 'correct',
    escalatedTo: escalationLabel(submission.escalation),
    elapsedMs,
    slaMet: elapsedMs == null ? null : elapsedMs <= scenario.alert.slaMinutes * 60_000,
    assisted: !!score.assisted,
    harmful: score.response.harmful.length,
  };
}

// This shift's own rate on each skill, from the cases closed in it. A skill the
// closed cases never tested is 'n/a', which is not the same as missing it.
function shiftSkills(results) {
  return SKILLS.map((skill) => {
    const outcomes = results.map((r) => skill.test(r.score)).filter((v) => v !== null && v !== undefined);
    const correct = outcomes.filter(Boolean).length;
    const attempts = outcomes.length;
    return {
      id: skill.id,
      label: skill.label,
      correct,
      attempts,
      verdict: attempts === 0 ? 'n/a' : correct === attempts ? 'held' : 'slipped',
    };
  });
}

// scenarios: the queue as dealt. cases: shift.cases. header: { label, window }.
// nextFocus: planFocus() for the next shift, or null. standing: the leaderboard
// ranks at this moment, or null. now: passed in so the result is reproducible.
export function buildShiftReport({ scenarios, cases, header, nextFocus = null, standing = null, now = Date.now() }) {
  const rows = scenarios.map((s) => caseRow(s, cases[s.id]));
  const closed = rows.filter((r) => r.status === 'closed');
  const results = scenarios.map((s) => cases[s.id]?.result).filter(Boolean);
  const summary = generateShiftSummary(results);

  const sla = shiftCompliance(scenarios, cases, now);
  const elapsed = closed.map((r) => r.elapsedMs).filter((v) => v != null);
  const under = closed.filter((r) => r.escalation === 'under').length;
  const over = closed.filter((r) => r.escalation === 'over').length;

  return {
    version: 1,
    endedAt: now,
    title: header?.label || 'Shift report',
    window: header?.window || '',
    counts: {
      total: rows.length,
      closed: closed.length,
      open: rows.length - closed.length,
      resolved: closed.filter((r) => r.resolved).length,
    },
    avgScore: closed.length ? Math.round(closed.reduce((n, r) => n + r.score, 0) / closed.length) : null,
    mttrMs: elapsed.length ? Math.round(elapsed.reduce((n, v) => n + v, 0) / elapsed.length) : null,
    sla,
    assisted: closed.filter((r) => r.assisted).length,
    harmfulActions: closed.reduce((n, r) => n + r.harmful, 0),
    cases: rows,
    skills: shiftSkills(results),
    lean: {
      under, over, total: closed.length,
      direction: under > over ? 'under' : over > under ? 'over' : null,
    },
    handoff: buildShiftHandoff(scenarios, cases).map((n) => ({
      ref: n.ref, label: n.label, status: n.status, escalatedTo: n.escalatedTo, stillNeeded: n.stillNeeded.length,
    })),
    // The team lead reads only the cases that were closed, so when some are still
    // open the note says so instead of praising a shift that is mostly untouched.
    teamLead: summary ? {
      from: summary.persona.from,
      role: summary.persona.role,
      message: rows.length > closed.length
        ? `${summary.persona.message} ${rows.length - closed.length} of ${rows.length} alerts were still open, and they carry into the next shift.`
        : summary.persona.message,
    } : null,
    practiceNext: nextFocus ? { label: nextFocus.label, summary: nextFocus.summary } : null,
    standing,
  };
}

// The four ranks, as the report stores them: { blue: { label, rank, of }, ... }.
export function standingFromBoards(boards) {
  const pick = (rows, label) => {
    const you = rows.find((r) => r.isYou);
    return { label: label(you), rank: you.rank, of: rows.length };
  };
  return {
    blue: pick(boards.blue, (y) => y.rankLabel),
    red: pick(boards.red, (y) => y.rankLabel),
    fast: pick(boards.fast, (y) => (y.best === null ? 'No runs yet' : `Best ${y.best}`)),
    secrets: pick(boards.secrets, (y) => `${y.count} of ${boards.totals.secrets} found`),
  };
}

const minutes = (ms) => (ms == null ? 'n/a' : `${Math.max(0, Math.round(ms / 60_000))}m`);

// Plain text for a clipboard or a message.
export function formatReportText(report) {
  const lines = [
    `Shift report: ${report.title}${report.window ? `, ${report.window}` : ''}`,
    '',
    `Cases: ${report.counts.closed} of ${report.counts.total} closed, ${report.counts.resolved} resolved correctly`
      + (report.avgScore !== null ? `, average ${report.avgScore}` : ''),
    `Time to decision: ${minutes(report.mttrMs)} average`
      + (report.sla.pct !== null ? ` · SLA ${report.sla.pct}% (${report.sla.onTime} on time, ${report.sla.breached} breached)` : ''),
    `Harmful actions: ${report.harmfulActions}` + (report.assisted ? ` · assisted cases: ${report.assisted}` : ''),
    '',
    'Cases',
    ...report.cases.map((c) => (c.status === 'closed'
      ? `- ${c.ref} ${c.label}: ${c.score}/100, ${c.escalatedTo}${c.resolved ? '' : ' (needs improvement)'}`
      : `- ${c.ref} ${c.label}: still open`)),
    '',
    'Skills this shift',
    ...report.skills.filter((s) => s.verdict !== 'n/a').map((s) => `- ${s.label}: ${s.correct} of ${s.attempts} (${s.verdict})`),
  ];
  if (report.lean.direction) {
    lines.push('', `Escalation lean: you ${report.lean.direction}-escalated ${report.lean[report.lean.direction]} of ${report.lean.total} closed cases.`);
  }
  if (report.handoff.length) {
    lines.push('', 'Handed off', ...report.handoff.map((h) => `- ${h.ref}: ${h.status}`));
  }
  if (report.practiceNext) lines.push('', `Practice next: ${report.practiceNext.summary}`);
  if (report.standing) {
    const s = report.standing;
    lines.push('', 'Standing',
      `Blue: ${s.blue.label}, #${s.blue.rank} of ${s.blue.of}`,
      `Red: ${s.red.label}, #${s.red.rank} of ${s.red.of}`,
      `Fast Triage: ${s.fast.label}, #${s.fast.rank} of ${s.fast.of}`,
      `Secrets: ${s.secrets.label}, #${s.secrets.rank} of ${s.secrets.of}`);
  }
  return lines.join('\n');
}
