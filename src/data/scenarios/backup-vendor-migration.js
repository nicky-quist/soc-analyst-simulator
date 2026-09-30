// A plain benign case, deliberately clear-cut: the nightly offsite backup went
// to a new address because the backup vendor migrated its range, and a
// "large outbound transfer to a new destination" detection read it as
// exfiltration. Exists to balance a library that leans toward escalation:
// most alerts here are real, and an analyst who has only ever seen real ones
// learns to escalate everything. The skill is checking the boring explanation
// first, and being able to say why it is boring.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'backup-vendor-migration',
  difficulty: 1,
  // Cosmetic only. The vendor's new address is a pure label; the transfer
  // sizes, dates and windows the rubric reasons about never move.
  variables: {
    destIp: { value: '206.189.88.14', pool: 'ipv4-external' },
  },
  queueLabel: 'NetFlow Alert — Large Outbound Transfer to New External Address, BKP-SRV-01',
  source: 'NetFlow anomaly detection',
  alert: {
    ref: 'ALT-2026-0827-0112',
    rule: 'Large outbound transfer to a destination not seen in the last 30 days',
    ruleId: 'NET-EXFIL-117',
    reportedSeverity: 'HIGH',
    detectedAt: '2026-08-27 01:12:08 UTC',
    slaMinutes: 60,
    entities: [
      { label: 'Source', value: 'BKP-SRV-01 (10.20.30.12, backup server)' },
      { label: 'Destination', value: '206.189.88.14, first seen on this network tonight' },
      { label: 'Volume', value: '412 GB and still transferring' },
    ],
  },
  rawLog:
`NetFlow anomaly — Large outbound transfer, new destination
01:12:08 UTC   Severity: HIGH (volume > 100 GB and destination not seen in 30 days)

Source:        BKP-SRV-01 (10.20.30.12)
Destination:   206.189.88.14:443 (external, first seen tonight)
Started:       01:00:14 UTC, 412 GB so far, transfer still active
Note:          the detection has no context for what BKP-SRV-01 is or what it normally does.`,
  datasets: [
    { index: 'netflow', label: 'Edge NetFlow', retention: '90d' },
    { index: 'backup', label: 'Backup platform job log', retention: '1y' },
    { index: 'change', label: 'Change calendar & vendor notices', retention: '1y' },
    { index: 'asset', label: 'Asset inventory & ownership', retention: 'current state' },
  ],
  searches: [
    {
      id: 's10-flow-tonight',
      label: 'NetFlow for the new destination 206.189.88.14',
      match: { index: 'netflow', terms: ['206.189.88.14'] },
      needsWindow: 240,
      columns: ['_time', 'source', 'destination', 'bytes', 'detail'],
      events: [
        { _time: '01:00:14', source: 'BKP-SRV-01', destination: '206.189.88.14:443', bytes: 'transfer starts', detail: 'TLS, sustained single stream' },
        { _time: '01:12:08', source: 'BKP-SRV-01', destination: '206.189.88.14:443', bytes: '412 GB so far', detail: 'steady rate of about 5.7 GB per minute' },
        { _time: '01:12:08', source: 'any other host', destination: '206.189.88.14', bytes: '0', detail: 'no other source has talked to this address' },
      ],
      note: 'One host, one destination, one steady stream, starting at 01:00 on the dot. A person copying data out does not usually start at exactly one o\'clock and hold a perfectly steady rate.',
    },
    {
      id: 's10-flow-baseline',
      satisfies: 's10-baseline',
      label: 'NetFlow history for BKP-SRV-01 over 30 days',
      match: { index: 'netflow', terms: ['bkp-srv-01'] },
      needsWindow: 43200,
      columns: ['_time', 'destination', 'bytes', 'window'],
      events: [
        { _time: 'Jul 28 - Aug 26', destination: '198.51.100.0/24 (previous backup range)', bytes: '408-415 GB every night', window: '01:00-03:40, 30 nights in a row' },
        { _time: 'Aug 27', destination: '206.189.88.14 (new)', bytes: '412 GB so far', window: 'same 01:00 start, same size, same duration so far' },
      ],
      note: 'Every night for a month this host sends about 410 GB to one place starting at 01:00. Tonight is the same job, same size, same start. Only the destination changed.',
    },
    {
      id: 's10-backup-job',
      satisfies: 's10-job',
      label: 'Backup platform job log for the nightly offsite job',
      match: { index: 'backup', terms: ['nightly-offsite'] },
      needsWindow: 240,
      columns: ['_time', 'field', 'value'],
      events: [
        { _time: '01:00:00', field: 'Job', value: 'NIGHTLY-OFFSITE started by scheduler (owner: Infrastructure Services)' },
        { _time: '01:00:02', field: 'Endpoint', value: 'vault.riverbend-data.example, resolves to 206.189.88.14 since 26 Aug 22:30' },
        { _time: '01:12:00', field: 'Progress', value: '412 GB of about 415 GB, integrity checks passing' },
        { _time: '01:12:00', field: 'Previous run', value: 'Completed 26 Aug 03:38, 413 GB, verified' },
      ],
      note: 'The job\'s own log names the destination and shows a normal run. The endpoint name resolves to the new address, so the address changed underneath a hostname the job has always used.',
    },
    {
      id: 's10-change-notice',
      satisfies: 's10-authorization',
      label: 'Change ticket and vendor notice for the backup vendor',
      match: { index: 'change', terms: ['riverbend'] },
      needsWindow: 43200,
      columns: ['_time', 'record', 'detail'],
      events: [
        { _time: 'Aug 14', record: 'Vendor notice', detail: 'Riverbend Data Vault: storage endpoint migrating to a new address range on the evening of 26 Aug. No action needed for hostname-based clients.' },
        { _time: 'Aug 15', record: 'CHG-4534', detail: 'Approved by IT Operations: acknowledge Riverbend endpoint migration, no config change on the bank side.' },
        { _time: 'Aug 26 22:30', record: 'CHG-4534', detail: 'Vendor confirms migration complete; new range published on their status page.' },
        { _time: 'Aug 21', record: 'Detection Engineering', detail: 'Allow-list update for the new range requested, not yet applied.' },
      ],
      note: 'The change was announced, approved and ticketed almost two weeks ago. The only loose end is that the detection allow-list was never updated, which is why this fired tonight.',
    },
  ],
  intel: {
    '206.189.88.14': {
      verdict: 'benign',
      confidence: 'high',
      summary: 'Registered to Riverbend Data Vault, the bank\'s contracted offsite backup provider. Listed in the provider\'s published address ranges for its storage endpoint, effective 2026-08-26.',
      firstSeen: '2026-08-26',
      sources: ['Vendor management record', 'Provider status page (published ranges)'],
      tags: ['backup-vendor', 'contracted', 'expected'],
    },
  },
  actions: [
    {
      id: 'close-benign',
      label: 'Close the alert as benign / expected activity',
      verdict: 'required',
      result: 'Alert closed with disposition "benign: nightly offsite backup to migrated vendor range, CHG-4534".',
    },
    {
      id: 'update-backup-allowlist',
      label: 'Raise a request to add the vendor\'s new range to the backup allow-list and apply the pending Detection Engineering update',
      verdict: 'required',
      result: 'Request filed and linked to the open allow-list ticket from 21 August, so tomorrow night does not page anyone.',
    },
    {
      id: 'confirm-with-backup-owner',
      label: 'Confirm with the Infrastructure Services on-call that tonight\'s job is theirs before closing',
      verdict: 'acceptable',
      result: 'On-call confirms the job is running to schedule against the new endpoint. A thirty-second check that makes the closure defensible.',
    },
    {
      id: 'block-destination',
      label: 'Block 206.189.88.14 at the perimeter to stop the transfer',
      verdict: 'harmful',
      result: 'Destination blocked. The nightly backup fails at 412 of 415 GB with no completed copy offsite, and the retry window closes at 04:00.',
      consequence: {
        from: 'Kenji Watanabe',
        role: 'IT Operations Lead',
        tone: 'concerned',
        message: 'You cut the offsite backup three gigabytes from finished. We now have no verified copy from last night, and if something goes wrong today we are restoring from two days ago. It was our own job to our own vendor, and the change ticket says so.',
      },
    },
    {
      id: 'isolate-backup-server',
      label: 'EDR network containment: isolate BKP-SRV-01',
      verdict: 'harmful',
      result: 'BKP-SRV-01 isolated mid-transfer. The backup fails and, with the server cut off, so does the on-site restore path the business depends on.',
      consequence: {
        from: 'Kenji Watanabe',
        role: 'IT Operations Lead',
        tone: 'concerned',
        message: 'That server is how we restore anything. Isolating it stopped tonight\'s backup and took away the thing we would use to recover from a real incident. Two searches would have told you what it was.',
      },
    },
    {
      id: 'page-ir',
      label: 'Page the on-call Incident Response engineer',
      verdict: 'unnecessary',
      result: 'IR on-call paged at 01:24 and stood down at 01:33.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'neutral',
        message: 'No harm done, but that was a page for the backup job running on its own schedule. Being woken for things like this is how a team gets slow at answering the ones that matter.',
      },
    },
    {
      id: 'accuse-vendor',
      label: 'Email Riverbend asking them to explain the unauthorized transfer',
      verdict: 'unnecessary',
      result: 'The vendor received a note implying a breach on their side about a transfer they had told the bank about almost two weeks earlier.',
      consequence: {
        from: 'Sarah Okafor',
        role: 'CISO',
        tone: 'neutral',
        message: 'They sent us a migration notice and we approved it. Writing to a vendor as though they did something wrong, without reading our own change record, costs goodwill we will want when we do have a real incident.',
      },
    },
  ],
  truth: {
    classification: 'benign_expected',
    severity: 'LOW',
    // What the detection would map to, as with the scanner case; nothing here is exfiltration.
    mitreTechnique: 'T1567.002',
    mitreTactic: 'Exfiltration',
    escalation: 'close_no_escalation',
    responseTargetMinutes: 30,
    requiredSearches: ['s10-baseline', 's10-authorization'],
    requiredIntel: ['206.189.88.14'],
    requiredActions: ['close-benign', 'update-backup-allowlist'],
    requiredReportPoints: [
      {
        point: 'identifies the source as the nightly offsite backup job on the backup server',
        any: ['backup', 'bkp-srv-01', 'nightly', 'offsite', 'off-site', 'backup job'],
      },
      {
        point: 'compares it to the baseline: same size, same start time, every night for a month',
        any: ['baseline', 'same size', 'same window', 'every night', 'nightly', 'identical', '412', 'same start', 'history', 'pattern'],
      },
      {
        point: 'explains the new destination as the backup vendor\'s migrated range, confirmed by the change ticket or vendor notice',
        any: ['migrat*', 'new range', 'new address', 'vendor', 'riverbend', 'chg-4534', 'change ticket', 'notice', 'change record'],
      },
      {
        point: 'closes it as benign / expected activity, not as a real incident',
        any: ['benign', 'expected', 'no incident', 'not an incident', 'false positive', 'legitimate', 'authorized', 'close'],
      },
      {
        point: 'does not recommend blocking the destination or isolating the backup server',
        none: ['block*', 'isolat*', 'quarantin*', 'shut down', 'take down', 'cut off', 'contain*'],
      },
      {
        point: 'recommends updating the allow-list or detection so the vendor\'s new range stops generating alerts',
        any: ['allow-list', 'allowlist', 'whitelist', 'tun*', 'suppress*', 'detection engineering', 'update the detection', 'exception', 'noise'],
      },
    ],
  },
  walkthrough: [
    'The detection is doing what it was built to do: a large transfer to an address it has never seen. It has no idea what BKP-SRV-01 is. Your job is to add the context it lacks, starting with the most ordinary explanation.',
    'Start with the transfer itself: `index=netflow 206.189.88.14`. One host, one destination, one steady stream that started at exactly 01:00. Nothing about it looks like a person.',
    'Now set it against normal: `index=netflow bkp-srv-01` over 30 days. Every night for a month this host has sent about 410 GB starting at 01:00. Tonight is the same job, the same size and the same start. Only the destination changed, and tonight is the first run since.',
    'Check whether anyone told you: `index=change riverbend`, widened to 30 days. The backup vendor announced an endpoint migration on the 14th, IT Operations approved CHG-4534 on the 15th, and the vendor confirmed completion at 22:30 last night. The detection allow-list was never updated.',
    'Enrich the destination. It is registered to Riverbend Data Vault, the bank\'s contracted backup provider, in the ranges it published for the migration.',
    'Optionally read the job\'s own log, `index=backup nightly-offsite`: the endpoint is a hostname the job has always used, and it now resolves to the new address.',
    'Close it as benign and raise the allow-list request so tomorrow night does not repeat this. Do not block the destination or isolate the server: either one breaks a backup that is three gigabytes from finished, and isolating BKP-SRV-01 also removes your restore path.',
    'Classify Benign / Expected Activity, severity LOW, close with no escalation, and say in the report what you checked: baseline, change record, ownership of the destination.',
  ],
  debrief:
`This is the boring answer, and the exercise is being able to prove it is boring. The detection was right about what it saw: a large transfer to a new place. What it could not know is that the new place is the backup vendor, because the vendor changed addresses underneath a hostname the job has always used and the allow-list update from a week ago never got applied. An analyst who has only handled real incidents will read the volume and the newness and reach for containment. The habit that avoids that is cheap: compare tonight to the baseline, look for a change record, and check who owns the destination. Those three checks take a few minutes and turn a HIGH into a LOW with evidence behind it. The traps are the two things a nervous analyst does. Blocking the destination or isolating the server both feel decisive and both cost the bank its offsite copy, with isolation also removing the restore path. Paging IR for it does no harm to the systems but teaches everyone to trust pages a little less. The useful finish is the tuning request, so the next migration does not cost the next analyst the same twenty minutes.`,
};
