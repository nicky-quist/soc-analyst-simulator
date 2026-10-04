// Secrets

import test from 'node:test';
import assert from 'node:assert/strict';

import { EGGS, EGG_BY_ID, REPO_URL } from '../src/data/easterEggs.js';
import { SCENARIOS } from '../src/data/scenarios/index.js';
import { RED_OPS } from '../src/data/redops.js';
import { FAST_ALERTS } from '../src/data/fasttriage.js';
import {
  KONAMI, QUICK_CLOSE_MS, announce, createBurst, createKonami, matchDeadEven, matchDecode,
  matchFastTriage, matchGhostwire, matchIntel, matchNightOwl, matchQuickClose, matchRedRun,
  matchReport, matchSearch, secretSearchResult, subscribe,
} from '../src/engine/easterEggs.js';
import { EGGS_KEY, clearFound, loadFound, saveFound, unlock } from '../src/engine/easterEggsStore.js';
import { dealRun, scoreRun as scoreFast } from '../src/engine/fasttriage.js';
import { abortRun, playStage, scoreRun as scoreRed, startRun } from '../src/engine/redopsRun.js';
import { resetRedProgress } from '../src/engine/redProgress.js';

test('there are about twenty secrets, each with a unique id and something to show', () => {
  assert.equal(EGGS.length, 20);
  assert.equal(new Set(EGGS.map((e) => e.id)).size, EGGS.length);
  for (const e of EGGS) {
    assert.ok(['toast', 'overlay'].includes(e.kind), e.id);
    assert.ok(e.title, e.id);
    if (e.kind === 'toast') assert.ok(e.message, `${e.id} needs a message`);
  }
  assert.ok(EGG_BY_ID.credits, 'the credits egg is required');
  assert.ok(REPO_URL.startsWith('https://github.com/'));
});

test('search secrets match what was typed and nothing else', () => {
  assert.equal(matchSearch('sudo su'), 'sudoers');
  assert.equal(matchSearch('index=auth sudo'), 'sudoers');
  assert.equal(matchSearch('rm -rf /'), 'rm-rf');
  assert.equal(matchSearch('index=auth ; DROP TABLE users'), 'rm-rf');
  assert.equal(matchSearch('index=coffee'), 'coffee');
  assert.equal(matchSearch('index = coffee latte'), 'coffee');
  assert.equal(matchSearch('index=auth pseudonym'), null, 'sudo inside another word is not sudo');
  assert.equal(matchSearch('index=auth 185.220.101.45'), null);
  assert.equal(matchSearch(''), null);
});

test('intel secrets', () => {
  assert.equal(matchIntel('127.0.0.1'), 'localhost');
  assert.equal(matchIntel(' LOCALHOST '), 'localhost');
  for (const ip of ['8.8.8.8', '8.8.4.4', '1.1.1.1', '9.9.9.9']) assert.equal(matchIntel(ip), 'public-dns');
  assert.equal(matchIntel('185.220.101.45'), null);
});

test('report, decode and clock secrets', () => {
  assert.equal(matchReport({ summary: 'Honestly, it was DNS.', remediation: '' }), 'dns-report');
  assert.equal(matchReport({ summary: '', remediation: "it's always dns" }), 'dns-report');
  assert.equal(matchReport({ summary: 'Beaconing over DNS tunnelling', remediation: '' }), null);
  assert.equal(matchDecode('hire me'), 'hire-me');
  assert.equal(matchDecode('Hello, World'), 'hello-world');
  assert.equal(matchDecode('powershell -nop -w hidden'), null);
  assert.equal(matchNightOwl(new Date(2026, 8, 29, 3, 15)), 'night-owl');
  assert.equal(matchNightOwl(new Date(2026, 8, 29, 14, 0)), null);
  assert.equal(matchNightOwl(new Date(2026, 8, 29, 5, 0)), null);
});

test('a quick correct close is a secret; a slow or wrong one is not', () => {
  assert.equal(matchQuickClose(QUICK_CLOSE_MS - 1, true), 'speed-demon');
  assert.equal(matchQuickClose(QUICK_CLOSE_MS, true), null);
  assert.equal(matchQuickClose(30_000, false), null);
  assert.equal(matchQuickClose(null, true), null);
});

