// Theming is done with CSS custom properties rather than a JS theme object, so
// a single `data-theme` attribute on the root repaints the whole console and
// inline styles stay theme-agnostic. Light is the default: this is a training
// console people read for an hour at a time, not a wall display.
//
// Three severity ramps, not one. They all run critical -> high -> medium -> low
// (red -> orange -> yellow -> green) so a glance reads the same way everywhere,
// but they are tuned for three different jobs and must not be collapsed back
// into one set:
//   --band-*   thick gauge arcs. Vivid and fully saturated; this is the ramp
//              the shift-performance dials are built on. Leave it alone.
//   --chart-*  large solid fills (stacked bars, donut). Softer, because a
//              600px block of gauge-red is a wall of noise, not a chart.
//   --sev-*    badge text on a tinted chip. Needs text contrast, so these run
//              darker than either fill ramp.

export const THEME_CSS = `
:root, [data-theme="light"] {
  --bg: #f5f4f1;
  --surface: #ffffff;
  --surface-alt: #faf9f7;
  --surface-raised: #ffffff;
  --border: #e4e0d9;
  --border-strong: #cdc7bd;
  --text: #1f2430;
  --text-secondary: #5c6472;
  --text-muted: #8b93a1;
  --primary: #0d9488;
  --primary-strong: #0f766e;
  --primary-soft: #eefaf8;
  --on-primary: #ffffff;
  --success: #059669;
  --success-soft: #ecfdf5;
  --warning: #b45309;
  --warning-soft: #fffbeb;
  --danger: #dc2626;
  --danger-soft: #fef2f2;
  --info: #0891b2;
  --info-soft: #ecfeff;
  --log-bg: #f7f6f3;
  --log-text: #2b3140;
  --band-critical: #e5484d;
  --band-high: #f76b15;
  --band-medium: #f5b301;
  --band-low: #16a34a;
  --chart-critical: #e07a76;
  --chart-high: #ef9d5c;
  --chart-medium: #f2c85c;
  --chart-low: #6cc296;
  --chart-informational: #6bbcd4;
  --sev-critical: #b91c1c; --sev-critical-bg: #fef2f2;
  --sev-high: #c2410c;     --sev-high-bg: #fff7ed;
  --sev-medium: #b45309;   --sev-medium-bg: #fffbeb;
  --sev-low: #047857;      --sev-low-bg: #ecfdf5;
  --sev-informational: #0891b2; --sev-informational-bg: #ecfeff;
  --shadow: 0 1px 2px rgba(31,36,48,0.06);
  color-scheme: light;
}
[data-theme="dark"] {
  --bg: #0a0e17;
  --surface: #111827;
  --surface-alt: #0d1420;
  --surface-raised: #172136;
  --border: #1f2a3d;
  --border-strong: #2d3b54;
  --text: #e6edf7;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --primary: #14b8a6;
  --primary-strong: #2dd4bf;
  --primary-soft: #0f2e2b;
  --on-primary: #062420;
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
  --band-critical: #f87171;
  --band-high: #fb923c;
  --band-medium: #fbbf24;
  --band-low: #34d399;
  --chart-critical: #d96a6a;
  --chart-high: #dd9256;
  --chart-medium: #e0b95a;
  --chart-low: #59ab86;
  --chart-informational: #58a3ba;
  --sev-critical: #f87171; --sev-critical-bg: #2c1414;
  --sev-high: #fb923c;     --sev-high-bg: #2a1a0d;
  --sev-medium: #fbbf24;   --sev-medium-bg: #2a1f0b;
  --sev-low: #34d399;      --sev-low-bg: #0d2a22;
  --sev-informational: #22d3ee; --sev-informational-bg: #0a2630;
  --shadow: 0 1px 2px rgba(0,0,0,0.4);
  color-scheme: dark;
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

// Badge foregrounds. Text on a tint, so these are the darkest of the three ramps.
export const SEVERITY_COLORS = {
  critical: 'var(--sev-critical)',
  high: 'var(--sev-high)',
  medium: 'var(--sev-medium)',
  low: 'var(--sev-low)',
  informational: 'var(--sev-informational)',
};

// Gauge and meter arcs. The vivid red/orange/yellow/green ramp.
export const BAND_COLORS = {
  critical: 'var(--band-critical)',
  high: 'var(--band-high)',
  medium: 'var(--band-medium)',
  low: 'var(--band-low)',
};

// Large solid fills: stacked bars and the donut. Same hue order, softer.
export const CHART_COLORS = {
  critical: 'var(--chart-critical)',
  high: 'var(--chart-high)',
  medium: 'var(--chart-medium)',
  low: 'var(--chart-low)',
  informational: 'var(--chart-informational)',
};
