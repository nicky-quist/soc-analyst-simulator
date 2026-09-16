// A HIGH-severity impossible-travel alert that is an artifact of our own
// network. The detection is working exactly as designed and the conclusion it
// invites is wrong — and the cost of "just revoking sessions to be safe" is
// sixty-one branch staff locked out at ten in the morning.
//
// See ./index.js for the shape every scenario follows.

export default {
  id: 'impossible-travel-vpn',
  difficulty: 1,
  queueLabel: 'Identity Alert — Impossible travel, jbaptiste@coastaltrustbank.com',
  source: 'M365 Defender',
  alert: {
    ref: 'ALT-2026-0821-0388',
    rule: 'Impossible travel activity',
    ruleId: 'MDA-0071',
    reportedSeverity: 'HIGH',
    detectedAt: '2026-08-21 08:47:03 UTC',
    slaMinutes: 60,
    entities: [
      { label: 'User', value: 'jbaptiste@coastaltrustbank.com' },
      { label: 'From', value: 'Wilmington, NC (68.114.22.9) 08:05' },
      { label: 'To', value: 'Frankfurt, DE (194.36.108.17) 08:47' },
    ],
  },
  rawLog:
`{"timestamp":"2026-08-21T08:47:03Z","alert":"Impossible travel activity","user":"jbaptiste@coastaltrustbank.com","previous":{"ip":"68.114.22.9","city":"Wilmington","country":"US","time":"2026-08-21T08:05:44Z"},"current":{"ip":"194.36.108.17","city":"Frankfurt","country":"DE","time":"2026-08-21T08:47:03Z"},"implied_speed_kmh":10412,"device_id":"9f2c-AAD-4471","compliant":true,"mfa":"satisfied","risk":"high"}`,
  datasets: [
    { index: 'signin', label: 'Entra ID sign-in logs', retention: '30d' },
    { index: 'audit', label: 'Entra ID audit log (directory changes)', retention: '1y' },
    { index: 'asset', label: 'Asset inventory & network ranges', retention: 'current state' },
    { index: 'change', label: 'Change & maintenance calendar', retention: '1y' },
  ],
  searches: [
    {
      id: 's9-asset-egress',
      label: 'asset record for 194.36.108.17',
      match: { index: 'asset', terms: ['194.36.108.17'] },
      needsWindow: 0,
      columns: ['field', 'value'],
      events: [
        { field: 'Record', value: 'Corporate VPN egress — EU point of presence' },
        { field: 'Range', value: '194.36.108.0/26 (Coastal Trust Bank, leased from provider)' },
        { field: 'Owner', value: 'Network Engineering' },
        { field: 'Normal use', value: 'Failover target for the US-East concentrator' },
        { field: 'Named location', value: 'NOT registered in Entra ID named locations' },
      ],
      note: 'The "Frankfurt" address is our own VPN egress. The last line is the actual defect: the range was never added to named locations, so the identity platform reads our own infrastructure as a foreign country.',
    },
    {
      id: 's9-signin-user',
      label: 'sign-in history for jbaptiste',
      match: { index: 'signin', terms: ['jbaptiste'] },
      needsWindow: 240,
      columns: ['_time', 'ip', 'location', 'device_id', 'compliant', 'mfa', 'result'],
      events: [
        { _time: '08:05:44', ip: '68.114.22.9', location: 'Wilmington, NC', device_id: '9f2c-AAD-4471', compliant: 'yes', mfa: 'satisfied', result: 'success' },
        { _time: '08:47:03', ip: '194.36.108.17', location: 'Frankfurt, DE', device_id: '9f2c-AAD-4471', compliant: 'yes', mfa: 'satisfied', result: 'success' },
        { _time: '09:12:20', ip: '194.36.108.17', location: 'Frankfurt, DE', device_id: '9f2c-AAD-4471', compliant: 'yes', mfa: 'satisfied', result: 'success' },
      ],
      note: 'Same managed, compliant device ID on both sides of the "travel", MFA satisfied throughout. An attacker in Frankfurt would have to have stolen the laptop as well as the credential.',
    },
    {
      id: 's9-signin-egress',
      label: 'all sign-ins from 194.36.108.17',
      match: { index: 'signin', terms: ['194.36.108.17'] },
      needsWindow: 240,
      columns: ['_time', 'users', 'devices', 'result'],
      events: [
        { _time: '08:44–08:58', users: '61 distinct', devices: 'all managed and compliant', result: 'all successful, all MFA satisfied' },
        { _time: 'before 08:44', users: '0', devices: '—', result: 'no history — this egress was not in use until this morning' },
      ],
      note: 'Sixty-one users "travelled to Frankfurt" inside fourteen minutes. One compromised account is plausible; sixty-one simultaneous ones on managed devices is an infrastructure event, not an attack.',
    },
    {
      id: 's9-change-vpn',
      label: 'change calendar entries for the VPN concentrator',
      match: { index: 'change', terms: ['vpn'] },
      needsWindow: 0,
      columns: ['window', 'owner', 'activity', 'ticket'],
      events: [
        { window: 'Today 08:41 (emergency)', owner: 'Network Engineering', activity: 'US-East VPN concentrator hardware fault — regional traffic failed over to the EU point of presence', ticket: 'CHG-4482' },
      ],
      note: 'Raised at 08:41, six minutes before the alert. The failover is the whole explanation.',
    },
    {
      id: 's9-audit-user',
      label: 'directory changes for jbaptiste',
      match: { index: 'audit', terms: ['jbaptiste'] },
      needsWindow: 1440,
      columns: ['_time', 'activity', 'detail'],
      events: [],
      note: '0 matching records. No MFA methods registered, no recovery address changed, no inbox rules created, no consent granted. Proving the absence of follow-on activity is what lets you close this confidently rather than hopefully.',
    },
  ],
  intel: {
    '194.36.108.17': {
      verdict: 'benign',
      summary: 'Announced by the ASN of Coastal Trust Bank’s managed VPN provider; listed in the internal corporate egress register.',
      firstSeen: '2025-11-14',
      sources: ['Internal asset register', 'Provider allocation record'],
      context: 'Reputation feeds carry no adverse reporting. For infrastructure we lease, the authoritative answer is the asset register rather than a reputation score.',
    },
  },
  actions: [
    {
      id: 'close-false-positive',
      label: 'Close the alert as a false positive, citing the VPN failover under CHG-4482',
      verdict: 'required',
      result: 'Closed with disposition "false positive — corporate VPN egress failover, CHG-4482, device and MFA verified".',
    },
    {
      id: 'register-named-location',
      label: 'Raise a request to add the EU egress range to Entra ID named locations as trusted corporate egress',
      verdict: 'required',
      result: 'Request filed with Identity Engineering, referencing 61 alerts raised in fourteen minutes from one range that the platform has never been told about.',
    },
    {
      id: 'revoke-all-sessions',
      label: 'Revoke sessions for all 61 users seen from the Frankfurt address',
      verdict: 'harmful',
      result: 'Sixty-one staff — most of them branch and contact-centre — are signed out mid-morning and cannot sign back in until the VPN path stabilises.',
      consequence: {
        from: 'Priya Raghavan',
        role: 'Head of IT Service Delivery',
        tone: 'concerned',
        message: 'You logged out three branches during the morning rush over an alert caused by our own failover. The asset register would have told you whose address that was in thirty seconds.',
      },
    },
    {
      id: 'disable-account',
      label: 'Disable jbaptiste’s account pending investigation',
      verdict: 'harmful',
      result: 'Account disabled at 08:52. The user is a loan officer mid-way through a closing appointment with a customer in the branch.',
      consequence: {
        from: 'Sarah Okafor',
        role: 'CISO',
        tone: 'concerned',
        message: 'Disabling an account is a real cost to a real person and it has to be earned by evidence. Same device, compliant, MFA satisfied, sixty other users on the same address — none of that pointed at this user.',
      },
    },
    {
      id: 'block-egress-ip',
      label: 'Block 194.36.108.17 at the perimeter',
      verdict: 'harmful',
      result: 'Our own VPN egress is blocked, cutting remote access for everyone routed through the failover path.',
      consequence: {
        from: 'Tom Alvarez',
        role: 'Security Engineering Manager',
        tone: 'concerned',
        message: 'That address is ours. Blocking it took remote access down for the region while the primary concentrator was already broken. Identify infrastructure before you act on it.',
      },
    },
    {
      id: 'page-ir',
      label: 'Page the on-call Incident Response engineer',
      verdict: 'unnecessary',
      result: 'IR paged at 08:55, stood down at 09:03 once the change ticket was read to them.',
      consequence: {
        from: 'Marcus Bell',
        role: 'IR Lead',
        tone: 'neutral',
        message: 'No harm done. But the change calendar was open to you before you paged me, and pages like this are how a team gets slow at answering the ones that matter.',
      },
    },
    {
      id: 'confirm-with-network',
      label: 'Confirm the failover with the Network Engineering on-call before closing',
      verdict: 'acceptable',
      result: 'On-call confirms the US-East concentrator failed at 08:39 and regional traffic now egresses through Frankfurt. Thirty seconds, and the closure is defensible.',
    },
  ],
  truth: {
    classification: 'false_positive',
    severity: 'INFORMATIONAL',
    mitreTechnique: 'T1078',
    mitreTactic: 'Defense Evasion',
    escalation: 'close_false_positive',
    requiredSearches: ['s9-asset-egress', 's9-change-vpn'],
    requiredIntel: [],
    requiredActions: ['close-false-positive', 'register-named-location'],
    requiredReportPoints: [
      {
        point: 'identifies the Frankfurt address as the bank’s own VPN egress rather than an attacker location',
        any: ['vpn', 'egress', 'our own', 'corporate', 'asset register', 'infrastructure', 'point of presence', 'concentrator'],
      },
      {
        point: 'ties the alert to the emergency failover change (CHG-4482) that started six minutes earlier',
        any: ['chg-4482', 'failover', 'change', 'maintenance', 'outage', 'concentrator', 'emergency'],
      },
      {
        point: 'uses the corroborating evidence — same compliant device, MFA satisfied, 61 users on one address',
        any: ['device', 'compliant', 'mfa', '61', 'sixty-one', 'other users', 'same device', 'managed'],
      },
      {
        point: 'notes the absent follow-on activity — no MFA registration, inbox rule, or consent grant',
        any: ['no mfa', 'no inbox rule', 'no change*', 'no follow', 'no persistence', 'no directory', 'audit log', 'no further', 'nothing else'],
      },
      {
        point: 'does not recommend disabling the account, revoking the other users, or blocking our own egress',
        none: ['disable the account', 'revoke all', 'block the ip', 'block 194', 'lock the account', 'terminate access'],
      },
    ],
  },
  walkthrough: [
    'Start with the address the alert is frightened of. `index=asset 194.36.108.17` names it as our own EU VPN egress, leased by Network Engineering — and records that it was never added to Entra ID named locations, which is why the platform reads it as a foreign country.',
    'Confirm rather than assume: `index=change vpn` shows CHG-4482, an emergency failover raised at 08:41 after the US-East concentrator faulted. The alert fired at 08:47.',
    'Widen the lens: `index=signin 194.36.108.17` shows sixty-one distinct users from that address inside fourteen minutes, all on managed compliant devices. One compromised account is plausible; sixty-one at once is an infrastructure event.',
    'Prove the negative before you close. `index=audit jbaptiste` returns nothing — no registered MFA method, no recovery address change, no inbox rule, no consent grant. That is what separates "closed confidently" from "closed hopefully".',
    'Close it as a false positive and raise the named-location request, because the same failover will raise sixty-one more of these tomorrow if nobody tells the identity platform which addresses are ours.',
    'Classify False Positive at INFORMATIONAL and close with no escalation. Do not disable the account, revoke the other sixty users, or block our own egress — each of those costs real work and none of them is supported by the evidence.',
  ],
  debrief:
`Impossible travel is one of the highest-volume identity detections in any bank, and most of what it produces is this: a true statement about geography that is a false statement about risk. The skill being practised is disproving a plausible story quickly and defensibly — infrastructure ownership, the change record, the device and MFA context, and the absence of the follow-on actions a real intruder takes within minutes.

The cost model is the other half. The "safe" reflex — revoke everyone, disable the user — is only safe from the analyst's chair. Sixty-one signed-out staff during the morning rush, or a loan officer disabled mid-appointment, is a real incident caused by the response rather than the alert. Note also that this finding is worth more as a tuning request than as a closure: a named-location entry stops the next sixty-one.`,
};
