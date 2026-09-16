// Consent phishing: no password stolen, no malware, nothing for the endpoint
// tools to see. A user clicked "Accept" on a Microsoft-hosted consent screen
// and an application now holds a token to read their mail — which survives a
// password reset, because a password was never involved.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'oauth-consent-grant',
  difficulty: 3,
  queueLabel: 'Cloud App Alert — Consent granted to an unverified application, rpatterson',
  source: 'M365 Defender',
  alert: {
    ref: 'ALT-2026-0821-0577',
    rule: 'User consented to an application with high-privilege delegated permissions',
    ruleId: 'MDA-0208',
    reportedSeverity: 'MEDIUM',
    detectedAt: '2026-08-21 09:22:48 UTC',
    slaMinutes: 60,
    entities: [
      { label: 'User', value: 'rpatterson@coastaltrustbank.com' },
      { label: 'Application', value: 'Quarterly Statement Viewer (unverified publisher)' },
      { label: 'Scopes', value: 'Mail.Read, Files.Read.All, offline_access' },
      { label: 'App ID', value: 'a71f0c58-3e92-4a5d-9f31-6b2c8e77d410' },
    ],
  },
  rawLog:
`{"timestamp":"2026-08-21T09:22:48Z","alert":"User consented to an application with high-privilege delegated permissions","user":"rpatterson@coastaltrustbank.com","app":{"displayName":"Quarterly Statement Viewer","appId":"a71f0c58-3e92-4a5d-9f31-6b2c8e77d410","publisher":"unverified","created":"2026-08-19T17:02:11Z"},"scopes":["Mail.Read","Files.Read.All","offline_access"],"consentType":"user","reply_url":"https://statements-ctb.app/redirect"}`,
  datasets: [
    { index: 'audit', label: 'Entra ID audit log (directory changes)', retention: '1y' },
    { index: 'signin', label: 'Entra ID sign-in logs (incl. service principals)', retention: '30d' },
    { index: 'mail', label: 'Exchange message trace', retention: '90d' },
    { index: 'cloud', label: 'M365 / SharePoint file activity', retention: '90d' },
  ],
  searches: [
    {
      id: 's12-audit-consent',
      label: 'consent events for the application',
      match: { index: 'audit', terms: ['a71f0c58-3e92-4a5d-9f31-6b2c8e77d410'] },
      needsWindow: 1440,
      columns: ['_time', 'user', 'activity', 'detail'],
      events: [
        { _time: '09:22:48', user: 'rpatterson', activity: 'Consent to application', detail: 'Mail.Read, Files.Read.All, offline_access — delegated, user consent' },
        { _time: '09:22:49', user: 'rpatterson', activity: 'Add service principal', detail: 'app registered in tenant; publisher unverified; app object created 2026-08-19' },
        { _time: '09:31:15', user: 'mlowery', activity: 'Consent to application', detail: 'same application, same scopes' },
      ],
      note: 'Two users, not one. The second consent came nine minutes after the first, which tells you the lure is still sitting in mailboxes and being clicked.',
    },
    {
      id: 's12-audit-consent-name',
      satisfies: 's12-audit-consent',
      label: 'consent events for the application',
      match: { index: 'audit', terms: ['quarterly statement viewer'] },
      needsWindow: 1440,
      columns: ['_time', 'user', 'activity', 'detail'],
      events: [
        { _time: '09:22:48', user: 'rpatterson', activity: 'Consent to application', detail: 'Mail.Read, Files.Read.All, offline_access — delegated, user consent' },
        { _time: '09:22:49', user: 'rpatterson', activity: 'Add service principal', detail: 'app registered in tenant; publisher unverified; app object created 2026-08-19' },
        { _time: '09:31:15', user: 'mlowery', activity: 'Consent to application', detail: 'same application, same scopes' },
      ],
      note: 'Two users, not one. The second consent came nine minutes after the first, which tells you the lure is still sitting in mailboxes and being clicked.',
    },
    {
      id: 's12-mail-campaign',
      label: 'message trace for the phishing lure',
      match: { index: 'mail', terms: ['statements-ctb.app'] },
      needsWindow: 1440,
      columns: ['_time', 'sender', 'recipients', 'subject', 'disposition'],
      events: [
        { _time: '08:58:02', sender: 'statements@statements-ctb.app', recipients: '11 internal', subject: 'Q3 statement viewer — action required before 22 August', disposition: 'delivered (SPF pass on the sender’s own domain)' },
        { _time: '09:22–09:31', sender: '—', recipients: '2 of 11', subject: '—', disposition: 'clicked consent link' },
      ],
      note: 'Eleven mailboxes, two consents so far. The mail passed SPF because the attacker owns the sending domain — authentication proves who sent it, not whether they should be trusted.',
    },
    {
      id: 's12-sp-signin',
      label: 'sign-ins by the application service principal',
      match: { index: 'signin', terms: ['a71f0c58-3e92-4a5d-9f31-6b2c8e77d410'] },
      needsWindow: 1440,
      columns: ['_time', 'principal', 'ip', 'resource', 'result'],
      events: [
        { _time: '09:23:04', principal: 'Quarterly Statement Viewer', ip: '45.61.187.92', resource: 'Microsoft Graph', result: 'token issued (refresh token, offline_access)' },
        { _time: '09:31:31', principal: 'Quarterly Statement Viewer', ip: '45.61.187.92', resource: 'Microsoft Graph', result: 'token issued (refresh token, offline_access)' },
      ],
      note: 'Tokens issued to an address that is not the user’s and not ours. offline_access means the application can keep refreshing without the user ever signing in again.',
    },
    {
      id: 's12-cloud-access',
      label: 'mailbox and file access by the application',
      match: { index: 'cloud', terms: ['rpatterson'] },
      needsWindow: 1440,
      columns: ['_time', 'actor', 'action', 'detail'],
      events: [
        { _time: '09:24:10', actor: 'Quarterly Statement Viewer (app)', action: 'MailItemsAccessed', detail: 'folder Inbox — 38 items, sync started' },
        { _time: '09:26:55', actor: 'Quarterly Statement Viewer (app)', action: 'MailItemsAccessed', detail: 'search "wire", "invoice", "password" across mailbox' },
        { _time: '09:28:40', actor: 'Quarterly Statement Viewer (app)', action: 'FileAccessed', detail: 'Lending/Q3 rate sheets.xlsx' },
      ],
      note: 'The application is already reading mail and searching it for the words an attacker cares about. Access has happened; this is not a theoretical grant.',
    },
    {
      id: 's12-audit-user',
      label: 'other directory changes for rpatterson',
      match: { index: 'audit', terms: ['rpatterson'] },
      needsWindow: 1440,
      columns: ['_time', 'activity', 'detail'],
      events: [
        { _time: '09:22:48', activity: 'Consent to application', detail: 'Quarterly Statement Viewer' },
      ],
      note: 'No password change, no MFA registration, no inbox rule. The account itself was never compromised — which is exactly why a password reset would not take the access away.',
    },
  ],
  intel: {
    'statements-ctb.app': {
      verdict: 'malicious',
      summary: 'Domain registered 2026-08-19 and used to host an OAuth consent phishing flow impersonating a bank statement portal.',
      firstSeen: '2026-08-19',
      sources: ['Commercial threat feed', 'Financial sector ISAC advisory 2026-129'],
      context: 'Two days old, with valid TLS and a passing SPF record on its own domain. Registration age is the signal here, not mail authentication.',
    },
    '45.61.187.92': {
      verdict: 'suspicious',
      summary: 'Hosting provider address used by the same campaign to exercise issued Graph tokens.',
      firstSeen: '2026-08-20',
      sources: ['Commercial threat feed'],
      context: 'Not previously seen in this tenant, and not associated with any sanctioned integration.',
    },
  },
  actions: [
    {
      id: 'revoke-consent',
      label: 'Revoke the application’s consent and delete its service principal from the tenant',
      verdict: 'required',
      result: 'Consent revoked and the service principal removed at 09:47. The application can no longer request new tokens.',
    },
    {
      id: 'revoke-refresh-tokens',
      label: 'Revoke the refresh tokens issued to the application for both users',
      verdict: 'required',
      result: 'Refresh tokens invalidated. Without this the existing tokens keep working for their remaining lifetime even after the app is deleted.',
    },
    {
      id: 'hunt-other-consents',
      label: 'Hunt the other nine recipients for further consents and pull the lure from their mailboxes',
      verdict: 'required',
      result: 'Message purged from nine mailboxes; no further consents found. The campaign stops at two.',
    },
    {
      id: 'password-reset-only',
      label: 'Force a password reset for both users and close the alert',
      verdict: 'harmful',
      result: 'Passwords reset. The application’s refresh tokens are unaffected and it keeps reading both mailboxes; the alert is now closed and nobody is watching.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'concerned',
        message: 'No password was ever stolen here, so no password reset takes the access away. The grant and the refresh tokens are the access. We found out it was still reading mail four days later.',
      },
    },
    {
      id: 'disable-all-consent',
      label: 'Disable all user consent to third-party applications tenant-wide, immediately',
      verdict: 'harmful',
      result: 'User consent switched off across the tenant at 09:40, mid-morning, with no notice to application owners.',
      consequence: {
        from: 'Priya Raghavan',
        role: 'Head of IT Service Delivery',
        tone: 'concerned',
        message: 'Eleven integrations broke at once, including the loan origination connector, and nobody knew why. Restricting user consent is the right control and it is a change with an owner, a notice period and a rollback plan — not an incident response reflex.',
      },
    },
    {
      id: 'forward-lure',
      label: 'Forward the phishing email to all staff as a warning, with the link intact',
      verdict: 'harmful',
      result: 'The live consent link is delivered to 1,400 mailboxes, from an internal sender everyone trusts.',
      consequence: {
        from: 'Sarah Okafor',
        role: 'CISO',
        tone: 'concerned',
        message: 'We just re-sent the attacker’s working phishing link to the whole bank with our own credibility attached to it. Awareness mail goes out from Comms with the link defanged, after the grant is revoked.',
      },
    },
    {
      id: 'notify-users',
      label: 'Contact both users to confirm what they clicked and what they expected the app to do',
      verdict: 'acceptable',
      result: 'Both describe a statement portal they were told to authorise before a deadline. Useful for the awareness follow-up and for confirming neither authorised anything else.',
    },
  ],
  truth: {
    classification: 'true_positive',
    severity: 'HIGH',
    mitreTechnique: 'T1528',
    mitreTactic: 'Credential Access',
    escalation: 'escalate_tier2',
    responseTargetMinutes: 45,
    requiredSearches: ['s12-audit-consent', 's12-cloud-access', 's12-mail-campaign'],
    requiredIntel: ['statements-ctb.app'],
    requiredActions: ['revoke-consent', 'revoke-refresh-tokens', 'hunt-other-consents'],
    requiredReportPoints: [
      {
        point: 'identifies consent phishing — an OAuth grant to an attacker application, not a stolen password',
        any: ['consent', 'oauth', 'grant*', 'application', 'token', 'app registration', 'service principal'],
      },
      {
        point: 'states that the application already read mail and searched it, so access is actual rather than potential',
        any: ['mailitemsaccessed', 'read mail', 'accessed', 'searched', '38', 'sync', 'files.read', 'rate sheet*'],
      },
      {
        point: 'scopes the campaign — 11 recipients, 2 consents, the lure still in mailboxes',
        any: ['11', 'eleven', 'two users', '2 users', 'mlowery', 'campaign', 'other recipient*', 'nine'],
      },
      {
        point: 'calls for revoking the grant and the refresh tokens, not only removing the app',
        any: ['refresh token*', 'revoke', 'offline_access', 'token*', 'consent revok*'],
      },
      {
        point: 'does not present a password reset as the remediation',
        none: ['password reset will', 'reset the password and close', 'password reset resolves', 'just reset the password', 'only a password reset'],
      },
    ],
  },
  walkthrough: [
    'Notice what is missing before you look at what is there: no malware, no impossible travel, no failed sign-ins. The user did nothing wrong mechanically — they approved a Microsoft-hosted consent screen.',
    'Search the audit log for the application — by its app ID from the alert, or by `"Quarterly Statement Viewer"` in quotes. The grant, the scopes, and a second user consenting nine minutes later; the application object was created two days ago.',
    'Look up statements-ctb.app. Registered 19 August, known consent-phishing infrastructure, valid TLS and a passing SPF record on its own domain — mail authentication tells you who sent it, not whether to trust them.',
    '`index=mail statements-ctb.app` scopes the campaign at eleven recipients with two consents so far, and the lure is still sitting in nine mailboxes.',
    '`index=cloud rpatterson` is the line between theoretical and actual: the app has already synced the inbox and searched it for "wire", "invoice" and "password".',
    '`index=audit rpatterson` shows no password change, no MFA registration, no inbox rule — the account was never compromised, which is precisely why a password reset removes nothing.',
    'Revoke the consent and the service principal, revoke the refresh tokens for both users, and purge the lure from the other nine mailboxes. Then classify True Positive at HIGH, map to T1528, and route to Tier 2 to review what those mailboxes contained.',
  ],
  debrief:
`Consent phishing is the attack that breaks an analyst's mental model of account compromise. There is no password to reset, no session to revoke on the user, no endpoint to isolate — the access lives in a grant and a refresh token, and it survives every reflex that normally works. The tell that it is real rather than theoretical is in the audit trail: MailItemsAccessed, a search for "wire" and "invoice", a rate sheet opened.

Two things separate a good case here from an adequate one. First, scope: the message trace turns one alert into an eleven-recipient campaign with the lure still live, and the second consent nine minutes after the first proves the clock is running. Second, restraint: switching off user consent tenant-wide is genuinely the right long-term control and an appalling thing to do unannounced at half past nine, and forwarding the live lure as a "warning" hands the attacker the bank's own credibility. Fix the grant, scope the campaign, and file the control change as a change.`,
};
