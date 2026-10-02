// Leaderboard roster (fictional, fixed standings)

export const ROSTER = [
  {
    id: 'jordan-reyes', name: 'Jordan Reyes', role: 'Senior Analyst (Tier 2)',
    blue: { rankIndex: 2, avg: 93 },
    red: { rankIndex: 1, cleared: 3, ghosts: 1, best: 62 },
    secrets: 16,
    fast: { best: 96, avgSeconds: 22, runs: 31 },
  },
  {
    id: 'priya-anand', name: 'Priya Anand', role: 'SOC Team Lead',
    blue: { rankIndex: 2, avg: 90 },
    red: { rankIndex: 1, cleared: 3, ghosts: 0, best: 58 },
    secrets: 9,
    fast: { best: 93, avgSeconds: 25, runs: 24 },
  },
  {
    id: 'marcus-bell', name: 'Marcus Bell', role: 'IR Lead',
    blue: { rankIndex: 1, cleared: 14, avg: 89 },
    red: { rankIndex: 2, cleared: 'all', ghosts: 3, best: 64 },
    secrets: 13,
    fast: { best: 91, avgSeconds: 28, runs: 18 },
  },
  {
    id: 'marcus-ibe', name: 'Marcus Ibe', role: 'Detection Engineering Lead',
    blue: { rankIndex: 1, cleared: 13, avg: 86 },
    red: { rankIndex: 1, cleared: 3, ghosts: 2, best: 63 },
    secrets: 17,
    fast: { best: 88, avgSeconds: 26, runs: 15 },
  },
  {
    id: 'tom-alvarez', name: 'Tom Alvarez', role: 'Security Engineering Manager',
    blue: { rankIndex: 1, cleared: 10, avg: 82 },
    red: { rankIndex: 1, cleared: 3, ghosts: 1, best: 60 },
    secrets: 12,
    fast: { best: 84, avgSeconds: 33, runs: 11 },
  },
  {
    id: 'sarah-okafor', name: 'Sarah Okafor', role: 'CISO',
    blue: { rankIndex: 0, cleared: 7, avg: 78 },
    red: { rankIndex: 0, cleared: 0, ghosts: 0, best: 46 },
    secrets: 4,
    fast: { best: 78, avgSeconds: 40, runs: 6 },
  },
  {
    id: 'kenji-watanabe', name: 'Kenji Watanabe', role: 'IT Operations Lead',
    blue: { rankIndex: 0, cleared: 4, avg: 72 },
    red: { rankIndex: 0, cleared: 1, ghosts: 0, best: 56 },
    secrets: 10,
    fast: { best: 71, avgSeconds: 38, runs: 7 },
  },
  {
    id: 'dev-malhotra', name: 'Dev Malhotra', role: 'Platform Engineering Lead',
    blue: { rankIndex: 0, cleared: 3, avg: 70 },
    red: { rankIndex: 0, cleared: 1, ghosts: 0, best: 58 },
    secrets: 15,
    fast: { best: 68, avgSeconds: 42, runs: 5 },
  },
  {
    id: 'aisha-rahman', name: 'Aisha Rahman', role: 'Head of Digital Banking',
    blue: { rankIndex: 0, cleared: 2, avg: 66 },
    red: { rankIndex: 0, cleared: 0, ghosts: 0, best: 41 },
    secrets: 3,
    fast: { best: 58, avgSeconds: 44, runs: 3 },
  },
  {
    id: 'david-reyes', name: 'David Reyes', role: 'CEO',
    blue: { rankIndex: 0, cleared: 0, avg: null },
    red: { rankIndex: 0, cleared: 0, ghosts: 0, best: null },
    secrets: 0,
    fast: { best: 41, avgSeconds: 52, runs: 1 },
  },
];

export const LIVE_URL = 'https://nicky-quist.github.io/soc-analyst-simulator/';
