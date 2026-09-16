// The dashboard is the one place in the sim that shows numbers nobody
// investigates, which makes it the easiest place for a nonsense figure to sit
// unnoticed. These assertions keep the estate data internally coherent.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTOMATION_FUNNEL, DETECTION_SOURCES, ESTATE_FEED, SLA_TARGET, TACTIC_COVERAGE,
  TOP_ENTITIES, buildHourlyVolume, buildShift, buildSlaTrend, formatCount, funnelTotals, withToday,
} from '../src/data/estate.js';
import { HAND_SIZE } from '../src/engine/deal.js';

test('the alert pipeline narrows at every stage', () => {
  const stages = funnelTotals(HAND_SIZE);
  for (let i = 1; i < stages.length; i += 1) {
    assert.ok(stages[i].value < stages[i - 1].value, `${stages[i].stage} is not smaller than ${stages[i - 1].stage}`);
  }
  assert.equal(stages[stages.length - 1].value, HAND_SIZE, 'the funnel must end at the real queue size');
});

// Seeded data has to hold every invariant the frozen arrays used to hold, for
// every seed — a generator that is plausible on average is still a generator
// that will eventually render a day with no critical alerts or a 104% SLA.
const SEEDS = Array.from({ length: 400 }, (_, i) => Date.UTC(2026, 0, 1) + i * 7 * 3600_000);

test('hourly volume covers a full day and is dominated by low severity', () => {
  for (const seed of SEEDS) {
    const hours = buildHourlyVolume(seed);
    assert.equal(hours.length, 24);
    assert.equal(new Set(hours.map((h) => h.hour)).size, 24, 'every hour of the day appears once');
    const total = (key) => hours.reduce((sum, hour) => sum + hour[key], 0);
    assert.ok(total('low') > total('medium'));
    assert.ok(total('medium') > total('high'));
    assert.ok(total('high') > total('critical'));
    assert.ok(total('critical') > 0, 'a day with no critical alerts is not the day being modeled');
  }
});

test('the volume chart ends on the hour the analyst is sitting in', () => {
  for (const seed of SEEDS.slice(0, 50)) {
    const hours = buildHourlyVolume(seed);
    assert.equal(hours[hours.length - 1].hour, String(new Date(seed).getHours()).padStart(2, '0'));
  }
});

test('the SLA week ends on today, which is left for the analyst to fill in', () => {
  const shapes = new Set();
  const badDays = new Set();
  let cleanWeeks = 0;
  for (const seed of SEEDS) {
    const trend = buildSlaTrend(seed);
    assert.equal(trend.points.length, 7);

    const today = trend.points[6];
    assert.equal(today.today, true);
    assert.equal(today.day, ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(seed).getDay()]);
    assert.equal(today.pct, null, 'the console must not invent a number for a shift in progress');

    const history = trend.points.slice(0, 6);
    for (const point of history) assert.ok(point.pct > 0 && point.pct <= 100, `${point.day}: ${point.pct}%`);

    const below = history.filter((p) => p.pct < SLA_TARGET);
    assert.equal(below.length, trend.breachedDays.length, 'the caption must count the same bad days as the chart');
    for (const point of below) assert.ok(!point.weekend, 'weekend volume does not miss the target');

    shapes.add(history.map((p) => p.pct).join(','));
    for (const name of trend.breachedDays) badDays.add(name);
    if (!trend.breachedDays.length) cleanWeeks += 1;
  }
  assert.ok(shapes.size > 300, `only ${shapes.size} distinct weeks across 400 shifts — the chart is effectively static`);
  assert.ok(badDays.size >= 4, `the dip only ever lands on ${[...badDays].join(', ')}`);
  assert.ok(cleanWeeks > 20 && cleanWeeks < 160, `${cleanWeeks}/400 weeks with nothing to explain is the wrong balance`);
});

test("today's point is the analyst's, and only the analyst's", () => {
  const trend = buildSlaTrend(Date.UTC(2026, 4, 12, 9, 30));
  assert.equal(withToday(trend, null).points[6].pct, null, 'no figure yet leaves the point empty');

  const placed = withToday(trend, 83);
  assert.equal(placed.points[6].pct, 83);
  assert.deepEqual(placed.points.slice(0, 6), trend.points.slice(0, 6), 'the week behind you does not move');
  assert.equal(trend.points[6].pct, null, 'the generated week is not mutated');
});

test('the same shift start deals a different week after a reset', () => {
  const seed = Date.UTC(2026, 4, 12, 9, 30);
  const first = buildSlaTrend(seed, 0).points.map((p) => p.pct).join(',');
  const second = buildSlaTrend(seed, 1).points.map((p) => p.pct).join(',');
  assert.notEqual(first, second);
  const rosters = new Set(Array.from({ length: 8 }, (_, v) => buildShift(seed, v).onCall));
  assert.ok(rosters.size > 1, 'the on-call roster never changes between shifts');
});

test('the same shift always renders the same numbers', () => {
  const seed = Date.UTC(2026, 4, 12, 9, 30);
  assert.deepEqual(buildSlaTrend(seed), buildSlaTrend(seed));
  assert.deepEqual(buildHourlyVolume(seed), buildHourlyVolume(seed));
  assert.deepEqual(buildShift(seed), buildShift(seed));
  assert.deepEqual(buildSlaTrend(seed), buildSlaTrend(seed + 20 * 60_000), 'a shift must not re-roll mid-shift');
});

test('the shift header names today and the block it belongs to', () => {
  const morning = buildShift(new Date(2026, 8, 15, 9, 15).getTime());
  assert.match(morning.label, /^Tuesday 15 September 2026$/);
  assert.match(morning.window, /^Day shift/);
  assert.match(buildShift(new Date(2026, 8, 15, 2, 0).getTime()).window, /^Night shift/);
  assert.match(buildShift(new Date(2026, 8, 15, 18, 0).getTime()).window, /^Swing shift/);
  assert.match(morning.onCall, /IR on-call: .+ · Duty CISO: .+/);
});

test('no source auto-closes more alerts than it raised', () => {
  for (const source of DETECTION_SOURCES) {
    assert.ok(source.autoClosed <= source.alerts, `${source.source}: ${source.autoClosed} > ${source.alerts}`);
    assert.ok(source.autoClosed / source.alerts > 0.5, `${source.source}: implausibly low auto-close rate`);
  }
});

test('percentages stay inside 0–100 and the feed has content', () => {
  for (const row of TACTIC_COVERAGE) assert.ok(row.pct >= 0 && row.pct <= 100);
  assert.ok(ESTATE_FEED.length >= 12, 'the live tail needs enough entries not to visibly repeat');
  for (const entry of ESTATE_FEED) assert.ok(['low', 'medium'].includes(entry.level));
});

test('top entities line up with severities the console can render', () => {
  const valid = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL']);
  for (const entity of TOP_ENTITIES) assert.ok(valid.has(entity.risk), `${entity.entity}: ${entity.risk}`);
});

test('counts abbreviate the way a dashboard reads them', () => {
  assert.equal(formatCount(41208442), '41.2M');
  assert.equal(formatCount(1284), '1.3k');
  assert.equal(formatCount(7), '7');
  assert.equal(formatCount(AUTOMATION_FUNNEL[0].value), '41.2M');
});
