// Leaderboards

import { ROSTER, LIVE_URL } from '../data/leaderboard.js';
import {
  CAREER_RANKS, averageBestScore, careerStatus, clearedCaseTypes,
} from './progress.js';
import { RED_RANKS, redStatus } from './redProgress.js';

const desc = (a, b) => (b ?? -1) - (a ?? -1);
// Smaller is better; no value sorts last.
const asc = (a, b) => (a ?? Infinity) === (b ?? Infinity) ? 0 : (a ?? Infinity) < (b ?? Infinity) ? -1 : 1;

const COMPARE = {
  blue: (a, b) => desc(a.rankIndex, b.rankIndex) || desc(a.cleared, b.cleared) || desc(a.avg, b.avg),
  red: (a, b) => desc(a.rankIndex, b.rankIndex) || desc(a.cleared, b.cleared) || desc(a.ghosts, b.ghosts) || desc(a.best, b.best),
  fast: (a, b) => desc(a.best, b.best) || asc(a.avgSeconds, b.avgSeconds),
  secrets: (a, b) => desc(a.count, b.count),
};

// Sort rule per board
export const RULES = {
  blue: 'Ranked by career rank, then case types cleared at 80%+, then average best score.',
  red: 'Ranked by Red Ops rank, then operations cleared, then ghost runs, then best completed score.',
  fast: 'Ranked by best Fast Triage score, then faster average pace per alert.',
  secrets: 'Ranked by how many secrets have been found.',
};

export function rankEntries(entries, compare) {
  const sorted = [...entries].sort((a, b) => (
    compare(a, b) || (b.isYou ? 1 : 0) - (a.isYou ? 1 : 0) || a.name.localeCompare(b.name)
  ));
  let rank = 0;
  return sorted.map((entry, i) => {
    if (i === 0 || compare(sorted[i - 1], entry) !== 0) rank = i + 1;
    return { ...entry, rank };
  });
}

// ── your standing ──

// Fast triage standing
export function fastStanding(runs) {
  if (!runs.length) return { best: null, grade: null, avgSeconds: null, runs: 0 };
  const top = runs.reduce((a, b) => (b.score > a.score || (b.score === a.score && (b.avgSeconds ?? Infinity) < (a.avgSeconds ?? Infinity)) ? b : a));
  return { best: top.score, grade: top.grade ?? null, avgSeconds: top.avgSeconds ?? null, runs: runs.length };
}

export function blueStanding(progress, library) {
  const career = careerStatus(progress.history, library, progress.checkpointRankIndex);
  return {
    rankIndex: career.rankIndex,
    rankLabel: career.rank,
    cleared: clearedCaseTypes(progress.history, library),
    avg: averageBestScore(progress.history),
  };
}

export function redStanding(redProgress, operationIds) {
  const status = redStatus(redProgress.history, operationIds, redProgress.checkpointRankIndex);
  const scores = Object.values(status.stats.best);
  return {
    rankIndex: status.rankIndex,
    rankLabel: status.rank,
    cleared: status.stats.cleared,
    ghosts: status.stats.ghosts,
    best: scores.length ? Math.max(...scores) : null,
  };
}

// ── boards ──

// Fast triage grade bands
function gradeOf(score) {
  return score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';
}

function rosterBlue(person, total) {
  const { rankIndex, avg } = person.blue;
  // Clamp cleared count
  const cleared = rankIndex === 2 ? total : Math.min(person.blue.cleared, total - (rankIndex === 1 ? 1 : 0));
  return { rankIndex, rankLabel: CAREER_RANKS[rankIndex].label, cleared, avg };
}

function rosterRed(person, total) {
  const { rankIndex, cleared, ghosts, best } = person.red;
  return {
    rankIndex, rankLabel: RED_RANKS[rankIndex].label,
    cleared: cleared === 'all' ? total : Math.min(cleared, total), ghosts, best,
  };
}

export function buildBoards({ progress, redProgress, found, library, operationIds, secretsTotal, fastRuns = [] }) {
  const blueTotal = library.length;
  const redTotal = operationIds.length;

  const blue = rankEntries([
    ...ROSTER.map((p) => ({ id: p.id, name: p.name, role: p.role, ...rosterBlue(p, blueTotal) })),
    { id: 'you', name: 'You', role: 'Analyst', isYou: true, ...blueStanding(progress, library) },
  ], COMPARE.blue);

  const red = rankEntries([
    ...ROSTER.map((p) => ({ id: p.id, name: p.name, role: p.role, ...rosterRed(p, redTotal) })),
    { id: 'you', name: 'You', role: 'Analyst', isYou: true, ...redStanding(redProgress, operationIds) },
  ], COMPARE.red);

  const fast = rankEntries([
    ...ROSTER.map((p) => ({
      id: p.id, name: p.name, role: p.role,
      best: p.fast.best, grade: gradeOf(p.fast.best), avgSeconds: p.fast.avgSeconds, runs: p.fast.runs,
    })),
    { id: 'you', name: 'You', role: 'Analyst', isYou: true, ...fastStanding(fastRuns) },
  ], COMPARE.fast);

  const secrets = rankEntries([
    ...ROSTER.map((p) => ({ id: p.id, name: p.name, role: p.role, count: Math.min(p.secrets, secretsTotal) })),
    { id: 'you', name: 'You', role: 'Analyst', isYou: true, count: found.length },
  ], COMPARE.secrets);

  return {
    blue, red, fast, secrets,
    totals: { blue: blueTotal, red: redTotal, secrets: secretsTotal },
  };
}

// One line for "copy my standing".
export function standingText(boards) {
  const you = (rows) => rows.find((r) => r.isYou);
  const b = you(boards.blue);
  const r = you(boards.red);
  const f = you(boards.fast);
  const s = you(boards.secrets);
  const n = boards.blue.length;
  return [
    `SEA SOC Analyst Console`,
    `Blue: ${b.rankLabel}, #${b.rank} of ${n}`,
    `Red: ${r.rankLabel}, #${r.rank} of ${n}`,
    `Fast Triage: ${f.best === null ? 'no runs yet' : `best ${f.best}`}, #${f.rank} of ${n}`,
    `Secrets: ${s.count} of ${boards.totals.secrets}, #${s.rank} of ${n}`,
    LIVE_URL,
  ].join('\n');
}
