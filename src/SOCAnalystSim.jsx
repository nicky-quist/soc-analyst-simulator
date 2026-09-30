import { useCallback, useEffect, useMemo, useState } from 'react';
import { APP_CSS } from './app/appCss.js';
import {
  EMPTY_CASE, EMPTY_SHIFT, SHIFT_RESET_MS, focusFor, loadProgress, loadShift, openShift, saveProgress, saveShift,
  startClock, viewFromHash,
} from './app/storage.js';
import { SCENARIOS } from './data/scenarios/index.js';
import { buildShift } from './data/estate.js';
import { RED_OPS } from './data/redops.js';
import { EGGS } from './data/easterEggs.js';
import { dealShift } from './engine/deal.js';
import { runQuery } from './engine/query.js';
import { lookupIndicator } from './engine/intel.js';
import { scoreCase, isResolvedCorrectly, searchKey } from './engine/scoring.js';
import { advanceCheckpoint, buildRecord, careerStatus, emptyProgress, recordCase } from './engine/progress.js';
import { generateShiftSummary } from './engine/personas.js';
import { warRoomTriggered, followOnFor, withWarRoom } from './engine/warroom.js';
import { clearFastTriageRuns, loadFastTriageRuns } from './engine/fasttriageStore.js';
import { loadFound } from './engine/easterEggsStore.js';
import { buildBoards } from './engine/leaderboard.js';
import { buildShiftReport, standingFromBoards } from './engine/shiftReport.js';
import { clearLastReport, loadLastReport, saveLastReport } from './engine/shiftReportStore.js';
import {
  announce, createBurst, matchDeadEven, matchDecode, matchGhostwire, matchIntel, matchNightOwl,
  matchQuickClose, matchReport, matchSearch,
} from './engine/easterEggs.js';
import { advanceRedCheckpoint, buildRedRecord, recordRedRun, redStatus, resetRedProgress } from './engine/redProgress.js';
import { loadRedProgress, saveRedProgress } from './engine/redProgressStore.js';
import { withRedOpsTarget } from './engine/redops.js';
import { instantiateScenario } from './engine/scenarioVariants.js';
import { slaState } from './engine/case.js';
import { decodeBase64 } from './engine/decode.js';
import { buildShiftHandoff } from './engine/handoff.js';
import { C, FONT } from './theme.js';
import AppHeader from './components/AppHeader.jsx';
import AppRail from './components/AppRail.jsx';
import CaseWorkspace from './components/CaseWorkspace.jsx';
import Dashboard from './components/Dashboard.jsx';
import EggHost from './components/EggHost.jsx';
import EndShiftModal from './components/EndShiftModal.jsx';
import FastTriageView from './components/FastTriageView.jsx';
import LeaderboardView from './components/LeaderboardView.jsx';
import ProgressView from './components/ProgressView.jsx';
import RedOpsView from './components/RedOpsView.jsx';
import SettingsView from './components/SettingsView.jsx';
import ShiftReportCard from './components/ShiftReportCard.jsx';
import TeamTab from './components/TeamTab.jsx';
import TriageView from './components/TriageView.jsx';

// Announce a secret if there is one; matchers return null when nothing matched.
function announceEgg(id) {
  if (id) announce(id);
}

// The Triage tab's working state: what's pasted, the latest verdict, and this session's history.
const EMPTY_TRIAGE = { input: '', result: null, issues: [], history: [], guideOpen: false, guideFormat: 0 };

