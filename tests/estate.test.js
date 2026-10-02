// Estate data coherence

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTOMATION_FUNNEL, DETECTION_SOURCES, ESTATE_FEED, TACTIC_COVERAGE,
  TOP_ENTITIES, buildHourlyVolume, buildShift, formatCount, funnelTotals,
} from '../src/data/estate.js';
import { HAND_SIZE } from '../src/engine/deal.js';

test('the alert pipeline narrows at every stage', () => {
  const stages = funnelTotals(HAND_SIZE);
  for (let i = 1; i < stages.length; i += 1) {
    assert.ok(stages[i].value < stages[i - 1].value, `${stages[i].stage} is not smaller than ${stages[i - 1].stage}`);
  }
  assert.equal(stages[stages.length - 1].value, HAND_SIZE, 'the funnel must end at the real queue size');
});

// Invariants for every seed
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

test('the same shift start deals a different hourly volume after a reset', () => {
  const seed = Date.UTC(2026, 4, 12, 9, 30);
  const first = buildHourlyVolume(seed, 0).map((h) => h.low).join(',');
  const second = buildHourlyVolume(seed, 1).map((h) => h.low).join(',');
  assert.notEqual(first, second);
  const rosters = new Set(Array.from({ length: 8 }, (_, v) => buildShift(seed, v).onCall));
  assert.ok(rosters.size > 1, 'the on-call roster never changes between shifts');
});

test('the same shift always renders the same numbers', () => {
  const seed = Date.UTC(2026, 4, 12, 9, 30);
  assert.deepEqual(buildHourlyVolume(seed), buildHourlyVolume(seed));
  assert.deepEqual(buildShift(seed), buildShift(seed));
  assert.deepEqual(buildHourlyVolume(seed), buildHourlyVolume(seed + 20 * 60_000), 'a shift must not re-roll mid-shift');
});

// Funnel matches detection sources
test('the alert pipeline funnel agrees with the per-source detection table', () => {
  const totalAlerts = DETECTION_SOURCES.reduce((sum, s) => sum + s.alerts, 0);
  const totalAutoClosed = DETECTION_SOURCES.reduce((sum, s) => sum + s.autoClosed, 0);
  const correlated = AUTOMATION_FUNNEL.find((s) => s.stage === 'Correlated into alerts');
  const autoTriaged = AUTOMATION_FUNNEL.find((s) => s.stage === 'Auto-triaged or suppressed');
  const routed = AUTOMATION_FUNNEL.find((s) => s.stage === 'Routed to an analyst');

  assert.equal(correlated.value, totalAlerts, 'every alert in the funnel has to come from a named source');
  assert.equal(autoTriaged.value, totalAutoClosed, 'auto-triaged has to match what the sources actually closed');
  assert.equal(routed.value, totalAlerts - totalAutoClosed, 'the rest, and only the rest, reached an analyst');
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
