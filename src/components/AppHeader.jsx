// Console header

import { COMPANY } from '../data/scenarios/index.js';
import { C, TONE } from '../theme.js';
import { slaState } from '../engine/case.js';
import { Badge } from '../ui/primitives.jsx';
import { useNow } from '../ui/useNow.js';
import { IconUser } from '../ui/icons.jsx';

export default function AppHeader({ blueRank, redRank, shiftWindow, openCount, closedCount, avgScore, queue, cases }) {
  const now = useNow();
  const slaBreaches = queue.filter((s) => slaState(s, cases[s.id], now).breached).length;
  return (
    <>
      {/* Accent bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${C.primary} 0%, ${C.info} 60%, transparent 100%)` }} />
      <header style={{
        borderBottom: `1px solid ${C.border}`, padding: '10px 20px', display: 'flex', alignItems: 'center',
        gap: 14, background: C.surface, flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{COMPANY.soc} — Analyst Console</span>
            <span className="live-dot" title="Live" />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.success, letterSpacing: 0.5 }}>LIVE</span>
          </div>
          <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 1 }}>
            {blueRank} · {shiftWindow}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge label={`${openCount} open`} tone={TONE.primary} />
          <Badge label={`${closedCount} closed`} tone={TONE.neutral} />
          {avgScore !== null && (
            <Badge label={`Avg ${avgScore}`} tone={avgScore >= 70 ? TONE.positive : TONE.coaching} />
          )}
          <Badge label={`${slaBreaches} SLA breach${slaBreaches === 1 ? '' : 'es'}`} tone={slaBreaches ? TONE.concerned : TONE.neutral} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, marginLeft: 6, paddingLeft: 12,
            borderLeft: `1px solid ${C.border}`,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', background: C.surfaceAlt, border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSecondary,
            }}>
              <IconUser size={14} />
            </div>
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{COMPANY.analyst.name}</div>
              <div style={{ fontSize: 10.5, color: C.textMuted }}>Blue: {blueRank}</div>
              <div style={{ fontSize: 10.5, color: C.textMuted }}>Red: {redRank}</div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
