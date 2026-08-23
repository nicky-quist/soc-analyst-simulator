// Scenario registry.
//
// Each scenario models one alert arriving in a Tier-1 queue at the fictional
// Coastal Trust Bank, and carries everything the console needs to behave like a
// real one:
//
//   alert     — the detection metadata a SIEM would hand you, including the
//               severity the tool reported, which is yours to confirm or overturn.
//   datasets  — the indexes that exist. Search anything else and you get an error.
//   searches  — what a query returns. The analyst has to type the indicator
//               correctly, pick the right index, and widen the time range past
//               the console's 15-minute default. Nothing here is clickable.
//   intel     — what the threat feeds hold. Anything not listed returns "no
//               records", which is not the same thing as "clean".
//   actions   — the response actions available, and what each one really does.
//               Some of them cause damage; that is the point.
//   truth     — ground truth for grading, including which searches and lookups
//               a competent investigation has to include.

import sshBruteSuccess from './ssh-brute-success.js';
import vulnScanFalsePositive from './vuln-scan-false-positive.js';
import phishingBec from './phishing-bec.js';
import powershellPrecursor from './powershell-precursor.js';
import insiderExport from './insider-export.js';
import awsKeyLeak from './aws-key-leak.js';
import edrQuarantine from './edr-quarantine.js';

export const COMPANY = {
  name: 'Coastal Trust Bank',
  soc: 'Coastal SOC',
  analyst: { name: 'You', title: 'Tier 1 Analyst', shift: 'Day shift · 07:00–15:00' },
  ciso: { name: 'Sarah Okafor', title: 'CISO' },
  ceo: { name: 'David Reyes', title: 'CEO' },
};

export const SCENARIOS = [
  sshBruteSuccess,
  vulnScanFalsePositive,
  phishingBec,
  powershellPrecursor,
  insiderExport,
  awsKeyLeak,
  edrQuarantine,
];

export const ESCALATION_OPTIONS = [
  { value: 'close_no_escalation', label: 'Close — Benign / Expected Activity' },
  { value: 'close_false_positive', label: 'Close — False Positive' },
  { value: 'escalate_tier2', label: 'Escalate to Tier 2 Analyst' },
  { value: 'escalate_ir', label: 'Escalate to Incident Response (Critical)' },
];

export const CLASSIFICATION_OPTIONS = [
  { value: 'true_positive', label: 'True Positive' },
  { value: 'false_positive', label: 'False Positive' },
  { value: 'benign_expected', label: 'Benign / Expected Activity' },
  { value: 'suspicious_needs_more_info', label: 'Suspicious — Needs More Investigation' },
];

export const SEVERITY_OPTIONS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'];
