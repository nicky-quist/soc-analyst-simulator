// A container-escape alert that is an engineer doing exactly what the incident
// process told them to do. The runtime sensor sees a privileged pod with the
// host's process namespace and the node's filesystem mounted on a production
// node, which is precisely what an escape looks like, and it rates it HIGH.
// It is also precisely what `kubectl debug node/` produces when a site
// reliability engineer needs to look at a process on the host. The skill is
// telling the two apart by what the session did, who started it, and whether
// anyone approved it, and then leaving it alone: every response that feels
// safe here takes down the customer workload the engineer is trying to fix.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'k8s-break-glass-debug',
  difficulty: 2,
  // Cosmetic only. The engineer's handle is a pure label; the node, the
  // incident and request numbers, the image and the timings never move.
  variables: {
    engineer: { value: 'lmorales', pool: 'human-username' },
  },
  queueLabel: 'Runtime Alert — Privileged container with host PID on prod node ip-10-20-41-17',
  source: 'Container runtime sensor',
  alert: {
    ref: 'ALT-2026-0915-0233',
    rule: 'Privileged container with hostPID and host filesystem mount on a production node',
    ruleId: 'K8S-RT-021',
    reportedSeverity: 'HIGH',
    detectedAt: '2026-09-15 02:41:22 UTC',
    slaMinutes: 60,
    entities: [
      { label: 'Cluster / node', value: 'ctb-prod-eks / ip-10-20-41-17' },
      { label: 'Pod', value: 'node-debugger-ip-10-20-41-17-x7k2p (namespace: default)' },
      { label: 'Flags', value: 'privileged, hostPID, hostPath mount of /' },
    ],
  },
  rawLog:
