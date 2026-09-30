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
