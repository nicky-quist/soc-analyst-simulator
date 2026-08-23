// PowerShell's -EncodedCommand is UTF-16LE base64, which decodes to text with a
// null between every character. Stripping them is what CyberChef's "Decode
// text" step does, and recognizing that pattern is a small piece of real
// analyst knowledge worth teaching in passing.

export function decodeBase64(input) {
  const cleaned = String(input).trim().replace(/\s+/g, '');
  if (!cleaned) return { ok: false, error: 'Paste a base64 string to decode.' };
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) {
    return { ok: false, error: 'That is not base64 — it contains characters outside the base64 alphabet.' };
  }
  let raw;
  try {
    raw = atob(cleaned);
  } catch {
    return { ok: false, error: 'Invalid base64 — check that the whole string was copied, including padding.' };
  }
  const utf16le = raw.length > 3 && raw.charCodeAt(1) === 0 && raw.charCodeAt(3) === 0;
  const text = utf16le ? raw.replace(/\0/g, '') : raw;
  return { ok: true, text, encoding: utf16le ? 'UTF-16LE (PowerShell -EncodedCommand)' : 'UTF-8 / ASCII' };
}
