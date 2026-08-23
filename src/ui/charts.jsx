import { C, MONO } from '../theme.js';

// Hand-rolled SVG charts rather than a charting dependency: the whole project
// runs offline with no third-party calls, and these are four shapes, not a
// library's worth. Everything scales through viewBox so the cards stay
// responsive, and every colour comes from a theme token so light mode works.

import { SEVERITY_COLORS } from '../theme.js';

export function StackedBars({ data, keys, height = 150, xKey = 'hour' }) {
  const width = 720;
  const padBottom = 18;
  const barGap = 3;
  const barWidth = (width - (data.length - 1) * barGap) / data.length;
  const max = Math.max(...data.map((d) => keys.reduce((sum, k) => sum + (d[k] || 0), 0)), 1);
  const plot = height - padBottom;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Alert volume by hour">
      {data.map((row, i) => {
        const x = i * (barWidth + barGap);
        let y = plot;
        return (
          <g key={row[xKey]}>
            {keys.map((key) => {
              const value = row[key] || 0;
              const h = (value / max) * (plot - 4);
              y -= h;
              return <rect key={key} x={x} y={y} width={barWidth} height={h} fill={SEVERITY_COLORS[key]} rx="1" />;
            })}
            {i % 3 === 0 && (
              <text x={x + barWidth / 2} y={height - 5} textAnchor="middle" fontSize="10" fill={C.textMuted} fontFamily={MONO}>
                {row[xKey]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({ segments, size = 140, centerLabel, centerSub }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = size / 2 - 12;
  const circumference = 2 * Math.PI * radius;

  // Arc lengths and their running start offsets, computed up front so the JSX
  // below stays a pure map with nothing accumulating during render.
  const arcs = segments.reduce((acc, segment) => {
    const length = (segment.value / total) * circumference;
    const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].length : 0;
    acc.push({ ...segment, length, start });
    return acc;
  }, []);

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Severity mix">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {arcs.map((arc) => (
          <circle
            key={arc.label}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth="14"
            strokeDasharray={`${arc.length} ${circumference - arc.length}`}
            strokeDashoffset={-arc.start}
          />
        ))}
      </g>
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fontSize="20" fontWeight="800" fill={C.text}>
        {centerLabel}
      </text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fontSize="10" fill={C.textSecondary}>
        {centerSub}
      </text>
    </svg>
  );
}

export function Sparkline({ points, height = 60, threshold }) {
  const width = 260;
  const values = points.map((p) => p.pct);
  const min = Math.min(...values, threshold ?? 100) - 4;
  const max = Math.max(...values, 100);
  const scaleX = (i) => (i / (points.length - 1)) * (width - 8) + 4;
  const scaleY = (v) => height - 6 - ((v - min) / (max - min || 1)) * (height - 16);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(p.pct)}`).join(' ');
  const area = `${path} L ${scaleX(points.length - 1)} ${height} L ${scaleX(0)} ${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="SLA compliance trend">
      {threshold != null && (
        <line x1="0" x2={width} y1={scaleY(threshold)} y2={scaleY(threshold)} stroke={C.borderStrong} strokeWidth="1" strokeDasharray="3 3" />
      )}
      <path d={area} fill={C.primarySoft} />
      <path d={path} fill="none" stroke={C.primary} strokeWidth="2" strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={p.day} cx={scaleX(i)} cy={scaleY(p.pct)} r="2.5" fill={p.pct < (threshold ?? 0) ? C.danger : C.primary} />
      ))}
    </svg>
  );
}

export function MeterRow({ label, value, max, caption, color = C.primary, width = '100%' }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div style={{ marginBottom: 10, width }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, color: C.text }}>{label}</span>
        <span style={{ fontSize: 11.5, color: C.textSecondary, fontFamily: MONO, whiteSpace: 'nowrap' }}>{caption}</span>
      </div>
      <div style={{ height: 6, background: C.surfaceAlt, borderRadius: 3, overflow: 'hidden', border: `1px solid ${C.border}` }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
    </div>
  );
}

export function Funnel({ stages, format }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div>
      {stages.map((stage, i) => {
        const pct = Math.max(1.5, (stage.value / max) * 100);
        const tint = [C.primary, C.primaryStrong, C.info, C.warning, C.success][i] || C.primary;
        return (
          <div key={stage.stage} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 12.5, color: C.text }}>{stage.stage}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: C.text, fontFamily: MONO }}>{format(stage.value)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: C.surfaceAlt, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: tint }} />
            </div>
            {stage.note && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{stage.note}</div>}
          </div>
        );
      })}
    </div>
  );
}
