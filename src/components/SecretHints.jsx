// Hints for the Secrets board: found secrets reveal their title, the rest stay
// hidden behind a nudge you open on purpose.

import { useState } from 'react';
import { EGGS, EGG_HINTS } from '../data/easterEggs.js';
import { C, MONO, TONE } from '../theme.js';
import { Badge, Button, Card } from '../ui/primitives.jsx';
import { IconCheck, IconSparkles } from '../ui/icons.jsx';

export default function SecretHints({ found }) {
  const [open, setOpen] = useState(() => new Set());
  const foundSet = new Set(found);
  const missing = EGGS.filter((e) => !foundSet.has(e.id));

  function toggle(id) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card style={{ padding: 16, marginTop: 16 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ color: C.primaryStrong, display: 'flex' }}><IconSparkles size={16} /></span>
        <strong style={{ fontSize: 14, color: C.text }}>Secret hints</strong>
        <Badge label={missing.length ? `${missing.length} left to find` : 'All found'} tone={missing.length ? TONE.neutral : TONE.positive} />
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, lineHeight: 1.5 }}>
        Each hint points at the right part of the console without giving the answer away. Open one only if you are stuck.
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {EGGS.map((egg, i) => {
          const isFound = foundSet.has(egg.id);
          const shown = open.has(egg.id);
          return (
            <li key={egg.id} style={{ padding: '8px 4px', borderTop: i ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ width: 18, display: 'flex', color: isFound ? C.success : C.textMuted }}>
                  {isFound ? <IconCheck size={16} /> : <span style={{ fontFamily: MONO, fontSize: 12 }}>?</span>}
                </span>
                <span style={{ flex: '1 1 160px', fontSize: 13, color: isFound ? C.text : C.textSecondary, fontWeight: isFound ? 600 : 400 }}>
                  {isFound ? egg.title : `Secret ${i + 1}`}
                </span>
                {isFound ? (
                  <Badge label="Found" tone={TONE.positive} />
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => toggle(egg.id)}
                    aria-expanded={shown}
                    style={{ padding: '4px 10px', fontSize: 12 }}
                  >
                    {shown ? 'Hide hint' : 'Show hint'}
                  </Button>
                )}
              </div>
              {!isFound && shown && (
                <div style={{ margin: '6px 0 2px 28px', fontSize: 12.5, color: C.textSecondary, lineHeight: 1.55 }}>
                  {EGG_HINTS[egg.id]}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
