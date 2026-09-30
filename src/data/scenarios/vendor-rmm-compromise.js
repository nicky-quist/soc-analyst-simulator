// A trusted-relationship compromise: the bank's managed IT provider has standing
// remote-management access to about 300 hosts, the provider's own breach has
// exposed a technician's portal credentials, and someone is now driving the
// bank's own remote-management tool. Everything about the alert says "approved
// vendor, known software". Tests whether an L1 treats trust as a reason to
// look less closely or a reason to verify harder, and whether containment can
// be aimed at the one account that is compromised instead of the whole
// relationship.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'vendor-rmm-compromise',
  difficulty: 3,
  // Cosmetic only: the session's source address is a pure label. Vendor
  // addresses, host names, counts and times never move.
  variables: {
    sourceIp: { value: '154.13.25.77', pool: 'ipv4-external' },
  },
  queueLabel: 'PAM Alert — Vendor Remote Session Outside Maintenance Window (NorthPoint IT)',
  source: 'Remote Management Console + EDR',
  alert: {
    ref: 'ALT-2026-0826-0214',
    rule: 'Remote admin session outside approved maintenance window',
    ruleId: 'PAM-RMM-031',
    reportedSeverity: 'LOW',
    detectedAt: '2026-08-26 02:14:33 UTC',
    slaMinutes: 60,
    entities: [
      { label: 'Vendor', value: 'NorthPoint IT (managed service provider, approved)' },
      { label: 'Account', value: 'np-tech07 (vendor technician)' },
      { label: 'Tool status', value: 'Approved software, vendor on allow-list' },
    ],
  },
  rawLog:
