// Estate-wide numbers for the shift dashboard.
//
// Your queue is seven alerts. A real SOC's dashboard exists to show you the
// other 99% you are not looking at: what the pipeline swallowed before it
// reached a human, which sources are producing noise, and whether the team is
// keeping up. The funnel numbers below are the shape most banks actually see —
// millions of events, a four-figure alert count, and a two-figure number of
// things a person ever reads.

export const SHIFT = {
  label: 'Friday 21 August 2026',
  window: 'Day shift · 07:00–15:00',
  onCall: 'IR on-call: M. Bell · Duty CISO: S. Okafor',
};

export const AUTOMATION_FUNNEL = [
  { stage: 'Events ingested', value: 41208442, note: 'across 38 log sources' },
  { stage: 'Correlated into alerts', value: 1284, note: 'detection rules fired' },
  { stage: 'Auto-triaged or suppressed', value: 1179, note: 'playbooks, allowlists, tuning' },
  { stage: 'Routed to an analyst', value: 105, note: 'across three shifts' },
];

// 24 hours of alert volume by severity, ending at the current shift.
export const HOURLY_VOLUME = [
  { hour: '00', critical: 0, high: 2, medium: 6, low: 19 },
  { hour: '01', critical: 0, high: 1, medium: 4, low: 14 },
  { hour: '02', critical: 1, high: 3, medium: 5, low: 12 },
  { hour: '03', critical: 0, high: 1, medium: 3, low: 11 },
  { hour: '04', critical: 0, high: 0, medium: 4, low: 9 },
  { hour: '05', critical: 0, high: 1, medium: 5, low: 13 },
  { hour: '06', critical: 1, high: 2, medium: 8, low: 22 },
  { hour: '07', critical: 0, high: 4, medium: 14, low: 38 },
  { hour: '08', critical: 0, high: 6, medium: 19, low: 51 },
  { hour: '09', critical: 0, high: 9, medium: 24, low: 63 },
  { hour: '10', critical: 1, high: 7, medium: 21, low: 57 },
  { hour: '11', critical: 1, high: 8, medium: 18, low: 49 },
  { hour: '12', critical: 0, high: 5, medium: 15, low: 41 },
  { hour: '13', critical: 0, high: 6, medium: 17, low: 44 },
  { hour: '14', critical: 1, high: 7, medium: 16, low: 39 },
  { hour: '15', critical: 0, high: 4, medium: 12, low: 33 },
  { hour: '16', critical: 0, high: 5, medium: 13, low: 35 },
  { hour: '17', critical: 0, high: 3, medium: 10, low: 28 },
  { hour: '18', critical: 0, high: 2, medium: 8, low: 24 },
  { hour: '19', critical: 0, high: 2, medium: 7, low: 21 },
  { hour: '20', critical: 0, high: 1, medium: 6, low: 18 },
  { hour: '21', critical: 0, high: 2, medium: 5, low: 16 },
  { hour: '22', critical: 0, high: 1, medium: 5, low: 15 },
  { hour: '23', critical: 1, high: 2, medium: 4, low: 13 },
];

export const SLA_TREND = [
  { day: 'Sat', pct: 96 },
  { day: 'Sun', pct: 98 },
  { day: 'Mon', pct: 91 },
  { day: 'Tue', pct: 88 },
  { day: 'Wed', pct: 93 },
  { day: 'Thu', pct: 95 },
  { day: 'Fri', pct: 92 },
];

export const DETECTION_SOURCES = [
  { source: 'Suricata IDS', alerts: 412, autoClosed: 381 },
  { source: 'CrowdStrike EDR', alerts: 268, autoClosed: 231 },
  { source: 'M365 Defender', alerts: 244, autoClosed: 205 },
  { source: 'Splunk correlation', alerts: 171, autoClosed: 149 },
  { source: 'AWS GuardDuty', alerts: 96, autoClosed: 88 },
  { source: 'DLP platform', alerts: 61, autoClosed: 55 },
  { source: 'User-reported phishing', alerts: 32, autoClosed: 24 },
];

