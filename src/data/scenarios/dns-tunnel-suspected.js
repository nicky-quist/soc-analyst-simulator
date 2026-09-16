// The alert you cannot close either way. DNS query volume that looks like
// tunnelling, coming from a signed binary with a plausible reason to talk —
// and no approval record, no vendor documentation, and no way to read the
// payload. The graded skill is writing an honest "I do not know yet".
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'dns-tunnel-suspected',
  difficulty: 3,
  queueLabel: 'DNS Alert — Sustained TXT query volume to a young domain, MKT-LT-19',
  source: 'DNS security (Umbrella)',
  alert: {
    ref: 'ALT-2026-0821-0468',
    rule: 'Anomalous DNS TXT query volume to a single second-level domain',
    ruleId: 'DNS-0091',
    reportedSeverity: 'LOW',
    detectedAt: '2026-08-21 06:55:19 UTC',
    slaMinutes: 120,
    entities: [
      { label: 'Host', value: 'MKT-LT-19 (10.20.14.61)' },
      { label: 'Domain', value: 'sync-telemetry-cdn.net' },
      { label: 'Volume', value: '13,940 TXT queries in 6 hours' },
    ],
  },
  rawLog:
`{"timestamp":"2026-08-21T06:55:19Z","alert":"Anomalous DNS TXT query volume to a single second-level domain","host":"MKT-LT-19","internal_ip":"10.20.14.61","domain":"sync-telemetry-cdn.net","query_type":"TXT","count_6h":13940,"unique_subdomains":13902,"mean_label_length":48,"sample":"mfrggzdfmztwq2lknnwg23q.nodeb7.sync-telemetry-cdn.net","verdict":"unclassified domain","severity":"low"}`,
  datasets: [
    { index: 'dns', label: 'DNS resolver query logs', retention: '30d' },
    { index: 'edr', label: 'CrowdStrike process telemetry', retention: '90d' },
    { index: 'proxy', label: 'Web proxy logs', retention: '30d' },
    { index: 'asset', label: 'Asset inventory & approved software', retention: 'current state' },
  ],
  searches: [
    {
      id: 's13-dns-volume',
      label: 'DNS queries for sync-telemetry-cdn.net',
      match: { index: 'dns', terms: ['sync-telemetry-cdn.net'] },
      needsWindow: 1440,
      columns: ['_time', 'host', 'type', 'queries', 'unique_labels', 'mean_label_len'],
      events: [
        { _time: '00:52–06:55', host: 'MKT-LT-19', type: 'TXT', queries: '13,940', unique_labels: '13,902', mean_label_len: '48 chars' },
        { _time: 'Aug 20 same window', host: 'MKT-LT-19', type: 'TXT', queries: '12,110', unique_labels: '12,088', mean_label_len: '47 chars' },
        { _time: 'Aug 19 same window', host: 'MKT-LT-19', type: 'TXT', queries: '9,845', unique_labels: '9,830', mean_label_len: '48 chars' },
        { _time: 'before Aug 19', host: 'MKT-LT-19', type: '—', queries: '0', unique_labels: '0', mean_label_len: '—' },
      ],
      note: 'Almost every query is unique and the labels are long — that is the shape of data being encoded into names, not of a client asking the same question repeatedly. It started on 19 August and is growing.',
    },
    {
      id: 's13-edr-process',
      label: 'process making the queries on MKT-LT-19',
      match: { index: 'edr', terms: ['mkt-lt-19'] },
      needsWindow: 1440,
      columns: ['_time', 'user', 'process', 'signer', 'detail'],
      events: [
        { _time: 'Aug 19 09:14', user: 'lstreet', process: 'AdCopyStudio-Setup.exe', signer: 'Bright Harbor Media LLC (valid)', detail: 'installed from Downloads to %LOCALAPPDATA%' },
        { _time: 'Aug 19 09:16', user: 'lstreet', process: 'AdCopyStudio.exe', signer: 'Bright Harbor Media LLC (valid)', detail: 'running; registered as a logon task' },
        { _time: 'continuous', user: 'lstreet', process: 'AdCopyStudio.exe', signer: 'Bright Harbor Media LLC (valid)', detail: 'issuing the TXT queries; no child processes; no credential access observed' },
      ],
      note: 'A validly signed binary the user installed themselves, doing all the querying, with no other malicious behaviour on the host. Signed is not the same as trusted, and "no other behaviour" is not the same as harmless.',
    },
    {
      id: 's13-asset-software',
      label: 'approved software record for AdCopyStudio',
      match: { index: 'asset', terms: ['adcopystudio'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Approved software register', value: 'No entry — not reviewed, not licensed, not deployed by IT' },
        { field: 'Host', value: 'MKT-LT-19 — Marketing, user lstreet' },
        { field: 'Host data', value: 'Campaign material; no customer PII; no privileged credentials' },
        { field: 'Install policy', value: 'Users may install to their own profile — allowed, not reviewed' },
      ],
      note: 'Unreviewed software installed under an allowed policy. That makes it shadow IT rather than an intrusion on its own — and it means nobody can tell you what its network behaviour is supposed to look like.',
    },
    {
      id: 's13-proxy-vendor',
      label: 'web traffic to the vendor from this host',
      match: { index: 'proxy', terms: ['brightharbormedia.com'] },
      needsWindow: 10080,
      columns: ['_time', 'host', 'url', 'bytes', 'category'],
      events: [
        { _time: 'Aug 19 09:12', host: 'MKT-LT-19', url: 'https://brightharbormedia.com/download/adcopystudio', bytes: '84 MB', category: 'Software downloads' },
        { _time: 'Aug 19 09:15', host: 'MKT-LT-19', url: 'https://brightharbormedia.com/activate', bytes: '12 KB', category: 'Software downloads' },
      ],
      note: 'The vendor is reachable over HTTPS and the product used it to activate — so a product that can talk over HTTPS is sending thousands of encoded TXT queries a day to a different, unrelated domain instead. That is the contradiction to put in the writeup.',
    },
    {
      id: 's13-dns-scope',
      label: 'other hosts querying the same domain',
      match: { index: 'dns', terms: ['10.20.14.61'] },
      needsWindow: 10080,
      columns: ['host', 'domain', 'queries', 'note'],
      events: [
        { host: 'MKT-LT-19', domain: 'sync-telemetry-cdn.net', queries: '35,895 (3 days)', note: 'only host in the estate' },
      ],
      note: 'One host, one domain, three days. Contained scope is good news for the response and does nothing to tell you what the traffic is.',
    },
  ],
  intel: {
    'sync-telemetry-cdn.net': {
      verdict: 'unknown',
      summary: 'Registered 21 June 2026 through a privacy-protected registrar. No adverse reporting, no sandbox detonations, no sector advisories.',
      firstSeen: '2026-06-21',
      sources: ['Passive DNS', 'Registrar WHOIS'],
      context: 'Two months old with authoritative name servers on a hosting provider, and nothing else known. An empty result on a young domain is an absence of evidence, not evidence of absence.',
    },
  },
  actions: [
    {
      id: 'sinkhole-domain',
      label: 'Sinkhole sync-telemetry-cdn.net at the resolver and keep logging the queries',
      verdict: 'required',
      result: 'Queries resolve to the sinkhole from 07:20. Whatever the channel was carrying stops moving, the host keeps working, and the attempts are still recorded for whoever investigates.',
    },
    {
      id: 'preserve-dns-evidence',
      label: 'Export the three days of query labels and preserve them with the case',
      verdict: 'required',
      result: '35,895 labels exported and hashed. If the encoding is ever decoded, the record of what left is still there.',
    },
    {
      id: 'contact-user',
      label: 'Ask the user what the software is for and whether Marketing has a licence or vendor contact',
      verdict: 'acceptable',
      result: 'User says a colleague recommended it for campaign copy, installed it themselves, and has no licence or vendor contact. That answers the shadow-IT question and not the traffic question.',
    },
    {
      id: 'allowlist-domain',
      label: 'Add the domain to the DNS allowlist so the alert stops firing',
      verdict: 'harmful',
      result: 'Alert silenced. The channel keeps running, and the detection that would have shown it growing to other hosts is now switched off for that domain.',
      consequence: {
        from: 'Tom Alvarez',
        role: 'Security Engineering Manager',
        tone: 'concerned',
        message: 'Allowlisting an unresolved indicator is not triage, it is deleting the question. If you cannot explain traffic, the answer is never to stop being told about it.',
      },
    },
    {
      id: 'remote-uninstall',
      label: 'Remotely uninstall the software and delete its files',
      verdict: 'harmful',
      result: 'Binary and its working directory deleted. The sample, its configuration and any local queue of what it was sending are gone before anyone examined them.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'You destroyed the only copy of the thing we needed to analyse. We cannot now say whether that was telemetry or exfiltration, which means we cannot tell anyone whether anything left.',
      },
    },
    {
      id: 'close-benign',
      label: 'Close as benign vendor telemetry on the strength of the valid signature',
      verdict: 'harmful',
      result: 'Case closed citing the code signature. Nothing in the evidence established what the queries carry, and the channel continues.',
      consequence: {
        from: 'Sarah Okafor',
        role: 'CISO',
        tone: 'concerned',
        message: 'A valid certificate says a publisher signed a file. It says nothing about what the file sends. Closing on a signature alone is how a signed loader stays in an estate for a year.',
      },
    },
  ],
  truth: {
    classification: 'suspicious_needs_more_info',
    severity: 'MEDIUM',
    mitreTechnique: 'T1071.004',
    mitreTactic: 'Command and Control',
    escalation: 'escalate_tier2',
    responseTargetMinutes: 90,
    requiredSearches: ['s13-dns-volume', 's13-edr-process', 's13-asset-software'],
    requiredIntel: ['sync-telemetry-cdn.net'],
    requiredActions: ['sinkhole-domain', 'preserve-dns-evidence'],
    requiredReportPoints: [
      {
        point: 'describes why the query pattern looks like encoded data rather than normal lookups',
        any: ['unique', 'encoded', 'tunnel*', 'label*', 'txt', 'length', '13,9*', 'subdomain*'],
      },
      {
        point: 'attributes the queries to a specific signed process installed by the user on 19 August',
        any: ['adcopystudio', 'signed', 'signature', 'installed', 'shadow it', 'unapproved', 'bright harbor'],
      },
      {
        point: 'states the contradiction — the vendor is reachable over HTTPS, so DNS is not a necessary channel',
        any: ['https', 'proxy', 'vendor', 'brightharbor*', 'different domain', 'unrelated', 'contradict*', 'no reason'],
      },
      {
        point: 'is explicit that the payload could not be read and the verdict is unresolved',
        any: ['cannot', 'could not', 'unable', 'unknown', 'not established', 'unresolved', 'inconclusive', 'needs', 'further'],
      },
      {
        point: 'does not assert a benign verdict on the strength of the code signature or the empty intel result',
        none: ['confirmed benign', 'is benign', 'legitimate telemetry', 'clean', 'no threat', 'signed so it is safe', 'signature confirms'],
      },
    ],
  },
  walkthrough: [
    'Read the numbers in the alert before the severity. 13,940 queries with 13,902 unique labels averaging 48 characters is not a client asking a question repeatedly — it is data being encoded into names.',
    '`index=dns sync-telemetry-cdn.net` over 24 hours shows the same shape on the two previous days and nothing at all before 19 August. Something started, and it is growing.',
    '`index=edr mkt-lt-19` names the source: AdCopyStudio.exe, validly signed by a small publisher, installed by the user on the 19th, no child processes, no credential access. A signature tells you who built it, not what it sends.',
    '`index=asset adcopystudio` shows no entry in the approved software register. Shadow IT, installed under a policy that allows it — which also means nobody can tell you what its normal network behaviour is.',
    '`index=proxy brightharbormedia.com` is the contradiction worth writing down: the product reached the vendor over HTTPS to activate, then chose thousands of encoded DNS queries a day to an unrelated domain instead.',
    'Intel on the domain returns almost nothing — two months old, privacy-protected, no reporting. On a young domain that is an absence of evidence, not a clean verdict.',
    'Sinkhole the domain so the channel stops while the host keeps working, export the labels as evidence, and escalate to Tier 2 with the open question stated: what do the labels decode to, and is this product doing this on any other estate. Classify Suspicious — Needs More Investigation at MEDIUM and map to T1071.004.',
  ],
  debrief:
`Most alerts resolve. This one does not, and closing it in either direction would be the mistake. Calling it malicious over-states what the evidence supports; calling it benign because the binary is signed and the domain has no reporting is how signed loaders survive in an estate for a year. "Suspicious — needs more investigation", with a precise statement of what is known, what is not, and what would settle it, is the correct verdict and the hardest one to write.

Notice the containment choice too. Sinkholing at the resolver stops the channel while keeping the host, the process and the evidence intact and still logging — a proportionate response to an unresolved case. Uninstalling the software, or allowlisting the domain to make the alert go away, both end the investigation: one destroys the sample, the other deletes the question. The honest handover here is worth more than a confident verdict.`,
};