test('dead even needs the same incident and the same number', () => {
  const redOps = { scenarioId: 'aws-key-leak', evasionScore: 60 };
  assert.equal(matchDeadEven(redOps, 'aws-key-leak', 60), 'dead-even');
  assert.equal(matchDeadEven(redOps, 'aws-key-leak', 61), null);
  assert.equal(matchDeadEven(redOps, 'phishing-bec-ambiguous', 60), null);
  assert.equal(matchDeadEven(null, 'aws-key-leak', 60), null);
});

test('Fast Triage secrets: wolf, flawless, nap', () => {
  const run = dealRun(9);
  const answersOf = (fn) => Object.fromEntries(run.map((a) => [a.id, { choice: fn(a), ms: 5000 }]));
  assert.equal(matchFastTriage(scoreFast(run, answersOf(() => 'ir'))), 'wolf');
  assert.equal(matchFastTriage(scoreFast(run, answersOf((a) => a.disposition))), 'flawless');
  assert.equal(matchFastTriage(scoreFast(run, {})), 'nap');
  assert.equal(matchFastTriage(scoreFast(run, answersOf(() => 'close'))), null);
  assert.equal(matchFastTriage(null), null);
});

test('Red Ops secrets: fastest burn, stage fright, ghostwire', () => {
  const ops = RED_OPS['aws-key-leak'];
  const loudest = (stage) => [...stage.choices].sort((a, b) => a.stealth - b.stealth)[0];
  let burned = startRun();
  for (const stage of ops.stages) if (burned.status === 'active') burned = playStage(burned, ops, loudest(stage).id);
  assert.equal(matchRedRun(scoreRed(ops, burned)), 'fastest-burn');
  assert.equal(matchRedRun(scoreRed(ops, abortRun(startRun()))), 'stage-fright');
  const midway = abortRun(playStage(startRun(), ops, ops.stages[0].choices[0].id));
  assert.equal(matchRedRun(scoreRed(ops, midway)), null);

  const ids = Object.keys(RED_OPS);
  const ghosts = ids.map((operationId) => ({ operationId, ghost: true }));
  assert.equal(matchGhostwire(ghosts, ids), 'ghostwire');
  assert.equal(matchGhostwire(ghosts.slice(1), ids), null);
  assert.equal(matchGhostwire([], []), null);
});

test('the Konami code completes on the exact sequence and resets after', () => {
  const push = createKonami();
  const results = KONAMI.map((k) => push(k));
  assert.equal(results.at(-1), true);
  assert.ok(results.slice(0, -1).every((r) => r === false));
  assert.equal(KONAMI.map((k) => push(k)).at(-1), true, 'works again straight after');

  const stray = createKonami();
  const broken = [...KONAMI.slice(0, 5), 'x', ...KONAMI.slice(5)].map((k) => stray(k));
  assert.ok(broken.every((r) => r === false), 'a stray key in the middle breaks the code');

  const capital = createKonami();
  const withCapitals = KONAMI.map((k) => capital(k === 'b' ? 'B' : k === 'a' ? 'A' : k));
  assert.equal(withCapitals.at(-1), true, 'letters are case-insensitive');
});

test('a burst needs enough events inside the window', () => {
  const burst = createBurst(5, 3000);
  assert.deepEqual([0, 500, 1000, 1500].map((t) => burst(t)), [false, false, false, false]);
  assert.equal(burst(2000), true);
  const slow = createBurst(5, 3000);
  assert.ok([0, 1000, 2000, 3000, 4000, 5000].every((t) => slow(t) === false), 'too slow never fires');
});

test('announcements reach subscribers until they unsubscribe', () => {
  const seen = [];
  const off = subscribe((e) => seen.push(e));
  announce('sudoers');
  announce(null, 'reset');
  off();
  announce('coffee');
  assert.deepEqual(seen, [{ id: 'sudoers', type: 'found' }, { id: null, type: 'reset' }]);
});

