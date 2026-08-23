import { C, MONO } from '../theme.js';
import { formatDuration } from '../ui/helpers.js';

// Case notes, the way a case-management tool keeps them: every action you took,
// in order, with the clock running. It is the audit trail an incident handoff
// is built from — and reading your own back is usually how you notice you spent
// eleven minutes searching before you contained anything.
const KIND_STYLE = {
  search: { icon: '⌕', color: C.primaryStrong },
  empty: { icon: '⌀', color: C.textMuted },
  intel: { icon: '◎', color: C.info },
  action: { icon: '▲', color: C.warning },
  harm: { icon: '✖', color: C.danger },
  decode: { icon: '⇄', color: C.primaryStrong },
  report: { icon: '■', color: C.success },
  note: { icon: '·', color: C.textMuted },
};

export default function CaseTimeline({ entries = [] }) {
  return (
    <div>
      {entries.length === 0 && (
        <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.6 }}>
          Nothing recorded yet. Every search, lookup, and action you take on this alert appears here with the elapsed
          time, and it is what the handoff to Tier 2 would be built from.
        </div>
      )}
      {entries.map((entry, i) => {
        const style = KIND_STYLE[entry.kind] || KIND_STYLE.note;
        return (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, color: style.color, fontSize: 13, width: 14, textAlign: 'center', marginTop: 1 }}>
              {style.icon}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.5, wordBreak: 'break-word' }}>{entry.text}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                +{formatDuration(entry.at)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
