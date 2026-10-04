// The list inside Settings > Secrets, the one place secrets are managed: found secrets reveal their title, the rest stay
// hidden behind a nudge you open on purpose.

import { useState } from 'react';
import { EGGS, EGG_HINTS } from '../data/easterEggs.js';
import { C, MONO, TONE } from '../theme.js';
import { Badge, Button } from '../ui/primitives.jsx';
import { IconCheck } from '../ui/icons.jsx';

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
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
        <strong style={{ fontSize: 13, color: C.text }}>{EGGS.length - missing.length} of {EGGS.length} found</strong>
        <Badge label={missing.length ? `${missing.length} left to find` : 'All found'} tone={missing.length ? TONE.neutral : TONE.positive} />
      </div>
      <div
        role="presentation"
        style={{ height: 6, borderRadius: 3, background: C.surfaceAlt, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 12 }}
      >
        <div style={{ width: `${(foundSet.size / EGGS.length) * 100}%`, height: '100%', background: C.primary }} />
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
        Found secrets show their name. Each one you haven't found has a hint that points at the right part of the console without giving the answer away. Open one only if you are stuck.
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
    </div>
  );
}
