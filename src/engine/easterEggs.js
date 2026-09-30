// Easter egg engine: pure matchers, a burst counter, the Konami tracker, and a
// tiny event bus so any part of the console can announce a find without
// threading props through it. Nothing here touches grading or history.

// ── matchers ────────────────────────────────────────────────────────────────

// A search the way an analyst would type it: `index=auth 10.0.0.1`. Matches on
// what was typed, never on what the console returns, so a real search for a
// scenario indicator can never trip one.
export function matchSearch(text) {
  const q = String(text || '');
  if (/(^|\s)sudo(\s|$)/i.test(q)) return 'sudoers';
  if (/rm\s+-rf\s+\//i.test(q) || /drop\s+table/i.test(q)) return 'rm-rf';
  if (/index\s*=\s*coffee\b/i.test(q)) return 'coffee';
  return null;
}

const PUBLIC_DNS = new Set(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1', '9.9.9.9']);

export function matchIntel(text) {
  const v = String(text || '').trim().toLowerCase();
  if (v === '127.0.0.1' || v === 'localhost') return 'localhost';
  if (PUBLIC_DNS.has(v)) return 'public-dns';
  return null;
}

export function matchReport(form) {
  const text = `${form?.summary || ''} ${form?.remediation || ''}`;
  return /it\s*was\s*dns|it['’]?s\s*always\s*dns/i.test(text) ? 'dns-report' : null;
}

// Text the base64 decoder produced. Only ever matches what the analyst chose to
// decode themselves, so no scenario blob can trip these.
export function matchDecode(text) {
  const t = String(text || '');
  if (/hire\s+me/i.test(t)) return 'hire-me';
  if (/hello,?\s*world/i.test(t)) return 'hello-world';
  return null;
}

// The small hours, local time.
export function matchNightOwl(date = new Date()) {
  const h = date.getHours();
  return h >= 2 && h < 5 ? 'night-owl' : null;
}

export const QUICK_CLOSE_MS = 90_000;

// A correct close in under ninety seconds. Announces only; grading is untouched.
export function matchQuickClose(elapsedMs, resolvedCorrectly) {
  return resolvedCorrectly && Number.isFinite(elapsedMs) && elapsedMs < QUICK_CLOSE_MS ? 'speed-demon' : null;
}

// Attack score equal to defense score on the same incident.
export function matchDeadEven(redOps, scenarioId, blueScore) {
  return redOps && redOps.scenarioId === scenarioId && redOps.evasionScore === blueScore ? 'dead-even' : null;
}

// result: scoreRun() from engine/fasttriage.js. Paging IR on every alert is the
// tell for 'wolf'; a perfect score is 'flawless'; an untouched queue is 'nap'.
export function matchFastTriage(result) {
  if (!result || !result.rows.length) return null;
  if (result.skipped === result.total) return 'nap';
  if (result.rows.every((r) => r.choice === 'ir')) return 'wolf';
  if (result.score === 100) return 'flawless';
  return null;
}

// result: scoreRun() from engine/redopsRun.js. Three catches is the minimum to
// burn an operation, so a burn in exactly three moves is the fastest possible.
// Aborting before a single move is stage fright.
export function matchRedRun(result) {
  if (!result) return null;
  if (result.outcome === 'burned' && result.breakdown.length === 3) return 'fastest-burn';
  if (result.outcome === 'aborted' && result.breakdown.length === 0) return 'stage-fright';
  return null;
}

// history: the Red Ops record. Every operation with at least one ghost run.
export function matchGhostwire(history, operationIds) {
  if (!operationIds.length) return null;
  const ghosted = new Set(history.filter((r) => r.ghost).map((r) => r.operationId));
  return operationIds.every((id) => ghosted.has(id)) ? 'ghostwire' : null;
}

// ── input patterns ──────────────────────────────────────────────────────────

export const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a',
];

// Feed it each key; it returns true the moment the sequence completes, then resets.
export function createKonami() {
  let index = 0;
  return function push(key) {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (k === KONAMI[index]) index += 1;
    else index = k === KONAMI[0] ? 1 : 0;
    if (index === KONAMI.length) {
      index = 0;
      return true;
    }
    return false;
  };
}

// True when `count` events land within `windowMs`. Used for "flip the theme ten
// times fast" and "click the logo five times". Resets after it fires.
export function createBurst(count, windowMs) {
  let times = [];
  return function push(now = Date.now()) {
    times = [...times.filter((t) => now - t <= windowMs), now];
    if (times.length >= count) {
      times = [];
      return true;
    }
    return false;
  };
}

// ── event bus ───────────────────────────────────────────────────────────────

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Announce a find (`announce('sudoers')`) or a reset of the found list
// (`announce(null, 'reset')`). Unknown ids are ignored by the host.
export function announce(id, type = 'found') {
  for (const fn of [...listeners]) fn({ id, type });
}
