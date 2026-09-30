// Smoke tests for the console as a person uses it: the shell and its navigation,
// the whole core loop on a real dealt case (investigate, respond, report, debrief),
// that the work survives a reload, the shift report, and a secret. They drive the
// screen with the same clicks and typing a person would, and read what a person
// would see, so a refactor that breaks the app fails here even when every engine
// test still passes.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SOCAnalystSim from '../src/SOCAnalystSim.jsx';
import { NAV_GROUPS } from '../src/app/nav.js';
import { RED_OPS } from '../src/data/redops.js';
import { SCENARIOS } from '../src/data/scenarios/index.js';
import { RED_PROGRESS_KEY } from '../src/engine/redProgressStore.js';
import { RUN_SIZE } from '../src/engine/fasttriage.js';
import { instantiateScenario } from '../src/engine/scenarioVariants.js';

const SHIFT_KEY = 'soc-analyst-sim:shift:v2';
const EGGS_KEY = 'soc-analyst-sim:eggs:v1';

const nav = () => within(screen.getByRole('navigation', { name: 'Console sections' }));
const goTo = (label) => fireEvent.click(nav().getByRole('button', { name: label }));
const openTab = (name) => fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }));

// The case on screen, as the scenario the console dealt: found by its alert
// reference, then given the same per-shift identifiers the console gave it.
function currentScenario() {
  const ref = document.querySelector('main code').textContent;
  const saved = JSON.parse(window.localStorage.getItem(SHIFT_KEY));
  const base = SCENARIOS.find((s) => s.alert.ref === ref);
  return instantiateScenario(base, `${saved.shiftStartedAt}:${saved.deal}`);
}

// Works the open case start to finish with the calls the scenario's own ground
// truth says are right. Returns the scenario it worked.
async function workCurrentCase() {
  const scenario = currentScenario();
  const truth = scenario.truth;

  openTab('Investigate');
  const key = truth.requiredSearches[0];
  const search = scenario.searches.find((s) => s.id === key || s.satisfies === key);
  fireEvent.change(screen.getByLabelText('Search query'), {
    target: { value: `index=${search.match.index} ${(search.match.terms || []).join(' ')}` },
  });
  fireEvent.change(screen.getByLabelText('Time range'), { target: { value: '30d' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByText(search.note);

  openTab('Respond');
  for (const [i, id] of truth.requiredActions.entries()) {
    const action = scenario.actions.find((a) => a.id === id);
    let el = screen.getByText(action.label);
    while (el && !within(el).queryByRole('button', { name: 'Take action' })) el = el.parentElement;
    fireEvent.click(within(el).getByRole('button', { name: 'Take action' }));
    fireEvent.click(within(el).getByRole('button', { name: 'Confirm' }));
    // Each action taken adds one Result panel to the page.
    await waitFor(() => expect(screen.getAllByText('Result')).toHaveLength(i + 1));
  }

  openTab('Report');
  fireEvent.change(document.getElementById('field-classification'), { target: { value: truth.classification } });
  fireEvent.change(document.getElementById('field-severity'), { target: { value: truth.severity } });
  fireEvent.change(document.getElementById('field-mitre'), { target: { value: truth.mitreTechnique } });
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(truth.mitreTechnique.replace('.', '\\.')) }));
  fireEvent.change(document.getElementById('field-summary'), {
    target: { value: 'Worked the alert from the evidence, contained it, and escalated per the runbook.' },
  });
  fireEvent.change(document.getElementById('field-escalation'), { target: { value: truth.escalation } });
  fireEvent.click(screen.getByRole('button', { name: /Submit report and close alert/ }));
  return scenario;
}

describe('the console shell', () => {
  it('draws the sections in the grouped order the rail is meant to have', () => {
    render(<SOCAnalystSim />);
    const nav = screen.getByRole('navigation', { name: 'Console sections' });
    const labels = within(nav).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(labels).toEqual(NAV_GROUPS.flat().map((v) => v.label));
    expect(labels).toEqual([
      'Dashboard', 'Alert queue',
      'Alert triage', 'Fast triage', 'Red Ops',
      'Your progress', 'Leaderboard',
      'Security org', 'Settings',
    ]);
    // A divider between each of the four groups.
    expect(nav.querySelectorAll('[role="separator"]')).toHaveLength(NAV_GROUPS.length - 1);
  });

  it('starts as a Trainee and a Recruit with a full queue', () => {
    render(<SOCAnalystSim />);
    const header = screen.getByRole('banner');
    expect(within(header).getByText('Blue: Trainee')).toBeTruthy();
    expect(within(header).getByText('Red: Recruit')).toBeTruthy();
    expect(within(header).getByText('7 open')).toBeTruthy();
    expect(within(header).getByText('0 closed')).toBeTruthy();
  });

  it('opens on the view named in the URL hash, and every section answers to its own hash', () => {
    window.location.hash = '#leaderboard';
    render(<SOCAnalystSim />);
    expect(screen.getByRole('heading', { name: 'Leaderboard', level: 1 })).toBeTruthy();
    for (const { id, label } of NAV_GROUPS.flat()) {
      goTo(label);
      expect(window.location.hash).toBe(`#${id}`);
    }
  });

  it('has a skip link that moves focus to the main content without touching the hash', () => {
    render(<SOCAnalystSim />);
    const skip = screen.getByText('Skip to main content');
    fireEvent.click(skip);
    expect(document.activeElement.tagName).toBe('MAIN');
    expect(window.location.hash).not.toBe('#');
  });
});

