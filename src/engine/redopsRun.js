// The interactive Red Ops operation: a small state machine the view drives one
// decision at a time, so the attacker watches the SOC react instead of being
// told at the end. Still no dice — whether a move is caught is a comparison
// between how quiet it was and how much of that tactic this bank really
// detects (the same coverage numbers the Dashboard shows).
//
//   caught    = effectiveStealth < DETECTION_FACTOR × that tactic's coverage %
//   alertness = how many of your moves have been caught so far. Each level
//               makes every later move louder (PENALTY_PER_LEVEL); the third
//               burns the operation.
//   go dark   = once per run, lie low for a day: the SOC loses a level of
//               alertness, at a flat cost to the score for the dwell time.
//
// Kept apart from engine/redops.js so the original one-shot scorer and its
// tests stay exactly as they were.

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

// Plays one stage. Returns the next run, or the same run if nothing applies.
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

// Same fields the debrief and the Red-vs-Blue comparison already read
// (evasionScore, breakdown, matchesCanonical), plus how the run ended. The score
// is the average effective stealth of the stages you played, scaled by how far
// you got, minus a flat cost per day spent lying low: finishing matters, and so
// does not getting caught on the way.
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
