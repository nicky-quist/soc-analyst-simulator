// Theming is done with CSS custom properties rather than a JS theme object, so
// a single `data-theme` attribute on the root repaints the whole console and
// inline styles stay theme-agnostic. Dark is the default because that is what a
// SOC wall looks like; light is there for people who have to work in daylight.

export const THEME_CSS = `
:root, [data-theme="dark"] {
  --bg: #0a0e17;
  --surface: #111827;
  --surface-alt: #0d1420;
  --surface-raised: #172136;
  --border: #1f2a3d;
  --border-strong: #2d3b54;
  --text: #e6edf7;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --primary: #3b82f6;
  --primary-strong: #60a5fa;
  --primary-soft: #12233f;
  --on-primary: #ffffff;
  --success: #34d399;
  --success-soft: #0d2a22;
  --warning: #fbbf24;
  --warning-soft: #2a1f0b;
  --danger: #f87171;
  --danger-soft: #2c1414;
  --info: #22d3ee;
  --info-soft: #0a2630;
  --log-bg: #060a12;
  --log-text: #cbd5e1;
  --sev-critical: #f87171; --sev-critical-bg: #2c1414;
  --sev-high: #fb923c;     --sev-high-bg: #2a1a0d;
  --sev-medium: #fbbf24;   --sev-medium-bg: #2a1f0b;
  --sev-low: #34d399;      --sev-low-bg: #0d2a22;
  --sev-informational: #60a5fa; --sev-informational-bg: #12233f;
  --shadow: 0 1px 2px rgba(0,0,0,0.4);
  color-scheme: dark;
}
[data-theme="light"] {
  --bg: #f5f6f8;
  --surface: #ffffff;
  --surface-alt: #f9fafb;
  --surface-raised: #ffffff;
  --border: #e3e5e9;
  --border-strong: #d1d5db;
  --text: #111827;
  --text-secondary: #6b7280;
  --text-muted: #9ca3af;
  --primary: #2563eb;
  --primary-strong: #1d4ed8;
  --primary-soft: #eff6ff;
  --on-primary: #ffffff;
  --success: #059669;
  --success-soft: #ecfdf5;
  --warning: #b45309;
  --warning-soft: #fffbeb;
  --danger: #dc2626;
  --danger-soft: #fef2f2;
  --info: #0891b2;
  --info-soft: #ecfeff;
  --log-bg: #0f172a;
  --log-text: #e2e8f0;
  --sev-critical: #b91c1c; --sev-critical-bg: #fef2f2;
  --sev-high: #c2410c;     --sev-high-bg: #fff7ed;
  --sev-medium: #b45309;   --sev-medium-bg: #fffbeb;
  --sev-low: #047857;      --sev-low-bg: #ecfdf5;
  --sev-informational: #1d4ed8; --sev-informational-bg: #eff6ff;
  --shadow: 0 1px 2px rgba(16,24,40,0.06);
  color-scheme: light;
}
`;

export const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace";

export const C = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surfaceAlt: 'var(--surface-alt)',
  surfaceRaised: 'var(--surface-raised)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
  text: 'var(--text)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  primary: 'var(--primary)',
  primaryStrong: 'var(--primary-strong)',
  primarySoft: 'var(--primary-soft)',
  onPrimary: 'var(--on-primary)',
  success: 'var(--success)',
  successSoft: 'var(--success-soft)',
  warning: 'var(--warning)',
  warningSoft: 'var(--warning-soft)',
  danger: 'var(--danger)',
  dangerSoft: 'var(--danger-soft)',
  info: 'var(--info)',
  infoSoft: 'var(--info-soft)',
  logBg: 'var(--log-bg)',
  logText: 'var(--log-text)',
  shadow: 'var(--shadow)',
};

export const TONE = {
  positive: { fg: C.success, bg: C.successSoft, border: C.success },
  concerned: { fg: C.danger, bg: C.dangerSoft, border: C.danger },
  coaching: { fg: C.warning, bg: C.warningSoft, border: C.warning },
  neutral: { fg: C.textSecondary, bg: C.surfaceAlt, border: C.borderStrong },
  business: { fg: C.info, bg: C.infoSoft, border: C.info },
  primary: { fg: C.primaryStrong, bg: C.primarySoft, border: C.primary },
};

export function severityTone(severity) {
  const key = String(severity || '').toLowerCase();
  if (!key) return TONE.neutral;
  return { fg: `var(--sev-${key})`, bg: `var(--sev-${key}-bg)`, border: `var(--sev-${key})` };
}

export const SEVERITY_COLORS = {
  critical: 'var(--sev-critical)',
  high: 'var(--sev-high)',
  medium: 'var(--sev-medium)',
  low: 'var(--sev-low)',
  informational: 'var(--sev-informational)',
};
