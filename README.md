# soc-triage-tool

A browser-based first-pass triage assistant for SOC alerts. Paste a raw log line or alert — syslog, Windows Event Log, Suricata JSON, Zeek/Bro, CEF, DNS query log, or plain English — and it identifies the format, scores severity, maps the activity to MITRE ATT&CK, pulls out IOCs, and recommends a next action.

**[Live demo →](https://nicky-quist.github.io/soc-triage-tool/)**

## Why

Most of the "paste your alert into a chatbot" tools ship the alert to a third-party API. This one doesn't — every analysis runs through a rule-based engine in the browser, so nothing leaves the tab and there's no key or backend to configure. It trades LLM-style flexibility for deterministic, explainable output: every verdict traces back to a specific pattern match, not a black box.

## What it does

- **Format detection** — recognizes Syslog, Windows Event Log (Sysmon/Security), Suricata/eve.log JSON, Zeek `conn.log`-style TSV, CEF, DNS query logs, and free-form narrative
- **Severity scoring** — Critical / High / Medium / Low / Informational, with a confidence percentage
- **MITRE ATT&CK mapping** — tactic + technique (e.g. `T1110.001 - Brute Force: Password Guessing`, `T1059.001 - PowerShell`)
- **IOC extraction** — IPs, usernames, hostnames, and command lines pulled straight out of the input
- **Recommended action** — a concrete next step (block an IP, isolate a host, rotate credentials), not just a label
- **False-positive likelihood** — flags low-signal alerts instead of crying wolf
- **Input validation** — rejects inputs that don't have enough context to triage (URL-only, base64-only, too short) and explains why, instead of guessing
- **History + export** — keeps a session log of prior analyses and exports any result as a `.txt` report

### Detection logic covers

| Format | Example patterns detected |
|---|---|
| Syslog | SSH brute force (root/admin targeting, failure count), sudo/su privilege escalation |
| Windows Event Log | Malicious PowerShell (download cradles, `-EncodedCommand`), failed logons (4625), lateral movement, persistence via Run keys / scheduled tasks |
| Suricata / eve.log | Signature severity, category, C2/malware alerts |
| Zeek `conn.log` | Long-duration, low-variance connections consistent with beaconing |
| CEF | Vendor threat/block actions (Palo Alto, ArcSight-style exports) |
| DNS logs | High-entropy subdomains, base64-looking queries, exfil indicators |

## Stack

React 19 + Vite, no backend, no API key, no dependencies beyond React itself. Deployed to GitHub Pages via GitHub Actions on every push to `main`, but only after lint, the test suite and the build all pass.

## Running locally

```bash
npm install
npm run dev
```

```bash
npm run build     # production build to dist/
npm run preview   # preview the production build
npm test          # 126 tests over the rule engine, no browser needed
```

## Project structure

```
src/
├── engine/
│   ├── format.js       # format detection, IP extraction, Zeek conn.log parser
│   ├── analyze.js      # the rule engine: format → severity, ATT&CK, IOCs, action
│   └── validation.js   # rejects input too thin to triage, and says why
├── SOCTriageTool.jsx   # UI only
└── main.jsx            # entry point
tests/
├── fixtures.js         # realistic samples for every supported format
├── format.test.js      # detection, extraction, Zeek column parsing
├── analyze.test.js     # verdicts per format, including severity ordering
├── validation.test.js  # the input-rejection rules
└── contract.test.js    # invariants that must hold for every input
```

The engine is plain JavaScript with no React or DOM dependency, so it runs under `node --test` directly.

## Testing

The pitch for this tool is that every verdict traces back to a specific pattern match. The test suite is what holds it to that. It has three layers:

- **Verdicts.** Each format's rules are checked against realistic samples: a download cradle in a PowerShell script block is CRITICAL, a single failed SSH login is LOW and flagged as a likely false positive, a port scan ranks below Cobalt Strike C2.
- **Ordering, not just labels.** Several tests assert *relative* severity rather than exact values. For example, root targeting must outrank an identical non-root burst, and severity must rise with failure count. That way a threshold can be retuned without the tests breaking, as long as the ranking stays sensible.
- **Contract.** For every fixture, the result has every field, severity and false-positive level come from the allowed sets, confidence stays within 0–100, IOCs are deduplicated, and no summary leaks `undefined` or `NaN`. The same input always gives the same verdict. The engine doesn't throw on hostile input (empty, 50 KB, null bytes, regex metacharacters, truncated CEF). It never calls `fetch`, which is the offline guarantee enforced as a test.

### A bug the tests found

The first version of the Zeek `conn.log` rule scraped the raw text instead of reading columns: the largest run of six-plus digits became the byte count, the first `digits.digits` became the duration, and a C2 port counted as present if its digits appeared *anywhere* in the line. In a Zeek log, the first thing matching all three is the Unix timestamp.

On the tool's own sample alert, a one-hour, 2.3 MB flow was reported as **"Long-duration connection (473688h) with high outbound data (1626MB)"**. That verdict happened to be correct, but only by accident. On other inputs the same bug gave wrong answers: an ordinary 0.4-second TLS flow was called a C2 beacon, a large short upload was called beaconing instead of exfiltration, and a real connection to port 31337 was never flagged because the misread timestamp tripped an earlier rule first.

The fix is a real column parser (`parseZeek`) that reads the `#fields` header, or falls back to the standard conn.log order when there isn't one, and turns Zeek's `-` markers into `null` instead of `NaN`. Six regression tests cover it. All six fail against the original code and pass against the fix, so none of them passes regardless of the bug.
