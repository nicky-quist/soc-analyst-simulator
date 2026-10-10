# Design

How grading, progression and the deal work, the decisions behind them, and how the project is built and tested. For the short version, see the [README](../README.md).

## Grading

A case is scored on four things, because a shift is judged on four things:

| Component | Weight |
|---|---|
| Classification | 20 |
| Escalation decision | 20 |
| Severity (half credit one step off) | 10 |
| MITRE ATT&CK technique (parent technique counts) | 10 |
| Written report rubric | 25 |
| Response actions taken | 15 |

**"✓ Resolved correctly"** requires the right classification and escalation — and the correct escalation is not always upward: across the nineteen scenarios the right answer is IR nine times, Tier 2 six times, and close-without-escalating four times, so over-escalating is a scored error too. It also requires a severity that isn't wildly off, a report complete enough to hand over, and no harmful action. **Investigation coverage**, **time to decision**, and **search efficiency** are reported next to the score but deliberately excluded from it — the score grades the case, and folding process into it hides which one you actually got wrong. The CISO covers the process instead: getting the right answer without running the checks earns "right answer, wrong process."

## Progress across shifts

A shift grades seven cases and then forgets them, which can't answer what a trainee actually wants to know: what do I keep getting wrong? **Your progress** (the trend icon in the rail) keeps a record of every case you close across shifts, splits each into the individual calls the grader already scores (classification, escalation, severity, ATT&CK mapping, investigation coverage, response, report, and response time), and shows your rate and recent trend for each. It also tracks which way your escalation mistakes lean, since under- and over-escalating are different habits with different costs.

The record is kept honest on purpose:

- **First attempts only.** A retry comes after the debrief has shown you the answer, so counting it would measure recall of the debrief.
- **Learn mode excludes a case.** Opening the walkthrough means the evidence was pointed out, not found.
- **One bad case is not a weakness.** Rates are smoothed, and a skill needs four scored cases before it can be named.

**The adaptive deal.** Once a skill is consistently weak, the next shift is weighted toward scenarios that exercise it, and the dashboard says so. Each rule targets what trips that skill rather than anything related to it. Most of the library needs escalating, so an under-escalator is dealt the cases whose alert *undersells* them (reported MEDIUM, really CRITICAL), not simply cases that need escalating. For severity, it's the alerts reported two or more steps off. Where the library doesn't vary on anything that predicts a skill (fourteen of nineteen scenarios need exactly four checks, for example), the only signal used is which scenarios you slipped on before. It's a weighting, not a filter, so the mix quotas still hold on every focused shift, and the tests check that each rule moves its main target's chance of being dealt by at least 0.10.

The focus is decided when a shift is dealt and stored with it. The queue is re-derived from the shift on every load, so reading live history instead would re-deal a different hand the moment you closed a case, and drop your open ones. A golden file of 900 hands pins the unfocused deal so it can't drift unnoticed. It is regenerated, deliberately, whenever the library grows, which re-deals any shift saved before that change.

## Design notes

- **Works on a phone and from the keyboard.** Every tab was checked at 375px wide and on a short landscape phone: nothing scrolls the page sideways, tab strips wrap instead of hiding tabs behind a scrollbar, and buttons get a 40px touch target. From the keyboard there is a skip-to-content link, the tab strips follow the ARIA pattern (arrow keys, one tab stop), every icon button has an accessible name, form labels point at their controls, and the dialogs move focus in, keep it inside, close on Escape and give focus back. Animations stop under `prefers-reduced-motion`. Text colors are held to WCAG AA (4.5:1) in both themes by a test that parses the real palette, which is how the low-contrast helper text and the light theme's informational badges were found.
- **Deterministic and offline**, in both the grader and the Triage engine: no API key, no third-party calls. Scoring is rubric-based, not an LLM call, so it's auditable and reproducible.
- **Rubric keywords live with the scenario they grade**, so rewording a report point can't silently drop it from the grade. Matching is word-boundary based rather than substring — "HR" has to be the word *HR*, not the "hr" inside "through" — and a trailing `*` marks a stem (`isolat*` credits isolate/isolated/isolation).
- **Some report points are graded on what you didn't write.** The false-positive scenario checks you never recommended blocking your own scanner; the insider scenario checks you didn't state theft as established fact. Negation and hedging pass — "do not block this host" and "potential data theft pending review" are correct analyst writing; "the employee stole records" is the thing being caught.
- **Personas are rule-based**, driven by harm caused, escalation direction, investigation coverage and severity distance rather than per-scenario scripts, so they generalize when scenarios are added. Stakeholder reactions to harmful actions live with the action itself, which is what lets a damaging click answer back immediately instead of at grading time.
- **ATT&CK is kept because analysts really use it** — SIEM detections ship with technique IDs and case tools ask for one on every incident. It's a picker over plausible candidates rather than free text, since choosing between neighboring techniques is the actual difficulty.
- **Roadmap**: extending cosmetic-identifier randomization's `variables` pattern to a couple of remaining edge cases (the C2 address baked into `malicious-powershell-precursor`'s base64 blob, a linked derived string in `mfa-push-fatigue`); Red Ops for more of the scenarios (the cloud and availability cases now have one each; the identity and insider cases are next); an async, share-code two-player mode for Red Ops; more scenario categories (next would be OT/ICS); and a live-telemetry mode fed by an isolated VM lab (see [`LAB_SETUP.md`](../LAB_SETUP.md)) instead of static data.