describe('the core loop on a real dealt case', () => {
  it('investigate, respond, report and debrief, end to end', async () => {
    render(<SOCAnalystSim />);
    goTo('Alert queue');
    const scenario = await workCurrentCase();

    // The case closed, with a score, and the Debrief tab appeared.
    expect(await screen.findByRole('tab', { name: /^Debrief/ })).toBeTruthy();
    expect(within(screen.getByRole('banner')).getByText('1 closed')).toBeTruthy();
    expect(within(screen.getByRole('banner')).getByText('6 open')).toBeTruthy();
    expect(screen.getAllByText(/\/100/).length).toBeGreaterThan(0);

    // The saved shift recorded the closed case with the calls that were made.
    const saved = JSON.parse(window.localStorage.getItem(SHIFT_KEY));
    const result = saved.cases[scenario.id].result;
    expect(result.submission.classification).toBe(scenario.truth.classification);
    expect(result.submission.escalation).toBe(scenario.truth.escalation);
    expect(result.score.overallScore).toBeGreaterThan(0);
  });

  it('keeps the work across a reload', async () => {
    const first = render(<SOCAnalystSim />);
    goTo('Alert queue');
    await workCurrentCase();
    await screen.findByRole('tab', { name: /^Debrief/ });
    first.unmount();

    render(<SOCAnalystSim />);
    expect(within(screen.getByRole('banner')).getByText('1 closed')).toBeTruthy();
    expect(within(screen.getByRole('banner')).getByText('6 open')).toBeTruthy();
  });

  it('explains a search that is right but too narrow instead of showing nothing', async () => {
    render(<SOCAnalystSim />);
    goTo('Alert queue');
    const scenario = currentScenario();
    const search = scenario.searches.find((s) => (s.needsWindow || 0) > 15);
    openTab('Investigate');
    fireEvent.change(screen.getByLabelText('Search query'), {
      target: { value: `index=${search.match.index} ${(search.match.terms || []).join(' ')}` },
    });
    // The time range is left at the console's 15-minute default on purpose.
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/widen the time picker/i)).toBeTruthy();
  });
});