test('no real scenario search or intel lookup trips a secret', () => {
  for (const scenario of SCENARIOS) {
    for (const search of scenario.searches) {
      const typed = `index=${search.match.index} ${(search.match.terms || []).join(' ')}`;
      assert.equal(matchSearch(typed), null, `${scenario.id}/${search.id}: ${typed}`);
    }
    for (const indicator of Object.keys(scenario.intel || {})) {
      assert.equal(matchIntel(indicator), null, `${scenario.id}: ${indicator}`);
    }
  }
});

test('no Fast Triage card or Red Ops choice text is a secret trigger', () => {
  for (const alert of FAST_ALERTS) {
    assert.equal(matchSearch(alert.rule), null, alert.id);
    assert.equal(matchReport({ summary: alert.tell, remediation: '' }), null, alert.id);
  }
});

// ── storage ──

function withFakeStorage(fn) {
  const data = new Map();
  const previous = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (k) => (data.has(k) ? data.get(k) : null),
      setItem: (k, v) => { data.set(k, String(v)); },
      removeItem: (k) => { data.delete(k); },
    },
  };
  try { fn(data); } finally { globalThis.window = previous; }
}

test('finds round-trip, ignore unknown ids, and only ever add', () => {
  withFakeStorage(() => {
    let found = [];
    const first = unlock(found, 'sudoers');
    assert.equal(first.isNew, true);
    found = first.found;
    assert.equal(unlock(found, 'sudoers').isNew, false, 'a second find is not new');
    assert.equal(unlock(found, 'not-a-secret').isNew, false);
    saveFound(found);
    assert.deepEqual(loadFound(), ['sudoers']);
  });
});

test('corrupt storage or unknown ids load as an empty list', () => {
  withFakeStorage((data) => {
    data.set(EGGS_KEY, '{nope');
    assert.deepEqual(loadFound(), []);
    data.set(EGGS_KEY, JSON.stringify(['sudoers', 'made-up', 3]));
    assert.deepEqual(loadFound(), ['sudoers']);
  });
});

test('only the Settings button forgets finds, and Reset everything never does', () => {
  withFakeStorage((data) => {
    saveFound(['credits', 'konami']);
    // Reset everything
    resetRedProgress({ history: [{ x: 1 }], checkpointRankIndex: 1 });
    assert.deepEqual(loadFound(), ['credits', 'konami']);
    clearFound();
    assert.deepEqual(loadFound(), []);
    assert.ok(!data.has(EGGS_KEY));
  });
});

test('every secret has a hint, and no hint is left without a secret', async () => {
  const { EGG_HINTS } = await import('../src/data/easterEggs.js');
  assert.deepEqual(Object.keys(EGG_HINTS).sort(), EGGS.map((e) => e.id).sort());
  for (const [id, hint] of Object.entries(EGG_HINTS)) {
    assert.ok(hint.length > 20, `${id} needs a real hint`);
  }
});

test('hints nudge without handing over the exact input', async () => {
  const { EGG_HINTS } = await import('../src/data/easterEggs.js');
  // Literal answers that would make a hint a spoiler.
  const spoilers = { sudoers: /sudo\b/i, 'rm-rf': /rm\s+-rf|drop table/i, coffee: /index\s*=/i, localhost: /127\.0\.0\.1/, 'public-dns': /8\.8\.8\.8|1\.1\.1\.1/, 'hello-world': /hello,? world/i, 'hire-me': /hire me/i };
  for (const [id, pattern] of Object.entries(spoilers)) {
    assert.ok(!pattern.test(EGG_HINTS[id]), `${id} hint gives the answer away`);
  }
});

test('a secret search gets its joke as the result, every time, and ordinary searches get nothing', () => {
  const r = secretSearchResult('sudo');
  assert.equal(r.status, 'secret');
  assert.equal(r.title, EGG_BY_ID.sudoers.title);
  assert.equal(r.detail, EGG_BY_ID.sudoers.message);
  assert.deepEqual(secretSearchResult('sudo'), r, 'the same reply on a repeat search');
  assert.equal(secretSearchResult('index=coffee').title, EGG_BY_ID.coffee.title);
  assert.equal(secretSearchResult('rm -rf /').title, EGG_BY_ID['rm-rf'].title);
  assert.equal(secretSearchResult('index=auth 185.220.101.45'), null);
});
