// Tests for the grading engine. Run with `npm test` (Node's built-in test
// runner — no test framework dependency needed).
//
// The grading is the part of this project that has to be trustworthy: if the
// rubric silently stops matching, the sim quietly teaches the wrong lesson.

import test from 'node:test';
import assert from 'node:assert/strict';

import { SCENARIOS } from '../src/data/scenarios/index.js';
import {
  scoreCase,
  evaluateInvestigation,
  evaluateResponse,
  gradeSeverity,
  gradeTechnique,
  findKeyword,
  isResolvedCorrectly,
} from '../src/engine/scoring.js';
import { generateCisoResponse, generateCeoResponse, generateShiftSummary } from '../src/engine/personas.js';
import { findTechnique } from '../src/data/techniques.js';

const byId = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

// A textbook-perfect report for each scenario, written the way an analyst would
// actually write it — not a keyword dump.
const IDEAL = {
  'ssh-brute-success': {
    summary:
      'Brute force from 185.220.101.45 (a known Tor exit node) ended in an accepted password for root on the production database server db-prod-03. SSH should not be reachable from the internet on this host — that is configuration drift from the hardening baseline. Post-login the attacker read /etc/shadow and built a tar archive of the mysql data directory, consistent with credential theft and data staging for exfiltration.',
    remediation:
      'Isolate db-prod-03 from the network immediately, preserve a memory image, then reset and rotate root credentials and any keys stored on the host.',
  },
  'vuln-scan-false-positive': {
    summary:
      'The source 10.20.9.14 is vulnscan-01, the internal Qualys scanner owned by Security Engineering. Confirmed against the change calendar: this fired during the scheduled Friday scan window, so the behavior is expected and benign rather than an incident.',
    remediation:
      'No containment action is warranted against our own authorized security asset. Recommend tuning this signature to suppress it during the known scan window so it stops generating noise.',
  },
  'phishing-bec-ambiguous': {
    summary:
      'This is one account compromise, not four separate issues: the user entered credentials on a phishing page, an impossible-travel sign-in from Lagos followed minutes later using a replayed device token, the attacker created an inbox rule hiding wire and invoice mail from the user, and then sent a vendor banking-change email to accounting. Taken together this is attempted BEC wire fraud.',
    remediation:
      'Immediately revoke sessions and force a password reset, remove the rule from the mailbox, and notify Accounting to stop the payment before it is processed.',
  },
  'malicious-powershell-precursor': {
    summary:
      'Invoice_08212026.docm, a macro document delivered by email, spawned a hidden PowerShell downloader that pulls a second-stage payload in memory from 198.51.100.77. The host then created a scheduled task for persistence and ran net view to enumerate shares — lateral movement reconnaissance consistent with ransomware precursor activity.',
    remediation:
      'Isolate FIN-WKSTN-22 from the network now, and search mail for the same attachment sent to other mailboxes to scope the campaign.',
  },
  'insider-after-hours-ambiguous': {
    summary:
      "The employee's role as a Senior Underwriter carries legitimate access to loan records, so access alone is not the anomaly. The export volume of 4,812 records is far outside their established normal pattern, it ran after hours to removable media, and it came three days after they submitted a resignation. No ticket or approved business justification exists for a bulk export of this size.",
    remediation:
      'Escalate to HR, Legal and the insider threat program alongside Security, and preserve the endpoint and DLP evidence pending investigation.',
  },
  'aws-key-leak': {
    summary:
      'A long-lived access key for the svc-etl-loader service account was committed to the public repository coastal-data-tools six days ago and picked up from 45.83.42.19. The key enumerated the account and downloaded two quarterly export files from ctb-customer-data — roughly 12,900 customer loan records containing PII, so this is data obtained rather than merely exposed. Two CreateUser and AttachUserPolicy calls failed, which shows intent to establish persistent access. The key had never been rotated in 29 months and carried an unused iam:CreateUser permission.',
    remediation:
      'Deactivate the key immediately — cleaning the repository does not invalidate it — preserve CloudTrail and S3 logs, and engage Legal and Privacy on notification obligations for the records that left.',
  },
  'edr-quarantine-dual-use': {
    summary:
      'On IT-LT-07 the file was quarantined and never ran, so this host is not compromised. The finding is that the same hash executed unblocked on IT-WKSTN-31 and FS-UTIL-02 two days ago, where the sensor is 14 months out of date and in detect-only mode. The user is a Systems Administrator in Domain Admins, so credential material on those hosts has to be treated as potentially exposed and rotated. The tool is dual-use and there is a pending approval request, REQ-9142, raised nine days ago and still unapproved, so intent is not established.',
    remediation:
      'Route to Tier 2 for a hunt on the two affected hosts, preserve the sample and USB device history, and raise a ticket to bring both sensors to the current version.',
  },
  'mfa-push-fatigue': {
    summary:
      'This is a successful account takeover, not a user error. The password succeeded on every attempt and only the second factor was challenged, so the credential was already stolen; the attacker sent fourteen push prompts in eleven minutes until one was approved. Six minutes later they registered their own Microsoft Authenticator device and a proton.me recovery address, and created an inbox rule hiding security mail from the user. Treasury wire templates and the counterparty contact list were then downloaded to the attacker address.',
    remediation:
      'Revoke all sessions and refresh tokens, remove the attacker-registered authenticator and recovery address before resetting the password, and delete the inbox rule. Hand the other three targeted accounts to IR to work out where the passwords came from.',
  },
  'impossible-travel-vpn': {
    summary:
      'The Frankfurt address is our own corporate VPN egress, leased by Network Engineering and never registered in Entra ID named locations, which is why the platform reads it as another country. The emergency failover under CHG-4482 started six minutes before the alert. The same compliant managed device and a satisfied MFA claim appear on both sides of the "travel", and 61 users show the same jump inside fourteen minutes. The audit log shows no MFA registration, no inbox rule and no consent grant for this user.',
    remediation:
      'No containment is warranted. Close as a false positive citing the change ticket, and raise a request to add the EU egress range to named locations so the next failover does not generate another sixty of these.',
  },
  'web-shell-upload': {
    summary:
      'status.aspx in the customer document upload directory is a web shell being used for remote command execution on WEB-PROD-02. The IIS logs show it answering POSTs from 103.163.220.47 since 18 August, so access began three days before this alert. Through it the attacker ran whoami and domain enumeration, listed a loan file share, used certutil to download sq.exe and connected outbound to a known C2 address, with 118 MB leaving the host. The server is internet-facing, three framework versions behind, in detect-only mode, and holds customer loan documents.',
    remediation:
      'Isolate the host with EDR so it stays powered on and reachable, then capture memory and snapshot the volume before any cleanup. Block the C2 address, notify the application owner, and hand to IR for scoping of what was accessed.',
  },
  'crypto-mining-build-agent': {
    summary:
      'The miner was launched by a postinstall script in pdf-glyph-tools 2.4.1, a dormant npm dependency republished two days ago, pulled into build job #8841 — no person installed it. It ran as svc-build on a host holding a deployment token and a signing-service key, and registered a scheduled task named OneDriveSync32 running as SYSTEM for persistence. BUILD-AGENT-02 started mining 43 minutes later from the same dependency, so it spreads with every job that installs the package.',
    remediation:
      'Isolate both agents and stop the running jobs, rotate the deployment token and signing key, and block that package version at the internal proxy. Tier 2 should establish what job #8841 published and whether the signing key was used.',
  },
  'oauth-consent-grant': {
    summary:
      'This is consent phishing: no password was stolen, the user approved an OAuth grant giving an attacker-registered application Mail.Read, Files.Read.All and offline_access. The application has already acted on it — it synced 38 inbox items, searched the mailbox for "wire" and "invoice", and opened a rate sheet — so access is actual, not theoretical. The lure reached 11 mailboxes from statements-ctb.app, a domain registered two days ago, and 2 users consented nine minutes apart.',
    remediation:
      'Revoke the consent and delete the service principal, and revoke the refresh tokens issued to both users — deleting the app alone leaves existing tokens working. Purge the message from the other nine mailboxes and check them for further grants.',
  },
  'dns-tunnel-suspected': {
    summary:
      'MKT-LT-19 made 13,940 TXT queries in six hours with 13,902 unique subdomain labels averaging 48 characters, which is the shape of data encoded into names rather than of name resolution. The queries come from AdCopyStudio.exe, validly signed by Bright Harbor Media and installed by the user on 19 August; it has no entry in the approved software register. The vendor is reachable over HTTPS and the product used it to activate, so there is no technical reason for a telemetry channel over DNS to an unrelated domain. I could not read the payload, so whether this is vendor telemetry or exfiltration is not established.',
    remediation:
      'Sinkhole the domain at the resolver so the channel stops while the host and the sample stay intact, and preserve the three days of query labels with the case. Tier 2 to decode a sample and contact the vendor before any decision to remove the software.',
  },
};

