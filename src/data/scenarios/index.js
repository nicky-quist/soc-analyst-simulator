// Scenario registry

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
import cloudPublicBucket from './cloud-public-bucket.js';
import ddosOriginBypass from './ddos-origin-bypass.js';
import vendorRmmCompromise from './vendor-rmm-compromise.js';
import backupVendorMigration from './backup-vendor-migration.js';
import githubActionTagHijack from './github-action-tag-hijack.js';
import k8sBreakGlassDebug from './k8s-break-glass-debug.js';
import warroomRansomwareDetonation from './warroom-ransomware-detonation.js';

// Security org chart
export const COMPANY = {
  name: 'Coastal Trust Bank',
  soc: 'SEA SOC',
  analyst: {
    // Fallback title (real one is the earned rank)
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

// Scenario library
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
  cloudPublicBucket,
  ddosOriginBypass,
  vendorRmmCompromise,
  backupVendorMigration,
  githubActionTagHijack,
  k8sBreakGlassDebug,
];

// War Room follow-ons (never dealt)
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
