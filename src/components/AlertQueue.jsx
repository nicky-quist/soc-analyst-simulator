import { C, FONT, MONO, TONE, severityTone } from '../theme.js';
import { isResolvedCorrectly } from '../engine/scoring.js';
import { Badge } from '../ui/primitives.jsx';
import { caseStatus, slaState } from '../engine/case.js';

const STATUS = {
  new: { label: 'New', tone: TONE.primary },
  in_progress: { label: 'In progress', tone: TONE.coaching },
  closed: { label: 'Closed', tone: TONE.neutral },
};


function shortSla(ms) {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function AlertQueue({ scenarios, currentId, cases, now, onSelect }) {
  const closed = scenarios.filter((s) => cases[s.id]?.result).length;

  return (
    <nav className="sim-queue" aria-label="Shift alert queue">
      <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: 0.4 }}>SHIFT QUEUE</div>
        <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 2 }}>
          {scenarios.length - closed} open · {closed} closed
        </div>
      </div>

      {scenarios.map((scenario, index) => {
        const caseFile = cases[scenario.id];
        const status = caseStatus(caseFile);
        const isActive = scenario.id === currentId;
        const sla = slaState(scenario, caseFile, now);
        const result = caseFile?.result;
        const ok = result && isResolvedCorrectly(result.score);

        return (
          <button
            key={scenario.id}
            type="button"
            onClick={() => onSelect(index)}
            aria-current={isActive ? 'true' : undefined}
            style={{
              display: 'block', width: '100%', textAlign: 'left', fontFamily: FONT, cursor: 'pointer',
              background: isActive ? C.surfaceRaised : 'transparent',
              borderTop: 'none', borderRight: 'none',
              borderLeft: `3px solid ${isActive ? C.primary : 'transparent'}`,
              borderBottom: `1px solid ${C.border}`,
              padding: '12px 14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: C.textMuted }}>
                {scenario.alert.ref}
              </span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                <Badge label={STATUS[status].label} tone={STATUS[status].tone} />
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <Badge label={scenario.alert.reportedSeverity} tone={severityTone(scenario.alert.reportedSeverity)} />
              {status !== 'closed' && (
                <Badge
                  label={sla.breached ? 'SLA breached' : `SLA ${shortSla(sla.remaining)}`}
                  tone={sla.breached ? TONE.concerned : sla.remaining < 5 * 60_000 ? TONE.coaching : TONE.neutral}
                  title={`Response target ${sla.total} minutes`}
                />
              )}
              {result && <Badge label={ok ? 'Resolved' : 'Review'} tone={ok ? TONE.positive : TONE.coaching} />}
              {result && result.score.response.harmful.length > 0 && <Badge label="Harm" tone={TONE.concerned} />}
            </div>

            <div style={{ fontSize: 12.5, color: C.text, fontWeight: 500, lineHeight: 1.4, marginBottom: 3 }}>
              {scenario.queueLabel}
            </div>
            <div style={{ fontSize: 11.5, color: C.textSecondary }}>{scenario.source}</div>
          </button>
        );
      })}
    </nav>
  );
}
