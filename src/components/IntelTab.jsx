import { useState } from 'react';
import { C, MONO, TONE } from '../theme.js';
import { Badge, Button, Callout, Card, SectionLabel } from '../ui/primitives.jsx';
import { formatDuration, monoInputStyle } from '../ui/helpers.js';

const VERDICT_TONE = {
  malicious: TONE.concerned,
  suspicious: TONE.coaching,
  benign: TONE.positive,
  unknown: TONE.neutral,
};

function IntelCard({ entry }) {
  const { value, at, result } = entry;

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
      <code style={{ fontFamily: MONO, fontSize: 12.5, color: C.primaryStrong, background: C.primarySoft, padding: '3px 8px', borderRadius: 4, wordBreak: 'break-all' }}>
        {value}
      </code>
      {result.indicator?.type && result.indicator.type !== 'invalid' && (
        <Badge label={result.indicator.algorithm || result.indicator.type} tone={TONE.neutral} />
      )}
      <span style={{ marginLeft: 'auto', fontSize: 11.5, color: C.textMuted }}>+{formatDuration(at)}</span>
    </div>
  );

  if (result.status !== 'found') {
    const tone = result.status === 'error' ? TONE.concerned : TONE.coaching;
    return (
      <Card style={{ padding: 16, marginBottom: 12 }}>
        {header}
        <Callout tone={tone} title={result.title}>
          {result.detail}
          {result.guidance && <div style={{ marginTop: 8, color: C.textSecondary }}>{result.guidance}</div>}
        </Callout>
      </Card>
    );
  }

  const record = result.record;
  const tone = VERDICT_TONE[record.verdict] || TONE.neutral;
  return (
    <Card style={{ padding: 16, marginBottom: 12 }}>
      {header}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Badge label={record.verdict.toUpperCase()} tone={tone} />
        <Badge label={`confidence: ${record.confidence}`} tone={TONE.neutral} />
        <Badge label={`first seen ${record.firstSeen}`} tone={TONE.neutral} />
      </div>
      <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.65, marginBottom: 12 }}>{record.summary}</div>
      <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
        {record.sources.map((source) => (
          <div key={source} style={{ fontSize: 12.5, color: C.textSecondary, display: 'flex', gap: 8 }}>
            <span style={{ color: C.textMuted }}>▸</span>{source}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {record.tags.map((tag) => (
          <span key={tag} style={{
            fontFamily: MONO, fontSize: 11.5, color: C.textSecondary, background: C.surfaceAlt,
            border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 7px',
          }}>
            {tag}
          </span>
        ))}
      </div>
    </Card>
  );
}

export default function IntelTab({ caseFile, onLookup, readOnly }) {
  const [value, setValue] = useState('');
  const history = [...(caseFile.intel || [])].reverse();

  function submit(event) {
    event.preventDefault();
    if (!value.trim() || readOnly) return;
    onLookup(value);
    setValue('');
  }

  return (
    <div>
      <Card style={{ padding: 18, marginBottom: 20 }}>
        <SectionLabel>Threat intel enrichment</SectionLabel>
        <form onSubmit={submit}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              aria-label="Indicator"
              value={value}
              disabled={readOnly}
              onChange={(e) => setValue(e.target.value)}
              placeholder="IP, domain, URL, email, or file hash"
              style={{ ...monoInputStyle, flex: '3 1 300px' }}
            />
            <Button type="submit" variant="primary" disabled={readOnly || !value.trim()}>Enrich</Button>
          </div>
        </form>
        <div style={{ marginTop: 10, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
          Type the indicator yourself, out of the alert or a search result. Defanged input (<code style={{ fontFamily: MONO }}>1[.]2[.]3[.]4</code>)
          is accepted. Remember that &ldquo;no records found&rdquo; is not a verdict — it is the same answer you get for a typo.
        </div>
      </Card>

      <SectionLabel>Lookups {history.length > 0 && `· ${history.length}`}</SectionLabel>
      {history.length === 0 ? (
        <Callout tone={TONE.neutral} title="No lookups yet">
          Enrichment only helps once you have an indicator worth checking. Pull one out of the evidence first.
        </Callout>
      ) : (
        history.map((entry, i) => <IntelCard key={history.length - i} entry={entry} />)
      )}
    </div>
  );
}
