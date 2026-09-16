// Extracted from SOCTriageTool.jsx so the rule engine can be tested
// independently of React. Pure functions, no DOM, no network.

/** Log formats the engine can recognise. */
export const FORMATS = [
  'CEF',
  'Suricata JSON',
  'Zeek conn.log',
  'Windows Event Log',
  'Syslog',
  'DNS Log',
  'Free-form Narrative'
];

export const IP_RE = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g;
export function uniq(a) { return [...new Set(a.filter(Boolean))]; }
export function extractIPs(t) { return uniq(t.match(IP_RE) || []); }

export function detectFormat(t) {
  if (/^CEF:\d+\|/i.test(t))                                                    return "CEF";
  if (t.trim().startsWith("{") && /"event_type"|"alert"|"signature"/.test(t))   return "Suricata JSON";
  if (/#fields\s+ts\b/.test(t) || /^\d{10,}\.\d+\s+\S+\s+\d+\.\d+\.\d+\.\d+/m.test(t)) return "Zeek conn.log";
  if (/EventID\s*:\s*\d+/i.test(t))                                             return "Windows Event Log";
  if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d/m.test(t))      return "Syslog";
  if (/Timestamp:.*\d{4}-\d{2}-\d{2}|Query:\s*\S+\.\S+/i.test(t))             return "DNS Log";
  return "Free-form Narrative";
}

/** Standard Zeek conn.log column order, used when the capture has no #fields header. */
export const ZEEK_CONN_FIELDS = [
  'ts', 'uid', 'id.orig_h', 'id.orig_p', 'id.resp_h', 'id.resp_p',
  'proto', 'service', 'duration', 'orig_bytes', 'resp_bytes', 'conn_state'
];

/**
 * Parse Zeek conn.log text into row objects keyed by column name.
 *
 * Reads the `#fields` header when present and falls back to the standard
 * conn.log column order otherwise. Zeek writes unset numeric fields as `-`,
 * which becomes null rather than NaN.
 *
 * @param {string} text raw conn.log content
 * @returns {Array<Object>} one object per data row
 */
export function parseZeek(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const header = lines.find(l => /^#fields\b/.test(l));
  const fields = header
    ? header.replace(/^#fields\s+/, '').split(/\s+/)
    : ZEEK_CONN_FIELDS;

  const num = v => (v === '-' || v === '' || v == null ? null : Number(v));

  return lines
    .filter(l => !l.startsWith('#'))
    .map(line => {
      const cells = line.split(/\s+/);
      const row = {};
      fields.forEach((f, i) => { row[f] = cells[i]; });
      row.duration    = num(row.duration);
      row.orig_bytes  = num(row.orig_bytes);
      row.resp_bytes  = num(row.resp_bytes);
      row['id.orig_p'] = num(row['id.orig_p']);
      row['id.resp_p'] = num(row['id.resp_p']);
      return row;
    })
    .filter(row => row.uid || row['id.orig_h']);
}
