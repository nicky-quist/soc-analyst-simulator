import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { detectFormat, extractIPs, uniq, parseZeek, ZEEK_CONN_FIELDS } from '../../src/engine/triage/format.js';
import * as F from './fixtures.js';

describe('detectFormat', () => {
  const cases = [
    ['CEF',                 F.CEF_MIMIKATZ],
    ['Suricata JSON',       F.SURICATA_COBALT_STRIKE],
    ['Zeek conn.log',       F.ZEEK_BEACON],
    ['Zeek conn.log',       F.ZEEK_NO_HEADER],
    ['Windows Event Log',   F.WIN_POWERSHELL_MALICIOUS],
    ['Syslog',              F.SYSLOG_BRUTE_ROOT],
    ['DNS Log',             F.DNS_EXFIL],
    ['Free-form Narrative', F.NARRATIVE_BENIGN]
  ];

  for (const [expected, raw] of cases) {
    test(`classifies ${expected}`, () => {
      assert.equal(detectFormat(raw), expected);
    });
  }

  test('falls back to narrative rather than guessing', () => {
    assert.equal(detectFormat('the printer on floor 3 is jammed again'), 'Free-form Narrative');
  });

  test('is not fooled by a JSON body without alert fields', () => {
    assert.equal(detectFormat('{"user":"alice","action":"login"}'), 'Free-form Narrative');
  });

  test('detects Zeek by bare data line when no #fields header is present', () => {
    assert.equal(detectFormat(F.ZEEK_NO_HEADER), 'Zeek conn.log');
  });
});

describe('extractIPs', () => {
  test('pulls every distinct IPv4 address', () => {
    assert.deepEqual(extractIPs(F.SYSLOG_BRUTE_ROOT), ['185.220.101.45']);
  });

  test('deduplicates repeats', () => {
    const ips = extractIPs('10.0.0.1 talked to 10.0.0.1 and 10.0.0.2');
    assert.deepEqual(ips, ['10.0.0.1', '10.0.0.2']);
  });

  test('rejects octets above 255', () => {
    assert.deepEqual(extractIPs('999.1.1.1 and 256.0.0.1'), []);
  });

  test('returns an empty array when there is nothing to find', () => {
    assert.deepEqual(extractIPs('no addresses here'), []);
  });

  test('does not leak regex lastIndex between calls', () => {
    // IP_RE is a module-level /g regex; .match() resets it, but a switch to
    // .test() or .exec() would make repeat calls return different results.
    const text = '10.0.0.1 and 10.0.0.2';
    assert.deepEqual(extractIPs(text), extractIPs(text));
  });
});

describe('uniq', () => {
  test('drops duplicates and falsy entries', () => {
    assert.deepEqual(uniq(['a', 'a', '', null, undefined, 'b', 0]), ['a', 'b']);
  });
});

describe('parseZeek', () => {
  test('reads columns from the #fields header', () => {
    const rows = parseZeek(F.ZEEK_BEACON);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]['id.orig_h'], '10.0.0.55');
    assert.equal(rows[0]['id.resp_h'], '203.0.113.99');
    assert.equal(rows[0]['id.resp_p'], 4444);
    assert.equal(rows[0].duration, 3600);
    assert.equal(rows[0].orig_bytes, 2457600);
  });

  test('falls back to standard conn.log order with no header', () => {
    const [row] = parseZeek(F.ZEEK_NO_HEADER);
    assert.equal(row.duration, 3600);
    assert.equal(row.orig_bytes, 2457600);
    assert.equal(row['id.resp_p'], 4444);
  });

  test('turns Zeek unset markers into null, not NaN', () => {
    const [row] = parseZeek(
      '1705276800.1 Cabc 10.0.0.1 1234 10.0.0.2 80 tcp - - - - S0'
    );
    assert.equal(row.duration, null);
    assert.equal(row.orig_bytes, null);
    assert.ok(!Number.isNaN(row.duration));
  });

  test('ignores comment lines', () => {
    const rows = parseZeek('#separator x09\n#path conn\n' + F.ZEEK_NO_HEADER);
    assert.equal(rows.length, 1);
  });

  test('exposes the standard column order it falls back to', () => {
    assert.equal(ZEEK_CONN_FIELDS[0], 'ts');
    assert.equal(ZEEK_CONN_FIELDS[8], 'duration');
    assert.equal(ZEEK_CONN_FIELDS[9], 'orig_bytes');
  });
});
