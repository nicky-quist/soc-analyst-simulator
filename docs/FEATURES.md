# Features

A tour of everything in the console. For the short version, see the [README](../README.md).

## The nine tabs

The side rail is grouped the way an analyst uses it: the shift itself, practice, where you stand, and reference.

| Tab | What it's for |
|---|---|
| **Dashboard** | The shift at a glance: queue, SLA compliance, alert volume, the automation pipeline, ATT&CK coverage, and a live shift-handoff panel |
| **Alert queue** | Work the shift's seven cases: investigate, enrich, respond, write the report, get graded |
| **Alert triage** | Paste any alert or log line and get a first-pass read: format, severity, ATT&CK, indicators, next step |
| **Fast triage** | Twenty noise-heavy alert cards against a 12-minute clock: close, send to Tier 2, or page IR, with no feedback until the run ends |
| **Red Ops** | Run the attacker side of four scenarios as a live operation while the SOC reacts to each move, then defend the same incident and see who won |
| **Your progress** | Your record across shifts, your career rank, and what the next shift will practice |
| **Leaderboard** | Four separate boards, Blue Team, Red Team, Fast Triage and Secrets, ranking you against the fictional SEA SOC roster |
| **Security org** | The org chart as a Teams-style contact grid — who's online, their role, and a live presence status derived from real shift state |
| **Settings** | Configure the AI Coach (local Ollama or your own cloud key) without needing to close a case first |

Each tab has its own URL (`#dashboard`, `#queue`, `#triage`, `#fasttriage`, `#redops`, `#progress`, `#leaderboard`, `#team`, `#settings`), so a link can open straight onto one.

## The console (the Alert queue and Dashboard in depth)

**Shift dashboard** — the landing view, because a real console opens on posture rather than on a ticket. Six KPI tiles (open, closed, SLA breaches, average case score, MTTR, alerts today), 24-hour alert volume stacked by severity (AM/PM labeled), your queue's severity mix, an actionable open-alerts table you can click straight into, the day's detection sources with their auto-close rates, an SLA compliance trend, top entities by alert count, ATT&CK detection coverage by tactic, a live shift-handoff panel, and a live tail of estate activity. All of it is inline SVG — no charting dependency, no network calls.

**Your numbers, not the estate's.** SLA compliance is a running trend built purely from cases *you've* actually closed with a response-time target — no fictional calendar, no invented weekday. It starts at 100% because you haven't missed anything yet, moves the first time a real case gives it a data point, and every point after that is a case you closed, in the order you closed them. There is no day of the week attached to any point, so it can never disagree with itself.

The panel that matters most is the **alert pipeline**: 41.2M events → 1,284 alerts → 1,133 closed by automation → 151 routed to analysts → 7 in your queue. That funnel is the part of the job a quiz never shows you, and it is why "just look at every alert" is not a strategy.

**Alert queue** — seven alerts with status (New / In progress / Closed), the tool's reported severity, and a live SLA countdown that goes red when breached. Shift KPIs sit in the header too, so the numbers follow you out of the dashboard.

**A dealt hand, not a fixed list.** The library holds seventeen scenarios and a shift deals seven of them, seeded from when the shift started, so a second sitting is a different queue in a different order. The deal is not a straight random draw: every hand is guaranteed at least one alert that should be closed rather than escalated, at least one that has to reach IR tonight, at least two that belong with Tier 2, and a spread of difficulty — because a queue of seven true positives quietly teaches an analyst to escalate everything. Scenarios you were just dealt are also weighted down (not excluded) the next time around, so back-to-back shifts don't keep landing on the same handful of alerts the way an unweighted shuffle does in a library this size.

**The same case doesn't play the same twice.** Every scenario also re-rolls its cosmetic identifiers each shift — the attacker's IP, the compromised hostname, a service account name, a phishing domain — deterministically, so reloading mid-shift never changes them out from under you, but the ssh-brute-force case you solved last week has a different address and host this time. Only pure labels move; nothing the report rubric or the narrative actually reasons about (byte counts, record counts, a key's age) ever changes. **End shift** (the rail's rotate icon) deals the next hand — if anything is still open or escalated, it stops first for a review of exactly who that goes to (Tier 2, IR, or just the next shift) before dealing.

