// Your record across shifts: which calls you get right, which you keep
// missing, and what the next shift will do about it.
//
// Everything here is computed from engine/progress.js. This component only
// lays it out, so the numbers on screen are the same numbers the tests check.

import { useMemo, useState } from 'react';
import { SCENARIOS } from '../data/scenarios/index.js';
import {
  MIN_ATTEMPTS, escalationTendency, planFocus, skillSummary, weakestSkill,
} from '../engine/progress.js';
import { C, MONO, TONE } from '../theme.js';
import { Badge, Button, Callout, Metric } from '../ui/primitives.jsx';
import { MeterRow, Sparkline } from '../ui/charts.jsx';
import { IconActivity, IconListChecks, IconSwap, IconTarget } from '../ui/icons.jsx';
import { Panel } from './Dashboard.jsx';

const byId = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));
const pct = (value) => `${Math.round(value * 100)}%`;

function rateColor(rate) {
  if (rate == null) return C.borderStrong;
  if (rate >= 0.8) return C.success;
  if (rate >= 0.6) return C.warning;
  return C.danger;
}

function trendText(trend) {
  if (trend == null) return '';
  const points = Math.round(trend * 100);
  if (points === 0) return ' · steady';
  return ` · ${points > 0 ? '▲' : '▼'} ${Math.abs(points)} pts recently`;
}