export const TOP_ENTITIES = [
  { entity: 'db-prod-03', type: 'host', alerts: 14, risk: 'CRITICAL' },
  { entity: 'jmartinez', type: 'user', alerts: 11, risk: 'CRITICAL' },
  { entity: 'FIN-WKSTN-22', type: 'host', alerts: 9, risk: 'CRITICAL' },
  { entity: 'svc-etl-loader', type: 'service', alerts: 8, risk: 'HIGH' },
  { entity: 'dkraft', type: 'user', alerts: 6, risk: 'HIGH' },
  { entity: 'vulnscan-01', type: 'host', alerts: 5, risk: 'LOW' },
];

// Detection coverage by ATT&CK tactic — the view that tells a SOC where it is
// blind, and the reason case tools insist on a technique mapping per incident.
export const TACTIC_COVERAGE = [
  { tactic: 'Initial Access', pct: 84 },
  { tactic: 'Execution', pct: 91 },
  { tactic: 'Persistence', pct: 76 },
  { tactic: 'Privilege Escalation', pct: 68 },
  { tactic: 'Defense Evasion', pct: 55 },
  { tactic: 'Credential Access', pct: 79 },
  { tactic: 'Discovery', pct: 62 },
  { tactic: 'Lateral Movement', pct: 71 },
  { tactic: 'Collection', pct: 58 },
  { tactic: 'Exfiltration', pct: 66 },
  { tactic: 'Impact', pct: 81 },
];

// The live tail every console has running somewhere: mostly nothing, which is
// the point — it is what "normal" looks like underneath your seven alerts.
export const ESTATE_FEED = [
  { source: 'Suricata', text: 'ET POLICY outbound TLS to newly-registered domain — 10.20.7.44', level: 'low' },
  { source: 'Defender', text: 'Sign-in from unfamiliar browser — hstern@coastaltrustbank.com', level: 'low' },
  { source: 'CrowdStrike', text: 'PUP quarantined on MKT-LT-19 — toolbar installer', level: 'low' },
  { source: 'Splunk', text: '5 failed logons then success — sgarcia (password change window)', level: 'medium' },
  { source: 'DLP', text: 'Email with 2 account numbers blocked to external recipient', level: 'medium' },
  { source: 'GuardDuty', text: 'API call from new region rejected by SCP — eu-west-2', level: 'low' },
  { source: 'Suricata', text: 'ET SCAN Nmap TCP scan — 10.20.9.14 (known scanner)', level: 'low' },
  { source: 'Defender', text: 'Impossible travel dismissed — corporate VPN egress', level: 'low' },
  { source: 'Splunk', text: 'Service account logon outside schedule — svc-backup', level: 'medium' },
  { source: 'CrowdStrike', text: 'Sensor offline > 24h — IT-WKSTN-31', level: 'medium' },
  { source: 'Proxy', text: 'Uncategorized destination allowed — 4 requests, 12KB', level: 'low' },
  { source: 'DLP', text: 'USB write blocked by policy — LEND-LT-09', level: 'medium' },
  { source: 'Defender', text: 'Mailbox rule created — moves newsletters to a folder', level: 'low' },
  { source: 'Suricata', text: 'ET INFO observed DNS query to dyndns provider', level: 'low' },
  { source: 'GuardDuty', text: 'S3 bucket policy changed — ctb-public-assets', level: 'medium' },
  { source: 'Splunk', text: 'Kerberos pre-auth failures — 3 accounts, one source', level: 'medium' },
  { source: 'CrowdStrike', text: 'Script execution blocked by policy — DEV-LT-02', level: 'low' },
  { source: 'Proxy', text: 'Large upload to sanctioned cloud storage — 240MB', level: 'medium' },
];

export function funnelTotals(queueSize) {
  return [...AUTOMATION_FUNNEL, { stage: 'In your queue', value: queueSize, note: 'what a human actually reads' }];
}

export function formatCount(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}