`{"time":"2026-09-15T02:41:22Z","rule":"Privileged container with hostPID and host filesystem mount","priority":"Critical","output":"Privileged pod started (pod=node-debugger-ip-10-20-41-17-x7k2p ns=default node=ip-10-20-41-17 image=registry.internal/ops/netshoot:2.3 privileged=true hostPID=true hostPath=/)","tags":["container","escape","mitre_privilege_escalation"]}`,
  datasets: [
    { index: 'k8s', label: 'Kubernetes API server audit log', retention: '30d' },
    { index: 'runtime', label: 'Container runtime sensor events', retention: '30d' },
    { index: 'change', label: 'Incident, on-call and break-glass records', retention: '1y' },
    { index: 'inventory', label: 'Cluster workload and approved-image inventory', retention: 'current state' },
  ],
  searches: [
    {
      id: 's21-k8s-audit',
      label: 'API audit events for node ip-10-20-41-17',
      match: { index: 'k8s', terms: ['ip-10-20-41-17'] },
      needsWindow: 240,
      columns: ['_time', 'user', 'verb', 'object', 'detail'],
      events: [
        { _time: '02:35:40', user: 'lmorales@coastaltrust.example', verb: 'AssumeRole', object: 'break-glass-sre', detail: 'SSO sign-in with MFA; role expires 04:35; request BG-0912' },
        { _time: '02:36:12', user: 'lmorales@coastaltrust.example', verb: 'create', object: 'pods/node-debugger-ip-10-20-41-17-x7k2p', detail: 'kubectl debug node/ip-10-20-41-17 --profile=sysadmin; annotation reason=INC-5521; ttl=2h' },
        { _time: '02:36:31', user: 'lmorales@coastaltrust.example', verb: 'create', object: 'pods/node-debugger-.../exec', detail: 'interactive shell' },
      ],
      note: 'A named engineer, signed in with MFA, assumed a time-boxed break-glass role and created this pod through the audited command that exists for it. The annotation names an incident. Nothing here came from a workload identity or a stolen token.',
    },
    {
      id: 's21-runtime',
      label: 'what ran inside the debug pod',
      match: { index: 'runtime', terms: ['ip-10-20-41-17'] },
      needsWindow: 240,
      columns: ['_time', 'event', 'detail'],
      events: [
        { _time: '02:36:14', event: 'Pod started', detail: 'privileged, hostPID, hostPath / (the flags that raised the alert)' },
        { _time: '02:37:02', event: 'exec', detail: 'crictl ps' },
        { _time: '02:37:48', event: 'exec', detail: 'top -b -n 1' },
        { _time: '02:39:20', event: 'exec', detail: 'cat /proc/2231/smaps_rollup   (PID 2231 = payments-api)' },
        { _time: '02:40:55', event: 'exec', detail: 'cat /proc/2231/status' },
      ],
      note: 'Four read-only commands aimed at one process, the payments-api container. There are no outbound connections, no reads of service-account tokens or secrets, no new binaries and no other node touched. Everything an escape would do that this session did not do is the finding.',
    },
    {
      id: 's21-change',
      label: 'incident INC-5521 and break-glass request',
      match: { index: 'change', terms: ['INC-5521'] },
      needsWindow: 1440,
      columns: ['_time', 'record', 'detail'],
      events: [
        { _time: '02:14', record: 'INC-5521', detail: 'P2: payments-api memory growth, pods OOM-killed every ~40 min. Incident commander: on-call SRE lead.' },
        { _time: '02:31', record: 'BG-0912', detail: 'Break-glass request by lmorales: node debug on ip-10-20-41-17 only, 2 hours, reason INC-5521.' },
        { _time: '02:35', record: 'BG-0912', detail: 'Approved by the on-call SRE lead. Role and pod auto-expire at 04:35.' },
      ],
      note: 'The session was requested, scoped to one node, approved by the incident commander and set to expire. It is the response to a live incident, not a change nobody knows about.',
    },
    {
      id: 's21-inventory',
      label: 'approved-image record for netshoot',
      match: { index: 'inventory', terms: ['netshoot'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Image', value: 'registry.internal/ops/netshoot:2.3 — on the approved debug image list since 2025-11' },
        { field: 'Digest check', value: 'The running pod\'s digest matches the approved image' },
        { field: 'Node ip-10-20-41-17', value: 'Runs 3 payments-api pods (about 18% of card-authorization capacity)' },
        { field: 'Debug pod lifetime', value: 'Auto-deleted at expiry of the break-glass window' },
      ],
      note: 'A known internal image with a matching digest, and a node carrying a fifth of card authorization. That second line is why nothing you do to the node is free.',
    },
  ],
  intel: {},
  actions: [
    {
      id: 'close-false-positive',
      label: 'Close as a false positive, citing INC-5521, BG-0912 and the audit trail',
      verdict: 'required',
      result: 'Closed with the incident and break-glass request attached. The record shows exactly who ran what, and why.',
    },
    {
      id: 'tune-break-glass-detection',
      label: 'Ask Detection Engineering to lower the severity of privileged pods that trace to an approved break-glass record',
      verdict: 'required',
      result: 'Detection Engineering opens a ticket to correlate the rule with break-glass requests. An unapproved privileged pod would still page at HIGH.',
    },
    {
      id: 'confirm-with-engineer',
      label: 'Confirm with the engineer or the incident channel that the session is theirs',
      verdict: 'acceptable',
      result: 'The engineer confirms in the incident channel within a minute. It costs nothing, and it is redundant once the audit trail and the approval are in front of you.',
    },
    {
      id: 'cordon-drain-node',
      label: 'Cordon and drain node ip-10-20-41-17',
      verdict: 'harmful',
      result: 'The node is drained. Its three payments-api pods are evicted and rescheduled, the memory state the engineer was inspecting is gone, and card authorization runs short of capacity for several minutes.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'You evicted the process an approved engineer was in the middle of examining, on the incident it was approved for, and cut a fifth of card authorization capacity while you did it. The approval was in the ticket system you had open.',
      },
    },
    {
      id: 'delete-debug-pod',
      label: 'Delete the debug pod',
      verdict: 'harmful',
      result: 'The pod is deleted and the engineer\'s shell drops mid-command. INC-5521 is still open and the leak has not been reproduced, so the engineer has to request a new session.',
      consequence: {
        from: 'Tom Alvarez',
        role: 'Security Engineering Manager',
        tone: 'concerned',
        message: 'Killing an approved session made the incident longer and taught the on-call lead that the SOC will interrupt their break-glass work. That is how people start working around the break-glass process instead of using it.',
      },
    },
    {
      id: 'revoke-engineer-access',
      label: 'Revoke the engineer\'s break-glass role and disable their cluster access',
      verdict: 'harmful',
      result: 'The role is revoked and the session ends. The engineer is locked out mid-incident, and the on-call lead has to restore access and re-approve.',
      consequence: {
        from: 'Sarah Okafor',
        role: 'CISO',
        tone: 'concerned',
        message: 'Break-glass access is granted so that engineers can act on an incident. Revoking a colleague\'s approved access, in the middle of the incident, on the strength of a rule that cannot tell the difference, is the outcome that gets access approvals slowed down for everyone.',
      },
    },
    {
      id: 'page-ir',
      label: 'Page the on-call Incident Response engineer',
      verdict: 'unnecessary',
      result: 'IR paged at 02:55, reads the audit trail and the approval, and closes it with a note that this did not need them.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'neutral',
        message: 'The approval, the audit trail and the session\'s commands were all in front of you. A privileged pod is not an escape by itself, and an incident commander already knew about this one. Page me when something has no owner.',
      },
    },
  ],
  truth: {
    classification: 'false_positive',
    severity: 'LOW',
    // What the detection would map to; nothing here escaped a container.
    mitreTechnique: 'T1611',
    mitreTactic: 'Privilege Escalation',
    escalation: 'close_false_positive',
    responseTargetMinutes: 45,
    requiredSearches: ['s21-k8s-audit', 's21-runtime', 's21-change'],
    requiredIntel: [],
    requiredActions: ['close-false-positive', 'tune-break-glass-detection'],
    requiredReportPoints: [
      {
        point: 'identifies the pod as an engineer-created break-glass node debug session, not a workload or an escape',
        any: ['break-glass', 'break glass', 'debug', 'sre', 'kubectl debug', 'node-debugger', 'lmorales', 'netshoot'],
      },
      {
        point: 'ties it to an approved record: incident INC-5521 and break-glass request BG-0912',
        any: ['inc-5521', 'bg-0912', 'ticket', 'incident', 'approved', 'authorized', 'authorised', 'approval'],
      },
      {
        point: 'notes what an escape would show that this session lacks: no outbound connections, no secret or token reads, one process on one node',
        any: ['no outbound', 'no connection*', 'no secret*', 'no token*', 'read-only', 'one process', 'single process', 'payments-api', 'no evidence of escape', 'nothing beyond', 'one node'],
      },
      {
        point: 'closes it as a false positive or authorized activity, not as an incident',
        any: ['false positive', 'authorized', 'authorised', 'legitimate', 'expected', 'benign', 'not an incident', 'no incident', 'close'],
      },
      {
        point: 'does not recommend cordoning or draining the node, deleting the pod, or revoking the engineer\'s access',
        none: ['cordon*', 'drain*', 'delete the pod', 'kill the pod', 'terminat*', 'revok*', 'isolat*', 'quarantin*', 'contain*'],
      },
      {
        point: 'recommends tuning the detection so an approved break-glass session is recognized',
        any: ['tun*', 'detection engineering', 'suppress*', 'exception', 'allow-list', 'allowlist', 'correlat*', 'downgrad*'],
      },
    ],
  },
  walkthrough: [
    'The rule is doing what it was built for: a privileged pod with the host\'s PID namespace and filesystem is what an escape looks like. It has no idea who started it. Your job is to add that context, starting with who created the pod.',
    '`index=k8s ip-10-20-41-17` (widen the window past 15 minutes) shows a named engineer assumed a time-boxed break-glass role with MFA and ran `kubectl debug node/`. The annotation names an incident, INC-5521.',
    '`index=change INC-5521` is the approval: a P2 on payments-api memory growth, and a break-glass request for that one node, two hours, approved by the incident commander.',
    '`index=runtime ip-10-20-41-17` is what settles it. Four read-only commands aimed at the payments-api process: no outbound connection, no token or secret read, no other node. An escape would have done the things this session did not.',
    '`index=inventory netshoot` shows a known approved image with a matching digest, and that the node carries three payments-api pods. Anything you do to the node has a cost.',
    'Close as a false positive citing the ticket and the audit trail, and ask Detection Engineering to make the rule aware of break-glass approvals. Cordoning the node, deleting the pod or revoking access each breaks the response to a real incident.',
  ],
  debrief:
`The alert is honest and the severity is wrong. A privileged pod with the host's process namespace and filesystem is an escape technique, and the rule cannot tell a debug session from one, because the flags are the same. What differs is everything the rule cannot see: who started it, whether anyone approved it, what it actually did.

That is the whole case. A person signed in with MFA, took a time-boxed role, and used the audited command built for this; the incident commander approved it against a live P2; and four read-only commands touched one process. An escape opens outbound connections, reads tokens and moves sideways, and none of that happened.

The trap is the response, not the analysis. Cordoning the node, deleting the pod or revoking access each feels careful, and each cuts a fifth of card authorization or strands an engineer in the middle of the incident they were approved for. The useful output is a clean close that cites the record, and a detection fix so the next break-glass session does not page anyone at HIGH.`,
};
