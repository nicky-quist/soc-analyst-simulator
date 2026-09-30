// Fast Triage's saved runs live under their own key, separate from the shift
// and from cross-shift progress, so "Reset everything" has to clear them
// explicitly or the Fast triage tab would keep a record the rest of the
// console just forgot.

export const FASTTRIAGE_KEY = 'soc-analyst-sim:fasttriage:v1';
export const KEEP_RUNS = 20;

export function loadFastTriageRuns() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FASTTRIAGE_KEY) || 'null');
    return Array.isArray(parsed) ? parsed.filter((r) => Number.isFinite(r.score)) : [];
  } catch {
    return [];
  }
}

export function saveFastTriageRuns(runs) {
  try {
    window.localStorage.setItem(FASTTRIAGE_KEY, JSON.stringify(runs.slice(-KEEP_RUNS)));
  } catch {
    // Storage unavailable: history lasts for this session only.
  }
}

export function clearFastTriageRuns() {
  try {
    window.localStorage.removeItem(FASTTRIAGE_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
