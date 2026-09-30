// Three separate leaderboards, Blue, Red and Secrets, each ranking you against
// the fictional SEA SOC roster. Pure functions: hand them the same records the
// rest of the console keeps and get back sorted, ranked rows.
//
// Ranking is standard competition ranking: rows that tie share a rank, and the
// next rank skips (1, 2, 2, 4). Among tied rows you are listed first.

import { ROSTER, LIVE_URL } from '../data/leaderboard.js';
import {
  CAREER_RANKS, averageBestScore, careerStatus, clearedCaseTypes,
} from './progress.js';
import { RED_RANKS, redStatus } from './redProgress.js';

const desc = (a, b) => (b ?? -1) - (a ?? -1);

const COMPARE = {
  blue: (a, b) => desc(a.rankIndex, b.rankIndex) || desc(a.cleared, b.cleared) || desc(a.avg, b.avg),
  red: (a, b) => desc(a.rankIndex, b.rankIndex) || desc(a.cleared, b.cleared) || desc(a.ghosts, b.ghosts) || desc(a.best, b.best),
  secrets: (a, b) => desc(a.count, b.count),
};

// The rule each board sorts by, in words, so the page can state it.
export const RULES = {
  blue: 'Ranked by career rank, then case types cleared at 80%+, then average best score.',
  red: 'Ranked by Red Ops rank, then operations cleared, then ghost runs, then best completed score.',
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

// ── your standing, from the same engines that show it elsewhere ─────────────

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

// ── the three boards ────────────────────────────────────────────────────────

function rosterBlue(person, total) {
  const { rankIndex, avg } = person.blue;
  // Senior means every case type is cleared; below it, clamp to keep it true as the library grows.
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

export function buildBoards({ progress, redProgress, found, library, operationIds, secretsTotal }) {
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

  const secrets = rankEntries([
    ...ROSTER.map((p) => ({ id: p.id, name: p.name, role: p.role, count: Math.min(p.secrets, secretsTotal) })),
    { id: 'you', name: 'You', role: 'Analyst', isYou: true, count: found.length },
  ], COMPARE.secrets);

  return {
    blue, red, secrets,
    totals: { blue: blueTotal, red: redTotal, secrets: secretsTotal },
  };
}

// One line for "copy my standing".
export function standingText(boards) {
  const you = (rows) => rows.find((r) => r.isYou);
  const b = you(boards.blue);
  const r = you(boards.red);
  const s = you(boards.secrets);
  const n = boards.blue.length;
  return [
    `SEA SOC Analyst Console`,
    `Blue: ${b.rankLabel}, #${b.rank} of ${n}`,
    `Red: ${r.rankLabel}, #${r.rank} of ${n}`,
    `Secrets: ${s.count} of ${boards.totals.secrets}, #${s.rank} of ${n}`,
    LIVE_URL,
  ].join('\n');
}
