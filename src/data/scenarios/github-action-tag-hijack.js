// A supply-chain compromise with no loud symptom. A third-party GitHub Action
// that the bank's pipelines reference by tag was repointed at a malicious
// commit, and it copied each runner's secrets to an outside host in a single
// small POST. The alert is a low-severity "first-seen destination" from a CI
// runner. The companion to crypto-mining-build-agent with the opposite lesson:
// there the host was visibly infected and the credentials were the question;
// here nothing looks infected at all and the credentials are already gone.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'github-action-tag-hijack',
  difficulty: 2,
  // Cosmetic only: the exfil domain and the address the stolen key was used
  // from are pure labels. The tag, the commits, the run and repository counts
  // and the timings the rubric reasons about are untouched.
  variables: {
    domain: { value: 'cdn-analytics-hub.net', pool: 'suspicious-domain' },
    sourceIp: { value: '91.240.118.6', pool: 'ipv4-external' },
  },
  queueLabel: 'Egress Anomaly — First-seen destination from CI runner ci-runner-07',
  source: 'Proxy egress anomaly detection',
  alert: {
    ref: 'ALT-2026-0908-1187',
    rule: 'First-seen external destination from CI runner (baseline: 90 days)',
    ruleId: 'NET-EGRESS-014',
    reportedSeverity: 'LOW',
    detectedAt: '2026-09-08 14:22:41 UTC',
    slaMinutes: 240,
    entities: [
      { label: 'Source', value: 'ci-runner-07 (10.20.33.41)' },
      { label: 'Destination', value: 'cdn-analytics-hub.net:443 (first seen in 90 days)' },
      { label: 'Request', value: 'POST, 3.1 KB, during workflow run #4471 (deploy-statements)' },
    ],
  },
  rawLog:
`proxy egress event  2026-09-08T14:22:38Z
src=10.20.33.41 (ci-runner-07)  method=POST  dest=cdn-analytics-hub.net:443  bytes_out=3187  bytes_in=12
category=uncategorized  first_seen_for_estate=true  baseline_destinations_for_src=41
runner_context: GitHub Actions self-hosted runner, workflow deploy-statements, run 4471
detection note: single small request; the destination is not on any blocklist.`,
  datasets: [
    { index: 'proxy', label: 'Web proxy egress log', retention: '30d' },
    { index: 'ci', label: 'GitHub Actions workflow run logs', retention: '90d' },
    { index: 'repo', label: 'Repository and workflow inventory', retention: 'current state' },
    { index: 'cloudtrail', label: 'AWS CloudTrail — API audit log', retention: '90d' },
  ],
  searches: [
    {
      id: 's20-proxy-egress',
      label: 'proxy traffic to cdn-analytics-hub.net',
      match: { index: 'proxy', terms: ['cdn-analytics-hub.net'] },
      needsWindow: 1440,
      columns: ['_time', 'src', 'method', 'bytes_out', 'detail'],
      events: [
        { _time: '14:22:38', src: 'ci-runner-07', method: 'POST', bytes_out: '3.1 KB', detail: 'run #4471 deploy-statements' },
        { _time: '14:31:14', src: 'ci-runner-03', method: 'POST', bytes_out: '3.4 KB', detail: 'run #4473 build-mobile-api' },
        { _time: '14:47:52', src: 'ci-runner-11', method: 'POST', bytes_out: '2.9 KB', detail: 'run #4478 publish-ledger-tools' },
      ],
      note: 'It is three runners in twenty-five minutes, not one, and each request fired once and went quiet. That is a step inside a shared piece of pipeline, not a host with something running on it.',
    },
    {
      id: 's20-ci-run',
      label: 'workflow run #4471 step log',
      match: { index: 'ci', terms: ['4471'] },
      needsWindow: 240,
      columns: ['_time', 'step', 'detail'],
      events: [
        { _time: '14:22:11', step: 'Set up job', detail: 'runner ci-runner-07; secrets made available: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, REGISTRY_TOKEN' },
        { _time: '14:22:29', step: 'Setup build cache', detail: 'uses cachelane/setup-build-cache@v3 — tag v3 resolved to commit 9d41e07' },
        { _time: '14:22:30', step: 'Setup build cache', detail: 'The same tag resolved to commit 3b7c1aa on the run of 2026-09-06. The tag was moved on 2026-09-08 13:52.' },
        { _time: '14:22:38', step: 'Setup build cache', detail: 'Step exited 0 after 9 seconds; output lists cache hit only' },
        { _time: '14:26:07', step: 'Deploy', detail: 'deploy to statements-service succeeded' },
      ],
      note: 'The step that made the request is a third-party Action the pipeline references by tag. The tag pointed at one commit on Sunday and a different one this afternoon. Nothing on the runner was changed; the code that ran was replaced upstream, which is why no host alert saw it.',
    },
    {
      id: 's20-action-use',
      label: 'every workflow that uses setup-build-cache',
      match: { index: 'repo', terms: ['setup-build-cache'] },
      needsWindow: 0,
      columns: ['repository', 'workflow', 'pinned_by', 'runs_since_13:52', 'secrets_in_scope'],
      events: [
        { repository: 'statements-service', workflow: 'deploy-statements', pinned_by: 'tag @v3', 'runs_since_13:52': '3', secrets_in_scope: 'AWS deploy key (prod), REGISTRY_TOKEN' },
        { repository: 'mobile-api', workflow: 'build-mobile-api', pinned_by: 'tag @v3', 'runs_since_13:52': '4', secrets_in_scope: 'AWS deploy key (prod), REGISTRY_TOKEN' },
        { repository: 'core-ledger-tools', workflow: 'publish-ledger-tools', pinned_by: 'tag @v3', 'runs_since_13:52': '3', secrets_in_scope: 'REGISTRY_TOKEN, signing key' },
        { repository: 'payments-gateway-config', workflow: 'validate-and-apply', pinned_by: 'tag @v3', 'runs_since_13:52': '2', secrets_in_scope: 'AWS deploy key (prod)' },
        { repository: 'marketing-site', workflow: 'build-site', pinned_by: 'tag @v3', 'runs_since_13:52': '1', secrets_in_scope: 'CDN publish token' },
        { repository: 'internal-docs', workflow: 'build-docs', pinned_by: 'tag @v3', 'runs_since_13:52': '1', secrets_in_scope: 'none' },
      ],
      note: 'Six repositories and fourteen runs since the tag moved, all referencing the Action by a mutable tag and none by a commit hash. The alert saw one of them. Every secret in the last column has to be treated as read.',
    },
    {
      id: 's20-cloudtrail-key',
      label: 'AWS activity by the svc-gha-deploy key',
      match: { index: 'cloudtrail', terms: ['svc-gha-deploy'] },
      needsWindow: 240,
      columns: ['_time', 'event', 'source', 'detail'],
      events: [
        { _time: '13:58:20', event: 'PutObject', source: '10.20.33.12 (ci-runner-02)', detail: 'statements-service-4470.zip — the normal deploy artifact upload' },
        { _time: '14:41:09', event: 'GetCallerIdentity', source: '91.240.118.6', detail: 'first use from outside the corporate ranges' },
        { _time: '14:41:31', event: 'ListBuckets', source: '91.240.118.6', detail: 'same key, same address' },
        { _time: '14:43:02', event: 'GetObject', source: '91.240.118.6', detail: 'ctb-release-artifacts/statements-service/config/prod.env, 2.1 KB' },
      ],
      note: 'Eighteen minutes after the first request, the deploy key was used from an outside address. It confirmed who it was, listed the buckets, and read a production configuration file. This is stolen and in use, not merely exposed.',
    },
  ],
  intel: {
    'cdn-analytics-hub.net': {
      verdict: 'malicious',
      confidence: 'high',
      summary: 'Collection endpoint used in a campaign against CI pipelines: a popular Action has its tag moved to a commit that posts the runner environment here. Registered on 2026-09-07.',
      firstSeen: '2026-09-07',
      sources: ['Commercial threat feed', 'Open-source advisory on the cachelane/setup-build-cache tag'],
      context: 'The advisory names commit 9d41e07 as unauthorized and the previous good commit as 3b7c1aa. It says stolen cloud keys were used within minutes.',
      tags: ['ci-secret-theft', 'supply-chain', 'new-domain'],
    },
    '91.240.118.6': {
      verdict: 'malicious',
      confidence: 'high',
      summary: 'Hosting-provider address that tests stolen cloud keys within minutes of collection.',
      firstSeen: '2026-08-29',
      sources: ['Credential-abuse feed'],
      tags: ['stolen-key-testing', 'hosting-provider'],
    },
  },
  actions: [
    {
      id: 'deactivate-deploy-key',
      label: 'Deactivate the svc-gha-deploy AWS access key and start a review of everything it touched',
      verdict: 'required',
      result: 'Key deactivated at 14:58. The address can no longer call AWS with it; CloudTrail review begins from 14:41.',
    },
    {
      id: 'rotate-all-exposed-secrets',
      label: 'Rotate every secret available to the six affected workflows: the AWS keys, the registry token, the signing key and the CDN publish token',
      verdict: 'required',
      result: 'All of them rotated and the old values revoked. The signing key is reissued and the previous one added to the revocation list. Anything the Action read is now worthless.',
    },
    {
      id: 'pin-action-to-hash',
      label: 'Pin cachelane/setup-build-cache to the known-good commit 3b7c1aa by full hash, or disable it, in every workflow',
      verdict: 'required',
      result: 'All six workflows pinned to the full commit hash. A moved tag can no longer change what those pipelines run.',
    },
    {
      id: 'preserve-run-logs',
      label: 'Preserve the workflow run logs and the proxy logs for the window before they age out',
      verdict: 'acceptable',
      result: 'Runs 4471 to 4480 and the proxy logs exported and hashed. IR will need them to say exactly what each run could read.',
    },
    {
      id: 'block-exfil-domain',
      label: 'Block cdn-analytics-hub.net at the proxy',
      verdict: 'acceptable',
      result: 'The domain is blocked, so further runs cannot send anything there. It does nothing about the secrets already taken or the code that still runs.',
    },
    {
      id: 'delete-run-logs',
      label: 'Delete the six repositories\' workflow run logs for the window, since they may contain secrets',
      verdict: 'harmful',
      result: 'Logs for runs 4471 to 4480 deleted. The record of what each run read and when is gone, and the secrets were never in those logs; they were in the environment.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'Those logs were the only record of which runs resolved the bad commit and what each could see. The secrets were never printed in them, so deleting them protected nothing and now I cannot tell you how many runs were affected.',
      },
    },
    {
      id: 'revert-to-previous-tag',
      label: 'Point the workflows back at the previous tag and close the alert',
      verdict: 'harmful',
      result: 'Workflows reference @v2. The runs are green, the alert is closed, and the key is still live and in use from an outside address.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'A tag is only a pointer, and whoever moved it once can move it again. More to the point, reverting does nothing about the secrets that already left, which were in use twenty minutes after they were taken. You closed it with the key still live.',
      },
    },
    {
      id: 'block-domain-and-close',
      label: 'Block the destination at the proxy and close the alert as resolved',
      verdict: 'harmful',
      result: 'The domain is blocked and the alert is closed. The key is still active, the tag still resolves to the bad commit, and no secret has been rotated.',
      consequence: {
        from: 'Tom Alvarez',
        role: 'Security Engineering Manager',
        tone: 'concerned',
        message: 'Blocking the destination only stops the next request. Your own detection just told you the secrets already left, and the deploy key has been in use from an outside address. Closing at that point puts a resolved status on an open compromise.',
      },
    },
    {
      id: 'disable-all-actions',
      label: 'Disable GitHub Actions for the whole organization',
      verdict: 'unnecessary',
      result: 'Every pipeline in the bank stops, including the emergency-fix path for two production services.',
      consequence: {
        from: 'Tom Alvarez',
        role: 'Security Engineering Manager',
        tone: 'neutral',
        message: 'You know which Action and which six workflows. Turning off the whole platform to stop one Action blocks every fix and every deploy until someone re-enables it. Pin or disable the one Action instead.',
      },
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'CRITICAL',
    mitreTechnique: 'T1195.002',
    mitreTactic: 'Initial Access',
    escalation: 'escalate_ir',
    responseTargetMinutes: 30,
    requiredSearches: ['s20-ci-run', 's20-action-use', 's20-cloudtrail-key'],
    requiredIntel: ['cdn-analytics-hub.net'],
    requiredActions: ['deactivate-deploy-key', 'rotate-all-exposed-secrets', 'pin-action-to-hash'],
    requiredReportPoints: [
      {
        point: 'names the third-party Action whose mutable tag was repointed as the cause, not a fault on the runner',
        any: ['setup-build-cache', 'cachelane', 'tag', 'repointed', 'moved', 'third-party action', 'github action', 'supply chain', '9d41e07'],
      },
      {
        point: 'states the secrets in the runner environment were exfiltrated, so the theft is confirmed',
        any: ['exfiltrat*', 'stolen', 'harvest*', 'secret*', 'credential*', 'environment variable*', 'copied'],
      },
      {
        point: 'states the stolen AWS key was already used from an outside address',
        any: ['91.240.118.6', 'getcalleridentity', 'svc-gha-deploy', 'already used', 'key was used', 'used from', 'outside address', 'external address'],
      },
      {
        point: 'scopes it to all six repositories and fourteen runs, and every secret they could read',
        any: ['six', '6 repositories', 'fourteen', '14 runs', 'every repository', 'all repositories', 'other repositories', 'every secret', 'all secrets', 'every workflow'],
      },
      {
        point: 'names pinning the Action to a full commit hash as the durable fix for a mutable tag',
        any: ['pin*', 'commit hash', 'full hash', 'full commit', 'sha'],
      },
      {
        point: 'does not treat reverting the tag, blocking the domain or rotating one secret as sufficient',
        none: ['revert the tag and close', 'block the domain and close', 'blocking the domain resolves', 'rotating only', 'only rotate', 'just rotate'],
      },
    ],
  },
  walkthrough: [
    'The alert says LOW: one small POST to a first-seen domain from a CI runner. Read it for what it hides. A runner has no user, so ask which step made the request.',
    '`index=ci 4471` (widen the window past 15 minutes) shows the request came from the Setup build cache step, which uses `cachelane/setup-build-cache@v3`. The same tag resolved to a different commit on Sunday. The tag was moved this afternoon.',
    'Look up cdn-analytics-hub.net. It was registered yesterday and the advisory ties it to exactly this Action. `index=proxy cdn-analytics-hub.net` shows it was not one runner but three in twenty-five minutes.',
    '`index=repo setup-build-cache` sets the scope. Six repositories reference the Action by tag, fourteen runs happened since it moved, and the last column lists every secret each one could read.',
    'The question that decides the severity is whether anything was used. `index=cloudtrail svc-gha-deploy` shows the deploy key used from 91.240.118.6, a hosting address, eighteen minutes after the first request. It read a production configuration file.',
    'Deactivate the key, rotate every secret in scope, and pin the Action to a full commit hash so a moved tag cannot do this again. Reverting the tag or blocking the domain leaves the compromise open.',
    'Classify True Positive at CRITICAL and escalate to IR. The tool said LOW, and the gap between that and the evidence is the case.',
  ],
  debrief:
`The alert was rated LOW because the symptom is tiny: one small request to a destination nobody had seen. That is exactly how a well-built secret-stealing step looks. It does not run a miner or open a shell, and no host is infected. It reads the environment, sends it once, and exits zero, so nothing on the runner looks wrong and the only trace is a single line at the proxy.

Everything that matters is upstream and downstream of that line. Upstream, the pipelines trust a tag, and a tag is a movable label: whoever controls the Action's repository can change what runs in your pipelines without touching yours. Downstream, the stolen key was in use within about twenty minutes, which turns a possible exposure into a confirmed compromise and puts a production deploy identity in an attacker's hands.

That is why this belongs with IR at CRITICAL. The strongest reports here state what is certain (the secrets left, one of them was used), scope the rest by the six workflows rather than the one runner that alerted, and give the fix that outlives the incident: pin third-party Actions to a full commit hash.`,
};
