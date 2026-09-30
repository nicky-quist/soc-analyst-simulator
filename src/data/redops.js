// Red Ops: the same incident, played from the attacker's side, as a chain of
// choices — never freeform code or a real payload, the same discipline the
// Respond tab already holds to. Only scenarios with a rich enough real
// narrative get one; this isn't a generator, it's a second lens on content
// that already exists.
//
// Each stage's `tactic` is a label from estate.js's TACTIC_COVERAGE, so the
// debrief can say "Coastal Trust Bank catches this tactic N% of the time"
// using the real number the Dashboard already shows — engine/redops.js reads
// it live rather than this file duplicating it.
//
// `canonical: true` marks the choice that matches what actually happened in
// that scenario's real story (its rawLog/searches/walkthrough) — the debrief
// points it out either way, because "what really happened" is itself a
// finding, not just a spoiler.

export const RED_OPS = {
  'malicious-powershell-precursor': {
    crew: 'Blacktide',
    objective: 'Land on a finance workstation, establish persistence, and stage for a wider push — without FIN-WKSTN-22\'s EDR sensor raising the alarm before you\'re ready to move.',
    stages: [
      {
        id: 'initial-access',
        label: 'Initial access',
        tactic: 'Initial Access',
        prompt: 'How do you get the macro document opened?',
        choices: [
          { id: 'mass-blast', label: 'Blast the invoice lure to 50 random employees', stealth: 20, note: 'Volume is its own signature — a mail gateway anomaly rule doesn\'t need to know the payload is bad to flag this.' },
          { id: 'targeted-finance', label: 'Targeted lure to one Finance mailbox (khughes)', stealth: 55, canonical: true, note: 'One recipient, plausible pretext ("Invoice past due"), a department that opens invoices all day. Quiet enough to work.' },
          { id: 'spear-ciso', label: 'Spear-phish the CISO with a fake board memo', stealth: 35, note: 'Higher-value target, but the people security trains hardest to be suspicious are usually the ones with SECURITY in their title.' },
        ],
      },
      {
        id: 'execution',
        label: 'Execution',
        tactic: 'Execution',
        prompt: 'How does the second stage actually run?',
        choices: [
          { id: 'dropped-exe', label: 'Drop a compiled .exe to disk and run it', stealth: 15, note: 'A new binary on disk is exactly what an EDR file-write rule exists to catch.' },
          { id: 'encoded-ps', label: 'Encoded PowerShell, in-memory, over plain HTTP', stealth: 30, canonical: true, note: 'Never touches disk — but "Office app spawned PowerShell with an encoded command" is a well-worn behavioral rule, and this is the tactic Coastal Trust Bank catches most often of all.' },
          { id: 'lolbin', label: 'Use a signed living-off-the-land binary instead of PowerShell', stealth: 60, note: 'Swapping the interpreter dodges the specific rule that catches WINWORD.EXE spawning powershell.exe — the parent-child relationship is still there for anyone who checks it directly, but far fewer rules do.' },
        ],
        handsOn: {
          prompt: 'Type the launch command the way it would appear in EDR process telemetry.',
          hint: 'PowerShell, in-memory, with an encoded command. The payload itself is a placeholder — <encoded_blob>.',
          expect: ['powershell', '-enc'],
          sample: 'powershell.exe -nop -w hidden -enc <encoded_blob>',
          output: [
            'proc  WINWORD.EXE (pid 4820) -> powershell.exe (pid 5102)',
            'cmd   powershell.exe -nop -w hidden -enc <encoded_blob>',
            'net   HTTP GET http://<c2_host>/a  (cleartext, port 80)',
            'file  no artifact written to disk',
          ],
          soc: 'The parent-child pair (Office app spawns PowerShell) plus the -enc flag is a single, well-worn behavioral rule. This is the tactic Coastal Trust Bank catches most often — the in-memory trick buys you nothing against it.',
          miss: 'That launches something, but not the encoded-PowerShell chain this stage is about. Look at the hint again.',
        },
      },
      {
        id: 'persistence',
        label: 'Persistence',
        tactic: 'Persistence',
        prompt: 'How do you survive a reboot?',
        choices: [
          { id: 'registry-run', label: 'Registry Run key', stealth: 35, note: 'The single most signatured persistence mechanism that exists. Every EDR vendor ships a rule for it.' },
          { id: 'sched-task', label: 'Scheduled task disguised as "WindowsUpdateCheck"', stealth: 45, canonical: true, note: 'A plausible name buys a little cover, but scheduled-task creation itself is still logged and watched.' },
          { id: 'no-persist', label: 'Skip persistence — smash and grab before anyone notices', stealth: 70, note: 'The quietest option by far, because there\'s nothing left behind to find later. The cost is that if you get interrupted mid-operation, there\'s no way back in.' },
        ],
        handsOn: {
          prompt: 'Type the command that registers the scheduled task, disguised as a Windows update check.',
          hint: 'schtasks, creating a task named "WindowsUpdateCheck". The thing it runs is a placeholder — <payload_path>.',
          expect: ['schtasks', '/create'],
          sample: 'schtasks /create /sc onlogon /tn "WindowsUpdateCheck" /tr <payload_path>',
          output: [
            'evt   4698 Scheduled task created  tn="WindowsUpdateCheck"',
            'user  CORP\\khughes  host=FIN-WKSTN-22',
            'trig  onlogon  ->  <payload_path>',
          ],
          soc: 'The plausible name buys a little cover in a list, but Event ID 4698 (task created) fires regardless of what the task is called, and this host has no business gaining a new logon task. It is logged and watched.',
          miss: 'That is not the scheduled-task registration this stage is about. Check the hint.',
        },
      },
      {
        id: 'discovery',
        label: 'Discovery',
        tactic: 'Discovery',
        prompt: 'How do you map the network before moving further?',
        choices: [
          { id: 'full-enum', label: 'Full domain enumeration — net view, nltest, Get-ADComputer, Domain Admins group', stealth: 25, canonical: true, note: 'Thorough, and it\'s exactly this trail — six distinct recon commands in ninety seconds — that gives the SOC everything they need to see the whole chain at once.' },
          { id: 'passive-only', label: 'Passive recon only — cached files and browser history, no AD queries', stealth: 65, note: 'Nothing hits the directory service at all. You learn less, but you leave almost nothing for EDR process telemetry to flag.' },
          { id: 'single-query', label: 'One targeted LDAP query for a specific high-value group', stealth: 50, note: 'A middle path — one query is far quieter than six, but it\'s still a domain query from a finance workstation that has no business making one.' },
        ],
        handsOn: {
          prompt: 'Type one of the domain-recon commands the full enumeration would run.',
          hint: 'The classic sweep is net view, nltest, Get-ADComputer. Any one of them counts here.',
          expect: ['net', 'view'],
          sample: 'net view /domain',
          output: [
            'proc  powershell.exe (pid 5102) -> net.exe',
            'cmd   net view /domain',
            'out   \\\\DC01   \\\\FIN-FS-01   \\\\HR-APP-02   ... (14 hosts)',
            'note  5 more recon commands followed within 90s',
          ],
          soc: 'One recon command is quiet. The real trail here is six of them in ninety seconds from a finance workstation — and it is exactly that burst the SOC pivots on to see the whole chain at once.',
          miss: 'That is not one of the domain-recon commands this stage is about. Re-read the hint.',
        },
      },
    ],
  },

  'phishing-bec-ambiguous': {
    crew: 'Coastal-Secure crew (AiTM-for-hire)',
    objective: 'Get into a mailbox with wire-approval authority, get past MFA without tripping a prompt, and redirect one real vendor payment before anyone notices.',
    stages: [
      {
        id: 'initial-access',
        label: 'Initial access',
        tactic: 'Initial Access',
        prompt: 'Who gets the "Wire Transfer Approval Required" lure?',
        choices: [
          { id: 'blast-ap', label: 'Blast it to the whole Accounting distribution list', stealth: 20, note: 'A dozen people reporting the same phishing email inside an hour is its own detection.' },
          { id: 'targeted-ap', label: 'One targeted lure to an AP specialist with approval authority (jmartinez)', stealth: 55, canonical: true, note: 'A single, plausible target with real wire authority. Quiet, and it worked well enough that a second account (bmoore) got caught in the same run later.' },
          { id: 'spear-controller', label: 'Spear-phish the Controller directly', stealth: 40, note: 'Higher approval ceiling, but the Controller\'s inbox is exactly the one Finance leadership pays closest attention to.' },
        ],
      },
      {
        id: 'credential-access',
        label: 'Credential access',
        tactic: 'Credential Access',
        prompt: 'How do you get past MFA?',
        choices: [
          { id: 'password-spray', label: 'Password-spray the whole domain', stealth: 15, note: 'Volume-based lockout and anomaly detection exists specifically for this.' },
          { id: 'plain-harvest', label: 'A plain credential-harvesting page (password only)', stealth: 30, note: 'You get the password. You still hit an MFA prompt the real user never approved — dead end, or a very loud one if you push it.' },
          { id: 'aitm-proxy', label: 'Adversary-in-the-middle reverse proxy that relays the real login and steals the session cookie', stealth: 60, canonical: true, note: 'The victim logs into the real page through your proxy, satisfies their own MFA, and you walk away with a live session token — no prompt for you to fail.' },
        ],
      },
      {
        id: 'defense-evasion',
        label: 'Defense evasion',
        tactic: 'Defense Evasion',
        prompt: 'How do you stop the victim from noticing?',
        choices: [
          { id: 'no-cover', label: 'Don\'t bother hiding anything — move fast instead', stealth: 30, note: 'Speed has real value, but an unhidden trail is the first thing a curious victim finds when they next open Sent Items.' },
          { id: 'bcc-forward', label: 'Silent forwarding rule, BCC everything to an external address', stealth: 45, note: 'Works, but auto-forward-to-external is a specifically well-monitored pattern in most mail security tooling.' },
          { id: 'archive-rule', label: 'Inbox rule silently archiving wire/invoice/payment replies, delete the Sent copy', stealth: 65, canonical: true, note: 'Defense Evasion is the tactic Coastal Trust Bank catches least often of the eleven tracked — and hiding only the relevant mail, rather than everything, draws less attention to the rule itself.' },
        ],
        handsOn: {
          prompt: 'Type the command that creates the hidden inbox rule from the stolen session.',
          hint: 'A New-InboxRule that moves wire/invoice/payment mail to Archive and deletes it.',
          expect: ['new-inboxrule'],
          sample: 'New-InboxRule -Name "Updates" -SubjectContainsWords "wire,invoice,payment" -MoveToFolder Archive -DeleteMessage $true',
          output: [
            'audit  New-InboxRule  mailbox=jmartinez@bank.example',
            'rule   name="Updates"  move->Archive  delete=true',
            'src    session from AiTM proxy IP, not the user\'s usual location',
          ],
          soc: 'Defense Evasion is the least-caught tactic here, but rule creation still writes a mailbox audit event. The tell is the geo mismatch: the rule was made from a session that never matched the user\'s normal sign-in location.',
          miss: 'That is not the inbox-rule creation this stage is about. Re-read the hint.',
        },
      },
      {
        id: 'impact',
        label: 'Impact',
        tactic: 'Impact',
        prompt: 'How big is the ask?',
        choices: [
          { id: 'big-wire', label: 'Request a large six-figure wire immediately', stealth: 15, note: 'Dollar thresholds exist precisely to force secondary approval on requests this size.' },
          { id: 'single-vendor', label: 'One real vendor banking-details change, mid five figures', stealth: 35, canonical: true, note: 'Small enough to stay under jmartinez\'s own approval ceiling, real enough vendor relationship to look plausible — and still caught, because the destination account didn\'t match the vendor record on file.' },
          { id: 'slow-drip', label: 'Several small sub-threshold payments spread over days', stealth: 55, note: 'The hardest pattern to correlate, and the slowest to cash out — every day it sits unprocessed is a day it can still be caught.' },
        ],
      },
    ],
  },

  'aws-key-leak': {
    crew: 'Opportunistic key-scraper (no named affiliation — this one is automated)',
    objective: 'Turn a credential that leaked onto the public internet into as much of the customer data bucket as you can reach before it gets rotated.',
    stages: [
      {
        id: 'initial-access',
        label: 'Initial access',
        tactic: 'Initial Access',
        prompt: 'How do you find the leaked key?',
        choices: [
          { id: 'auto-scrape', label: 'Scrape public GitHub commits in real time, test every candidate key within 90 seconds', stealth: 55, canonical: true, note: 'Fully automated and opportunistic — this bank was never targeted, its key just surfaced in the scrape. That\'s also why nobody was watching for it specifically.' },
          { id: 'manual-search', label: 'Manually search GitHub for the bank\'s name plus AWS key patterns', stealth: 45, note: 'Targeted, but slower — and a live human browsing session leaves more of a trail on your end than an automated scraper does.' },
          { id: 'buy-leaked', label: 'Buy the already-scraped key from a credential marketplace', stealth: 60, note: 'Zero scraping footprint of your own, at the cost of depending on someone else\'s timing — the key might already be dead by the time you get it.' },
        ],
      },
      {
        id: 'discovery',
        label: 'Discovery',
        tactic: 'Discovery',
        prompt: 'How do you orient inside the account?',
        choices: [
          { id: 'full-iam-enum', label: 'Enumerate every IAM policy on every principal in the account', stealth: 20, note: 'A huge CloudTrail footprint for a key that only needed to reach one bucket.' },
          { id: 'caller-list', label: 'GetCallerIdentity, then ListBuckets to see what\'s reachable', stealth: 50, canonical: true, note: 'The minimum orientation needed — two API calls, both logged, but proportionate to what you\'re actually about to do.' },
          { id: 'guess-buckets', label: 'Skip recon, guess at common bucket names directly', stealth: 65, note: 'No ListBuckets call logged at all — quieter, but you might never find the bucket that matters.' },
        ],
        handsOn: {
          prompt: 'Type the first orientation call you would make with the leaked key.',
          hint: 'Who am I? The AWS CLI call that answers that is get-caller-identity.',
          expect: ['get-caller-identity'],
          sample: 'aws sts get-caller-identity',
          output: [
            'event  sts:GetCallerIdentity  (CloudTrail)',
            'arn    arn:aws:iam::****:user/svc-export',
            'srcip  <hosting_provider_ip>  (never seen for this key before)',
          ],
          soc: 'One benign-looking call, but it is logged in CloudTrail with a source IP that has no history for this credential — the first thread an investigator pulls after the key is reported leaked.',
          miss: 'That is not the identity call this stage is about. Check the hint.',
        },
      },
      {
        id: 'privilege-escalation',
        label: 'Privilege escalation',
        tactic: 'Privilege Escalation',
        prompt: 'Do you try to turn this into a permanent foothold?',
        choices: [
          { id: 'create-admin', label: 'CreateUser + AttachUserPolicy(AdministratorAccess) to mint a persistent admin identity', stealth: 30, canonical: true, note: 'The payoff would have been huge — but this account had never used its iam:CreateUser grant before, and creating a brand-new admin identity is about as loud as cloud activity gets.' },
          { id: 'no-privesc', label: 'Don\'t attempt privilege escalation — work only inside the key\'s existing read access', stealth: 75, note: 'By far the quietest path. The tradeoff is a hard ceiling: whatever this key can already read is all you\'ll ever get.' },
          { id: 'attach-existing', label: 'Try attaching a policy to an existing role instead of creating a new identity', stealth: 45, note: 'Quieter than minting a new admin user, but modifying an existing role\'s permissions is still a change nobody expects to see.' },
        ],
        handsOn: {
          prompt: 'Type the call that would mint a persistent admin identity.',
          hint: 'The IAM call that creates a new user is create-user.',
          expect: ['iam', 'create-user'],
          sample: 'aws iam create-user --user-name svc-backup',
          output: [
            'event  iam:CreateUser  user-name=svc-backup  (CloudTrail)',
            'note   iam:CreateUser has NEVER been called on this account before',
            'next   AttachUserPolicy(AdministratorAccess) would follow',
          ],
          soc: 'The payoff is huge and so is the noise: a first-ever CreateUser on the account, from a key that only ever read a bucket, is about as loud as cloud activity gets. This is why the run was caught.',
          miss: 'That is not the identity-creation call this stage is about. Re-read the hint.',
        },
      },
      {
        id: 'exfiltration',
        label: 'Exfiltration',
        tactic: 'Exfiltration',
        prompt: 'How much do you take, and how?',
        choices: [
          { id: 'whole-bucket', label: 'Exfiltrate the entire bucket — all 12,904 objects', stealth: 15, note: 'A volume anomaly this size is close to unmissable, whatever else you got right.' },
          { id: 'targeted-exports', label: 'Pull the two most recent quarterly export files directly', stealth: 45, canonical: true, note: 'Targeted and proportionate — 79MB across two files, not a bucket-wide sweep — though GetObject is still logged per-call in CloudTrail either way.' },
          { id: 'batch-replicate', label: 'Set up S3 Batch Replication to a bucket you control, instead of pulling objects directly', stealth: 55, note: 'Fewer individual GetObject lines in the log for the same data — a less common technique, and less commonly hunted for as a result.' },
        ],
        handsOn: {
          prompt: 'Type the command that pulls one of the quarterly export files.',
          hint: 'An s3api get-object for a single key under the exports prefix.',
          expect: ['get-object'],
          sample: 'aws s3api get-object --bucket <bucket> --key exports/2024-Q4.csv 2024-Q4.csv',
          output: [
            'event  s3:GetObject  key=exports/2024-Q4.csv  bytes=41M  (CloudTrail data event)',
            'event  s3:GetObject  key=exports/2024-Q3.csv  bytes=38M',
            'total  2 objects, 79MB  (not a bucket-wide sweep)',
          ],
          soc: 'Targeted beats a full sweep, but S3 data events still log every GetObject by key. Two large reads of customer export files by this key is exactly the pattern a data-event alert is written for.',
          miss: 'That is not the object-read call this stage is about. Check the hint.',
        },
      },
    ],
  },

  'vendor-rmm-compromise': {
    crew: 'Ghostwire (supply-chain intrusion set)',
    objective: 'Use a technician login stolen in the vendor\'s own breach to reach the bank\'s loan-servicing data, looking like routine vendor administration for as long as you can.',
    stages: [
      {
        id: 'initial-access',
        label: 'Initial access',
        tactic: 'Initial Access',
        prompt: 'How do you get into the bank?',
        choices: [
          { id: 'phish-bank-staff', label: 'Phish the bank\'s own staff directly', stealth: 25, note: 'The bank\'s mail controls and trained staff are the best-defended door it has. Going through it means fighting the strongest part of the estate.' },
          { id: 'stolen-msp-creds', label: 'Use technician credentials stolen in the vendor\'s own breach', stealth: 60, canonical: true, note: 'The session arrives through a tool the bank trusts, under a vendor account it approved. Nearly every check it has is designed to wave this through.' },
          { id: 'exploit-rmm', label: 'Exploit an unpatched flaw in the remote-management console itself', stealth: 35, note: 'A working exploit against an internet-facing console is noisy, and the vendor may be patching it right now.' },
        ],
      },
      {
        id: 'discovery',
        label: 'Discovery',
        tactic: 'Discovery',
        prompt: 'How do you learn what the bank looks like from inside?',
        choices: [
          { id: 'full-enum', label: 'Enumerate the domain and its admin groups from a jump server', stealth: 25, canonical: true, note: 'Thorough, and a vendor technician has no reason to ask who the Domain Admins are. It is the first thing here that does not look like patching.' },
          { id: 'inventory-only', label: 'Read only the remote-management inventory, the same asset list the vendor sees every day', stealth: 65, note: 'You learn the host list without running a single command on any of them. The data comes from the tool\'s own screens, so nothing new is logged.' },
          { id: 'port-scan', label: 'Scan the server subnets', stealth: 15, note: 'Network scanning from a management host is one of the most heavily monitored behaviors there is.' },
        ],
        handsOn: {
          prompt: 'Type a command that asks who the domain admins are from the jump server.',
          hint: 'net group, targeting the "Domain Admins" group against the domain.',
          expect: ['net', 'group'],
          sample: 'net group "Domain Admins" /domain',
          output: [
            'proc   jump-svr  ->  net.exe  (vendor technician account)',
            'cmd    net group "Domain Admins" /domain',
            'out    Administrator  svc-backup  jdoe-adm  ... (7 members)',
          ],
          soc: 'A vendor technician has every reason to run patch and health commands and no reason to ask who the Domain Admins are. This is the first action in the session that does not look like maintenance.',
          miss: 'That is not the domain-group query this stage is about. Re-read the hint.',
        },
      },
      {
        id: 'persistence',
        label: 'Persistence',
        tactic: 'Persistence',
        prompt: 'How do you keep access after this session ends?',
        choices: [
          { id: 'fake-monitor-task', label: 'A scheduled task named to look like the vendor\'s own health check', stealth: 40, canonical: true, note: 'A believable name buys a little cover, but a new SYSTEM task appearing overnight on an application server is still something people look for.' },
          { id: 'reuse-rmm-agent', label: 'Create nothing: keep using the vendor\'s existing management agent as the way in', stealth: 70, note: 'Nothing new on any host, and the agent is already trusted and allow-listed. The catch is that access ends the moment someone suspends the account.' },
          { id: 'local-admin', label: 'Create a new local administrator account', stealth: 20, note: 'A new admin account is among the most reliably flagged changes on any Windows host.' },
        ],
        handsOn: {
          prompt: 'Type the command that registers the task disguised as the vendor health check.',
          hint: 'schtasks creating a SYSTEM task named to look like the vendor\'s own check.',
          expect: ['schtasks', '/create'],
          sample: 'schtasks /create /ru SYSTEM /sc daily /tn "VendorHealthCheck" /tr <payload_path>',
          output: [
            'evt   4698 Scheduled task created  tn="VendorHealthCheck"  ru=SYSTEM',
            'host  loan-app-02  (application server)',
            'when  created 02:14 local, outside the vendor\'s change window',
          ],
          soc: 'A believable name helps in a list, but a brand-new SYSTEM task appearing overnight on an application server, outside any approved change window, is exactly what task-creation monitoring surfaces.',
          miss: 'That is not the scheduled-task registration this stage is about. Check the hint.',
        },
      },
      {
        id: 'collection',
        label: 'Collection',
        tactic: 'Collection',
        prompt: 'What do you do with the loan-servicing share?',
        choices: [
          { id: 'browse-share', label: 'Open the loan-servicing share interactively and look around', stealth: 30, canonical: true, note: 'A walk of a sensitive share by an account with no business there is what file-access monitoring is built for, even when nothing is copied.' },
          { id: 'index-only', label: 'List file names and metadata only and take nothing', stealth: 60, note: 'You learn what is there and where, and leave a much smaller trail than any read. Whatever you take later can be targeted.' },
          { id: 'bulk-archive', label: 'Archive the whole share to stage it for removal', stealth: 15, note: 'A very large archive built on a file server is close to unmissable, and staging is exactly what analysts look for.' },
        ],
        handsOn: {
          prompt: 'Type the command that opens the loan-servicing share to look around.',
          hint: 'A directory listing of the UNC path to the share — dir \\\\server\\loan-servicing.',
          expect: ['dir', 'loan-servicing'],
          sample: 'dir \\\\FS01\\loan-servicing',
          output: [
            'evt   5145 A network share object was checked for access',
            'share \\\\FS01\\loan-servicing  by vendor technician account',
            'out   Q1-remittance\\  borrower-exports\\  ... (nothing copied yet)',
          ],
          soc: 'File-access auditing (Event ID 5145) records the walk itself, before a single file is copied. A sensitive share being browsed by an account with no business there is what that monitoring exists to catch.',
          miss: 'That is not the share-listing command this stage is about. Re-read the hint.',
        },
      },
    ],
  },

  'cloud-public-bucket': {
    crew: 'Bucket sweeper (opportunistic scanner, no named affiliation)',
    objective: 'Find a cloud storage bucket that someone made public by mistake, and take whatever it lets you read before the owner notices the exposure.',
    stages: [
      {
        id: 'initial-access',
        label: 'Initial access',
        tactic: 'Initial Access',
        prompt: 'How do you find an exposed bucket?',
        choices: [
          { id: 'brute-names', label: 'Hammer thousands of guessed bucket names from one address', stealth: 20, note: 'Every miss is an AccessDenied or NoSuchBucket line in someone\'s access logs, all from one source. It is the loudest way to look.' },
          { id: 'low-rate-sweep', label: 'Sweep many organizations\' likely bucket names at a low rate and list whichever answers', stealth: 45, canonical: true, note: 'This is what actually happened: one hosting-provider address listed the bucket. Slow enough to look like background noise, but the bank\'s own CSPM caught the exposure on its next three-hourly evaluation, whatever the sweep looked like.' },
          { id: 'public-index', label: 'Query a public index of exposed buckets that someone else already built', stealth: 70, note: 'You never touch the target until you already know it is open, so the first request it sees looks like an ordinary read. The catch is that everyone else with the same index is racing you to the same bucket.' },
        ],
      },
      {
        id: 'discovery',
        label: 'Discovery',
        tactic: 'Discovery',
        prompt: 'What do you learn about the bucket once you are in?',
        choices: [
          { id: 'probe-writes', label: 'Test whether you can write, delete or read the ACLs', stealth: 15, note: 'Write and permission calls are the ones that get alerts. Here they would also fail, because the policy only opens list and one read prefix.' },
          { id: 'list-all', label: 'Page through the full listing (14 pages of keys)', stealth: 40, canonical: true, note: 'One anonymous ListBucket, fully logged, and it hands you a customer ID in every object key. It is the most useful read-only call you can make.' },
          { id: 'guess-keys', label: 'Skip the listing and request keys you can guess from the naming pattern', stealth: 65, note: 'No list call ever shows up in the access log. You will miss whatever does not follow the pattern.' },
        ],
        handsOn: {
          prompt: 'Type the anonymous command that lists the exposed bucket.',
          hint: 'An s3 ls against the bucket, unauthenticated — the flag is --no-sign-request.',
          expect: ['s3', 'ls', 'no-sign-request'],
          sample: 'aws s3 ls --no-sign-request s3://<bucket>/',
          output: [
            'event  REST.GET.BUCKET (ListBucket)  requester=anonymous',
            'out    2019/  2020/  2021/  ... 14 pages of keys',
            'note   every object key carries a customer ID',
          ],
          soc: 'One anonymous ListBucket, fully logged in the access log, and it hands over a customer ID in every key. It is the most useful read-only call here — and the exposure the bank\'s CSPM flags on its next evaluation.',
          miss: 'That is not the anonymous listing command this stage is about. Check the hint.',
        },
      },
      {
        id: 'collection',
        label: 'Collection',
        tactic: 'Collection',
        prompt: 'What do you pull?',
        choices: [
          { id: 'crawl-2019', label: 'Download every object under the readable 2019 prefix (214 files)', stealth: 25, note: 'A burst of a couple of hundred GETs from one anonymous address is a volume pattern any S3 log alert is written for.' },
          { id: 'sample-three', label: 'Pull three statements from the 2019 prefix to see what they are', stealth: 50, canonical: true, note: 'Three GETs in ten seconds. Small enough to hide in the noise of the bucket\'s traffic, and enough to know whether the data is worth more effort.' },
          { id: 'head-only', label: 'Send HEAD requests only, to read sizes and dates without taking anything', stealth: 65, note: 'You learn what is readable without a single byte leaving. Nothing is copied that anyone could later say was stolen.' },
        ],
        handsOn: {
          prompt: 'Type the command that pulls one sample statement from the readable prefix.',
          hint: 'An anonymous s3 cp of a single 2019 key — again with --no-sign-request.',
          expect: ['s3', 'cp', 'no-sign-request'],
          sample: 'aws s3 cp --no-sign-request s3://<bucket>/2019/stmt_001.pdf .',
          output: [
            'event  REST.GET.OBJECT  key=2019/stmt_001.pdf  requester=anonymous',
            'out    3 objects pulled in 10s from the 2019 prefix',
            'note   small enough to sit inside the bucket\'s normal traffic',
          ],
          soc: 'Three GETs in ten seconds is quiet on its own — but each anonymous GetObject is still a line in the access log, and the sample confirms the data is real customer statements, which is what escalates the exposure.',
          miss: 'That is not the object-download command this stage is about. Re-read the hint.',
        },
      },
      {
        id: 'exfiltration',
        label: 'Exfiltration',
        tactic: 'Exfiltration',
        prompt: 'The 2019 prefix is readable. What do you do about the newer years?',
        choices: [
          { id: 'hammer-prefixes', label: 'Try every prefix and year, hundreds of guesses, until something opens', stealth: 15, note: 'A run of 403s from one anonymous address is a clear signal that someone is testing the edges of a policy.' },
          { id: 'try-newer-years', label: 'Try a couple of newer years directly, then stop when they refuse', stealth: 35, canonical: true, note: 'Two 403s in one minute. The refusals are logged and anyone reading the log sees exactly what you tried. The rest of the bucket stays private, so the exposure is three files, not 41,880.' },
          { id: 'stop-with-sample', label: 'Stop here with what you already have', stealth: 70, note: 'Nothing else is requested, so nothing else looks unusual. You leave with a small sample and no way back in once the policy is fixed.' },
        ],
      },
    ],
  },

  'ddos-origin-bypass': {
    crew: 'Stresser-for-hire customer (rented botnet, no named crew)',
    objective: 'Take a bank\'s mobile API offline by flooding it, and find the hostname its DDoS mitigation was never set up to cover.',
    stages: [
      {
        id: 'discovery',
        label: 'Discovery',
        tactic: 'Discovery',
        prompt: 'How do you find where the bank\'s servers actually live?',
        choices: [
          { id: 'scan-netblocks', label: 'Scan the bank\'s published address ranges for open web ports', stealth: 15, note: 'Port scanning against a bank\'s ranges is one of the most monitored behaviors on the internet, and you would get noise from every scrubbed address as well.' },
          { id: 'historical-dns', label: 'Look up old DNS records and certificate logs for hostnames that pre-date the CDN', stealth: 60, canonical: true, note: 'Entirely passive, and it works because api-legacy has had a record pointing straight at its origin for five years. The bank never sees the lookup.' },
          { id: 'trigger-errors', label: 'Send malformed requests to the mobile app\'s API to make an error page leak a server address', stealth: 45, note: 'Cheaper than scanning, but each malformed request is a logged event on a hostname the bank does watch.' },
        ],
        handsOn: {
          prompt: 'Type a passive lookup that could reveal an origin hostname behind the CDN.',
          hint: 'A DNS query for the legacy hostname — dig or nslookup for api-legacy.',
          expect: ['dig'],
          sample: 'dig api-legacy.bank.example +short',
          output: [
            'query  api-legacy.bank.example  A',
            'answer <origin_ip>  (not a CDN edge — points straight at the origin)',
            'note   this record has existed for ~5 years, pre-dating the CDN',
          ],
          soc: 'This is the one the bank never sees: an ordinary DNS lookup against a stale record made outside its own resolvers. It is why passive discovery scored highest here — there is nothing in the bank\'s logs to catch.',
          miss: 'That is not the passive DNS lookup this stage is about. Check the hint.',
        },
      },
      {
        id: 'defense-evasion',
        label: 'Defense evasion',
        tactic: 'Defense Evasion',
        prompt: 'Where does the traffic come from?',
        choices: [
          { id: 'few-hosting-ips', label: 'A few hundred servers in one hosting provider', stealth: 15, note: 'One network block sending this much is what an edge blocklist is made for, and it removes the attack in one rule.' },
          { id: 'wide-botnet', label: 'A rented botnet spread across residential addresses worldwide', stealth: 45, canonical: true, note: 'No source stands out in NetFlow. Blocking the top hundred, or a country, removes almost nothing and would catch real customers, so the defenders end up needing a structural fix.' },
          { id: 'rotate-proxies', label: 'Rotate through a large pool of proxies, changing sources every few minutes', stealth: 60, note: 'Anything that gets blocked is gone within minutes, and it costs you far more than the botnet does.' },
        ],
      },
      {
        id: 'impact',
        label: 'Impact',
        tactic: 'Impact',
        prompt: 'How hard do you hit the origin?',
        choices: [
          { id: 'full-burst', label: 'Everything at once, from the first minute', stealth: 20, note: 'A step change to a huge request rate is the signature every volumetric detection looks for.' },
          { id: 'cache-bust-flood', label: 'A sustained flood with a unique query string on every request, so nothing can be cached', stealth: 30, canonical: true, note: 'It reached 2.7 million requests a minute, and the bank\'s tooling engaged automatically within minutes. The catch was real, but the tool only covered the hostnames it knew about.' },
          { id: 'ramp-slowly', label: 'Ramp up over twenty minutes so it looks like a traffic surge', stealth: 55, note: 'Slower to hurt, but it stays under the anomaly baseline long enough for the origin to start failing before anything fires.' },
        ],
      },
      {
        id: 'persistence',
        label: 'Persistence',
        tactic: 'Persistence',
        prompt: 'The defenders move the record behind the CDN. What do you do?',
        choices: [
          { id: 'keep-flooding', label: 'Keep flooding the old address as if nothing changed', stealth: 15, note: 'Traffic to an address that now blocks everything but the provider\'s ranges is just noise the mitigation absorbs. It also makes your source list an easy blocklist.' },
          { id: 'watch-dns', label: 'Watch the record for a change and resolve it again the moment it moves', stealth: 55, canonical: true, note: 'Ordinary DNS lookups, which nobody watches. They tell you the moment the bypass is closed and the origin is no longer worth the rent.' },
          { id: 'walk-away', label: 'Stop and leave the botnet idle', stealth: 70, note: 'Nothing left running means nothing to find, and the rental clock stops.' },
        ],
      },
    ],
  },
};

export function redOpsFor(scenarioId) {
  return RED_OPS[scenarioId] || null;
}

export function hasRedOps(scenarioId) {
  return !!RED_OPS[scenarioId];
}
