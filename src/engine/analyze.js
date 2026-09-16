// Extracted from SOCTriageTool.jsx so the rule engine can be tested
// independently of React. Pure functions, no DOM, no network.

import { uniq, extractIPs, detectFormat, parseZeek } from './format.js';

export function analyzeOffline(text) {
  const t = text.trim();
  const fmt = detectFormat(t);
  const ips = extractIPs(t);

  const r = {
    severity: "MEDIUM", log_format_detected: fmt,
    summary: "", threat_type: "Suspicious Activity",
    mitre_tactic: "Unknown", mitre_technique: "Unknown",
    iocs: ips, recommended_action: "Investigate and correlate with other events.",
    false_positive_likelihood: "Medium", confidence: 65, analyst_notes: ""
  };

  // ── SYSLOG ──────────────────────────────────────────────────────────────────
  if (fmt === "Syslog") {
    const failCount  = (t.match(/Failed password|authentication failure|Invalid user/gi) || []).length;
    const targets    = uniq((t.match(/Failed password for (?:invalid user )?(\S+)/gi) || [])
                        .map(m => m.replace(/failed password for (?:invalid user )?/i, "").trim()));
    const rootHit    = targets.some(u => /^(root|admin|administrator)$/i.test(u));
    const invalidUsr = /invalid user/i.test(t);

    r.iocs = uniq([...ips, ...targets.map(u => `user:${u}`)]);
    r.mitre_tactic = "Credential Access";
    r.mitre_technique = "T1110.001 - Brute Force: Password Guessing";
    r.threat_type = "Brute Force";

    if (failCount >= 5 && rootHit) {
      Object.assign(r, { severity: "CRITICAL", confidence: 95, false_positive_likelihood: "Low",
        summary: `Brute-force SSH attack: ${failCount} failed attempts against privileged account(s) (${targets.join(", ")}) from ${ips.join(", ")}. Root targeting indicates automated attack with privilege-escalation intent.`,
        recommended_action: `Block ${ips.join(", ")} at the firewall immediately. Verify no "Accepted password" entries follow in auth.log. Enable fail2ban. Rotate credentials for targeted accounts.` });
    } else if (failCount >= 3) {
      Object.assign(r, { severity: "HIGH", confidence: 88, false_positive_likelihood: "Low",
        summary: `SSH brute force: ${failCount} rapid failed logins for "${targets.join(", ")}" from ${ips.join(", ")}. Repeated failures indicate automated credential attack.`,
        recommended_action: `Block ${ips.join(", ")} at perimeter. Confirm no successful logins. Disable password auth in sshd_config and switch to key-only.` });
    } else if (failCount >= 1) {
      Object.assign(r, { severity: "LOW", confidence: 60, false_positive_likelihood: "High",
        summary: `Failed SSH login for "${targets.join(", ")}" from ${ips.join(", ")}. Isolated failure — may be a misconfigured service or one-off attempt.`,
        recommended_action: "Monitor for repeat attempts. No immediate action required." });
    } else if (/sudo|su\b/i.test(t)) {
      Object.assign(r, { threat_type: "Privilege Escalation", mitre_tactic: "Privilege Escalation",
        mitre_technique: "T1548.003 - Sudo and Sudo Caching", severity: "MEDIUM", confidence: 65,
        summary: "Sudo/su usage detected. Verify the user is authorised for elevation.",
        recommended_action: "Review /etc/sudoers and compare against authorised admin list." });
    } else {
      r.summary = "Syslog event — no known attack pattern matched. Review manually.";
      r.confidence = 40;
    }
    if (invalidUsr) r.analyst_notes = "Target username does not exist — consistent with credential stuffing or username enumeration.";
  }

  // ── WINDOWS EVENT LOG ────────────────────────────────────────────────────────
  else if (fmt === "Windows Event Log") {
    const eid      = parseInt((t.match(/EventID\s*:\s*(\d+)/i) || [])[1]) || 0;
    const computer = (t.match(/Computer\s*:\s*(\S+)/i) || [])[1] || "unknown host";
    const user     = (t.match(/User\s*:\s*([\w\\@.]+)/i) || [])[1] || "";
    const cmdLine  = (t.match(/(?:CommandLine|ScriptBlockText)\s*:\s*(.+)/i) || [])[1] || "";
    const dangerPS = /IEX|Invoke-Expression|DownloadString|WebClient|EncodedCommand|FromBase64String|bypass|hidden|noprofile|mimikatz|shellcode/i.test(t);
    const lateral  = /(net\s+use|\\\\[\w.]+\\|psexec|wmic.*\/node)/i.test(t);
    const persist  = /(HKCU|HKLM|\\Run\b|Startup|schtasks|at\.exe)/i.test(t);

    r.iocs = uniq([...ips, user && `user:${user}`, `host:${computer}`, cmdLine && `cmd:${cmdLine.slice(0,80)}`]);

    if ((eid === 4104 || (eid === 4688 && /powershell/i.test(t)))) {
      Object.assign(r, {
        threat_type: dangerPS ? "Malicious PowerShell" : "Suspicious PowerShell",
        mitre_tactic: "Execution", mitre_technique: "T1059.001 - PowerShell",
        severity: dangerPS ? "CRITICAL" : "HIGH", confidence: dangerPS ? 93 : 75,
        false_positive_likelihood: dangerPS ? "Low" : "Medium",
        summary: dangerPS
          ? `Malicious PowerShell on ${computer} (user: ${user}). Script uses download cradle / in-memory execution (IEX/WebClient/EncodedCommand) — common loader technique for second-stage payloads.`
          : `Suspicious PowerShell execution logged on ${computer}. Review script content for indicators.`,
        recommended_action: `Isolate ${computer}. Decode full script block. Hunt for ${ips.join(", ") || "C2 IPs"} across environment. Check persistence (Run keys, scheduled tasks).`
      });
    } else if (eid === 4625) {
      Object.assign(r, { threat_type: "Failed Logon", mitre_tactic: "Credential Access",
        mitre_technique: "T1110 - Brute Force", severity: "MEDIUM", confidence: 68,
        summary: `Windows failed logon (4625) on ${computer} for account ${user || "unknown"}.`,
        recommended_action: "Correlate with other 4625 events to detect brute-force patterns. Check logon type and source network address." });
    } else if (eid === 4688 && lateral) {
      Object.assign(r, { threat_type: "Lateral Movement", mitre_tactic: "Lateral Movement",
        mitre_technique: "T1021 - Remote Services", severity: "HIGH", confidence: 80,
        summary: `Process creation (4688) on ${computer} with lateral movement indicators — remote admin tool or network share access.`,
        recommended_action: "Trace execution chain. Identify source host. Verify against authorised admin activity." });
    } else if (eid === 4688 && persist) {
      Object.assign(r, { threat_type: "Persistence", mitre_tactic: "Persistence",
        mitre_technique: "T1547.001 - Registry Run Keys", severity: "HIGH", confidence: 78,
        summary: `Process on ${computer} is interacting with autostart registry keys or scheduled tasks — possible persistence mechanism.`,
        recommended_action: "Audit Run keys and scheduled tasks on the host. Compare against known-good baseline." });
    } else {
      r.summary = `Windows Event ${eid} on ${computer}. No specific rule matched — review manually.`;
      r.analyst_notes = "Add CommandLine, ParentProcess, or LogonType fields for better classification.";
      r.confidence = 45;
    }
  }

  // ── SURICATA JSON ────────────────────────────────────────────────────────────
  else if (fmt === "Suricata JSON") {
    let p = {};
    try { p = JSON.parse(t); } catch { /**/ }
    const sig      = p.alert?.signature || (t.match(/"signature"\s*:\s*"([^"]+)"/) || [])[1] || "";
    const sev      = p.alert?.severity ?? 3;
    const srcIP    = p.src_ip  || ips[0] || "";
    const dstIP    = p.dest_ip || ips[1] || "";
    const dstPort  = p.dest_port || "";
    const category = p.alert?.category || "";

    r.iocs = uniq([srcIP, dstIP, dstPort && `port:${dstPort}`, sig && `sig:${sig}`]);

    if (/cobalt.?strike/i.test(sig)) {
      Object.assign(r, { threat_type: "Cobalt Strike C2", mitre_tactic: "Command and Control",
        mitre_technique: "T1071.001 - Web Protocols", severity: "CRITICAL", confidence: 92,
        false_positive_likelihood: "Low",
        summary: `Cobalt Strike beacon activity detected from internal host ${srcIP} to ${dstIP}:${dstPort}. Cobalt Strike is a commercial offensive framework widely used in targeted attacks and ransomware operations.`,
        recommended_action: `Isolate ${srcIP} immediately. Capture memory. Block ${dstIP} at perimeter. Hunt all hosts communicating with ${dstIP}. Escalate to IR.` });
    } else if (/malware|trojan|backdoor|\brat\b|beacon|c2/i.test(sig)) {
      Object.assign(r, { threat_type: "Malware / C2", mitre_tactic: "Command and Control",
        mitre_technique: "T1071 - Application Layer Protocol",
        severity: sev <= 1 ? "CRITICAL" : "HIGH", confidence: 85, false_positive_likelihood: "Low",
        summary: `IDS alert: ${sig} — malware traffic from ${srcIP} to ${dstIP}:${dstPort}.`,
        recommended_action: `Investigate ${srcIP} for active infection. Block ${dstIP}. Review process list and network connections on source host.` });
    } else if (/exploit|shellcode|overflow/i.test(sig)) {
      Object.assign(r, { threat_type: "Exploit Attempt", mitre_tactic: "Initial Access",
        mitre_technique: "T1190 - Exploit Public-Facing Application", severity: "HIGH", confidence: 78,
        summary: `Exploit attempt: ${sig} from ${srcIP} targeting ${dstIP}:${dstPort}.`,
        recommended_action: "Verify destination service is patched. Review access logs for exploitation indicators." });
    } else if (/scan|sweep|probe/i.test(sig)) {
      Object.assign(r, { threat_type: "Reconnaissance", mitre_tactic: "Reconnaissance",
        mitre_technique: "T1595 - Active Scanning", severity: "LOW", confidence: 70,
        false_positive_likelihood: "Medium",
        summary: `Network scan from ${srcIP}. Signature: ${sig}.`,
        recommended_action: `Block ${srcIP} if external. If internal, identify the scanning process.` });
    } else {
      r.severity   = sev <= 1 ? "HIGH" : sev <= 2 ? "MEDIUM" : "LOW";
      r.summary    = `IDS alert: ${sig || "unknown"} from ${srcIP} to ${dstIP}.`;
      r.threat_type = category || "IDS Alert";
      r.confidence  = 60;
    }
  }

  // ── ZEEK CONN.LOG ────────────────────────────────────────────────────────────
  else if (fmt === "Zeek conn.log") {
    // Parse the actual columns. An earlier version scraped the raw text for
    // long digit runs and used t.includes(port), which matched the Unix
    // timestamp instead of the duration and byte fields - a 3600s flow was
    // reported as 473688 hours. See tests/analyze.test.js.
    const rows        = parseZeek(t);
    const C2_PORTS    = [4444, 4445, 1337, 6666, 6667, 8888, 31337];
    const durationSec = Math.max(0, ...rows.map(row => row.duration || 0));
    const bytesOut    = Math.max(0, ...rows.map(row => row.orig_bytes || 0));
    const suspPorts   = uniq(rows.map(row => row['id.resp_p']).filter(p => C2_PORTS.includes(p)));

    r.iocs = ips;

    if (durationSec >= 1800 && bytesOut > 1_000_000) {
      Object.assign(r, { threat_type: "C2 Beacon", mitre_tactic: "Command and Control",
        mitre_technique: "T1071 - Application Layer Protocol",
        severity: "HIGH", confidence: 83, false_positive_likelihood: "Low",
        summary: `Long-duration connection (${(durationSec/3600).toFixed(1)}h) with high outbound data (${Math.round(bytesOut/1024/1024)}MB) — pattern consistent with C2 beaconing or data staging.`,
        recommended_action: "Capture PCAP for this flow. Identify process on source host. Check destination IP reputation." });
    } else if (suspPorts.length) {
      Object.assign(r, { threat_type: "Suspicious Outbound Connection", mitre_tactic: "Command and Control",
        mitre_technique: "T1571 - Non-Standard Port", severity: "HIGH", confidence: 78,
        summary: `Connection on non-standard port(s) ${suspPorts.join(", ")} — commonly used by C2 frameworks and malware.`,
        recommended_action: "Identify the process on the source host using that port. Check destination IP reputation." });
    } else if (bytesOut > 50_000_000) {
      Object.assign(r, { threat_type: "Potential Data Exfiltration", mitre_tactic: "Exfiltration",
        mitre_technique: "T1048 - Exfiltration Over Alternative Protocol",
        severity: "HIGH", confidence: 70,
        summary: `Large data transfer (${Math.round(bytesOut/1024/1024)}MB) — potential exfiltration.`,
        recommended_action: "Identify what data was transferred. Check DLP policies on source system." });
    } else {
      r.summary = "Zeek flow detected. No high-confidence threat pattern matched.";
      r.analyst_notes = "Add dns.log or http.log entries for better analysis.";
      r.confidence = 45;
    }
  }

  // ── CEF ──────────────────────────────────────────────────────────────────────
  else if (fmt === "CEF") {
    const kv = {};
    (t.match(/(\w+)=([^\s|]+)/g) || []).forEach(f => { const i = f.indexOf("="); kv[f.slice(0,i)] = f.slice(i+1); });
    const threat   = kv.cs1 || kv.ThreatName || kv.msg || "";
    const action   = (kv.act || kv.deviceAction || "").toLowerCase();
    const src      = kv.src || ips[0] || "";
    const dst      = kv.dst || ips[1] || "";
    const blocked  = /block|deny|drop/.test(action);

    r.iocs = uniq([...ips, threat && `threat:${threat}`]);

    if (/mimikatz|lsass|credential.dump|hashdump/i.test(t)) {
      Object.assign(r, { threat_type: "Credential Dumping", mitre_tactic: "Credential Access",
        mitre_technique: "T1003 - OS Credential Dumping",
        severity: blocked ? "HIGH" : "CRITICAL", confidence: 93, false_positive_likelihood: "Low",
        summary: `Credential dumping tool (Mimikatz/lsass) detected on ${src}. Action: ${action || "unknown"}. Even if blocked, presence indicates an attacker with local access attempting credential harvest.`,
        recommended_action: blocked
          ? `Investigate ${src} for active compromise despite the block. Hunt lateral movement. Force credential reset for all accounts cached on ${src}.`
          : `URGENT: Isolate ${src}. Assume all cached credentials are compromised. Force domain-wide password reset. Escalate to IR team.` });
    } else if (/exploit|shellcode|overflow/i.test(t)) {
      Object.assign(r, { threat_type: "Exploit Attempt", mitre_tactic: "Initial Access",
        mitre_technique: "T1190 - Exploit Public-Facing Application",
        severity: blocked ? "MEDIUM" : "HIGH", confidence: 80,
        summary: `Exploit activity from ${src} to ${dst}. ${blocked ? "Blocked." : "Action: " + action}`,
        recommended_action: "Patch the targeted service. Check for successful exploitation indicators on the destination." });
    } else {
      r.severity = blocked ? "LOW" : "MEDIUM";
      r.summary = `CEF event from ${src} to ${dst}. ${threat || kv.msg || "Review raw event."}`;
      r.threat_type = threat || "Security Policy Event";
      r.confidence = 60;
      if (blocked) r.false_positive_likelihood = "High";
    }
  }

  // ── DNS LOG ──────────────────────────────────────────────────────────────────
  else if (fmt === "DNS Log") {
    const queries    = (t.match(/Query:\s*(\S+)/gi) || []).map(q => q.replace(/Query:\s*/i, ""));
    const highEnt    = /entropy.*HIGH|Unusual_subdomain_entropy.*HIGH/i.test(t);
    const b64Subs    = queries.filter(q => /^[A-Za-z0-9+/]{8,}=*\.[a-z]+\.[a-z]+/.test(q));
    const bytesOut   = parseInt((t.match(/Bytes_out:\s*(\d+)/i) || [])[1]) || 0;
    const rootDomain = (queries[0] || "").split(".").slice(-2).join(".");

    r.iocs = uniq([...ips, ...queries.map(q => `dns:${q}`)]);

    if (b64Subs.length > 0 || highEnt) {
      Object.assign(r, { threat_type: "DNS Exfiltration", mitre_tactic: "Exfiltration",
        mitre_technique: "T1048.003 - Exfiltration Over DNS",
        severity: "HIGH", confidence: 90, false_positive_likelihood: "Low",
        summary: `DNS exfiltration detected: Base64-encoded subdomains sent to ${rootDomain || "external domain"}. Stolen data is encoded into DNS query labels to bypass DLP controls. High subdomain entropy confirms anomalous usage.`,
        recommended_action: `Sinkhole the destination domain at DNS resolver. Identify source host (${ips.join(", ")}). Decode subdomain labels to determine exfiltrated data. Hunt for the implant on the source.` });
    } else if (bytesOut > 10_000) {
      Object.assign(r, { threat_type: "DNS Tunneling", mitre_tactic: "Command and Control",
        mitre_technique: "T1071.004 - DNS", severity: "MEDIUM", confidence: 68,
        summary: `Unusual DNS query volume / high outbound bytes — possible DNS tunneling or C2 over DNS.`,
        recommended_action: "Analyse query frequency, length, and uniqueness. Deploy DNS sinkhole if malicious domain confirmed." });
    } else {
      r.summary = "DNS log event. Review query destinations and frequency for anomalies.";
      r.confidence = 50;
    }
  }

  // ── FREE-FORM ────────────────────────────────────────────────────────────────
  else {
    const suspCmd  = /whoami|net\s+user|net\s+localgroup|ipconfig|nmap|mimikatz|psexec|procdump/i.test(t);
    const lateral  = /\\\\[\w.]+\\[a-z$]+|admin\$|ipc\$|wmic.*\/node|psexec/i.test(t);
    const malUrl   = /http:\/\/[^\s"']+\/(payload|shell|rat|agent|beacon|update\.exe|loader)/i.test(t);
    const files    = uniq(t.match(/\b[\w.-]+\.(?:exe|ps1|bat|sh|dll|vbs)\b/gi) || []);
    const hashes   = uniq((t.match(/\b[A-Fa-f0-9]{32,64}\b/g) || []).map(h => `hash:${h}`));

    r.iocs = uniq([...ips, ...files, ...hashes]);

    if (malUrl || lateral) {
      Object.assign(r, { severity: "HIGH", false_positive_likelihood: "Medium", confidence: 65,
        threat_type: malUrl ? "Malware Delivery" : "Lateral Movement",
        mitre_tactic: malUrl ? "Initial Access" : "Lateral Movement",
        mitre_technique: malUrl ? "T1566 - Phishing" : "T1021 - Remote Services",
        summary: `Narrative contains indicators of ${malUrl ? "malware delivery" : "lateral movement"}. IPs: ${ips.join(", ") || "none"}.`,
        recommended_action: "Correlate with endpoint and network logs. Validate source and destination of the activity." });
    } else if (suspCmd) {
      Object.assign(r, { severity: "MEDIUM", confidence: 60,
        threat_type: "Suspicious Command Execution", mitre_tactic: "Discovery",
        mitre_technique: "T1082 - System Information Discovery",
        summary: "Narrative contains suspicious commands (whoami, net user, nmap, etc.) — possible attacker recon or post-exploitation.",
        recommended_action: "Correlate with process creation logs on the affected host." });
    } else {
      Object.assign(r, { severity: "LOW", confidence: 40, false_positive_likelihood: "High",
        summary: "Free-form narrative analysed. No specific threat pattern matched.",
        analyst_notes: "Include specific IPs, usernames, commands, and timestamps for higher-confidence results." });
    }
  }

  return r;
}
