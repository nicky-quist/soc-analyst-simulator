// Threat-intel enrichment takes typed input, so it has to handle what analysts
// actually paste — defanged indicators, hashes, look-alike domains — and it has
// to refuse to imply "clean" when it means "no data".

import test from 'node:test';
import assert from 'node:assert/strict';

import { SCENARIOS } from '../src/data/scenarios/index.js';
import { classifyIndicator, lookupIndicator, isPrivateIpv4 } from '../src/engine/intel.js';

const byId = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

test('classifies the indicator types an analyst pastes', () => {
  assert.equal(classifyIndicator('185.220.101.45').type, 'ipv4');
  assert.equal(classifyIndicator('185[.]220[.]101[.]45').value, '185.220.101.45');
  assert.equal(classifyIndicator('coastaltrustbank-secure.com').type, 'domain');
  assert.equal(classifyIndicator('http://198.51.100.77/svc.ps1').type, 'url');
  assert.equal(classifyIndicator('a'.repeat(64)).type, 'hash');
  assert.equal(classifyIndicator('a'.repeat(64)).algorithm, 'sha256');
  assert.equal(classifyIndicator('jmartinez@coastaltrustbank.com').type, 'email');
  assert.equal(classifyIndicator('999.1.1.1').type, 'invalid');
  assert.equal(classifyIndicator('not an indicator!').type, 'invalid');
});

test('recognizes RFC1918 space', () => {
  assert.ok(isPrivateIpv4([10, 20, 9, 14]));
  assert.ok(isPrivateIpv4([192, 168, 1, 1]));
  assert.ok(isPrivateIpv4([172, 16, 0, 1]));
  assert.equal(isPrivateIpv4([172, 32, 0, 1]), false);
  assert.equal(isPrivateIpv4([185, 220, 101, 45]), false);
});

test('a known-bad indicator returns the feed record', () => {
  const result = lookupIndicator(byId['ssh-brute-success'], '185.220.101.45');
  assert.equal(result.status, 'found');
  assert.equal(result.record.verdict, 'malicious');
  assert.ok(result.record.sources.length);
});

test('enriching an internal address teaches why that is the wrong tool', () => {
  const result = lookupIndicator(byId['vuln-scan-false-positive'], '10.20.9.14');
  assert.equal(result.status, 'not_applicable');
  assert.match(result.detail, /RFC1918/);
  assert.match(result.guidance, /asset inventory/i);
});

test('an unknown indicator is "no records", explicitly not "clean"', () => {
  const result = lookupIndicator(byId['ssh-brute-success'], '203.0.113.9');
  assert.equal(result.status, 'not_found');
  assert.match(result.guidance, /not the same as "clean"/i);
});

test('a mistyped indicator looks exactly like a clean result — which is the trap', () => {
  const typo = lookupIndicator(byId['ssh-brute-success'], '185.220.101.54');
  assert.equal(typo.status, 'not_found');
  assert.match(typo.guidance, /copied the indicator correctly/i);
});

test('malformed input is rejected rather than silently returning nothing', () => {
  const result = lookupIndicator(byId['ssh-brute-success'], '185.220.101');
  assert.equal(result.status, 'error');
});

test('the phishing domain record explains the MFA bypass', () => {
  const result = lookupIndicator(byId['phishing-bec-ambiguous'], 'coastaltrustbank-secure.com');
  assert.equal(result.status, 'found');
  assert.match(result.record.summary, /session cookie/i);
});

test('every required intel lookup in every scenario resolves', () => {
  for (const scenario of SCENARIOS) {
    for (const indicator of scenario.truth.requiredIntel || []) {
      assert.equal(lookupIndicator(scenario, indicator).status, 'found', `${scenario.id}: ${indicator}`);
    }
  }
});
