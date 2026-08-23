// Phishing to token replay to attempted wire fraud, with the payment still stoppable.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'phishing-bec-ambiguous',
  order: 3,
  queueLabel: 'Email Security Alert — Suspicious Login After Reported Phishing Click',
  source: 'M365 Defender + User-Reported Phishing',
  alert: {
    ref: 'ALT-2026-0821-1408',
    rule: 'Anomalous sign-in following user-reported phishing',
    ruleId: 'SEC-ID-032',
    reportedSeverity: 'MEDIUM',
    detectedAt: '2026-08-21 14:08:30 UTC',
    slaMinutes: 15,
    entities: [
      { label: 'User', value: 'jmartinez@coastaltrustbank.com' },
      { label: 'Sign-in', value: 'succeeded, MFA satisfied by token' },
      { label: 'Source', value: 'external address (see event)' },
    ],
  },
  rawLog:
`User report 14:02 — jmartinez@coastaltrustbank.com reported a phishing email titled "Wire Transfer Approval Required — Action Needed Today".
User states: "I clicked the link before realizing it looked off, entered my email and password on the page, then closed it and reported the email."

M365 sign-in log:
14:07 — Successful sign-in for jmartinez@coastaltrustbank.com from 41.203.88.19 (Lagos, NG). MFA: satisfied via "Remember this device" token — no prompt shown.
Employee's normal sign-in locations (last 90 days): Wilmington, NC and Charlotte, NC only.`,
  datasets: [
    { index: 'signin', label: 'M365 / Entra ID sign-in logs', retention: '90d' },
    { index: 'email', label: 'Mailbox audit & message trace', retention: '90d' },
    { index: 'hr', label: 'HR directory — roles & authority', retention: 'current state' },
    { index: 'finance', label: 'Payment / AP transaction log', retention: '1y' },
  ],
  searches: [
    {
      id: 's3-signin-user',
      label: 'sign-in activity for jmartinez',
      match: { index: 'signin', terms: ['jmartinez'] },
      needsWindow: 60,
      columns: ['_time', 'result', 'ip', 'location', 'mfa'],
      events: [
        { _time: '08:12', result: 'success', ip: '73.42.19.6', location: 'Wilmington, NC', mfa: 'prompted, approved' },
        { _time: '13:58', result: 'success', ip: '73.42.19.6', location: 'Wilmington, NC', mfa: 'token' },
        { _time: '14:07', result: 'success', ip: '41.203.88.19', location: 'Lagos, NG', mfa: 'token replay — no prompt' },
        { _time: '14:07', result: 'success', ip: '41.203.88.19', location: 'Lagos, NG', mfa: 'token replay — no prompt' },
      ],
      note: 'Two concurrent sessions from 3,400 miles apart. The Lagos session satisfied MFA with a "remember this device" token rather than a prompt, which means the phishing page captured a session artifact, not just a password.',
    },
    {
      id: 's3-mailbox-rules',
      label: 'mailbox audit for jmartinez',
      match: { index: 'email', terms: ['jmartinez'] },
      needsWindow: 60,
      columns: ['_time', 'operation', 'detail'],
      events: [
        { _time: '14:07', operation: 'New-InboxRule', detail: 'Rule "Archive filter": messages containing wire, invoice, payment → move to Archive/Old, mark read' },
        { _time: '14:09', operation: 'Send', detail: 'To accounting@coastaltrustbank.com — "Updated Vendor Banking Details" requesting future payments route to a new account' },
        { _time: '14:09', operation: 'HardDelete', detail: 'Sent item removed from Sent Items folder' },
      ],
      note: 'The rule hides exactly the replies the fraud would generate, and the sent copy was deleted so the user would not see it. This is deliberate evasion, not opportunism.',
    },
    {
      id: 's3-hr-role',
      label: 'HR record for jmartinez',
      match: { index: 'hr', terms: ['jmartinez'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Role', value: 'Accounts Payable Specialist' },
        { field: 'Authority', value: 'May approve wire transfers under $10,000 without secondary approval' },
        { field: 'Admin roles', value: 'None' },
        { field: 'Manager', value: 'K. Boyd, Controller' },
      ],
      note: 'The compromised account can move money on its own up to $10k.',
    },
    {
      id: 's3-finance-payment',
      label: 'AP transaction status for the vendor banking change',
      match: { index: 'finance', terms: ['accounting'] },
      needsWindow: 60,
      columns: ['_time', 'status', 'vendor', 'amount', 'destination'],
      events: [
        { _time: '14:11', status: 'PENDING REVIEW', vendor: 'Harbor Point Facilities', amount: '$8,400.00', destination: 'new account ending 4471 — does not match vendor record on file' },
      ],
      note: 'Not yet processed. There is still a window to stop this payment — that window is the reason this alert is time-critical.',
    },
    {
      id: 's3-signin-ip',
      label: 'sign-in attempts from 41.203.88.19',
      match: { index: 'signin', terms: ['41.203.88.19'] },
      needsWindow: 240,
      columns: ['_time', 'account', 'result', 'mfa'],
      events: [
        { _time: '14:07', account: 'jmartinez', result: 'success', mfa: 'token replay — no prompt' },
        { _time: '14:12', account: 'bmoore', result: 'success', mfa: 'token replay — no prompt' },
        { _time: '14:13', account: 'kboyd', result: 'failure — password', mfa: 'n/a' },
        { _time: '14:14', account: 'apinvoices', result: 'failure — password', mfa: 'n/a' },
        { _time: '14:16', account: 'kboyd', result: 'failure — password', mfa: 'n/a' },
      ],
      note: 'jmartinez is not the only account. bmoore signed in successfully from the same address five minutes later, which means a second mailbox is compromised and the phishing run hit more than one person.',
    },
  ],
  intel: {
    '41.203.88.19': {
      verdict: 'suspicious',
      confidence: 'medium',
      summary: 'No prior sightings in this environment. Hosting range in Lagos, NG previously associated with BEC infrastructure in two vendor reports.',
      firstSeen: '2026-08-21 (first seen here)',
      sources: ['Vendor BEC report 2026-Q2', 'GeoIP: MTN Nigeria, Lagos'],
      tags: ['bec', 'impossible-travel', 'first-seen'],
    },
    'coastaltrustbank-secure.com': {
      verdict: 'malicious',
      confidence: 'high',
      summary: 'Look-alike credential harvesting domain registered 6 days ago. Hosts an Evilginx-style reverse proxy that relays the real login page and captures the session cookie — which is how MFA was bypassed here.',
      firstSeen: '2026-08-15',
      sources: ['urlscan.io', 'Registrar: privacy-protected, 6 days old', 'PhishTank (confirmed)'],
      tags: ['phishing', 'aitm', 'credential-harvesting'],
    },
  },
  actions: [
    {
      id: 'revoke-sessions',
      label: 'Revoke all active sessions and refresh tokens for jmartinez',
      verdict: 'required',
      result: 'All sessions revoked. The Lagos session is dead; a stolen cookie is now worthless.',
    },
    {
      id: 'reset-password',
      label: 'Force password reset and re-registration of MFA',
      verdict: 'required',
      result: 'Password reset queued and device tokens cleared; user must re-enroll MFA on next sign-in.',
    },
    {
      id: 'remove-rule',
      label: 'Remove the malicious inbox rule (preserving a copy for the case)',
      verdict: 'required',
      result: 'Rule exported to the case file and deleted from the mailbox.',
    },
    {
      id: 'notify-finance',
      label: 'Call Accounting to hold the pending vendor payment',
      verdict: 'required',
      result: 'Controller confirms the $8,400 payment is held and the vendor banking change is rejected pending out-of-band verification.',
    },
    {
      id: 'block-domain',
      label: 'Block the look-alike domain at the mail gateway and proxy',
      verdict: 'acceptable',
      result: 'Domain blocked; two other recipients of the same message identified and their links neutralized.',
    },
    {
      id: 'reply-to-vendor-email',
      label: 'Reply to the "Updated Vendor Banking Details" email asking the sender to confirm the account',
      verdict: 'harmful',
      result: 'Your reply goes to the attacker, who is sitting in the mailbox, and tells them the fraud has been noticed.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'You just emailed the attacker from inside the compromised mailbox. Now they know we are onto them, and if they had any other footholds they will burn them before we find them. Vendor banking changes get verified by phone, on a number from the contract — never by replying to the email.',
      },
    },
    {
      id: 'delete-mailbox',
      label: 'Purge the mailbox of all suspicious messages immediately',
      verdict: 'harmful',
      result: 'Messages purged — including the evidence of what the attacker sent and to whom.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'We needed that mailbox intact. This is a financial-fraud case that may end up with law enforcement and the insurer, and you just deleted the record of what was sent. Preserve first, remediate second.',
      },
    },
    {
      id: 'contain-second-account',
      label: 'Contain the second compromised account (bmoore) — revoke sessions and reset',
      verdict: 'acceptable',
      result: 'bmoore contained. Found only if you pivoted on the attacker address rather than stopping at the account named in the alert.',
    },
    {
      id: 'notify-fraud-team',
      label: 'Notify the bank\'s fraud team so the beneficiary account can be reported',
      verdict: 'acceptable',
      result: 'Fraud team engaged; the beneficiary account ending 4471 is flagged for reporting and the receiving institution can be contacted.',
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'CRITICAL',
    mitreTechnique: 'T1566',
    mitreTactic: 'Initial Access',
    escalation: 'escalate_ir',
    responseTargetMinutes: 10,
    requiredSearches: ['s3-signin-user', 's3-mailbox-rules', 's3-finance-payment'],
    requiredIntel: ['41.203.88.19'],
    requiredActions: ['revoke-sessions', 'reset-password', 'remove-rule', 'notify-finance'],
    requiredReportPoints: [
      {
        point: 'connects the credential entry, the impossible-travel login, the inbox rule, and the fraudulent wire email into one account-compromise narrative (not four separate small issues)',
        any: ['compromis*', 'account takeover', 'takeover', 'bec', 'business email', 'hijack*'],
      },
      {
        point: 'recognizes the inbox rule as evasion (hiding replies from the real vendor / from the victim noticing)',
        any: ['inbox rule', 'mailbox rule', 'mail rule', 'hid*', 'evasion', 'conceal*', 'cover their tracks', 'defense evasion'],
      },
      {
        point: 'recognizes this as attempted Business Email Compromise (BEC) / wire fraud, time-sensitive',
        any: ['wire fraud', 'bec', 'business email compromise', 'fraud*', 'payment redirect', 'vendor impersonation'],
      },
      {
        point: 'recommends immediate account containment: force password reset, revoke sessions/tokens, remove the malicious inbox rule',
        any: ['revoke*', 'reset*', 'remove the rule', 'delete the rule', 'session*', 'token*', 'sign out', 'sign-out', 'disable the account', 'lock the account'],
      },
      {
        point: 'recommends notifying Accounting/Finance immediately to block the fraudulent payment before it is processed',
        any: ['accounting', 'finance', 'notify', 'block the payment', 'stop the payment', 'hold the payment', 'accounts payable'],
      },
      {
        point: 'does not wait for a full report before triggering containment, given active financial risk',
        any: ['immediat*', 'urgent*', 'right away', 'now', 'asap', 'in parallel', 'without delay', 'time-sensitive', 'time sensitive'],
      },
    ],
  },
  walkthrough: [
    'This scenario hands you four separate-looking facts. The skill being tested is whether you connect them into one narrative instead of triaging each individually — and whether you do it fast, because money is moving.',
    'Start with `index=signin jmartinez`. Two concurrent sessions, Wilmington and Lagos, and the Lagos one satisfied MFA by token replay rather than a prompt. That means the phishing page took a session cookie, not just a password — an adversary-in-the-middle kit, which is why "we have MFA" did not save the account.',
    'Enrich 41.203.88.19 in the Intel tab. First-seen-here plus a BEC-associated range is enough corroboration; you are not going to get a clean signature on this kind of infrastructure.',
    'Search `index=email jmartinez`. The inbox rule hiding wire/invoice/payment mail is the easiest signal to miss and the most damning: someone is hiding the conversation from the account owner.',
    'Search `index=finance accounting` to find the pending payment. It has not been processed — that is the window you are racing, and it should shape your response order.',
    'Respond: revoke sessions first (the stolen cookie is the live weapon), then reset the password and MFA, remove the rule, and phone Accounting to hold the payment. Do not reply to the fraudulent email — the attacker is in that mailbox reading replies — and do not purge the mailbox, because this case may end up with the insurer or law enforcement.',
    'Classify True Positive / Critical, map to T1566, escalate to IR, and write the summary as one story: phished credentials → token replay → mailbox rule for evasion → attempted wire fraud.',
  ],
  debrief:
`This scenario is designed to test whether you connect scattered signals into one story instead of triaging each line item separately. Individually: a user reports clicking phishing (common, often low severity), a login from an unusual location (could be VPN/travel), a new inbox rule (easy to overlook), and an email about "updated banking details" (could look like normal business email if you don't correlate). Together, they describe a live Business Email Compromise: an adversary-in-the-middle phishing page took the session cookie so MFA never prompted, the attacker hid the relevant mail from the victim, and they're actively attempting wire fraud against a real vendor relationship. The critical judgment call is speed and order: revoke the session first — a password reset alone leaves a stolen cookie valid — then contain the mailbox and phone Accounting to stop the payment. Two of the available actions actively make things worse: replying to the fraudulent email talks directly to the attacker sitting in the mailbox, and purging the mailbox destroys evidence a fraud case will need.`,
};
