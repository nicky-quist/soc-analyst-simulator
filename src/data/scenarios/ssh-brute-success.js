// Brute force that succeeded, against a root account on a production database.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'ssh-brute-success',
  difficulty: 1,
  queueLabel: 'Auth Anomaly — Repeated Failed Logins, host db-prod-03',
  source: 'Splunk — Linux Auth Logs (auth.log)',
  alert: {
    ref: 'ALT-2026-0821-0413',
    rule: 'Multiple Failed SSH Authentications From Single Source',
    ruleId: 'SEC-AUTH-014',
    reportedSeverity: 'MEDIUM',
    detectedAt: '2026-08-21 02:16:40 UTC',
    slaMinutes: 30,
    entities: [
      { label: 'Host', value: 'db-prod-03' },
      { label: 'Account', value: 'root' },
      { label: 'Source', value: 'external address (see event)' },
    ],
  },
  rawLog:
`Aug 21 02:14:02 db-prod-03 sshd[8841]: Failed password for root from 185.220.101.45 port 51234 ssh2
Aug 21 02:14:04 db-prod-03 sshd[8841]: Failed password for root from 185.220.101.45 port 51234 ssh2
Aug 21 02:14:06 db-prod-03 sshd[8841]: Failed password for root from 185.220.101.45 port 51234 ssh2
Aug 21 02:14:08 db-prod-03 sshd[8841]: Failed password for root from 185.220.101.45 port 51234 ssh2
Aug 21 02:14:10 db-prod-03 sshd[8841]: Failed password for root from 185.220.101.45 port 51234 ssh2
Aug 21 02:14:13 db-prod-03 sshd[8841]: Failed password for root from 185.220.101.45 port 51234 ssh2
Aug 21 02:14:15 db-prod-03 sshd[8841]: Failed password for root from 185.220.101.45 port 51234 ssh2
Aug 21 02:14:19 db-prod-03 sshd[8841]: Accepted password for root from 185.220.101.45 port 51234 ssh2
Aug 21 02:14:19 db-prod-03 sshd[8841]: pam_unix(sshd:session): session opened for user root`,
  datasets: [
    { index: 'auth', label: 'Linux auth.log', retention: '90d' },
    { index: 'edr', label: 'Endpoint process telemetry', retention: '30d' },
    { index: 'asset', label: 'Asset inventory & hardening baselines', retention: 'current state' },
    { index: 'net', label: 'Perimeter firewall / netflow', retention: '30d' },
  ],
  searches: [
    {
      id: 's1-auth-ip',
      label: 'auth events from 185.220.101.45',
      match: { index: 'auth', terms: ['185.220.101.45'] },
      needsWindow: 1440,
      columns: ['_time', 'host', 'process', 'event'],
      events: [
        { _time: '02:14:02', host: 'db-prod-03', process: 'sshd[8841]', event: 'Failed password for root from 185.220.101.45 port 51234 ssh2' },
        { _time: '02:14:04', host: 'db-prod-03', process: 'sshd[8841]', event: 'Failed password for root from 185.220.101.45 port 51234 ssh2' },
        { _time: '02:14:06', host: 'db-prod-03', process: 'sshd[8841]', event: 'Failed password for root from 185.220.101.45 port 51234 ssh2' },
        { _time: '02:14:08', host: 'db-prod-03', process: 'sshd[8841]', event: 'Failed password for root from 185.220.101.45 port 51234 ssh2' },
        { _time: '02:14:10', host: 'db-prod-03', process: 'sshd[8841]', event: 'Failed password for root from 185.220.101.45 port 51234 ssh2' },
        { _time: '02:14:13', host: 'db-prod-03', process: 'sshd[8841]', event: 'Failed password for root from 185.220.101.45 port 51234 ssh2' },
        { _time: '02:14:15', host: 'db-prod-03', process: 'sshd[8841]', event: 'Failed password for root from 185.220.101.45 port 51234 ssh2' },
        { _time: '02:14:19', host: 'db-prod-03', process: 'sshd[8841]', event: 'Accepted password for root from 185.220.101.45 port 51234 ssh2' },
        { _time: '02:14:19', host: 'db-prod-03', process: 'sshd[8841]', event: 'pam_unix(sshd:session): session opened for user root' },
      ],
      note: '9 events · 7 failed, 1 accepted, 1 session opened. No other host in the estate shows auth activity from this source.',
    },
    {
      id: 's1-edr-host',
      satisfies: 's1-followup',
      label: 'process telemetry for db-prod-03',
      match: { index: 'edr', terms: ['db-prod-03'] },
      needsWindow: 1440,
      columns: ['_time', 'user', 'process', 'command'],
      events: [
        { _time: '02:14:22', user: 'root', process: 'bash[8850]', command: '/usr/bin/cat /etc/shadow' },
        { _time: '02:15:01', user: 'root', process: 'bash[8850]', command: '/usr/bin/tar -czf /tmp/bk.tgz /var/lib/mysql' },
        { _time: '02:15:44', user: 'root', process: 'sshd[8891]', command: 'pam_unix(sshd:session): session closed for user root' },
      ],
      note: 'Interactive root session, 82 seconds. Credential store read, then the MySQL data directory archived to /tmp.',
    },
    {
      id: 's1-edr-ip',
      satisfies: 's1-followup',
      label: 'process telemetry tied to session from 185.220.101.45',
      match: { index: 'edr', terms: ['185.220.101.45'] },
      needsWindow: 1440,
      columns: ['_time', 'user', 'process', 'command'],
      events: [
        { _time: '02:14:22', user: 'root', process: 'bash[8850]', command: '/usr/bin/cat /etc/shadow' },
        { _time: '02:15:01', user: 'root', process: 'bash[8850]', command: '/usr/bin/tar -czf /tmp/bk.tgz /var/lib/mysql' },
        { _time: '02:15:44', user: 'root', process: 'sshd[8891]', command: 'pam_unix(sshd:session): session closed for user root' },
      ],
      note: 'Interactive root session, 82 seconds. Credential store read, then the MySQL data directory archived to /tmp.',
    },
    {
      id: 's1-asset-host',
      label: 'asset record for db-prod-03',
      match: { index: 'asset', terms: ['db-prod-03'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Role', value: 'Primary customer loan database (PCI in scope)' },
        { field: 'Owner', value: 'Data Platform team' },
        { field: 'Approved admin path', value: 'Internal jump host 10.20.4.11 only — admins jsmith, mchen' },
        { field: 'Baseline: PermitRootLogin', value: 'no (documented hardening standard)' },
        { field: 'Observed: PermitRootLogin', value: 'yes — CONFIGURATION DRIFT' },
        { field: 'Baseline: SSH exposure', value: 'internal only — this host should not accept SSH from the internet' },
      ],
      note: 'Inventory is current-state, so the time picker does not apply to this index.',
    },
    {
      id: 's1-net-ip',
      label: 'perimeter traffic for 185.220.101.45',
      match: { index: 'net', terms: ['185.220.101.45'] },
      needsWindow: 1440,
      columns: ['_time', 'action', 'src', 'dest', 'port', 'bytes'],
      events: [
        { _time: '02:13:58', action: 'ALLOW', src: '185.220.101.45', dest: 'db-prod-03', port: '22/tcp', bytes: '48K' },
        { _time: '02:15:44', action: 'ALLOW', src: '185.220.101.45', dest: 'db-prod-03', port: '22/tcp', bytes: '2.1K' },
      ],
      note: 'Firewall rule FW-legacy-118 permits 0.0.0.0/0 to db-prod-03:22. No outbound transfer of the archive observed yet.',
    },
    {
      id: 's1-auth-root',
      label: 'root authentications across the estate',
      match: { index: 'auth', terms: ['root'] },
      needsWindow: 1440,
      columns: ['_time', 'host', 'source', 'result'],
      events: [
        { _time: '02:14:19', host: 'db-prod-03', source: '185.220.101.45 (external)', result: 'Accepted — password' },
        { _time: '08:31:02', host: 'db-prod-01', source: '10.20.4.11 (jump host)', result: 'Accepted — publickey (jsmith)' },
        { _time: '09:12:44', host: 'db-prod-02', source: '10.20.4.11 (jump host)', result: 'Accepted — publickey (mchen)' },
        { _time: '11:48:15', host: 'db-prod-01', source: '10.20.4.11 (jump host)', result: 'Accepted — publickey (mchen)' },
        { _time: '19:03:51', host: 'app-prod-07', source: '10.20.4.11 (jump host)', result: 'Accepted — publickey (jsmith)' },
      ],
      note: 'Every other root login in 24 hours came from the jump host with a key, from one of two named admins. This one came from the internet with a password. That contrast is the argument your report needs to make.',
    },
  ],
  intel: {
    '185.220.101.45': {
      verdict: 'malicious',
      confidence: 'high',
      summary: 'Known Tor exit node. Flagged in 3 public feeds for SSH brute-force campaigns in the last 30 days.',
      firstSeen: '2026-07-24',
      sources: ['Feodo Tracker', 'AbuseIPDB (91% confidence, 340 reports)', 'Internal blocklist candidate'],
      tags: ['tor-exit-node', 'ssh-bruteforce', 'scanning'],
    },
  },
  actions: [
    {
      id: 'isolate-host',
      label: 'EDR network containment — isolate db-prod-03',
      detail: 'Cuts all network access except the EDR management channel.',
      verdict: 'required',
      result: 'db-prod-03 isolated at the endpoint agent. Attacker session severed; host remains powered on for forensics.',
    },
    {
      id: 'preserve-evidence',
      label: 'Capture forensic snapshot (memory + /tmp) before further change',
      verdict: 'required',
      result: 'Memory image and /tmp/bk.tgz preserved to the evidence share with hashes recorded.',
    },
    {
      id: 'reset-root',
      label: 'Force credential reset — root password and SSH host keys',
      verdict: 'required',
      result: 'Root credentials rotated, authorized_keys reviewed, two unrecognized keys removed.',
    },
    {
      id: 'block-ip',
      label: 'Block 185.220.101.45 at the perimeter firewall',
      verdict: 'acceptable',
      result: 'Source blocked. Note that this is a Tor exit node — the operator can reappear from another one within minutes.',
    },
    {
      id: 'reboot-host',
      label: 'Reboot db-prod-03 to clear the attacker session',
      verdict: 'harmful',
      result: 'Host rebooted. Volatile evidence — running processes, network connections, memory-resident keys — is gone.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'Who rebooted the box? I needed that memory. Rebooting kicks the attacker out of that one session and destroys everything that would have told us what else they took, and they still hold the credentials. Isolate, then image, then remediate — in that order.',
      },
    },
    {
      id: 'disable-admins',
      label: 'Disable the accounts jsmith and mchen',
      verdict: 'harmful',
      result: 'Both database administrators locked out during an active incident.',
      consequence: {
        from: 'Priya Raghavan',
        role: 'Data Platform Lead',
        tone: 'concerned',
        message: 'You just locked out the only two people who can operate that database while it is on fire. The login came from a Tor node against the root account — that is not my admins. Please put them back.',
      },
    },
    {
      id: 'notify-owner',
      label: 'Notify the Data Platform owner and raise a change ticket for the SSH exposure',
      verdict: 'acceptable',
      result: 'Owner engaged; ticket raised to disable PermitRootLogin and remove firewall rule FW-legacy-118. The exposure predates the incident and outlives it.',
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'CRITICAL',
    mitreTechnique: 'T1110.001',
    mitreTactic: 'Credential Access',
    escalation: 'escalate_ir',
    responseTargetMinutes: 15,
    requiredSearches: ['s1-auth-ip', 's1-followup', 's1-asset-host'],
    requiredIntel: ['185.220.101.45'],
    requiredActions: ['isolate-host', 'preserve-evidence', 'reset-root'],
    requiredReportPoints: [
      {
        point: 'identifies the successful login (not just the failed attempts)',
        any: ['accepted', 'succeed*', 'successful login', 'logged in', 'gained access', 'got in', 'authenticated'],
      },
      {
        point: 'notes root/database server access, not a low-value target',
        any: ['root', 'database*', 'db-prod-03', 'db server', 'mysql'],
      },
      {
        point: 'notes SSH is exposed to the internet on this host when it should not be',
        any: ['exposed', 'internet-facing', 'internet facing', 'should not be', "shouldn't be", 'not supposed to', 'drift', 'hardening', 'externally reachable'],
      },
      {
        point: 'recommends isolating db-prod-03',
        any: ['isolat*', 'quarantin*', 'disconnect*', 'contain*', 'take offline', 'off the network'],
      },
      {
        point: 'recommends resetting root credentials / rotating keys',
        any: ['reset*', 'rotat*', 'credential*', 'password change', 'new password', 'revoke*', 'rekey'],
      },
      {
        point: 'flags the /etc/shadow read and mysql tar archive as likely credential theft + data staging for exfiltration',
        any: ['shadow', 'exfil*', 'staging', 'staged', 'archiv*', 'tar', 'data theft', 'stealing data'],
      },
    ],
  },
  walkthrough: [
    'Read the raw event fully before touching the search bar. Seven "Failed password" lines then one "Accepted password" — that single word change is the whole alert.',
    'Pull the source address out of the event yourself and search it: `index=auth 185.220.101.45`. The console starts on a 15-minute window and this happened overnight, so widen the time range to 24 hours or you will get zero events and conclude nothing happened.',
    'Enrich that same address in the Intel tab. A Tor exit node hitting SSH on a database server is deliberate targeting, not background noise.',
    'Ask what happened *after* the login: `index=edr db-prod-03`. Reading /etc/shadow and archiving /var/lib/mysql is the difference between "someone got in" and "someone got in and is packing up your customer data".',
    'Check the asset record: `index=asset db-prod-03`. Inventory is current-state, so the time picker does not matter here. It shows root SSH login is disabled in the baseline but enabled on the box, and that this host was never meant to accept SSH from the internet — configuration drift worth reporting in its own right.',
    'Respond in the right order: isolate, then image, then rotate credentials. Rebooting to "kick them out" destroys the volatile evidence IR needs, and blocking a Tor exit node is close to cosmetic.',
    'Classify True Positive / Critical, map to T1110.001, escalate to IR, and write the report so it names the successful login, the value of the target, the exposure gap, and both containment and remediation.',
  ],
  debrief:
`This is a true positive and one of the more severe alert types an L1 sees: brute force that SUCCEEDED, against a database server, using the root account, from a known Tor exit node. The follow-up commands (reading /etc/shadow, archiving the MySQL data directory) are consistent with an attacker staging data for exfiltration — this is no longer just "credential access," it's actively progressing toward impact. Correct action is immediate escalation to IR with isolation of the host, and the order of operations matters: isolate to cut the session, image to preserve volatile evidence, then rotate credentials. Rebooting the host feels like a fix and is actually evidence destruction. Notice also the configuration drift — SSH shouldn't have been reachable from the internet on this host at all, and root login shouldn't have been permitted — that's a finding worth flagging even though it's not the incident itself.`,
};
