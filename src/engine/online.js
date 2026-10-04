// Online leaderboard: turns your local standing into the payload the server
// stores, and merges real players into the same boards as the SEA SOC roster.
// Pure, so it is testable without a network.

import {
  COMPARE, blueStanding, fastStanding, gradeOf, rankEntries, redStanding,
} from './leaderboard.js';
import { CAREER_RANKS } from './progress.js';
import { RED_RANKS } from './redProgress.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const whole = (n, hi) => clamp(Math.round(Number(n) || 0), 0, hi);
// null stays null: "no data yet" is different from zero.
const optional = (n, hi, digits = 0) => {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return null;
  const f = 10 ** digits;
  return clamp(Math.round(Number(n) * f) / f, 0, hi);
};

// What gets uploaded: standings only, never case text or raw history.
export function standingPayload({ progress, redProgress, found, fastRuns, library, operationIds }) {
  const blue = blueStanding(progress, library);
  const red = redStanding(redProgress, operationIds);
  const fast = fastStanding(fastRuns);
  return {
    blue_rank: whole(blue.rankIndex, 2),
    blue_cleared: whole(blue.cleared, 100),
    blue_avg: optional(blue.avg, 100, 1),
    red_rank: whole(red.rankIndex, 2),
    red_cleared: whole(red.cleared, 100),
    red_ghosts: whole(red.ghosts, 1000),
    red_best: optional(red.best, 100),
    fast_best: optional(fast.best, 100),
    fast_avg_seconds: optional(fast.avgSeconds, 3600, 1),
    fast_runs: whole(fast.runs, 1000),
    secrets: whole(found.length, 200),
  };
}

const num = (v) => (v === null || v === undefined ? null : Number(v));

function base(row) {
  return {
    // Prefixed so a player named like a roster id can never share a React key.
    id: `online:${row.display_name}`,
    name: row.display_name,
    role: row.club_member ? 'Club member' : 'Player',
    isYou: !!row.is_me,
  };
}

// get_standings() rows as unranked entries, one list per board.
export function onlineEntries(rows) {
  return {
    blue: rows.map((r) => ({
      ...base(r),
      rankIndex: r.blue_rank,
      rankLabel: CAREER_RANKS[r.blue_rank]?.label ?? CAREER_RANKS[0].label,
      cleared: r.blue_cleared,
      avg: num(r.blue_avg),
    })),
    red: rows.map((r) => ({
      ...base(r),
      rankIndex: r.red_rank,
      rankLabel: RED_RANKS[r.red_rank]?.label ?? RED_RANKS[0].label,
      cleared: r.red_cleared,
      ghosts: r.red_ghosts,
      best: num(r.red_best),
    })),
    // Players who have never run Fast Triage are left off its board.
    fast: rows.filter((r) => r.fast_best !== null).map((r) => ({
      ...base(r),
      best: r.fast_best,
      grade: gradeOf(r.fast_best),
      avgSeconds: num(r.fast_avg_seconds),
      runs: r.fast_runs,
    })),
    secrets: rows.map((r) => ({ ...base(r), count: r.secrets })),
  };
}

// Real players only, ranked with the same comparators as the roster boards.
export function buildOnlineBoards(rows) {
  const entries = onlineEntries(rows);
  return Object.fromEntries(Object.entries(entries).map(([key, list]) => [key, rankEntries(list, COMPARE[key])]));
}

// One board per category holding everyone: the fictional roster, real players,
// and you once. Your own row always comes from your local standing, which is
// at least as current as what the server has, so the uploaded copy of you is
// dropped rather than listed twice.
//
// clubOnly shows club members alone: the roster is left out, and you appear
// only if you have joined the club.
export function mergeBoards({ roster, rows, clubOnly = false, youName = null, youIsClub = false }) {
  const online = onlineEntries(rows.filter((r) => !r.is_me));
  const merged = {};
  for (const key of Object.keys(online)) {
    const fictional = clubOnly ? [] : roster[key].filter((e) => !e.isYou);
    const mine = roster[key]
      .filter((e) => e.isYou && (!clubOnly || youIsClub))
      .map((e) => (youName ? { ...e, name: youName } : e));
    merged[key] = rankEntries([...fictional, ...online[key], ...mine], COMPARE[key]);
  }
  return { ...merged, totals: roster.totals };
}
