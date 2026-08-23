import { C, FONT, MONO, TONE, severityTone } from '../theme.js';
import { initials } from './helpers.js';

export function Card({ children, style, tone }) {
  return (
    <div style={{
      background: tone ? tone.bg : C.surface,
      border: `1px solid ${tone ? tone.border : C.border}`,
      borderRadius: 8,
      boxShadow: C.shadow,
      ...style,
    }}>
      {children}
    </div>
  );
}

export function SectionLabel({ children, style }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.6,
      textTransform: 'uppercase', marginBottom: 12, ...style,
    }}>
      {children}
    </div>
  );
}

export function Badge({ label, tone, title, style }) {
  const t = tone || TONE.neutral;
  return (
    <span title={title} style={{
      display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 9px',
      borderRadius: 999, background: t.bg, color: t.fg, border: `1px solid ${t.border}`,
      letterSpacing: 0.3, whiteSpace: 'nowrap', ...style,
    }}>
      {label}
    </span>
  );
}

export function SeverityBadge({ severity }) {
  if (!severity) return null;
  return <Badge label={severity} tone={severityTone(severity)} />;
}

export function Button({ children, onClick, variant = 'secondary', disabled, style, type = 'button', ...rest }) {
  const palette = {
    primary: { bg: C.primary, fg: C.onPrimary, border: C.primary },
    secondary: { bg: C.surfaceRaised, fg: C.text, border: C.borderStrong },
    danger: { bg: C.dangerSoft, fg: C.danger, border: C.danger },
    ghost: { bg: 'transparent', fg: C.textSecondary, border: 'transparent' },
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      {...rest}
      style={{
        background: palette.bg, color: palette.fg, border: `1px solid ${palette.border}`,
        padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 6, fontFamily: FONT,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Field({ label, htmlFor, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6, display: 'block' }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

export function Tabs({ tabs, active, onSelect }) {
  return (
    <div role="tablist" style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${C.border}`, overflowX: 'auto' }}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(tab.id)}
            style={{
              background: 'transparent', border: 'none', borderBottom: `2px solid ${isActive ? C.primary : 'transparent'}`,
              color: isActive ? C.text : C.textSecondary, padding: '10px 14px', fontSize: 13,
              fontWeight: isActive ? 700 : 500, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
            {tab.count != null && (
              <span style={{
                marginLeft: 7, fontSize: 11, fontWeight: 700, color: C.textMuted,
                background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 999, padding: '1px 6px',
              }}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// A results grid in the shape a SIEM prints one: monospace, dense, scrollable
// sideways rather than wrapping into unreadable soup.
export function EventTable({ columns, rows }) {
  return (
    <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 6 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: 12.5 }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} style={{
                textAlign: 'left', padding: '8px 12px', color: C.textSecondary, fontWeight: 700,
                borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, whiteSpace: 'nowrap',
                fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col} style={{
                  padding: '8px 12px', color: C.text, borderBottom: `1px solid ${C.border}`,
                  verticalAlign: 'top', lineHeight: 1.5,
                }}>
                  {row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Callout({ tone = TONE.neutral, title, children, style }) {
  return (
    <div style={{
      border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: 6,
      padding: '12px 14px', ...style,
    }}>
      {title && <div style={{ fontSize: 13, fontWeight: 700, color: tone.fg, marginBottom: children ? 5 : 0 }}>{title}</div>}
      {children && <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{children}</div>}
    </div>
  );
}

export function PersonaMessage({ persona }) {
  const tone = TONE[persona.tone] || TONE.neutral;
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: tone.bg, color: tone.fg, border: `1px solid ${tone.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
      }}>
        {initials(persona.from)}
      </div>
      <div style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 16px', background: C.surface }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          {persona.from} <span style={{ fontWeight: 400, color: C.textSecondary }}>· {persona.role}</span>
        </div>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.65 }}>{persona.message}</div>
      </div>
    </div>
  );
}

export function Metric({ label, value, hint, tone }) {
  return (
    <div style={{
      flex: '1 1 150px', border: `1px solid ${tone ? tone.border : C.border}`,
      background: tone ? tone.bg : C.surfaceAlt, borderRadius: 6, padding: '10px 14px',
    }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: tone ? tone.fg : C.text, marginTop: 3 }}>{value}</div>
      {hint && <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 3, lineHeight: 1.45 }}>{hint}</div>}
    </div>
  );
}

