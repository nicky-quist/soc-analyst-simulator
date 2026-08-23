import { useMemo, useState } from 'react';
import { C, TONE } from '../theme.js';
import { Badge, Button, Callout, Card, PersonaMessage, SectionLabel } from '../ui/primitives.jsx';

const VERDICT_STYLE = {
  required: { tone: TONE.positive, label: 'Appropriate' },
  acceptable: { tone: TONE.neutral, label: 'Reasonable' },
  unnecessary: { tone: TONE.coaching, label: 'Unnecessary' },
  harmful: { tone: TONE.concerned, label: 'Caused harm' },
};

// Deterministic shuffle so the damaging options aren't always at the bottom of
// the list — if the traps sit in a predictable position they stop being traps.
function stableOrder(scenarioId, actions) {
  const weight = (id) => {
    let hash = 0;
    for (const char of `${scenarioId}:${id}`) hash = (hash * 31 + char.charCodeAt(0)) % 100_000;
    return hash;
  };
  return [...actions].sort((a, b) => weight(a.id) - weight(b.id));
}

export default function RespondTab({ scenario, caseFile, onAct, readOnly }) {
  const [pending, setPending] = useState(null);
  const taken = caseFile.actions || [];
  const ordered = useMemo(() => stableOrder(scenario.id, scenario.actions), [scenario]);

  return (
    <div>
      <Callout tone={TONE.coaching} title="Response actions are real and cannot be undone" style={{ marginBottom: 20 }}>
        Everything here is something an L1 can actually do from a console or a phone. Nothing tells you in advance whether
        it is the right move, some of these options make the situation worse, and each one is recorded in the case with a
        timestamp. Sequence matters as much as choice: contain before you remediate, preserve before you clean.
      </Callout>

      <SectionLabel>Available actions</SectionLabel>
      {ordered.map((action) => {
        const isTaken = taken.includes(action.id);
        const style = VERDICT_STYLE[action.verdict];
        const isPending = pending === action.id;

        return (
          <Card key={action.id} style={{ padding: 16, marginBottom: 12 }} tone={isTaken ? style.tone : undefined}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, lineHeight: 1.5 }}>{action.label}</div>
                {action.detail && (
                  <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 4 }}>{action.detail}</div>
                )}
              </div>
              <div style={{ flexShrink: 0 }}>
                {isTaken ? (
                  <Badge label={style.label} tone={style.tone} />
                ) : isPending ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="primary" onClick={() => { onAct(action.id); setPending(null); }}>Confirm</Button>
                    <Button variant="ghost" onClick={() => setPending(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button disabled={readOnly} onClick={() => setPending(action.id)}>Take action</Button>
                )}
              </div>
            </div>

            {isPending && (
              <div style={{ marginTop: 12, fontSize: 12.5, color: C.textSecondary }}>
                This will be executed and recorded in the case. There is no undo.
              </div>
            )}

            {isTaken && (
              <div style={{ marginTop: 14 }}>
                <Callout tone={TONE.neutral} title="Result">{action.result}</Callout>
                {action.consequence && (
                  <div style={{ marginTop: 14 }}>
                    <PersonaMessage persona={action.consequence} />
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
