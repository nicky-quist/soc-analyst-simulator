// Shared style objects and formatters. Kept out of the component modules so
// fast refresh can treat those as component-only files.

import { C, FONT, MONO } from '../theme.js';

export const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: C.surfaceAlt,
  border: `1px solid ${C.borderStrong}`, color: C.text, padding: '9px 12px',
  fontSize: 14, fontFamily: FONT, borderRadius: 6,
};

export const monoInputStyle = { ...inputStyle, fontFamily: MONO, fontSize: 13 };

export function initials(name) {
  return name.split(' ').map((p) => p[0]).join('').toUpperCase();
}

export function formatDuration(ms) {
  if (ms == null) return '—';
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}
