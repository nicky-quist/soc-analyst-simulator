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
  // Every scenario in the library is tagged at this point, so the no-op path
  // is exercised with a synthetic stand-in rather than a real library entry.
  const untouched = { id: 'untagged-fixture', rawLog: 'nothing to substitute here' };
  assert.equal(instantiateScenario(untouched, 'any-seed'), untouched);
});

test('the same scenario and seed always instantiate identically', () => {
  const a = instantiateScenario(awsKeyLeak, '1700000000000:3');
  const b = instantiateScenario(awsKeyLeak, '1700000000000:3');
  assert.deepEqual(a, b);
});

test('different seeds produce more than one distinct pick', () => {
  const seeds = Array.from({ length: 25 }, (_, i) => `${1700000000000 + i * 86_400_000}:${i}`);
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

// Extended pass: every scenario in the library now declares `variables`.
// Rather than hand-writing a bespoke test per scenario (as above, kept for
// the two pilots because they check field-specific things — e.g. that the
// hostname search's own match.terms track the re-rolled value), this loops
// the whole library and checks the invariants that apply universally:
// nothing structural moves, required intel always resolves, and a default
// that changed doesn't survive anywhere in the instantiated object.
test('every tagged scenario in the library stays internally consistent across many seeds', () => {
  const tagged = SCENARIOS.filter((s) => s.variables);
  assert.equal(tagged.length, SCENARIOS.length, 'expected every scenario in the library to be tagged');

  const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
  for (const scenario of tagged) {
    for (const seed of seeds) {
      const s = instantiateScenario(scenario, seed);
      const label = `${scenario.id} (seed ${seed})`;

      // Structural fields no variable is allowed to touch.
      assert.equal(s.id, scenario.id, label);
      assert.equal(s.difficulty, scenario.difficulty, label);
      assert.equal(s.truth.classification, scenario.truth.classification, label);
      assert.equal(s.truth.severity, scenario.truth.severity, label);
      assert.equal(s.truth.mitreTechnique, scenario.truth.mitreTechnique, label);
      assert.equal(s.truth.escalation, scenario.truth.escalation, label);
      assert.deepEqual(s.truth.requiredSearches, scenario.truth.requiredSearches, label);
      assert.deepEqual(s.truth.requiredActions, scenario.truth.requiredActions, label);
      assert.deepEqual(s.searches.map((sr) => sr.id), scenario.searches.map((sr) => sr.id), label);
      assert.deepEqual(s.actions.map((a) => a.id), scenario.actions.map((a) => a.id), label);

      // Required intel must always name a key that actually exists.
      for (const key of s.truth.requiredIntel) {
        assert.ok(key in s.intel, `${label}: requiredIntel "${key}" missing from intel table`);
      }

      // No search's match terms were emptied or corrupted by a substitution.
      for (const sr of s.searches) {
        assert.ok(
          sr.match.terms.every((t) => typeof t === 'string' && t.length > 0),
          `${label}: search "${sr.id}" has an empty or non-string match term`
        );
      }

      // A default that actually changed this seed must not survive anywhere
      // in the instantiated object — deepSubstitute's own `variables` field
      // gets walked too, so it already reflects the resolved value here.
      const json = JSON.stringify(s);
      for (const [key, meta] of Object.entries(scenario.variables)) {
        const resolved = s.variables[key].value;
        if (resolved !== meta.value) {
          assert.ok(!json.includes(meta.value), `${label}: stale default "${meta.value}" (${key}) leaked through`);
        }
      }
    }
  }
});
