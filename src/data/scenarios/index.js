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
//   difficulty — 1 clear-cut, 2 needs a pivot, 3 genuinely ambiguous. The deal
//               uses it to make sure a shift is not all one register.

import sshBruteSuccess from './ssh-brute-success.js';
import vulnScanFalsePositive from './vuln-scan-false-positive.js';
import phishingBec from './phishing-bec.js';
import powershellPrecursor from './powershell-precursor.js';
import insiderExport from './insider-export.js';
import awsKeyLeak from './aws-key-leak.js';
import edrQuarantine from './edr-quarantine.js';
import mfaPushFatigue from './mfa-push-fatigue.js';
import impossibleTravelVpn from './impossible-travel-vpn.js';
import webShellUpload from './web-shell-upload.js';
import cryptoMiningBuildAgent from './crypto-mining-build-agent.js';
import oauthConsentGrant from './oauth-consent-grant.js';
import dnsTunnelSuspected from './dns-tunnel-suspected.js';
import warroomRansomwareDetonation from './warroom-ransomware-detonation.js';

// The security org chart, drawn only as deep as it's actually relevant to a
// Tier-1 shift — no HR, no marketing, nobody you'd never hear from. Each role
// carries who it reports to (for the Team tab's tree) and a one-line blurb of
// what it actually does in this sim, not a job-description fiction.
export const COMPANY = {
  name: 'Coastal Trust Bank',
  soc: 'SEA SOC',
  analyst: {
    // Title is a fallback for before any career history exists — everywhere
    // this actually renders, it's overridden by engine/progress.js's
    // careerStatus(), because the rank is earned, not handed out on page load.
    name: 'You', title: 'Trainee', reportsTo: 'tier2',
    blurb: 'Works the queue: investigates, enriches, responds, writes the report.',
  },
  tier2: {
    name: 'Jordan Reyes', title: 'Senior Analyst (Tier 2)', reportsTo: 'teamLead',
    blurb: "Sits one desk over. Won't hand you the answer, but will point at what you haven't looked at yet.",
  },
  teamLead: {
    name: 'Priya Anand', title: 'SOC Team Lead', reportsTo: 'ciso',
    blurb: 'Runs the shift. Reviews queue-level patterns across a whole night, not one case at a time.',
  },
  detectionEng: {
    name: 'Marcus Ibe', title: 'Detection Engineering Lead', reportsTo: 'ciso',
    blurb: "Owns the rules that generate these alerts. Cares when the tool's reported severity keeps missing.",
  },
  irLead: {
    name: 'Marcus Bell', title: 'IR Lead', reportsTo: 'ciso',
    blurb: 'Takes the handoff once something is escalated. Lives or dies by what evidence survived your response.',
  },
  ciso: {
    name: 'Sarah Okafor', title: 'CISO', reportsTo: 'ceo',
    blurb: 'Debriefs every closed case and reviews the shift as a whole.',
  },
  ceo: {
    name: 'David Reyes', title: 'CEO', reportsTo: null,
    blurb: 'Only shows up when a case actually reaches IR — wants the business answer, not the log excerpt.',
  },
};

// The library, not the queue. A shift deals seven of these — see
// ../../engine/deal.js — so the order here is just the order they were written.
export const SCENARIOS = [
  sshBruteSuccess,
  vulnScanFalsePositive,
  phishingBec,
  powershellPrecursor,
  insiderExport,
  awsKeyLeak,
  edrQuarantine,
  mfaPushFatigue,
  impossibleTravelVpn,
  webShellUpload,
  cryptoMiningBuildAgent,
  oauthConsentGrant,
  dnsTunnelSuspected,
];

// War Room follow-ons — deliberately not part of SCENARIOS/the deal pool.
// These never get dealt; engine/warroom.js injects one into a live shift when
// its trigger case closes with a response bad enough to earn it. Keyed by the
// scenario id that can trigger it.
export const WAR_ROOM_SCENARIOS = {
  [powershellPrecursor.id]: warroomRansomwareDetonation,
};

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