`PAM / RMM audit — Remote session outside maintenance window
02:10:41 UTC   Severity: LOW (approved vendor + approved tool are auto-graded down)

Account:       np-tech07 (NorthPoint IT technician)
Session:       RMM-88214, interactive shell, 3 managed hosts touched
Window check:  no approved maintenance window active (last approved: 22 Aug 21:00-23:00)
Note:          the session source is not shown in the summary. See the session record.`,
  datasets: [
    { index: 'rmm', label: 'Remote management console — session & command audit', retention: '90d' },
    { index: 'edr', label: 'EDR process telemetry', retention: '30d' },
    { index: 'vendor', label: 'Vendor management — contracts, contacts & inbound notices', retention: '2y' },
    { index: 'change', label: 'Change calendar & maintenance tickets', retention: '1y' },
  ],
  searches: [
    {
      id: 's9-rmm-session',
      satisfies: 's9-session-anomaly',
      label: 'RMM session record for np-tech07',
      match: { index: 'rmm', terms: ['np-tech07'] },
      needsWindow: 240,
      columns: ['_time', 'field', 'value'],
      events: [
        { _time: '02:10:41', field: 'Session opened', value: 'RMM-88214 by np-tech07, source 154.13.25.77 (hosting provider, first time seen on this console)' },
        { _time: '02:10:41', field: 'Authentication', value: 'Vendor portal SSO, MFA satisfied (token, not a fresh prompt)' },
        { _time: '02:11:20', field: 'Host touched', value: 'MGMT-JMP-02 (jump server), interactive shell' },
        { _time: '02:16:05', field: 'Host touched', value: 'APP-SVC-07 (application server), interactive shell' },
        { _time: '02:19:48', field: 'Host touched', value: 'FS-LOAN-01 (loan-servicing file server), interactive shell' },
        { _time: '02:31:12', field: 'Session state', value: 'still open at the time of the alert' },
      ],
      note: 'The account is the vendor\'s, the tool is approved, and the source address is neither. A session that authenticates cleanly from an address the vendor has never used, in the middle of the night, on three servers, is not routine administration.',
    },
    {
      id: 's9-rmm-history',
      satisfies: 's9-session-anomaly',
      label: 'Thirty days of NorthPoint sessions on the RMM console',
      match: { index: 'rmm', terms: ['northpoint'] },
      needsWindow: 43200,
      columns: ['_time', 'account', 'source', 'pattern'],
      events: [
        { _time: 'Jul 28 - Aug 22', account: 'np-tech01..np-tech06', source: '203.0.113.25 (vendor NOC)', pattern: '12 sessions, all 09:00-16:00 weekdays, patching and monitoring commands' },
        { _time: 'Aug 22 21:00', account: 'np-tech03', source: '203.0.113.25 (vendor NOC)', pattern: 'approved window CHG-4520, patch run, clean' },
        { _time: 'Aug 23 01:55', account: 'np-tech07', source: '154.13.25.77', pattern: 'one earlier session, 11 minutes, directory listing only, no ticket' },
        { _time: 'Aug 26 02:10', account: 'np-tech07', source: '154.13.25.77', pattern: 'the alerting session' },
      ],
      note: 'Every legitimate session comes from the vendor NOC address in office hours. The odd address has now been in twice, and the first visit was a short look around three days ago that nothing flagged.',
    },
    {
      id: 's9-edr-commands',
      satisfies: 's9-commands',
      label: 'EDR process activity from the RMM agent',
      match: { index: 'edr', terms: ['rmmagent'] },
      needsWindow: 240,
      columns: ['_time', 'host', 'process', 'command'],
      events: [
        { _time: '02:12:03', host: 'MGMT-JMP-02', process: 'cmd.exe (parent rmmagent.exe)', command: 'net group "Domain Admins" /domain' },
        { _time: '02:13:30', host: 'MGMT-JMP-02', process: 'powershell.exe (parent rmmagent.exe)', command: 'Get-ADComputer -Filter * | Select Name,OperatingSystem' },
        { _time: '02:17:22', host: 'APP-SVC-07', process: 'schtasks.exe (parent rmmagent.exe)', command: 'schtasks /create /tn "NPHealthCheck" /tr C:\\ProgramData\\np\\hc.exe /sc onstart /ru SYSTEM' },
        { _time: '02:21:10', host: 'FS-LOAN-01', process: 'cmd.exe (parent rmmagent.exe)', command: 'dir \\\\FS-LOAN-01\\loanservicing$ /s' },
        { _time: '02:24:41', host: 'FS-LOAN-01', process: 'cmd.exe (parent rmmagent.exe)', command: 'No file reads, copies or archive commands seen' },
      ],
      note: 'Domain reconnaissance, a persistence task named to look like the vendor\'s own monitoring, and a walk of the loan-servicing share. None of it is patching. Notably absent: credential dumping and any copying of files, so what is confirmed is intent and foothold, not loss.',
    },
    {
      id: 's9-vendor-record',
      satisfies: 's9-vendor-notice',
      label: 'NorthPoint IT vendor record and inbound notices',
      match: { index: 'vendor', terms: ['northpoint'] },
      needsWindow: 4320,
      columns: ['field', 'value'],
      events: [
        { field: 'Contract', value: 'MSA 2024-031: patching and monitoring of about 300 hosts, weekday hours, one approved maintenance window per week' },
        { field: 'Contracted egress', value: '203.0.113.25 and 203.0.113.26 only' },
        { field: 'Security contact', value: 'On the contract: Hana Okoye, security lead. Number on file, not in any email.' },
        { field: 'Inbound notice', value: '24 Aug 07:52, shared vendor-notices mailbox: "NorthPoint security advisory: credential exposure affecting the technician portal; rotate shared secrets, details to follow"' },
        { field: 'Notice status', value: 'Unread, no owner assigned, no ticket raised (two days)' },
      ],
      note: 'The vendor told the bank two days ago that technician credentials were exposed. It went to a shared mailbox nobody owns. The alert is the bank finding out the hard way what the advisory already said.',
    },
    {
      id: 's9-change-record',
      label: 'Change tickets and maintenance windows for NorthPoint',
      match: { index: 'change', terms: ['northpoint'] },
      needsWindow: 1440,
      columns: ['_time', 'record', 'detail'],
      events: [
        { _time: 'Aug 22 21:00', record: 'CHG-4520', detail: 'NorthPoint IT patch run, approved, completed, 23:04' },
        { _time: 'Aug 26 02:00', record: 'No record', detail: 'No maintenance window, change ticket or service request from NorthPoint for tonight' },
        { _time: 'Aug 23 01:55', record: 'No record', detail: 'Nothing covers the earlier off-hours session either' },
      ],
      note: 'Nobody at the bank asked for this work and nobody at the vendor filed it. Add that to the address and the hour and the story is settled.',
    },
  ],
  intel: {
    '154.13.25.77': {
      verdict: 'suspicious',
      confidence: 'medium',
      summary: 'Hosting-provider address seen reusing stolen technician credentials against managed-service remote tools at several organizations. Not part of any vendor\'s published address range.',
      firstSeen: '2026-08-11',
      sources: ['MSP-sector information-sharing group', 'Community reports of stolen technician logins'],
      tags: ['credential-reuse', 'msp-abuse', 'hosting-provider'],
    },
  },
  actions: [
    {
      id: 'suspend-vendor-account',
      label: 'Suspend the np-tech07 technician account on the RMM console and end its open session',
      detail: 'Cuts off the compromised account without touching the rest of the vendor\'s access.',
      verdict: 'required',
      result: 'Account suspended and session RMM-88214 terminated at 02:52. The other NorthPoint technicians keep working normally, and tonight\'s patching is unaffected.',
    },
    {
      id: 'verify-with-vendor',
      label: 'Call NorthPoint\'s security contact on the number in the contract to confirm whether the session is theirs',
      verdict: 'required',
      result: 'Hana Okoye confirms a breach of their technician portal, that np-tech07 was not working tonight, and that they are resetting credentials. She shares a list of other clients contacted.',
    },
    {
      id: 'preserve-rmm-and-edr',
      label: 'Preserve the RMM audit and EDR telemetry for every NorthPoint session in the last 30 days',
      verdict: 'required',
      result: 'Logs exported with hashes. The RMM audit is the record of what the vendor account did, and the EDR window is the shorter of the two.',
    },
    {
      id: 'hunt-vendor-history',
      label: 'Review every NorthPoint session for the last 30 days for other off-pattern activity',
      verdict: 'acceptable',
      result: 'Confirmed the earlier 23 August session and nothing else. Twelve routine sessions are clean. Useful scoping for Tier 2.',
    },
    {
      id: 'block-session-source',
      label: 'Block 154.13.25.77 at the perimeter and on the RMM console',
      verdict: 'acceptable',
      result: 'Address blocked. Reasonable, though stolen credentials can be used from anywhere, and the account suspension does the real work.',
    },
    {
      id: 'uninstall-rmm-agents',
      label: 'Uninstall the RMM agent from all 300 managed hosts',
      verdict: 'harmful',
      result: 'Uninstall pushed. Patching and monitoring stop across the estate, and the agent logs on each host go with the software, the evidence Tier 2 needs.',
      consequence: {
        from: 'Kenji Watanabe',
        role: 'IT Operations Lead',
        tone: 'concerned',
        message: 'One technician\'s account was compromised, and this removed patching and monitoring from the whole estate overnight and wiped the on-host agent logs we need. Suspending np-tech07 would have stopped the attacker in one click and left everything else running.',
      },
    },
    {
      id: 'block-vendor-range',
      label: 'Block NorthPoint\'s entire address range at the perimeter',
      verdict: 'harmful',
      result: 'Range blocked. That range also carries the vendor\'s card-file transfer and helpdesk telephony, both of which fail at start of business, and the attacker\'s address was never in it.',
      consequence: {
        from: 'Owen Barrett',
        role: 'Payments Operations Manager',
        tone: 'concerned',
        message: 'Our overnight card file transfer comes from that range and it has just failed. The attacker was coming from an unrelated hosting address, so this blocked the one party that was not the problem.',
      },
    },
    {
      id: 'click-advisory-link',
      label: 'Reply to the NorthPoint advisory and open its portal link to read the details',
      verdict: 'unnecessary',
      result: 'You opened a link in an unverified email from a vendor whose credentials are known to be exposed. Nothing came of it, and nothing was learned that a phone call would not have given you.',
      consequence: {
        from: 'Sarah Okafor',
        role: 'CISO',
        tone: 'neutral',
        message: 'A breached vendor\'s advisory is exactly the message an attacker would forge or intercept. The verified route was the contract number, and you had it. Do not use the link.',
      },
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'HIGH',
    mitreTechnique: 'T1199',
    mitreTactic: 'Initial Access',
    escalation: 'escalate_tier2',
    responseTargetMinutes: 30,
    requiredSearches: ['s9-session-anomaly', 's9-commands', 's9-vendor-notice'],
    requiredIntel: ['154.13.25.77'],
    requiredActions: ['suspend-vendor-account', 'verify-with-vendor', 'preserve-rmm-and-edr'],
    requiredReportPoints: [
      {
        point: 'shows the session is not the vendor\'s normal work: a new source address, off-hours, and no ticket',
        any: ['new source', 'new ip', 'unfamiliar', 'never seen', 'baseline', 'outside', 'off-hours', 'no ticket', 'no change', 'not the vendor', 'contracted'],
      },
      {
        point: 'identifies the vendor\'s own breach as the likely cause, citing the unread advisory or stolen technician credentials',
        any: ['advisory', 'vendor breach', 'stolen', 'compromis*', 'technician', 'credential exposure', 'breach'],
      },
      {
        point: 'describes what the session actually did: reconnaissance, a scheduled task for persistence, and the loan-servicing share',
        any: ['enumerat*', 'recon*', 'scheduled task', 'schtasks', 'persist*', 'domain admins', 'loan', 'share'],
      },
      {
        point: 'states what is not established: no credential theft or data copying seen yet, so this is a foothold rather than a confirmed loss',
        any: ['not confirmed', 'not established', 'no evidence', 'no sign', 'yet', 'unconfirmed', 'foothold', 'scope'],
      },
      {
        point: 'contains narrowly by suspending the one account and verifying with the vendor out-of-band, not by removing all agents or blocking the vendor',
        any: ['suspend*', 'disable the', 'out-of-band', 'phone', 'call', 'contract', 'the one account', 'np-tech07'],
      },
      {
        point: 'hands to Tier 2 to hunt across the vendor\'s sessions, including the earlier off-hours visit',
        any: ['tier 2', 'hunt*', 'earlier session', 'earlier visit', '23 august', 'aug 23', 'history', '30 days'],
      },
    ],
  },
  walkthrough: [
    'The tool graded this LOW because the vendor and the software are both on the allow-list. That is a statement about trust, and the whole case is about whether the trust is currently deserved.',
    'Read the session first: `index=rmm np-tech07`. The account is the vendor\'s and the tool is approved, but the source is a hosting-provider address that has never touched this console, at 02:10, on a jump server, an application server and the loan-servicing file server.',
    'Set it against normal: `index=rmm northpoint` over 30 days. Twelve routine sessions, all from the vendor NOC address in office hours. The odd address has now been in twice, and the first visit three days ago was an eleven-minute look around that nothing flagged.',
    'Look at what it ran: `index=edr rmmagent`. Domain Admins enumeration, an AD computer listing, a scheduled task called NPHealthCheck running as SYSTEM, and a directory walk of the loan share. That is reconnaissance and persistence, not patching. Note what is missing: no credential dumping and no file copying.',
    'Find out why the vendor\'s credentials might be in the wrong hands: `index=vendor northpoint`. Two days ago the vendor sent an advisory saying technician credentials were exposed. It went to a shared mailbox nobody owns. Nobody ordered this work either: `index=change northpoint` has no window and no ticket.',
    'Enrich the address. Stolen MSP technician logins reused from hosting providers is a known pattern, and the address is nowhere in the vendor\'s contracted range.',
    'Contain the one account, not the relationship. Suspend np-tech07 and end the session. Then confirm with the vendor by phone on the number in the contract, never through the advisory link. Uninstalling the agents, or blocking the vendor\'s address range, hurts the bank and leaves the real problem alone.',
    'Classify True Positive, overturn LOW up to HIGH, map to T1199 (Trusted Relationship), and escalate to Tier 2 with a clear line between what is confirmed (foothold, persistence, reconnaissance) and what is not (theft, copying). Tier 2 hunts the vendor\'s history and other hosts.',
  ],
  debrief:
`The lesson here is that "trusted" is a starting assumption to test, not a conclusion to rely on. Every field the tool checked came back green: approved vendor, approved software, a technician account that exists and authenticates. Every field it did not check was wrong: the address, the hour, the commands, and the absence of any ticket. A vendor relationship is the widest door a bank leaves open on purpose, and when the vendor is breached the door opens for someone else with a valid key. Notice how the vendor's own warning sat unread in a shared mailbox for two days. The response has to be as precise as the compromise: one account, one session, one phone call on a verified number. Blocking the vendor's range or ripping out the management agents feels like decisive action and does the attacker's disruption for them while destroying the evidence that would settle what was taken. And be exact about what is known. There is a foothold, a persistence task and reconnaissance of the loan share. There is not yet any credential theft or copying, and saying so is what makes this a Tier 2 hunt with a clear question rather than an IR page or a shrug.`,
};
