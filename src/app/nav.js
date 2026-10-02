// Console sections, in rail order

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

// Valid #hash views
export const VIEWS = NAV_GROUPS.flat().map((v) => v.id);
