// Shift storage and navigation

import test from 'node:test';
import assert from 'node:assert/strict';

import { NAV_GROUPS, VIEWS } from '../src/app/nav.js';
import {
  EMPTY_CASE, EMPTY_SHIFT, PROGRESS_KEY, SHIFT_RESET_MS, STORAGE_KEY, loadProgress, loadShift, openShift,
  saveProgress, saveShift, startClock, viewFromHash,
} from '../src/app/storage.js';
import { SCENARIOS } from '../src/data/scenarios/index.js';
import { dealShift } from '../src/engine/deal.js';
import { emptyProgress } from '../src/engine/progress.js';

function withBrowser(fn, hash = '') {
  const data = new Map();
  const previous = globalThis.window;
  globalThis.window = {
    location: { hash },
    localStorage: {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { data.set(k, String(v)); },
      removeItem: (k) => { data.delete(k); },
    },
  };
  try { fn(data); } finally { globalThis.window = previous; }
}

const NOW = Date.now();
const hand = (startedAt, deal = 0) => dealShift(startedAt, deal);

// ── navigation ──

test('every section appears exactly once, in four groups, in the order the rail draws them', () => {
  assert.equal(NAV_GROUPS.length, 4);
  assert.equal(new Set(VIEWS).size, VIEWS.length);
  assert.deepEqual(VIEWS, [
    'dashboard', 'queue',
    'triage', 'fasttriage', 'redops',
    'progress', 'leaderboard',
    'team', 'settings',
  ]);
  for (const group of NAV_GROUPS) {
    assert.ok(group.length >= 2);
    for (const item of group) assert.ok(item.id && item.label, item.id);
  }
});

test('the URL hash names a section, and anything else is not one', () => {
  for (const id of VIEWS) withBrowser(() => assert.equal(viewFromHash(), id), `#${id}`);
  withBrowser(() => assert.equal(viewFromHash(), null), '#credits');
  withBrowser(() => assert.equal(viewFromHash(), null), '');
  withBrowser(() => assert.equal(viewFromHash(), null), '#not-a-view');
});

// ── saved shift ──

test('with nothing saved, the shift starts empty', () => {
  withBrowser(() => assert.deepEqual(loadShift(), EMPTY_SHIFT));
});

test('a saved shift restores its theme, view and the cases that are in its hand', () => {
  withBrowser(() => {
    const startedAt = NOW - 60_000;
    const inHand = hand(startedAt)[0].id;
    saveShift({
      ...EMPTY_SHIFT, theme: 'dark', view: 'queue', shiftStartedAt: startedAt, deal: 0,
      cases: { [inHand]: { ...EMPTY_CASE, startedAt, attempts: 1 } },
    });
    const loaded = loadShift();
    assert.equal(loaded.theme, 'dark');
    assert.equal(loaded.view, 'queue');
    assert.equal(loaded.shiftStartedAt, startedAt);
    assert.equal(loaded.cases[inHand].attempts, 1);
  });
});

test('cases for alerts that are not in the dealt hand are dropped, so the board agrees with the queue', () => {
  withBrowser(() => {
    const startedAt = NOW - 60_000;
    const dealt = new Set(hand(startedAt).map((s) => s.id));
    const stranger = SCENARIOS.find((s) => !dealt.has(s.id)).id;
    saveShift({ ...EMPTY_SHIFT, shiftStartedAt: startedAt, cases: { [stranger]: { ...EMPTY_CASE, attempts: 3 } } });
    assert.deepEqual(loadShift().cases, {});
  });
});

test('a Red Ops target outside the dealt hand keeps its case, because it is added to the queue', () => {
  withBrowser(() => {
    const startedAt = NOW - 60_000;
    const dealt = new Set(hand(startedAt).map((s) => s.id));
    const target = SCENARIOS.find((s) => !dealt.has(s.id)).id;
    saveShift({
      ...EMPTY_SHIFT, shiftStartedAt: startedAt, redOpsTarget: target,
      redOps: { scenarioId: target, evasionScore: 50 },
      cases: { [target]: { ...EMPTY_CASE, attempts: 1 } },
    });
    const loaded = loadShift();
    assert.equal(loaded.redOpsTarget, target);
    assert.equal(loaded.cases[target].attempts, 1);
  });
});

test('a shift older than the reset window starts over but keeps the theme', () => {
  withBrowser(() => {
    saveShift({ ...EMPTY_SHIFT, theme: 'dark', shiftStartedAt: NOW - SHIFT_RESET_MS - 1000, cases: { x: {} } });
    const loaded = loadShift();
    assert.equal(loaded.theme, 'dark');
    assert.equal(loaded.shiftStartedAt, null);
    assert.deepEqual(loaded.cases, {});
  });
});

test('corrupt saved data and unknown views fall back safely', () => {
  withBrowser((data) => {
    data.set(STORAGE_KEY, '{nope');
    assert.deepEqual(loadShift(), EMPTY_SHIFT);
    data.set(STORAGE_KEY, JSON.stringify({ shiftStartedAt: NOW - 1000, view: 'not-a-view', theme: 'sepia' }));
    const loaded = loadShift();
    assert.equal(loaded.view, 'dashboard');
    assert.equal(loaded.theme, 'light');
  });
});

test('a case clock starts once, on first view, and never restarts or reopens a closed case', () => {
  const id = SCENARIOS[0].id;
  const started = startClock({ ...EMPTY_SHIFT, shiftStartedAt: 1 }, id);
  assert.ok(started.cases[id].startedAt > 0);
  assert.equal(startClock(started, id), started, 'a running clock is left alone');
  const closed = { ...EMPTY_SHIFT, shiftStartedAt: 1, cases: { [id]: { ...EMPTY_CASE, result: { score: {} } } } };
  assert.equal(startClock(closed, id).cases[id].startedAt, null, 'a closed case does not start a clock');
  assert.ok(startClock({ ...EMPTY_SHIFT }, id).shiftStartedAt > 0, 'a shift with no start is stamped');
});

test('opening a shift stamps it and starts the clock on the first alert in the hand', () => {
  const opened = openShift({ ...EMPTY_SHIFT }, emptyProgress());
  assert.ok(opened.shiftStartedAt > 0);
  const first = dealShift(opened.shiftStartedAt, opened.deal, undefined, opened.focus, new Set())[0].id;
  assert.ok(opened.cases[first].startedAt > 0);
});

// ── progress ──

test('progress round-trips, including the rank checkpoint that must survive a reload', () => {
  withBrowser(() => {
    assert.deepEqual(loadProgress(), emptyProgress());
    saveProgress({ history: [{ key: 'a', scenarioId: 'x', overallScore: 90 }], adaptive: false, checkpointRankIndex: 2 });
    const loaded = loadProgress();
    assert.equal(loaded.history.length, 1);
    assert.equal(loaded.adaptive, false);
    assert.equal(loaded.checkpointRankIndex, 2);
  });
});

test('corrupt progress loads as an empty record, and a bad checkpoint becomes zero', () => {
  withBrowser((data) => {
    data.set(PROGRESS_KEY, 'garbage');
    assert.deepEqual(loadProgress(), emptyProgress());
    data.set(PROGRESS_KEY, JSON.stringify({ history: [], checkpointRankIndex: 'two' }));
    assert.equal(loadProgress().checkpointRankIndex, 0);
  });
});
