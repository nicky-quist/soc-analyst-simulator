// What you'd actually attach to a handoff: one note per case that either got
// escalated or is still sitting open, built from data the console already
// has. Deterministic, like the rest of the core loop — no model call, no new
// state, just a read over caseFile and the scenario it belongs to.

import { evaluateInvestigation, evaluateResponse } from './scoring.js';

const ESCALATION_LABEL = { escalate_ir: 'IR', escalate_tier2: 'Tier 2' };

// evaluateInvestigation/evaluateResponse expect the shape scoreCase() builds
// at submit time (searchesRun/actionsTaken), but a still-open case only has
// the live shape (searchKeys/actions) — normalize so the same functions work
// for both a filed report and a case nobody has closed yet.
function normalized(caseFile) {
  return {
    searchesRun: caseFile.searchesRun || caseFile.searchKeys || [],
    intelChecked: caseFile.intelChecked || [],
    actionsTaken: caseFile.actionsTaken || caseFile.actions || [],
  };
}

// A note is worth writing for a case that got handed to someone else
// (escalated) or a case nobody finished — closing it out as a false positive
// or benign activity needs no handoff, the queue already reflects that.
export function needsHandoff(caseFile) {
  if (caseFile.result) return !!ESCALATION_LABEL[caseFile.result.submission.escalation];
  return (caseFile.searches?.length || 0) + (caseFile.intel?.length || 0) + (caseFile.actions?.length || 0) > 0
    || !!caseFile.startedAt;
}

function actionLabel(scenario, id) {
  return (scenario.actions || []).find((a) => a.id === id)?.label || id;
}

export function buildHandoffNote(scenario, caseFile = {}) {
  const closed = !!caseFile.result;
  const submission = caseFile.result?.submission;
  const investigation = closed ? caseFile.result.score.investigation : evaluateInvestigation(scenario, normalized(caseFile));
  const response = closed ? caseFile.result.score.response : evaluateResponse(scenario, normalized(caseFile));

  const escalatedTo = submission ? ESCALATION_LABEL[submission.escalation] : null;
  const status = closed
    ? (escalatedTo ? `Closed — escalated to ${escalatedTo}` : 'Closed')
    : ((caseFile.searches?.length || caseFile.intel?.length || caseFile.actions?.length) ? 'Still open — in progress' : 'Still open — untouched');

  const findings = closed
    ? [submission.classification, submission.severity, submission.mitreTechnique].filter(Boolean).join(' / ') || 'not classified'
    : 'not yet classified';

  const evidence = (caseFile.timeline || [])
    .filter((e) => ['search', 'intel', 'decode'].includes(e.kind))
    .map((e) => e.text);

  const actionsTaken = (caseFile.actions || []).map((id) => actionLabel(scenario, id));

  const stillNeeded = [
    ...(investigation.missed || []),
    ...(response.missing || []).map((label) => `Response: ${label}`),
  ];

  const elapsedMs = closed
    ? caseFile.result.score.elapsedMs
    : (caseFile.startedAt ? Date.now() - caseFile.startedAt : null);

  return {
    scenarioId: scenario.id,
    ref: scenario.alert.ref,
    label: scenario.queueLabel,
    closed,
    escalatedTo,
    status,
    findings,
    summary: submission?.summary || null,
    evidence,
    actionsTaken,
    stillNeeded,
    elapsedMs,
  };
}

export function buildShiftHandoff(scenarios, cases) {
  return scenarios
    .filter((s) => needsHandoff(cases[s.id] || {}))
    .map((s) => buildHandoffNote(s, cases[s.id] || {}));
}

function formatDurationShort(ms) {
  if (ms == null) return 'unknown time';
  const minutes = Math.floor(ms / 60_000);
  return minutes < 1 ? 'under a minute' : `${minutes}m`;
}

// Plain text, meant for a clipboard — the thing you'd actually paste into a
// ticket or a handover channel.
export function formatHandoffText(notes) {
  if (!notes.length) return 'Nothing to hand off — every case this shift was closed out cleanly.';
  return notes.map((n) => {
    const lines = [
      `${n.ref} — ${n.label}`,
      `Status: ${n.status}`,
      `Findings: ${n.findings}`,
      `Time on case: ${formatDurationShort(n.elapsedMs)}`,
    ];
    if (n.summary) lines.push(`Summary: ${n.summary}`);
    if (n.evidence.length) lines.push('Evidence:', ...n.evidence.map((e) => `  - ${e}`));
    if (n.actionsTaken.length) lines.push('Actions taken:', ...n.actionsTaken.map((a) => `  - ${a}`));
    if (n.stillNeeded.length) lines.push('Still needed:', ...n.stillNeeded.map((m) => `  - ${m}`));
    return lines.join('\n');
  }).join('\n\n---\n\n');
}
