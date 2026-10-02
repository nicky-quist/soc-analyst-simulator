// Fast triage engine

import { FAST_ALERTS } from '../data/fasttriage.js';
import { mulberry32 } from './random.js';

export const RUN_SIZE = 20;
// Time per alert
export const RUN_SECONDS = 12 * 60;

// Mix quotas per run
const MIX = [
  { disposition: 'close', count: 9, trap: 'overstated', trapCount: 2 },
  { disposition: 'tier2', count: 7, trap: 'understated', trapCount: 1 },
  { disposition: 'ir', count: 4, trap: 'understated', trapCount: 1 },
];

// Mistake costs
export const COST = {
  close: { close: 0, tier2: 0.5, ir: 1, skipped: 0.5 },
  tier2: { close: 2, tier2: 0, ir: 0.5, skipped: 2 },
  ir: { close: 3, tier2: 1, ir: 0, skipped: 3 },
};

function shuffle(rand, items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function dealRun(seed, pool = FAST_ALERTS, size = RUN_SIZE) {
  const rand = mulberry32(seed);
  const chosen = [];
  for (const rule of MIX) {
    const ofKind = pool.filter((a) => a.disposition === rule.disposition);
    const traps = shuffle(rand, ofKind.filter((a) => a.trap === rule.trap)).slice(0, rule.trapCount);
    const rest = shuffle(rand, ofKind.filter((a) => !traps.includes(a)));
    chosen.push(...traps, ...rest.slice(0, Math.max(0, rule.count - traps.length)));
  }
  return shuffle(rand, chosen).slice(0, size);
}

// Classify one decision. 'undertriage' is the dangerous direction.
const RANK = { close: 0, tier2: 1, ir: 2 };

export function outcomeOf(truth, answer) {
  if (answer === 'skipped') return 'skipped';
  if (answer === truth) return 'correct';
  return RANK[answer] < RANK[truth] ? 'undertriage' : 'overtriage';
}

// Score a run
export function scoreRun(alerts, answers) {
  let cost = 0;
  let maxCost = 0;
  const rows = alerts.map((alert) => {
    const given = answers[alert.id];
    const choice = given ? given.choice : 'skipped';
    const c = COST[alert.disposition][choice];
    cost += c;
    maxCost += Math.max(...Object.values(COST[alert.disposition]));
    return {
      alert, choice, cost: c, ms: given ? given.ms : null,
      outcome: outcomeOf(alert.disposition, choice),
    };
  });

  const answered = rows.filter((r) => r.outcome !== 'skipped');
  const correct = rows.filter((r) => r.outcome === 'correct').length;
  const missedThreats = rows.filter((r) => r.outcome === 'undertriage');
  const closedLive = rows.filter((r) => r.alert.disposition !== 'close' && r.choice === 'close');
  const over = rows.filter((r) => r.outcome === 'overtriage');
  const skipped = rows.filter((r) => r.outcome === 'skipped');
  const timed = answered.filter((r) => Number.isFinite(r.ms));
  const avgSeconds = timed.length ? timed.reduce((n, r) => n + r.ms, 0) / timed.length / 1000 : null;

  const score = maxCost ? Math.round(100 * (1 - cost / maxCost)) : 0;
  // Trap hits
  const trapRows = rows.filter((r) => r.alert.trap);
  const trapsMissed = trapRows.filter((r) => r.outcome !== 'correct').length;

  return {
    rows, score,
    correct, total: rows.length,
    accuracy: rows.length ? correct / rows.length : 0,
    missedThreats: missedThreats.length,
    closedLive: closedLive.length,
    overTriaged: over.length,
    skipped: skipped.length,
    avgSeconds,
    trapsMissed, trapsTotal: trapRows.length,
    grade: gradeFor(score, closedLive.length, skipped.length),
    byTheme: themeMisses(rows),
  };
}

// Closing a live threat caps the grade at C
export function gradeFor(score, closedLive, skipped) {
  let g = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';
  if (closedLive > 0 && (g === 'A' || g === 'B')) g = 'C';
  if (skipped >= 5 && g === 'A') g = 'B';
  return g;
}

function themeMisses(rows) {
  const themes = {};
  for (const r of rows) {
    if (r.outcome === 'correct') continue;
    themes[r.alert.theme] = (themes[r.alert.theme] || 0) + 1;
  }
  return Object.entries(themes).sort((a, b) => b[1] - a[1]).map(([theme, count]) => ({ theme, count }));
}