export default function ProgressView({ progress, currentFocus, onToggleAdaptive, onClearHistory }) {
  const { history, adaptive } = progress;
  const summary = useMemo(() => skillSummary(history), [history]);
  const weak = useMemo(() => weakestSkill(summary), [summary]);
  const tendency = useMemo(() => escalationTendency(history), [history]);
  const nextFocus = useMemo(() => planFocus(history, SCENARIOS), [history]);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const shifts = new Set(history.map((r) => r.key.split(':').slice(0, 2).join(':'))).size;
  const resolved = history.filter((r) => r.resolved).length;
  const avgScore = history.length
    ? Math.round(history.reduce((sum, r) => sum + r.overallScore, 0) / history.length)
    : null;
  const trendPoints = history.slice(-20).map((r, i) => ({ day: i, pct: r.overallScore }));

  const topScenarios = nextFocus
    ? Object.entries(nextFocus.weights)
      .filter(([id]) => nextFocus.reasons[id])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
    : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Your progress</h1>
        <span style={{ fontSize: 12.5, color: C.textSecondary }}>across every shift on this browser</span>
      </div>
      <p style={{ fontSize: 12.5, color: C.textMuted, margin: '0 0 14px', lineHeight: 1.55, maxWidth: 760 }}>
        Only your first attempt at each case counts, and not if Learn mode was open. A retry comes after the debrief
        has shown you the answer. Rates are smoothed, and a skill needs {MIN_ATTEMPTS} scored cases before it can be
        called a weak spot, so one bad case won't reshape your next shift.
      </p>

      {history.length === 0 ? (
        <Callout tone={TONE.neutral} title="Nothing recorded yet">
          Close a case from the alert queue and it will show up here. After a few shifts, this page will show which
          calls you keep missing, and the next shift's queue will lean toward practising them.
        </Callout>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            <Metric label="Cases scored" value={history.length} hint={`over ${shifts} shift${shifts === 1 ? '' : 's'}`} />
            <Metric
              label="Resolved correctly"
              value={pct(resolved / history.length)}
              hint={`${resolved} of ${history.length}`}
              tone={resolved / history.length >= 0.7 ? TONE.positive : TONE.coaching}
            />
            <Metric label="Average score" value={`${avgScore}/100`} />
            <Metric
              label="Weakest skill"
              value={weak ? weak.label : 'None yet'}
              hint={weak ? `${weak.correct} of ${weak.attempts} right` : `needs ${MIN_ATTEMPTS}+ scored cases per skill`}
              tone={weak ? TONE.coaching : undefined}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: 14 }}>
            <Panel title="Skills" icon={<IconListChecks size={14} />} hint="first attempts">
              {summary.map((skill) => (
                <MeterRow
                  key={skill.id}
                  label={weak?.id === skill.id ? `${skill.label} (weakest)` : skill.label}
                  value={skill.rate == null ? 0 : skill.rate * 100}
                  max={100}
                  color={rateColor(skill.rate)}
                  caption={skill.attempts
                    ? `${skill.correct}/${skill.attempts} · ${pct(skill.rate)}${trendText(skill.trend)}`
                    : 'not tested yet'}
                />
              ))}
            </Panel>

            <Panel title="Score over time" icon={<IconActivity size={14} />} hint={`last ${trendPoints.length}`}>
              {trendPoints.length >= 2 ? (
                <>
                  <Sparkline points={trendPoints} threshold={70} ariaLabel="Case score trend" />
                  <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 6 }}>
                    Dashed line: 70, the minimum for a case to count as resolved correctly.
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: C.textMuted }}>Close one more case to see a trend.</div>
              )}
            </Panel>

            <Panel title="Escalation calls" icon={<IconSwap size={14} />} hint={`${tendency.total} cases`}>
              <MeterRow label="Under-escalated" value={tendency.under} max={tendency.total} color={C.danger}
                caption={`${tendency.under} of ${tendency.total}`} />
              <MeterRow label="Correct" value={tendency.correct} max={tendency.total} color={C.success}
                caption={`${tendency.correct} of ${tendency.total}`} />
              <MeterRow label="Over-escalated" value={tendency.over} max={tendency.total} color={C.warning}
                caption={`${tendency.over} of ${tendency.total}`} />
              <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 4, lineHeight: 1.5 }}>
                Under-escalated: closed or kept at a lower tier when it needed to go further. Over-escalated: sent up
                when it should have been closed.{' '}
                {tendency.direction === 'under' && 'Your misses lean toward not escalating. In a real SOC that is the costlier direction: it is how incidents get missed.'}
                {tendency.direction === 'over' && 'Your misses lean toward escalating too much. It is safer than the opposite, but it floods Tier 2 and IR with work that should have been closed.'}
                {!tendency.direction && 'No consistent lean either way yet.'}
              </div>
            </Panel>

            <Panel title="Next shift" icon={<IconTarget size={14} />} hint={adaptive ? 'adaptive deal on' : 'adaptive deal off'}>
              {currentFocus && (
                <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 10 }}>
                  This shift is already weighted toward <strong>{currentFocus.label}</strong>. Changes here apply from the next shift.
                </div>
              )}

              {!adaptive && (
                <Callout tone={TONE.neutral} title="Adaptive deal is off">
                  The next shift is dealt the normal way. The mix quotas still apply.
                </Callout>
              )}

              {adaptive && nextFocus && (
                <Callout tone={TONE.coaching} title={`Next shift practises: ${nextFocus.label}`}>
                  {nextFocus.summary} Scenarios that exercise it are more likely to be dealt. It's a weighting, not a
                  filter: every shift still has something to close, something for IR, and work for Tier 2.
                </Callout>
              )}

              {adaptive && !nextFocus && (
                <Callout tone={TONE.positive} title="No weak spot to target">
                  {history.length < MIN_ATTEMPTS
                    ? `Close at least ${MIN_ATTEMPTS} cases before the deal starts adapting.`
                    : 'No skill is consistently below 75%, so the next shift is dealt the normal way.'}
                </Callout>
              )}

              {topScenarios.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    More likely to be dealt
                  </div>
                  {topScenarios.map(([id, weight]) => (
                    <div key={id} style={{ display: 'flex', gap: 8, alignItems: 'baseline', padding: '6px 0', borderTop: `1px solid ${C.border}` }}>
                      <Badge label={`${weight}×`} tone={TONE.primary} style={{ fontFamily: MONO }} />
                      <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                        <div style={{ color: C.text }}>{byId[id]?.queueLabel ?? id}</div>
                        <div style={{ color: C.textMuted }}>{nextFocus.reasons[id]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                <Button onClick={onToggleAdaptive} variant="secondary">
                  {adaptive ? 'Turn adaptive deal off' : 'Turn adaptive deal on'}
                </Button>
                {!confirmingClear ? (
                  <Button onClick={() => setConfirmingClear(true)} variant="ghost">Clear history</Button>
                ) : (
                  <>
                    <Button
                      variant="danger"
                      onClick={() => { onClearHistory(); setConfirmingClear(false); }}
                    >
                      Delete {history.length} records
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmingClear(false)}>Cancel</Button>
                  </>
                )}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
