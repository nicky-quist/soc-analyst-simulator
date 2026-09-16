// Which alerts are in your queue tonight.
//
// The library is bigger than a shift. Dealing a hand from it rather than
// handing over the whole library is the difference between a sim you play once
// and a sim you can sit down at twice: the second shift is a different set of
// alerts in a different order, so recognising the scenario cannot substitute
// for reading the evidence.
//
// A random seven would be a bad shift, though. Real queues are mixed by
// construction — something that turns out to be nothing, something that has to
// be escalated tonight, and a couple that need a second pair of eyes — and a
// hand of seven true positives teaches an analyst to escalate everything. So
// the deal fills quotas first and fills the rest at random.

import { SCENARIOS } from '../data/scenarios/index.js';
import { mulberry32, shiftSeed } from './random.js';

export const HAND_SIZE = 7;

const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFORMATIONAL: 4 };

const isClosable = (s) => s.truth.escalation.startsWith('close_');
const isIr = (s) => s.truth.escalation === 'escalate_ir';
const isTier2 = (s) => s.truth.escalation === 'escalate_tier2';

// Each quota is "at least this many of these in every hand", applied in order.
// Anything that cannot be satisfied from the library is skipped rather than
// throwing — a smaller library still deals, it just deals a flatter shift.
const QUOTAS = [
  { need: 1, test: isClosable },
  { need: 1, test: isIr },
  { need: 2, test: isTier2 },
  { need: 1, test: (s) => s.difficulty === 1 },
  { need: 1, test: (s) => s.difficulty === 3 },
];

function shuffled(items, rand) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// The queue an analyst sees is sorted the way a console sorts one: by the
// severity the tool reported — which is not the severity the case deserves —
// and then by how little time is left on the clock.
function queueOrder(a, b) {
  const bySeverity = (SEVERITY_RANK[a.alert.reportedSeverity] ?? 9) - (SEVERITY_RANK[b.alert.reportedSeverity] ?? 9);
  if (bySeverity) return bySeverity;
  return a.alert.slaMinutes - b.alert.slaMinutes;
}

export function dealShift(startedAt = Date.now(), variant = 0, library = SCENARIOS) {
  const size = Math.min(HAND_SIZE, library.length);
  const rand = mulberry32((shiftSeed(startedAt) ^ Math.imul(variant + 1, 0x9e3779b1)) >>> 0);
  const pool = shuffled(library, rand);
  const hand = [];

  for (const quota of QUOTAS) {
    for (const scenario of pool) {
      if (hand.length >= size) break;
      if (hand.filter(quota.test).length >= quota.need) break;
      if (hand.includes(scenario) || !quota.test(scenario)) continue;
      hand.push(scenario);
    }
  }

  for (const scenario of pool) {
    if (hand.length >= size) break;
    if (!hand.includes(scenario)) hand.push(scenario);
  }

  return hand.sort(queueOrder);
}