function idealSubmission(scenario) {
  return {
    classification: scenario.truth.classification,
    severity: scenario.truth.severity,
    mitreTechnique: scenario.truth.mitreTechnique,
    escalation: scenario.truth.escalation,
    ...IDEAL[scenario.id],
  };
}

function idealCase(scenario) {
  return {
    searchesRun: [...(scenario.truth.requiredSearches || [])],
    intelChecked: [...(scenario.truth.requiredIntel || [])],
    actionsTaken: [...(scenario.truth.requiredActions || [])],
  };
}

test('every rubric point is machine-scorable', () => {
  for (const scenario of SCENARIOS) {
    for (const point of scenario.truth.requiredReportPoints) {
      const hasKeywords = (point.any && point.any.length) || (point.none && point.none.length);
      assert.ok(hasKeywords, `${scenario.id}: unscorable point "${point.point}"`);
    }
  }
});

test("every scenario's ground-truth technique exists in the ATT&CK catalog", () => {
  for (const scenario of SCENARIOS) {
    assert.ok(findTechnique(scenario.truth.mitreTechnique), `${scenario.id}: ${scenario.truth.mitreTechnique}`);
  }
});

test('every required action exists and is actually a required-verdict action', () => {
  for (const scenario of SCENARIOS) {
    for (const id of scenario.truth.requiredActions || []) {
      const action = scenario.actions.find((a) => a.id === id);
      assert.ok(action, `${scenario.id}: missing action ${id}`);
      assert.equal(action.verdict, 'required', `${scenario.id}: ${id} is marked ${action.verdict}`);
    }
    assert.ok(
      scenario.actions.some((a) => a.verdict === 'harmful'),
      `${scenario.id}: no way for the analyst to make things worse`
    );
    for (const action of scenario.actions.filter((a) => a.verdict === 'harmful')) {
      assert.ok(action.consequence, `${scenario.id}: harmful action ${action.id} has no consequence`);
    }
  }
});

