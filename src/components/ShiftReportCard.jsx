// The end-of-shift report card: one page on how the shift went, meant to be read,
// printed or saved as a PDF, and copied as text. It is a full-screen page over the
// console rather than a tab, because it belongs to a moment (the end of a shift)
// and not to a place. The numbers all come from engine/shiftReport.js.

import { useRef, useState } from 'react';
import { formatReportText } from '../engine/shiftReport.js';
import { C, MONO, TONE, severityTone } from '../theme.js';
import { formatDuration } from '../ui/helpers.js';
import { Badge, Button, Callout, Card, Metric, PersonaMessage, SectionLabel } from '../ui/primitives.jsx';
import { IconCheck, IconFileCheck, IconTrophy, IconX } from '../ui/icons.jsx';
import { useDialogFocus } from '../ui/useDialogFocus.js';

const MODES = {
  ended: { badge: 'Shift ended', tone: TONE.primary, close: 'Start next shift' },
  preview: { badge: 'Preview: shift still running', tone: TONE.coaching, close: 'Back to the shift' },
  last: { badge: 'Last shift', tone: TONE.neutral, close: 'Close' },
};

const ESCALATION_TONE = { correct: TONE.positive, under: TONE.concerned, over: TONE.coaching };
const ESCALATION_TEXT = { correct: 'Escalation right', under: 'Under-escalated', over: 'Over-escalated' };
const VERDICT_TONE = { held: TONE.positive, slipped: TONE.concerned, 'n/a': TONE.neutral };
const VERDICT_TEXT = { held: 'Held', slipped: 'Slipped', 'n/a': 'Not tested' };

function CaseRow({ c }) {
  const closed = c.status === 'closed';
  return (
    <div style={{ padding: '11px 0', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 5 }}>
        <code style={{ fontFamily: MONO, fontSize: 11.5, color: C.textMuted }}>{c.ref}</code>
        <strong style={{ fontSize: 13, color: C.text, flex: '1 1 240px', minWidth: 0 }}>{c.label}</strong>
        {closed
          ? <Badge label={`${c.score}/100`} tone={c.resolved ? TONE.positive : TONE.coaching} />
          : <Badge label={c.status === 'new' ? 'Untouched' : 'Still open'} tone={TONE.neutral} />}
      </div>
      {closed ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 12, color: C.textSecondary }}>
          <Badge label={ESCALATION_TEXT[c.escalation]} tone={ESCALATION_TONE[c.escalation]} />
          <span>Sent to {c.escalatedTo}</span>
          <span>·</span>
          <span>
            Severity: tool said <Badge label={c.reportedSeverity} tone={severityTone(c.reportedSeverity)} />
            {' '}you said <Badge label={c.yourSeverity || 'none'} tone={severityTone(c.yourSeverity)} />
            {c.severityCorrect ? '' : <> answer <Badge label={c.trueSeverity} tone={severityTone(c.trueSeverity)} /></>}
          </span>
          <span>·</span>
          <span style={{ fontFamily: MONO }}>
            {formatDuration(c.elapsedMs ?? 0)} of {c.slaMinutes}m {c.slaMet === false ? '(over the clock)' : ''}
          </span>
          {c.harmful > 0 && <Badge label={`${c.harmful} harmful action${c.harmful === 1 ? '' : 's'}`} tone={TONE.concerned} />}
          {c.assisted && <Badge label="Assisted" tone={TONE.neutral} />}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: C.textMuted }}>Reported {c.reportedSeverity}. Carries into the next shift.</div>
      )}
    </div>
  );
}

function StandingRow({ label, entry }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '5px 0', fontSize: 12.5, flexWrap: 'wrap' }}>
      <span style={{ width: 92, color: C.textSecondary, fontWeight: 600 }}>{label}</span>
      <span style={{ color: C.text, flex: '1 1 160px' }}>{entry.label}</span>
      <Badge label={`#${entry.rank} of ${entry.of}`} tone={entry.rank === 1 ? TONE.positive : TONE.neutral} />
    </div>
  );
}

