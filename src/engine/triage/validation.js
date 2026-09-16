// Extracted from SOCTriageTool.jsx so the rule engine can be tested
// independently of React. Pure functions, no DOM, no network.

export const VALIDATION_RULES = [
  {
    id: "too_short",
    test: (v) => v.trim().length < 25,
    message: "Input is too short to analyze.",
    detail: "Paste at least one full log line or alert. A single word, filename, or partial snippet doesn't contain enough context for triage."
  },
  {
    id: "url_only",
    test: (v) => /^https?:\/\/\S+$/.test(v.trim()),
    message: "A URL alone cannot be analyzed.",
    detail: "Paste the actual log data or alert text — not a link to it. If your SIEM shows a URL for the alert, open it and copy the raw event text from inside."
  },
  {
    id: "base64_only",
    test: (v) => {
      const t = v.trim().replace(/\s/g, "");
      return t.length > 80 && /^[A-Za-z0-9+/]+=*$/.test(t) && t.length % 4 === 0;
    },
    message: "This looks like raw Base64-encoded data with no surrounding context.",
    detail: "If this is an encoded command from a log entry, paste the full log line that contains it — not just the encoded value. If you need to decode it first, do that and then paste the decoded content along with the original log line."
  },
  {
    id: "no_context",
    test: (v) => {
      const t = v.trim();
      const hasIndicator = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|EventID|sshd|powershell|CEF:|alert|signature|Failed|blocked|denied|src=|dst=|uid\b|\.exe|\.ps1|\.sh|action|severity|category|timestamp|proto)/i.test(t);
      return t.split(/\s+/).length < 6 && !hasIndicator;
    },
    message: "Not enough technical context to triage.",
    detail: "The input needs at least a timestamp, source or destination, and an event description. Even a single complete syslog line works — make sure you're pasting the full line, not a fragment."
  }
];

/**
 * Run every validation rule against `input`.
 * @returns {Array<{id,message,detail}>} the rules that tripped; empty means analysable.
 */
export function validateInput(input) {
  return VALIDATION_RULES.filter(r => r.test(input)).map(({ id, message, detail }) => ({ id, message, detail }));
}