test('a perfect case scores 100 on every scenario', () => {
  for (const scenario of SCENARIOS) {
    const score = scoreCase(scenario, idealSubmission(scenario), idealCase(scenario));
    assert.equal(
      score.overallScore,
      100,
      `${scenario.id} scored ${score.overallScore}; missed: ${score.rubricResults
        .filter((r) => !r.matched)
        .map((r) => r.point)
        .join(' | ')}`
    );
    assert.ok(isResolvedCorrectly(score));
  }
});

test('an empty case fails and credits nothing', () => {
  const score = scoreCase(byId['ssh-brute-success'], {
    classification: '', severity: '', mitreTechnique: '', escalation: '', summary: '', remediation: '',
  }, {});
  assert.equal(score.overallScore, 0);
  assert.equal(isResolvedCorrectly(score), false);
});

test('keyword matching respects word boundaries', () => {
  assert.equal(findKeyword('walked through the logs', 'hr'), null);
  assert.ok(findKeyword('escalate to HR and Legal', 'hr'));
  assert.equal(findKeyword('a known bad IP', 'now'), null);
  assert.ok(findKeyword('contain the account now', 'now'));
  assert.ok(findKeyword('isolation of the host', 'isolat*'));
  assert.equal(findKeyword('the target directory', 'tar'), null);
});

