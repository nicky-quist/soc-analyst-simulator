// The dashboard is the one place in the sim that shows numbers nobody
// investigates, which makes it the easiest place for a nonsense figure to sit
// unnoticed. These assertions keep the estate data internally coherent.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTOMATION_FUNNEL, DETECTION_SOURCES, ESTATE_FEED, HOURLY_VOLUME,
  SLA_TREND, TACTIC_COVERAGE, TOP_ENTITIES, formatCount, funnelTotals,
} from '../src/data/estate.js';
import { SCENARIOS } from '../src/data/scenarios/index.js';

test('the alert pipeline narrows at every stage', () => {
  const stages = funnelTotals(SCENARIOS.length);
  for (let i = 1; i < stages.length; i += 1) {
    assert.ok(stages[i].value < stages[i - 1].value, `${stages[i].stage} is not smaller than ${stages[i - 1].stage}`);
  }
  assert.equal(stages[stages.length - 1].value, SCENARIOS.length, 'the funnel must end at the real queue size');
});

test('hourly volume covers a full day and is dominated by low severity', () => {
  assert.equal(HOURLY_VOLUME.length, 24);
  const total = (key) => HOURLY_VOLUME.reduce((sum, hour) => sum + hour[key], 0);
  assert.ok(total('low') > total('medium'));
  assert.ok(total('medium') > total('high'));
  assert.ok(total('high') > total('critical'));
  assert.ok(total('critical') > 0, 'a day with no critical alerts is not the day being modeled');
});

test('no source auto-closes more alerts than it raised', () => {
  for (const source of DETECTION_SOURCES) {
    assert.ok(source.autoClosed <= source.alerts, `${source.source}: ${source.autoClosed} > ${source.alerts}`);
    assert.ok(source.autoClosed / source.alerts > 0.5, `${source.source}: implausibly low auto-close rate`);
  }
});

test('percentages stay inside 0–100 and the feed has content', () => {
  for (const point of SLA_TREND) assert.ok(point.pct >= 0 && point.pct <= 100);
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
