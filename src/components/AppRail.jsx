// The console's side rail: the logo, the sections in their groups, and the
// theme and end-shift buttons. The sections come from app/nav.js so the rail, the
// #hash routing and the tests that pin the order all read one list.

import { NAV_GROUPS } from '../app/nav.js';
import { C } from '../theme.js';
import { IconButton } from '../ui/primitives.jsx';
import {
  IconClipboardPulse, IconCrosshair, IconDashboard, IconInbox, IconLogOut, IconSettings, IconShield,
  IconStopwatch, IconThemeHalf, IconTrendingUp, IconTrophy, IconUsers,
} from '../ui/icons.jsx';

const ICONS = {
  dashboard: IconDashboard,
  queue: IconInbox,
  triage: IconClipboardPulse,
  fasttriage: IconStopwatch,
  redops: IconCrosshair,
  progress: IconTrendingUp,
  leaderboard: IconTrophy,
  team: IconUsers,
  settings: IconSettings,
};

export default function AppRail({ view, onSelectView, openCount, onToggleTheme, onEndShift, onLogoClick }) {
  return (
    <aside className="app-rail" aria-label="Primary navigation">
      <div
        style={{
          width: 34, height: 34, borderRadius: 9, background: C.primary, color: C.onPrimary,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
        }}
        onClick={onLogoClick}
      >
        <IconShield size={18} strokeWidth={2} />
      </div>

      <nav aria-label="Console sections" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group[0].id} style={{ display: 'contents' }}>
            {groupIndex > 0 && (
              <div role="separator" aria-hidden="true" style={{ height: 1, background: C.border, margin: '4px 6px' }} />
            )}
            {group.map((item) => {
              const Icon = ICONS[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  className="rail-nav-btn"
                  data-active={view === item.id}
                  onClick={() => onSelectView(item.id)}
                  aria-current={view === item.id ? 'page' : undefined}
                  title={item.label}
                  aria-label={item.label}
                >
                  <Icon size={19} />
                  {item.id === 'queue' && openCount > 0 && <span className="rail-count">{openCount}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <IconButton icon={<IconThemeHalf size={18} />} title="Toggle color theme" onClick={onToggleTheme} />
      <IconButton
        icon={<IconLogOut size={17} />}
        title="End shift — review any handoff first (also auto-resets every 12h)"
        onClick={onEndShift}
      />
    </aside>
  );
}