describe('the shift report', () => {
  it('previews mid-shift with the case just closed, copies as text, and closes on Escape', async () => {
    render(<SOCAnalystSim />);
    goTo('Alert queue');
    await workCurrentCase();
    await screen.findByRole('tab', { name: /^Debrief/ });

    goTo('Dashboard');
    fireEvent.click(screen.getByRole('button', { name: /Preview shift report/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Shift report' });
    expect(within(dialog).getByText('Preview: shift still running')).toBeTruthy();
    expect(within(dialog).getByText('1 of 7')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy summary' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    expect(navigator.clipboard.writeText.mock.calls[0][0]).toMatch(/^Shift report: /);

    fireEvent.keyDown(document.body, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Shift report' })).toBeNull());
  });

  it('opens after End shift and stays reopenable from Your progress', async () => {
    render(<SOCAnalystSim />);
    goTo('Alert queue');
    await workCurrentCase();
    await screen.findByRole('tab', { name: /^Debrief/ });

    fireEvent.click(screen.getByRole('button', { name: /^End shift/ }));
    // Escalated and unfinished cases stop for a handoff review first.
    const review = await screen.findByRole('dialog', { name: /Review handoff/ });
    fireEvent.click(within(review).getByRole('button', { name: /end shift/i }));
    const report = await screen.findByRole('dialog', { name: 'Shift report' });
    expect(within(report).getByText('Shift ended')).toBeTruthy();
    expect(within(report).getByRole('button', { name: 'Start next shift' })).toBeTruthy();
    fireEvent.click(within(report).getByRole('button', { name: 'Start next shift' }));

    // A fresh hand was dealt underneath.
    expect(within(screen.getByRole('banner')).getByText('0 closed')).toBeTruthy();
    goTo('Your progress');
    fireEvent.click(screen.getByRole('button', { name: 'Open last shift report' }));
    expect(within(await screen.findByRole('dialog', { name: 'Shift report' })).getByText('Last shift')).toBeTruthy();
  });
});

describe('a secret', () => {
  it('announces once, and keeps the find', async () => {
    render(<SOCAnalystSim />);
    goTo('Alert queue');
    openTab('Investigate');
    fireEvent.change(screen.getByLabelText('Search query'), { target: { value: 'sudo su' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText(/Secret found: Not in the sudoers file/)).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(EGGS_KEY))).toEqual(['sudoers']);
  });
});

describe('the dashboard', () => {
  it('marks the current hour on the alert volume chart and colors the estate feed by severity', () => {
    render(<SOCAnalystSim />);
    goTo('Dashboard');

    // The clock is fixed at 10:00, so the last bar is 10AM and it is called out.
    const chart = screen.getByRole('img', { name: /last bar is the current hour/ });
    const labels = [...chart.querySelectorAll('text')].map((t) => t.textContent.trim());
    expect(labels.slice(-2)).toEqual(['10AM', 'NOW']);

    // The live tail's level badges use the severity palette, not a one-off tone.
    const badges = screen.getAllByText(/^(low|medium)$/);
    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) expect(badge.style.color).toContain(`--sev-${badge.textContent}`);
  });
});

describe('Red Ops', () => {
  // Opens the first operation and returns its data, found by the crew on screen.
  function startFirstOperation() {
    goTo('Red Ops');
    fireEvent.click(screen.getAllByRole('button', { name: /Start operation/ })[0]);
    const ops = Object.values(RED_OPS).find((o) => screen.queryByText(o.crew));
    expect(ops, 'an operation opened').toBeTruthy();
    return ops;
  }

  async function playMove(choice) {
    fireEvent.click(await screen.findByRole('button', { name: choice.label }));
    fireEvent.click(screen.getByRole('button', { name: 'Commit move' }));
  }

  const advance = () => fireEvent.click(screen.getByRole('button', { name: /^(Next stage|See the debrief)$/ }));

  it('plays an operation quietly to the end, scores it, and records the run toward a rank', async () => {
    render(<SOCAnalystSim />);
    const ops = startFirstOperation();

    for (const stage of ops.stages) {
      await playMove([...stage.choices].sort((a, b) => b.stealth - a.stealth)[0]);
      expect(await screen.findByText('Slipped past')).toBeTruthy();
      advance();
    }

    // The debrief offers the other side of the same incident, and the run is on record.
    expect(await screen.findByRole('button', { name: /Defend this incident now/ })).toBeTruthy();
    const saved = JSON.parse(window.localStorage.getItem(RED_PROGRESS_KEY));
    expect(saved.history).toHaveLength(1);
    expect(saved.history[0]).toMatchObject({ outcome: 'complete', ghost: true });
  });

  it('burns the operation when every move is loud', async () => {
    render(<SOCAnalystSim />);
    const ops = startFirstOperation();

    for (const stage of ops.stages) {
      await playMove([...stage.choices].sort((a, b) => a.stealth - b.stealth)[0]);
      expect(await screen.findByText('Caught')).toBeTruthy();
      // The ladder always lists Burned as a level; the callout only appears once it happens.
      const burned = screen.queryByText(/Three of your moves were caught/);
      advance();
      if (burned) break;
    }

    await screen.findByRole('button', { name: /Defend this incident now/ });
    expect(JSON.parse(window.localStorage.getItem(RED_PROGRESS_KEY)).history[0].outcome).toBe('burned');
  });
});

describe('Fast Triage', () => {
  it('runs a full set of alerts to a graded review, and lets you go again', async () => {
    render(<SOCAnalystSim />);
    goTo('Fast triage');
    fireEvent.click(screen.getByRole('button', { name: /Start run/ }));

    // Every card takes one answer; the first disposition is enough to get through them all.
    for (let i = 0; i < RUN_SIZE; i += 1) {
      expect(await screen.findByText(`Alert ${i + 1} of ${RUN_SIZE}`)).toBeTruthy();
      fireEvent.click(screen.getAllByRole('button', { name: /^1 / })[0]);
    }

    expect(await screen.findByText('Run review')).toBeTruthy();
    expect(screen.getByText(/^Grade [A-F]$/)).toBeTruthy();
    expect(screen.getByText('Traps fell for')).toBeTruthy();
    expect(screen.getByRole('button', { name: /New run/ })).toBeTruthy();
  });
});
