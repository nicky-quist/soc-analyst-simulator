// An availability incident, the first in the library: an HTTP flood against
// online banking where the DDoS scrubbing provider is doing its job on the
// front doors and a forgotten DNS record is letting the same flood hit an
// origin directly. Tests whether an L1 reads "mitigated" as a fact about the
// whole estate or only about the hosts the mitigation covers, and whether the
// instinct to block traffic (an IP, a country, the origin itself) survives
// contact with a botnet of forty thousand addresses.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'ddos-origin-bypass',
  difficulty: 2,
  // Cosmetic only. The top talker is a pure label; the traffic volumes, the
  // 41,000-source count and the backend health the rubric reasons about never move.
  variables: {
    topTalker: { value: '89.248.167.131', pool: 'ipv4-external' },
  },
  queueLabel: 'Availability Alert — HTTP Flood on Online Banking Edge (Auto-Mitigated)',
  source: 'CDN / WAF + Network Monitoring',
  alert: {
    ref: 'ALT-2026-0825-0233',
    rule: 'Volumetric HTTP flood detected — mitigation engaged',
    ruleId: 'NET-DDOS-204',
    reportedSeverity: 'MEDIUM',
    detectedAt: '2026-08-25 02:33:40 UTC',
    slaMinutes: 15,
    entities: [
      { label: 'Targets', value: 'www / login / api-legacy .coastaltrust.example' },
      { label: 'Peak', value: '2.7M requests/min, cache-busting query strings' },
      { label: 'Tool status', value: 'MITIGATED (auto-engaged 02:34)' },
    ],
  },
  rawLog:
