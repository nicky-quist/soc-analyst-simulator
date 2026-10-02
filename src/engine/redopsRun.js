// Live Red Ops run

import { tacticDetectionPct } from './redops.js';

export const DETECTION_FACTOR = 0.6;
export const PENALTY_PER_LEVEL = 8;
export const BURN_LEVEL = 3;
export const DARK_LIMIT = 1;
export const DWELL_PENALTY = 5;

export const ALERTNESS_LABELS = ['Unaware', 'Alert queued', 'Analyst investigating', 'Burned'];

const ALERT_RESPONSE = [
  '',
  'Tier 1 has it in the queue. Your next moves will be looked at harder.',
  'An analyst is investigating your foothold. Every later move is louder.',
  'The host is isolated and your access is gone. The operation is burned.',
];

export function detectionThreshold(tactic) {
  const pct = tacticDetectionPct(tactic);
  return pct === null ? 0 : Math.round(pct * DETECTION_FACTOR);
}

export function startRun() {
  return { picks: [], detections: 0, dwellDays: 0, darkUsed: 0, log: [], status: 'active' };
}

export function currentStageIndex(run) {
  return run.picks.length;
}

export function canGoDark(run) {
  return run.status === 'active' && run.darkUsed < DARK_LIMIT && run.detections > 0;
}

export function goDark(run) {
  if (!canGoDark(run)) return run;
  const level = run.detections - 1;
  return {
    ...run,
    detections: level,
    dwellDays: run.dwellDays + 1,
    darkUsed: run.darkUsed + 1,
    log: [...run.log, {
      kind: 'dark', level,
      text: `You go quiet for a day. The SOC loses the thread: ${ALERTNESS_LABELS[level].toLowerCase()}.`,
    }],
  };
}

// Play a stage
export function playStage(run, ops, choiceId) {
  if (run.status !== 'active') return run;
  const stage = ops.stages[currentStageIndex(run)];
  const choice = stage?.choices.find((c) => c.id === choiceId);
  if (!choice) return run;

  const effectiveStealth = Math.max(0, choice.stealth - run.detections * PENALTY_PER_LEVEL);
  const threshold = detectionThreshold(stage.tactic);
  const caught = effectiveStealth < threshold;
  const detections = run.detections + (caught ? 1 : 0);
  const pct = tacticDetectionPct(stage.tactic);

  const pick = {
    stageId: stage.id, stageLabel: stage.label, tactic: stage.tactic,
    choiceId: choice.id, choiceLabel: choice.label, note: choice.note,
    canonical: !!choice.canonical, stealth: choice.stealth,
    penalty: choice.stealth - effectiveStealth, effectiveStealth,
    threshold, caught, tacticDetectionPct: pct,
    alertnessBefore: run.detections, alertnessAfter: detections,
  };

  const burned = detections >= BURN_LEVEL;
  const finished = currentStageIndex(run) + 1 >= ops.stages.length;
  const text = caught
    ? `ALERT: ${stage.tactic} activity matched a detection (${pct}% of it is caught here). ${ALERT_RESPONSE[Math.min(detections, BURN_LEVEL)]}`
    : `No alert. The ${stage.tactic.toLowerCase()} telemetry was collected but nothing fired on a move this quiet.`;

  return {
    ...run,
    picks: [...run.picks, pick],
    detections,
    log: [...run.log, { kind: caught ? 'alert' : 'quiet', level: detections, text, stageLabel: stage.label }],
    status: burned ? 'burned' : finished ? 'complete' : 'active',
  };
}

export function abortRun(run) {
  return run.status === 'active' ? { ...run, status: 'aborted' } : run;
}

// Score a run
export function scoreRun(ops, run) {
  const total = ops.stages.length;
  const played = run.picks.length;
  const avg = played ? run.picks.reduce((n, p) => n + p.effectiveStealth, 0) / played : 0;
  const raw = avg * (played / total) - run.dwellDays * DWELL_PENALTY;

  return {
    evasionScore: Math.max(0, Math.min(100, Math.round(raw))),
    outcome: run.status === 'active' ? 'aborted' : run.status,
    breakdown: run.picks,
    notReached: ops.stages.slice(played).map((s) => s.label),
    detections: run.detections,
    dwellDays: run.dwellDays,
    matchesCanonical: run.status === 'complete' && run.picks.every((p) => p.canonical),
  };
}
