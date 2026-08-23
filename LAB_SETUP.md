# Phase 2: Live VM Lab Setup

The simulator app (`src/`) uses static scenario data — realistic, but scripted. This guide covers building the actual isolated lab environment that would let this project graduate to **live telemetry**: real attacks, run against real VMs, generating real logs that flow into a real SIEM, which the app could eventually pull from instead of canned data.

This is infrastructure on your own machine — nothing here can be automated from a chat session. Budget a weekend for the initial setup.

## 1. Hypervisor + network isolation (foundation — do this first)

**Tool: VirtualBox** (free, simplest for a home lab; VMware Workstation Player is an alternative).

1. Install VirtualBox.
2. Create an **internal network** (not "bridged," not "NAT with port forwarding") — in VirtualBox this is called an "Internal Network" or "Host-only Network." This is the single most important step: it guarantees nothing in your lab can reach your real home network or the internet, so anything you run in here (including real malware samples, if you go that far later) can't escape.
3. Every VM you create in this lab attaches only to this internal network — no other network adapter.

## 2. Victim VMs

**Windows victim:**
1. Download a legal, free Windows evaluation VM — Microsoft provides these directly for development/testing (search "Microsoft Windows 11 development VM" — official Microsoft site only, these are time-limited but free and legitimate).
2. Install **Sysmon** (Microsoft Sysinternals, official download) with a solid configuration — the well-known [SwiftOnSecurity Sysmon config](https://github.com/SwiftOnSecurity/sysmon-config) is the community-standard starting point and is directly relevant to the Windows PowerShell/process-creation scenarios your `soc-triage-tool` project already models.
3. Set the VM's network adapter to the internal network only.

**Linux victim:**
1. Ubuntu Server (free, official ISO) is fine — this mirrors the `db-prod-03` scenario style already in this simulator.
2. Enable auth logging (on by default) and consider installing `auditd` for deeper visibility.
3. Internal network only.

## 3. SIEM VM

**Splunk Free** (you already know Splunk from `splunk-detections`) — the free tier's daily indexing limit is generous enough for a home lab.

1. Install Splunk on its own VM (or directly on your host machine if you'd rather not dedicate a VM to it — Splunk itself doesn't need network isolation since it's not a target, but keep its *data inputs* scoped to only your lab VMs).
2. Install a **Universal Forwarder** on each victim VM, configured to ship Windows Event Logs (including Sysmon) and Linux auth logs to your Splunk instance.
3. Verify you're actually receiving events before moving on — run a benign action (log in, run a command) on a victim VM and confirm it shows up in Splunk within a minute or two.

## 4. Attack generation: Atomic Red Team

Don't hand-write exploits — **Atomic Red Team** (open source, MITRE ATT&CK-mapped, official GitHub repo) is the standard tool for exactly this use case: small, safe, scripted actions that reproduce the *telemetry signature* of real attack techniques without needing actual malware.

1. Install the `invoke-atomicredteam` PowerShell module on your Windows victim VM (official install instructions are in the Atomic Red Team GitHub repo — read them directly from source, don't run a script from a random blog).
2. Pick a technique that matches a scenario you want to build — e.g., `T1110.001` (brute force) or `T1059.001` (PowerShell) map directly onto techniques already in this simulator and in `soc-triage-tool`.
3. Run the atomic test, then go verify the resulting telemetry actually landed in Splunk the way you expected. This step — confirming what a real attack technique *actually* looks like in your own logs — is the single most valuable part of this whole lab, more than the app itself.

## 5. Closing the loop back to this project

Once you have real Splunk data from real Atomic Red Team runs, the natural next step for `soc-analyst-simulator` is a **live mode**: instead of static `scenarios.js` entries, pull the last N alerts from your Splunk instance via its REST API, and run them through the same investigation → report → escalation → persona-feedback flow this app already has. That would need:

- A small local script (Python or Node) that queries Splunk's REST API and reshapes results into this app's alert schema
- Since Splunk's API requires credentials, this would run locally against your own Splunk instance — never something to expose in the deployed GitHub Pages version, which should stay on static scenario data for anyone browsing your portfolio without a lab of their own

That's a distinct, separate build from this phase — worth doing once the lab itself is solid and generating clean data.

## Safety notes

- Internal-network-only is not optional. Don't bridge these VMs to your real network "just to update Windows" — download updates once, on an internet-connected VM, then snapshot it and clone from the snapshot for lab use, or use VirtualBox's "NAT" mode *temporarily* for patching only, then switch back to internal-only before running anything else.
- Only run Atomic Red Team tests and other tools from their official source repos. Don't download prebuilt "malware sample" VMs or ISOs from unofficial sources — Atomic Red Team's own test library is sufficient to reproduce realistic telemetry safely.
- Snapshot your victim VMs before running any atomic test, so you can revert cleanly between scenarios.
