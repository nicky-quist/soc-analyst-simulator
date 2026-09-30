// The most recent shift report, kept so it can be reopened from Your progress
// after the shift has been dealt over. One report only: the last shift.
// Reset everything clears it, like the rest of the record.

export const REPORT_KEY = 'soc-analyst-sim:last-report:v1';

export function loadLastReport() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(REPORT_KEY) || 'null');
    const ok = parsed && parsed.version === 1 && Array.isArray(parsed.cases) && Array.isArray(parsed.skills) && parsed.counts;
    return ok ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLastReport(report) {
  try {
    window.localStorage.setItem(REPORT_KEY, JSON.stringify(report));
  } catch {
    // Storage unavailable: the report lasts for this session only.
  }
}

export function clearLastReport() {
  try {
    window.localStorage.removeItem(REPORT_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