**Overview** — detection metadata (rule, rule ID, data source, entities) and the triggering event, exactly as much as a SIEM would give you. The reported severity is labeled "what the tool said — yours to confirm or overturn."

**Investigate** — a search bar, not a list of buttons. You type `index=auth 185.220.101.45` and get an event table back. The indicators have to come out of the evidence; the console never offers them. Results print with a note explaining what you're looking at, and the search history reads as an investigation log. There's also a decoder for base64 blobs — which is the only way to get the C2 address out of the PowerShell scenario.

**Intel** — paste an indicator, get a feed record: verdict, confidence, first-seen, sources, tags. Defanged input (`1[.]2[.]3[.]4`) is understood, because that's how indicators arrive in tickets.

**Respond** — the containment actions an L1 can really take, with no hint as to which are correct, ordered by a stable shuffle so the bad ones aren't always at the bottom. Two-click confirm, no undo, and every one is recorded in the case.

**Report** — classification, severity, an ATT&CK technique picked from a catalog of plausible candidates, a written summary and remediation, and the escalation decision.

**Case notes** — a running timeline of every search, lookup, action, and decode with elapsed times. It's the audit trail a Tier-2 handoff would be built from, and reading your own back is usually how you notice you spent eleven minutes searching before you contained anything.

**AI Coach** — an optional second, LLM-generated debrief on a closed case, alongside (never instead of) the deterministic CISO/CEO responses. Off by default. Local-first: it talks to your own Ollama instance so nothing leaves your machine, with a bring-your-own-key cloud fallback for anyone without a GPU to spare. Configure it from **Settings** or from the debrief screen itself.

**Career progression** — the title in the header is earned, not a fixed label. Promotion to Tier 1 Analyst requires ten *distinct* scenario types closed at 80%+ — not raw close-count, so re-closing the same easy case across shifts doesn't count. Senior Analyst requires the full library at 80%+, no current weak skill, no escalation lean, and a clean response-action rate. A rank, once earned, is a permanent checkpoint: clearing your history or resetting everything wipes the stats that drive it but never takes the rank back.

