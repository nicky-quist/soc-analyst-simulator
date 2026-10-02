// Engine invariants

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeOffline } from '../../src/engine/triage/analyze.js';
import { detectFormat, FORMATS } from '../../src/engine/triage/format.js';
import * as F from './fixtures.js';

const SEVERITIES = ['INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const FP_LEVELS  = ['Low', 'Medium', 'High'];

const REQUIRED_KEYS = [
  'severity', 'log_format_detected', 'summary', 'threat_type',
  'mitre_tactic', 'mitre_technique', 'iocs', 'recommended_action',
  'false_positive_likelihood', 'confidence', 'analyst_notes'
];

const fixtures = Object.entries(F.ALL_FIXTURES);

describe('result contract', () => {
  for (const [name, raw] of fixtures) {
    test(`${name} produces a well-formed result`, () => {
      const r = analyzeOffline(raw);

      for (const key of REQUIRED_KEYS) {
        assert.ok(key in r, `missing key: ${key}`);
      }
      assert.ok(SEVERITIES.includes(r.severity), `bad severity: ${r.severity}`);
      assert.ok(FP_LEVELS.includes(r.false_positive_likelihood),
        `bad FP likelihood: ${r.false_positive_likelihood}`);
      assert.ok(FORMATS.includes(r.log_format_detected),
        `undeclared format: ${r.log_format_detected}`);

      assert.equal(typeof r.confidence, 'number');
      assert.ok(r.confidence >= 0 && r.confidence <= 100, `confidence out of range: ${r.confidence}`);

      assert.ok(Array.isArray(r.iocs));
      assert.ok(r.iocs.every(i => typeof i === 'string' && i.length > 0),
        'IOCs must be non-empty strings');
      assert.equal(new Set(r.iocs).size, r.iocs.length, 'IOCs must be deduplicated');

      assert.ok(r.summary.length > 0, 'summary must never be empty');
      assert.ok(r.recommended_action.length > 0, 'an analyst always needs a next step');

      assert.doesNotMatch(r.summary, /undefined|null|NaN|\[object Object\]/,
        'summary leaked an unparsed value');
      assert.doesNotMatch(r.recommended_action, /undefined|null|NaN|\[object Object\]/,
        'recommended action leaked an unparsed value');
    });
  }
});

describe('determinism', () => {
  for (const [name, raw] of fixtures) {
    test(`${name} yields an identical verdict on repeat analysis`, () => {
      assert.deepEqual(analyzeOffline(raw), analyzeOffline(raw));
    });
  }

  test('leading and trailing whitespace does not change the verdict', () => {
    const a = analyzeOffline(F.SYSLOG_BRUTE_ROOT);
    const b = analyzeOffline(`\n\n   ${F.SYSLOG_BRUTE_ROOT}   \n`);
    assert.deepEqual(a, b);
  });
});

describe('robustness', () => {
  const hostile = {
    empty: '',
    whitespace: '   \n\t  ',
    'single char': 'x',
    'very long line': 'A'.repeat(50000),
    'null bytes': 'EventID: 4104\u0000Computer: X',
    'unicode': 'Falha de autenticação para usuário ração from 10.0.0.1 ☃',
    'regex metacharacters': 'Failed password for (.*)+$ from 10.0.0.1',
    'json array': '[{"event_type":"alert"}]',
    'html': '<script>alert(1)</script> from 10.0.0.1',
    'truncated CEF': 'CEF:0|Vendor|Product|',
    'zeek header only': '#fields ts uid id.orig_h id.orig_p',
    'crlf line endings': 'EventID: 4625\r\nComputer: FS01\r\nUser: CORP',
  };

  for (const [name, raw] of Object.entries(hostile)) {
    test(`does not throw on ${name}`, () => {
      assert.doesNotThrow(() => analyzeOffline(raw));
      const r = analyzeOffline(raw);
      assert.ok(SEVERITIES.includes(r.severity));
      assert.ok(typeof r.summary === 'string');
    });
  }

  test('a pathological input still completes promptly', () => {
    // Guards against catastrophic backtracking in the pattern set.
    const nasty = 'Failed password for ' + 'a'.repeat(20000) + ' from 10.0.0.1';
    const started = Date.now();
    analyzeOffline(nasty);
    assert.ok(Date.now() - started < 1000, 'analysis should not take a second');
  });
});

describe('offline guarantee', () => {
  test('analysis performs no network call', async () => {
    // No network calls
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = () => { called = true; return Promise.resolve(); };
    try {
      for (const [, raw] of fixtures) analyzeOffline(raw);
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(called, false, 'analyzeOffline must not call fetch');
  });

  test('analysis does not mutate its input', () => {
    const original = F.SYSLOG_BRUTE_ROOT;
    const copy = String(original);
    analyzeOffline(original);
    assert.equal(original, copy);
  });
});

describe('format coverage', () => {
  test('every declared format is reachable from the fixture set', () => {
    const seen = new Set(fixtures.map(([, raw]) => detectFormat(raw)));
    for (const fmt of FORMATS) {
      assert.ok(seen.has(fmt), `no fixture exercises ${fmt}`);
    }
  });
});
