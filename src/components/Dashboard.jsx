import { useEffect, useMemo, useState } from 'react';
import { BAND_COLORS, C, CHART_COLORS, MONO, TONE, severityTone } from '../theme.js';
import {
  AUTOMATION_FUNNEL, DETECTION_SOURCES, ESTATE_FEED, SLA_TARGET, TACTIC_COVERAGE,
  TOP_ENTITIES, buildHourlyVolume, buildShift, buildSlaTrend, formatCount, funnelTotals, withToday,
} from '../data/estate.js';
import { caseStatus, shiftCompliance, slaState } from '../engine/case.js';
import { isResolvedCorrectly } from '../engine/scoring.js';
import { Badge, Callout, Card, SectionLabel } from '../ui/primitives.jsx';
import { formatDuration } from '../ui/helpers.js';
import { Donut, Funnel, Gauge, MeterRow, Sparkline, StackedBars } from '../ui/charts.jsx';
import {
  IconActivity, IconClock, IconFilter, IconInbox, IconListChecks, IconPieChart,
  IconRadio, IconServer, IconTarget, IconTrendingUp, IconUsers,
} from '../ui/icons.jsx';

function Tile({ label, value, sub, tone, icon }) {
  return (
    <div className="sim-tile" style={{
      background: C.surface,
      border: `1px solid ${tone ? tone.border : C.border}`,
      borderTop: `2px solid ${tone ? tone.fg : C.borderStrong}`,
      borderRadius: 8,
      padding: '14px 16px',
      boxShadow: C.shadow,
      display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
          {label}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: tone ? tone.fg : C.text, marginTop: 6, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
        <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 5, lineHeight: 1.4, minHeight: 16 }}>{sub || ' '}</div>
      </div>
      {icon && (
        <div style={{ color: tone ? tone.fg : C.textMuted, opacity: 0.75, flexShrink: 0 }}>
          {icon}
        </div>
      )}
    </div>
  );
}

