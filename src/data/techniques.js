// A working subset of MITRE ATT&CK (Enterprise) — the techniques an L1 at a
// bank plausibly reaches for, plus the near-miss ones that make the mapping a
// real decision instead of a lookup. ATT&CK mapping is kept because it is
// genuinely part of the job: SIEM detections ship with technique IDs attached,
// and case tools ask for one on every incident, because it is what makes
// incidents comparable and coverage gaps visible.

export const TECHNIQUES = [
  { id: 'T1003.001', name: 'OS Credential Dumping: LSASS Memory', tactic: 'Credential Access' },
  { id: 'T1003.008', name: '/etc/passwd and /etc/shadow', tactic: 'Credential Access' },
  { id: 'T1021.004', name: 'Remote Services: SSH', tactic: 'Lateral Movement' },
  { id: 'T1030', name: 'Data Transfer Size Limits', tactic: 'Exfiltration' },
  { id: 'T1046', name: 'Network Service Discovery', tactic: 'Discovery' },
  { id: 'T1052.001', name: 'Exfiltration over USB', tactic: 'Exfiltration' },
  { id: 'T1053.005', name: 'Scheduled Task/Job: Scheduled Task', tactic: 'Persistence' },
  { id: 'T1059.001', name: 'Command and Scripting Interpreter: PowerShell', tactic: 'Execution' },
  { id: 'T1074.001', name: 'Local Data Staging', tactic: 'Collection' },
  { id: 'T1078', name: 'Valid Accounts', tactic: 'Defense Evasion' },
  { id: 'T1078.004', name: 'Valid Accounts: Cloud Accounts', tactic: 'Initial Access / Persistence' },
  { id: 'T1091', name: 'Replication Through Removable Media', tactic: 'Lateral Movement' },
  { id: 'T1098.002', name: 'Account Manipulation: Additional Email Delegate Permissions', tactic: 'Persistence' },
  { id: 'T1105', name: 'Ingress Tool Transfer', tactic: 'Command and Control' },
  { id: 'T1110.001', name: 'Brute Force: Password Guessing', tactic: 'Credential Access' },
  { id: 'T1110.003', name: 'Brute Force: Password Spraying', tactic: 'Credential Access' },
  { id: 'T1114.003', name: 'Email Collection: Email Forwarding Rule', tactic: 'Collection' },
  { id: 'T1135', name: 'Network Share Discovery', tactic: 'Discovery' },
  { id: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'Initial Access' },
  { id: 'T1204.002', name: 'User Execution: Malicious File', tactic: 'Execution' },
  { id: 'T1213', name: 'Data from Information Repositories', tactic: 'Collection' },
  { id: 'T1486', name: 'Data Encrypted for Impact', tactic: 'Impact' },
  { id: 'T1526', name: 'Cloud Service Discovery', tactic: 'Discovery' },
  { id: 'T1530', name: 'Data from Cloud Storage', tactic: 'Collection' },
  { id: 'T1534', name: 'Internal Spearphishing', tactic: 'Lateral Movement' },
  { id: 'T1539', name: 'Steal Web Session Cookie', tactic: 'Credential Access' },
  { id: 'T1552.001', name: 'Unsecured Credentials: Credentials In Files', tactic: 'Credential Access' },
  { id: 'T1556.006', name: 'Modify Authentication Process: Multi-Factor Authentication', tactic: 'Credential Access' },
  { id: 'T1560.001', name: 'Archive Collected Data: Archive via Utility', tactic: 'Collection' },
  { id: 'T1566', name: 'Phishing', tactic: 'Initial Access' },
  { id: 'T1566.002', name: 'Phishing: Spearphishing Link', tactic: 'Initial Access' },
  { id: 'T1567.002', name: 'Exfiltration to Cloud Storage', tactic: 'Exfiltration' },
  { id: 'T1578.001', name: 'Modify Cloud Compute Infrastructure: Create Snapshot', tactic: 'Defense Evasion' },
  { id: 'T1580', name: 'Cloud Infrastructure Discovery', tactic: 'Discovery' },
  { id: 'T1588.002', name: 'Obtain Capabilities: Tool', tactic: 'Resource Development' },
  { id: 'T1595', name: 'Active Scanning', tactic: 'Reconnaissance' },
  { id: 'T1595.001', name: 'Active Scanning: Scanning IP Blocks', tactic: 'Reconnaissance' },
  { id: 'T1656', name: 'Impersonation', tactic: 'Defense Evasion' },
  { id: 'T1657', name: 'Financial Theft', tactic: 'Impact' },
];

export function findTechnique(id) {
  const wanted = String(id || '').trim().toUpperCase();
  return TECHNIQUES.find((t) => t.id.toUpperCase() === wanted) || null;
}

export function searchTechniques(term) {
  const q = String(term || '').trim().toLowerCase();
  if (!q) return TECHNIQUES;
  return TECHNIQUES.filter((t) =>
    t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.tactic.toLowerCase().includes(q)
  );
}
