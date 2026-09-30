// The console's sections, in rail order and in the groups the rail draws them
// in: the shift itself, practice, where you stand, and reference. One list drives
// the rail, the #hash routing and the tests that pin the order, so they cannot
// drift apart. Icons live with the rail, which is the only place that draws them.

export const NAV_GROUPS = [
  [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'queue', label: 'Alert queue' },
  ],
  [
    { id: 'triage', label: 'Alert triage' },
    { id: 'fasttriage', label: 'Fast triage' },
    { id: 'redops', label: 'Red Ops' },
  ],
  [
    { id: 'progress', label: 'Your progress' },
    { id: 'leaderboard', label: 'Leaderboard' },
  ],
  [
    { id: 'team', label: 'Security org' },
    { id: 'settings', label: 'Settings' },
  ],
];

// Each also answers to a URL hash (#triage and so on), so a link can open
// straight onto a tab.
export const VIEWS = NAV_GROUPS.flat().map((v) => v.id);