## Tech

React 19 and Vite. Everything runs in the browser except the optional Online leaderboard, which uses Supabase (GitHub sign-in, row-level security) and lazy-loads its client so offline play stays light.

```bash
npm install
npm run dev
```

```
src/
  SOCAnalystSim.jsx  the app: owns the shift state and the handlers, and hands everything else props
  app/
    storage.js       the saved shift and progress, opening a shift, starting a case clock (no React)
    nav.js           the nine sections in their four groups: one list drives the rail, the #hash routing and the tests
    appCss.js        layout, breakpoints, focus rings, reduced motion, the print layout
  data/
    scenarios/       one file per alert: datasets, searches, intel, actions, ground truth
    techniques       51-technique ATT&CK catalog for the picker
    estate           shift-wide dashboard data, seeded per shift: volume, funnel, sources, coverage, feed
    fasttriage       the 36-card Fast triage pool, with ground truth and the deciding detail for each
    redops, easterEggs, leaderboard, triage-samples
  engine/            everything that decides something, all pure: query parser and executor, intel lookup,
                     scoring, personas, case state, the shift deal, cross-shift progress and the adaptive focus,
                     Red Ops runs and career, Fast triage, the leaderboards, the shift report, secrets
    triage/          the Triage tab's rule engine: format detection, analysis, input validation
  components/        AppRail, AppHeader, CaseWorkspace, the dashboard, one module per case tab, and each view
  ui/                primitives, SVG charts, icons, the dialog focus hook
tests/               386 tests across 22 files, run by Node's built-in runner (triage/ holds the Triage engine's)
tests-ui/            14 smoke tests that drive the console in jsdom
scripts/             regenerates the README's screenshots and tour clip from the real app
```

There are two test runners, on purpose. The engines are unit-tested with Node's built-in runner, which needs nothing installed:

```bash
npm test          # the engines and pure modules
npm run test:ui   # the console, driven in jsdom under Vitest
npm run test:all  # both
```

CI runs lint, both suites, the build and the deploy on every push to `main`.

**The UI smoke tests** work a real dealt case start to finish the way a person does: they open the queue, run one of the scenario's required searches with the time range widened, take its required actions, fill in and submit the report, and check the Debrief and the header counts. They also check that the work survives a reload, that the shift report previews and copies and closes on Escape, that End shift opens the report and a fresh hand is dealt under it, that the rail draws the sections in the grouped order, that a secret announces once, that a search which is right but too narrow explains itself, that a Red Ops operation plays to the end (quietly to a ghost run, loudly to a burn) and is recorded, that a Fast Triage run reaches a graded review, and that the dashboard marks the current hour and colors the estate feed by severity. The end-to-end cases have a 20-second limit, because they take about four on a healthy machine and the default of five made them fail at random. Each reads the scenario's own ground truth to decide what to do, so the same tests cover whichever alert the console deals. To check they are worth having, two deliberate breakages were tried (a Submit button that does nothing, and two rail entries swapped) and each was caught.

The tests that matter most: a textbook-perfect case scores exactly 100 on every scenario (which catches a rubric point that has quietly stopped being reachable), every required search is reachable and every required intel lookup resolves (which catches a scenario whose investigation path has been broken by an edit), every scenario offers at least one way to make things worse, and each search failure mode returns its own distinguishable diagnostic. The deal has its own suite: every hand over hundreds of seeds holds its mix quotas, hands differ from each other but never mid-shift, and every scenario in the library gets dealt eventually. The progress suite checks that the record only counts first, unassisted attempts, that no weakness is named from too few cases, that a focused shift still keeps every quota, that each focus rule lifts its target's chance of being dealt by at least 0.10, and that the unfocused deal still matches its golden file of 900 hands.

Fast triage has 18 tests: the pool is well-formed, every one of 300 seeded runs keeps its mix and both trap types, every alert is eventually dealt, a perfect run scores 100, closing everything scores worse than escalating everything, one missed IR page caps an otherwise clean run at C, and saved runs round-trip and are cleared by Reset everything.

The Triage engine has 126 tests of its own. They check each format's verdicts and the relative ordering of severities, the input-rejection rules, and a contract that must hold for every input: every field present, values in range, the same verdict every time, no crash on hostile input, and no network call.
