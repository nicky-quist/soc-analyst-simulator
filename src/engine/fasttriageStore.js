// Fast triage run storage

import { clearStored, readStored, writeStored } from './localStore.js';

export const FASTTRIAGE_KEY = 'soc-analyst-sim:fasttriage:v1';
export const KEEP_RUNS = 20;

export function loadFastTriageRuns() {
  return readStored(FASTTRIAGE_KEY, [], (parsed) =>
    Array.isArray(parsed) ? parsed.filter((r) => Number.isFinite(r.score)) : null);
}

export const saveFastTriageRuns = (runs) => writeStored(FASTTRIAGE_KEY, runs.slice(-KEEP_RUNS));
export const clearFastTriageRuns = () => clearStored(FASTTRIAGE_KEY);
