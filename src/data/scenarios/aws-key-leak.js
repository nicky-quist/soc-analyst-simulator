// A cloud credential leak: a service account key committed to a public repo,
// then used from infrastructure nobody recognizes. Tests whether an L1 can work
// an incident where there is no host to isolate and no malware to find.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'aws-key-leak',
  order: 6,
  queueLabel: 'Cloud Alert — Anomalous API Activity for IAM Key AKIA…N7QF',
  source: 'AWS GuardDuty + CloudTrail',
  alert: {
    ref: 'ALT-2026-0821-0658',
    rule: 'UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.OutsideAWS',
    ruleId: 'GD-IAM-118',
    reportedSeverity: 'HIGH',
    detectedAt: '2026-08-21 06:58:12 UTC',
    slaMinutes: 30,
    entities: [
      { label: 'Principal', value: 'svc-etl-loader (IAM user)' },
      { label: 'Access key', value: 'see event for the full key ID' },
      { label: 'Source', value: 'external address, non-AWS ASN (see event)' },
    ],
  },
  rawLog:
`GuardDuty finding — UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration.OutsideAWS
Severity: 8.0 (High)   Account: 4471-2098-3310 (coastal-prod)   Region: us-east-1

{"eventTime":"2026-08-21T06:58:12Z","eventSource":"sts.amazonaws.com","eventName":"GetCallerIdentity",
 "userIdentity":{"type":"IAMUser","userName":"svc-etl-loader","accessKeyId":"AKIA4T7NQZP2W9XKN7QF"},
 "sourceIPAddress":"45.83.42.19","userAgent":"aws-cli/2.15.30 Python/3.11.6 Linux/6.1.0",
 "note":"Credentials associated with this key have only ever been used from EC2 instances in us-east-1 (10.30.x.x) until today."}`,
  datasets: [
    { index: 'cloudtrail', label: 'AWS CloudTrail — API audit log', retention: '90d' },
    { index: 'iam', label: 'IAM identity & key inventory', retention: 'current state' },
    { index: 'vcs', label: 'GitHub org audit & secret scanning', retention: '1y' },
    { index: 's3', label: 'S3 server access logs', retention: '30d' },
  ],
  searches: [
    {
      id: 's6-cloudtrail-key',
      satisfies: 's6-api-activity',
      label: 'CloudTrail activity for AKIA4T7NQZP2W9XKN7QF',
      match: { index: 'cloudtrail', terms: ['AKIA4T7NQZP2W9XKN7QF'] },
      needsWindow: 240,
      columns: ['_time', 'event', 'source_ip', 'result'],
      events: [
        { _time: '06:58:12', event: 'GetCallerIdentity', source_ip: '45.83.42.19', result: 'Success' },
        { _time: '06:58:31', event: 'ListBuckets', source_ip: '45.83.42.19', result: 'Success — 34 buckets returned' },
        { _time: '06:59:04', event: 'GetBucketAcl (ctb-customer-data)', source_ip: '45.83.42.19', result: 'Success' },
        { _time: '06:59:22', event: 'ListObjectsV2 (ctb-customer-data)', source_ip: '45.83.42.19', result: 'Success — 12,904 keys' },
        { _time: '07:01:47', event: 'GetObject (ctb-customer-data/exports/loans_2026Q2.csv)', source_ip: '45.83.42.19', result: 'Success — 41 MB' },
        { _time: '07:03:10', event: 'CreateUser (svc-backup-helper)', source_ip: '45.83.42.19', result: 'FAILED — AccessDenied' },
        { _time: '07:03:29', event: 'AttachUserPolicy (AdministratorAccess)', source_ip: '45.83.42.19', result: 'FAILED — AccessDenied' },
        { _time: '07:04:55', event: 'ListObjectsV2 (ctb-customer-data)', source_ip: '45.83.42.19', result: 'Success — 12,904 keys' },
        { _time: '07:06:02', event: 'GetObject (ctb-customer-data/exports/loans_2026Q1.csv)', source_ip: '45.83.42.19', result: 'Success — 38 MB' },
      ],
      note: 'Read succeeded, privilege escalation failed. Two export files totalling 79 MB have already left the bucket, and the enumeration is still running.',
    },
    {
      id: 's6-cloudtrail-ip',
      satisfies: 's6-api-activity',
      label: 'CloudTrail activity from 45.83.42.19',
      match: { index: 'cloudtrail', terms: ['45.83.42.19'] },
      needsWindow: 240,
      columns: ['_time', 'event', 'source_ip', 'result'],
      events: [
        { _time: '06:58:12', event: 'GetCallerIdentity', source_ip: '45.83.42.19', result: 'Success' },
        { _time: '06:58:31', event: 'ListBuckets', source_ip: '45.83.42.19', result: 'Success — 34 buckets returned' },
        { _time: '06:59:22', event: 'ListObjectsV2 (ctb-customer-data)', source_ip: '45.83.42.19', result: 'Success — 12,904 keys' },
        { _time: '07:01:47', event: 'GetObject (ctb-customer-data/exports/loans_2026Q2.csv)', source_ip: '45.83.42.19', result: 'Success — 41 MB' },
        { _time: '07:03:10', event: 'CreateUser (svc-backup-helper)', source_ip: '45.83.42.19', result: 'FAILED — AccessDenied' },
        { _time: '07:06:02', event: 'GetObject (ctb-customer-data/exports/loans_2026Q1.csv)', source_ip: '45.83.42.19', result: 'Success — 38 MB' },
      ],
      note: 'Only this one principal has been used from this address — the attacker holds the key, not a broader foothold in the account.',
    },
    {
      id: 's6-iam-key',
      label: 'IAM record for svc-etl-loader',
      match: { index: 'iam', terms: ['svc-etl-loader'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Principal', value: 'svc-etl-loader — service account, nightly loan-data ETL' },
        { field: 'Owner', value: 'Data Platform team' },
        { field: 'Access key', value: 'AKIA4T7NQZP2W9XKN7QF — created 2024-03-11, never rotated' },
        { field: 'Attached policy', value: 's3:GetObject, s3:ListBucket on ctb-customer-data (read)' },
        { field: 'Also granted', value: 'iam:CreateUser — over-permissioned, unused since creation' },
        { field: 'MFA', value: 'Not applicable — programmatic access key' },
        { field: 'Normal source', value: 'EC2 instances i-0a44… and i-0b91… in 10.30.0.0/16 only' },
      ],
      note: 'A 29-month-old key that was never rotated, on an account that can read the customer loan bucket. The iam:CreateUser grant is why the attacker tried to escalate.',
    },
    {
      id: 's6-vcs-secret',
      label: 'GitHub secret-scanning alerts for this key',
      match: { index: 'vcs', terms: ['AKIA4T7NQZP2W9XKN7QF'] },
      needsWindow: 43200,
      columns: ['_time', 'repository', 'visibility', 'detail'],
      events: [
        { _time: 'Aug 15 16:42', repository: 'coastal-data-tools', visibility: 'PUBLIC', detail: 'Key committed in commit 4f2a1c9 — file: scripts/load_loans.py' },
        { _time: 'Aug 15 16:44', repository: 'coastal-data-tools', visibility: 'PUBLIC', detail: 'GitHub secret scanning alert raised — no owner response' },
        { _time: 'Aug 18 09:10', repository: 'coastal-data-tools', visibility: 'PUBLIC', detail: 'Commit 8c07b2e removed the line from the file — key NOT rotated, still valid in git history' },
      ],
      note: 'The key has been publicly readable for six days, and the "fix" only deleted the line in a later commit. Anyone who cloned the repo, and every scraper watching new commits, still has a working credential.',
    },
    {
      id: 's6-s3-access',
      label: 'S3 access log for ctb-customer-data',
      match: { index: 's3', terms: ['ctb-customer-data'] },
      needsWindow: 240,
      columns: ['_time', 'requester', 'operation', 'key', 'bytes'],
      events: [
        { _time: '07:01:47', requester: 'svc-etl-loader', operation: 'REST.GET.OBJECT', key: 'exports/loans_2026Q2.csv', bytes: '41.2 MB' },
        { _time: '07:06:02', requester: 'svc-etl-loader', operation: 'REST.GET.OBJECT', key: 'exports/loans_2026Q1.csv', bytes: '38.7 MB' },
        { _time: '02:00:04', requester: 'svc-etl-loader', operation: 'REST.GET.OBJECT', key: 'staging/nightly_batch.parquet', bytes: '512 MB' },
      ],
      note: 'The 02:00 read is the legitimate nightly ETL from an EC2 address. The two 07:00 reads are the attacker. Those two files hold personally identifiable loan data — this is a potential reportable breach, not just an access issue.',
    },
  ],
  intel: {
    '45.83.42.19': {
      verdict: 'malicious',
      confidence: 'high',
      summary: 'Hosting provider repeatedly used for automated abuse of leaked cloud credentials. Listed in two feeds for scraping public repositories and testing keys within minutes of commit.',
      firstSeen: '2026-05-02',
      sources: ['Cloud abuse feed (community)', 'AbuseIPDB (78% confidence)', 'Vendor report: "keys are used within 90 seconds of publication"'],
      tags: ['cloud-credential-abuse', 'repo-scraping', 'bulletproof-hosting'],
    },
  },
  actions: [
    {
      id: 'deactivate-key',
      label: 'Deactivate access key AKIA4T7NQZP2W9XKN7QF in IAM',
      detail: 'Immediately invalidates the credential wherever it is held.',
      verdict: 'required',
      result: 'Key deactivated at 07:0x. Subsequent API calls from 45.83.42.19 return InvalidClientTokenId. The nightly ETL will fail tonight unless a new key is issued — Data Platform notified.',
    },
    {
      id: 'preserve-cloud-logs',
      label: 'Preserve CloudTrail and S3 access logs for the exposure window',
      verdict: 'required',
      result: 'Logs exported to the case with hashes. This is what determines exactly which records left, which is what Legal will need.',
    },
    {
      id: 'scope-data-exposure',
      label: 'Determine exactly which records were downloaded and notify Legal/Privacy',
      verdict: 'required',
      result: 'Two quarterly export files confirmed downloaded — approximately 12,900 customer loan records containing PII. Privacy counsel engaged on notification obligations.',
    },
    {
      id: 'block-source-ip',
      label: 'Add 45.83.42.19 to the WAF and an SCP deny condition',
      verdict: 'acceptable',
      result: 'Address blocked. Worth doing, though a key that is public will simply be used from somewhere else.',
    },
    {
      id: 'rotate-and-audit-keys',
      label: 'Audit all long-lived access keys in the account for age and permissions',
      verdict: 'acceptable',
      result: 'Eleven keys older than 12 months found, four with unused administrative permissions. Filed as a follow-up hardening item.',
    },
    {
      id: 'purge-git-history',
      label: 'Force-push to rewrite the git history removing the key, and close the alert',
      verdict: 'harmful',
      result: 'History rewritten. The key is still valid, still in every clone and cache of that repo, and still being used from 45.83.42.19.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'Rewriting history does not invalidate a credential — the only thing that does is deactivating the key, and that had not been done. For six days that key was public; assume every scraper on the internet has it. Revoke first, clean the repo afterwards, and never treat the cleanup as the remediation.',
      },
    },
    {
      id: 'delete-iam-user',
      label: 'Delete the svc-etl-loader IAM user outright',
      verdict: 'harmful',
      result: 'User deleted. The nightly loan ETL breaks, and the principal referenced throughout CloudTrail no longer resolves, complicating the forensic timeline.',
      consequence: {
        from: 'Priya Raghavan',
        role: 'Data Platform Lead',
        tone: 'concerned',
        message: 'Deleting the identity takes down the nightly load and makes the audit trail harder to read for whoever reconstructs this. Deactivating the key stops the attacker just as fast without breaking production or the investigation.',
      },
    },
    {
      id: 'email-engineering',
      label: 'Email the whole engineering department asking who committed the key',
      verdict: 'unnecessary',
      result: 'Sixty people now know about an active incident, and the commit author was already named in the secret-scanning alert.',
      consequence: {
        from: 'Sarah Okafor',
        role: 'CISO',
        tone: 'neutral',
        message: 'The audit log already told you who committed it. Broadcasting an active incident to a department is how details end up somewhere we cannot control — and it did not move the response forward by a minute.',
      },
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'CRITICAL',
    mitreTechnique: 'T1078.004',
    mitreTactic: 'Persistence / Initial Access',
    escalation: 'escalate_ir',
    responseTargetMinutes: 15,
    requiredSearches: ['s6-api-activity', 's6-iam-key', 's6-vcs-secret'],
    requiredIntel: ['45.83.42.19'],
    requiredActions: ['deactivate-key', 'preserve-cloud-logs', 'scope-data-exposure'],
    requiredReportPoints: [
      {
        point: 'identifies the root cause as a long-lived access key committed to a public repository, not a compromised host',
        any: ['public repo*', 'github', 'commit*', 'secret scan*', 'leaked key', 'source control', 'repository'],
      },
      {
        point: 'states that customer data was actually downloaded, not merely accessible',
        any: ['download*', 'getobject', 'exfil*', 'left the bucket', 'obtained', 'retrieved', '79 mb', 'two files', 'loans_2026'],
      },
      {
        point: 'notes the failed privilege-escalation attempts (CreateUser / AttachUserPolicy) as intent to establish persistence',
        any: ['createuser', 'privilege escalation', 'escalat*', 'attachuserpolicy', 'admin*', 'persist*'],
      },
      {
        point: 'recommends deactivating the key as the containment step, rather than cleaning the repository',
        any: ['deactivat*', 'disable the key', 'revoke*', 'invalidat*', 'rotate*', 'kill the key'],
      },
      {
        point: 'flags the PII exposure as a potential regulatory notification matter for Legal/Privacy',
        any: ['legal', 'privacy', 'notification', 'regulator*', 'breach', 'pii', 'gdpr', 'glba', 'disclos*'],
      },
      {
        point: 'notes the underlying control failures: a 29-month-old unrotated key with unused iam:CreateUser permission',
        any: ['rotat*', 'never rotated', 'over-permission*', 'overprivileg*', 'least privilege', 'unused permission', 'key age', 'long-lived'],
      },
    ],
  },
  walkthrough: [
    'There is no host to isolate here and no malware to find. The compromised thing is a credential, so the whole investigation runs through the audit log.',
    'Take the key ID out of the event and search it: `index=cloudtrail AKIA4T7NQZP2W9XKN7QF`, widened to at least four hours. Read the sequence, not just the first line — GetCallerIdentity and ListBuckets are an attacker orienting themselves, GetObject is data actually leaving, and the failed CreateUser calls are an attempt to get permanent access.',
    'Enrich 45.83.42.19. A provider known for using leaked keys within ninety seconds of publication tells you how this was found: not targeted at the bank, just harvested.',
    'Ask who the principal is: `index=iam svc-etl-loader`. A 29-month-old key that was never rotated, with an unused iam:CreateUser grant nobody noticed. That grant is exactly what the attacker tried to use.',
    'Find the exposure itself: `index=vcs AKIA4T7NQZP2W9XKN7QF` over 30 days. The key was committed to a public repository six days ago, secret scanning raised it, nobody responded, and someone later deleted the line in a follow-up commit while leaving the key valid.',
    'Confirm the impact: `index=s3 ctb-customer-data` distinguishes the legitimate 02:00 ETL read from the two attacker downloads. Those two files contain customer PII, which turns this from an access incident into a possible reportable breach.',
    'Contain by deactivating the key — that, and only that, invalidates it. Cleaning the repository does nothing while the credential still works, and deleting the IAM user breaks production and muddies the audit trail.',
    'Classify True Positive / Critical, map to T1078.004 (Valid Accounts: Cloud Accounts), escalate to IR, and make sure the report says data was downloaded rather than merely exposed — that distinction decides whether Legal has a notification obligation.',
  ],
  debrief:
`Leaked cloud credentials are one of the most common ways a bank's data leaves without anyone touching a laptop, and this scenario is built around the two mistakes that follow. The first is treating the repository as the incident: rewriting git history feels like remediation and changes nothing, because a key that has been public for six days exists in every clone, cache, and scraper database — the only containment is deactivating the key. The second is under-stating impact. "The bucket was accessible" and "12,900 customer records were downloaded" are different sentences with different legal consequences, and the S3 access log is what lets you write the accurate one. Notice also the two control failures sitting underneath: a programmatic key that had not been rotated in 29 months, and an iam:CreateUser permission nobody had ever used — which is precisely what the attacker reached for when they tried to turn temporary access into permanent access. Those belong in the report even though neither is the incident.`,
};
