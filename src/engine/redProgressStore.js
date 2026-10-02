// Red team career storage

import { HISTORY_LIMIT, emptyRedProgress } from './redProgress.js';
import { readStored, writeStored } from './localStore.js';

export const RED_PROGRESS_KEY = 'soc-analyst-sim:redops-progress:v1';

export function loadRedProgress() {
  return readStored(RED_PROGRESS_KEY, emptyRedProgress(), (parsed) => {
    if (!parsed || !Array.isArray(parsed.history)) return null;
    return {
      history: parsed.history
        .filter((r) => r && typeof r.operationId === 'string' && Number.isFinite(r.score))
        .slice(-HISTORY_LIMIT),
      checkpointRankIndex: Number.isInteger(parsed.checkpointRankIndex) ? parsed.checkpointRankIndex : 0,
    };
  });
}

export const saveRedProgress = (progress) => writeStored(RED_PROGRESS_KEY, progress);
