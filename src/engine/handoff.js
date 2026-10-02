// Shift handoff notes

import { evaluateInvestigation, evaluateResponse } from './scoring.js';

const ESCALATION_LABEL = { escalate_ir: 'IR', escalate_tier2: 'Tier 2' };

// Normalize live case shape
function normalized(caseFile) {
  return {
    searchesRun: caseFile.searchesRun || caseFile.searchKeys || [],
    intelChecked: caseFile.intelChecked || [],
    actionsTaken: caseFile.actionsTaken || caseFile.actions || [],
  };
}

// Needs a handoff?
export function needsHandoff(caseFile) {
  if (caseFile.result) return !!ESCALATION_LABEL[caseFile.result.submission.escalation];
  return (caseFile.searches?.length || 0) + (caseFile.intel?.length || 0) + (caseFile.actions?.length || 0) > 0;
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

// Plain-text handoff
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
