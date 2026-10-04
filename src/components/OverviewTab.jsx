import { useState } from 'react';
import { C, MONO, TONE } from '../theme.js';
import { Button, Card, PersonaMessage, SectionLabel, SeverityBadge } from '../ui/primitives.jsx';
import { IconUsers } from '../ui/icons.jsx';
import { generateTier2Nudge } from '../engine/personas.js';

function DetailRow({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
      <div style={{ flex: '0 0 150px', fontSize: 12, color: C.textSecondary, fontWeight: 600 }}>{label}</div>
      <div style={{ flex: '1 1 200px', fontSize: 13, color: C.text, minWidth: 0 }}>{children}</div>
    </div>
  );
}

export default function OverviewTab({ scenario, showWalkthrough, caseFile, closed, onAskTier2 }) {
  const { alert } = scenario;
  const [nudge, setNudge] = useState(null);

  function askTier2() {
    const { key, persona } = generateTier2Nudge(scenario, caseFile);
    setNudge(persona);
    onAskTier2?.(key);
  }

  return (
    <div>
      {(!closed || showWalkthrough) && (
        <Card tone={showWalkthrough ? TONE.primary : undefined} style={{ padding: 18, marginBottom: 20 }}>
          <SectionLabel icon={<IconUsers size={13} />}>Hints</SectionLabel>
          {!closed && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: nudge || showWalkthrough ? 12 : 0 }}>
              <span style={{ fontSize: 13, color: C.textSecondary }}>Stuck? Ask a coworker for a nudge.</span>
              <Button variant="ghost" onClick={askTier2}>Ask Tier 2 for a nudge</Button>
            </div>
          )}
          {nudge && <PersonaMessage persona={nudge} />}
          {showWalkthrough && (
            <div style={{ marginTop: nudge ? 16 : 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text, marginBottom: 8 }}>Walkthrough — how a senior analyst works this alert</div>
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {scenario.walkthrough.map((step, i) => (
                  <li key={i} style={{ fontSize: 13.5, color: C.text, lineHeight: 1.7, marginBottom: 10 }}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </Card>
      )}

      <Card style={{ padding: 18, marginBottom: 20 }}>
        <SectionLabel>Detection details</SectionLabel>
        <DetailRow label="Alert ID"><code style={{ fontFamily: MONO }}>{alert.ref}</code></DetailRow>
        <DetailRow label="Rule">{alert.rule}</DetailRow>
        <DetailRow label="Rule ID"><code style={{ fontFamily: MONO }}>{alert.ruleId}</code></DetailRow>
        <DetailRow label="Data source">{scenario.source}</DetailRow>
        <DetailRow label="Detected">{alert.detectedAt}</DetailRow>
        <DetailRow label="Reported severity">
          <SeverityBadge severity={alert.reportedSeverity} />
          <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>
            what the tool said — yours to confirm or overturn
          </span>
        </DetailRow>
        {alert.entities.map((entity) => (
          <DetailRow key={entity.label} label={entity.label}>{entity.value}</DetailRow>
        ))}
      </Card>

      <Card style={{ padding: 18 }}>
        <SectionLabel>Triggering event</SectionLabel>
        <div style={{ background: C.logBg, borderRadius: 6, padding: 14, overflowX: 'auto' }}>
          <pre style={{
            fontFamily: MONO, fontSize: 12.5, color: C.logText, whiteSpace: 'pre-wrap',
            margin: 0, lineHeight: 1.7, wordBreak: 'break-word',
          }}>
            {scenario.rawLog}
          </pre>
        </div>
      </Card>
    </div>
  );
}
