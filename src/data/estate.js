// Estate-wide numbers for the shift dashboard.
//
// Your queue is seven alerts. A real SOC's dashboard exists to show you the
// other 99% you are not looking at: what the pipeline swallowed before it
// reached a human, which sources are producing noise, and whether the team is
// keeping up. The funnel numbers below are the shape most banks actually see —
// millions of events, a four-figure alert count, and a two-figure number of
// things a person ever reads.
//
// Anything that describes *this* shift — the header, the 24h volume chart, the
// week of SLA compliance behind it — is built from the shift's seed rather than
// frozen into the file. Frozen numbers read as a screenshot: the same Tuesday
// slips below target every time you open the console, which teaches you to stop
// looking at the chart. Seeded numbers hold still for the length of a shift and
// are a different week the next time you sit down.

import { between, mulberry32, pick, shiftSeed } from '../engine/random.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// Two shifts can start in the same 8-hour block — reset the board and you get
// another one — so the deal counter is folded in as well.
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

// The header a console shows you when you badge in: today's date, the block you
// are sitting in, and who to wake up if this turns into an incident.
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

export const AUTOMATION_FUNNEL = [
  { stage: 'Events ingested', value: 41208442, note: 'across 38 log sources' },
  { stage: 'Correlated into alerts', value: 1284, note: 'detection rules fired' },
  { stage: 'Auto-triaged or suppressed', value: 1179, note: 'playbooks, allowlists, tuning' },
  { stage: 'Routed to an analyst', value: 105, note: 'across three shifts' },
];

// The shape of a banking day in alert volume: quiet overnight, a ramp when the
// branch network logs on, a mid-morning peak, a lunch dip, a second afternoon
// bump. Indexed by hour of day — the chart rotates this so it ends on the hour
// you are actually sitting in.
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

// Why a week went wrong. Each reads as both "the shape of a day when X" and as
// a clause after an em dash, because the caption uses it both ways.
const SLA_CAUSES = [
  'a noisy rule went untuned',
  'a phishing wave landed during handover',
  'two analysts were out and the queue backed up',
  'an EDR sensor upgrade doubled the alert volume',
  'a change window pushed a batch of vulnerability findings into the queue',
  'an upstream log source lagged and every clock started late',
];

// Last 24 hours of alert volume, rotated so the final bar is the current hour
// and jittered off the baseline. One hour of the shift gets a burst, because a
// flat day is the one shape a SOC never has.
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

  // The burst lands in the back half of the window — recent enough that it is
  // plausibly related to what is sitting in your queue right now.
  const burst = hours[between(rand, 14, 22)];
  burst.critical += between(rand, 1, 2);
  burst.high += between(rand, 3, 6);
  burst.medium += between(rand, 4, 9);
  burst.low += between(rand, 8, 20);

  return hours;
}

// The six days behind you, plus today. Weekends hold their target easily (a
// third of the volume, same headcount); weekdays are tighter. Most weeks lose a
// single day, a bad week loses two running, and about one in five comes in
// clean — so the chart is worth reading rather than recognising.
//
// Today is deliberately left empty. It is the one point on this chart the
// analyst is producing themselves, and the console has no business inventing a
// number for a shift that has not closed anything yet.
export function buildSlaTrend(startedAt = Date.now(), variant = 0, target = SLA_TARGET) {
  const rand = mulberry32(seedFor(startedAt, variant, 0x51a));

  const history = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(startedAt - (6 - i) * DAY_MS);
    const dow = date.getDay();
    const weekend = dow === 0 || dow === 6;
    return { day: WEEKDAY_SHORT[dow], long: WEEKDAY_LONG[dow], weekend, pct: between(rand, weekend ? 95 : 91, weekend ? 99 : 97) };
  });

  const roll = rand();
  const shape = roll < 0.2 ? 'clean' : roll < 0.85 ? 'dip' : 'slump';
  const cause = pick(rand, SLA_CAUSES);
  const weekdays = history.map((p, i) => i).filter((i) => !history[i].weekend);
  const bad = [];

  if (shape === 'dip' && weekdays.length) {
    bad.push(pick(rand, weekdays));
  } else if (shape === 'slump') {
    const runs = weekdays.filter((i) => weekdays.includes(i + 1));
    if (runs.length) {
      const start = pick(rand, runs);
      bad.push(start, start + 1);
    } else if (weekdays.length) {
      bad.push(pick(rand, weekdays));
    }
  }

  for (const i of bad) history[i].pct = target - between(rand, 1, 9);

  const names = bad.map((i) => history[i].long);
  const caption = bad.length === 0
    ? `Dashed line is the ${target}% target. Every day of the week behind you closed above it — quiet weeks are what pay for the tuning that keeps them quiet.`
    : bad.length === 1
      ? `Dashed line is the ${target}% target. ${names[0]} dipped below it — that is the shape of a day when ${cause}.`
      : `Dashed line is the ${target}% target. ${names[0]} and ${names[1]} both fell short — ${cause}, and a backlog takes more than one shift to clear.`;

  const todayDate = new Date(startedAt);
  const today = {
    day: WEEKDAY_SHORT[todayDate.getDay()],
    long: WEEKDAY_LONG[todayDate.getDay()],
    weekend: todayDate.getDay() === 0 || todayDate.getDay() === 6,
    pct: null,
    today: true,
  };

  return { points: [...history, today], target, breachedDays: names, caption };
}

// Today's point once the analyst has closed or breached something. Kept as a
// separate call so the chart module never has to know about case files.
export function withToday(trend, pct) {
  if (pct == null) return trend;
  const points = trend.points.map((p) => (p.today ? { ...p, pct } : p));
  return { ...trend, points };
}


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
