// The pilot: a scenario's attacker IP / hostname / service account can be
// re-rolled per shift without breaking the thing that actually matters —
// that a player who does the right searches and lookups still gets credited
// for it, regardless of which pool value they landed on.

import test from 'node:test';
import assert from 'node:assert/strict';

import { SCENARIOS } from '../src/data/scenarios/index.js';
import { instantiateScenario } from '../src/engine/scenarioVariants.js';

const awsKeyLeak = SCENARIOS.find((s) => s.id === 'aws-key-leak');
const sshBrute = SCENARIOS.find((s) => s.id === 'ssh-brute-success');

test('a scenario with no variables passes through untouched', () => {
  const untouched = SCENARIOS.find((s) => !s.variables);
  assert.ok(untouched, 'need at least one scenario outside the pilot to test the no-op path');
  assert.equal(instantiateScenario(untouched, 'any-seed'), untouched);
});

test('the same scenario and seed always instantiate identically', () => {
  const a = instantiateScenario(awsKeyLeak, '1700000000000:3');
  const b = instantiateScenario(awsKeyLeak, '1700000000000:3');
  assert.deepEqual(a, b);
});

test('different seeds produce more than one distinct pick', () => {
  const seeds = Array.from({ length: 25 }, (_, i) => `${1700000000000 + i * 86_400_000}:${i}`);
  // `variables` still holds the unchanged defaults after instantiation (it's
  // the metadata, not the result) — read the resolved value off a field that
  // actually gets substituted instead.
  const rawLogIps = new Set(seeds.map((seed) => {
    const s = instantiateScenario(awsKeyLeak, seed);
    return s.rawLog.match(/"sourceIPAddress":"([^"]+)"/)?.[1];
  }));
  assert.ok(rawLogIps.size > 1, `expected variety across 25 seeds, got one value every time: ${[...rawLogIps]}`);
});

test('aws-key-leak stays internally consistent under every re-roll', () => {
  const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  for (const seed of seeds) {
    const s = instantiateScenario(awsKeyLeak, seed);
    const json = JSON.stringify(s);

    // The default value must not survive anywhere if it got replaced.
    if (s.variables.sourceIp.value !== '45.83.42.19') {
      assert.ok(!json.includes('45.83.42.19'), `stale default IP leaked through for seed ${seed}`);
    }
    if (s.variables.principal.value !== 'svc-etl-loader') {
      assert.ok(!json.includes('svc-etl-loader'), `stale default principal leaked through for seed ${seed}`);
    }

    // Required intel must name a key that actually exists in the intel table.
    for (const key of s.truth.requiredIntel) {
      assert.ok(key in s.intel, `requiredIntel "${key}" has no matching intel record (seed ${seed})`);
    }

    // The required searches' ids and match terms must still line up with the
    // scenario's own current IP — a search a correct analyst runs has to
    // still find what it's supposed to find.
    const ipSearch = s.searches.find((sr) => sr.id === 's6-cloudtrail-ip');
    const currentIp = Object.entries(s.intel)[0][0];
    assert.deepEqual(ipSearch.match.terms, [currentIp]);
    assert.ok(ipSearch.events.every((e) => e.source_ip === currentIp));

    // Structural fields a variable must never touch.
    assert.equal(s.id, 'aws-key-leak');
    assert.equal(s.truth.classification, 'true_positive');
    assert.equal(s.truth.severity, 'CRITICAL');
    assert.equal(s.truth.mitreTechnique, 'T1078.004');
    assert.deepEqual(s.truth.requiredSearches, awsKeyLeak.truth.requiredSearches);
    assert.deepEqual(s.truth.requiredActions, awsKeyLeak.truth.requiredActions);
  }
});

test('ssh-brute-success stays internally consistent under every re-roll', () => {
  const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  for (const seed of seeds) {
    const s = instantiateScenario(sshBrute, seed);
    const json = JSON.stringify(s);

    if (s.variables.sourceIp.value !== '185.220.101.45') {
      assert.ok(!json.includes('185.220.101.45'), `stale default IP leaked through for seed ${seed}`);
    }
    if (s.variables.hostname.value !== 'db-prod-03') {
      assert.ok(!json.includes('db-prod-03'), `stale default hostname leaked through for seed ${seed}`);
    }

    for (const key of s.truth.requiredIntel) {
      assert.ok(key in s.intel, `requiredIntel "${key}" has no matching intel record (seed ${seed})`);
    }

    const currentIp = Object.entries(s.intel)[0][0];
    const authIpSearch = s.searches.find((sr) => sr.id === 's1-auth-ip');
    assert.deepEqual(authIpSearch.match.terms, [currentIp]);

    // The current hostname's own decoy neighbors (db-prod-01/02, app-prod-07)
    // must never be touched — they're a different fact, not this scenario's
    // variable, and the contrast between them is the point of that search.
    assert.ok(json.includes('db-prod-01') && json.includes('db-prod-02') && json.includes('app-prod-07'));

    // The rubric keyword list must track the current hostname, not the default.
    const hostnamePoint = s.truth.requiredReportPoints.find((p) => p.point.includes('low-value target'));
    const currentHostname = s.alert.entities.find((e) => e.label === 'Host').value;
    assert.ok(
      hostnamePoint.any.includes(currentHostname),
      `rubric keywords ${hostnamePoint.any.join(', ')} should include current hostname ${currentHostname}`
    );

    assert.equal(s.id, 'ssh-brute-success');
    assert.equal(s.truth.mitreTechnique, 'T1110.001');
    assert.deepEqual(s.truth.requiredSearches, sshBrute.truth.requiredSearches);
    assert.deepEqual(s.truth.requiredActions, sshBrute.truth.requiredActions);
  }
});
