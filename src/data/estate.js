// Estate dashboard data

import { between, mulberry32, pick, shiftSeed } from '../engine/random.js';

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Shift seed
function seedFor(startedAt, variant = 0, salt = 0) {
  return (shiftSeed(startedAt) ^ Math.imul(variant + 1, 0x9e3779b1) ^ salt) >>> 0;
}

const SHIFT_BLOCKS = [
  { name: 'Night shift', window: '23:00–07:00' },
  { name: 'Day shift', window: '07:00–15:00' },
  { name: 'Swing shift', window: '15:00–23:00' },
];

const IR_ON_CALL = ['M. Bell', 'R. Okonkwo', 'T. Vasquez', 'J. Hale', 'A. Duarte'];
const DUTY_CISO = ['S. Okafor', 'D. Lindqvist', 'P. Raghavan'];

function shiftBlock(hour) {
  if (hour < 7) return SHIFT_BLOCKS[0];
  if (hour < 15) return SHIFT_BLOCKS[1];
  if (hour < 23) return SHIFT_BLOCKS[2];
  return SHIFT_BLOCKS[0];
}

// Shift header
export function buildShift(startedAt = Date.now(), variant = 0) {
  const rand = mulberry32(seedFor(startedAt, variant));
  const date = new Date(startedAt);
  const block = shiftBlock(date.getHours());
  return {
    label: `${WEEKDAY_LONG[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`,
    window: `${block.name} · ${block.window}`,
    onCall: `IR on-call: ${pick(rand, IR_ON_CALL)} · Duty CISO: ${pick(rand, DUTY_CISO)}`,
  };
}

// Detection sources
export const DETECTION_SOURCES = [
  { source: 'Suricata IDS', alerts: 412, autoClosed: 381 },
  { source: 'CrowdStrike EDR', alerts: 268, autoClosed: 231 },
  { source: 'M365 Defender', alerts: 244, autoClosed: 205 },
  { source: 'Splunk correlation', alerts: 171, autoClosed: 149 },
  { source: 'AWS GuardDuty', alerts: 96, autoClosed: 88 },
  { source: 'DLP platform', alerts: 61, autoClosed: 55 },
  { source: 'User-reported phishing', alerts: 32, autoClosed: 24 },
];

const TOTAL_ALERTS = DETECTION_SOURCES.reduce((sum, s) => sum + s.alerts, 0);
const TOTAL_AUTO_CLOSED = DETECTION_SOURCES.reduce((sum, s) => sum + s.autoClosed, 0);

export const AUTOMATION_FUNNEL = [
  { stage: 'Events ingested', value: 41208442, note: 'across 38 log sources' },
  { stage: 'Correlated into alerts', value: TOTAL_ALERTS, note: 'detection rules fired' },
  { stage: 'Auto-triaged or suppressed', value: TOTAL_AUTO_CLOSED, note: 'playbooks, allowlists, tuning' },
  { stage: 'Routed to an analyst', value: TOTAL_ALERTS - TOTAL_AUTO_CLOSED, note: 'across three shifts' },
];

// Hourly volume shape
const HOURLY_BASELINE = [
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

export const SLA_TARGET = 90;

// 24h alert volume
export function buildHourlyVolume(startedAt = Date.now(), variant = 0) {
  const rand = mulberry32(seedFor(startedAt, variant, 0x1f5));
  const endHour = new Date(startedAt).getHours();
  const jitter = (value) => {
    if (!value) return rand() < 0.12 ? 1 : 0;
    return Math.max(0, Math.round(value * (0.75 + rand() * 0.5)));
  };

  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = (endHour + 1 + i) % 24;
    const base = HOURLY_BASELINE[hour];
    return {
      hour: String(hour).padStart(2, '0'),
      critical: jitter(base.critical),
      high: jitter(base.high),
      medium: jitter(base.medium),
      low: jitter(base.low),
    };
  });

  // Burst in the back half
  const burst = hours[between(rand, 14, 22)];
  burst.critical += between(rand, 1, 2);
  burst.high += between(rand, 3, 6);
  burst.medium += between(rand, 4, 9);
  burst.low += between(rand, 8, 20);

  return hours;
}

export const TOP_ENTITIES = [
  { entity: 'db-prod-03', type: 'host', alerts: 14, risk: 'CRITICAL' },
  { entity: 'jmartinez', type: 'user', alerts: 11, risk: 'CRITICAL' },
  { entity: 'FIN-WKSTN-22', type: 'host', alerts: 9, risk: 'CRITICAL' },
  { entity: 'svc-etl-loader', type: 'service', alerts: 8, risk: 'HIGH' },
  { entity: 'dkraft', type: 'user', alerts: 6, risk: 'HIGH' },
  { entity: 'vulnscan-01', type: 'host', alerts: 5, risk: 'LOW' },
];

// ATT&CK coverage by tactic
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

// Estate feed
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
