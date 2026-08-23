// A true detection of authorized behaviour — the false positive that costs a team its credibility if you act on it.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'vuln-scan-false-positive',
  order: 2,
  queueLabel: 'IDS Alert — Possible Network Reconnaissance, subnet 10.20.0.0/16',
  source: 'Suricata IDS',
  alert: {
    ref: 'ALT-2026-0821-0431',
    rule: 'ET SCAN Behavioral Unusually Fast Port Scan',
    ruleId: 'SID-2610021',
    reportedSeverity: 'HIGH',
    detectedAt: '2026-08-21 09:02:11 UTC',
    slaMinutes: 60,
    entities: [
      { label: 'Source', value: '10.20.9.14' },
      { label: 'Destinations', value: '40 hosts in 10.20.4.0/24' },
      { label: 'Signature severity', value: '2 (High)' },
    ],
  },
  rawLog:
`{"timestamp":"2026-08-21T09:02:11Z","event_type":"alert","src_ip":"10.20.9.14","dest_ip":"10.20.4.0/24 (multiple hosts)","alert":{"signature":"ET SCAN Behavioral Unusually Fast Port Scan","category":"Attempted Information Leak","severity":2},"note":"Alert fired 214 times in 90 seconds across 40 distinct destination hosts from the same source."}`,
  datasets: [
    { index: 'ids', label: 'Suricata IDS alerts', retention: '90d' },
    { index: 'asset', label: 'Asset inventory & ownership', retention: 'current state' },
    { index: 'change', label: 'Change & maintenance calendar', retention: '1y' },
    { index: 'net', label: 'Perimeter firewall / netflow', retention: '30d' },
  ],
  searches: [
    {
      id: 's2-asset-ip',
      label: 'asset record for 10.20.9.14',
      match: { index: 'asset', terms: ['10.20.9.14'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Hostname', value: 'vulnscan-01' },
        { field: 'Function', value: 'Qualys vulnerability management scanner' },
        { field: 'Owner', value: 'Security Engineering (your own department)' },
        { field: 'Scan window', value: 'Tuesdays and Fridays, 09:00–11:00 local' },
        { field: 'Criticality', value: 'Tier 2 — security tooling' },
      ],
      note: 'The source of this "attack" is an asset your own team owns.',
    },
    {
      id: 's2-change-calendar',
      label: 'change calendar entries for today',
      match: { index: 'change', terms: ['vulnscan-01'] },
      needsWindow: 0,
      columns: ['window', 'owner', 'activity', 'ticket'],
      events: [
        { window: 'Fri 09:00–11:00 (recurring)', owner: 'Security Engineering', activity: 'Weekly internal vulnerability scan — all corporate subnets', ticket: 'CHG-4471' },
      ],
      note: 'Today is Friday. The alert fired at 09:02, two minutes into an approved recurring window.',
    },
    {
      id: 's2-change-date',
      satisfies: 's2-change-calendar',
      label: 'change calendar entries for today',
      match: { index: 'change', terms: ['10.20.9.14'] },
      needsWindow: 0,
      columns: ['window', 'owner', 'activity', 'ticket'],
      events: [
        { window: 'Fri 09:00–11:00 (recurring)', owner: 'Security Engineering', activity: 'Weekly internal vulnerability scan — all corporate subnets', ticket: 'CHG-4471' },
      ],
      note: 'Today is Friday. The alert fired at 09:02, two minutes into an approved recurring window.',
    },
    {
      id: 's2-ids-history',
      label: 'IDS alert history for this signature',
      match: { index: 'ids', terms: ['SID-2610021'] },
      needsWindow: 10080,
      columns: ['_time', 'src', 'count', 'disposition'],
      events: [
        { _time: 'Aug 21 09:02', src: '10.20.9.14', count: '214', disposition: 'open (this alert)' },
        { _time: 'Aug 18 09:01', src: '10.20.9.14', count: '208', disposition: 'closed — benign, scheduled scan' },
        { _time: 'Aug 15 09:03', src: '10.20.9.14', count: '221', disposition: 'closed — benign, scheduled scan' },
        { _time: 'Aug 11 09:02', src: '10.20.9.14', count: '196', disposition: 'closed — benign, scheduled scan' },
        { _time: 'Aug 08 09:04', src: '10.20.9.14', count: '203', disposition: 'closed — benign, scheduled scan' },
        { _time: 'Aug 04 09:01', src: '10.20.9.14', count: '211', disposition: 'closed — benign, scheduled scan' },
        { _time: 'Aug 01 09:02', src: '10.20.9.14', count: '199', disposition: 'closed — benign, scheduled scan' },
      ],
      note: 'This signature has fired on every scan window for at least a month and been closed benign every time — a tuning candidate, and analyst time being spent for nothing.',
    },
    {
      id: 's2-net-profile',
      label: 'network traffic profile for 10.20.9.14',
      match: { index: 'net', terms: ['10.20.9.14'] },
      needsWindow: 240,
      columns: ['_time', 'dest', 'ports', 'pattern', 'payload'],
      events: [
        { _time: '09:02:11', dest: '10.20.4.0/24', ports: '22, 80, 443, 445, 3389, 8080', pattern: 'SYN sweep, sequential', payload: 'none — connect scan only' },
        { _time: '09:04:39', dest: '10.20.5.0/24', ports: '22, 80, 443, 445, 3389, 8080', pattern: 'SYN sweep, sequential', payload: 'none — connect scan only' },
        { _time: '09:07:52', dest: '10.20.6.0/24', ports: '22, 80, 443, 445, 3389, 8080', pattern: 'SYN sweep, sequential', payload: 'none — connect scan only' },
      ],
      note: 'Orderly, sequential, no exploitation attempts and no payloads — a scanner inventorying open ports. An attacker who had compromised an internal host would not usually be this tidy, or this loud.',
    },
  ],
  intel: {},
  actions: [
    {
      id: 'close-benign',
      label: 'Close the alert as benign / expected activity',
      verdict: 'required',
      result: 'Alert closed with disposition "benign — authorized scheduled scan, CHG-4471".',
    },
    {
      id: 'suppress-tune',
      label: 'Raise a detection-tuning request: suppress SID-2610021 for vulnscan-01 during the approved window',
      verdict: 'required',
      result: 'Tuning request filed with Detection Engineering, referencing four benign closures in 30 days.',
    },
    {
      id: 'isolate-scanner',
      label: 'EDR network containment — isolate 10.20.9.14',
      verdict: 'harmful',
      result: 'vulnscan-01 isolated mid-scan. The weekly vulnerability scan of all corporate subnets dies at 12% complete.',
      consequence: {
        from: 'Tom Alvarez',
        role: 'Security Engineering Manager',
        tone: 'concerned',
        message: 'You quarantined our scanner in the middle of the Friday window. That is our own tool, on our own change ticket, and now the compliance scan misses its deadline. Two minutes in asset inventory would have told you what that IP was.',
      },
    },
    {
      id: 'block-internal-ip',
      label: 'Block 10.20.9.14 at the firewall',
      verdict: 'harmful',
      result: 'Internal security tooling blocked at the perimeter; the block also breaks its reporting back to the Qualys console.',
      consequence: {
        from: 'Tom Alvarez',
        role: 'Security Engineering Manager',
        tone: 'concerned',
        message: 'Blocking an internal, authorized security asset does nothing for the bank and takes our scanning coverage offline. If an internal IP looks hostile, identify it before you act on it.',
      },
    },
    {
      id: 'page-ir',
      label: 'Page the on-call Incident Response engineer',
      verdict: 'unnecessary',
      result: 'IR on-call paged at 09:14 and stood down at 09:21.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'neutral',
        message: 'No harm done, but that was a page for our own scanner on its own schedule. Pages like this are how a team gets slow at answering the ones that matter.',
      },
    },
    {
      id: 'verify-with-owner',
      label: 'Confirm with the Security Engineering on-call that the scan is theirs before closing',
      verdict: 'acceptable',
      result: 'On-call confirms the scan is running to schedule under CHG-4471. Thirty seconds of verification, and now the closure is defensible.',
    },
  ],
  truth: {
    classification: 'benign_expected',
    severity: 'LOW',
    mitreTechnique: 'T1595',
    mitreTactic: 'Reconnaissance',
    escalation: 'close_no_escalation',
    requiredSearches: ['s2-asset-ip', 's2-change-calendar'],
    requiredIntel: [],
    requiredActions: ['close-benign', 'suppress-tune'],
    requiredReportPoints: [
      {
        point: 'identifies the source as the known internal vulnerability scanner',
        any: ['vulnscan*', 'scanner', 'qualys', 'security engineering', 'vulnerability management', 'vuln scan*'],
      },
      {
        point: 'confirms against the change calendar / scheduled scan window',
        any: ['calendar', 'schedul*', 'maintenance', 'change window', 'change management', 'scan window', 'chg-4471'],
      },
      {
        point: 'closes as benign / expected activity, not as a real incident',
        any: ['benign', 'expected', 'no incident', 'not an incident', 'false positive', 'authorized', 'legitimate', 'close'],
      },
      {
        point: 'does not recommend blocking or isolating an internal, authorized security asset',
        none: ['block*', 'isolat*', 'quarantin*', 'take down', 'shut down', 'disable the scanner', 'firewall off'],
      },
      {
        point: 'notes this signature for tuning / suppression during the known scan window so it stops costing analyst time',
        any: ['tun*', 'suppress*', 'allowlist', 'allow-list', 'whitelist', 'exception', 'filter out', 'alert fatigue', 'noise'],
      },
    ],
  },
  walkthrough: [
    'The signature name tells you what pattern matched, not what it means. "ET SCAN Behavioral Unusually Fast Port Scan" is a true statement about the traffic and says nothing about intent.',
    'The source is 10.20.9.14 — RFC1918. If you paste it into the Intel tab you will get told, correctly, that external feeds have no view of private address space. That is the lesson, not a dead end: for internal addresses the authoritative source is inventory.',
    'Search `index=asset 10.20.9.14`. It is vulnscan-01, your own department\'s Qualys scanner. This is the single most important step in the scenario.',
    'Verify rather than assume: `index=change vulnscan-01` shows an approved recurring window, Fridays 09:00–11:00, ticket CHG-4471. The alert fired at 09:02 today, a Friday.',
    'Optional but worth it: `index=ids SID-2610021` over 7 days shows this has fired and been closed benign every scan window for a month. That is not a triage finding, it is a tuning finding.',
    'Respond by closing it benign and raising the tuning request. Do not isolate or block the scanner — it is an authorized asset owned by your own team, and taking it down has a real cost. Paging IR for it is not damaging, just expensive.',
    'Classify Benign / Expected Activity, severity LOW, close with no escalation, and note the tuning recommendation in the report.',
  ],
  debrief:
`This is a textbook false positive — technically the IDS signature fired correctly (that traffic pattern really does look like a port scan), but the pattern-match alone doesn't tell you intent. A big part of L1 SOC work is exactly this: confirming whether alert-worthy *behavior* maps to a real *threat*, using asset inventory and change-management context the IDS itself doesn't have. The wrong move here is either ignoring the alert without checking (you might miss a real scan that happens to originate from a compromised internal host), or escalating/blocking a known scheduled tool — which in this scenario means taking your own compliance scanning offline and burning credibility with the team that owns it. Correct process: verify against inventory and the change calendar, document why it's benign, close it, and raise the tuning request so the next four Fridays don't cost another analyst the same twenty minutes.`,
};
