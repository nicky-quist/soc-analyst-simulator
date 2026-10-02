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
