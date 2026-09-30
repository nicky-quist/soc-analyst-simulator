// Everything the console keeps in the browser for a shift: the saved shift and
// the cross-shift progress record, plus the small state helpers that go with
// them (opening a shift, starting a case clock, reading the #hash). No React in
// here, so all of it can be tested without a browser.

import { SCENARIOS } from '../data/scenarios/index.js';
import { dealShift } from '../engine/deal.js';
import { emptyProgress, planFocus } from '../engine/progress.js';
import { resolveWarRoomScenario } from '../engine/warroom.js';
import { VIEWS } from './nav.js';

export const STORAGE_KEY = 'soc-analyst-sim:shift:v2';

export function viewFromHash() {
  const hash = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
  return VIEWS.includes(hash) ? hash : null;
}

// Separate from the shift, because it has to outlive every shift reset.
export const PROGRESS_KEY = 'soc-analyst-sim:progress:v1';

export function loadProgress() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || 'null');
    if (!parsed || !Array.isArray(parsed.history)) return emptyProgress();
    return {
      history: parsed.history,
      adaptive: parsed.adaptive !== false,
      // A rank is a checkpoint, not a reflection of live history — it has to
      // survive the same round-trip as everything else or a reload silently
      // demotes an earned rank back to Trainee.
      checkpointRankIndex: Number.isInteger(parsed.checkpointRankIndex) ? parsed.checkpointRankIndex : 0,
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable: progress lasts for this session only.
  }
}

// The focus is decided once, when a shift is dealt, and stored on the shift.
// The hand is re-derived from the shift on every load, so reading live history
// instead would re-deal a different hand the moment a case closed, and drop
// the analyst's open cases.
export function focusFor(progress) {
  return progress?.adaptive ? planFocus(progress.history, SCENARIOS) : null;
}

function validFocus(focus) {
  return focus && typeof focus === 'object' && focus.weights && typeof focus.weights === 'object' ? focus : null;
}

export const EMPTY_FORM = {
  classification: '',
  severity: '',
  mitreTechnique: '',
  summary: '',
  remediation: '',
  escalation: '',
};

export const EMPTY_CASE = {
  startedAt: null,
  searches: [],
  searchKeys: [],
  intel: [],
  intelChecked: [],
  actions: [],
  decodes: [],
  timeline: [],
  form: EMPTY_FORM,
  result: null,
  assisted: false,
  attempts: 0,
  lastRange: '15m',
  noiseSearches: 0,
  nudgeAsks: {},
};

// `deal` is the hand counter, not the hand: the seven alerts are re-derived
// from (shiftStartedAt, deal) on every load, so a reload restores the queue you
// were working and "Reset shift" — same clock, next counter — deals a new one.
export const EMPTY_SHIFT = {
  theme: 'light', view: 'dashboard', cases: {}, shiftStartedAt: null, deal: 0, focus: null,
  warRoom: null, redOpsTarget: null, redOps: null, previousHandIds: [],
};

// A shift board that just keeps counting is not what a SOC dashboard is for —
// after this long the queue, SLA clocks, and estate feed should look like a
// new shift walked in, not a stale tab someone forgot to close.
export const SHIFT_RESET_MS = 12 * 60 * 60 * 1000;

export function loadShift() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SHIFT;
    const parsed = JSON.parse(raw);
    const theme = parsed.theme === 'dark' ? 'dark' : 'light';
    const stale = !parsed.shiftStartedAt || Date.now() - parsed.shiftStartedAt > SHIFT_RESET_MS;
    if (stale) return { ...EMPTY_SHIFT, theme };

    // Cases for alerts that are not in this hand are dropped rather than kept
    // invisibly: the board has to agree with the queue it is counting. A War
    // Room alert isn't part of the dealt hand, so its id has to be added to
    // the valid set by hand or its case (and the alert itself) would vanish
    // on reload.
    const deal = Number.isInteger(parsed.deal) ? parsed.deal : 0;
    const focus = validFocus(parsed.focus);
    const warRoom = resolveWarRoomScenario(parsed.warRoom) ? parsed.warRoom : null;
    // Same reasoning as War Room: a Red Ops target alert isn't part of the
    // dealt hand either, so it needs the same manual add to the valid set.
    const redOpsTarget = typeof parsed.redOpsTarget === 'string' && SCENARIOS.some((s) => s.id === parsed.redOpsTarget)
      ? parsed.redOpsTarget
      : null;
    const redOps = parsed.redOps && typeof parsed.redOps.scenarioId === 'string' ? parsed.redOps : null;
    const previousHandIds = Array.isArray(parsed.previousHandIds)
      ? parsed.previousHandIds.filter((id) => typeof id === 'string')
      : [];
    const valid = new Set(
      dealShift(parsed.shiftStartedAt, deal, undefined, focus, new Set(previousHandIds)).map((s) => s.id)
    );
    if (warRoom) valid.add(warRoom.scenarioId);
    if (redOpsTarget) valid.add(redOpsTarget);
    const cases = Object.fromEntries(
      Object.entries(parsed.cases || {})
        .filter(([id]) => valid.has(id))
        .map(([id, value]) => [id, { ...EMPTY_CASE, ...value }])
    );
    return {
      theme,
      view: VIEWS.includes(parsed.view) ? parsed.view : 'dashboard',
      cases,
      shiftStartedAt: parsed.shiftStartedAt,
      deal,
      focus,
      warRoom,
      redOpsTarget,
      redOps,
      previousHandIds,
    };
  } catch {
    return EMPTY_SHIFT;
  }
}

export function saveShift(shift) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shift));
  } catch {
    // Storage unavailable (private mode / quota) — the sim still works in-memory.
  }
}

// The clock starts when an open alert is first put on screen, which is every
// path that makes one current: first render, queue click, or reopen.
export function startClock(shift, scenarioId) {
  const existing = shift.cases[scenarioId] || EMPTY_CASE;
  const withShiftStamp = shift.shiftStartedAt ? shift : { ...shift, shiftStartedAt: Date.now() };
  if (existing.startedAt || existing.result) return withShiftStamp;
  return { ...withShiftStamp, cases: { ...withShiftStamp.cases, [scenarioId]: { ...existing, startedAt: Date.now() } } };
}

// A shift has to have a start before it can have a queue, so the stamp comes
// first and the hand is dealt from it.
export function openShift(loaded, progress) {
  const stamped = loaded.shiftStartedAt
    ? loaded
    : { ...loaded, shiftStartedAt: Date.now(), focus: focusFor(progress) };
  const recentIds = new Set(stamped.previousHandIds || []);
  return startClock(stamped, dealShift(stamped.shiftStartedAt, stamped.deal, undefined, stamped.focus, recentIds)[0].id);
}
