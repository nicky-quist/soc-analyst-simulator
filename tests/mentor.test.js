// Asking Tier 2 twice about the same still-missing gap should not get you
// the identical sentence back — that's what made the repeat-click feel
// pointless. It should get more direct instead.

import test from 'node:test';
import assert from 'node:assert/strict';

import { SCENARIOS } from '../src/data/scenarios/index.js';
import { nextNudge } from '../src/engine/mentor.js';

const scenario = SCENARIOS.find((s) => s.id === 'ssh-brute-success');

test('a fresh case points at the first missing search', () => {
  const { key, message } = nextNudge(scenario, {});
  assert.equal(key, 'search:auth events from 185.220.101.45');
  assert.match(message, /auth events from 185\.220\.101\.45/);
});

test('asking again about the exact same gap escalates, not repeats', () => {
  const caseFile = {};
  const first = nextNudge(scenario, caseFile);
  const second = nextNudge(scenario, { ...caseFile, nudgeAsks: { [first.key]: 1 } });
  const third = nextNudge(scenario, { ...caseFile, nudgeAsks: { [first.key]: 2 } });

  assert.equal(second.key, first.key, 'still the same gap - nothing was done about it');
  assert.notEqual(second.message, first.message, 'second ask must not repeat the first verbatim');
  assert.notEqual(third.message, second.message, 'third ask must escalate again, not repeat the second');

  // Escalation caps rather than throwing once the phrase list runs out.
  const fourth = nextNudge(scenario, { ...caseFile, nudgeAsks: { [first.key]: 50 } });
  assert.equal(fourth.message, third.message);
});

test('progress on the gap moves the nudge to the next one, resetting escalation', () => {
  const searchesRun = ['s1-auth-ip']; // satisfies the first gap
  const afterProgress = nextNudge(scenario, { searchesRun, nudgeAsks: { 'search:auth events from 185.220.101.45': 3 } });
  assert.notEqual(afterProgress.key, 'search:auth events from 185.220.101.45');
});

test('once everything required is done, repeat asks stop repeating the same line', () => {
  const done = {
    // searchesRun holds resolved searchKey() values (satisfies || id), the
    // same shape handleSearch() builds live - 's1-followup', not 's1-edr-host'.
    searchesRun: ['s1-auth-ip', 's1-followup', 's1-asset-host'],
    intelChecked: ['185.220.101.45'],
    actionsTaken: scenario.truth.requiredActions,
  };
  const first = nextNudge(scenario, done);
  const second = nextNudge(scenario, { ...done, nudgeAsks: { [first.key]: 1 } });
  assert.equal(first.key, 'covered');
  assert.notEqual(second.message, first.message);
});
