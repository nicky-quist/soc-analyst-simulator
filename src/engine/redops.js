// Red Ops scoring

import { TACTIC_COVERAGE } from '../data/estate.js';
import { queueOrder } from './deal.js';

const coverageByTactic = Object.fromEntries(TACTIC_COVERAGE.map((t) => [t.tactic, t.pct]));

export function tacticDetectionPct(tactic) {
  return coverageByTactic[tactic] ?? null;
}

// Score a run
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
    // Matches the real incident?
    matchesCanonical: canonicalCount === breakdown.length,
  };
}

// Add a Red Ops target to the queue
export function withRedOpsTarget(hand, scenarioId, library) {
  if (!scenarioId || hand.some((s) => s.id === scenarioId)) return hand;
  const scenario = library.find((s) => s.id === scenarioId);
  if (!scenario) return hand;
  return [...hand, scenario].sort(queueOrder);
}

// Red vs Blue comparison
export function compareRedBlue(evasionScore, blueScore) {
  if (evasionScore > blueScore) return 'red';
  if (blueScore > evasionScore) return 'blue';
  return 'tie';
}
