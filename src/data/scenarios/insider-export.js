// An ambiguous insider case where the anomaly is scale and timing, not access.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'insider-after-hours-ambiguous',
  order: 5,
  queueLabel: 'DLP Alert — Large Data Export by Employee, After Hours',
  source: 'DLP (Data Loss Prevention) Platform',
  alert: {
    ref: 'ALT-2026-0821-2347',
    rule: 'Bulk export of regulated customer data to removable media',
    ruleId: 'SEC-DLP-007',
    reportedSeverity: 'HIGH',
    detectedAt: '2026-08-20 23:47:00 UTC',
    slaMinutes: 120,
    entities: [
      { label: 'User', value: 'rpatterson' },
      { label: 'Data', value: '4,812 customer loan records (PII/SSN)' },
      { label: 'Destination', value: 'USB mass storage, unrecognized serial' },
    ],
  },
  rawLog:
`DLP Event
User: rpatterson (Senior Underwriter, Commercial Lending)
Time: 2026-08-20T23:47:00Z (outside normal business hours — employee's typical activity window is 07:30-18:00)
Action: Exported 4,812 customer loan records (names, SSNs, loan amounts) to a personal USB storage device
Device: USB Mass Storage, serial not previously seen on this endpoint
Session: Remote via VPN, source IP consistent with employee's home address on file`,
  datasets: [
    { index: 'dlp', label: 'DLP events & export history', retention: '1y' },
    { index: 'hr', label: 'HR directory — roles, status', retention: 'current state' },
    { index: 'ticket', label: 'Service desk / approval requests', retention: '2y' },
    { index: 'asset', label: 'Asset inventory & ownership', retention: 'current state' },
  ],
  searches: [
    {
      id: 's5-dlp-history',
      label: 'export history for rpatterson',
      match: { index: 'dlp', terms: ['rpatterson'] },
      needsWindow: 43200,
      columns: ['_time', 'records', 'destination', 'hours', 'ticket'],
      events: [
        { _time: 'Aug 20 23:47', records: '4,812', destination: 'USB (new serial)', hours: 'after hours', ticket: 'none' },
        { _time: 'Aug 06 14:12', records: '38', destination: 'approved network share', hours: 'business hours', ticket: 'REQ-8821' },
        { _time: 'Jul 22 10:40', records: '51', destination: 'approved network share', hours: 'business hours', ticket: 'REQ-8604' },
        { _time: 'Jun 30 16:05', records: '22', destination: 'approved network share', hours: 'business hours', ticket: 'REQ-8410' },
        { _time: 'Jun 12 11:27', records: '44', destination: 'approved network share', hours: 'business hours', ticket: 'REQ-8288' },
        { _time: 'May 28 09:55', records: '17', destination: 'approved network share', hours: 'business hours', ticket: 'REQ-8140' },
      ],
      note: 'Prior exports are tens of records, to an approved destination, during business hours, against a ticket. This one is ~100x larger, to removable media, at midnight, with no ticket.',
    },
    {
      id: 's5-hr-status',
      label: 'HR record for rpatterson',
      match: { index: 'hr', terms: ['rpatterson'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Role', value: 'Senior Underwriter, Commercial Lending' },
        { field: 'Data access', value: 'Loan records — legitimate and required for underwriting review' },
        { field: 'Employment status', value: 'Resignation submitted 2026-08-17 (3 days ago); last day 2026-08-28' },
        { field: 'Disciplinary history', value: 'None on file' },
        { field: 'Destination employer', value: 'Not disclosed to Security' },
      ],
      note: 'Access to this data is part of the job. The employment status is a risk factor to weigh — not evidence of intent.',
    },
    {
      id: 's5-ticket-search',
      label: 'approval requests for a bulk export by rpatterson',
      match: { index: 'ticket', terms: ['rpatterson'] },
      needsWindow: 43200,
      columns: ['ticket', 'requested', 'type', 'status'],
      events: [],
      note: 'Search completed successfully — 0 matching records. No ticket, project, or manager-approved bulk export request exists for this user in the last 30 days. Here the empty result IS the finding: the absence of an approval is a fact worth putting in the report.',
    },
    {
      id: 's5-asset-endpoint',
      label: 'asset record for the endpoint and USB policy',
      match: { index: 'asset', terms: ['rpatterson'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Endpoint', value: 'LEND-LT-14 (laptop, VPN-connected)' },
        { field: 'USB policy', value: 'Mass storage permitted for this role — write auditing enabled, encryption not enforced' },
        { field: 'Device', value: 'Serial 0x9F44C1 — first seen on this endpoint 2026-08-20 23:41' },
      ],
      note: 'The USB write was allowed by policy. That is a control gap to report, and it also means the employee did not have to bypass anything.',
    },
    {
      id: 's5-device-serial',
      label: 'history for USB device serial 0x9F44C1',
      match: { index: 'asset', terms: ['0x9F44C1'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Device', value: 'USB Mass Storage, serial 0x9F44C1 — not a corporate-issued device' },
        { field: 'First seen', value: '2026-08-20 23:41 on LEND-LT-14 (six minutes before the export)' },
        { field: 'Seen elsewhere', value: 'No other endpoint in the estate has mounted this serial' },
        { field: 'Encryption', value: 'Volume not BitLocker-protected — the data left on unencrypted media' },
      ],
      note: 'A personal device, brought in for this, and unencrypted. The last line matters on its own: whatever the intent, 4,812 SSNs are now on media the bank cannot wipe.',
    },
  ],
  intel: {},
  actions: [
    {
      id: 'preserve-evidence',
      label: 'Place a forensic hold on the endpoint and preserve the DLP and VPN logs',
      verdict: 'required',
      result: 'Evidence preserved with chain of custody recorded, before anything is changed on the endpoint.',
    },
    {
      id: 'notify-hr-legal',
      label: 'Escalate to HR, Legal, and the insider threat program',
      verdict: 'required',
      result: 'Case routed to the insider-threat working group; HR and Legal engaged before any employee contact.',
    },
    {
      id: 'usb-policy-review',
      label: 'Raise a control gap: unencrypted USB mass storage permitted for this role',
      verdict: 'acceptable',
      result: 'Control gap logged for the next policy review with this case as supporting evidence.',
    },
    {
      id: 'confront-employee',
      label: 'Contact rpatterson directly and ask what they were doing',
      verdict: 'harmful',
      result: 'You tip off the subject of an active investigation before HR and Legal have been engaged.',
      consequence: {
        from: 'Dana Whitfield',
        role: 'Employment Counsel',
        tone: 'concerned',
        message: 'Please do not contact this employee. An unrecorded conversation started by Security before HR is involved compromises the investigation, and if this ends up in a proceeding it becomes the thing opposing counsel asks about. Route it to us and let us handle the contact.',
      },
    },
    {
      id: 'disable-account-now',
      label: 'Immediately disable the account and revoke building access',
      verdict: 'harmful',
      result: 'Account disabled. The employee — who has not been proven to have done anything wrong — is locked out mid-notice-period, and the subject now knows they are under investigation.',
      consequence: {
        from: 'Dana Whitfield',
        role: 'Employment Counsel',
        tone: 'concerned',
        message: 'Locking out an employee on the basis of an unreviewed DLP alert is an employment decision, and it is not Security\'s to make alone. If the export turns out to be authorized work, this becomes a very expensive mistake. Preserve the evidence, bring it to us, and we decide together.',
      },
    },
    {
      id: 'broadcast-channel',
      label: 'Post the details in the #security-team Slack channel for visibility',
      verdict: 'harmful',
      result: 'Named allegations about a specific employee are now in a channel with 40 members and full retention.',
      consequence: {
        from: 'Dana Whitfield',
        role: 'Employment Counsel',
        tone: 'concerned',
        message: 'That message is discoverable, it names an individual, and it characterizes an unproven allegation as fact. Insider cases run on a need-to-know basis for exactly this reason.',
      },
    },
    {
      id: 'manager-inquiry',
      label: 'Ask HR to check with the employee\'s manager whether this export was requested',
      verdict: 'acceptable',
      result: 'Request routed through HR rather than directly. The manager confirms no bulk export was asked for — obtained without tipping off the subject.',
    },
  ],
  truth: {
    classification: 'suspicious_needs_more_info',
    severity: 'HIGH',
    mitreTechnique: 'T1052.001',
    mitreTactic: 'Exfiltration',
    escalation: 'escalate_ir',
    requiredSearches: ['s5-dlp-history', 's5-hr-status', 's5-ticket-search'],
    requiredIntel: [],
    requiredActions: ['preserve-evidence', 'notify-hr-legal'],
    requiredReportPoints: [
      {
        point: "notes the employee's role normally has legitimate access to this type of data (not accusing based on access alone)",
        any: ['legitimate access', 'normal access', 'role', 'authorized to access', 'normally has access', 'job function', 'job duties', 'within their access', 'underwrit*'],
      },
      {
        point: "identifies the export volume (4,812 records) as far outside this employee's normal pattern",
        any: ['volume', '4,812', '4812', 'unusual', 'anomal*', 'outside', 'normal pattern', '100x', 'far more', 'magnitude', 'baseline'],
      },
      {
        point: "connects the timing to the employee's upcoming resignation as a risk factor, not as proof of intent",
        any: ['resign*', 'notice', 'departing', 'leaving', 'last day', 'offboard*', 'two weeks'],
      },
      {
        point: 'notes the absence of an approved business justification / ticket for this export',
        any: ['no ticket', 'no approv*', 'no business', 'lack of', 'absence of', 'justification', 'not approved', 'unapproved', 'no manager', 'no authorization'],
      },
      {
        point: 'recommends escalation to HR / Legal / the insider threat program, not just a technical security response',
        any: ['hr', 'human resources', 'legal', 'insider threat', 'insider risk', 'employee relations'],
      },
      {
        point: 'uses professional, non-accusatory language pending investigation rather than declaring theft as established fact',
        none: ['stole', 'stealing', 'theft', 'thief', 'guilty', 'criminal', 'malicious employee', 'clearly intended', 'obviously intend*', 'is exfiltrating'],
      },
    ],
  },
  walkthrough: [
    'This one is deliberately different: no external attacker, no malware, no indicator that lights up red. The person has a legitimate job that involves this exact data. Resist writing it up as though guilt is established.',
    'Establish the baseline before the anomaly: `index=dlp rpatterson` over 30 days. Prior exports are tens of records, to an approved share, in business hours, against a ticket. Scale and destination are the anomaly — not access.',
    'Check status: `index=hr rpatterson` shows a resignation submitted three days ago. Departing employees are a well-established insider-risk factor, which makes this worth escalating; it is not evidence of intent on its own.',
    'Look for the innocent explanation and be willing to find one: `index=ticket rpatterson` returns zero results. A search that legitimately comes back empty is still a finding — the absence of an approval is a fact you should state plainly in the report.',
    'Optional: `index=asset rpatterson` shows unencrypted USB mass storage is permitted for this role. That is a control gap worth raising separately, and it also means the employee did not have to defeat any control.',
    'Respond by preserving evidence and routing to HR, Legal, and the insider-threat program. Do not contact the employee, do not disable the account on your own authority, and do not discuss it in a team channel — each of those is a real-world mistake with legal consequences, and all three are offered to you here.',
    'Classify Suspicious — Needs More Investigation, severity HIGH, escalate. Write it factually: what happened, what is unusual about it, what is missing — with no conclusion about intent.',
  ],
  debrief:
`Insider-risk cases are deliberately different from external-attacker cases, and that's the point of this scenario. The evidence is genuinely ambiguous: a legitimate employee, doing something within their normal job function, at a volume, hour, and destination that don't fit their pattern. The correct SOC response isn't to play judge — it's to identify the real anomaly (scale, timing, destination, and the missing approval, not access itself), preserve evidence, escalate to the people equipped to investigate intent, and document in careful, factual, non-accusatory language. The three harmful actions here are all things a well-meaning analyst might do: contacting the employee, disabling the account unilaterally, or posting the details in a team channel. Each one is an employment-law problem as much as a security one. Note too that the empty ticket search is itself evidence — a search returning nothing is a finding when the absence is what matters. And "the user has legitimate access" remains a different question from "was this specific use of that access appropriate."`,
};
