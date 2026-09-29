// Scores a Red Ops run: one choice per stage, averaged into a single evasion
// score. Deterministic, same as every other grade in this project — no dice
// roll, your choices are your choices.
//
// Detection percentages come from estate.js's TACTIC_COVERAGE live, not a
// copy baked into the red-ops data — if the Dashboard's numbers ever change,
// the Red Ops debrief stays in sync with them automatically instead of
// quietly drifting into a different story than the one the SOC side tells.

import { TACTIC_COVERAGE } from '../data/estate.js';
import { queueOrder } from './deal.js';

const coverageByTactic = Object.fromEntries(TACTIC_COVERAGE.map((t) => [t.tactic, t.pct]));

export function tacticDetectionPct(tactic) {
  return coverageByTactic[tactic] ?? null;
}

// choiceIds: array the same length as ops.stages, one chosen choice id per
// stage, in stage order.
export function scoreRedRun(ops, choiceIds) {
  const breakdown = ops.stages.map((stage, i) => {
    const choice = stage.choices.find((c) => c.id === choiceIds[i]);
    return {
      stageId: stage.id,
      stageLabel: stage.label,
      tactic: stage.tactic,
      choiceId: choice?.id ?? null,
      choiceLabel: choice?.label ?? null,
      stealth: choice?.stealth ?? 0,
      canonical: !!choice?.canonical,
      note: choice?.note ?? '',
      tacticDetectionPct: tacticDetectionPct(stage.tactic),
    };
  });

  const evasionScore = breakdown.length
    ? Math.round(breakdown.reduce((sum, b) => sum + b.stealth, 0) / breakdown.length)
    : 0;

  const canonicalCount = breakdown.filter((b) => b.canonical).length;

  return {
    evasionScore,
    breakdown,
    // How closely this run matches what actually happened in the real
    // incident — not scored against it, just named, because playing the
    // canonical path exactly is neither the goal nor a mistake.
    matchesCanonical: canonicalCount === breakdown.length,
  };
}

// "Defend this incident now" has to work even when the scenario you just ran
// as the attacker wasn't dealt into this shift's hand — so it gets added,
// sorted by the same rule as everything else in the queue, the same pattern
// War Room already uses for its own mid-shift injection.
export function withRedOpsTarget(hand, scenarioId, library) {
  if (!scenarioId || hand.some((s) => s.id === scenarioId)) return hand;
  const scenario = library.find((s) => s.id === scenarioId);
  if (!scenario) return hand;
  return [...hand, scenario].sort(queueOrder);
}

// Once a Blue investigation of the same scenario closes, the two scores get
// compared. Framed as a contest, not a grade: an evasion score above the
// analyst's defense score is a real finding about a real gap.
export function compareRedBlue(evasionScore, blueScore) {
  if (evasionScore > blueScore) return 'red';
  if (blueScore > evasionScore) return 'blue';
  return 'tie';
}
