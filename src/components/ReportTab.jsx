import { useState } from 'react';
import { C, MONO, TONE } from '../theme.js';
import { CLASSIFICATION_OPTIONS, ESCALATION_OPTIONS, SEVERITY_OPTIONS } from '../data/scenarios/index.js';
import { searchTechniques, findTechnique } from '../data/techniques.js';
import { Badge, Button, Callout, Card, Field, SectionLabel } from '../ui/primitives.jsx';
import { inputStyle } from '../ui/helpers.js';

// ATT&CK mapping as a picker rather than a free-text box: the analyst has to
// choose between techniques that all look plausible for the alert, which is the
// actual difficulty of mapping. Typing a technique ID from memory is not.
function TechniquePicker({ value, onChange, disabled }) {
  const [filter, setFilter] = useState('');
  const selected = findTechnique(value);
  const matches = searchTechniques(filter).slice(0, 6);

  return (
    <div>
      <input
        id="field-mitre"
        style={{ ...inputStyle, marginBottom: 10 }}
        value={filter}
        disabled={disabled}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by technique, tactic, or ID — e.g. phishing, persistence, T1059"
      />
      {selected && (
        <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge label={selected.id} tone={TONE.primary} />
          <span style={{ fontSize: 13, color: C.text }}>{selected.name}</span>
          <span style={{ fontSize: 12, color: C.textSecondary }}>· {selected.tactic}</span>
        </div>
      )}
      {!disabled && (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden' }}>
          {matches.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: C.textMuted }}>No technique matches that.</div>
          )}
          {matches.map((technique) => {
            const isSelected = technique.id === value;
            return (
              <button
                key={technique.id}
                type="button"
                onClick={() => onChange(technique.id)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: isSelected ? C.primarySoft : 'transparent', border: 'none',
                  borderBottom: `1px solid ${C.border}`, padding: '9px 12px', fontFamily: 'inherit',
                }}
              >
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.primaryStrong, marginRight: 8 }}>{technique.id}</span>
                <span style={{ fontSize: 13, color: C.text }}>{technique.name}</span>
                <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{technique.tactic}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ReportTab({ form, onChange, onSubmit, disabled, caseFile, scenario }) {
  const field = (key, value) => onChange({ ...form, [key]: value });
  const textarea = { ...inputStyle, resize: 'vertical', lineHeight: 1.6 };
  const canSubmit = form.classification && form.severity && form.escalation && form.summary;

  const searchCount = (caseFile.searches || []).filter((s) => s.result.status === 'ok').length;
  const intelCount = (caseFile.intel || []).length;
  const actionCount = (caseFile.actions || []).length;

  return (
    <div>
      {!disabled && (
        <Callout tone={TONE.neutral} title="Before you close this" style={{ marginBottom: 20 }}>
          You have run {searchCount} search{searchCount === 1 ? '' : 'es'} that returned data, {intelCount} intel lookup
          {intelCount === 1 ? '' : 's'}, and taken {actionCount} response action{actionCount === 1 ? '' : 's'} on
          {' '}{scenario.alert.ref}. Submitting the report closes the alert and grades the case.
        </Callout>
      )}

      <Card style={{ padding: 24 }}>
        <SectionLabel>Incident report</SectionLabel>

        <div className="sim-form-grid">
          <Field label="Classification" htmlFor="field-classification">
            <select id="field-classification" style={inputStyle} value={form.classification} disabled={disabled}
              onChange={(e) => field('classification', e.target.value)}>
              <option value="">Select…</option>
              {CLASSIFICATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Severity" htmlFor="field-severity" hint="Severity drives who gets paged and how fast.">
            <select id="field-severity" style={inputStyle} value={form.severity} disabled={disabled}
              onChange={(e) => field('severity', e.target.value)}>
              <option value="">Select…</option>
              {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        <Field label="MITRE ATT&CK technique" htmlFor="field-mitre">
          <TechniquePicker value={form.mitreTechnique} onChange={(v) => field('mitreTechnique', v)} disabled={disabled} />
        </Field>

        <Field label="Summary — what happened and why it matters" htmlFor="field-summary">
          <textarea id="field-summary" style={textarea} rows={5} value={form.summary} disabled={disabled}
            onChange={(e) => field('summary', e.target.value)}
            placeholder="Write it for the person who picks this up next, in your own words…" />
        </Field>

        <Field label="Recommended action / remediation" htmlFor="field-remediation">
          <textarea id="field-remediation" style={textarea} rows={3} value={form.remediation} disabled={disabled}
            onChange={(e) => field('remediation', e.target.value)} placeholder="What should happen next?" />
        </Field>

        <Field label="Escalation decision" htmlFor="field-escalation">
          <select id="field-escalation" style={inputStyle} value={form.escalation} disabled={disabled}
            onChange={(e) => field('escalation', e.target.value)}>
            <option value="">Select…</option>
            {ESCALATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        {!disabled && (
          <Button variant="primary" onClick={onSubmit} disabled={!canSubmit} style={{ width: '100%', padding: '11px 24px', fontSize: 14 }}>
            Submit report and close alert
          </Button>
        )}
      </Card>
    </div>
  );
}
