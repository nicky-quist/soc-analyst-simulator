// The search console is where the analyst can actually be wrong: mistyped
// indicator, wrong index, time range left on the console default. These tests
// pin down that each of those fails in its own distinguishable way, because a
// console that answers "0 events" to everything teaches nothing.

import test from 'node:test';
import assert from 'node:assert/strict';

import { SCENARIOS } from '../src/data/scenarios/index.js';
import { parseQuery, runQuery, refang, TIME_RANGES, DEFAULT_RANGE } from '../src/engine/query.js';

const byId = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
const ssh = byId['ssh-brute-success'];

test('the console defaults to a narrow window, like a real one', () => {
  assert.equal(DEFAULT_RANGE, '15m');
  assert.ok(TIME_RANGES.some((r) => r.id === '24h'));
});

test('parses field=value pairs, bare terms, and the index', () => {
  const q = parseQuery('index=auth src_ip=185.220.101.45 "failed password"');
  assert.equal(q.index, 'auth');
  assert.equal(q.pairs.src_ip, '185.220.101.45');
  assert.ok(q.terms.includes('failed password'));
  assert.ok(q.values.includes('185.220.101.45'));
});

test('refangs indicators pasted from a ticket or feed', () => {
  assert.equal(refang('185[.]220[.]101[.]45'), '185.220.101.45');
  assert.equal(refang('hxxps://evil[.]com'), 'https://evil.com');
  const result = runQuery(ssh, 'index=auth 185[.]220[.]101[.]45', '24h');
  assert.equal(result.status, 'ok');
});

test('the correct search over a wide enough window returns events', () => {
  const result = runQuery(ssh, 'index=auth src_ip=185.220.101.45', '24h');
  assert.equal(result.status, 'ok');
  assert.equal(result.searchId, 's1-auth-ip');
  assert.equal(result.events.length, 9);
  assert.ok(result.events.some((e) => e.event.includes('Accepted password')));
  assert.equal(result.events.filter((e) => e.event.includes('Failed password')).length, 7);
});

test('a bare indicator with no index still searches', () => {
  const result = runQuery(ssh, '185.220.101.45', '24h');
  assert.equal(result.status, 'ok');
  assert.equal(result.scoped, false);
});

test('the right search with the default time range finds nothing, and says why', () => {
  const result = runQuery(ssh, 'index=auth 185.220.101.45', '15m');
  assert.equal(result.status, 'empty');
  assert.equal(result.searchId, 's1-auth-ip');
  assert.match(result.hint, /time range/i);
});

test('a mistyped indicator returns nothing and does not hint at the right answer', () => {
  const result = runQuery(ssh, 'index=auth 185.220.101.54', '24h');
  assert.equal(result.status, 'empty');
  assert.equal(result.searchId, undefined);
  assert.match(result.hint, /character by character/i);
  assert.doesNotMatch(`${result.detail} ${result.hint}`, /185\.220\.101\.45/);
});

test('an index that does not exist is an error listing what does', () => {
  const result = runQuery(ssh, 'index=firewall_logs 185.220.101.45', '24h');
  assert.equal(result.status, 'error');
  assert.match(result.detail, /auth, edr, asset, net/);
});

test('the right term in the wrong index says so, without giving away the answer', () => {
  const result = runQuery(ssh, 'index=auth db-prod-03', '24h');
  assert.equal(result.status, 'empty');
  assert.match(result.hint, /wrong data source/i);
});

test('an index with no search terms is rejected rather than matching everything', () => {
  const result = runQuery(ssh, 'index=auth', '24h');
  assert.equal(result.status, 'error');
  assert.match(result.title, /No search terms/i);
});

test('current-state indexes ignore the time picker', () => {
  const result = runQuery(ssh, 'index=asset db-prod-03', '15m');
  assert.equal(result.status, 'ok');
  assert.ok(result.events.some((e) => String(e.value).includes('CONFIGURATION DRIFT')));
});

test('alternative searches can satisfy the same investigative step', () => {
  const byHost = runQuery(ssh, 'index=edr db-prod-03', '24h');
  const byIp = runQuery(ssh, 'index=edr 185.220.101.45', '24h');
  assert.equal(byHost.status, 'ok');
  assert.equal(byIp.status, 'ok');
  const searches = ssh.searches;
  const keyOf = (id) => searches.find((s) => s.id === id).satisfies;
  assert.equal(keyOf(byHost.searchId), keyOf(byIp.searchId));
});

test('a search that legitimately returns zero rows is a finding, not a failure', () => {
  const insider = byId['insider-after-hours-ambiguous'];
  const result = runQuery(insider, 'index=ticket rpatterson', '30d');
  assert.equal(result.status, 'ok');
  assert.equal(result.events.length, 0);
  assert.match(result.note, /0 matching records/i);
});

test('every required search in every scenario is reachable', () => {
  for (const scenario of SCENARIOS) {
    for (const key of scenario.truth.requiredSearches || []) {
      const match = scenario.searches.find((s) => (s.satisfies || s.id) === key);
      assert.ok(match, `${scenario.id}: no search satisfies "${key}"`);
      const widest = TIME_RANGES[TIME_RANGES.length - 1].id;
      const result = runQuery(scenario, `index=${match.match.index} ${match.match.terms.join(' ')}`, widest);
      assert.equal(result.status, 'ok', `${scenario.id}: "${key}" not reachable`);
    }
  }
});
