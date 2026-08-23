import { useState } from 'react';
import { C, MONO, TONE } from '../theme.js';
import { TIME_RANGES } from '../engine/query.js';
import { Badge, Button, Callout, Card, EventTable, SectionLabel } from '../ui/primitives.jsx';
import { formatDuration, inputStyle, monoInputStyle } from '../ui/helpers.js';

function ResultCard({ entry }) {
  const { query, range, result } = entry;
  const rangeLabel = TIME_RANGES.find((r) => r.id === range)?.label || range;

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
      <code style={{ fontFamily: MONO, fontSize: 12.5, color: C.primaryStrong, background: C.primarySoft, padding: '3px 8px', borderRadius: 4 }}>
        {query}
      </code>
      <span style={{ fontSize: 11.5, color: C.textMuted }}>{rangeLabel}</span>
      <span style={{ marginLeft: 'auto', fontSize: 11.5, color: C.textMuted }}>+{formatDuration(entry.at)}</span>
    </div>
  );

  if (result.status === 'ok') {
    return (
      <Card style={{ padding: 16, marginBottom: 12 }}>
        {header}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <Badge label={`${result.events.length} events`} tone={result.events.length ? TONE.positive : TONE.coaching} />
          <span style={{ fontSize: 12.5, color: C.textSecondary }}>
            index=<strong style={{ color: C.text }}>{result.index}</strong> · {result.label}
          </span>
        </div>
        {result.events.length > 0 && <EventTable columns={result.columns} rows={result.events} />}
        {result.note && (
          <Callout tone={TONE.primary} style={{ marginTop: 12 }} title="Reading the result">
            {result.note}
          </Callout>
        )}
      </Card>
    );
  }

  const tone = result.status === 'error' ? TONE.concerned : TONE.coaching;
  return (
    <Card style={{ padding: 16, marginBottom: 12 }}>
      {header}
      <Callout tone={tone} title={result.title}>
        {result.detail}
        {result.hint && <div style={{ marginTop: 8, color: C.textSecondary }}>{result.hint}</div>}
      </Callout>
    </Card>
  );
}

export default function InvestigateTab({ scenario, caseFile, onSearch, onDecode, readOnly }) {
  const [query, setQuery] = useState('');
  const [range, setRange] = useState(caseFile.lastRange || '15m');
  const [decodeInput, setDecodeInput] = useState('');
  const [showDecoder, setShowDecoder] = useState(false);

  const history = [...(caseFile.searches || [])].reverse();
  const decodes = [...(caseFile.decodes || [])].reverse();

  function submit(event) {
    event.preventDefault();
    if (!query.trim() || readOnly) return;
    onSearch(query, range);
    setQuery('');
  }

  return (
    <div>
      <Card style={{ padding: 18, marginBottom: 20 }}>
        <SectionLabel>Search</SectionLabel>
        <form onSubmit={submit}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              aria-label="Search query"
              value={query}
              disabled={readOnly}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="index=auth 10.0.0.1"
              style={{ ...monoInputStyle, flex: '3 1 320px' }}
            />
            <select
              aria-label="Time range"
              value={range}
              disabled={readOnly}
              onChange={(e) => setRange(e.target.value)}
              style={{ ...inputStyle, flex: '1 1 150px', width: 'auto' }}
            >
              {TIME_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <Button type="submit" variant="primary" disabled={readOnly || !query.trim()} onClick={undefined} style={{ flex: '0 0 auto' }}>
              Search
            </Button>
          </div>
        </form>

        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: C.textMuted, fontWeight: 700, letterSpacing: 0.4 }}>DATA SOURCES</span>
          {scenario.datasets.map((d) => (
            <button
              key={d.index}
              type="button"
              title={`${d.label} · retention ${d.retention}`}
              disabled={readOnly}
              onClick={() => setQuery(`index=${d.index} `)}
              style={{
                fontFamily: MONO, fontSize: 12, color: C.text, background: C.surfaceAlt,
                border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 8px',
                cursor: readOnly ? 'default' : 'pointer',
              }}
            >
              {d.index}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
          Syntax: <code style={{ fontFamily: MONO }}>index=&lt;source&gt; &lt;value&gt;</code>, or a bare value to search everything.
          The values have to come from the evidence — hosts, users, and addresses are not offered to you. The time picker starts
          at 15 minutes, the same place a real console does.
        </div>
      </Card>

      <Card style={{ padding: 18, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <SectionLabel style={{ marginBottom: 0 }}>Decoder</SectionLabel>
          <Button variant="ghost" onClick={() => setShowDecoder((v) => !v)} aria-expanded={showDecoder}>
            {showDecoder ? 'Hide' : 'Open'}
          </Button>
        </div>
        {showDecoder && (
          <div style={{ marginTop: 14 }}>
            <textarea
              aria-label="Base64 input"
              rows={3}
              value={decodeInput}
              disabled={readOnly}
              onChange={(e) => setDecodeInput(e.target.value)}
              placeholder="Paste a base64 blob — for example the value after -EncodedCommand"
              style={{ ...monoInputStyle, resize: 'vertical' }}
            />
            <Button
              variant="primary"
              disabled={readOnly || !decodeInput.trim()}
              onClick={() => { onDecode(decodeInput); setDecodeInput(''); }}
              style={{ marginTop: 10 }}
            >
              Decode
            </Button>
            {decodes.map((entry, i) => (
              <Callout
                key={i}
                tone={entry.result.ok ? TONE.primary : TONE.concerned}
                title={entry.result.ok ? `Decoded · ${entry.result.encoding}` : 'Could not decode'}
                style={{ marginTop: 12 }}
              >
                <pre style={{ fontFamily: MONO, fontSize: 12.5, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {entry.result.ok ? entry.result.text : entry.result.error}
                </pre>
              </Callout>
            ))}
          </div>
        )}
      </Card>

      <SectionLabel>Search history {history.length > 0 && `· ${history.length}`}</SectionLabel>
      {history.length === 0 ? (
        <Callout tone={TONE.neutral} title="No searches run yet">
          Read the alert, decide what question you are asking, then search. Guessing indicators into the bar is how a
          shift disappears.
        </Callout>
      ) : (
        history.map((entry, i) => <ResultCard key={history.length - i} entry={entry} />)
      )}
    </div>
  );
}
