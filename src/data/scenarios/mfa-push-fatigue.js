// The alert the tool under-rates. A MEDIUM "unusual MFA activity" that is in
// fact a live account takeover, and the giveaway is not in the sign-in log — it
// is in the audit log six minutes later, where the attacker registers their own
// authenticator so the password reset you are about to do will not lock them out.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'mfa-push-fatigue',
  difficulty: 2,
  queueLabel: 'Identity Alert — Repeated MFA prompts then approval, hstern@coastaltrustbank.com',
  source: 'Entra ID Protection',
  alert: {
    ref: 'ALT-2026-0821-0512',
    rule: 'Multiple failed MFA challenges followed by a successful approval',
    ruleId: 'IDP-MFA-0042',
    reportedSeverity: 'MEDIUM',
    detectedAt: '2026-08-21 07:41:55 UTC',
    slaMinutes: 30,
    entities: [
      { label: 'User', value: 'hstern@coastaltrustbank.com' },
      { label: 'Source IP', value: '91.219.238.20' },
      { label: 'Prompts', value: '14 denied, 1 approved, 11 minutes' },
    ],
  },
  rawLog:
`{"timestamp":"2026-08-21T07:41:55Z","alert":"Multiple failed MFA challenges followed by a successful approval","user":"hstern@coastaltrustbank.com","ip":"91.219.238.20","location":"Amsterdam, NL","client":"Other clients; IMAP4","mfa":{"challenges":15,"denied":14,"approved":1,"window_minutes":11},"risk":"medium","note":"Password authentication succeeded on every attempt; only the second factor was repeatedly challenged."}`,
  datasets: [
    { index: 'signin', label: 'Entra ID sign-in logs', retention: '30d' },
    { index: 'audit', label: 'Entra ID audit log (directory changes)', retention: '1y' },
    { index: 'cloud', label: 'M365 / SharePoint file activity', retention: '90d' },
    { index: 'ticket', label: 'Service desk tickets', retention: '2y' },
  ],
  searches: [
    {
      id: 's8-signin-user',
      label: 'sign-in history for hstern',
      match: { index: 'signin', terms: ['hstern'] },
      needsWindow: 240,
      columns: ['_time', 'ip', 'location', 'client', 'mfa', 'result'],
      events: [
        { _time: '06:55:08', ip: '68.114.22.9', location: 'Wilmington, NC', client: 'Outlook / managed device', mfa: 'satisfied by token', result: 'success — routine' },
        { _time: '07:30:12', ip: '91.219.238.20', location: 'Amsterdam, NL', client: 'Other clients; IMAP4', mfa: 'denied', result: 'failure — MFA denied' },
        { _time: '07:31:40', ip: '91.219.238.20', location: 'Amsterdam, NL', client: 'Other clients; IMAP4', mfa: 'denied', result: 'failure — MFA denied' },
        { _time: '07:34:03', ip: '91.219.238.20', location: 'Amsterdam, NL', client: 'Other clients; IMAP4', mfa: 'denied', result: 'failure — MFA denied' },
        { _time: '07:38:19', ip: '91.219.238.20', location: 'Amsterdam, NL', client: 'Other clients; IMAP4', mfa: 'denied', result: 'failure — MFA denied' },
        { _time: '07:41:22', ip: '91.219.238.20', location: 'Amsterdam, NL', client: 'Browser', mfa: 'approved', result: 'SUCCESS — session established' },
      ],
      note: 'The password was never the obstacle: it succeeded every time and only the push was denied, fourteen times across eleven minutes, until one was approved. That is someone who already has the password, waiting for the user to give up.',
    },
    {
      id: 's8-audit-mfa',
      label: 'directory changes for hstern',
      match: { index: 'audit', terms: ['hstern'] },
      needsWindow: 240,
      columns: ['_time', 'actor', 'activity', 'detail'],
      events: [
        { _time: '07:47:31', actor: 'hstern (session from 91.219.238.20)', activity: 'Security info registered', detail: 'Microsoft Authenticator — device "Pixel 7", not present in device inventory' },
        { _time: '07:48:06', actor: 'hstern (session from 91.219.238.20)', activity: 'Alternate email updated', detail: 'recovery address set to h.stern.mail@proton.me' },
        { _time: '07:52:44', actor: 'hstern (session from 91.219.238.20)', activity: 'Inbox rule created', detail: 'rule "..." moves mail matching "security alert", "verify", "sign-in" to RSS Feeds' },
      ],
      note: 'This is the search that decides your response. The attacker registered their own second factor and their own recovery address — a password reset alone hands the account straight back to them.',
    },
    {
      id: 's8-signin-ip',
      label: 'other accounts touched by 91.219.238.20',
      match: { index: 'signin', terms: ['91.219.238.20'] },
      needsWindow: 1440,
      columns: ['_time', 'user', 'attempts', 'result'],
      events: [
        { _time: '04:51–05:12', user: 'jmartinez', attempts: '14', result: 'all prompts denied' },
        { _time: '05:44–05:58', user: 'sgarcia', attempts: '11', result: 'all prompts denied' },
        { _time: '06:02–06:19', user: 'dkraft', attempts: '9', result: 'all prompts denied' },
        { _time: '07:30–07:41', user: 'hstern', attempts: '15', result: 'approved on the fifteenth' },
      ],
      note: 'One host working through four accounts overnight with a valid password for each. Those passwords came from somewhere, and that scope question belongs to whoever picks this up after you.',
    },
    {
      id: 's8-cloud-activity',
      label: 'file activity for hstern',
      match: { index: 'cloud', terms: ['hstern'] },
      needsWindow: 240,
      columns: ['_time', 'action', 'item', 'client_ip'],
      events: [
        { _time: '07:55:10', action: 'FileDownloaded', item: 'Treasury/Wire templates/ACH_batch_template.xlsx', client_ip: '91.219.238.20' },
        { _time: '07:56:02', action: 'FileDownloaded', item: 'Treasury/Counterparty contacts 2026.xlsx', client_ip: '91.219.238.20' },
        { _time: '07:58:47', action: 'FileSyncDownloadedFull', item: 'Treasury (folder, 61 items)', client_ip: '91.219.238.20' },
      ],
      note: 'Wire templates and counterparty contacts, pulled to the attacker address. This stopped being a sign-in anomaly the moment data moved, and what moved is the raw material for wire fraud.',
    },
    {
      id: 's8-ticket-user',
      label: 'service desk tickets for hstern',
      match: { index: 'ticket', terms: ['hstern'] },
      needsWindow: 1440,
      columns: ['_time', 'ticket', 'summary'],
      events: [
        { _time: '07:44', ticket: 'SD-88214', summary: 'Caller: "my phone kept buzzing with login approvals all morning, I pressed approve to make it stop — was that a problem?" Queued, unassigned.' },
      ],
      note: 'The user reported it three minutes after it happened and the ticket sat unread in a queue. Corroboration, and a control failure worth naming in the writeup — the process lost the report, not the user.',
    },
  ],
  intel: {
    '91.219.238.20': {
      verdict: 'malicious',
      summary: 'Bulletproof VPS host used in MFA-fatigue and adversary-in-the-middle campaigns against financial institutions since May 2026.',
      firstSeen: '2026-05-02',
      sources: ['Internal blocklist', 'Financial sector ISAC advisory 2026-118', 'Open-source reporting'],
      context: 'The advisory describes this exact sequence: valid credentials from an earlier infostealer dump, repeated push prompts until one is approved, then immediate registration of an attacker-controlled authenticator.',
    },
  },
  actions: [
    {
      id: 'revoke-sessions',
      label: 'Revoke all active sessions and refresh tokens for hstern, and force a password reset',
      verdict: 'required',
      result: 'Sessions revoked at 07:59; the attacker browser session dies at its next token refresh. Reset pending helpdesk-verified contact with the user.',
    },
    {
      id: 'remove-attacker-mfa',
      label: 'Remove the attacker-registered authenticator and the alternate recovery address',
      verdict: 'required',
      result: 'The "Pixel 7" authenticator and the proton.me recovery address are deleted. The account can no longer be recovered by the attacker.',
    },
    {
      id: 'remove-inbox-rule',
      label: 'Delete the inbox rule hiding security mail from the user',
      verdict: 'required',
      result: 'Rule removed. The user can see notifications about their own account again.',
    },
    {
      id: 'reset-password-only',
      label: 'Reset the password, close the alert, and move on',
      verdict: 'harmful',
      result: 'Password reset. The attacker completes a self-service reset using the authenticator they registered at 07:47 and is back in the account inside the hour.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'A password reset on an account where the attacker owns a registered second factor is not remediation — it is a password change they can undo. The audit log was one search away and it told you exactly which factor to pull.',
      },
    },
    {
      id: 'wipe-laptop',
      label: 'Remote-wipe the user’s laptop through endpoint management',
      verdict: 'harmful',
      result: 'FIN-LT-08 wiped. The compromise was cloud-side from an Amsterdam VPS; the laptop held the only local copy of two wire reconciliation workbooks.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'Nothing in this alert touched the endpoint. You destroyed a user’s working data to remediate a compromise that happened in the tenant. Containment goes where the attacker actually is.',
      },
    },
    {
      id: 'tenant-wide-reset',
      label: 'Force an immediate password reset for all 1,400 staff accounts',
      verdict: 'harmful',
      result: 'Tenant-wide reset triggered at 08:10, mid-morning, across every branch.',
      consequence: {
        from: 'Priya Raghavan',
        role: 'Head of IT Service Delivery',
        tone: 'concerned',
        message: 'Every teller in every branch was locked out during the busiest hour of the day and we took 600 calls. Four accounts were targeted and one was compromised. Scope the response to the evidence you have.',
      },
    },
    {
      id: 'call-user',
      label: 'Call the user on the number in the HR directory to confirm they did not initiate the prompts',
      verdict: 'acceptable',
      result: 'The user confirms they approved a prompt they did not initiate, at about 07:41, "to make the buzzing stop". Out-of-band confirmation is the only kind worth having here.',
    },
    {
      id: 'page-ir',
      label: 'Page the on-call Incident Response engineer',
      verdict: 'acceptable',
      result: 'IR engaged at 08:01 and takes the scope question across the other three targeted accounts.',
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'CRITICAL',
    mitreTechnique: 'T1621',
    mitreTactic: 'Credential Access',
    escalation: 'escalate_ir',
    responseTargetMinutes: 20,
    requiredSearches: ['s8-signin-user', 's8-audit-mfa', 's8-cloud-activity'],
    requiredIntel: ['91.219.238.20'],
    requiredActions: ['revoke-sessions', 'remove-attacker-mfa', 'remove-inbox-rule'],
    requiredReportPoints: [
      {
        point: 'identifies this as a successful account takeover rather than a user MFA mistake',
        any: ['account takeover', 'compromis*', 'takeover', 'unauthorized access', 'attacker gained', 'successful'],
      },
      {
        point: 'names the MFA fatigue pattern — a valid password with repeated prompts until one was approved',
        any: ['mfa fatigue', 'push bomb*', 'push fatigue', 'prompt bomb*', 'fourteen', 'repeated prompt*', 'repeated push*', 'repeatedly', 'until one'],
      },
      {
        point: 'calls out the attacker-registered authenticator and recovery address as persistence that has to be removed',
        any: ['authenticator', 'security info', 'registered', 'second factor', 'recovery address', 'alternate email', 'persistence'],
      },
      {
        point: 'records that Treasury wire template and counterparty data was downloaded to the attacker address',
        any: ['treasury', 'wire template*', 'counterparty', 'download*', 'ach', 'exfil*'],
      },
      {
        point: 'does not treat a password reset on its own as sufficient remediation',
        none: ['password reset is enough', 'just reset', 'only reset', 'simply reset', 'reset and close', 'reset resolves'],
      },
    ],
  },
  walkthrough: [
    'Read what the tool actually said: the password succeeded every time and only the second factor was challenged. That rules out brute force and tells you the credential is already stolen.',
    'Search `index=signin hstern` over four hours. Fourteen denials from one Amsterdam address in eleven minutes, then one approval. A user denying a prompt fourteen times is a user who knows it is not them.',
    'Look 91.219.238.20 up in the Intel tab. Known bulletproof VPS, with a sector advisory that describes this playbook including what the attacker does next.',
    'Check the thing the advisory tells you to check: `index=audit hstern`. Six minutes after the approval the attacker registered their own authenticator, set their own recovery address, and created an inbox rule to hide security mail. This finding shapes the whole response.',
    '`index=cloud hstern` shows Treasury wire templates and counterparty contacts downloaded to the attacker address. The case is now data loss with a plausible fraud motive.',
    'Respond in order: revoke sessions and tokens, remove the attacker-registered factor and recovery address, delete the inbox rule. Resetting the password without pulling that factor gives the account back.',
    'Classify True Positive at CRITICAL — the tool said MEDIUM and the tool was wrong — map to T1621, and escalate to IR, who own the question of how valid passwords for four accounts leaked in the first place.',
  ],
  debrief:
`The instructive part of this one is the gap between the alert's severity and the case's severity. The detection fired on a sign-in pattern and rated it MEDIUM; everything that made it critical — the registered authenticator, the recovery address, the inbox rule, the Treasury downloads — lives in logs the detection never looked at. That is the daily reality of L1 work: the alert is a pointer, not a verdict.

Response order matters as much as the verdict here. Revoking sessions without removing the attacker's registered second factor leaves a self-service route back in, and resetting the password first and stopping there is the most common way an account takeover gets "remediated" twice in one day. The service desk ticket is worth a line in the report too: the user reported it correctly within three minutes and the process lost it.`,
};
