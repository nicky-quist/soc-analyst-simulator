import { C, TONE } from '../theme.js';
import { isResolvedCorrectly } from '../engine/scoring.js';
import { generateCisoResponse, generateCeoResponse } from '../engine/personas.js';
import { Badge, Button, Callout, Card, Metric, PersonaMessage, SectionLabel } from '../ui/primitives.jsx';
import { formatDuration } from '../ui/helpers.js';

function coverageTone(coverage) {
  if (coverage === 1) return TONE.positive;
  return coverage >= 0.5 ? TONE.coaching : TONE.concerned;
}

export default function DebriefTab({ scenario, result, onRetry }) {
  const { submission, score } = result;
  const ciso = generateCisoResponse(scenario, submission, score);
  const ceo = generateCeoResponse(scenario, submission);
  const resolved = isResolvedCorrectly(score);
  const tone = resolved ? TONE.positive : TONE.coaching;
  const { investigation, response } = score;
  const target = scenario.truth.responseTargetMinutes;

  return (
    <div>
      <Card tone={tone} style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: tone.fg }}>
            {resolved ? '✓ Resolved correctly' : '⚠ Needs improvement'}
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textSecondary, textAlign: 'right', letterSpacing: 0.5 }}>CASE SCORE</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: tone.fg, textAlign: 'right' }}>
              {score.overallScore}<span style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary }}>/100</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Badge label={`Classification ${score.classificationCorrect ? '✓' : '✗'}`} tone={score.classificationCorrect ? TONE.positive : TONE.concerned} />
          <Badge label={`Escalation ${score.escalationCorrect ? '✓' : '✗'}`} tone={score.escalationCorrect ? TONE.positive : TONE.concerned} />
          <Badge
            label={score.severityCorrect ? 'Severity ✓' : `Severity ✗ (${scenario.truth.severity})`}
            tone={score.severityCorrect ? TONE.positive : score.severityCredit > 0 ? TONE.coaching : TONE.concerned}
            title={score.severityCredit === 0.5 ? 'One step off — half credit' : undefined}
          />
          <Badge
            label={`ATT&CK ${score.mitreCorrect ? '✓' : '✗'}`}
            tone={score.mitreCorrect ? TONE.positive : TONE.concerned}
            title={score.mitreCorrect ? undefined : `Expected ${scenario.truth.mitreTechnique}`}
          />
          {score.assisted && <Badge label="Assisted — Learn Mode" tone={TONE.neutral} />}
          {result.attempt > 1 && <Badge label={`Attempt ${result.attempt}`} tone={TONE.neutral} />}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <Metric
          label="Investigation"
          value={`${investigation.completedCount}/${investigation.requiredCount} key checks`}
          tone={coverageTone(investigation.coverage)}
          hint={investigation.missed.length ? `Decided without: ${investigation.missed.join('; ')}` : 'You worked every check this alert called for.'}
        />
        <Metric
          label="Response"
          value={`${response.completedCount}/${response.requiredCount} actions`}
          tone={response.harmful.length ? TONE.concerned : response.missing.length ? TONE.coaching : TONE.positive}
          hint={
            response.harmful.length
              ? `Caused harm: ${response.harmful.map((a) => a.label).join('; ')}`
              : response.missing.length
                ? `Not done: ${response.missing.join('; ')}`
                : 'Containment matched the finding.'
          }
        />
        <Metric
          label="Time to decision"
          value={formatDuration(score.elapsedMs)}
          tone={score.withinResponseTarget === null ? undefined : score.withinResponseTarget ? TONE.positive : TONE.coaching}
          hint={target ? `Time-sensitive alert — target is under ${target} min.` : 'No response-time target on this alert type.'}
        />
        <Metric
          label="Search efficiency"
          value={`${investigation.noiseSearches} empty`}
          tone={investigation.noiseSearches >= 6 ? TONE.coaching : undefined}
          hint="Searches that returned nothing — mistyped indicators, wrong index, or too narrow a window."
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <SectionLabel>Response thread</SectionLabel>
        {ciso && <PersonaMessage persona={ciso} />}
        {ceo && <PersonaMessage persona={ceo} />}
        {response.harmful.map((action) => action.consequence && (
          <PersonaMessage key={action.id} persona={action.consequence} />
        ))}
      </div>

      <Card style={{ padding: 20, marginBottom: 16 }}>
        <SectionLabel>Report checklist — {score.matchedCount}/{score.scorableCount} covered</SectionLabel>
        {score.rubricResults.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: r.matched ? C.text : C.textSecondary, marginBottom: 8, lineHeight: 1.55 }}>
            <span style={{ color: r.matched ? C.success : C.textMuted, flexShrink: 0 }}>{r.matched ? '✓' : '○'}</span>
            <span>
              {r.point}
              {r.kind === 'avoid' && <span style={{ color: C.textMuted, fontSize: 12 }}> &nbsp;(what you avoided writing)</span>}
            </span>
          </div>
        ))}
      </Card>

      <Card tone={TONE.business} style={{ padding: 20, marginBottom: 16 }}>
        <SectionLabel>Debrief</SectionLabel>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.75 }}>{scenario.debrief}</div>
      </Card>

      <Button onClick={onRetry} style={{ width: '100%' }}>↺ &nbsp;Reopen this alert and work it again</Button>
    </div>
  );
}

export function ShiftSummary({ summary, onReset }) {
  const tone = TONE[summary.persona.tone] || TONE.coaching;
  return (
    <Card tone={tone} style={{ padding: 20, marginBottom: 20 }}>
      <SectionLabel>End of shift — review</SectionLabel>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <Metric label="Resolved correctly" value={`${summary.resolved}/${summary.total}`} />
        <Metric label="Average score" value={summary.avgScore} />
        <Metric label="Missed escalations" value={summary.missedEscalations} tone={summary.missedEscalations ? TONE.concerned : undefined} />
        <Metric label="Harmful actions" value={summary.harmfulActions} tone={summary.harmfulActions ? TONE.concerned : undefined} />
        <Metric label="Investigation" value={`${Math.round(summary.investigationCoverage * 100)}%`} hint="Key searches and lookups run before deciding." />
      </div>
      <PersonaMessage persona={summary.persona} />
      <Callout tone={TONE.neutral} style={{ marginBottom: 14 }}>
        Alerts stay reopenable — the point of a second pass is to work the evidence properly, not to hunt for the score.
      </Callout>
      <Button onClick={onReset} style={{ width: '100%' }}>Start a fresh shift (clears saved progress)</Button>
    </Card>
  );
}
