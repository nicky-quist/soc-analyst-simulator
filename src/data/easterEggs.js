// Secrets

export const EGGS = [
  {
    id: 'sudoers', kind: 'toast', title: 'Not in the sudoers file',
    message: 'You are not in the sudoers file. This incident will be reported.',
  },
  {
    id: 'rm-rf', kind: 'toast', title: 'Nice try',
    from: 'SOC console',
    message: 'That search has been logged, and the SOC is laughing quietly at a desk near you. It ran nothing: this is a simulation.',
  },
  {
    id: 'coffee', kind: 'toast', title: 'Off-book index',
    from: 'SOC console',
    message: 'No such index is onboarded. The break room has one, but it is not in the SIEM.',
  },
  {
    id: 'localhost', kind: 'toast', title: 'There\'s no place like home',
    from: 'Threat intel',
    message: '127.0.0.1 is your own machine. No feed has an opinion about home.',
  },
  {
    id: 'public-dns', kind: 'toast', title: 'Very popular, not very dangerous',
    from: 'Threat intel',
    message: 'Public DNS resolvers appear in every feed and are hostile to none of them. Rarely the culprit, though never rule out the resolver.',
  },
  {
    id: 'dns-report', kind: 'toast', title: 'It\'s always DNS',
    from: 'Jordan Reyes, Tier 2',
    message: 'Nods slowly. Sometimes it really is the DNS. Check the resolver, then check it again.',
  },
  { id: 'konami', kind: 'overlay', title: 'The old code' },
  {
    id: 'flashbang', kind: 'toast', title: 'Flashbang',
    from: 'Marcus Bell, IR Lead',
    message: 'Whoever keeps flipping the lights: the night shift has eyes. Pick one and commit.',
  },
  { id: 'credits', kind: 'overlay', title: 'Behind the console' },
  {
    id: 'wolf', kind: 'toast', title: 'The boy who cried wolf',
    from: 'Priya Anand, SOC Team Lead',
    message: 'Twenty pages in twelve minutes. IR has muted you. Some of those were benign, and knowing which is the job.',
  },
  {
    id: 'fastest-burn', kind: 'toast', title: 'Fastest burn on record',
    from: 'SOC console',
    message: 'Three moves, three alerts. The SOC did not even need coffee.',
  },
  {
    id: 'ghostwire', kind: 'toast', title: 'Ghostwire would like a word',
    from: 'Ghostwire',
    message: 'Every operation, and never seen once. They want to know if you are hiring.',
  },
  {
    id: 'hello-world', kind: 'toast', title: 'Hello, World',
    from: 'Decoder',
    message: 'Every analyst\'s first payload. Harmless, and the only base64 string you will ever be relieved to decode.',
  },
  {
    id: 'hire-me', kind: 'toast', title: 'Message received',
    from: 'Decoder',
    message: 'Noted, and passed to the right people. Good decoding.',
  },
  {
    id: 'night-owl', kind: 'toast', title: 'Night owl',
    from: 'Priya Anand, SOC Team Lead',
    message: 'It is the small hours and you are still working the queue. The alerts do not care what time it is, but the coffee should.',
  },
  {
    id: 'speed-demon', kind: 'toast', title: 'Speed demon',
    from: 'Jordan Reyes, Tier 2',
    message: 'Closed correctly in under ninety seconds. Either you are very good or you read the alert very carefully. Both are fine.',
  },
  {
    id: 'nap', kind: 'toast', title: 'Asleep at the console',
    from: 'Priya Anand, SOC Team Lead',
    message: 'The clock ran out with the whole queue untouched. It happens to everyone once, usually after a long night.',
  },
  {
    id: 'flawless', kind: 'toast', title: 'Flawless',
    from: 'Marcus Bell, IR Lead',
    message: 'Twenty for twenty. IR is sending a fruit basket, and asking how you do it.',
  },
  {
    id: 'dead-even', kind: 'toast', title: 'Dead even',
    from: 'SOC console',
    message: 'Your attack and your defense landed on exactly the same number. Somewhere, a purple team is quietly satisfied.',
  },
  {
    id: 'stage-fright', kind: 'toast', title: 'Stage fright',
    from: 'Ghostwire',
    message: 'You aborted before making a single move. The crew waited, and the crew has left.',
  },
];

export const EGG_BY_ID = Object.fromEntries(EGGS.map((e) => [e.id, e]));

export const REPO_URL = 'https://github.com/nicky-quist/soc-analyst-simulator';

// One nudge per secret. Deliberately vague: enough to point you at the right
// corner of the console without saying exactly what to type or press.
export const EGG_HINTS = {
  sudoers: 'The search bar is not a terminal, but it knows who has root. Ask for power you do not have.',
  'rm-rf': 'Some commands should never go anywhere near production. The search bar has opinions about the worst of them.',
  coffee: 'Not every data source is in the SIEM. Go looking for one in the break room.',
  localhost: 'In Intel, look up the one address that is always home.',
  'public-dns': 'In Intel, look up the resolver everybody has typed into their network settings at least once.',
  'dns-report': 'In a report, blame the usual suspect. Everyone does eventually.',
  konami: 'An old cheat code from before most of the club was born. Arrow keys first, then two letters.',
  flashbang: 'Flip the lights. Quickly, over and over. Someone on the night shift is watching.',
  credits: 'The shield in the corner is more than a logo. Click it like you mean it.',
  wolf: 'In Fast Triage, escalate everything. Every single alert.',
  'fastest-burn': 'In Red Ops, get caught as quickly as you possibly can.',
  ghostwire: 'Be a ghost on every Red Ops operation: complete them all without being seen once.',
  'hello-world': 'In the Decoder, paste the first thing every program ever says.',
  'hire-me': 'In the Decoder, tell the author what you are hoping for.',
  'night-owl': 'Work the queue when the rest of the building is dark.',
  'speed-demon': 'Be right and be quick: a correct close with hardly any time on the clock.',
  nap: 'In Fast Triage, do nothing at all and let every clock run out.',
  flawless: 'In Fast Triage, do not miss a single call.',
  'dead-even': 'Attack an incident in Red Ops, then defend that same incident and match your own score exactly.',
  'stage-fright': 'Start a Red Ops operation, then walk away before making a move.',
};