export default function SOCAnalystSim() {
  const [progress, setProgress] = useState(loadProgress);
  // The attacker-side career: its own record and its own checkpoint rank.
  const [redProgress, setRedProgress] = useState(loadRedProgress);
  // Bursts for two secrets: flipping the theme many times fast, clicking the logo.
  const [themeBurst] = useState(() => createBurst(10, 6000));
  const [logoBurst] = useState(() => createBurst(5, 3000));
  const [shift, setShift] = useState(() => {
    const opened = openShift(loadShift(), loadProgress());
    const linked = viewFromHash();
    return linked ? { ...opened, view: linked } : opened;
  });
  // Kept here rather than in the view so leaving the tab doesn't lose the work.
  const [triage, setTriage] = useState(EMPTY_TRIAGE);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tab, setTab] = useState('overview');
  const [walkthrough, setWalkthrough] = useState(false);
  const [showEndShiftReview, setShowEndShiftReview] = useState(false);
  // The shift report card: what is showing now (or null), and the last one saved.
  const [reportView, setReportView] = useState(null);
  const [lastReport, setLastReport] = useState(loadLastReport);
  const [now, setNow] = useState(() => Date.now());

  // The console header and the dashboard have to agree about which shift this
  // is, so both read the same builder off the same seed. startClock() stamps
  // shiftStartedAt on the first render, so the `now` fallback is only ever the
  // value for that one frame.
  const seedAt = shift.shiftStartedAt || now;
  const shiftHeader = useMemo(() => buildShift(seedAt, shift.deal), [seedAt, shift.deal]);

  // Your seven for this shift, dealt from the library and stable for as long as
  // the shift is. Scenarios that declare `variables` (see engine/scenarioVariants.js)
  // get their attacker IP / hostname / service account re-rolled per shift, keyed
  // off the same (seedAt, deal) as the deal itself so a reload never changes them.
  const queue = useMemo(() => {
    const hand = withWarRoom(
      withRedOpsTarget(
        dealShift(seedAt, shift.deal, undefined, shift.focus, new Set(shift.previousHandIds || [])),
        shift.redOpsTarget,
        SCENARIOS
      ),
      shift.warRoom
    );
    const seedKey = `${seedAt}:${shift.deal}`;
    return hand.map((s) => instantiateScenario(s, seedKey));
  }, [seedAt, shift.deal, shift.focus, shift.warRoom, shift.redOpsTarget, shift.previousHandIds]);

  const scenario = queue[Math.min(currentIndex, queue.length - 1)];
  const caseFile = shift.cases[scenario.id] || EMPTY_CASE;
  const result = caseFile.result;
  const closed = !!result;

  // Also the stale-tab watchdog for the shift auto-reset: a tab left open past
  // SHIFT_RESET_MS gets its board wiped on the next tick, the same way loadShift()
  // would treat it on a fresh load. Folded into the existing ticker (rather than
  // its own effect calling setState directly) so the reset only ever happens
  // from inside a timer callback, never synchronously during an effect body.
  useEffect(() => {
    const id = setInterval(() => {
      const nowTs = Date.now();
      setNow(nowTs);
      setShift((prev) => {
        if (!prev.shiftStartedAt || nowTs - prev.shiftStartedAt <= SHIFT_RESET_MS) return prev;
        // Read progress from storage: this interval closes over the first render's state.
        const oldHandIds = dealShift(
          prev.shiftStartedAt, prev.deal, undefined, prev.focus, new Set(prev.previousHandIds || [])
        ).map((s) => s.id);
        const fresh = {
          ...openShift({ ...EMPTY_SHIFT, deal: prev.deal + 1, previousHandIds: oldHandIds }, loadProgress()),
          theme: prev.theme,
        };
        saveShift(fresh);
        return fresh;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // The theme attribute lives on the document root, not on this component's
  // wrapper, so <body> and the overscroll area repaint with everything else.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', shift.theme);
  }, [shift.theme]);

  function update(fn) {
    setShift((prev) => {
      const next = fn(prev);
      saveShift(next);
      return next;
    });
  }

  function updateCase(fn) {
    update((prev) => {
      const current = prev.cases[scenario.id] || EMPTY_CASE;
      return { ...prev, cases: { ...prev.cases, [scenario.id]: fn(current) } };
    });
  }

  function stamp() {
    return caseFile.startedAt ? Date.now() - caseFile.startedAt : 0;
  }

  function note(current, kind, text) {
    return [...current.timeline, { at: stamp(), kind, text }];
  }

  function handleSearch(query, range) {
    announceEgg(matchSearch(query) || matchNightOwl());
    const searchResult = runQuery(scenario, query, range);
    const matched = searchResult.status === 'ok'
      ? scenario.searches.find((s) => s.id === searchResult.searchId)
      : null;

    updateCase((current) => ({
      ...current,
      lastRange: range,
      searches: [...current.searches, { query: query.trim(), range, at: stamp(), result: searchResult }],
      searchKeys: matched && !current.searchKeys.includes(searchKey(matched))
        ? [...current.searchKeys, searchKey(matched)]
        : current.searchKeys,
      noiseSearches: searchResult.status === 'ok' ? current.noiseSearches : current.noiseSearches + 1,
      timeline: note(
        current,
        searchResult.status === 'ok' ? 'search' : 'empty',
        searchResult.status === 'ok'
          ? `Searched ${query.trim()} — ${searchResult.events.length} events`
          : `Searched ${query.trim()} — ${searchResult.title}`
      ),
    }));
  }

  function handleLookup(value) {
    announceEgg(matchIntel(value));
    const lookup = lookupIndicator(scenario, value);
    updateCase((current) => ({
      ...current,
      intel: [...current.intel, { value: value.trim(), at: stamp(), result: lookup }],
      intelChecked: lookup.status === 'found' && !current.intelChecked.includes(lookup.indicator.value)
        ? [...current.intelChecked, lookup.indicator.value]
        : current.intelChecked,
      timeline: note(
        current,
        'intel',
        lookup.status === 'found'
          ? `Enriched ${lookup.indicator.value} — ${lookup.record.verdict}`
          : `Enriched ${value.trim()} — ${lookup.title}`
      ),
    }));
  }

  function handleDecode(input) {
    const decoded = decodeBase64(input);
    if (decoded.ok) announceEgg(matchDecode(decoded.text));
    updateCase((current) => ({
      ...current,
      decodes: [...current.decodes, { at: stamp(), result: decoded }],
      timeline: note(current, 'decode', decoded.ok ? 'Decoded a base64 blob' : 'Attempted to decode an invalid base64 string'),
    }));
  }

  function handleAct(actionId) {
    const action = scenario.actions.find((a) => a.id === actionId);
    updateCase((current) => ({
      ...current,
      actions: current.actions.includes(actionId) ? current.actions : [...current.actions, actionId],
      timeline: note(current, action.verdict === 'harmful' ? 'harm' : 'action', `Action taken — ${action.label}`),
    }));
  }

  function handleForm(form) {
    updateCase((current) => ({ ...current, form }));
  }

  function handleSubmit() {
    const score = scoreCase(scenario, caseFile.form, {
      searchesRun: caseFile.searchKeys,
      intelChecked: caseFile.intelChecked,
      actionsTaken: caseFile.actions,
      noiseSearches: caseFile.noiseSearches,
      assisted: caseFile.assisted,
      elapsedMs: caseFile.startedAt ? Date.now() - caseFile.startedAt : null,
    });
    // Secrets only announce; none of this reads back into the score or history.
    announceEgg(matchReport(caseFile.form));
    announceEgg(matchQuickClose(caseFile.startedAt ? Date.now() - caseFile.startedAt : null, isResolvedCorrectly(score)));
    announceEgg(matchDeadEven(shift.redOps, scenario.id, score.overallScore));
    const record = buildRecord({
      scenario,
      submission: caseFile.form,
      score,
      attempt: caseFile.attempts + 1,
      closedAt: Date.now(),
      shiftStartedAt: shift.shiftStartedAt,
      deal: shift.deal,
    });
    setProgress((prev) => {
      const next = recordCase(prev, record);
      if (!next.recorded) return next.progress;
      // A rank is a checkpoint: once earned it never drops back down, even if
      // history is cleared later — see advanceCheckpoint in progress.js.
      const withCheckpoint = advanceCheckpoint(next.progress, SCENARIOS);
      saveProgress(withCheckpoint);
      return withCheckpoint;
    });
    updateCase((current) => ({
      ...current,
      result: { submission: current.form, score, attempt: current.attempts + 1 },
      attempts: current.attempts + 1,
      timeline: note(current, 'report', `Report submitted — case closed (${score.overallScore}/100)`),
    }));

    // A response bad enough to leave the threat live escalates the shift, once
    // — a second War Room can't stack on top of the first. Injecting it
    // reorders the queue (a 5-minute CRITICAL sorts near the top), which would
    // otherwise leave currentIndex pointing at whatever slid into this case's
    // old slot — so the index is corrected to follow this case, not its slot.
    if (!shift.warRoom && warRoomTriggered(scenario, score)) {
      const newWarRoom = { scenarioId: followOnFor(scenario).id, sourceId: scenario.id, triggeredAt: Date.now() };
      update((prev) => ({ ...prev, warRoom: newWarRoom }));
      const reordered = withWarRoom(queue, newWarRoom);
      const newIndex = reordered.findIndex((s) => s.id === scenario.id);
      if (newIndex !== -1) setCurrentIndex(newIndex);
    }
    setTab('debrief');
  }

  // Demo shortcut: fills in the correct answer and every required search,
  // lookup, and action instantly, then jumps to Debrief — for showing the AI
  // Coach (or anything else on that tab) without working the case for real.
  // Marked assisted, same as Learn Mode, so recordCase() refuses to enter it
  // into progress history — it can never count toward a career promotion.
  function handleSkipToDebrief() {
    const truth = scenario.truth;
    const summary = (truth.requiredReportPoints || [])
      .filter((p) => p.any?.length)
      .map((p) => p.any[0].replace(/\*$/, ''))
      .join('. ');
    const form = {
      classification: truth.classification,
      severity: truth.severity,
      mitreTechnique: truth.mitreTechnique,
      escalation: truth.escalation,
      summary,
      remediation: '',
    };
    updateCase((current) => {
      const searchKeys = truth.requiredSearches || [];
      const intelChecked = truth.requiredIntel || [];
      const actions = truth.requiredActions || [];
      const score = scoreCase(scenario, form, {
        searchesRun: searchKeys,
        intelChecked,
        actionsTaken: actions,
        noiseSearches: 0,
        assisted: true,
        elapsedMs: current.startedAt ? Date.now() - current.startedAt : null,
      });
      return {
        ...current,
        form,
        searchKeys,
        intelChecked,
        actions,
        assisted: true,
        result: { submission: form, score, attempt: current.attempts + 1 },
        attempts: current.attempts + 1,
        timeline: note(current, 'report', `Report submitted — case closed (${score.overallScore}/100)`),
      };
    });
    setTab('debrief');
  }

  // Reopening starts the investigation over rather than letting coverage carry
  // across attempts — the point of a second pass is to work it properly.
  function handleRetry() {
    updateCase((current) => ({
      ...EMPTY_CASE,
      form: current.form,
      attempts: current.attempts,
      assisted: current.assisted,
      startedAt: Date.now(),
    }));
    setTab('overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectScenario(index) {
    setCurrentIndex(index);
    update((prev) => ({ ...prev, view: 'queue' }));
    setTab(shift.cases[queue[index].id]?.result ? 'debrief' : 'overview');
    setWalkthrough(false);
    update((prev) => startClock(prev, queue[index].id));
  }

  // "Defend this incident now" from Red Ops: the scenario may not be part of
  // this shift's dealt hand, so it gets injected the same way a War Room
  // alert does — added to the queue, sorted in, and the index is resolved
  // against that same merged queue rather than the position it doesn't have
  // yet in `queue` from the last render.
  function handleDefendFromRedOps(scenarioId, redRun) {
    update((prev) => ({
      ...prev,
      view: 'queue',
      redOpsTarget: scenarioId,
      redOps: { scenarioId, ...redRun, completedAt: Date.now() },
    }));
    const merged = withRedOpsTarget(
      dealShift(seedAt, shift.deal, undefined, shift.focus, new Set(shift.previousHandIds || [])),
      scenarioId,
      SCENARIOS
    );
    const idx = merged.findIndex((s) => s.id === scenarioId);
    if (idx !== -1) setCurrentIndex(idx);
    setTab(shift.cases[scenarioId]?.result ? 'debrief' : 'overview');
    setWalkthrough(false);
    update((prev) => startClock(prev, scenarioId));
  }

  function toggleWalkthrough() {
    const opening = !walkthrough;
    setWalkthrough(opening);
    setTab('overview');
    if (opening && !closed) updateCase((current) => ({ ...current, assisted: true }));
  }

  // Asking Tier 2 is real help, same as opening Learn Mode — it counts as
  // assisted so the attempt doesn't get credited as unaided skill. Tracked
  // per nudge target (search/intel/action id) so asking about the exact same
  // still-missing thing again gets a more direct answer instead of the same
  // hint on repeat — see engine/mentor.js.
  function handleAskTier2(nudgeKey) {
    if (closed) return;
    updateCase((current) => ({
      ...current,
      assisted: true,
      nudgeAsks: { ...current.nudgeAsks, [nudgeKey]: (current.nudgeAsks?.[nudgeKey] || 0) + 1 },
      timeline: note(current, 'assist', 'Asked Tier 2 for a nudge'),
    }));
  }

  // Reset deals the next hand rather than the same one again — the counter is
  // what makes a second shift a second shift.
  const handleReset = useCallback(() => {
    const fresh = {
      ...openShift({ ...EMPTY_SHIFT, deal: shift.deal + 1, previousHandIds: queue.map((s) => s.id) }, progress),
      theme: shift.theme,
    };
    saveShift(fresh);
    setShift(fresh);
    setCurrentIndex(0);
    setTab('overview');
    setWalkthrough(false);
  }, [shift.theme, shift.deal, progress, queue]);

  // The real "end of shift" action: anything still open or escalated has to
  // go to someone, so a shift with live work doesn't just quietly reset —
  // it stops for a review of who picks each one up. Nothing to hand off
  // means nothing to review, so it ends the same way handleReset always has.
  function handleEndShift() {
    const notes = buildShiftHandoff(queue, shift.cases);
    if (notes.length === 0) {
      endShiftNow();
      return;
    }
    setShowEndShiftReview(true);
  }

  function confirmEndShift() {
    setShowEndShiftReview(false);
    endShiftNow();
  }

  // The report is built from the shift as it stands, before the next hand is
  // dealt over it, then kept so it can be reopened from Your progress.
  function makeReport() {
    const boards = buildBoards({
      progress,
      redProgress,
      found: loadFound(),
      fastRuns: loadFastTriageRuns(),
      library: SCENARIOS,
      operationIds: Object.keys(RED_OPS),
      secretsTotal: EGGS.length,
    });
    return buildShiftReport({
      scenarios: queue,
      cases: shift.cases,
      header: shiftHeader,
      nextFocus: focusFor(progress),
      standing: standingFromBoards(boards),
    });
  }

  function endShiftNow() {
    const report = makeReport();
    saveLastReport(report);
    setLastReport(report);
    handleReset();
    setReportView({ report, mode: 'ended' });
  }

  // A look at the report mid-shift, without ending anything.
  function previewReport() {
    setReportView({ report: makeReport(), mode: 'preview' });
  }

  // Takes effect from the next shift: the current hand was dealt with the
  // focus it has, and changing it now would re-deal the queue under the analyst.
  function toggleAdaptive() {
    setProgress((prev) => {
      const next = { ...prev, adaptive: !prev.adaptive };
      saveProgress(next);
      return next;
    });
  }

  // A rank is a checkpoint, not a reflection of live stats — clearing history
  // (here, or from the Dashboard's "Reset everything") wipes the skill numbers
  // and the adaptive weighting they drive, but never takes back a rank you
  // already earned.
  function clearHistory() {
    setProgress((prev) => {
      const next = { ...emptyProgress(), adaptive: prev.adaptive, checkpointRankIndex: prev.checkpointRankIndex ?? 0 };
      saveProgress(next);
      return next;
    });
  }

  // The Dashboard's "Reset everything" — a genuine fresh start, not just a new
  // hand: clears cross-shift history (skills, adaptive weighting) as well as
  // the current queue, so a score you're about to compare against something
  // isn't carrying baggage from an earlier test run. Your career rank is a
  // checkpoint and survives this, same as clearHistory above.
  const handleFullReset = useCallback(() => {
    const freshProgress = { ...emptyProgress(), adaptive: progress.adaptive, checkpointRankIndex: progress.checkpointRankIndex ?? 0 };
    saveProgress(freshProgress);
    setProgress(freshProgress);
    // Fast triage keeps its own record; forgetting it here keeps "everything" true.
    clearFastTriageRuns();
    // The saved shift report is history too.
    clearLastReport();
    setLastReport(null);
    setReportView(null);
    // Red Ops runs go too; the Red Ops rank is a checkpoint and stays, like the analyst's.
    const freshRed = resetRedProgress(redProgress);
    saveRedProgress(freshRed);
    setRedProgress(freshRed);
    const freshShift = {
      ...openShift({ ...EMPTY_SHIFT, deal: shift.deal + 1, previousHandIds: queue.map((s) => s.id) }, freshProgress),
      theme: shift.theme,
    };
    saveShift(freshShift);
    setShift(freshShift);
    setCurrentIndex(0);
    setTab('overview');
    setWalkthrough(false);
  }, [shift.theme, shift.deal, progress.adaptive, progress.checkpointRankIndex, queue, redProgress]);

  // A finished operation goes on the Red Ops record. Returns the new rank's
  // name when the run earned a promotion, so the debrief can say so.
  function handleRedRunFinished(operationId, result) {
    const ids = Object.keys(RED_OPS);
    const before = redStatus(redProgress.history, ids, redProgress.checkpointRankIndex);
    const next = advanceRedCheckpoint(recordRedRun(redProgress, buildRedRecord(operationId, result)), ids);
    saveRedProgress(next);
    setRedProgress(next);
    const after = redStatus(next.history, ids, next.checkpointRankIndex);
    announceEgg(matchGhostwire(next.history, ids));
    return after.rankIndex > before.rankIndex ? after.rank : null;
  }

  function setView(view) {
    update((prev) => ({ ...prev, view }));
  }

  // Mirror the current tab into the URL so it can be bookmarked or linked.
  useEffect(() => {
    const hash = `#${shift.view}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [shift.view]);

  // And the other way: editing the hash, or following a #link on this page, switches tab.
  useEffect(() => {
    const onHashChange = () => {
      const view = viewFromHash();
      if (view) update((prev) => (prev.view === view ? prev : { ...prev, view }));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []); // update only calls the stable setShift, so subscribing once is enough

  function toggleTheme() {
    if (themeBurst()) announce('flashbang');
    update((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  }

  const closedCases = useMemo(
    () => queue.map((s) => shift.cases[s.id]?.result).filter(Boolean),
    [queue, shift.cases]
  );

  const redRank = useMemo(
    () => redStatus(redProgress.history, Object.keys(RED_OPS), redProgress.checkpointRankIndex),
    [redProgress]
  );
  // Your title is earned, not a fixed label — see engine/progress.js's
  // careerStatus() for the promotion bar.
  const career = useMemo(
    () => careerStatus(progress.history, SCENARIOS, progress.checkpointRankIndex),
    [progress]
  );
  const avgScore = closedCases.length
    ? Math.round(closedCases.reduce((sum, r) => sum + r.score.overallScore, 0) / closedCases.length)
    : null;
  const slaBreaches = queue.filter((s) => slaState(s, shift.cases[s.id], now).breached).length;
  const shiftSummary = closedCases.length === queue.length
    ? generateShiftSummary(queue.map((s) => shift.cases[s.id].result))
    : null;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT, color: C.text }}>
      <a
        className="skip-link"
        href="#"
        onClick={(e) => {
          // Not a hash link: the console's own #view routing owns the hash.
          e.preventDefault();
          const target = document.querySelector('main');
          if (target) { target.setAttribute('tabindex', '-1'); target.focus(); }
        }}
      >
        Skip to main content
      </a>
      <style>{APP_CSS}</style>

      <div className="app-shell">
        <AppRail
          view={shift.view}
          onSelectView={setView}
          openCount={queue.length - closedCases.length}
          onToggleTheme={toggleTheme}
          onEndShift={handleEndShift}
          onLogoClick={() => { if (logoBurst()) announce('credits'); }}
        />

        <div className="app-content">
      <AppHeader
        blueRank={career.rank}
        redRank={redRank.rank}
        shiftWindow={shiftHeader.window}
        openCount={queue.length - closedCases.length}
        closedCount={closedCases.length}
        avgScore={avgScore}
        slaBreaches={slaBreaches}
      />

      {shift.view === 'dashboard' && (
        <main className="sim-main" style={{ maxWidth: 1440, margin: '0 auto', width: '100%' }}>
          <Dashboard
            scenarios={queue}
            cases={shift.cases}
            now={now}
            shiftStartedAt={shift.shiftStartedAt}
            deal={shift.deal}
            focus={shift.focus}
            onOpenAlert={selectScenario}
            progress={progress}
            onFullReset={handleFullReset}
            onPreviewReport={previewReport}
          />
        </main>
      )}

      {shift.view === 'triage' && (
        <main className="sim-main" style={{ maxWidth: 1440, margin: '0 auto', width: '100%' }}>
          <TriageView state={triage} onChange={setTriage} />
        </main>
      )}

      {shift.view === 'fasttriage' && (
        <main className="sim-main" style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <FastTriageView />
        </main>
      )}

      {shift.view === 'redops' && (
        <main className="sim-main" style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
          <RedOpsView onDefend={handleDefendFromRedOps} progress={redProgress} onRunFinished={handleRedRunFinished} />
        </main>
      )}

      {shift.view === 'team' && (
        <main className="sim-main" style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
          <TeamTab progress={progress} closedCases={closedCases} warRoomActive={!!shift.warRoom} rank={career.rank} />
        </main>
      )}

      {shift.view === 'progress' && (
        <main className="sim-main" style={{ maxWidth: 1440, margin: '0 auto', width: '100%' }}>
          <ProgressView
            progress={progress}
            currentFocus={shift.focus}
            onToggleAdaptive={toggleAdaptive}
            onClearHistory={clearHistory}
            hasLastReport={!!lastReport}
            onOpenLastReport={() => lastReport && setReportView({ report: lastReport, mode: 'last' })}
          />
        </main>
      )}

      {shift.view === 'leaderboard' && (
        <main className="sim-main" style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <LeaderboardView progress={progress} redProgress={redProgress} />
        </main>
      )}

      {shift.view === 'settings' && (
        <main className="sim-main" style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <SettingsView />
        </main>
      )}

      {shift.view === 'queue' && (
        <CaseWorkspace
          queue={queue}
          scenario={scenario}
          caseFile={caseFile}
          cases={shift.cases}
          now={now}
          warRoom={shift.warRoom}
          shiftSummary={shiftSummary}
          redOps={shift.redOps}
          walkthrough={walkthrough}
          tab={tab}
          onSelectScenario={selectScenario}
          onEndShift={handleEndShift}
          onSkipToDebrief={handleSkipToDebrief}
          onToggleWalkthrough={toggleWalkthrough}
          onSetTab={setTab}
          onAskTier2={handleAskTier2}
          onSearch={handleSearch}
          onDecode={handleDecode}
          onLookup={handleLookup}
          onAct={handleAct}
          onFormChange={handleForm}
          onSubmit={handleSubmit}
          onRetry={handleRetry}
        />
      )}
        </div>
      </div>

      {reportView && (
        <ShiftReportCard report={reportView.report} mode={reportView.mode} onClose={() => setReportView(null)} />
      )}

      <EggHost stats={{ blueRank: career.rank, redRank: redRank.rank, closed: closedCases.length }} />

      {showEndShiftReview && (
        <EndShiftModal
          scenarios={queue}
          cases={shift.cases}
          onCancel={() => setShowEndShiftReview(false)}
          onConfirm={confirmEndShift}
        />
      )}
    </div>
  );
}
