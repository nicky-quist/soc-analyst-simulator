// The hand you are dealt is the whole shift, so the deal has to be two things
// at once: different every time, and never a bad shift. These assertions pin
// down both — variety across seeds, and the mix quotas on every single hand.

import test from 'node:test';
import assert from 'node:assert/strict';

import { SCENARIOS } from '../src/data/scenarios/index.js';
import { HAND_SIZE, dealShift } from '../src/engine/deal.js';
import { shiftCompliance } from '../src/engine/case.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => Date.UTC(2026, 0, 1) + i * 9 * 3600_000);
const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFORMATIONAL: 4 };

test('the library is bigger than a hand, or dealing is pointless', () => {
  assert.ok(SCENARIOS.length > HAND_SIZE, `${SCENARIOS.length} scenarios for a hand of ${HAND_SIZE}`);
});

test('every hand is the right size, with no scenario dealt twice', () => {
  for (const seed of SEEDS) {
    const hand = dealShift(seed);
    assert.equal(hand.length, HAND_SIZE);
    assert.equal(new Set(hand.map((s) => s.id)).size, HAND_SIZE);
  }
});

test('every hand is a mixed shift, not seven of the same thing', () => {
  for (const seed of SEEDS) {
    const hand = dealShift(seed);
    const escalations = hand.map((s) => s.truth.escalation);
    assert.ok(
      escalations.some((e) => e.startsWith('close_')),
      'a shift where everything is a real incident teaches an analyst to escalate everything'
    );
    assert.ok(escalations.includes('escalate_ir'), 'no incident worth escalating tonight');
    assert.ok(
      escalations.filter((e) => e === 'escalate_tier2').length >= 2,
      'nothing in the middle: every call is either nothing or an emergency'
    );
    const difficulties = hand.map((s) => s.difficulty);
    assert.ok(difficulties.includes(1) && difficulties.includes(3), `difficulty spread ${difficulties.join(',')}`);
  }
});

test('the queue is sorted the way a console sorts one', () => {
  for (const seed of SEEDS.slice(0, 40)) {
    const hand = dealShift(seed);
    for (let i = 1; i < hand.length; i += 1) {
      const prev = SEVERITY_RANK[hand[i - 1].alert.reportedSeverity];
      const cur = SEVERITY_RANK[hand[i].alert.reportedSeverity];
      assert.ok(prev <= cur, 'reported severity must not go back up the queue');
      if (prev === cur) assert.ok(hand[i - 1].alert.slaMinutes <= hand[i].alert.slaMinutes);
    }
  }
});

test('shifts differ from each other but never mid-shift', () => {
  const hands = new Set(SEEDS.map((seed) => dealShift(seed).map((s) => s.id).join(',')));
  assert.ok(hands.size > 50, `only ${hands.size} distinct hands across 300 shifts`);

  const seed = Date.UTC(2026, 4, 12, 9, 30);
  assert.deepEqual(dealShift(seed), dealShift(seed));
  assert.deepEqual(dealShift(seed), dealShift(seed + 25 * 60_000), 'a hand must not change while it is being worked');
  assert.notDeepEqual(
    dealShift(seed, 0).map((s) => s.id),
    dealShift(seed, 1).map((s) => s.id),
    'resetting the shift has to deal a different hand'
  );
});

test('every scenario in the library gets dealt eventually', () => {
  const seen = new Set();
  for (const seed of SEEDS) for (const s of dealShift(seed)) seen.add(s.id);
  assert.equal(seen.size, SCENARIOS.length, `never dealt: ${SCENARIOS.filter((s) => !seen.has(s.id)).map((s) => s.id).join(', ')}`);
});

// --- the analyst's own SLA figure -------------------------------------------

const NOW = Date.UTC(2026, 7, 21, 12, 0);
const scenarioOf = (slaMinutes) => ({ id: `s${slaMinutes}`, alert: { slaMinutes } });
const closedAfter = (ms) => ({ startedAt: NOW - ms, result: { score: { elapsedMs: ms } } });

test('compliance is unmeasured until something is closed or breached', () => {
  const hand = [scenarioOf(30), scenarioOf(60)];
  const fresh = shiftCompliance(hand, {}, NOW);
  assert.equal(fresh.pct, null, 'an untouched queue is not 0% and not 100%');
  assert.equal(fresh.handled, 0);

  const working = shiftCompliance(hand, { s30: { startedAt: NOW - 5 * 60_000 } }, NOW);
  assert.equal(working.pct, null, 'an alert still inside its target does not count either way');
});

test('a case closed inside its target counts, and one closed late does not', () => {
  const hand = [scenarioOf(30), scenarioOf(30)];
  const cases = { s30: closedAfter(12 * 60_000) };
  assert.deepEqual(shiftCompliance([hand[0]], cases, NOW), { handled: 1, onTime: 1, breached: 0, pct: 100 });

  const late = { s30: closedAfter(44 * 60_000) };
  assert.deepEqual(shiftCompliance([hand[0]], late, NOW), { handled: 1, onTime: 0, breached: 1, pct: 0 });
});

test('an open alert whose clock has run out counts against you immediately', () => {
  const hand = [scenarioOf(30), scenarioOf(30)];
  const cases = {
    s30: { startedAt: NOW - 90 * 60_000 },
  };
  const result = shiftCompliance([hand[0]], cases, NOW);
  assert.equal(result.handled, 1, 'a breach you have not noticed yet is still a breach');
  assert.equal(result.breached, 1);
  assert.equal(result.pct, 0);
});

test('compliance is the share of handled alerts that made their target', () => {
  const hand = [scenarioOf(30), scenarioOf(45), scenarioOf(60), scenarioOf(90)];
  const cases = {
    s30: closedAfter(10 * 60_000),
    s45: closedAfter(20 * 60_000),
    s60: closedAfter(75 * 60_000),
    s90: { startedAt: NOW - 30 * 60_000 },
  };
  const result = shiftCompliance(hand, cases, NOW);
  assert.deepEqual(result, { handled: 3, onTime: 2, breached: 1, pct: 67 });
});
