// Last shift report storage

import { clearStored, readStored, writeStored } from './localStore.js';

export const REPORT_KEY = 'soc-analyst-sim:last-report:v1';

export function loadLastReport() {
  return readStored(REPORT_KEY, null, (parsed) => {
    const ok = parsed && parsed.version === 1 && Array.isArray(parsed.cases) && Array.isArray(parsed.skills) && parsed.counts;
    return ok ? parsed : null;
  });
}

export const saveLastReport = (report) => writeStored(REPORT_KEY, report);
export const clearLastReport = () => clearStored(REPORT_KEY);
