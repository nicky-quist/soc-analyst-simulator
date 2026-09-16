// A detection that already succeeded. Tests escalation calibration: the file
// was blocked here, so this is not an IR page — but it ran unblocked on two
// other machines, so it is not a closure either. Tier 2 exists for exactly this.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'edr-quarantine-dual-use',
  difficulty: 3,
  queueLabel: 'EDR Alert — Credential Dumping Tool Quarantined, host IT-LT-07',
  source: 'CrowdStrike EDR',
  alert: {
    ref: 'ALT-2026-0821-1015',
    rule: 'Known credential-access tooling written to disk and blocked on execution',
    ruleId: 'SEC-EDR-144',
    reportedSeverity: 'HIGH',
    detectedAt: '2026-08-21 10:15:44 UTC',
    slaMinutes: 60,
    entities: [
      { label: 'Host', value: 'IT-LT-07' },
      { label: 'User', value: 'dkraft (IT Operations)' },
      { label: 'Disposition', value: 'Quarantined — execution blocked' },
    ],
  },
  rawLog:
`EDR Detection: Malicious File Quarantined
Host: IT-LT-07 (User: dkraft, IT Operations)
File: E:\\tools\\pwdump-x64.exe
SHA256: 9f2b41c7d8e05a63b1c4f97e2a0d5b83c6e14a97f2b0d38c5e7a91b46c02fd7e
Detection: Credential access tooling — LSASS memory read capability
Action: File quarantined; execution blocked at 10:15:44Z
Origin: File copied from removable volume E: (USB Mass Storage) at 10:14:58Z
Note: Sensor version 7.18 (current) on this host.`,
  datasets: [
    { index: 'edr', label: 'CrowdStrike detections & process telemetry', retention: '30d' },
    { index: 'device', label: 'Removable device audit log', retention: '90d' },
    { index: 'asset', label: 'Asset inventory, sensor versions & ownership', retention: 'current state' },
    { index: 'ticket', label: 'Service desk requests & approvals', retention: '2y' },
  ],
  searches: [
    {
      id: 's7-edr-hash',
      label: 'estate-wide detections for SHA256 9f2b41c7…',
      match: { index: 'edr', terms: ['9f2b41c7d8e05a63b1c4f97e2a0d5b83c6e14a97f2b0d38c5e7a91b46c02fd7e'] },
      needsWindow: 10080,
      columns: ['_time', 'host', 'user', 'sensor', 'disposition'],
      events: [
        { _time: 'Aug 21 10:15', host: 'IT-LT-07', user: 'dkraft', sensor: '7.18', disposition: 'QUARANTINED — execution blocked' },
        { _time: 'Aug 19 15:22', host: 'IT-WKSTN-31', user: 'dkraft', sensor: '6.44', disposition: 'EXECUTED — no prevention policy on this sensor version' },
        { _time: 'Aug 19 15:48', host: 'FS-UTIL-02', user: 'dkraft', sensor: '6.44', disposition: 'EXECUTED — no prevention policy on this sensor version' },
      ],
      note: 'The block worked here and did not exist two days ago on two other machines, where the same tool ran to completion under the same user account. Today\'s alert is the least interesting of the three events.',
    },
    {
      id: 's7-edr-host',
      label: 'process telemetry for IT-LT-07',
      match: { index: 'edr', terms: ['it-lt-07'] },
      needsWindow: 240,
      columns: ['_time', 'process', 'detail'],
      events: [
        { _time: '10:14:58', process: 'explorer.exe', detail: 'File copied E:\\tools\\pwdump-x64.exe → C:\\Users\\dkraft\\Desktop\\tools\\' },
        { _time: '10:15:44', process: 'pwdump-x64.exe', detail: 'Execution attempt — BLOCKED, file quarantined' },
        { _time: '10:16:02', process: 'chrome.exe', detail: 'Navigated to the vendor download page for the same tool' },
        { _time: '10:19:31', process: 'outlook.exe', detail: 'Draft created to servicedesk@ — subject "EDR blocking my audit tool"' },
      ],
      note: 'No LSASS access, no credential material touched, no lateral movement from this host. The user\'s behaviour after the block reads like someone doing their job, not someone caught.',
    },
    {
      id: 's7-device-usb',
      label: 'removable device history for dkraft',
      match: { index: 'device', terms: ['dkraft'] },
      needsWindow: 43200,
      columns: ['_time', 'host', 'device', 'serial', 'action'],
      events: [
        { _time: 'Aug 21 10:14', host: 'IT-LT-07', device: 'USB Mass Storage', serial: '0x7C21A9', action: 'Mounted — read' },
        { _time: 'Aug 19 15:20', host: 'IT-WKSTN-31', device: 'USB Mass Storage', serial: '0x7C21A9', action: 'Mounted — read' },
        { _time: 'Aug 19 15:46', host: 'FS-UTIL-02', device: 'USB Mass Storage', serial: '0x7C21A9', action: 'Mounted — read' },
      ],
      note: 'One personally-owned USB device carrying the tool between three machines. Not an attacker moving laterally — an administrator carrying a toolkit around, which is its own problem.',
    },
    {
      id: 's7-asset-host',
      label: 'asset records for IT-LT-07 and the two hosts that ran it',
      match: { index: 'asset', terms: ['dkraft'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'User', value: 'dkraft — Systems Administrator, IT Operations' },
        { field: 'Privilege', value: 'Member of Domain Admins' },
        { field: 'IT-LT-07', value: 'Laptop — sensor 7.18 (current), prevention policy enforced' },
        { field: 'IT-WKSTN-31', value: 'Desktop — sensor 6.44, 14 months out of date, detect-only' },
        { field: 'FS-UTIL-02', value: 'Utility server — sensor 6.44, detect-only, holds scheduled backup jobs' },
      ],
      note: 'A domain admin ran credential-dumping tooling on two machines whose sensors could see it but not stop it. Whatever the intent, credentials on those hosts have to be treated as potentially exposed.',
    },
    {
      id: 's7-ticket-history',
      label: 'service desk requests from dkraft',
      match: { index: 'ticket', terms: ['dkraft'] },
      needsWindow: 43200,
      columns: ['ticket', 'raised', 'subject', 'status'],
      events: [
        { ticket: 'REQ-9142', raised: 'Aug 12', subject: 'Approval to use password-audit tooling for the quarterly AD credential review', status: 'OPEN — awaiting security sign-off (11 days)' },
        { ticket: 'REQ-8877', raised: 'Jul 03', subject: 'Domain Admin access review — annual recertification', status: 'CLOSED — approved' },
      ],
      note: 'There is a real request for exactly this activity, raised nine days ago, still sitting unapproved in your own team\'s queue. That does not make the execution authorized — it does change what kind of problem this is.',
    },
  ],
  intel: {
    '9f2b41c7d8e05a63b1c4f97e2a0d5b83c6e14a97f2b0d38c5e7a91b46c02fd7e': {
      verdict: 'suspicious',
      confidence: 'high',
      summary: 'Dual-use credential dumping utility. Ships in commercial password-audit suites and is also carried by multiple intrusion sets. Detection is on capability, not on intent — the file is identical in both cases.',
      firstSeen: '2019-11-08',
      sources: ['Vendor classification: HackTool/PWDump', 'Widely present in penetration-testing distributions', 'Observed in 40+ documented intrusions'],
      tags: ['dual-use', 'credential-access', 'hacktool'],
    },
  },
  actions: [
    {
      id: 'tier2-hunt',
      label: 'Raise a Tier 2 hunt on IT-WKSTN-31 and FS-UTIL-02 where the tool executed unblocked',
      detail: 'Confirm what was dumped, whether credential material left those hosts, and which accounts need rotating.',
      verdict: 'required',
      result: 'Tier 2 accepts the case with the hash, the two host names, and the execution timestamps. This is the actual work this alert generated.',
    },
    {
      id: 'preserve-sample',
      label: 'Preserve the quarantined sample and the USB device details in the case',
      verdict: 'required',
      result: 'Sample retained in quarantine with the device serial and mount history attached to the case.',
    },
    {
      id: 'sensor-upgrade',
      label: 'Raise a ticket to bring the two out-of-date sensors to the current version',
      verdict: 'acceptable',
      result: 'Filed. Two hosts have been running a 14-month-old sensor in detect-only mode — the alert you got today is the alert those hosts could not raise on Tuesday.',
    },
    {
      id: 'chase-approval',
      label: 'Flag REQ-9142 to your own team — an approval request has sat unanswered for 11 days',
      verdict: 'acceptable',
      result: 'Escalated internally. An unanswered approval queue is why administrators start working around the process.',
    },
    {
      id: 'restore-file',
      label: 'Restore the quarantined file — the admin says it is an approved audit tool',
      verdict: 'harmful',
      result: 'Credential-dumping tooling restored to a Domain Admin\'s laptop on the strength of a verbal claim, before the approval it references was ever granted.',
      consequence: {
        from: 'Sarah Okafor',
        role: 'CISO',
        tone: 'concerned',
        message: 'You restored a credential dumper on a domain admin machine because someone asked you to. The request they cited is still unapproved — you can see that in the ticket. Analysts get leaned on like this constantly, and the answer is always the same: the exception process exists so that this decision is not made by one person under pressure at ten in the morning.',
      },
    },
    {
      id: 'delete-and-close',
      label: 'Delete the quarantined sample and close the alert — the block already worked',
      verdict: 'harmful',
      result: 'Sample destroyed, alert closed. The two hosts where the same tool ran to completion two days ago are never looked at.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'The prevention working on one host is not the finding — the finding is that it did not exist on two others, and we now have no sample to hunt with. "The EDR handled it" is the most expensive sentence in this job.',
      },
    },
    {
      id: 'isolate-admin-laptop',
      label: 'EDR network containment — isolate IT-LT-07',
      verdict: 'unnecessary',
      result: 'A systems administrator is cut off from the network mid-morning over a file that was already blocked and never executed.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'neutral',
        message: 'Containment is proportionate to what actually happened, and on this host nothing did — the file never ran. The machines worth isolating, if any, are the two where it did. Isolating an admin over a successful block is how the SOC gets a reputation for firing blind.',
      },
    },
    {
      id: 'page-ir',
      label: 'Page the on-call IR engineer',
      verdict: 'unnecessary',
      result: 'IR on-call paged for a blocked file, and stood down once they read the disposition.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'neutral',
        message: 'I would rather be called than not, but read the disposition line first. Blocked execution with no credential access is a Tier 2 follow-up, not a page. Save the page for the two hosts if the hunt finds something on them.',
      },
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'HIGH',
    mitreTechnique: 'T1003.001',
    mitreTactic: 'Credential Access',
    escalation: 'escalate_tier2',
    responseTargetMinutes: 45,
    requiredSearches: ['s7-edr-hash', 's7-asset-host', 's7-ticket-history'],
    requiredIntel: ['9f2b41c7d8e05a63b1c4f97e2a0d5b83c6e14a97f2b0d38c5e7a91b46c02fd7e'],
    requiredActions: ['tier2-hunt', 'preserve-sample'],
    requiredReportPoints: [
      {
        point: 'states that the detection on this host succeeded — the file was blocked and never executed',
        any: ['block*', 'quarantin*', 'prevented', 'did not execute', "didn't execute", 'never ran', 'no execution'],
      },
      {
        point: 'identifies the real finding: the same tool executed unblocked on two hosts running an out-of-date sensor',
        any: ['it-wkstn-31', 'fs-util-02', 'two other', 'other host*', 'executed', 'unblocked', 'detect-only', 'out of date', 'out-of-date', 'sensor'],
      },
      {
        point: 'notes that the user holds Domain Admin, so credentials on those hosts must be treated as potentially exposed',
        any: ['domain admin', 'privileg*', 'credential*', 'rotat*', 'exposed', 'admin account'],
      },
      {
        point: 'records the dual-use nature of the tool and the pending approval request rather than asserting malicious intent',
        any: ['dual-use', 'dual use', 'audit tool', 'legitimate', 'req-9142', 'approval', 'pending', 'unapproved', 'password audit'],
      },
      {
        point: 'routes this to Tier 2 for a hunt on the two affected hosts rather than paging IR or closing it',
        any: ['tier 2', 'tier2', 'hunt', 'follow-up', 'follow up', 'further investigation', 'review the two'],
      },
      {
        point: 'does not treat the successful block as the end of the matter',
        none: ['no further action', 'nothing further', 'no action needed', 'case closed', 'edr handled it', 'already handled'],
      },
    ],
  },
  walkthrough: [
    'Read the disposition line before anything else. "Quarantined — execution blocked" means the control worked here, which immediately rules out an IR page for this host. The question is no longer "are we compromised on IT-LT-07" but "where else is this file".',
    'Pivot on the hash, not the host: `index=edr 9f2b41c7…` over 7 days. This is the whole scenario — the same tool ran to completion on two other machines two days ago, under the same user, because their sensors were 14 months out of date and in detect-only mode.',
    'Enrich the hash. The verdict comes back suspicious and dual-use, not malicious: this file ships in commercial password-audit suites and in intrusion toolkits alike. The detection is on capability, and capability does not tell you intent.',
    'Find out who the user is: `index=asset dkraft`. A Systems Administrator in Domain Admins. Whatever the intent was, credential material on the two hosts where it ran has to be treated as potentially exposed.',
    'Look for the innocent explanation: `index=ticket dkraft` shows REQ-9142, a request to use password-audit tooling for a quarterly AD review — raised nine days ago and still unapproved, in your own team\'s queue. That does not authorize what happened, and it does change how you write it up.',
    'Calibrate the escalation. Closing it because the block worked ignores two hosts where it did not. Paging IR over a blocked file spends credibility you will want later. Tier 2 with the hash, the two host names, and the timestamps is the proportionate answer.',
    'Be proportionate in response too: isolating a domain admin\'s laptop over a file that never ran is disruption without benefit, and restoring the quarantined file because the user asked is a decision no analyst should make alone under pressure.',
  ],
  debrief:
`Most alerts an L1 sees are not "is the building on fire" — they are "how much does this one deserve," and this scenario is entirely about that calibration. Three answers are available and two are wrong. Closing it because the EDR blocked the file ignores the actual finding, which is that the same tool ran to completion two days earlier on two hosts whose sensors were too old to stop it. Paging IR treats a successful prevention as an active compromise and spends credibility you will need on a day when something is genuinely burning. Tier 2 — with the hash, the two host names, the execution timestamps, and a note that the user is a domain admin — is the answer, because there is real follow-up work that this shift cannot finish. Two other things are worth carrying out of this one. First, dual-use tooling means the detection tells you what a file can do, never why someone ran it, so the write-up records the pending approval request instead of asserting intent. Second, the pressure to restore the quarantined file is the most realistic part of the scenario: analysts get asked constantly, by people who are usually right, and the exception process exists precisely so that call is not made by one person on the spot.`,
};
