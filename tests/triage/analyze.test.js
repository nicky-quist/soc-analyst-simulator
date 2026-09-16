import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeOffline } from '../../src/engine/triage/analyze.js';
import * as F from './fixtures.js';

const SEVERITIES = ['INFORMATIONAL', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const rank = s => SEVERITIES.indexOf(s);

describe('syslog / SSH brute force', () => {
  test('escalates to CRITICAL when volume meets privileged-account targeting', () => {
    const r = analyzeOffline(F.SYSLOG_BRUTE_ROOT);
    assert.equal(r.severity, 'CRITICAL');
    assert.equal(r.false_positive_likelihood, 'Low');
    assert.equal(r.mitre_tactic, 'Credential Access');
    assert.equal(r.mitre_technique, 'T1110.001 - Brute Force: Password Guessing');
  });

  test('same volume against an unprivileged account stays below CRITICAL', () => {
    const root    = analyzeOffline(F.SYSLOG_BRUTE_ROOT);
    const nonRoot = analyzeOffline(F.SYSLOG_BRUTE_NONROOT);
    assert.ok(rank(nonRoot.severity) < rank(root.severity),
      'root targeting must outrank an identical non-root burst');
  });

  test('a single failure is LOW and flagged as likely benign', () => {
    const r = analyzeOffline(F.SYSLOG_SINGLE_FAIL);
    assert.equal(r.severity, 'LOW');
    assert.equal(r.false_positive_likelihood, 'High');
  });

  test('severity rises monotonically with failure count', () => {
    const one  = analyzeOffline(F.SYSLOG_SINGLE_FAIL);
    const some = analyzeOffline(F.SYSLOG_BRUTE_NONROOT);
    const many = analyzeOffline(F.SYSLOG_BRUTE_ROOT);
    assert.ok(rank(one.severity) <= rank(some.severity));
    assert.ok(rank(some.severity) <= rank(many.severity));
  });

  test('extracts the targeted usernames as IOCs, not just the source IP', () => {
    const r = analyzeOffline(F.SYSLOG_BRUTE_ROOT);
    assert.ok(r.iocs.includes('185.220.101.45'));
    assert.ok(r.iocs.includes('user:root'));
    assert.ok(r.iocs.includes('user:admin'));
  });

  test('notes username enumeration when the account does not exist', () => {
    const r = analyzeOffline(F.SYSLOG_INVALID_USER);
    assert.match(r.analyst_notes, /does not exist|enumeration/i);
  });

  test('recognises sudo elevation as privilege escalation, not brute force', () => {
    const r = analyzeOffline(F.SYSLOG_SUDO);
    assert.equal(r.mitre_tactic, 'Privilege Escalation');
    assert.match(r.mitre_technique, /T1548\.003/);
  });
});

describe('windows event log', () => {
  test('download cradle in a script block is CRITICAL', () => {
    const r = analyzeOffline(F.WIN_POWERSHELL_MALICIOUS);
    assert.equal(r.severity, 'CRITICAL');
    assert.equal(r.threat_type, 'Malicious PowerShell');
    assert.equal(r.mitre_technique, 'T1059.001 - PowerShell');
    assert.equal(r.false_positive_likelihood, 'Low');
  });

  test('names the host and user in the IOC list', () => {
    const r = analyzeOffline(F.WIN_POWERSHELL_MALICIOUS);
    assert.ok(r.iocs.some(i => i.includes('DESKTOP-A7K2P')));
    assert.ok(r.iocs.some(i => i.includes('jsmith')));
    assert.ok(r.iocs.includes('192.168.1.200'), 'C2 address must be extracted');
  });

  test('PowerShell without dangerous indicators ranks below the malicious case', () => {
    const bad    = analyzeOffline(F.WIN_POWERSHELL_MALICIOUS);
    const benign = analyzeOffline(F.WIN_POWERSHELL_BENIGN);
    assert.ok(rank(benign.severity) < rank(bad.severity));
    assert.ok(benign.confidence < bad.confidence);
  });

  test('4625 maps to brute force at moderate severity', () => {
    const r = analyzeOffline(F.WIN_FAILED_LOGON);
    assert.equal(r.severity, 'MEDIUM');
    assert.match(r.mitre_technique, /T1110/);
  });

  test('4688 with UNC admin-share access is lateral movement', () => {
    const r = analyzeOffline(F.WIN_LATERAL);
    assert.equal(r.threat_type, 'Lateral Movement');
    assert.match(r.mitre_technique, /T1021/);
  });

  test('4688 touching scheduled tasks is persistence, not lateral movement', () => {
    const r = analyzeOffline(F.WIN_PERSISTENCE);
    assert.equal(r.threat_type, 'Persistence');
    assert.match(r.mitre_technique, /T1547\.001/);
  });
});

describe('suricata', () => {
  test('names Cobalt Strike specifically rather than generic malware', () => {
    const r = analyzeOffline(F.SURICATA_COBALT_STRIKE);
    assert.equal(r.severity, 'CRITICAL');
    assert.equal(r.threat_type, 'Cobalt Strike C2');
    assert.equal(r.mitre_technique, 'T1071.001 - Web Protocols');
  });

  test('carries the signature and both endpoints into the IOC list', () => {
    const r = analyzeOffline(F.SURICATA_COBALT_STRIKE);
    assert.ok(r.iocs.includes('10.0.0.22'));
    assert.ok(r.iocs.includes('198.51.100.45'));
    assert.ok(r.iocs.some(i => i.startsWith('sig:')));
  });

  test('recommends isolation and escalation for a confirmed beacon', () => {
    const r = analyzeOffline(F.SURICATA_COBALT_STRIKE);
    assert.match(r.recommended_action, /isolate/i);
    assert.match(r.recommended_action, /escalate|IR/i);
  });

  test('a port scan is reconnaissance and ranks well below C2', () => {
    const scan = analyzeOffline(F.SURICATA_SCAN);
    const c2   = analyzeOffline(F.SURICATA_COBALT_STRIKE);
    assert.equal(scan.threat_type, 'Reconnaissance');
    assert.match(scan.mitre_technique, /T1595/);
    assert.ok(rank(scan.severity) < rank(c2.severity));
  });

  test('exploit signatures map to initial access', () => {
    const r = analyzeOffline(F.SURICATA_EXPLOIT);
    assert.equal(r.mitre_tactic, 'Initial Access');
    assert.match(r.mitre_technique, /T1190/);
  });

  test('survives malformed JSON without throwing', () => {
    const r = analyzeOffline('{"event_type":"alert","alert":{"signature":"ET SCAN probe"');
    assert.ok(r.severity);
    assert.ok(r.summary);
  });
});

describe('zeek conn.log', () => {
  // Regression: the original engine scraped the raw text for long digit runs,
  // so the Unix timestamp became both the duration and the byte count - a
  // 3600-second flow was reported to the analyst as "473688h" and "1626MB".
  test('reports duration and volume from the real columns', () => {
    const r = analyzeOffline(F.ZEEK_BEACON);
    assert.match(r.summary, /1\.0h/, 'duration must come from the duration column');
    assert.match(r.summary, /2MB/, 'volume must come from orig_bytes');
    assert.doesNotMatch(r.summary, /473688/);
  });

  test('never reports a duration longer than the capture could contain', () => {
    const r = analyzeOffline(F.ZEEK_BEACON);
    const hours = Number((r.summary.match(/([\d.]+)h/) || [])[1]);
    assert.ok(hours > 0 && hours < 24, `implausible duration: ${hours}h`);
  });

  test('identifies a long high-volume flow as beaconing', () => {
    const r = analyzeOffline(F.ZEEK_BEACON);
    assert.equal(r.threat_type, 'C2 Beacon');
    assert.equal(r.mitre_tactic, 'Command and Control');
  });

  test('reaches the same verdict with no #fields header', () => {
    const withHeader = analyzeOffline(F.ZEEK_BEACON);
    const without    = analyzeOffline(F.ZEEK_NO_HEADER);
    assert.equal(without.threat_type, withHeader.threat_type);
    assert.equal(without.severity, withHeader.severity);
  });

  test('a large short upload is exfiltration rather than beaconing', () => {
    const r = analyzeOffline(F.ZEEK_EXFIL);
    assert.equal(r.mitre_tactic, 'Exfiltration');
    assert.match(r.mitre_technique, /T1048/);
  });

  test('an ordinary TLS flow raises no threat verdict', () => {
    const r = analyzeOffline(F.ZEEK_BENIGN);
    assert.equal(r.mitre_technique, 'Unknown');
    assert.ok(rank(r.severity) <= rank('MEDIUM'));
  });

  // Regression: suspicious-port detection used t.includes(String(port)), which
  // matched any substring anywhere in the line - including the timestamp.
  test('does not flag a C2 port that only appears inside the timestamp', () => {
    const benign = [
      '#fields ts uid id.orig_h id.orig_p id.resp_h id.resp_p proto service duration orig_bytes resp_bytes conn_state',
      '1705244440.123456 Cabc123 10.0.0.55 49201 93.184.216.34 443 tcp ssl 0.42 1840 9120 SF'
    ].join('\n');
    const r = analyzeOffline(benign);
    // A 0.42s, 1.8KB flow to 443 carries no threat signal whatever its
    // timestamp. Asserting on the absence of *any* verdict (not just the port
    // verdict) matters: the old parser also misread the timestamp as duration
    // and bytes, so it called this a C2 beacon before the port rule ran.
    assert.equal(r.mitre_technique, 'Unknown');
    assert.notEqual(r.threat_type, 'Suspicious Outbound Connection');
    assert.doesNotMatch(r.summary, /non-standard port/i);
  });

  test('flags a C2 port when it is the actual destination port', () => {
    const c2 = [
      '#fields ts uid id.orig_h id.orig_p id.resp_h id.resp_p proto service duration orig_bytes resp_bytes conn_state',
      '1705276800.123456 Cabc123 10.0.0.55 49201 203.0.113.99 31337 tcp - 12.00 4096 2048 SF'
    ].join('\n');
    const r = analyzeOffline(c2);
    assert.equal(r.threat_type, 'Suspicious Outbound Connection');
    assert.match(r.mitre_technique, /T1571/);
    assert.match(r.summary, /31337/);
  });
});

describe('CEF', () => {
  test('credential dumping is recognised even when the action was blocked', () => {
    const r = analyzeOffline(F.CEF_MIMIKATZ);
    assert.equal(r.threat_type, 'Credential Dumping');
    assert.match(r.mitre_technique, /T1003/);
    assert.equal(r.false_positive_likelihood, 'Low');
  });

  test('a blocked detection still demands investigation', () => {
    const r = analyzeOffline(F.CEF_MIMIKATZ);
    assert.match(r.recommended_action, /investigate|hunt|reset/i);
  });
});

describe('DNS', () => {
  test('base64 subdomains with high entropy are exfiltration', () => {
    const r = analyzeOffline(F.DNS_EXFIL);
    assert.equal(r.threat_type, 'DNS Exfiltration');
    assert.match(r.mitre_technique, /T1048\.003/);
    assert.equal(r.severity, 'HIGH');
  });

  test('captures the queried names as IOCs', () => {
    const r = analyzeOffline(F.DNS_EXFIL);
    assert.ok(r.iocs.some(i => i.startsWith('dns:') && i.includes('evilsite.xyz')));
  });
});

describe('free-form narrative', () => {
  test('spots lateral movement described in prose', () => {
    const r = analyzeOffline(F.NARRATIVE_LATERAL);
    assert.equal(r.threat_type, 'Lateral Movement');
    assert.match(r.mitre_technique, /T1021/);
  });

  test('a service-desk note is low severity and flagged as likely benign', () => {
    const r = analyzeOffline(F.NARRATIVE_BENIGN);
    assert.equal(r.severity, 'LOW');
    assert.equal(r.false_positive_likelihood, 'High');
    assert.match(r.analyst_notes, /timestamp|specific/i);
  });
});
