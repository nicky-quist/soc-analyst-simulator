// Docs screenshots (npm run dev, then node scripts/capture-docs.mjs)

import { mkdirSync, rmSync } from 'node:fs';
import { chromium } from 'playwright-core';

import { SCENARIOS } from '../src/data/scenarios/index.js';
import { instantiateScenario } from '../src/engine/scenarioVariants.js';

const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = process.env.URL || 'http://localhost:5173/';
const OUT = 'docs/img';
const FRAMES = `${OUT}/frames`;
const SHIFT_KEY = 'soc-analyst-sim:shift:v2';

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const browser = await chromium.launch({ executablePath: EDGE, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1, colorScheme: 'light' });
const page = await context.newPage();
// Fixed clock
await page.clock.install({ time: new Date(2026, 8, 29, 10, 0, 0) });
await page.clock.resume();

let frame = 0;
async function shot(name, { still = true, clip } = {}) {
  await page.waitForTimeout(350);
  const opts = { animations: 'disabled', ...(clip ? { clip } : {}) };
  if (still) await page.screenshot({ path: `${OUT}/${name}.png`, ...opts });
  frame += 1;
  await page.screenshot({ path: `${FRAMES}/${String(frame).padStart(2, '0')}-${name}.png`, ...opts });
  console.log(`captured ${name}`);
}

const nav = () => page.getByRole('navigation', { name: 'Console sections' });
const goTo = async (label) => { await nav().getByRole('button', { name: label }).click(); await page.waitForTimeout(250); };
const openTab = async (name) => { await page.getByRole('tab', { name: new RegExp(`^${name}`) }).click(); await page.waitForTimeout(250); };

await page.goto(URL);
await page.waitForSelector('header');

// 1. The dashboard, a fresh shift.
await goTo('Dashboard');
await shot('dashboard');

// 2. The first case in the queue, and the scenario behind it.
await goTo('Alert queue');
const ref = await page.locator('main code').first().textContent();
const saved = JSON.parse(await page.evaluate((k) => window.localStorage.getItem(k), SHIFT_KEY));
const scenario = instantiateScenario(SCENARIOS.find((s) => s.alert.ref === ref), `${saved.shiftStartedAt}:${saved.deal}`);
console.log(`working ${scenario.id}`);
await shot('case-overview', { still: false });

// 3. Investigate
await openTab('Investigate');
const key = scenario.truth.requiredSearches[0];
const search = scenario.searches.find((s) => s.id === key || s.satisfies === key);
await page.getByLabel('Search query').fill(`index=${search.match.index} ${(search.match.terms || []).join(' ')}`);
await page.getByLabel('Time range').selectOption('30d');
await page.getByRole('button', { name: 'Search' }).click();
await page.getByText(search.note).waitFor();
await page.getByText('Reading the result').first().scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, 40));
await shot('investigate');

// 4. Respond
await openTab('Respond');
const harmful = scenario.actions.find((a) => a.verdict === 'harmful' && a.consequence);
const takeAction = async (action) => {
  const card = page.locator('div').filter({ has: page.getByText(action.label, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Take action' }) }).last();
  await card.getByRole('button', { name: 'Take action' }).click();
  await card.getByRole('button', { name: 'Confirm' }).click();
  await page.waitForTimeout(250);
  return card;
};
const harmCard = await takeAction(harmful);
await harmCard.scrollIntoViewIfNeeded();
await shot('respond-harm');

// 5. Then the actions the case needed, and the report.
for (const id of scenario.truth.requiredActions) await takeAction(scenario.actions.find((a) => a.id === id));
await openTab('Report');
const truth = scenario.truth;
await page.locator('#field-classification').selectOption(truth.classification);
await page.locator('#field-severity').selectOption(truth.severity);
await page.locator('#field-mitre').fill(truth.mitreTechnique);
await page.getByRole('button', { name: new RegExp(truth.mitreTechnique.replace('.', '\\.')) }).first().click();
await page.locator('#field-summary').fill('Worked the alert from the evidence, contained it, and escalated per the runbook.');
await page.locator('#field-escalation').selectOption(truth.escalation);
await page.getByRole('button', { name: /Submit report and close alert/ }).click();
await page.getByRole('tab', { name: /^Debrief/ }).waitFor();
await page.evaluate(() => window.scrollTo(0, 0));
await shot('debrief');

// 6. Red Ops: a loud move, and the SOC's reaction beside it.
await goTo('Red Ops');
await page.getByRole('button', { name: /Start operation/ }).first().click();
await page.locator('button[aria-pressed]').first().click();
await page.getByRole('button', { name: 'Commit move' }).click();
await shot('redops');

// 7. Fast Triage: a card mid-run.
await goTo('Fast triage');
await page.getByRole('button', { name: /Start run/ }).click();
await page.waitForTimeout(500);
await shot('fast-triage');

// 8. The leaderboard.
await goTo('Leaderboard');
await shot('leaderboard');

// 9. The shift report.
await goTo('Dashboard');
await page.getByRole('button', { name: /Preview shift report/ }).click();
await page.getByRole('dialog', { name: 'Shift report' }).waitFor();
await shot('shift-report');
await page.keyboard.press('Escape');

await context.close();

// The phone layout, on its own.
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await phone.newPage();
await p.clock.install({ time: new Date(2026, 8, 29, 10, 0, 0) });
await p.clock.resume();
await p.goto(URL);
await p.waitForSelector('header');
await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/mobile.png`, animations: 'disabled' });
console.log('captured mobile');

await browser.close();
console.log(`done: ${frame} frames`);
