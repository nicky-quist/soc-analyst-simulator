// Red Ops career storage, separate from the shift and from the analyst record so
// each survives the others' resets exactly as intended: "Reset everything"
// clears the runs but keeps the rank (see resetRedProgress).

import { HISTORY_LIMIT, emptyRedProgress } from './redProgress.js';

export const RED_PROGRESS_KEY = 'soc-analyst-sim:redops-progress:v1';

export function loadRedProgress() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RED_PROGRESS_KEY) || 'null');
    if (!parsed || !Array.isArray(parsed.history)) return emptyRedProgress();
    return {
      history: parsed.history
        .filter((r) => r && typeof r.operationId === 'string' && Number.isFinite(r.score))
        .slice(-HISTORY_LIMIT),
      checkpointRankIndex: Number.isInteger(parsed.checkpointRankIndex) ? parsed.checkpointRankIndex : 0,
    };
  } catch {
    return emptyRedProgress();
  }
}

export function saveRedProgress(progress) {
  try {
    window.localStorage.setItem(RED_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable: progress lasts for this session only.
  }
}