`CDN/WAF event — Volumetric HTTP flood detected
02:33:40 UTC   Status: MITIGATION ENGAGED   Severity: MEDIUM (mitigated events are auto-graded down)

Protected zones reporting:  www.coastaltrust.example, login.coastaltrust.example
Requests/min (peak):        2,700,000 with unique ?cb= query strings (cache-busting)
Sources:                    approx. 41,000 distinct IPs, geographically distributed
Monitoring note:            Digital Channels reports mobile app sign-in errors starting 02:36.`,
  datasets: [
    { index: 'cdn', label: 'CDN / WAF mitigation log', retention: '30d' },
    { index: 'lb', label: 'Origin load balancer health & telemetry', retention: '14d' },
    { index: 'dns', label: 'DNS record inventory', retention: 'current state' },
    { index: 'netflow', label: 'Edge & origin NetFlow', retention: '30d' },
  ],
  searches: [
    {
      id: 's8-cdn-zones',
      satisfies: 's8-mitigation-coverage',
      label: 'CDN mitigation results by hostname',
      match: { index: 'cdn', terms: ['coastaltrust.example'] },
      needsWindow: 60,
      columns: ['host', 'requests_min_peak', 'blocked', 'status'],
      events: [
        { host: 'www.coastaltrust.example', requests_min_peak: '2,100,000', blocked: '99.4%', status: 'Proxied — origin healthy' },
        { host: 'login.coastaltrust.example', requests_min_peak: '640,000', blocked: '99.1%', status: 'Proxied — origin healthy' },
        { host: 'api-legacy.coastaltrust.example', requests_min_peak: 'no edge traffic recorded', blocked: 'n/a', status: 'NOT PROXIED — not in this zone' },
      ],
      note: 'The mitigation the alert calls a success covers two of the three targets. The third hostname never appears in the CDN at all, and that absence is the finding.',
    },
    {
      id: 's8-lb-origin',
      satisfies: 's8-origin-bypass',
      label: 'Origin load balancer health for api-legacy',
      match: { index: 'lb', terms: ['api-legacy'] },
      needsWindow: 60,
      columns: ['_time', 'metric', 'value'],
      events: [
        { _time: '02:31', metric: 'Requests/sec at origin', value: '1,200 (normal)' },
        { _time: '02:36', metric: 'Requests/sec at origin', value: '46,800' },
        { _time: '02:41', metric: 'Healthy backends', value: '1 of 4' },
        { _time: '02:41', metric: 'HTTP 5xx rate', value: '71%' },
        { _time: '02:41', metric: 'Connection table / CPU', value: '96% / 98%' },
        { _time: '02:41', metric: 'Client traffic', value: 'Mobile app v3.x sign-in and balance calls (see Digital Channels)' },
      ],
      note: 'This origin is taking the flood raw and is close to falling over. It serves the older mobile app, so members are already seeing errors. Customer impact is live, not theoretical.',
    },
    {
      id: 's8-dns-record',
      satisfies: 's8-origin-bypass',
      label: 'DNS record for api-legacy.coastaltrust.example',
      match: { index: 'dns', terms: ['api-legacy'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Record', value: 'api-legacy.coastaltrust.example  A  198.51.100.40  (TTL 300)' },
        { field: 'Points at', value: 'the origin load balancer directly — not a CNAME to the CDN' },
        { field: 'Created', value: '2021-02-09 for mobile app v3, never migrated behind the CDN' },
        { field: 'Owner', value: 'Mobile Platform' },
        { field: 'Exposure', value: 'Origin address appears in public passive-DNS history' },
        { field: 'Origin firewall', value: 'Accepts 443 from any source — not restricted to CDN ranges' },
      ],
      note: 'A five-year-old record pointing straight at the origin, with an origin firewall that trusts everyone. Anyone who has the address can skip the scrubbing entirely, and the attacker has it.',
    },
    {
      id: 's8-netflow-sources',
      satisfies: 's8-attack-shape',
      label: 'NetFlow top sources hitting the edge and origin',
      match: { index: 'netflow', terms: ['coastaltrust'] },
      needsWindow: 60,
      columns: ['_time', 'view', 'detail'],
      events: [
        { _time: '02:33-02:45', view: 'Distinct sources', detail: 'approx. 41,000 IPs across roughly 40 countries' },
        { _time: '02:33-02:45', view: 'Top talker', detail: '89.248.167.131 — 0.02% of requests; the top 300 sources together are under 4%' },
        { _time: '02:33-02:45', view: 'Request shape', detail: 'HTTPS GET / with unique ?cb= strings, defeating any cache' },
        { _time: '02:33-02:45', view: 'Pattern', detail: 'Rate per source is low and even: a botnet, not a few loud hosts' },
        { _time: '02:36-02:45', view: 'Origin ingress', detail: 'Same source population, no CDN in the path' },
      ],
      note: 'No source stands out. Blocking the top hundred, or a country, removes almost nothing and would catch real customers. The fix has to be structural, not a blocklist.',
    },
  ],
  intel: {
    '89.248.167.131': {
      verdict: 'suspicious',
      confidence: 'medium',
      summary: 'Residential-proxy and compromised-device address seen in HTTP flood traffic for a paid stresser service. One of many low-rate nodes; blocking it changes nothing about the attack.',
      firstSeen: '2026-06-30',
      sources: ['Botnet node feed', 'Stresser-service telemetry (community)'],
      tags: ['botnet-node', 'http-flood', 'residential-proxy'],
    },
  },
  actions: [
    {
      id: 'engage-ddos-provider',
      label: 'Open a P1 with the DDoS scrubbing provider to bring api-legacy behind mitigation',
      detail: 'The provider can front the hostname within minutes once the record is repointed.',
      verdict: 'required',
      result: 'P1 opened with the provider. They confirm api-legacy is not in the protected zone and can onboard it as soon as Network Engineering repoints the record.',
    },
    {
      id: 'page-network-and-mobile',
      label: 'Page Network Engineering and Mobile Platform to repoint the record at the CDN and restrict origin ingress to the provider\'s ranges',
      verdict: 'required',
      result: 'Both on the bridge. The record is repointed at 02:58 and the origin firewall restricted to the provider\'s ranges at 03:04. Origin load falls to normal within minutes.',
    },
    {
      id: 'preserve-flow-and-lb-logs',
      label: 'Preserve the NetFlow, load balancer and CDN logs for the attack window',
      verdict: 'required',
      result: 'Logs exported with hashes. The provider, the insurer and any law-enforcement referral will all ask for this, and the 14-day load balancer telemetry is the shortest-lived.',
    },
    {
      id: 'origin-rate-limit',
      label: 'Apply a temporary per-IP rate limit on the origin load balancer',
      verdict: 'acceptable',
      result: 'Rate limit applied. It sheds some load but a per-source limit barely bites when each of 41,000 sources sends a trickle. Buys a few minutes, not a fix.',
    },
    {
      id: 'block-top-talkers',
      label: 'Block the top 300 source IPs at the edge firewall',
      verdict: 'acceptable',
      result: 'Blocked. Those 300 sources were under 4% of the traffic, so the flood is effectively unchanged.',
    },
    {
      id: 'null-route-origin',
      label: 'Null-route the origin IP 198.51.100.40 upstream to stop the traffic',
      verdict: 'harmful',
      result: 'Traffic to the origin is dropped. So is every legitimate mobile request: the outage the attacker was working toward is now complete, and you caused it.',
      consequence: {
        from: 'Tomás Rivera',
        role: 'Network Engineering Lead',
        tone: 'concerned',
        message: 'Blackholing the origin finishes the attacker\'s job for them. Members lost the last of the service that was still limping. The fix was to put the hostname behind the scrubbing provider, which was one DNS change away.',
      },
    },
    {
      id: 'geo-block-countries',
      label: 'Geo-block the ten countries sending the most traffic',
      verdict: 'harmful',
      result: 'Ten countries blocked at the edge. The botnet spans forty, so the flood barely moves, while expatriate and travelling customers in those countries lose access to their accounts.',
      consequence: {
        from: 'Aisha Rahman',
        role: 'Head of Digital Banking',
        tone: 'concerned',
        message: 'This did almost nothing to the attack and cut off members who are abroad right now, some of them trying to reach money. A botnet is not a country. We now have a customer-impact incident on top of the DDoS.',
      },
    },
    {
      id: 'restart-load-balancers',
      label: 'Restart the origin load balancers to clear the connection table',
      verdict: 'unnecessary',
      result: 'Restarted. Connections reset for everyone, the table fills again within a minute, and the flood is unchanged.',
      consequence: {
        from: 'Tomás Rivera',
        role: 'Network Engineering Lead',
        tone: 'neutral',
        message: 'The table is full because the traffic is unfiltered. Restarting it drops every legitimate session and fills again straight away. The traffic has to stop reaching the origin.',
      },
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'HIGH',
    mitreTechnique: 'T1499.002',
    mitreTactic: 'Impact',
    escalation: 'escalate_ir',
    responseTargetMinutes: 10,
    requiredSearches: ['s8-mitigation-coverage', 's8-origin-bypass', 's8-attack-shape'],
    requiredIntel: ['89.248.167.131'],
    requiredActions: ['engage-ddos-provider', 'page-network-and-mobile', 'preserve-flow-and-lb-logs'],
    requiredReportPoints: [
      {
        point: 'sees that mitigation covers www and login but not api-legacy, which bypasses the edge and hits the origin directly',
        any: ['api-legacy', 'bypass*', 'not proxied', 'unprotected', 'origin', 'directly', 'outside the cdn'],
      },
      {
        point: 'identifies the cause: a legacy DNS record pointing at the origin address instead of the CDN',
        any: ['dns', 'a record', 'legacy record', 'cname', 'origin address', 'origin ip', 'exposed'],
      },
      {
        point: 'states the live customer impact: origin degraded and mobile members failing to sign in',
        any: ['mobile', 'customer*', 'member*', '5xx', 'degrad*', 'outage', 'availability', 'impact*'],
      },
      {
        point: 'recognizes a distributed botnet, so blocking IPs or countries will not work',
        any: ['botnet', 'distributed', '41,000', 'many sources', 'thousands of', 'ip block*', 'geo', 'cache-bust*'],
      },
      {
        point: 'recommends bringing api-legacy behind the scrubbing provider and restricting origin ingress to its ranges',
        any: ['scrubbing', 'provider', 'repoint*', 'cname', 'allowlist', 'restrict*', 'ingress', 'behind the cdn'],
      },
      {
        point: 'escalates to incident response with Network Engineering and Mobile Platform rather than blackholing the origin',
        any: ['incident response', 'network engineering', 'mobile platform', 'incident commander', 'p1', 'bridge', 'escalat*'],
      },
    ],
  },
  walkthrough: [
    'The tool says MEDIUM and MITIGATED, and mitigated events are automatically graded down. That is a statement about the mitigation, not about the estate, so the first job is to find out what it actually covers.',
    'Search the CDN by hostname: `index=cdn coastaltrust.example` over the last hour. Two zones are absorbing the flood at over 99%. The third target, api-legacy, is not in the table at all. A missing row is a finding.',
    'Check the origin behind the missing row: `index=lb api-legacy`. Requests per second jumped from about 1,200 to almost 47,000, one of four backends is healthy and 71% of responses are errors. The mobile app that depends on it is failing right now.',
    'Ask why it is exposed: `index=dns api-legacy`. A five-year-old A record points straight at the origin, not at the CDN, and the origin firewall accepts traffic from anywhere. Anyone with the address can skip the scrubbing.',
    'Characterize the attack: `index=netflow coastaltrust.example` over the same window. About 41,000 sources across forty countries, the top 300 under 4% of traffic, and unique cache-busting strings on every request. Enrich the top talker and you find a botnet node.',
    'That rules out the reflexes. Blocking the top talkers barely changes the load, a geo-block cuts off customers abroad, and blackholing the origin completes the outage. The fix is structural: put the hostname behind the scrubbing provider and lock the origin to the provider\'s ranges.',
    'Escalate to incident response and page Network Engineering and Mobile Platform. Open a P1 with the provider, and preserve the flow and load balancer logs because the shortest retention is 14 days.',
    'Classify True Positive, overturn MEDIUM up to HIGH, map to T1499.002 (Endpoint Denial of Service: Service Exhaustion Flood), and escalate to IR. The customer impact is what makes this an incident and not a noisy alert.',
  ],
  debrief:
`The dangerous word in this alert is "mitigated". It is true of the two hostnames behind the scrubbing provider and false of the one that matters, and the tool has no way of saying so because a bypassed origin is invisible to a system that only reports what it sees. The skill is to ask what the mitigation covers before believing what it says. Once the gap is found, the remaining decisions are all about resisting reflexes. A botnet of forty thousand sources cannot be blocklisted, a country is not an attacker, and null-routing your own origin does the attacker's work for them. Each of those feels like decisive action and each makes things worse, which is why the correct response looks slower and duller: engage the provider, repoint one DNS record, restrict the origin, and preserve the logs. Underneath is an ordinary hygiene failure, a hostname created in 2021 and never migrated, with an origin firewall that trusted the whole internet. That belongs in the report because the next flood will find it again if it is not fixed.`,
};
