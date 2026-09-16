import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { validateInput, VALIDATION_RULES } from '../../src/engine/triage/validation.js';
import * as F from './fixtures.js';

const ids = input => validateInput(input).map(i => i.id);

describe('validateInput', () => {
  test('accepts every realistic fixture', () => {
    for (const [name, raw] of Object.entries(F.ALL_FIXTURES)) {
      assert.deepEqual(validateInput(raw), [], `${name} should be analysable`);
    }
  });

  test('rejects input too short to carry context', () => {
    assert.ok(ids('sshd').includes('too_short'));
  });

  test('rejects a bare URL and says why', () => {
    const [issue] = validateInput('https://siem.example.com/alerts/12345?tab=raw');
    assert.equal(issue.id, 'url_only');
    assert.match(issue.detail, /raw event|log data/i);
  });

  // Padding only ever appears at the end of a real base64 blob.
  const B64_BLOB = Buffer.from('powershell IEX download cradle payload '.repeat(4)).toString('base64');

  test('rejects context-free base64', () => {
    assert.ok(ids(B64_BLOB).includes('base64_only'));
  });

  test('does not reject base64 that arrives inside a real log line', () => {
    const line =
      'EventID: 4104 Computer: WKSTN-1 CommandLine: powershell -EncodedCommand ' + B64_BLOB;
    assert.ok(!ids(line).includes('base64_only'));
  });

  test('rejects a short fragment with no technical indicator', () => {
    assert.ok(ids('something looks wrong').includes('no_context'));
  });

  test('accepts a short fragment that does carry an indicator', () => {
    assert.ok(!ids('blocked 10.0.0.1').includes('no_context'));
  });

  test('every issue reports an id, a message and a remediation detail', () => {
    for (const issue of validateInput('x')) {
      assert.ok(issue.id);
      assert.ok(issue.message.length > 0);
      assert.ok(issue.detail.length > 20, 'detail must tell the analyst what to do instead');
    }
  });

  test('returns plain data, not the rule objects themselves', () => {
    const [issue] = validateInput('x');
    assert.equal(typeof issue.test, 'undefined', 'predicates must not leak to callers');
  });
});

describe('VALIDATION_RULES', () => {
  test('every rule has a unique id', () => {
    const seen = VALIDATION_RULES.map(r => r.id);
    assert.equal(new Set(seen).size, seen.length);
  });

  test('every rule is a callable predicate returning a boolean', () => {
    for (const rule of VALIDATION_RULES) {
      assert.equal(typeof rule.test, 'function');
      assert.equal(typeof rule.test('some sample input text here'), 'boolean');
    }
  });

  test('no rule throws on empty or whitespace input', () => {
    for (const rule of VALIDATION_RULES) {
      assert.doesNotThrow(() => rule.test(''));
      assert.doesNotThrow(() => rule.test('   \n  '));
    }
  });
});
