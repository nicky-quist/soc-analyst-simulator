// Fast triage alert pool

export const DISPOSITIONS = [
  { value: 'close', label: 'Close', hint: 'benign, expected, or a false positive' },
  { value: 'tier2', label: 'Tier 2', hint: 'real or unclear, needs a deeper look' },
  { value: 'ir', label: 'Page IR', hint: 'confirmed-bad, act tonight' },
];

const A = (id, o) => ({ id, trap: null, ...o });

export const FAST_ALERTS = [
  // ── Close ──
  A('ft-01', {
    disposition: 'close', trap: 'overstated', theme: 'authorized scanning', severity: 'HIGH',
    source: 'IDS', rule: 'ET SCAN Nmap SYN scan detected',
    facts: [['Source', '10.20.4.15 (SEC-SCAN-01, internal)'], ['Targets', '10.30.0.0/24, 254 hosts, 1,024 ports'], ['Change calendar', 'CHG-4471 monthly PCI scan, today 02:00-06:00'], ['Time', '02:14']],
    tell: 'Source is the vulnerability scanner and the scan sits inside an approved change window.',
  }),
  A('ft-02', {
    disposition: 'close', theme: 'password typo', severity: 'LOW',
    source: 'Windows Security', rule: '5 failed logons for one account',
    facts: [['Account', 'kchen (Finance)'], ['Failures', '5 over 90 seconds, then success'], ['Source host', 'FIN-LT-0412 (her assigned laptop)'], ['Lockout', 'none; MFA prompt approved once']],
    tell: 'One user, her own laptop, failures end in a normal success. That is a typo, not a spray.',
  }),
  A('ft-03', {
    disposition: 'close', trap: 'overstated', theme: 'VPN egress', severity: 'HIGH',
    source: 'Identity', rule: 'Impossible travel',
    facts: [['User', 'p.dubois'], ['Logins', 'Wilmington 09:02, Frankfurt 09:19'], ['Frankfurt IP', 'bank EU VPN egress (named in network inventory)'], ['Change calendar', 'EU VPN failover today, CHG-4502']],
    tell: 'The "foreign" address is the bank\'s own VPN egress, and a failover is on the calendar.',
  }),
  A('ft-04', {
    disposition: 'close', theme: 'AV test file', severity: 'MEDIUM',
    source: 'EDR', rule: 'Malware detected: EICAR-Test-File',
    facts: [['Host', 'QA-WKS-07'], ['User', 'qa-team'], ['Action', 'quarantined by EDR'], ['Ticket', 'QA-2210: verify new EDR policy']],
    tell: 'EICAR is the standard harmless antivirus test string, and a ticket asked for the test.',
  }),
  A('ft-05', {
    disposition: 'close', theme: 'expected admin change', severity: 'MEDIUM',
    source: 'Active Directory', rule: 'Member added to Domain Admins',
    facts: [['Added by', 'svc-iam-approved (PAM workflow)'], ['Member', 'a.torres (new Tier-3 hire)'], ['Approval', 'CHG-4490, approved by IT Ops manager'], ['Time', '10:31 weekday']],
    tell: 'Done through the privileged-access workflow with an approved change and a named requester.',
  }),
  A('ft-06', {
    disposition: 'close', theme: 'noisy policy alert', severity: 'LOW',
    source: 'Proxy', rule: 'Access to newly registered domain',
    facts: [['User', 'mgarcia (Marketing)'], ['Domain', 'canva-assets-cdn.com, first seen 6 days ago'], ['Category', 'Content delivery, reputation clean'], ['Payload', 'PNG images, no executables']],
    tell: 'Newly registered alone is weak. Clean category, image content and an ordinary user role.',
  }),
  A('ft-07', {
    disposition: 'close', theme: 'known-good software', severity: 'MEDIUM',
    source: 'EDR', rule: 'PowerShell executed with encoded command',
    facts: [['Host', 'SRV-MGMT-02'], ['Parent', 'ccmexec.exe (SCCM client)'], ['Decoded', 'Get-WmiObject inventory query'], ['Signer', 'Microsoft, matches management baseline']],
    tell: 'SCCM runs encoded PowerShell constantly. Decoded content is inventory and the parent is expected.',
  }),
  A('ft-08', {
    disposition: 'close', trap: 'overstated', theme: 'authorized testing', severity: 'HIGH',
    source: 'EDR', rule: 'Credential dumping behavior (LSASS access)',
    facts: [['Host', 'PENTEST-VM-02'], ['User', 'redteam-ext'], ['Engagement', 'RT-2026-Q3, scope includes this host, active today'], ['Contact', 'Red team lead confirmed in the tracker']],
    tell: 'The host is in the scope of a live, documented red-team engagement.',
  }),
  A('ft-09', {
    disposition: 'close', theme: 'stale alert', severity: 'LOW',
    source: 'Email gateway', rule: 'Suspicious attachment delivered',
    facts: [['Recipient', 'hr-inbox'], ['File', 'resume_jsmith.pdf'], ['Sandbox verdict', 'clean, detonated 09:41'], ['Post-delivery', 'gateway already rescored: benign']],
    tell: 'The sandbox detonated it clean and the gateway already withdrew its own suspicion.',
  }),
  A('ft-10', {
    disposition: 'close', theme: 'backup traffic', severity: 'MEDIUM',
    source: 'NetFlow', rule: 'Large outbound transfer',
    facts: [['Source', 'BKP-SRV-01'], ['Destination', 'the bank\'s contracted offsite backup vendor'], ['Volume', '412 GB, 01:00-03:40'], ['Baseline', 'same size every night for 90 days']],
    tell: 'Same destination, same size, same window every night. This is the backup job.',
  }),
  A('ft-11', {
    disposition: 'close', theme: 'blocked at the edge', severity: 'LOW',
    source: 'WAF', rule: 'SQL injection attempt',
    facts: [['Source', '45.83.x.x (public scanner range)'], ['Target', 'brochure site /search?q='], ['WAF action', 'blocked, 403'], ['Backend', 'no matching requests reached the app']],
    tell: 'Blocked at the WAF and nothing reached the application. Background internet noise.',
  }),
  A('ft-12', {
    disposition: 'close', theme: 'expected admin change', severity: 'MEDIUM',
    source: 'Cloud audit', rule: 'Security group opened to 0.0.0.0/0',
    facts: [['Resource', 'sg-web-public (port 443)'], ['By', 'terraform-deploy role'], ['Ticket', 'CHG-4498: new public web tier'], ['Port', '443 only, behind the load balancer']],
    tell: 'HTTPS on the public web tier, from the deploy pipeline, with a change ticket.',
  }),
  A('ft-13', {
    disposition: 'close', theme: 'password typo', severity: 'LOW',
    source: 'VPN', rule: 'Multiple failed VPN logins',
    facts: [['User', 'rnguyen'], ['Failures', '3, all from his home IP'], ['Then', 'success, same device certificate'], ['Geo', 'same city as his last 40 logins']],
    tell: 'Same person, same device, same place, followed by a normal login.',
  }),
  A('ft-14', {
    disposition: 'close', trap: 'overstated', theme: 'authorized scanning', severity: 'HIGH',
    source: 'Firewall', rule: 'Port sweep from external IP',
    facts: [['Source', '198.51.100.20'], ['Owner', 'the bank\'s external attack-surface vendor (contract on file)'], ['Schedule', 'weekly, this IP listed in the runbook'], ['Result', 'all denied at the edge']],
    tell: 'The IP belongs to a contracted vendor running a scheduled external scan.',
  }),
  A('ft-15', {
    disposition: 'close', theme: 'known-good software', severity: 'LOW',
    source: 'EDR', rule: 'Unsigned binary executed from user profile',
    facts: [['Host', 'DEV-LT-19'], ['User', 'developer'], ['File', 'node_modules/.bin build helper (hash in internal build cache)'], ['Network', 'no outbound connections']],
    tell: 'A developer\'s local build tool with a known hash and no network activity.',
  }),
  A('ft-16', {
    disposition: 'close', theme: 'stale alert', severity: 'MEDIUM',
    source: 'Vulnerability', rule: 'Critical CVE detected on host',
    facts: [['Host', 'PRT-04 (decommissioned print server)'], ['CMDB', 'retired 3 weeks ago, powered off'], ['Scanner', 'reading a stale cached result'], ['Network', 'no traffic seen from this host']],
    tell: 'The host is retired and powered off, so the finding is a stale record.',
  }),

  // ── Tier 2 ──
  A('ft-17', {
    disposition: 'tier2', trap: 'understated', theme: 'quiet persistence', severity: 'LOW',
    source: 'EDR', rule: 'New scheduled task created',
    facts: [['Host', 'FIN-WKSTN-31'], ['Task', '"OneDriveSync" runs every 5 min from %APPDATA%'], ['Binary', 'unsigned, first seen in the estate today'], ['Created by', 'user context, not IT deployment']],
    tell: 'A task named like a system component running an unsigned binary from a user folder is persistence until proven otherwise.',
  }),
  A('ft-18', {
    disposition: 'tier2', theme: 'possible credential spray', severity: 'MEDIUM',
    source: 'Identity', rule: 'Failed logons across many accounts',
    facts: [['Source IP', '203.0.113.60 (hosting provider)'], ['Accounts', '38 distinct users, 1-2 attempts each'], ['Result', '0 successes'], ['Window', '20 minutes']],
    tell: 'One attempt per account across dozens of users is spraying. Nothing succeeded yet, which is the time to check.',
  }),
  A('ft-19', {
    disposition: 'tier2', theme: 'unexpected admin action', severity: 'MEDIUM',
    source: 'Active Directory', rule: 'Member added to Domain Admins',
    facts: [['Added by', 'jpatel (Helpdesk)'], ['Member', 'jpatel (self)'], ['Approval', 'none found'], ['Time', '23:47 Saturday']],
    tell: 'A helpdesk account granted itself Domain Admin at midnight with no ticket.',
  }),
  A('ft-20', {
    disposition: 'tier2', trap: 'understated', theme: 'mailbox rule abuse', severity: 'LOW',
    source: 'M365 audit', rule: 'Inbox rule created',
    facts: [['User', 'k.osei (Treasury)'], ['Rule', 'move messages containing "wire" or "invoice" to RSS Subscriptions'], ['Source IP', 'not seen for this user before'], ['Mark as read', 'yes']],
    tell: 'A hidden-folder rule keyed on payment words, from a new IP, is classic business email compromise setup.',
  }),
  A('ft-21', {
    disposition: 'tier2', theme: 'suspicious download', severity: 'MEDIUM',
    source: 'Proxy', rule: 'Executable downloaded from uncategorized site',
    facts: [['User', 'ldavis (Operations)'], ['File', 'PDF_Viewer_Setup.exe, 3.1 MB'], ['Domain', 'registered 2 days ago, uncategorized'], ['Execution', 'EDR shows it has not run yet']],
    tell: 'Fake installer from a two-day-old domain. It has not run, so there is time to contain.',
  }),
  A('ft-22', {
    disposition: 'tier2', theme: 'unusual data access', severity: 'MEDIUM',
    source: 'DLP', rule: 'Bulk file access by user',
    facts: [['User', 'mrossi (Loans, resignation submitted last week)'], ['Files', '2,300 in the loan-docs share, 18:40-19:10'], ['Baseline', 'normally about 40 per day'], ['Copy to USB', 'not observed']],
    tell: 'A departing employee reading 50x their normal volume. Not yet exfiltration, but HR and Tier 2 need to look.',
  }),
  A('ft-23', {
    disposition: 'tier2', trap: 'understated', theme: 'cloud key misuse', severity: 'LOW',
    source: 'Cloud audit', rule: 'API call from new geography',
    facts: [['Identity', 'svc-etl-prod access key'], ['Source', 'IP in a country the bank has no operations in'], ['Calls', 'ListBuckets, GetBucketAcl'], ['Last rotated', '412 days ago']],
    tell: 'A machine key used from a new country to enumerate storage, with a year-old key, looks like a leaked credential.',
  }),
  A('ft-24', {
    disposition: 'tier2', theme: 'DNS anomaly', severity: 'MEDIUM',
    source: 'DNS', rule: 'High-entropy subdomain queries',
    facts: [['Host', 'MKT-WS-11 (signed marketing software)'], ['Queries', '9,400 TXT lookups to one domain'], ['Domain age', '3 days'], ['Reputation', 'no reports']],
    tell: 'Thousands of TXT lookups with random-looking labels look like data encoding. The signer is the only thing pointing the other way.',
  }),
  A('ft-25', {
    disposition: 'tier2', theme: 'endpoint block, wider exposure', severity: 'MEDIUM',
    source: 'EDR', rule: 'Credential dumper quarantined',
    facts: [['Host', 'ADM-LT-03 (domain admin laptop)'], ['Action', 'blocked and quarantined'], ['Same hash', 'ran unblocked on two servers 2 days ago'], ['Sensor', 'those servers have an outdated agent']],
    tell: 'The block worked here, but the same tool already ran elsewhere. Not an IR page yet, not a closure either.',
  }),
  A('ft-26', {
    disposition: 'tier2', theme: 'OAuth grant', severity: 'MEDIUM',
    source: 'M365 audit', rule: 'User consented to new application',
    facts: [['User', 'bhoward (AP clerk)'], ['App', '"PDF Sign Pro", unverified publisher'], ['Scopes', 'Mail.Read, offline_access'], ['Others', '1 more user consented 9 minutes later']],
    tell: 'Unverified app with mail-read and offline access, granted twice. It survives a password reset.',
  }),
  A('ft-27', {
    disposition: 'tier2', theme: 'phishing click', severity: 'MEDIUM',
    source: 'Email gateway', rule: 'User clicked link in reported phish',
    facts: [['User', 'tlee (HR)'], ['URL', 'sharepoint-docs.example-login.net'], ['Page', 'credential harvesting form (sandbox confirmed)'], ['Sign-in', 'no login attempt seen yet']],
    tell: 'A confirmed harvesting page was clicked. Nothing submitted yet, but the user must be checked and the sign-in watched.',
  }),
  A('ft-28', {
    disposition: 'tier2', theme: 'exposed service', severity: 'LOW',
    source: 'Attack surface', rule: 'New internet-exposed service',
    facts: [['Host', 'DEV-DB-02'], ['Service', 'PostgreSQL 5432 open to internet'], ['Since', '3 hours'], ['Owner', 'no change ticket found']],
    tell: 'A database with no ticket, open to the internet. Needs an owner and likely a fix, though nothing shows abuse yet.',
  }),

  // ── Page IR ──
  A('ft-29', {
    disposition: 'ir', trap: 'understated', theme: 'web shell', severity: 'MEDIUM',
    source: 'EDR', rule: 'Suspicious child process',
    facts: [['Host', 'WEB-IIS-03 (internet-facing)'], ['Parent', 'w3wp.exe (IIS worker)'], ['Child', 'cmd.exe /c whoami && net user'], ['Time', '03:12, no deployment window']],
    tell: 'The IIS worker running interactive commands means a web shell. This is remote code execution on a public server.',
  }),
  A('ft-30', {
    disposition: 'ir', theme: 'active ransomware', severity: 'CRITICAL',
    source: 'File integrity', rule: 'Mass file rename',
    facts: [['Host', 'FS-FIN-01'], ['Activity', '4,800 files renamed to *.lockbyte in 90 seconds'], ['Artifact', 'README_RECOVER.txt dropped in 38 folders'], ['Source', 'cached admin credentials from FIN-WKSTN-22']],
    tell: 'Mass encryption is happening right now. Every minute is more files lost.',
  }),
  A('ft-31', {
    disposition: 'ir', trap: 'understated', theme: 'successful brute force', severity: 'MEDIUM',
    source: 'Syslog', rule: 'Repeated SSH failures',
    facts: [['Host', 'DB-EXT-01'], ['Failures', '1,200 from one IP'], ['Then', '"Accepted password for root" from the same IP'], ['After login', '/etc/shadow read, tar of /var/lib/mysql']],
    tell: 'The success line after the failures and the follow-on commands make this a compromise in progress.',
  }),
  A('ft-32', {
    disposition: 'ir', theme: 'wire fraud in flight', severity: 'HIGH',
    source: 'Fraud + Identity', rule: 'Payment change after suspicious sign-in',
    facts: [['User', 'k.osei (Treasury)'], ['Sign-in', 'token replay from a new country, MFA not prompted'], ['Action', 'vendor bank details changed, $486,200 wire queued'], ['Wire status', 'pending release in 40 minutes']],
    tell: 'An attacker owns the session and a large wire is queued. It can still be stopped tonight.',
  }),
  A('ft-33', {
    disposition: 'ir', trap: 'understated', theme: 'beaconing', severity: 'MEDIUM',
    source: 'NetFlow', rule: 'Periodic outbound connections',
    facts: [['Host', 'FIN-WKSTN-22'], ['Pattern', '60-second interval, 24 hours, ~200 bytes each'], ['Destination', '198.51.100.77, on two threat feeds as C2'], ['Parent', 'PowerShell spawned by WINWORD.EXE at 08:55']],
    tell: 'A metronomic 60-second beacon to a listed C2 address, launched from a Word macro, is an active implant.',
  }),
  A('ft-34', {
    disposition: 'ir', theme: 'leaked key with data loss', severity: 'HIGH',
    source: 'Cloud audit', rule: 'Bulk object download',
    facts: [['Identity', 'svc-etl-prod key, found in a public repo 6 days ago'], ['Source', 'foreign IP, first seen today'], ['Volume', '12,900 customer-record objects downloaded'], ['Bucket', 'customer-exports']],
    tell: 'A key exposed publicly and used to download 12,900 customer records. The data has already left.',
  }),
  A('ft-35', {
    disposition: 'ir', theme: 'MFA fatigue success', severity: 'MEDIUM',
    source: 'Identity', rule: 'Repeated MFA denials',
    facts: [['User', 'r.abbas (Treasury)'], ['Pattern', '14 push denials from one IP, then 1 approval'], ['After', 'new authenticator registered, recovery email changed'], ['Password', 'correct on every attempt']],
    tell: 'The approval followed by a new authenticator and changed recovery email means the account was taken over.',
  }),
  A('ft-36', {
    disposition: 'ir', theme: 'domain compromise', severity: 'CRITICAL',
    source: 'Active Directory', rule: 'DCSync replication request',
    facts: [['Source', 'FIN-WKSTN-31 (not a domain controller)'], ['Account', 'svc-backup'], ['Privilege', 'Replicating Directory Changes All'], ['Approval', 'none; host is a finance workstation']],
    tell: 'A workstation asking a domain controller to replicate password data is DCSync: the whole domain\'s credentials are exposed.',
  }),
];

export const ALERT_BY_ID = Object.fromEntries(FAST_ALERTS.map((a) => [a.id, a]));
