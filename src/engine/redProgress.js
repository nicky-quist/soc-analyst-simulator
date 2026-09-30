// Red Ops career progression: the attacker-side mirror of the analyst career in
// engine/progress.js, built on the same rules so the two ladders mean the same
// kind of thing.
//
//   Breadth at a standard, not volume. A rank asks for different operations
//   cleared at a real bar, using your best completed run of each, so replaying
//   the easiest operation forever gets you nowhere.
//   A rank is a checkpoint. The highest rank ever earned is stored separately
//   from live history, so "Reset everything" (which wipes the runs) never takes
//   a rank back. It only restarts the criteria for the next one.
//   Finishing counts. Only a run that reaches the objective clears an
//   operation; a burned or aborted run is recorded and shows up in the stats,
//   but it can't promote you.
//
// Pure functions only. Storage lives in redProgressStore.js.

export const RED_BAR = 50;
export const HISTORY_LIMIT = 60;
// The senior rank looks at how you have been finishing lately, not forever.
export const RECENT_RUNS = 6;
export const MAX_RECENT_FAILURES = 2;

export const RED_RANKS = [
  { id: 'recruit', label: 'Recruit' },
  { id: 'operator', label: 'Red Team Operator' },
  { id: 'senior', label: 'Senior Operator — Team Lead ready' },
];

export function emptyRedProgress() {
  return { history: [], checkpointRankIndex: 0 };
}

// result: the object scoreRun() in redopsRun.js returns.
export function buildRedRecord(operationId, result, at = Date.now()) {
  const caught = result.breakdown.filter((b) => b.caught).length;
  return {
    operationId,
    at,
    outcome: result.outcome,
    score: result.evasionScore,
    caught,
    moves: result.breakdown.length,
    dwellDays: result.dwellDays,
    // A ghost run reaches the objective without a single move being caught.
    ghost: result.outcome === 'complete' && caught === 0,
  };
}

export function recordRedRun(progress, record) {
  return { ...progress, history: [...progress.history, record].slice(-HISTORY_LIMIT) };
}

// "Reset everything": the runs go, the rank stays.
export function resetRedProgress(progress) {
  return { history: [], checkpointRankIndex: progress.checkpointRankIndex ?? 0 };
}

// Best score per operation, counting only runs that reached the objective.
export function bestCompleted(history) {
  const best = {};
  for (const r of history) {
    if (r.outcome !== 'complete') continue;
    if (best[r.operationId] === undefined || r.score > best[r.operationId]) best[r.operationId] = r.score;
  }
  return best;
}

export function redStats(history, operationIds) {
  const ids = new Set(operationIds);
  const best = bestCompleted(history);
  const cleared = Object.entries(best).filter(([id, score]) => ids.has(id) && score >= RED_BAR).length;
  return {
    runs: history.length,
    completed: history.filter((r) => r.outcome === 'complete').length,
    burned: history.filter((r) => r.outcome === 'burned').length,
    aborted: history.filter((r) => r.outcome === 'aborted').length,
    ghosts: history.filter((r) => r.ghost).length,
    cleared,
    total: ids.size,
    best,
  };
}

export function redStatus(history, operationIds, checkpointRankIndex = 0) {
  const stats = redStats(history, operationIds);
  const recent = history.slice(-RECENT_RUNS);
  const recentFailures = recent.filter((r) => r.outcome !== 'complete').length;

  const operatorCriteria = [{
    label: `Reach the objective at ${RED_BAR}+ on 2 different operations`,
    met: stats.cleared >= 2,
    current: `${stats.cleared}`,
    target: '2',
  }];

  const seniorCriteria = [
    {
      label: `Reach the objective at ${RED_BAR}+ on every operation`,
      met: stats.cleared >= stats.total,
      current: `${stats.cleared}`,
      target: `${stats.total}`,
    },
    {
      label: 'At least one ghost run (objective reached, no move caught)',
      met: stats.ghosts >= 1,
      current: `${stats.ghosts}`,
      target: '1',
    },
    {
      label: `No more than ${MAX_RECENT_FAILURES} burned or aborted in your last ${RECENT_RUNS} runs`,
      met: recent.length > 0 && recentFailures <= MAX_RECENT_FAILURES,
      current: `${recentFailures} of ${recent.length}`,
      target: `${MAX_RECENT_FAILURES} or fewer`,
    },
  ];

  let liveRankIndex = 0;
  if (operatorCriteria.every((c) => c.met)) liveRankIndex = 1;
  if (liveRankIndex === 1 && seniorCriteria.every((c) => c.met)) liveRankIndex = 2;

  // The checkpoint can only hold a rank up, never pull it down.
  const rankIndex = Math.max(liveRankIndex, checkpointRankIndex);
  const next = RED_RANKS[rankIndex + 1] || null;

  return {
    rank: RED_RANKS[rankIndex].label,
    rankId: RED_RANKS[rankIndex].id,
    rankIndex,
    next: next?.label ?? null,
    criteria: rankIndex === 0 ? operatorCriteria : rankIndex === 1 ? seniorCriteria : [],
    viaCheckpoint: rankIndex > liveRankIndex,
    stats,
  };
}

export function advanceRedCheckpoint(progress, operationIds) {
  const current = progress.checkpointRankIndex ?? 0;
  const { rankIndex } = redStatus(progress.history, operationIds, current);
  return rankIndex === current ? progress : { ...progress, checkpointRankIndex: rankIndex };
}