export default function ShiftReportCard({ report, mode = 'last', onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const [copied, setCopied] = useState(false);
  useDialogFocus(dialogRef, onClose, closeRef);
  const m = MODES[mode] || MODES.last;

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatReportText(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable: nothing to do.
    }
  }

  const { counts, sla } = report;
  const anyClosed = counts.closed > 0;

  return (
    <div
      ref={dialogRef}
      className="report-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Shift report"
      style={{ position: 'fixed', inset: 0, zIndex: 940, overflowY: 'auto', background: C.bg }}
    >
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px 56px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ color: C.primaryStrong, display: 'flex' }}><IconFileCheck size={20} /></span>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Shift report</h1>
          <Badge label={m.badge} tone={m.tone} />
        </div>
        <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 16 }}>
          {report.title}{report.window ? ` · ${report.window}` : ''}
        </div>

        <div className="report-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <Button variant="primary" onClick={onClose} ref={closeRef}>{m.close}</Button>
          <Button variant="secondary" onClick={() => window.print()}>Print or save as PDF</Button>
          <Button variant="secondary" onClick={copy}>{copied ? 'Copied' : 'Copy summary'}</Button>
        </div>

        {report.teamLead && (
          <PersonaMessage persona={{ ...report.teamLead, tone: 'business' }} />
        )}
        {!anyClosed && (
          <Callout tone={TONE.neutral} title="No cases were closed this shift" style={{ marginBottom: 16 }}>
            Nothing has been graded yet, so there are no scores or skill results to show. Anything you started carries into the next shift.
          </Callout>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 18 }}>
          <Metric label="Closed" value={`${counts.closed} of ${counts.total}`} />
          <Metric label="Resolved correctly" value={anyClosed ? `${counts.resolved} of ${counts.closed}` : 'n/a'}
            tone={anyClosed && counts.resolved === counts.closed ? TONE.positive : undefined} />
          <Metric label="Average score" value={report.avgScore === null ? 'n/a' : report.avgScore} />
          <Metric label="Time to decision" value={report.mttrMs === null ? 'n/a' : formatDuration(report.mttrMs)} hint="average" />
          <Metric label="SLA" value={sla.pct === null ? 'n/a' : `${sla.pct}%`}
            hint={sla.handled ? `${sla.onTime} on time, ${sla.breached} breached` : 'nothing measured yet'}
            tone={sla.breached ? TONE.coaching : undefined} />
          <Metric label="Harmful actions" value={report.harmfulActions} tone={report.harmfulActions ? TONE.concerned : undefined} />
        </div>

        <Card style={{ padding: 16, marginBottom: 16 }}>
          <SectionLabel>The seven cases</SectionLabel>
          {report.cases.map((c) => <CaseRow key={c.scenarioId} c={c} />)}
        </Card>

        {anyClosed && (
          <Card style={{ padding: 16, marginBottom: 16 }}>
            <SectionLabel>Skills this shift</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
              {report.skills.map((s) => (
                <div key={s.id} style={{ border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 10px', background: C.surfaceAlt }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge
                      label={<>{s.verdict === 'held' ? <IconCheck size={10} /> : s.verdict === 'slipped' ? <IconX size={10} /> : null} {VERDICT_TEXT[s.verdict]}</>}
                      tone={VERDICT_TONE[s.verdict]}
                    />
                    {s.attempts > 0 && <span style={{ fontSize: 12, color: C.textSecondary, fontFamily: MONO }}>{s.correct} of {s.attempts}</span>}
                  </div>
                </div>
              ))}
            </div>
            {report.lean.direction && (
              <Callout tone={TONE.coaching} style={{ marginTop: 12 }}>
                You {report.lean.direction}-escalated {report.lean[report.lean.direction]} of {report.lean.total} closed
                cases. {report.lean.direction === 'under'
                  ? 'Escalation misses are how incidents get missed.'
                  : 'Each needless escalation costs the team time and trust.'}
              </Callout>
            )}
            {report.harmfulActions > 0 && (
              <Callout tone={TONE.concerned} style={{ marginTop: 12 }}>
                {report.harmfulActions} response action{report.harmfulActions === 1 ? '' : 's'} did damage of {report.harmfulActions === 1 ? 'its' : 'their'} own.
                Those come before any score.
              </Callout>
            )}
          </Card>
        )}

        <Card style={{ padding: 16, marginBottom: 16 }}>
          <SectionLabel>Handed off</SectionLabel>
          {report.handoff.length === 0 ? (
            <div style={{ fontSize: 12.5, color: C.textSecondary }}>Nothing to hand off. Every case was closed out cleanly.</div>
          ) : report.handoff.map((h) => (
            <div key={h.ref} style={{ padding: '6px 0', fontSize: 12.5, color: C.text }}>
              <code style={{ fontFamily: MONO, fontSize: 11.5, color: C.textMuted }}>{h.ref}</code>{' '}
              {h.label}<div style={{ color: C.textSecondary, fontSize: 12 }}>{h.status}{h.stillNeeded ? ` · ${h.stillNeeded} thing${h.stillNeeded === 1 ? '' : 's'} still needed` : ''}</div>
            </div>
          ))}
        </Card>

        <Callout tone={TONE.primary} title="Practice next" style={{ marginBottom: 16 }}>
          {report.practiceNext
            ? report.practiceNext.summary
            : 'No weak skill yet, so the next shift is a normal mix.'}
        </Callout>

        {report.standing && (
          <Card style={{ padding: 16 }}>
            <SectionLabel icon={<IconTrophy size={13} />}>Where you stand</SectionLabel>
            <StandingRow label="Blue Team" entry={report.standing.blue} />
            <StandingRow label="Red Team" entry={report.standing.red} />
            <StandingRow label="Fast Triage" entry={report.standing.fast} />
            <StandingRow label="Secrets" entry={report.standing.secrets} />
          </Card>
        )}
      </div>
    </div>
  );
}