test('avoidance points fail on assertion but survive negation and hedging', () => {
  const scenario = byId['vuln-scan-false-positive'];
  const base = idealSubmission(scenario);

  const asserted = scoreCase(scenario, { ...base, remediation: 'Block 10.20.9.14 at the firewall.' }, idealCase(scenario));
  assert.equal(asserted.rubricResults.find((r) => r.kind === 'avoid').matched, false);

  const negated = scoreCase(scenario, {
    ...base,
    remediation: 'Do not block or isolate this host — it is our own scanner. Recommend tuning the signature.',
  }, idealCase(scenario));
  assert.equal(negated.rubricResults.find((r) => r.kind === 'avoid').matched, true);
});

test('insider case rewards hedged language and penalizes declaring theft as fact', () => {
  const scenario = byId['insider-after-hours-ambiguous'];
  const base = idealSubmission(scenario);
  const languagePoint = (score) =>
    score.rubricResults.find((r) => r.point.startsWith('uses professional, non-accusatory')).matched;

  assert.equal(languagePoint(scoreCase(scenario, base, idealCase(scenario))), true);
  assert.equal(
    languagePoint(scoreCase(scenario, { ...base, summary: `${base.summary} This is potential data theft pending review.` }, idealCase(scenario))),
    true
  );
  assert.equal(
    languagePoint(scoreCase(scenario, { ...base, summary: 'The employee stole customer records before quitting.' }, idealCase(scenario))),
    false
  );
});

test('severity grading gives partial credit one step off', () => {
  assert.deepEqual(gradeSeverity('CRITICAL', 'CRITICAL'), { correct: true, credit: 1, distance: 0 });
  assert.equal(gradeSeverity('HIGH', 'CRITICAL').credit, 0.5);
  assert.equal(gradeSeverity('LOW', 'CRITICAL').credit, 0);
  assert.equal(gradeSeverity('', 'CRITICAL').credit, 0);
});

test('MITRE grading accepts the parent technique and rejects the wrong one', () => {
  assert.ok(gradeTechnique('T1110.001', 'T1110.001'));
  assert.ok(gradeTechnique('t1110', 'T1110.001'));
  assert.equal(gradeTechnique('T1078', 'T1110.001'), false);
  assert.equal(gradeTechnique('', 'T1110.001'), false);
});

test('investigation coverage tracks the searches and lookups actually run', () => {
  const scenario = byId['ssh-brute-success'];
  const none = evaluateInvestigation(scenario, {});
  assert.equal(none.coverage, 0);
  assert.equal(none.missed.length, none.requiredCount);
  assert.ok(none.missed.some((m) => /intel lookup/i.test(m)));

  const all = evaluateInvestigation(scenario, idealCase(scenario));
  assert.equal(all.coverage, 1);
  assert.deepEqual(all.missed, []);
});

test('a harmful response action costs credit and fails the verdict outright', () => {
  const scenario = byId['vuln-scan-false-positive'];
  const submission = idealSubmission(scenario);
  const caseFile = { ...idealCase(scenario), actionsTaken: [...idealCase(scenario).actionsTaken, 'isolate-scanner'] };

  const response = evaluateResponse(scenario, caseFile);
  assert.equal(response.harmful.length, 1);
  assert.ok(response.credit < 1);

  const score = scoreCase(scenario, submission, caseFile);
  assert.ok(score.overallScore < 100);
  assert.equal(isResolvedCorrectly(score), false, 'isolating your own scanner is not a resolved case');
  assert.match(generateCisoResponse(scenario, submission, score).message, /should not have happened/i);
});

test('skipping a required containment action is called out even when the call was right', () => {
  const scenario = byId['phishing-bec-ambiguous'];
  const submission = idealSubmission(scenario);
  const caseFile = { ...idealCase(scenario), actionsTaken: ['revoke-sessions', 'reset-password', 'remove-rule'] };
  const score = scoreCase(scenario, submission, caseFile);

  assert.deepEqual(score.response.missing, ['Call Accounting to hold the pending vendor payment']);
  assert.match(generateCisoResponse(scenario, submission, score).message, /response stopped short/i);
});

test('CISO calls out a right answer reached without investigating', () => {
  const scenario = byId['ssh-brute-success'];
  const submission = idealSubmission(scenario);
  const blind = scoreCase(scenario, submission, { actionsTaken: scenario.truth.requiredActions });
  assert.match(generateCisoResponse(scenario, submission, blind).message, /without doing the work/i);

  const worked = scoreCase(scenario, submission, idealCase(scenario));
  assert.equal(generateCisoResponse(scenario, submission, worked).tone, 'positive');
});

