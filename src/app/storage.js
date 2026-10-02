// Shift and progress storage

import { SCENARIOS } from '../data/scenarios/index.js';
import { dealShift } from '../engine/deal.js';
import { emptyProgress, planFocus } from '../engine/progress.js';
import { resolveWarRoomScenario } from '../engine/warroom.js';
import { readStored, writeStored } from '../engine/localStore.js';
import { VIEWS } from './nav.js';

export const STORAGE_KEY = 'soc-analyst-sim:shift:v2';

export function viewFromHash() {
  const hash = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
  return VIEWS.includes(hash) ? hash : null;
}

// Cross-shift progress
export const PROGRESS_KEY = 'soc-analyst-sim:progress:v1';

export function loadProgress() {
  return readStored(PROGRESS_KEY, emptyProgress(), (parsed) => {
    if (!parsed || !Array.isArray(parsed.history)) return null;
    return {
      history: parsed.history,
      adaptive: parsed.adaptive !== false,
      // Keep the earned rank
      checkpointRankIndex: Number.isInteger(parsed.checkpointRankIndex) ? parsed.checkpointRankIndex : 0,
    };
  });
}

export const saveProgress = (progress) => writeStored(PROGRESS_KEY, progress);

// Adaptive focus, fixed per shift
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

// Shift state
export const EMPTY_SHIFT = {
  theme: 'light', view: 'dashboard', cases: {}, shiftStartedAt: null, deal: 0, focus: null,
  warRoom: null, redOpsTarget: null, redOps: null, previousHandIds: [],
};

// Auto-reset after 12 hours
export const SHIFT_RESET_MS = 12 * 60 * 60 * 1000;

// Re-derive a shift's dealt hand
export function dealtHand(shift, seedAt = shift.shiftStartedAt) {
  return dealShift(seedAt, shift.deal, undefined, shift.focus, new Set(shift.previousHandIds || []));
}

export function loadShift() {
  return readStored(STORAGE_KEY, EMPTY_SHIFT, (parsed) => {
    if (!parsed) return null;
    const theme = parsed.theme === 'dark' ? 'dark' : 'light';
    const stale = !parsed.shiftStartedAt || Date.now() - parsed.shiftStartedAt > SHIFT_RESET_MS;
    if (stale) return { ...EMPTY_SHIFT, theme };

    // Drop cases that aren't in this hand
    const deal = Number.isInteger(parsed.deal) ? parsed.deal : 0;
    const focus = validFocus(parsed.focus);
    const warRoom = resolveWarRoomScenario(parsed.warRoom) ? parsed.warRoom : null;
    // Red Ops target counts as in the hand
    const redOpsTarget = typeof parsed.redOpsTarget === 'string' && SCENARIOS.some((s) => s.id === parsed.redOpsTarget)
      ? parsed.redOpsTarget
      : null;
    const redOps = parsed.redOps && typeof parsed.redOps.scenarioId === 'string' ? parsed.redOps : null;
    const previousHandIds = Array.isArray(parsed.previousHandIds)
      ? parsed.previousHandIds.filter((id) => typeof id === 'string')
      : [];
    const valid = new Set(dealtHand({ shiftStartedAt: parsed.shiftStartedAt, deal, focus, previousHandIds }).map((s) => s.id));
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
  });
}

export const saveShift = (shift) => writeStored(STORAGE_KEY, shift);

// Start the case clock
export function startClock(shift, scenarioId) {
  const existing = shift.cases[scenarioId] || EMPTY_CASE;
  const withShiftStamp = shift.shiftStartedAt ? shift : { ...shift, shiftStartedAt: Date.now() };
  if (existing.startedAt || existing.result) return withShiftStamp;
  return { ...withShiftStamp, cases: { ...withShiftStamp.cases, [scenarioId]: { ...existing, startedAt: Date.now() } } };
}

// Stamp and deal a shift
export function openShift(loaded, progress) {
  const stamped = loaded.shiftStartedAt
    ? loaded
    : { ...loaded, shiftStartedAt: Date.now(), focus: focusFor(progress) };
  return startClock(stamped, dealtHand(stamped)[0].id);
}

// Next shift
export function nextShift(prev, progress, previousHandIds) {
  return {
    ...openShift({ ...EMPTY_SHIFT, deal: prev.deal + 1, previousHandIds }, progress),
    theme: prev.theme,
  };
}
