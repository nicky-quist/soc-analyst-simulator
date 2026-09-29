// War Room follow-on: what happens when "malicious-powershell-precursor"
// doesn't get contained in time. Not part of SCENARIOS/the deal pool — see
// engine/warroom.js for how it gets triggered and injected into a live shift.
//
// The premise only has to be broadly true, not branch on exactly which action
// was missed: the C2 channel stayed live and/or the campaign wasn't hunted
// down, so twenty-one minutes later the same actor is encrypting the finance
// file share. Same host, same C2 address, same mailboxes named in the
// original alert — this is a continuation, not a new story.

export default {
  id: 'warroom-ransomware-detonation',
  warRoomFollowOn: true,
  difficulty: 3,
  queueLabel: 'WAR ROOM — Mass file encryption in progress, FS-FIN-01',
  source: 'CrowdStrike EDR + File Server Audit',
  alert: {
    ref: 'ALT-2026-0821-1203',
    rule: 'Mass file modification and ransom note deployment',
    ruleId: 'SEC-EDR-VAR-441',
    reportedSeverity: 'CRITICAL',
    detectedAt: '2026-08-21 12:03:55 UTC',
    slaMinutes: 5,
    entities: [
      { label: 'Host (encrypting)', value: 'FS-FIN-01 (finance file server)' },
      { label: 'Host (second infection)', value: 'DWALSH-PC' },
      { label: 'Actor', value: 'Same C2 as ALT-2026-0821-1142 (198.51.100.77)' },
    ],
  },
  rawLog:
`File Integrity Monitor: Mass file modification, FS-FIN-01
12:01:40 — 4,812 files under \\payments and \\statements renamed to *.lockbyte
12:02:15 — README_RECOVER.txt dropped in 38 directories
12:03:55 — EDR: DWALSH-PC — WINWORD.EXE spawned powershell.exe (identical pattern to ALT-2026-0821-1142)
Correlation: source of the FS-FIN-01 connection is FIN-WKSTN-22, using cached admin credentials`,
  datasets: [
    { index: 'fileaudit', label: 'File server integrity monitor', retention: '30d' },
    { index: 'edr', label: 'CrowdStrike process telemetry', retention: '30d' },
    { index: 'net', label: 'Internal netflow / SMB session log', retention: '30d' },
    { index: 'asset', label: 'Asset inventory & ownership', retention: 'current state' },
  ],
  searches: [
    {
      id: 's5-fileaudit-fs',
      label: 'file integrity events on FS-FIN-01',
      match: { index: 'fileaudit', terms: ['fs-fin-01'] },
      needsWindow: 60,
      columns: ['_time', 'path', 'action'],
      events: [
        { _time: '12:01:40', path: '\\\\fs-fin-01\\payments\\*', action: '2,206 files renamed to .lockbyte' },
        { _time: '12:01:58', path: '\\\\fs-fin-01\\statements\\*', action: '2,606 files renamed to .lockbyte' },
        { _time: '12:02:15', path: '\\\\fs-fin-01\\payments\\README_RECOVER.txt', action: 'created (ransom note, 21 more copies across subfolders)' },
      ],
      note: 'Both payment-processing shares are actively being encrypted. This is not contained — it is in progress as you read this.',
    },
    {
      id: 's5-net-lateral',
      label: 'SMB sessions into FS-FIN-01',
      match: { index: 'net', terms: ['fs-fin-01'] },
      needsWindow: 120,
      columns: ['_time', 'src', 'account', 'shares'],
      events: [
        { _time: '11:58:02', src: 'FIN-WKSTN-22', account: 'FIN-WKSTN-22$ cached svc-backup credential', shares: '\\payments, \\statements (admin share)' },
      ],
      note: 'One session, from the host in the original alert, using a cached service account that was never revoked — because the host was never isolated.',
    },
    {
      id: 's5-edr-dwalsh',
      label: 'process activity on DWALSH-PC',
      match: { index: 'edr', terms: ['dwalsh-pc'] },
      needsWindow: 90,
      columns: ['_time', 'process', 'detail'],
      events: [
        { _time: '11:47:03', process: 'WINWORD.EXE', detail: 'Opened Invoice_08212026.docm from %TEMP%\\Outlook attachments' },
        { _time: '12:03:55', process: 'powershell.exe', detail: 'Identical -EncodedCommand pattern to FIN-WKSTN-22 — same downloader' },
      ],
      note: "dwalsh's mailbox still held the same attachment. Nobody pulled it before she opened it.",
    },
    {
      id: 's5-asset-fs',
      label: 'asset record for FS-FIN-01',
      match: { index: 'asset', terms: ['fs-fin-01'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Role', value: 'Primary finance file server — payment processing, statements' },
        { field: 'Last verified backup', value: '2026-08-20 23:00 UTC — offline, immutable copy confirmed good' },
        { field: 'Criticality', value: 'Tier 0 — required for same-day payment runs' },
      ],
      note: "There's a clean backup from last night. That fact is the whole difference between a very bad afternoon and a very bad quarter.",
    },
  ],
  intel: {
    '198.51.100.77': {
      verdict: 'malicious',
      confidence: 'high',
      summary: 'Same ransomware-affiliate C2 flagged on the original alert. Still active — nothing about it changed in the last 21 minutes, only your window to act on it did.',
      firstSeen: '2026-06-30',
      sources: ['Vendor ransomware tracker', 'Internal DFIR case CTB-2026-014 (unrelated victim)'],
      tags: ['ransomware-affiliate', 'c2', 'stager'],
    },
  },
  actions: [
    {
      id: 'isolate-fs',
      label: 'EDR network containment — isolate FS-FIN-01',
      verdict: 'required',
      result: 'File server contained. Encryption process killed mid-run — roughly half the payments share is affected, not all of it.',
    },
    {
      id: 'isolate-dwalsh',
      label: 'EDR network containment — isolate DWALSH-PC',
      verdict: 'required',
      result: 'Second host contained before its own encryptor stage launched.',
    },
    {
      id: 'activate-ir-bridge',
      label: 'Activate the incident response bridge — page IR lead and duty CISO now',
      verdict: 'required',
      result: 'IR bridge stood up. This is now a declared incident with an owner, not a ticket one analyst is carrying alone.',
    },
    {
      id: 'confirm-backup',
      label: 'Confirm last night\'s FS-FIN-01 backup is intact and offline',
      verdict: 'acceptable',
      result: 'Backup confirmed good and disconnected from the network — recovery path exists.',
    },
    {
      id: 'pay-ransom',
      label: 'Pay the ransom demand listed in README_RECOVER.txt',
      verdict: 'harmful',
      result: 'Payment sent. No decryption key received. The affiliate group is now aware this victim pays.',
      consequence: {
        from: 'David Reyes',
        role: 'CEO',
        tone: 'concerned',
        message: 'Who authorized that transfer? That is a legal and law-enforcement decision made with counsel in the room, not something Tier 1 sends from the SOC. We have a clean backup from last night — walk me through why that wasn\'t the plan.',
      },
    },
    {
      id: 'shutdown-fs-hard',
      label: 'Hard power off FS-FIN-01 at the rack',
      verdict: 'harmful',
      result: 'Server powered off mid-write. Several files that were only partially encrypted are now corrupted rather than recoverable from the encryptor\'s own (crackable) state, and volatile memory IR needed is gone.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'Isolate the network interface, don\'t cut power. A hard shutdown mid-encryption can turn recoverable files into corrupted ones and it throws away memory forensics that tell us how they moved. Network containment stops the bleeding without destroying evidence.',
      },
    },
    {
      id: 'notify-legal',
      label: 'Loop in Legal and Compliance for breach assessment',
      verdict: 'acceptable',
      result: 'Legal engaged — payment-data exposure assessment underway in parallel with containment.',
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'CRITICAL',
    mitreTechnique: 'T1486',
    mitreTactic: 'Impact',
    escalation: 'escalate_ir',
    responseTargetMinutes: 5,
    requiredSearches: ['s5-fileaudit-fs', 's5-net-lateral', 's5-edr-dwalsh'],
    requiredIntel: ['198.51.100.77'],
    requiredActions: ['isolate-fs', 'isolate-dwalsh', 'activate-ir-bridge'],
    requiredReportPoints: [
      {
        point: 'identifies this as the same actor/C2 as the earlier PowerShell alert, not a new incident',
        any: ['same actor', 'same c2', 'same campaign', 'same attacker', '198.51.100.77', 'earlier alert', 'original alert', 'connected'],
      },
      {
        point: 'names both affected hosts (FS-FIN-01 and DWALSH-PC)',
        any: ['fs-fin-01', 'dwalsh'],
      },
      {
        point: 'identifies active encryption/ransomware, not just "file modification"',
        any: ['ransomware', 'encrypt*', 'lockbyte', 'ransom note'],
      },
      {
        point: 'recommends network isolation over powering off the server',
        any: ['isolat*', 'network containment', 'disconnect*', 'quarantin*'],
      },
      {
        point: 'recommends restoring from the verified backup rather than paying',
        any: ['backup', 'restore*', 'recover*'],
      },
      {
        point: 'does not recommend paying the ransom',
        none: ['pay the ransom', 'pay ransom', 'should pay', 'send payment', 'make the payment'],
      },
    ],
  },
  walkthrough: [
    "This one only exists because of what didn't happen on the earlier alert: the C2 channel stayed live, the compromised session was never revoked, and/or a second mailbox opened the same attachment. Don't relitigate that here — the clock on this alert doesn't care why it started, only what you do about it in five minutes.",
    'index=fileaudit fs-fin-01 shows active encryption in progress, right now, on the payments and statements shares.',
    'index=net fs-fin-01 shows the lateral path: FIN-WKSTN-22, using a cached service-account credential that was never rotated because the host was never isolated.',
    'index=edr dwalsh-pc shows the exact same infection chain as the original alert — same document, same downloader.',
    'Isolate both hosts — network containment, not a power cut, which would corrupt recoverable files and destroy the memory forensics IR needs. Get IR and the duty CISO on a bridge immediately; this is a declared incident now, not a solo ticket.',
    'Check the backup before anyone discusses the ransom note: a verified, offline backup from last night means recovery, not negotiation. Do not pay — no key is guaranteed, it funds the next attack, and it is a legal/executive decision anyway, never a Tier-1 one.',
  ],
  debrief:
`This is the cost of the gap in the earlier response, made concrete: a live C2 channel and an unrotated cached credential turned one contained-looking workstation into a file server encryption event twenty-one minutes later. The lesson isn't "you should have known this would happen" — it's that containment has a clock on it precisely because an attacker with working access keeps moving while you deliberate. Once it's live, the job changes: isolate fast (network, not power), get the incident declared with an owner instead of carrying it solo, and let a verified backup — not a ransom note — decide what happens next. Paying is never a Tier-1 call, and it doesn't reliably work even when someone above you decides to try it.`,
};