test('CISO reacts to under- and over-escalation ahead of everything but harm', () => {
  const scenario = byId['ssh-brute-success'];
  const under = { ...idealSubmission(scenario), escalation: 'close_no_escalation' };
  assert.equal(generateCisoResponse(scenario, under, scoreCase(scenario, under, idealCase(scenario))).tone, 'concerned');

  const fp = byId['vuln-scan-false-positive'];
  const over = { ...idealSubmission(fp), escalation: 'escalate_ir' };
  assert.equal(generateCisoResponse(fp, over, scoreCase(fp, over, idealCase(fp))).tone, 'neutral');
});

test('CISO flags a severity call that is two steps off', () => {
  const scenario = byId['ssh-brute-success'];
  const submission = { ...idealSubmission(scenario), severity: 'MEDIUM' };
  const score = scoreCase(scenario, submission, idealCase(scenario));
  assert.match(generateCisoResponse(scenario, submission, score).message, /severity/i);
});

test('a severity call two steps off fails the verdict even when the call is right', () => {
  const scenario = byId['ssh-brute-success'];
  const ideal = idealSubmission(scenario);
  assert.equal(isResolvedCorrectly(scoreCase(scenario, { ...ideal, severity: 'HIGH' }, idealCase(scenario))), true);
  assert.equal(isResolvedCorrectly(scoreCase(scenario, { ...ideal, severity: 'MEDIUM' }, idealCase(scenario))), false);
});

test('the CEO only weighs in on incidents that actually reached IR', () => {
  const bec = byId['phishing-bec-ambiguous'];
  assert.ok(generateCeoResponse(bec, idealSubmission(bec)));
  assert.equal(generateCeoResponse(bec, { ...idealSubmission(bec), escalation: 'escalate_tier2' }), null);
  assert.equal(generateCeoResponse(byId['vuln-scan-false-positive'], idealSubmission(byId['vuln-scan-false-positive'])), null);
});

test('response-time target is evaluated only where the scenario defines one', () => {
  const bec = byId['phishing-bec-ambiguous'];
  assert.equal(scoreCase(bec, idealSubmission(bec), { elapsedMs: 4 * 60_000 }).withinResponseTarget, true);
  assert.equal(scoreCase(bec, idealSubmission(bec), { elapsedMs: 40 * 60_000 }).withinResponseTarget, false);

  const insider = byId['insider-after-hours-ambiguous'];
  assert.equal(scoreCase(insider, idealSubmission(insider), { elapsedMs: 60_000 }).withinResponseTarget, null);
});

test('shift summary leads with damage, then missed escalations', () => {
  const perfect = SCENARIOS.map((s) => ({
    submission: idealSubmission(s),
    score: scoreCase(s, idealSubmission(s), idealCase(s)),
  }));
  const good = generateShiftSummary(perfect);
  assert.equal(good.resolved, SCENARIOS.length);
  assert.equal(good.avgScore, 100);
  assert.equal(good.persona.tone, 'positive');

  const withMiss = perfect.map((r, i) => {
    if (i !== 0) return r;
    const submission = { ...r.submission, escalation: 'close_no_escalation' };
    return { submission, score: scoreCase(SCENARIOS[0], submission, idealCase(SCENARIOS[0])) };
  });
  const missed = generateShiftSummary(withMiss);
  assert.equal(missed.missedEscalations, 1);
  assert.match(missed.persona.message, /escalation/i);

  const withHarm = perfect.map((r, i) => {
    if (i !== 1) return r;
    const caseFile = { ...idealCase(SCENARIOS[1]), actionsTaken: ['close-benign', 'suppress-tune', 'isolate-scanner'] };
    return { submission: r.submission, score: scoreCase(SCENARIOS[1], r.submission, caseFile) };
  });
  const harmed = generateShiftSummary(withHarm);
  assert.equal(harmed.harmfulActions, 1);
  assert.equal(harmed.persona.tone, 'concerned');
  assert.match(harmed.persona.message, /damage/i);
});
