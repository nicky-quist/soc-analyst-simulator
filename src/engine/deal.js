// Deal a shift's hand

import { SCENARIOS } from '../data/scenarios/index.js';
import { mulberry32, shiftSeed } from './random.js';

export const HAND_SIZE = 7;

const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFORMATIONAL: 4 };

const isClosable = (s) => s.truth.escalation.startsWith('close_');
const isIr = (s) => s.truth.escalation === 'escalate_ir';
const isTier2 = (s) => s.truth.escalation === 'escalate_tier2';

// Mix quotas
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

// Queue sort order
export function queueOrder(a, b) {
  const bySeverity = (SEVERITY_RANK[a.alert.reportedSeverity] ?? 9) - (SEVERITY_RANK[b.alert.reportedSeverity] ?? 9);
  if (bySeverity) return bySeverity;
  return a.alert.slaMinutes - b.alert.slaMinutes;
}

// Weighted shuffle
function weightedOrder(items, rand, weights) {
  return items
    .map((item) => ({ item, key: rand() ** (1 / Math.max(weights[item.id] ?? 1, 0.01)) }))
    .sort((a, b) => b.key - a.key)
    .map((entry) => entry.item);
}

// Recently seen scenarios weigh less
const REPEAT_PENALTY = 0.15;

// Adaptive focus weighting
export function dealShift(startedAt = Date.now(), variant = 0, library = SCENARIOS, focus = null, recentIds = null) {
  const size = Math.min(HAND_SIZE, library.length);
  const rand = mulberry32((shiftSeed(startedAt) ^ Math.imul(variant + 1, 0x9e3779b1)) >>> 0);
  const hasRecent = recentIds && recentIds.size > 0;
  let pool;
  if (focus?.weights || hasRecent) {
    const weights = {};
    for (const s of library) {
      const base = focus?.weights?.[s.id] ?? 1;
      weights[s.id] = hasRecent && recentIds.has(s.id) ? base * REPEAT_PENALTY : base;
    }
    pool = weightedOrder(library, rand, weights);
  } else {
    pool = shuffled(library, rand);
  }
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
