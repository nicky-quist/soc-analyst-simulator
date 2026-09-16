// Quick triage for an alert that isn't part of the shift queue.
//
// Paste a raw log line or alert and get a first-pass read: which format it is,
// how severe it looks, the likely ATT&CK technique, the indicators in it, and a
// next step. Everything comes from the deterministic rule engine in
// engine/triage, which runs in the browser and makes no network call, so every
// verdict traces back to a specific pattern match.
//
// State lives in the app shell (SOCAnalystSim.jsx), so leaving the tab and
// coming back keeps your input, result and history.

import { analyzeOffline } from '../engine/triage/analyze.js';
import { validateInput } from '../engine/triage/validation.js';
import { FORMAT_GUIDE, SAMPLE_ALERTS } from '../data/triage-samples.js';
import { C, MONO, TONE, severityTone } from '../theme.js';
import { Badge, Button, Callout, Card, EventTable, Metric, SectionLabel, SeverityBadge } from '../ui/primitives.jsx';
import { monoInputStyle } from '../ui/helpers.js';
import { IconFileCheck, IconListChecks, IconTarget, IconZap } from '../ui/icons.jsx';

const HISTORY_SIZE = 8;
const LOW_CONFIDENCE = 60;

function exportReport(result, input) {
  const ts = new Date().toISOString();
  const lines = [
    'SOC TRIAGE REPORT',
    `Generated: ${ts}`,
    '='.repeat(60),
    '',
    `SEVERITY:              ${result.severity}`,
    `THREAT TYPE:           ${result.threat_type}`,
    `LOG FORMAT DETECTED:   ${result.log_format_detected}`,
    `CONFIDENCE:            ${result.confidence}%`,
    `FALSE POSITIVE RISK:   ${result.false_positive_likelihood}`,
    '',
    'MITRE ATT&CK',
    `  Tactic:    ${result.mitre_tactic}`,
    `  Technique: ${result.mitre_technique}`,
    '',
    'SUMMARY',
    result.summary,
    '',
    'INDICATORS OF COMPROMISE',
    ...(result.iocs.length ? result.iocs.map((ioc) => `  - ${ioc}`) : ['  (none extracted)']),
    '',
    'RECOMMENDED ACTION',
    `  ${result.recommended_action}`,
    '',
    ...(result.analyst_notes ? ['ANALYST NOTES', `  ${result.analyst_notes}`, ''] : []),
    '='.repeat(60),
    'RAW ALERT INPUT',
    input,
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `triage-report-${ts.slice(0, 19).replace(/[:.]/g, '-')}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function FormatGuide({ state, update }) {
  const format = FORMAT_GUIDE[state.guideFormat] ?? FORMAT_GUIDE[0];
  return (
    <Card style={{ padding: 16, marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <SectionLabel icon={<IconListChecks size={14} />} style={{ marginBottom: 0 }}>Accepted formats</SectionLabel>
        <Button variant="ghost" onClick={() => update({ guideOpen: !state.guideOpen })} aria-expanded={state.guideOpen}>
          {state.guideOpen ? 'Hide guide' : 'Show guide'}
        </Button>
      </div>

      {state.guideOpen && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {FORMAT_GUIDE.map((f, i) => (
              <Button
                key={f.name}
                variant={i === state.guideFormat ? 'primary' : 'secondary'}
                onClick={() => update({ guideFormat: i })}
                style={{ padding: '5px 11px', fontSize: 12 }}
              >
                {f.name}
              </Button>
            ))}
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pattern</div>
          <pre style={{ ...codeBlock, marginBottom: 10 }}>{format.pattern}</pre>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Example</div>
          <pre style={{ ...codeBlock, marginBottom: 10 }}>{format.example}</pre>
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>{format.tips}</div>
          <Button variant="secondary" onClick={() => update({ input: format.example, result: null, issues: [] })}>
            Paste this example
          </Button>
        </div>
      )}
    </Card>
  );
}

const codeBlock = {
  fontFamily: MONO, fontSize: 12.5, lineHeight: 1.6, color: C.text, background: C.surfaceAlt,
  border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', margin: '4px 0 0',
  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
};

function Result({ result, input }) {
  const urgent = result.severity === 'CRITICAL' || result.severity === 'HIGH';
  return (
    <Card style={{ padding: 16, marginBottom: 14 }} accent={severityTone(result.severity).fg}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <SeverityBadge severity={result.severity} />
        <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{result.threat_type}</span>
        <Badge label={result.log_format_detected} tone={TONE.neutral} style={{ marginLeft: 'auto' }} />
      </div>

      {result.confidence < LOW_CONFIDENCE && (
        <Callout tone={TONE.coaching} title={`Low confidence (${result.confidence}%)`} style={{ marginBottom: 12 }}>
          No specific rule matched strongly. Add timestamps, IPs, usernames or more event fields to get a firmer read.
        </Callout>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Metric label="ATT&CK tactic" value={result.mitre_tactic} />
        <Metric label="Technique" value={result.mitre_technique} />
        <Metric label="Confidence" value={`${result.confidence}%`} />
        <Metric label="False-positive likelihood" value={result.false_positive_likelihood} hint="how likely this is benign" />
      </div>

      <SectionLabel style={{ marginBottom: 6 }}>Summary</SectionLabel>
      <p style={{ fontSize: 14, lineHeight: 1.65, color: C.text, margin: '0 0 14px' }}>{result.summary}</p>

      <Callout tone={urgent ? TONE.concerned : TONE.primary} title="Recommended action" style={{ marginBottom: 14 }}>
        {result.recommended_action}
      </Callout>

      <SectionLabel style={{ marginBottom: 6 }}>Indicators of compromise</SectionLabel>
      {result.iocs.length ? (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {result.iocs.map((ioc) => (
            <Badge key={ioc} label={ioc} tone={TONE.neutral} style={{ fontFamily: MONO, fontWeight: 500, whiteSpace: 'normal', wordBreak: 'break-all' }} />
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: C.textMuted, margin: '0 0 14px' }}>No discrete indicators extracted. Review the raw input by hand.</p>
      )}

      {result.analyst_notes && (
        <>
          <SectionLabel style={{ marginBottom: 6 }}>Analyst notes</SectionLabel>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: C.textSecondary, margin: '0 0 14px' }}>{result.analyst_notes}</p>
        </>
      )}

      <Button variant="secondary" onClick={() => exportReport(result, input)}>
        <IconFileCheck size={14} /> Export report (.txt)
      </Button>
    </Card>
  );
}

export default function TriageView({ state, onChange }) {
  const update = (patch) => onChange((prev) => ({ ...prev, ...patch }));
  const { input, result, issues, history } = state;

  function analyze() {
    const problems = validateInput(input);
    if (problems.length) {
      update({ issues: problems, result: null });
      return;
    }
    const next = analyzeOffline(input);
    onChange((prev) => ({
      ...prev,
      issues: [],
      result: next,
      history: [
        {
          time: new Date().toLocaleTimeString(),
          input,
          result: next,
        },
        ...prev.history,
      ].slice(0, HISTORY_SIZE),
    }));
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Alert triage</h1>
        <span style={{ fontSize: 12.5, color: C.textSecondary }}>a first-pass read on any alert or log line</span>
      </div>
      <p style={{ fontSize: 12.5, color: C.textMuted, margin: '0 0 14px', lineHeight: 1.55, maxWidth: 760 }}>
        Detects the format (syslog, Windows Event, Suricata, Zeek conn.log, CEF, DNS, or free text), scores severity,
        maps to ATT&amp;CK, pulls out indicators and suggests a next step. It runs a deterministic rule engine in your
        browser: nothing you paste leaves this tab, and every verdict comes from a specific pattern match.
      </p>

      <Card style={{ padding: 16, marginBottom: 14 }}>
        <SectionLabel icon={<IconZap size={14} />}>Sample alerts</SectionLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {SAMPLE_ALERTS.map((sample) => (
            <Button
              key={sample.id}
              variant="secondary"
              onClick={() => update({ input: sample.raw, result: null, issues: [] })}
              style={{ padding: '5px 11px', fontSize: 12.5 }}
            >
              <span style={{ color: C.textMuted, fontFamily: MONO, fontSize: 11 }}>{sample.type}</span>
              {sample.label}
            </Button>
          ))}
        </div>

        <label htmlFor="triage-input" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>
          Alert or log snippet
          {input && <span style={{ fontSize: 11.5, fontWeight: 500, color: C.textMuted, fontFamily: MONO }}>{input.length} chars</span>}
        </label>
        <textarea
          id="triage-input"
          value={input}
          onChange={(e) => update({ input: e.target.value, issues: [], result: null })}
          rows={9}
          spellCheck={false}
          placeholder="Paste a log line or alert: syslog, Windows Event, Suricata JSON, Zeek conn.log, CEF, a DNS log, or a plain-English description with the technical details in it."
          style={{
            ...monoInputStyle, resize: 'vertical', lineHeight: 1.6,
            borderColor: issues.length ? C.warning : undefined,
          }}
        />

        {issues.length > 0 && (
          <Callout tone={TONE.coaching} title="Can't triage this yet" style={{ marginTop: 12 }}>
            {issues.map((issue) => (
              <div key={issue.id} style={{ marginBottom: 6 }}>
                <strong>{issue.message}</strong> {issue.detail}
              </div>
            ))}
          </Callout>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={analyze} disabled={!input.trim()}>
            <IconTarget size={14} /> Analyze alert
          </Button>
          {input && (
            <Button variant="ghost" onClick={() => update({ input: '', result: null, issues: [] })}>Clear</Button>
          )}
        </div>
      </Card>

      <FormatGuide state={state} update={update} />

      {result && <Result result={result} input={input} />}

      {history.length > 0 && (
        <Card style={{ padding: 16 }}>
          <SectionLabel icon={<IconListChecks size={14} />}>This session</SectionLabel>
          <EventTable
            columns={['Time', 'Severity', 'Threat', 'Input']}
            rows={history.map((h) => ({
              Time: h.time,
              Severity: <SeverityBadge severity={h.result.severity} />,
              Threat: h.result.threat_type,
              Input: (
                <button
                  type="button"
                  onClick={() => onChange((prev) => ({ ...prev, input: h.input, result: h.result, issues: [] }))}
                  title="Reopen this analysis"
                  style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.primary,
                    fontFamily: MONO, fontSize: 12, textAlign: 'left', maxWidth: 360,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
                  }}
                >
                  {h.input.split('\n')[0]}
                </button>
              ),
            }))}
          />
        </Card>
      )}
    </div>
  );
}
