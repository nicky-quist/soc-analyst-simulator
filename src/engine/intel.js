// Threat-intel enrichment, the way an analyst actually uses it: you paste an
// indicator you pulled out of the evidence yourself. There is no list to click.
//
// Getting it wrong is part of the exercise — a mistyped octet returns "no
// records", which reads exactly like a clean verdict if you aren't paying
// attention, and enriching an internal RFC1918 address against an external feed
// is the mistake that teaches what threat intel is and isn't for.

import { refang } from './query.js';

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const DOMAIN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;
const HASHES = { 32: 'md5', 40: 'sha1', 64: 'sha256' };

export function classifyIndicator(rawValue) {
  const value = refang(rawValue).trim().replace(/^["'<]|[">']$/g, '');
  if (!value) return { type: 'empty', value };

  if (/^https?:\/\//i.test(value)) return { type: 'url', value };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { type: 'email', value: value.toLowerCase() };

  if (IPV4.test(value)) {
    const octets = value.split('.').map(Number);
    if (octets.some((o) => o > 255)) return { type: 'invalid', value, reason: 'Octets must be 0–255.' };
    return { type: 'ipv4', value, private: isPrivateIpv4(octets) };
  }

  if (/^[a-f0-9]+$/i.test(value) && HASHES[value.length]) {
    return { type: 'hash', algorithm: HASHES[value.length], value: value.toLowerCase() };
  }

  // No TLD is all digits, so "185.220.101" is a truncated address rather than a
  // hostname — the kind of thing that happens when a copy grabs three octets.
  if (DOMAIN.test(value)) {
    const tld = value.split('.').pop();
    if (/^\d+$/.test(tld)) {
      return { type: 'invalid', value, reason: 'Looks like a truncated IPv4 address — an IPv4 needs four octets.' };
    }
    return { type: 'domain', value: value.toLowerCase() };
  }

  return { type: 'invalid', value, reason: 'Expected an IP, domain, URL, email address, or file hash.' };
}

export function isPrivateIpv4([a, b]) {
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

export function lookupIndicator(scenario, rawValue) {
  const indicator = classifyIndicator(rawValue);

  if (indicator.type === 'empty') {
    return { status: 'error', indicator, title: 'Nothing to look up', detail: 'Paste an indicator from the evidence.' };
  }
  if (indicator.type === 'invalid') {
    return {
      status: 'error',
      indicator,
      title: 'Not a recognized indicator',
      detail: indicator.reason,
    };
  }

  const record = (scenario.intel || {})[indicator.value];

  if (indicator.type === 'ipv4' && indicator.private && !record) {
    return {
      status: 'not_applicable',
      indicator,
      title: 'Private address space — no external intel',
      detail: `${indicator.value} is RFC1918. External feeds only see internet-routable addresses, so a clean result here means nothing.`,
      guidance: 'For an internal address the authoritative source is asset inventory, not threat intel. Search the asset index instead.',
    };
  }

  if (!record) {
    return {
      status: 'not_found',
      indicator,
      title: 'No records found',
      detail: `No feed has an entry for ${indicator.value}.`,
      guidance:
        'That is not the same as "clean" — confirm you copied the indicator correctly before you treat an empty result as a verdict.',
    };
  }

  return { status: 'found', indicator, record };
}

export const VERDICT_TONE = {
  malicious: 'danger',
  suspicious: 'warning',
  benign: 'success',
  unknown: 'neutral',
};
