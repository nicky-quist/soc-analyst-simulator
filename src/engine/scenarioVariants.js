// Cosmetic identifier randomization: a scenario's attacker IP, hostname, or
// service-account name gets swapped for another plausible one each shift, so
// a scenario a player has seen before can't be solved from memory of the
// exact string — they still have to search, enrich, and read.
//
// Deliberately narrow in scope. Only identifiers that are pure labels — an
// IP, a hostname, a login name — are candidates. Anything the narrative or
// the report rubric actually reasons about (byte counts, record counts, "29
// months unrotated") stays fixed, because those are facts the story and the
// grader depend on, not flavor. A scenario opts in by declaring `variables`;
// everything else passes through this untouched.

import { hashString, mulberry32 } from './random.js';

const EXTERNAL_IPS = [
  '185.220.101.45', '45.83.42.19', '193.32.162.11', '89.248.167.131',
  '206.189.88.14', '154.13.25.77', '91.240.118.6', '178.62.199.44',
];

const SERVER_HOSTNAMES = [
  'db-prod-03', 'db-prod-05', 'db-prod-08', 'app-prod-04', 'app-prod-11',
];

const SERVICE_ACCOUNTS = [
  'svc-etl-loader', 'svc-reporting-sync', 'svc-backup-agent', 'svc-data-pipeline', 'svc-nightly-export',
];

const POOLS = {
  'ipv4-external': EXTERNAL_IPS,
  'hostname-server': SERVER_HOSTNAMES,
  'service-account': SERVICE_ACCOUNTS,
};

function pickReplacement(pool, defaultValue, rand) {
  const candidates = pool.filter((v) => v !== defaultValue);
  if (!candidates.length) return defaultValue;
  return candidates[Math.floor(rand() * candidates.length)];
}

// Walks every string in the tree — including object keys, since a variable
// can be the thing an intel table is keyed on — and swaps each variable's
// default value for its replacement wherever it appears.
function deepSubstitute(node, replacements) {
  if (typeof node === 'string') {
    let out = node;
    for (const [from, to] of replacements) {
      if (from !== to) out = out.split(from).join(to);
    }
    return out;
  }
  if (Array.isArray(node)) return node.map((n) => deepSubstitute(n, replacements));
  if (node && typeof node === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      out[deepSubstitute(key, replacements)] = deepSubstitute(value, replacements);
    }
    return out;
  }
  return node;
}

// Deterministic per (scenario, seedKey): the same shift always sees the same
// substitution, same as every other seeded system in this project, so a
// reload doesn't hand the analyst a different case mid-shift. Scenarios that
// don't declare `variables` are returned exactly as given.
export function instantiateScenario(scenario, seedKey) {
  if (!scenario.variables) return scenario;
  const rand = mulberry32(hashString(`${scenario.id}:${seedKey}`));
  const replacements = Object.values(scenario.variables).map((v) => {
    const pool = POOLS[v.pool];
    return [v.value, pool ? pickReplacement(pool, v.value, rand) : v.value];
  });
  return deepSubstitute(scenario, replacements);
}
