import { C, MONO } from '../theme.js';
import { formatDuration } from '../ui/helpers.js';
import { IconAlertOctagon, IconCircleSlash, IconDot, IconFileCheck, IconSearch, IconSwap, IconTarget, IconZap } from '../ui/icons.jsx';

// Case notes, the way a case-management tool keeps them: every action you took,
// in order, with the clock running. It is the audit trail an incident handoff
// is built from — and reading your own back is usually how you notice you spent
// eleven minutes searching before you contained anything.
const KIND_STYLE = {
  search: { icon: IconSearch, color: C.primaryStrong },
  empty: { icon: IconCircleSlash, color: C.textMuted },
  intel: { icon: IconTarget, color: C.info },
  action: { icon: IconZap, color: C.warning },
  harm: { icon: IconAlertOctagon, color: C.danger },
  decode: { icon: IconSwap, color: C.primaryStrong },
  report: { icon: IconFileCheck, color: C.success },
  note: { icon: IconDot, color: C.textMuted },
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
        const Icon = style.icon;
        return (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
            <div style={{
              flexShrink: 0, color: style.color, width: 22, height: 22, borderRadius: 6, marginTop: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.surfaceAlt,
              border: `1px solid ${C.border}`,
            }}>
              <Icon size={12.5} strokeWidth={2} />
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