**Fast triage** — the volume half of the job. See [Fast triage](#fast-triage) below.

**Red Ops** — run the attacker side of four scenarios as a live operation (choices at the attack's real decision points, never freeform commands or payloads). The SOC reacts to every move as you make it:

- **Caught or slipped past, revealed immediately.** A move is caught when it is quieter than 60% of that tactic's real detection coverage (the same `TACTIC_COVERAGE` numbers the Dashboard shows). It's a comparison, not a dice roll, and a meter shows your stealth against the detection line.
- **The SOC's alertness compounds.** Each caught move raises it one step (Unaware, Alert queued, Analyst investigating), and every later move is 8 stealth points louder per step. The third catch burns the operation.
- **Go dark, once.** Lie low for a day to make the SOC lose a step, at a flat 5-point cost. It only helps once you've been noticed.
- **Abort and bank it.** Ending early scores what you played, scaled by how far you got, so finishing has to pay more than quitting.
- **A SOC console** beside the stage shows what the defenders would see after each move.

Then defend the same incident from the blue side and see a head-to-head comparison on the debrief screen.

**Red Ops career** — the attacker-side mirror of the analyst career, built on the same three rules. Breadth at a standard: a rank needs different operations cleared, using your best completed run of each, so replaying the easiest one gets you nowhere. Finishing counts: only a run that reaches the objective clears an operation, and a burned or aborted run is recorded but can't promote you. A rank is a checkpoint: **Reset everything** wipes the runs and never takes a rank back.

| Rank | Needs |
|---|---|
| Recruit | where everyone starts |
| Red Team Operator | reach the objective at 50+ on 2 different operations |
| Senior Operator — Team Lead ready | every operation cleared at 50+, at least one **ghost run** (objective reached with no move caught), and no more than 2 burned or aborted in your last 6 runs |

The Red Ops tab shows your rank, what the next promotion needs, your record (runs, completed, ghost, burned, aborted) and your best completed score per operation. The header shows both ranks, and a promotion is announced on the debrief the moment a run earns it.

**War Room** — an extra alert outside the dealt library, never dealt directly. If you close the ransomware-precursor case with a required containment step missing, or with a harmful action taken, the shift escalates mid-flight: a 5-minute CRITICAL alert for mass file encryption on the finance file server is injected into your live queue, correlated back to the case that caused it (same C2 address, same host). Only one War Room can be active per shift, and a War Room alert can't trigger another, so a bad night gets one escalation rather than a chain reaction. The trigger is deterministic — exactly "did the response leave the threat live" — with no dice roll.

**Shift handoff** — a Dashboard panel that's always current, not generated once at shift end: any case that's still open or was escalated shows up with its findings, evidence, and what's still needed. **End shift** turns this into an actual moment instead of a silent reset — if anything needs a handoff, it stops to show exactly who picks it up (Jordan Reyes for Tier 2, Marcus Bell for IR, or the next shift's analyst for anything nobody escalated) before dealing the next hand.

**Shift report card** — the page that says how the shift actually went. **End shift** (after the handoff review, if there is one) opens it, the **Preview shift report** button on the Dashboard shows it mid-shift without ending anything, and the last one stays reopenable from **Your progress**. It is a full-screen page rather than a tab, because it belongs to a moment and not to a place. It shows:

- the team lead's note (and it says so when part of the queue was never worked, instead of praising a mostly untouched shift), with closed, resolved, average score, time to decision, SLA and harmful actions;
- all seven cases: the tool's severity against yours (and the answer when you were off), where you sent it, the score, and whether you beat the clock;
- this shift's skills, each marked held, slipped or not tested, with your escalation lean and any harmful actions called out;
- what was handed off and to whom, what the next shift will practice, and your four leaderboard ranks.

**Print or save as PDF** uses a print layout that shows only the report, and **Copy summary** puts the same content on the clipboard as plain text. It grades nothing new: every number is one the case grader, the progress engine or the handoff builder already computed, gathered for one shift by a pure function (`engine/shiftReport.js`). Reset everything clears the saved report along with the rest of the record.

Dark by default, with a light toggle.

## Learn Mode

Every scenario has a **📖 Learn mode** walkthrough of how a senior analyst works that specific alert — which search to run and why, how to read the result, why the response order is isolate → preserve → remediate. Use it either way: study it first, or attempt the alert cold and check your reasoning afterward. Opening it before you submit tags that attempt **Assisted** in the shift record — not a penalty, just an honest label.

## Alert triage

The **Triage** tab is a first-pass reader for an alert that isn't in the shift queue. Paste a raw log line or alert, and it identifies the format, scores severity with a confidence percentage, maps the activity to ATT&CK, extracts indicators, estimates how likely it is to be a false positive, and recommends a next step. The result can be exported as a `.txt` report, and the tab keeps a history of the session's analyses.

It started as a separate project, `soc-triage-tool`, and was merged in with its commit history. It runs a deterministic rule engine in the browser ([`src/engine/triage`](src/engine/triage)). Nothing you paste leaves the tab, there's no API key, and every verdict traces back to a specific pattern match rather than a model's judgment.

| Format | What the rules look for |
|---|---|
| Syslog | SSH brute force (failure count, root/admin targeting, non-existent users), sudo/su elevation |
| Windows Event Log | Malicious PowerShell (download cradles, `-EncodedCommand`), failed logons (4625), lateral movement over admin shares, persistence via Run keys and scheduled tasks |
| Suricata JSON | Cobalt Strike and other C2/malware signatures, exploit attempts, scans, and the alert's own severity |
| Zeek `conn.log` | Long, high-volume flows (beaconing), connections to common C2 ports, large uploads (exfiltration) |
| CEF | Credential-dumping tools, exploit activity, and whether the device blocked it |
| DNS logs | Base64-looking subdomain labels, a high-entropy flag when the log includes one, high outbound byte counts |
| Free text | Lateral movement, malware delivery URLs, reconnaissance commands, file names and hashes |

Input that's too thin to triage (a bare URL, a lone base64 blob, a fragment with no technical detail) is rejected with an explanation rather than guessed at.

**A bug its tests found.** The first Zeek rule scraped the raw text instead of reading columns, so the Unix timestamp became the flow's duration and byte count. On the tool's own sample, a one-hour, 2.3 MB flow was reported as 473,688 hours and 1,626 MB. On other inputs it gave wrong verdicts: ordinary TLS traffic was called a C2 beacon, and a real connection to port 31337 was never flagged. The fix reads the `#fields` header, or the standard conn.log order when there isn't one. Six regression tests cover it, and all six fail against the original code.

## Fast triage

The seven-case shift trains depth: find the evidence, contain, write it up. **Fast triage** trains the volume side, where most alerts a human sees get about ninety seconds and the skill is reading the two lines that decide it.

A run deals 20 alert cards from a pool of 36 and gives you 12 minutes. Each card shows only what a SIEM row would (source, rule, reported severity, four fields) and nothing to search. You answer **Close**, **Tier 2**, or **Page IR** (keys `1`, `2`, `3`), and you get no feedback until the run ends. Then a review lists every alert, mistakes first, with the one detail that decided it.

- **Guaranteed mix.** Every run has 9 closes, 7 Tier 2 and 4 IR, so it can't turn into a queue of true positives. It also always includes at least two alerts that *read scary but are benign* (an authorized scanner, a VPN egress, a live red-team engagement) and two that *read routine but are real* (a hidden inbox rule, a web shell rated MEDIUM). Those are the two ways triage goes wrong.
- **Cost-weighted score, not a percent.** The costs aren't symmetric: closing an IR-worthy alert costs 3, sending a benign one to Tier 2 costs 0.5. The score is 100 minus the share of the worst possible cost. Alerts you never reached count as a backlog, not as correct.
- **Closing a live threat caps the grade at C**, whatever the rest of the run looked like, the same rule the main sim applies to a damaging response after a correct report.
- **Kept honest.** Runs are seeded, so the deal is reproducible from its seed and varies across seeds; only finished runs are saved (last 20, in local storage); refreshing mid-run abandons it; **Reset everything** on the Dashboard clears them along with the rest.

## Leaderboard

Four separate boards, each ranking you against the fictional SEA SOC roster (the people the console already puts in front of you, like the Team Lead, the IR Lead and the CISO). Their standings are fixed, so a board looks the same every time and you climb it by playing. It is you against the sim's own people: nothing is uploaded or shared.

| Board | Ranked by |
|---|---|
| **Blue Team** | career rank, then case types cleared at 80%+, then average best score |
| **Red Team** | Red Ops rank, then operations cleared, then ghost runs, then best completed score |
| **Fast Triage** | best Fast Triage score, then faster average pace per alert |
| **Secrets** | how many hidden secrets you have found |

**The roster reads the way the org chart does.** Standings follow what each person's job would give them. On the analyst-judgment boards (Blue and Fast Triage) the Tier 2 analyst who does this all day leads, then the team lead, the IR lead, detection and security engineering, then the CISO, then the IT and business roles. On Red Team, IR and detection engineering lead, because they know adversary behavior best. On Secrets, the engineers who poke at tools find the most. The CEO is last on every board, and tests pin all of these orders so the roster can't drift.

Ties share a rank (1, 2, 2, 4) and you are listed first among them. **Copy my standing** puts a short summary of all four ranks on the clipboard. Reset everything keeps ranks and found secrets and clears the record behind them, so the Blue and Red boards show the same rank with progress back at zero, and the Fast Triage board goes back to "no runs yet", since Fast Triage has no rank to keep. Every roster standing is beatable: a test builds a perfect player and checks they take first place on all four boards, and that a new player leads none of them. Roster standings also stay true as the library grows (a senior analyst has cleared every case type by definition).

## Secrets

There are twenty things hidden in the console. It never says how to find them; Settings lists the ones you have found and shows "???" for the rest, and one of them is a credits card. They are small in-voice rewards for doing what a curious person might try, spread across the investigation tools, the report, Fast triage, Red Ops, the theme toggle and the keyboard.

- **Never part of the game.** A secret is announced and nothing more. None reads into a grade, a rank, your history or the "assisted" flag, and none can be tripped by working a real case: a test runs every scenario's own searches and lookups through the matchers to prove it.
- **Reset everything leaves them alone**, like a rank. The only way to forget them is the button in Settings.
- **Matchers are pure** (`engine/easterEggs.js`), so each trigger is unit-tested, along with the Konami tracker, the burst counter that catches rapid clicking, and the storage.
