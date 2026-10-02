// Scenario variables

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

// Spare usernames
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

// Deep string substitution
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

// Instantiate a scenario for a shift
export function instantiateScenario(scenario, seedKey) {
  if (!scenario.variables) return scenario;
  const rand = mulberry32(hashString(`${scenario.id}:${seedKey}`));
  const replacements = [];
  for (const v of Object.values(scenario.variables)) {
    const pool = POOLS[v.pool];
    const picked = pool ? pickReplacement(pool, v.value, rand) : v.value;
    replacements.push([v.value, picked]);
    // Lowercase spelling in search terms
    const lower = [v.value.toLowerCase(), picked.toLowerCase()];
    if (lower[0] !== v.value && lower[0] !== lower[1]) replacements.push(lower);
  }
  return deepSubstitute(scenario, replacements);
}
