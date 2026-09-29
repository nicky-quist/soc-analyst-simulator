// Cosmetic identifier randomization: a scenario's attacker IP, hostname, or
// service-account name gets swapped for another plausible one each shift, so
// a scenario a player has seen before can't be solved from memory of the
// exact string — they still have to search, enrich, and read.
//
// Deliberately narrow in scope. Only identifiers that are pure labels — an
// IP, a hostname, a domain, a login name — are candidates. Anything the
// narrative or the report rubric actually reasons about (byte counts, record
// counts, "29 months unrotated") stays fixed, because those are facts the
// story and the grader depend on, not flavor. A scenario opts in by
// declaring `variables`; everything else passes through this untouched.
//
// Usernames are deliberately excluded except where a scenario file was
// checked to have exactly one human handle in it — several scenarios name
// two or three people (a victim plus decoy accounts) precisely so a report
// has to distinguish them, and renaming just one risks colliding with a
// decoy that was never meant to move.

import { hashString, mulberry32 } from './random.js';

const EXTERNAL_IPS = [
  '185.220.101.45', '45.83.42.19', '193.32.162.11', '89.248.167.131',
  '206.189.88.14', '154.13.25.77', '91.240.118.6', '178.62.199.44',
];

const INTERNAL_IPS = [
  '10.20.9.14', '10.20.14.61', '10.20.17.28', '10.20.19.44', '10.20.22.9', '10.20.24.16',
];

const SERVER_HOSTNAMES = [
  'db-prod-03', 'db-prod-05', 'db-prod-08', 'app-prod-04', 'app-prod-11',
];

const WEBSERVER_HOSTNAMES = [
  'WEB-PROD-02', 'WEB-PROD-05', 'WEB-PROD-08', 'WEB-PROD-11',
];

const BUILDAGENT_HOSTNAMES = [
  'BUILD-AGENT-04', 'BUILD-AGENT-06', 'BUILD-AGENT-09', 'BUILD-AGENT-13',
];

const WORKSTATION_HOSTNAMES = [
  'FIN-WKSTN-22', 'LEND-LT-14', 'IT-LT-07', 'MKT-LT-19',
  'HR-WKSTN-09', 'OPS-WKSTN-14', 'SALES-LT-31', 'ENG-WKSTN-06',
];

const SERVICE_ACCOUNTS = [
  'svc-etl-loader', 'svc-reporting-sync', 'svc-backup-agent', 'svc-data-pipeline', 'svc-nightly-export',
];

// Fresh handles not used as a decoy or a default anywhere in the library, so
// a scenario tagging one can't collide with a name that was never meant to move.
const HUMAN_USERNAMES = [
  'tward', 'ncole', 'bhaas', 'vquinn', 'rfoster', 'emarsh',
];

const SUSPICIOUS_DOMAINS = [
  'hashvault-eu.com', 'coinrelay-xmr.net', 'blockpool-asia.com', 'statements-ctb.app',
  'docviewer-alerts.net', 'sync-telemetry-cdn.net', 'portal-verify-secure.com', 'filerelay-hosting.net',
];

const DEVICE_SERIALS = [
  '0x9F44C1', '0x2B77E0', '0x6D1AF3', '0x8C205B',
];

const POOLS = {
  'ipv4-external': EXTERNAL_IPS,
  'ipv4-internal': INTERNAL_IPS,
  'hostname-server': SERVER_HOSTNAMES,
  'hostname-webserver': WEBSERVER_HOSTNAMES,
  'hostname-buildagent': BUILDAGENT_HOSTNAMES,
  'hostname-workstation': WORKSTATION_HOSTNAMES,
  'service-account': SERVICE_ACCOUNTS,
  'human-username': HUMAN_USERNAMES,
  'suspicious-domain': SUSPICIOUS_DOMAINS,
  'device-serial': DEVICE_SERIALS,
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
  const replacements = [];
  for (const v of Object.values(scenario.variables)) {
    const pool = POOLS[v.pool];
    const picked = pool ? pickReplacement(pool, v.value, rand) : v.value;
    replacements.push([v.value, picked]);
    // A search's own match.terms conventionally lowercase a hostname that's
    // shown in title case everywhere else (e.g. "FIN-WKSTN-22" vs the search
    // term "fin-wkstn-22") — the same variable, a second literal spelling.
    const lower = [v.value.toLowerCase(), picked.toLowerCase()];
    if (lower[0] !== v.value && lower[0] !== lower[1]) replacements.push(lower);
  }
  return deepSubstitute(scenario, replacements);
}