export function Panel({ title, icon, hint, children, style }) {
  return (
    <Card accent={C.primary} style={{ padding: 16, ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${C.border}` }}>
        <SectionLabel icon={icon} style={{ marginBottom: 0 }}>{title}</SectionLabel>
        {hint && <span style={{ fontSize: 11, color: C.textMuted, fontFamily: MONO, lineHeight: 1 }}>{hint}</span>}
      </div>
      {children}
    </Card>
  );
}

function GaugeCard({ label, value, hint, bands, unit = '%' }) {
  return (
    <div style={{ flex: '1 1 150px', textAlign: 'center', minWidth: 140 }}>
      <Gauge value={value} unit={unit} bands={bands} label={label} />
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{label}</div>
      <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 2, minHeight: 14 }}>{hint || ' '}</div>
    </div>
  );
}

const SCORE_BANDS = [
  { upTo: 50, color: BAND_COLORS.critical },
  { upTo: 70, color: BAND_COLORS.high },
  { upTo: 85, color: BAND_COLORS.medium },
  { upTo: 100, color: BAND_COLORS.low },
];

const SLA_BANDS = [
  { upTo: 70, color: BAND_COLORS.critical },
  { upTo: 80, color: BAND_COLORS.high },
  { upTo: SLA_TARGET, color: BAND_COLORS.medium },
  { upTo: 100, color: BAND_COLORS.low },
];

function Legend({ items }) {
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
      {items.map((item) => (
        <span key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: C.textSecondary }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: item.color, display: 'inline-block' }} />
          {item.label}{item.value != null && ` · ${item.value}`}
        </span>
      ))}
    </div>
  );
}

export default function Dashboard({ scenarios, cases, now, shiftStartedAt, deal = 0, focus = null, onOpenAlert }) {
  const [feedTick, setFeedTick] = useState(0);

  // Everything estate-side is a function of the shift seed, so it is stable for
  // as long as you are sitting in this shift and different the next one.
  const seedAt = shiftStartedAt ?? now;
  const shiftHeader = useMemo(() => buildShift(seedAt, deal), [seedAt, deal]);
  const hourlyVolume = useMemo(() => buildHourlyVolume(seedAt, deal), [seedAt, deal]);
  const week = useMemo(() => buildSlaTrend(seedAt, deal), [seedAt, deal]);

  useEffect(() => {
    const id = setInterval(() => setFeedTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);

  const closed = scenarios.filter((s) => cases[s.id]?.result);
  const inProgress = scenarios.filter((s) => caseStatus(cases[s.id]) === 'in_progress');
  const open = scenarios.filter((s) => !cases[s.id]?.result);
  const breaches = scenarios.filter((s) => slaState(s, cases[s.id], now).breached);
  const resolvedWell = closed.filter((s) => isResolvedCorrectly(cases[s.id].result.score));

  const avgScore = closed.length
    ? Math.round(closed.reduce((sum, s) => sum + cases[s.id].result.score.overallScore, 0) / closed.length)
    : null;
  const mttr = closed.length
    ? closed.reduce((sum, s) => sum + (cases[s.id].result.score.elapsedMs || 0), 0) / closed.length
    : null;

  const severityCounts = open.reduce((acc, s) => {
    const key = s.alert.reportedSeverity.toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const donutSegments = ['critical', 'high', 'medium', 'low', 'informational']
    .filter((key) => severityCounts[key])
    .map((key) => ({ label: key.toUpperCase(), value: severityCounts[key], color: CHART_COLORS[key] }));

  const dayTotal = hourlyVolume.reduce((sum, h) => sum + h.critical + h.high + h.medium + h.low, 0);
  const maxSource = Math.max(...DETECTION_SOURCES.map((s) => s.alerts));

  // Today's compliance is yours, not the estate's: it is the one number on this
  // board that moves because of what you do in the next twenty minutes.
  const compliance = shiftCompliance(scenarios, cases, now);
  const slaTrend = withToday(week, compliance.pct);
  const complianceHint = compliance.handled
    ? `${compliance.onTime} of ${compliance.handled} handled within target`
    : 'nothing closed or breached yet';

  const feed = Array.from({ length: 6 }, (_, i) => ESTATE_FEED[(feedTick + i) % ESTATE_FEED.length]);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 14 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Shift overview</h1>
        <span style={{ fontSize: 12.5, color: C.textSecondary }}>{shiftHeader.label} · {shiftHeader.window}</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.textMuted }}>{shiftHeader.onCall}</span>
      </div>

      {/* Said out loud, because a queue that quietly leans one way reads as luck. */}
      {focus && (
        <Callout tone={TONE.primary} title={`This shift leans toward practising ${focus.label.toLowerCase()}`} style={{ marginBottom: 14 }}>
          {focus.summary} The mix quotas still apply. See Your progress for why.
        </Callout>
      )}

      <div className="sim-tile-row">
        <Tile label="Open alerts" value={open.length} sub={`${inProgress.length} being worked`} tone={open.length ? TONE.primary : undefined} icon={<IconInbox size={18} />} />
        <Tile label="Closed" value={closed.length} sub={`${resolvedWell.length} resolved correctly`} icon={<IconListChecks size={18} />} />
        <Tile label="SLA breaches" value={breaches.length} sub={complianceHint} tone={breaches.length ? TONE.concerned : TONE.positive} icon={<IconClock size={18} />} />
        <Tile label="Avg case score" value={avgScore ?? '—'} sub={avgScore == null ? 'no cases closed yet' : 'this shift'} tone={avgScore == null ? undefined : avgScore >= 70 ? TONE.positive : TONE.coaching} icon={<IconTarget size={18} />} />
        <Tile label="MTTR" value={mttr == null ? '—' : formatDuration(mttr)} sub="mean time to resolve" icon={<IconClock size={18} />} />
        <Tile label="Alerts today" value={formatCount(dayTotal)} sub="estate-wide, all severities" icon={<IconActivity size={18} />} />
      </div>

      <div className="sim-dash-grid">
        <Panel title="Shift performance" icon={<IconTrendingUp size={13} />} hint="green is good, red needs attention" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around', gap: 12 }}>
            <GaugeCard
              label="SLA compliance"
              value={compliance.pct ?? 100}
              hint={compliance.handled ? complianceHint : `target ${SLA_TARGET}% — nothing handled yet`}
              bands={SLA_BANDS}
            />
            <GaugeCard
              label="Avg case score"
              value={avgScore ?? 0}
              hint={avgScore == null ? 'no cases closed yet' : 'this shift'}
              bands={SCORE_BANDS}
            />
            <GaugeCard
              label="Resolved correctly"
              value={closed.length ? Math.round((resolvedWell.length / closed.length) * 100) : 0}
              hint={closed.length ? `${resolvedWell.length}/${closed.length} closed cases` : 'no cases closed yet'}
              bands={SCORE_BANDS}
            />
          </div>
        </Panel>

        <Panel title="Alert volume — last 24 hours" icon={<IconActivity size={13} />} hint={`${formatCount(dayTotal)} alerts`} style={{ gridColumn: 'span 2' }}>
          <StackedBars data={hourlyVolume} keys={['low', 'medium', 'high', 'critical']} height={150} />
          <Legend items={[
            { label: 'Critical', color: CHART_COLORS.critical, value: hourlyVolume.reduce((s, h) => s + h.critical, 0) },
            { label: 'High', color: CHART_COLORS.high, value: hourlyVolume.reduce((s, h) => s + h.high, 0) },
            { label: 'Medium', color: CHART_COLORS.medium, value: hourlyVolume.reduce((s, h) => s + h.medium, 0) },
            { label: 'Low', color: CHART_COLORS.low, value: hourlyVolume.reduce((s, h) => s + h.low, 0) },
          ]} />
        </Panel>

        <Panel title="Open alerts requiring action" icon={<IconListChecks size={13} />} hint="click to work one" style={{ gridColumn: 'span 2' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>
                  {['Alert', 'Severity', 'Rule', 'Source', 'SLA', 'Status'].map((h) => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '6px 10px', color: C.textSecondary, fontWeight: 700, fontSize: 10.5,
                      textTransform: 'uppercase', letterSpacing: 0.4, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scenarios.map((scenario, index) => {
                  const caseFile = cases[scenario.id];
                  const status = caseStatus(caseFile);
                  const sla = slaState(scenario, caseFile, now);
                  const result = caseFile?.result;
                  return (
                    <tr
                      key={scenario.id}
                      onClick={() => onOpenAlert(index)}
                      style={{ cursor: 'pointer' }}
                      title="Open this alert"
                    >
                      <td style={{ padding: '7px 10px', borderBottom: `1px solid ${C.border}`, fontFamily: MONO, fontSize: 11.5, color: C.primaryStrong, whiteSpace: 'nowrap' }}>
                        {scenario.alert.ref}
                      </td>
                      <td style={{ padding: '7px 10px', borderBottom: `1px solid ${C.border}` }}>
                        <Badge label={scenario.alert.reportedSeverity} tone={severityTone(scenario.alert.reportedSeverity)} />
                      </td>
                      <td style={{ padding: '7px 10px', borderBottom: `1px solid ${C.border}`, color: C.text, minWidth: 220 }}>{scenario.alert.rule}</td>
                      <td style={{ padding: '7px 10px', borderBottom: `1px solid ${C.border}`, color: C.textSecondary, whiteSpace: 'nowrap' }}>{scenario.source}</td>
                      <td style={{
                        padding: '7px 10px', borderBottom: `1px solid ${C.border}`, fontFamily: MONO, whiteSpace: 'nowrap',
                        color: status === 'closed' ? C.textMuted : sla.breached ? C.danger : C.textSecondary,
                      }}>
                        {status === 'closed'
                          ? '—'
                          : sla.breached
                            ? <Badge label="Breached" tone={TONE.concerned} />
                            : `${Math.floor(sla.remaining / 60000)}m left`}
                      </td>
                      <td style={{ padding: '7px 10px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                        {result
                          ? <Badge label={isResolvedCorrectly(result.score) ? 'Resolved' : 'Review'} tone={isResolvedCorrectly(result.score) ? TONE.positive : TONE.coaching} />
                          : <Badge label={status === 'in_progress' ? 'In progress' : 'New'} tone={status === 'in_progress' ? TONE.coaching : TONE.primary} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Alert pipeline — today" icon={<IconFilter size={13} />} hint="before a human sees anything">
          <Funnel stages={funnelTotals(scenarios.length)} format={formatCount} />
          <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.55, marginTop: 6 }}>
            {formatCount(AUTOMATION_FUNNEL[0].value)} events became {AUTOMATION_FUNNEL[1].value} alerts, of which
            {' '}{Math.round((AUTOMATION_FUNNEL[2].value / AUTOMATION_FUNNEL[1].value) * 100)}% were closed by automation
            before anyone read them. Your queue is what survived that.
          </div>
        </Panel>

        <Panel title="ATT&CK detection coverage" icon={<IconTarget size={13} />} hint="by tactic">
          {TACTIC_COVERAGE.map((row) => (
            <MeterRow
              key={row.tactic}
              label={row.tactic}
              value={row.pct}
              max={100}
              caption={`${row.pct}%`}
              color={row.pct >= 75 ? C.success : row.pct >= 60 ? C.warning : C.danger}
            />
          ))}
          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 6, lineHeight: 1.55 }}>
            This is why case tools insist on a technique per incident: mapped incidents are what turn into this chart,
            and this chart is what buys the next detection engineer.
          </div>
        </Panel>

        

        <Panel title="Detection sources" icon={<IconServer size={13} />} hint="alerts · auto-closed">
          {DETECTION_SOURCES.map((source) => (
            <MeterRow
              key={source.source}
              label={source.source}
              value={source.alerts}
              max={maxSource}
              caption={`${source.alerts} · ${Math.round((source.autoClosed / source.alerts) * 100)}% auto`}
              color={source.autoClosed / source.alerts > 0.9 ? C.textMuted : C.primary}
            />
          ))}
        </Panel>

        <Panel title="Top entities by alert count" icon={<IconUsers size={13} />} hint="last 24h">
          {TOP_ENTITIES.map((entity) => (
            <div key={entity.entity} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entity.entity}</span>
              <span style={{ fontSize: 11, color: C.textMuted }}>{entity.type}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                <Badge label={entity.risk} tone={severityTone(entity.risk)} />
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.textSecondary }}>{entity.alerts}</span>
              </span>
            </div>
          ))}
        </Panel>

        <Panel title="Your queue by severity" icon={<IconPieChart size={13} />} hint="as reported by the tool">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Donut segments={donutSegments} centerLabel={open.length} centerSub="open" />
            <div style={{ flex: '1 1 120px' }}>
              {donutSegments.map((segment) => (
                <div key={segment.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textSecondary, marginBottom: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: segment.color }} />
                  {segment.label}<span style={{ marginLeft: 'auto', color: C.text, fontFamily: MONO }}>{segment.value}</span>
                </div>
              ))}
              {!donutSegments.length && <div style={{ fontSize: 12.5, color: C.textMuted }}>Queue clear.</div>}
            </div>
          </div>
        </Panel>

        <Panel
          title="SLA compliance — 7 days"
          icon={<IconTrendingUp size={13} />}
          hint={compliance.pct == null ? 'today pending' : `${compliance.pct}% today`}
        >
          <Sparkline points={slaTrend.points} threshold={SLA_TARGET} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, fontFamily: MONO, marginTop: 4 }}>
            {slaTrend.points.map((point) => (
              <span
                key={point.day}
                style={{
                  color: point.pct != null && point.pct < SLA_TARGET ? C.danger : C.textMuted,
                  fontWeight: point.today ? 700 : 400,
                }}
              >
                {point.day}
              </span>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 8, lineHeight: 1.55 }}>
            {slaTrend.caption}{' '}
            {compliance.handled
              ? `Today's point is yours: ${compliance.onTime} of ${compliance.handled} handled within target${compliance.breached ? `, ${compliance.breached} breached` : ''}.`
              : 'Today is empty until you close an alert or let one breach — that point is yours to place.'}
          </div>
        </Panel>

        <Panel title="Estate activity" icon={<IconRadio size={13} />} hint="live tail" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'grid', gap: 6 }}>
            {feed.map((entry, i) => (
              <div key={`${feedTick}-${i}`} style={{
                display: 'flex', gap: 10, alignItems: 'center', fontSize: 12,
                opacity: 1 - i * 0.11, padding: '5px 8px', borderRadius: 4,
                background: i === 0 ? C.surfaceAlt : 'transparent',
                border: `1px solid ${i === 0 ? C.border : 'transparent'}`,
              }}>
                <span style={{
                  fontFamily: MONO, fontSize: 11, color: C.textMuted, whiteSpace: 'nowrap',
                }}>
                  {new Date(now - i * 41_000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span style={{ fontSize: 11, color: C.textSecondary, minWidth: 92 }}>{entry.source}</span>
                <span style={{ color: C.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.text}</span>
                <span style={{ marginLeft: 'auto' }}>
                  <Badge label={entry.level} tone={entry.level === 'medium' ? TONE.coaching : TONE.neutral} />
                </span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 10, lineHeight: 1.55 }}>
            None of these are in your queue. They are the auto-triaged remainder — worth glancing at, because the one
            that matters usually looks exactly like the ones that do not.
          </div>
        </Panel>
      </div>
    </div>
  );
}
