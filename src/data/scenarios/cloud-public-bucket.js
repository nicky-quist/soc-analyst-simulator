// Scenario: public bucket misconfiguration

export default {
  id: 'cloud-public-bucket',
  difficulty: 2,
  // Variables
  variables: {
    sourceIp: { value: '193.32.162.11', pool: 'ipv4-external' },
  },
  queueLabel: 'Cloud Alert — S3 Bucket ctb-statements-archive Publicly Accessible',
  source: 'AWS Config + Security Hub',
  alert: {
    ref: 'ALT-2026-0824-1041',
    rule: 'S3.2 — S3 buckets should prohibit public read access (NON_COMPLIANT)',
    ruleId: 'CSPM-S3-002',
    reportedSeverity: 'CRITICAL',
    detectedAt: '2026-08-24 10:41:07 UTC',
    slaMinutes: 30,
    entities: [
      { label: 'Resource', value: 'S3 bucket ctb-statements-archive (coastal-prod)' },
      { label: 'Data class tag', value: 'Confidential — customer PII' },
      { label: 'Finding', value: 'Bucket policy grants Principal "*"; Block Public Access disabled' },
    ],
  },
  rawLog:
`Security Hub finding — S3.2 S3 buckets should prohibit public read access
Compliance: FAILED   Severity: CRITICAL (label: data-class=Confidential)   Account: 4471-2098-3310 (coastal-prod)

Resource:  arn:aws:s3:::ctb-statements-archive
Config rule: s3-bucket-public-read-prohibited — evaluated 2026-08-24T10:41:07Z (periodic, 3-hourly)
Last compliant evaluation: 2026-08-24T07:41:03Z
Note: the finding does not say whether anything was actually read while the bucket was public.`,
  datasets: [
    { index: 'config', label: 'AWS Config — resource state, tags & policy', retention: 'current state' },
    { index: 'cloudtrail', label: 'AWS CloudTrail — API audit log', retention: '90d' },
    { index: 's3', label: 'S3 server access logs', retention: '30d' },
    { index: 'change', label: 'Change calendar & CI/CD pipeline log', retention: '1y' },
  ],
  searches: [
    {
      id: 's7-config-bucket',
      satisfies: 's7-bucket-state',
      label: 'Config record for ctb-statements-archive',
      match: { index: 'config', terms: ['ctb-statements-archive'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Bucket', value: 'ctb-statements-archive — customer statement PDFs, 2019 to present' },
        { field: 'Owner', value: 'Statements Platform team' },
        { field: 'Data class', value: 'Confidential — customer PII (one customer ID in every object key)' },
        { field: 'Objects', value: '41,880 total; 214 under the 2019/ legacy prefix' },
        { field: 'Block Public Access', value: 'ALL FOUR SETTINGS OFF since 08:11 today (was ON since creation)' },
        { field: 'Bucket policy', value: 'Principal "*": s3:ListBucket on the bucket, s3:GetObject on 2019/* only' },
        { field: 'Object ACLs', value: 'Private — the policy alone opens 2019/*; every other prefix still denies anonymous reads' },
      ],
      note: 'The whole bucket is listable and one prefix is readable. That is narrower than the CRITICAL label implies, and wider than nothing: listing hands out the customer IDs embedded in every object key.',
    },
    {
      id: 's7-cloudtrail-change',
      satisfies: 's7-change-cause',
      label: 'CloudTrail changes to ctb-statements-archive',
      match: { index: 'cloudtrail', terms: ['ctb-statements-archive'] },
      needsWindow: 240,
      columns: ['_time', 'event', 'principal', 'detail'],
      events: [
        { _time: '08:11:52', event: 'DeleteBucketPublicAccessBlock', principal: 'role/terraform-deploy', detail: 'userAgent Terraform/1.7.5 — pipeline run #2291' },
        { _time: '08:12:03', event: 'PutBucketPolicy', principal: 'role/terraform-deploy', detail: 'Statement: Principal "*", ListBucket + GetObject on 2019/*' },
        { _time: '09:30:12', event: 'PutObject (2026/stmt_C-204118_2026-07.pdf)', principal: 'role/svc-statements-render', detail: 'normal monthly statement render' },
      ],
      note: 'Both changes came from the deployment pipeline, seconds apart, so this is a change gone wrong rather than someone poking at the bucket. Nobody logged in and nobody touched IAM.',
    },
    {
      id: 's7-change-ticket',
      satisfies: 's7-change-cause',
      label: 'Change record CHG-4507 and pipeline run',
      match: { index: 'change', terms: ['CHG-4507'] },
      needsWindow: 1440,
      columns: ['_time', 'record', 'detail'],
      events: [
        { _time: 'Aug 21 15:20', record: 'CHG-4507', detail: 'Publish marketing PDFs via CDN — target bucket ctb-public-assets. Approved by IT Ops, one reviewer.' },
        { _time: 'Aug 24 08:10', record: 'Pipeline run #2291', detail: 'terraform apply by a.voss. Module input bucket_name = ctb-statements-archive (copied from the statements stack).' },
        { _time: 'Aug 24 08:10', record: 'Plan output', detail: 'aws_s3_bucket_public_access_block.this will be destroyed; aws_s3_bucket_policy.public_read will be created — reviewer approved the plan without opening the resource list.' },
        { _time: 'Aug 24 08:10', record: 'Policy gate', detail: 'OPA check "no-public-s3-policy" ran in WARN-ONLY mode and printed a warning nobody read.' },
      ],
      note: 'The change was for a different bucket. One wrong variable, one approver who saw a routine plan, and a preventive check that only warns. The control failure matters as much as the exposure.',
    },
    {
      id: 's7-s3-access',
      label: 'S3 access log for ctb-statements-archive',
      match: { index: 's3', terms: ['ctb-statements-archive'] },
      needsWindow: 240,
      columns: ['_time', 'requester', 'operation', 'key', 'status'],
      events: [
        { _time: '09:30:12', requester: 'svc-statements-render', operation: 'REST.PUT.OBJECT', key: '2026/stmt_C-204118_2026-07.pdf', status: '200' },
        { _time: '09:47:10', requester: 'anonymous (193.32.162.11)', operation: 'REST.GET.BUCKET (list)', key: '14 pages of keys', status: '200' },
        { _time: '09:52:03', requester: 'anonymous (193.32.162.11)', operation: 'REST.GET.OBJECT', key: '2019/stmt_C-100482_2019.pdf', status: '200 — 212 KB' },
        { _time: '09:52:05', requester: 'anonymous (193.32.162.11)', operation: 'REST.GET.OBJECT', key: '2019/stmt_C-100977_2019.pdf', status: '200 — 198 KB' },
        { _time: '09:52:09', requester: 'anonymous (193.32.162.11)', operation: 'REST.GET.OBJECT', key: '2019/stmt_C-101340_2019.pdf', status: '200 — 204 KB' },
        { _time: '09:52:31', requester: 'anonymous (193.32.162.11)', operation: 'REST.GET.OBJECT', key: '2021/stmt_C-100482_2021.pdf', status: '403 AccessDenied' },
        { _time: '09:52:33', requester: 'anonymous (193.32.162.11)', operation: 'REST.GET.OBJECT', key: '2022/stmt_C-100977_2022.pdf', status: '403 AccessDenied' },
      ],
      note: 'One external address listed the bucket, downloaded three 2019 statements, then tried newer years and was refused. Three customers\' statements have left, not 41,880, and nothing suggests the address knew what it had found.',
    },
  ],
  intel: {
    '193.32.162.11': {
      verdict: 'suspicious',
      confidence: 'medium',
      summary: 'Hosting-provider address that sweeps for publicly listable cloud storage across many organizations and pulls a few files to check for sensitive content. Opportunistic, not targeted at the bank; no reports of extortion or resale from this address.',
      firstSeen: '2026-03-14',
      sources: ['Cloud misconfiguration scanner feed', 'Community bucket-enumeration reports'],
      tags: ['bucket-enumeration', 'opportunistic', 'hosting-provider'],
    },
  },
  actions: [
    {
      id: 'restore-block-public-access',
      label: 'Re-enable S3 Block Public Access on ctb-statements-archive and remove the Principal "*" policy',
      detail: 'Closes the exposure without touching the data.',
      verdict: 'required',
      result: 'Block Public Access restored and the policy removed at 10:55. Anonymous requests now return 403. The Terraform state is flagged so the next apply does not undo it.',
    },
    {
      id: 'preserve-bucket-logs',
      label: 'Preserve CloudTrail, Config history and S3 access logs for the exposure window',
      verdict: 'required',
      result: 'Logs exported to the case with hashes. The 30-day S3 access log is the only record of which objects were fetched, and it ages out.',
    },
    {
      id: 'scope-and-notify-privacy',
      label: 'Establish exactly which objects were fetched, and notify the data owner and Privacy',
      verdict: 'required',
      result: 'Three 2019 statements downloaded by one external address, covering three customers. Privacy is assessing notification; the Statements Platform owner has the timeline.',
    },
    {
      id: 'audit-public-buckets',
      label: 'Sweep the account for other buckets with public policies or disabled Block Public Access',
      verdict: 'acceptable',
      result: 'One more bucket found with Block Public Access off — a static site with no sensitive data, already on the exceptions list. Logged as a hardening follow-up.',
    },
    {
      id: 'block-scanner-ip',
      label: 'Block the scanning address at the WAF',
      verdict: 'acceptable',
      result: 'Address blocked. Harmless, though the bucket is already closed and scanners of this kind rotate addresses constantly.',
    },
    {
      id: 'delete-legacy-objects',
      label: 'Delete the 214 objects under 2019/ so nothing else can be downloaded',
      verdict: 'harmful',
      result: '214 statements deleted. They fall under a seven-year retention obligation, and the evidence of exactly what was exposed is gone. The bucket was already closable without touching them.',
      consequence: {
        from: 'Renata Kowalski',
        role: 'Privacy Counsel',
        tone: 'concerned',
        message: 'Those statements are records we are required to keep, and now we cannot show which three were taken or what they contained. The exposure was stopped by turning Block Public Access back on. Deleting the data added a retention breach to a three-file incident.',
      },
    },
    {
      id: 'delete-deploy-role',
      label: 'Delete the terraform-deploy IAM role that made the change',
      verdict: 'harmful',
      result: 'Role deleted. Every pipeline that assumes it, including the emergency failover deployment, now fails, and the principal in CloudTrail no longer resolves.',
      consequence: {
        from: 'Dev Malhotra',
        role: 'Platform Engineering Lead',
        tone: 'concerned',
        message: 'The role did exactly what the change told it to do. Deleting it stops every deployment we have, and it does nothing about a bucket that was already fixable in one click. The failure was a reviewed plan and a warn-only check, not the account.',
      },
    },
    {
      id: 'notify-customers-now',
      label: 'Email the three affected customers directly before anyone has reviewed it',
      verdict: 'unnecessary',
      result: 'Three customers received an unreviewed breach notice. Whether one is legally required, and what it should say, is a decision for Privacy and Legal.',
      consequence: {
        from: 'Renata Kowalski',
        role: 'Privacy Counsel',
        tone: 'neutral',
        message: 'Notification has legal wording, timing and jurisdiction rules. It is Privacy\'s call, made from the facts you have now gathered. Contacting customers first commits the bank to a position before we have chosen one.',
      },
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'HIGH',
    mitreTechnique: 'T1530',
    mitreTactic: 'Collection',
    escalation: 'escalate_tier2',
    responseTargetMinutes: 20,
    requiredSearches: ['s7-change-cause', 's7-bucket-state', 's7-s3-access'],
    requiredIntel: ['193.32.162.11'],
    requiredActions: ['restore-block-public-access', 'preserve-bucket-logs', 'scope-and-notify-privacy'],
    requiredReportPoints: [
      {
        point: 'identifies the root cause as a Terraform change aimed at the wrong bucket, not an attack or a compromised account',
        any: ['terraform', 'chg-4507', 'pipeline', 'wrong bucket', 'misconfig*', 'deploy*', 'change'],
      },
      {
        point: 'scopes the exposure precisely: the whole bucket was listable but only the 2019 legacy prefix was readable',
        any: ['2019', 'legacy prefix', 'listing', 'listable', 'list the bucket', 'listbucket', 'only the 2019'],
      },
      {
        point: 'states that three objects were actually downloaded by one external address, rather than treating the whole bucket as taken',
        any: ['three', '3 object*', '3 statement*', 'three statement*', 'three customer*', 'downloaded', 'getobject'],
      },
      {
        point: 'recommends restoring Block Public Access and removing the public policy as containment, not deleting data',
        any: ['block public access', 'remove* the policy', 'public policy', 'bucket policy', 'revok*', 'restor*'],
      },
      {
        point: 'flags the three customers\' PII as a matter for Privacy or Legal to assess for notification',
        any: ['privacy', 'legal', 'notification', 'notify', 'pii', 'customer*', 'regulator*'],
      },
      {
        point: 'names the control failure: a warn-only policy check and a plan approved without review',
        any: ['warn-only', 'warn only', 'guardrail*', 'preventive', 'policy check', 'policy-as-code', 'opa', 'peer review', 'plan review', 'reviewer'],
      },
    ],
  },
  walkthrough: [
    'The alert says CRITICAL and the bucket is tagged Confidential, and that is all it says. It cannot tell you whether anything was read. Your job is to size the exposure before you decide how loud to be.',
    'Start with what the bucket is now: `index=config ctb-statements-archive`. Block Public Access is off and a policy grants Principal "*". Read the policy closely: ListBucket on the whole bucket, but GetObject on `2019/*` only. Listable is not the same as readable.',
    'Find out how it got there: `index=cloudtrail ctb-statements-archive` over four hours. The pipeline role removed Block Public Access and wrote the policy eleven seconds apart. No login, no key, no attacker.',
    'Confirm the cause in the change record: `index=change CHG-4507` over 24 hours. The ticket was for `ctb-public-assets`. A module variable pointed at the statements stack, the reviewer approved the plan without opening the resource list, and the policy check only warns.',
    'Now the question that decides severity: `index=s3 ctb-statements-archive` over four hours. One external address listed the bucket and downloaded three 2019 statements, then tried newer years and got 403. Three customers, not 41,880.',
    'Enrich the address. A hosting-provider scanner that sweeps for open buckets and samples a few files is opportunistic, which is why this is not a targeted breach and not an IR page.',
    'Contain by turning Block Public Access back on and removing the policy. Preserve the logs, because the S3 access log ages out in 30 days and is the only proof of which three objects left. Deleting the 2019 objects or the pipeline role makes things worse.',
    'Classify True Positive, overturn CRITICAL down to HIGH, map to T1530 (Data from Cloud Storage), and escalate to Tier 2 with Privacy looped in. Say plainly that three statements were downloaded and the bucket as a whole was not.',
  ],
  debrief:
`This is the mirror image of the leaked-key case. There, "the bucket was accessible" undersold a large download. Here, "CRITICAL, confidential data, publicly accessible" oversells a narrow one, and both errors come from the same habit: reading the alert's label instead of the access log. The facts that decided it were three lines in the S3 log and one clause in the bucket policy. The bucket was listable but only one prefix was readable, and one scanner fetched three files before it was refused on newer years. That is a real exposure with a real privacy question for three customers, and it belongs with Tier 2 and Privacy, not with an IR page. The cause was a reviewed plan that nobody read and a policy check set to warn instead of block, which is why the report has to name the control gap as well as the exposure. The traps are all overreactions: deleting the exposed statements breaks a retention obligation and destroys the evidence, deleting the deploy role stops every deployment, and emailing customers early commits the bank to a position Privacy has not chosen.`,
};
