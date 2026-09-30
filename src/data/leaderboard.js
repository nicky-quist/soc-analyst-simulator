// The SEA SOC roster the leaderboards rank you against. Everyone here is
// fictional, drawn from the people the console already puts in front of you, and
// their standings are fixed so the boards are the same every time you open them.
// It is you against the sim's own people, not against other players.
//
// Standings are stored the way the engines store yours, so they compare directly:
//   blue    — rankIndex 0-2 (CAREER_RANKS), cleared case types, average best score.
//             A rank-2 analyst has by definition cleared every case type, so
//             `cleared` is only given below that and is clamped as the library grows.
//   red     — rankIndex 0-2 (RED_RANKS), operations cleared, ghost runs, best score.
//   secrets — how many of the hidden things they have found.
//
// Each board is beatable: no roster standing is higher than a perfect player's.

export const ROSTER = [
  {
    id: 'priya-anand', name: 'Priya Anand', role: 'SOC Team Lead',
    blue: { rankIndex: 2, avg: 91 },
    red: { rankIndex: 1, cleared: 3, ghosts: 1, best: 62 },
    secrets: 17,
  },
  {
    id: 'jordan-reyes', name: 'Jordan Reyes', role: 'Senior Analyst (Tier 2)',
    blue: { rankIndex: 2, avg: 87 },
    red: { rankIndex: 0, cleared: 1, ghosts: 0, best: 58 },
    secrets: 9,
  },
  {
    id: 'marcus-bell', name: 'Marcus Bell', role: 'IR Lead',
    blue: { rankIndex: 1, cleared: 13, avg: 89 },
    red: { rankIndex: 2, cleared: 'all', ghosts: 3, best: 64 },
    secrets: 12,
  },
  {
    id: 'marcus-ibe', name: 'Marcus Ibe', role: 'Detection Engineering Lead',
    blue: { rankIndex: 1, cleared: 12, avg: 85 },
    red: { rankIndex: 1, cleared: 2, ghosts: 1, best: 61 },
    secrets: 15,
  },
  {
    id: 'tom-alvarez', name: 'Tom Alvarez', role: 'Security Engineering Manager',
    blue: { rankIndex: 1, cleared: 10, avg: 82 },
    red: { rankIndex: 1, cleared: 2, ghosts: 0, best: 57 },
    secrets: 6,
  },
  {
    id: 'dev-malhotra', name: 'Dev Malhotra', role: 'Platform Engineering Lead',
    blue: { rankIndex: 0, cleared: 4, avg: 74 },
    red: { rankIndex: 1, cleared: 2, ghosts: 2, best: 63 },
    secrets: 14,
  },
  {
    id: 'kenji-watanabe', name: 'Kenji Watanabe', role: 'IT Operations Lead',
    blue: { rankIndex: 0, cleared: 3, avg: 70 },
    red: { rankIndex: 0, cleared: 1, ghosts: 0, best: 52 },
    secrets: 11,
  },
  {
    id: 'sarah-okafor', name: 'Sarah Okafor', role: 'CISO',
    blue: { rankIndex: 0, cleared: 6, avg: 78 },
    red: { rankIndex: 0, cleared: 0, ghosts: 0, best: null },
    secrets: 4,
  },
  {
    id: 'aisha-rahman', name: 'Aisha Rahman', role: 'Head of Digital Banking',
    blue: { rankIndex: 0, cleared: 2, avg: 68 },
    red: { rankIndex: 0, cleared: 0, ghosts: 0, best: null },
    secrets: 3,
  },
  {
    id: 'david-reyes', name: 'David Reyes', role: 'CEO',
    blue: { rankIndex: 0, cleared: 0, avg: null },
    red: { rankIndex: 0, cleared: 0, ghosts: 0, best: null },
    secrets: 0,
  },
];

export const LIVE_URL = 'https://nicky-quist.github.io/soc-analyst-simulator/';
