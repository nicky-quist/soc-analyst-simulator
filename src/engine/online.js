// Online leaderboard: turns your local standing into the payload the server
// stores, and server rows back into entries the existing boards can render.
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
    id: row.display_name,
    name: row.display_name,
    role: row.club_member ? 'Club member' : 'Player',
    isYou: !!row.is_me,
  };
}

// rows: get_standings() output. Ranked with the same comparators as the
// roster boards, so the two views can never disagree about what "better" means.
export function buildOnlineBoards(rows) {
  const blue = rankEntries(rows.map((r) => ({
    ...base(r),
    rankIndex: r.blue_rank,
    rankLabel: CAREER_RANKS[r.blue_rank]?.label ?? CAREER_RANKS[0].label,
    cleared: r.blue_cleared,
    avg: num(r.blue_avg),
  })), COMPARE.blue);

  const red = rankEntries(rows.map((r) => ({
    ...base(r),
    rankIndex: r.red_rank,
    rankLabel: RED_RANKS[r.red_rank]?.label ?? RED_RANKS[0].label,
    cleared: r.red_cleared,
    ghosts: r.red_ghosts,
    best: num(r.red_best),
  })), COMPARE.red);

  // Players who have never run Fast Triage are left off its board.
  const fast = rankEntries(rows.filter((r) => r.fast_best !== null).map((r) => ({
    ...base(r),
    best: r.fast_best,
    grade: gradeOf(r.fast_best),
    avgSeconds: num(r.fast_avg_seconds),
    runs: r.fast_runs,
  })), COMPARE.fast);

  const secrets = rankEntries(rows.map((r) => ({ ...base(r), count: r.secrets })), COMPARE.secrets);

  return { blue, red, fast, secrets };
}
