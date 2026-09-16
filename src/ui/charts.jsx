import { C, MONO } from '../theme.js';

// Hand-rolled SVG charts rather than a charting dependency: the whole project
// runs offline with no third-party calls, and these are four shapes, not a
// library's worth. Everything scales through viewBox so the cards stay
// responsive, and every colour comes from a theme token so light mode works.

import { BAND_COLORS, CHART_COLORS } from '../theme.js';

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
              return <rect key={key} x={x} y={y} width={barWidth} height={h} fill={CHART_COLORS[key]} rx="1" />;
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

// Points may carry a null pct, meaning "not measured yet" — today, before the
// analyst has closed anything. A pending point is drawn as a hollow marker on
// the target line with a dashed connector, rather than being plotted at zero or
// quietly dropped: the gap is the honest rendering of a shift in progress.
export function Sparkline({ points, height = 60, threshold }) {
  const width = 260;
  const known = points.filter((p) => p.pct != null);
  if (!known.length) return null;

  const values = known.map((p) => p.pct);
  const min = Math.min(...values, threshold ?? 100) - 4;
  const max = Math.max(...values, 100);
  const scaleX = (i) => (i / (points.length - 1)) * (width - 8) + 4;
  const scaleY = (v) => height - 6 - ((v - min) / (max - min || 1)) * (height - 16);

  const plotted = points.map((p, i) => ({ ...p, i })).filter((p) => p.pct != null);
  const path = plotted.map((p, n) => `${n === 0 ? 'M' : 'L'} ${scaleX(p.i)} ${scaleY(p.pct)}`).join(' ');
  const last = plotted[plotted.length - 1];
  const area = `${path} L ${scaleX(last.i)} ${height} L ${scaleX(plotted[0].i)} ${height} Z`;
  const pending = points.map((p, i) => ({ ...p, i })).filter((p) => p.pct == null);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="SLA compliance trend">
      {threshold != null && (
        <line x1="0" x2={width} y1={scaleY(threshold)} y2={scaleY(threshold)} stroke={C.borderStrong} strokeWidth="1" strokeDasharray="3 3" />
      )}
      <path d={area} fill={C.primarySoft} />
      <path d={path} fill="none" stroke={C.primary} strokeWidth="2" strokeLinejoin="round" />
      {pending.map((p) => (
        <g key={`pending-${p.day}`}>
          <line
            x1={scaleX(last.i)} y1={scaleY(last.pct)}
            x2={scaleX(p.i)} y2={scaleY(threshold ?? last.pct)}
            stroke={C.borderStrong} strokeWidth="1.5" strokeDasharray="2 3"
          />
          <circle cx={scaleX(p.i)} cy={scaleY(threshold ?? last.pct)} r="3" fill={C.surface} stroke={C.borderStrong} strokeWidth="1.5" />
        </g>
      ))}
      {plotted.map((p) => (
        <circle key={p.day} cx={scaleX(p.i)} cy={scaleY(p.pct)} r="2.5" fill={p.pct < (threshold ?? 0) ? C.danger : C.primary} />
      ))}
    </svg>
  );
}

function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

// Sweeping from 180deg (left) down to 0deg (right) traces the top half of the
// circle clockwise on screen, so sweep-flag is always 1 here.
function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarPoint(cx, cy, r, startAngle);
  const end = polarPoint(cx, cy, r, endAngle);
  const largeArc = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

// A speedometer-style gauge — the shape every SIEM vendor dashboard (XSIAM,
// Sentinel, Splunk ES) reaches for when a KPI has a "good end" and a "bad end".
// Bands default to the vivid red/orange/yellow/green --band-* ramp. It shares
// its hue order with severity badges and the bar chart, so a glance at the
// needle reads the same way, but it stays fully saturated: these are thin arcs
// that have to carry meaning at a glance, not large fills.
export function Gauge({ value, max = 100, unit = '', bands, size = 148, label }) {
  const W = 200, H = 150, cx = W / 2, cy = 100, r = 74, strokeWidth = 15;
  const clamped = Math.max(0, Math.min(max, value));
  const useBands = bands || [
    { upTo: max * 0.5, color: BAND_COLORS.critical },
    { upTo: max * 0.75, color: BAND_COLORS.high },
    { upTo: max * 0.9, color: BAND_COLORS.medium },
    { upTo: max, color: BAND_COLORS.low },
  ];

  const segments = useBands.reduce((acc, b) => {
    const prevUpTo = acc.length ? acc[acc.length - 1].upTo : 0;
    acc.push({ upTo: b.upTo, color: b.color, startAngle: 180 - (prevUpTo / max) * 180, endAngle: 180 - (b.upTo / max) * 180 });
    return acc;
  }, []);

  const activeColor = (useBands.find((b) => clamped <= b.upTo) || useBands[useBands.length - 1]).color;
  const needle = polarPoint(cx, cy, r - 8, 180 - (clamped / max) * 180);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={(size * H) / W} role="img" aria-label={label}>
      {segments.map((s, i) => (
        <path key={i} d={arcPath(cx, cy, r, s.startAngle, s.endAngle)} fill="none" stroke={s.color} strokeWidth={strokeWidth} />
      ))}
      <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={C.text} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill={C.text} />
      <text x={cx} y={cy + 30} textAnchor="middle" fontSize="26" fontWeight="800" fill={activeColor}>
        {Math.round(clamped)}{unit}
      </text>
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
