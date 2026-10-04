import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { APP_CSS } from './app/appCss.js';
import {
  EMPTY_CASE, SHIFT_RESET_MS, dealtHand, focusFor, loadProgress, loadShift, nextShift, openShift, saveProgress,
  saveShift, startClock, viewFromHash,
} from './app/storage.js';
import { SCENARIOS } from './data/scenarios/index.js';
import { buildShift } from './data/estate.js';
import { RED_OPS } from './data/redops.js';
import { EGGS } from './data/easterEggs.js';
import { runQuery } from './engine/query.js';
import { lookupIndicator } from './engine/intel.js';
import { scoreCase, isResolvedCorrectly, searchKey } from './engine/scoring.js';
import { advanceCheckpoint, buildRecord, careerStatus, emptyProgress, recordCase } from './engine/progress.js';
import { generateShiftSummary } from './engine/personas.js';
import { warRoomTriggered, followOnFor, withWarRoom } from './engine/warroom.js';
import { clearFastTriageRuns, loadFastTriageRuns } from './engine/fasttriageStore.js';
import { loadFound } from './engine/easterEggsStore.js';
import { standingPayload } from './engine/online.js';
import { pushStandingQuietly } from './lib/onlineApi.js';
import { buildBoards } from './engine/leaderboard.js';
import { buildShiftReport, standingFromBoards } from './engine/shiftReport.js';
import { clearLastReport, loadLastReport, saveLastReport } from './engine/shiftReportStore.js';
import {
  announce, createBurst, matchDeadEven, matchDecode, matchGhostwire, matchIntel, matchNightOwl,
  matchQuickClose, matchReport, matchSearch, secretSearchResult,
} from './engine/easterEggs.js';
import { advanceRedCheckpoint, buildRedRecord, recordRedRun, redStatus, resetRedProgress } from './engine/redProgress.js';
import { loadRedProgress, saveRedProgress } from './engine/redProgressStore.js';
import { withRedOpsTarget } from './engine/redops.js';
import { instantiateScenario } from './engine/scenarioVariants.js';
import { decodeBase64 } from './engine/decode.js';
import { buildShiftHandoff } from './engine/handoff.js';
import { C, FONT } from './theme.js';
import AppHeader from './components/AppHeader.jsx';
import AppRail from './components/AppRail.jsx';
import CaseWorkspace from './components/CaseWorkspace.jsx';
import EggHost from './components/EggHost.jsx';
import EndShiftModal from './components/EndShiftModal.jsx';

// Views load on first visit, not with the queue
const Dashboard = lazy(() => import('./components/Dashboard.jsx'));
const FastTriageView = lazy(() => import('./components/FastTriageView.jsx'));
const LeaderboardView = lazy(() => import('./components/LeaderboardView.jsx'));
const ProgressView = lazy(() => import('./components/ProgressView.jsx'));
const RedOpsView = lazy(() => import('./components/RedOpsView.jsx'));
const SettingsView = lazy(() => import('./components/SettingsView.jsx'));
const ShiftReportCard = lazy(() => import('./components/ShiftReportCard.jsx'));
const TeamTab = lazy(() => import('./components/TeamTab.jsx'));
const TriageView = lazy(() => import('./components/TriageView.jsx'));

// Announce a secret if one matched
function announceEgg(id) {
  if (id) announce(id);
}

const STALE_CHECK_MS = 30_000;
const RED_OP_IDS = Object.keys(RED_OPS);

function elapsedSince(startedAt) {
  return startedAt ? Date.now() - startedAt : null;
}

// Cleared progress (keeps adaptive + rank)
function clearedProgress(prev) {
  return { ...emptyProgress(), adaptive: prev.adaptive, checkpointRankIndex: prev.checkpointRankIndex ?? 0 };
}

// Page column
function Page({ width, children }) {
  return <main className="sim-main" style={{ maxWidth: width, margin: '0 auto', width: '100%' }}>{children}</main>;
}

// Triage tab state
const EMPTY_TRIAGE = { input: '', result: null, issues: [], history: [], guideOpen: false, guideFormat: 0 };

export default function SOCAnalystSim() {
  const [progress, setProgress] = useState(loadProgress);
  // Red team career
  const [redProgress, setRedProgress] = useState(loadRedProgress);
  // Secret triggers: theme spam, logo clicks
  const [themeBurst] = useState(() => createBurst(10, 6000));
  const [logoBurst] = useState(() => createBurst(5, 3000));
  const [shift, setShift] = useState(() => {
    const opened = openShift(loadShift(), loadProgress());
    const linked = viewFromHash();
    return linked ? { ...opened, view: linked } : opened;
  });
  // Lives here so it survives tab switches
  const [triage, setTriage] = useState(EMPTY_TRIAGE);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tab, setTab] = useState('overview');
  const [walkthrough, setWalkthrough] = useState(false);
  const [showEndShiftReview, setShowEndShiftReview] = useState(false);
  // Shift report card: showing now, last saved
  const [reportView, setReportView] = useState(null);
  const [lastReport, setLastReport] = useState(loadLastReport);
  const [mountedAt] = useState(() => Date.now());

  // Shift header, shared with the dashboard
  const seedAt = shift.shiftStartedAt || mountedAt;
  const shiftHeader = useMemo(() => buildShift(seedAt, shift.deal), [seedAt, shift.deal]);

  // This shift's queue (seeded, stable across reloads)
  const { deal, focus, previousHandIds } = shift;
  const dealt = useMemo(
    () => dealtHand({ deal, focus, previousHandIds }, seedAt),
    [seedAt, deal, focus, previousHandIds]
  );
  const queue = useMemo(() => {
    const hand = withWarRoom(withRedOpsTarget(dealt, shift.redOpsTarget, SCENARIOS), shift.warRoom);
    const seedKey = `${seedAt}:${deal}`;
    return hand.map((s) => instantiateScenario(s, seedKey));
  }, [dealt, seedAt, deal, shift.warRoom, shift.redOpsTarget]);

  const scenario = queue[Math.min(currentIndex, queue.length - 1)];
  const caseFile = shift.cases[scenario.id] || EMPTY_CASE;
  const result = caseFile.result;
  const closed = !!result;

  // Stale-shift auto-reset (returning prev keeps this from re-rendering)
  useEffect(() => {
    const id = setInterval(() => {
      setShift((prev) => {
        if (!prev.shiftStartedAt || Date.now() - prev.shiftStartedAt <= SHIFT_RESET_MS) return prev;
        // Read progress from storage (stale closure)
        return nextShift(prev, loadProgress(), dealtHand(prev).map((s) => s.id));
      });
    }, STALE_CHECK_MS);
    return () => clearInterval(id);
  }, []);

  // Persist once per change, outside the state updaters
  useEffect(() => { saveShift(shift); }, [shift]);
  useEffect(() => { saveProgress(progress); }, [progress]);

  // Theme on the document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', shift.theme);
  }, [shift.theme]);

  function updateCase(fn) {
    setShift((prev) => {
      const current = prev.cases[scenario.id] || EMPTY_CASE;
      return { ...prev, cases: { ...prev.cases, [scenario.id]: fn(current) } };
    });
  }

  function stamp() {
    return elapsedSince(caseFile.startedAt) ?? 0;
  }

  function note(current, kind, text) {
    return [...current.timeline, { at: stamp(), kind, text }];
  }

  // Close a case
  function closeCase(current, score) {
    return {
      ...current,
      result: { submission: current.form, score, attempt: current.attempts + 1 },
      attempts: current.attempts + 1,
      timeline: note(current, 'report', `Report submitted — case closed (${score.overallScore}/100)`),
    };
  }

  function handleSearch(query, range) {
    announceEgg(matchSearch(query) || matchNightOwl());
    const queried = runQuery(scenario, query, range);
    // A secret search that matched no real data gets its joke as the result.
    const searchResult = queried.status === 'ok' ? queried : (secretSearchResult(query) ?? queried);
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
    const elapsedMs = elapsedSince(caseFile.startedAt);
    const score = scoreCase(scenario, caseFile.form, {
      searchesRun: caseFile.searchKeys,
      intelChecked: caseFile.intelChecked,
      actionsTaken: caseFile.actions,
      noiseSearches: caseFile.noiseSearches,
      assisted: caseFile.assisted,
      elapsedMs,
    });
    // Secrets (never affect score)
    announceEgg(matchReport(caseFile.form));
    announceEgg(matchQuickClose(elapsedMs, isResolvedCorrectly(score)));
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
      // Ranks are checkpoints
      return next.recorded ? advanceCheckpoint(next.progress, SCENARIOS) : next.progress;
    });
    updateCase((current) => closeCase(current, score));

    // Bad response triggers a War Room (once)
    if (!shift.warRoom && warRoomTriggered(scenario, score)) {
      const newWarRoom = { scenarioId: followOnFor(scenario).id, sourceId: scenario.id, triggeredAt: Date.now() };
      setShift((prev) => ({ ...prev, warRoom: newWarRoom }));
      const reordered = withWarRoom(queue, newWarRoom);
      const newIndex = reordered.findIndex((s) => s.id === scenario.id);
      if (newIndex !== -1) setCurrentIndex(newIndex);
    }
    setTab('debrief');
  }

  // Demo shortcut to Debrief (assisted, not recorded)
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
        elapsedMs: elapsedSince(current.startedAt),
      });
      return closeCase({ ...current, form, searchKeys, intelChecked, actions, assisted: true }, score);
    });
    setTab('debrief');
  }

  // Reopen a case from scratch
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
    setShift((prev) => startClock({ ...prev, view: 'queue' }, queue[index].id));
    setTab(shift.cases[queue[index].id]?.result ? 'debrief' : 'overview');
    setWalkthrough(false);
  }

  // Defend a Red Ops incident in the queue
  function handleDefendFromRedOps(scenarioId, redRun) {
    setShift((prev) => startClock({
      ...prev,
      view: 'queue',
      redOpsTarget: scenarioId,
      redOps: { scenarioId, ...redRun, completedAt: Date.now() },
    }, scenarioId));
    const idx = withRedOpsTarget(dealt, scenarioId, SCENARIOS).findIndex((s) => s.id === scenarioId);
    if (idx !== -1) setCurrentIndex(idx);
    setTab(shift.cases[scenarioId]?.result ? 'debrief' : 'overview');
    setWalkthrough(false);
  }

  function toggleWalkthrough() {
    const opening = !walkthrough;
    setWalkthrough(opening);
    setTab('overview');
    if (opening && !closed) updateCase((current) => ({ ...current, assisted: true }));
  }

  // Ask Tier 2 for a nudge (counts as assisted)
  function handleAskTier2(nudgeKey) {
    if (closed) return;
    updateCase((current) => ({
      ...current,
      assisted: true,
      nudgeAsks: { ...current.nudgeAsks, [nudgeKey]: (current.nudgeAsks?.[nudgeKey] || 0) + 1 },
      timeline: note(current, 'assist', 'Asked Tier 2 for a nudge'),
    }));
  }

  // New shift
  function startNextShift(progressForFocus) {
    setShift(nextShift(shift, progressForFocus, queue.map((s) => s.id)));
    setCurrentIndex(0);
    setTab('overview');
    setWalkthrough(false);
  }

  function handleReset() {
    startNextShift(progress);
  }

  // End shift (handoff review if work is open)
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

  // Shift report
  function makeReport() {
    const boards = buildBoards({
      progress,
      redProgress,
      found: loadFound(),
      fastRuns: loadFastTriageRuns(),
      library: SCENARIOS,
      operationIds: RED_OP_IDS,
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

  // Preview report mid-shift
  function previewReport() {
    setReportView({ report: makeReport(), mode: 'preview' });
  }

  // Adaptive deal (applies next shift)
  function toggleAdaptive() {
    setProgress((prev) => ({ ...prev, adaptive: !prev.adaptive }));
  }

  // Clear history (rank kept)
  function clearHistory() {
    setProgress(clearedProgress);
  }

  // Reset everything (ranks kept)
  function handleFullReset() {
    const freshProgress = clearedProgress(progress);
    setProgress(freshProgress);
    // Fast triage runs
    clearFastTriageRuns();
    // The saved shift report is history too.
    clearLastReport();
    setLastReport(null);
    setReportView(null);
    // Red Ops runs (rank kept)
    const freshRed = resetRedProgress(redProgress);
    saveRedProgress(freshRed);
    setRedProgress(freshRed);
    startNextShift(freshProgress);
  }

  // Record a Red Ops run; returns a new rank if promoted
  function handleRedRunFinished(operationId, result) {
    const before = redStatus(redProgress.history, RED_OP_IDS, redProgress.checkpointRankIndex);
    const next = advanceRedCheckpoint(recordRedRun(redProgress, buildRedRecord(operationId, result)), RED_OP_IDS);
    saveRedProgress(next);
    setRedProgress(next);
    const after = redStatus(next.history, RED_OP_IDS, next.checkpointRankIndex);
    announceEgg(matchGhostwire(next.history, RED_OP_IDS));
    return after.rankIndex > before.rankIndex ? after.rank : null;
  }

  function setView(view) {
    setShift((prev) => ({ ...prev, view }));
  }

  // Tab -> URL hash
  useEffect(() => {
    const hash = `#${shift.view}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [shift.view]);

  // URL hash -> tab
  useEffect(() => {
    const onHashChange = () => {
      const view = viewFromHash();
      if (view) setShift((prev) => (prev.view === view ? prev : { ...prev, view }));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []); // setShift is stable

  function toggleTheme() {
    if (themeBurst()) announce('flashbang');
    setShift((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  }

  const closedCases = useMemo(
    () => queue.map((s) => shift.cases[s.id]?.result).filter(Boolean),
    [queue, shift.cases]
  );

  // Keep a signed-in player's online standing current. A no-op when signed out.
  useEffect(() => {
    const timer = setTimeout(() => {
      pushStandingQuietly(standingPayload({
        progress, redProgress, found: loadFound(), fastRuns: loadFastTriageRuns(),
        library: SCENARIOS, operationIds: RED_OP_IDS,
      }));
    }, 2500);
    return () => clearTimeout(timer);
  }, [progress, redProgress, shift.view]);

  const redRank = useMemo(
    () => redStatus(redProgress.history, RED_OP_IDS, redProgress.checkpointRankIndex),
    [redProgress]
  );
  // Blue team career
  const career = useMemo(
    () => careerStatus(progress.history, SCENARIOS, progress.checkpointRankIndex),
    [progress]
  );
  const openCount = queue.length - closedCases.length;
  const avgScore = closedCases.length
    ? Math.round(closedCases.reduce((sum, r) => sum + r.score.overallScore, 0) / closedCases.length)
    : null;
    const shiftSummary = closedCases.length === queue.length
    ? generateShiftSummary(queue.map((s) => shift.cases[s.id].result))
    : null;

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT, color: C.text }}>
      <a
        className="skip-link"
        href="#"
        onClick={(e) => {
          // Hash belongs to view routing
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
          openCount={openCount}
          onToggleTheme={toggleTheme}
          onEndShift={handleEndShift}
          onLogoClick={() => { if (logoBurst()) announce('credits'); }}
        />

        <div className="app-content">
      <AppHeader
        blueRank={career.rank}
        redRank={redRank.rank}
        shiftWindow={shiftHeader.window}
        openCount={openCount}
        closedCount={closedCases.length}
        avgScore={avgScore}
        queue={queue}
        cases={shift.cases}
      />

      <Suspense fallback={null}>
      {shift.view === 'dashboard' && (
        <Page width={1440}>
          <Dashboard
            scenarios={queue}
            cases={shift.cases}
            shiftStartedAt={shift.shiftStartedAt}
            deal={shift.deal}
            focus={shift.focus}
            onOpenAlert={selectScenario}
            progress={progress}
            onFullReset={handleFullReset}
            onPreviewReport={previewReport}
          />
        </Page>
      )}

      {shift.view === 'triage' && (
        <Page width={1440}>
          <TriageView state={triage} onChange={setTriage} />
        </Page>
      )}

      {shift.view === 'fasttriage' && (
        <Page width={900}>
          <FastTriageView />
        </Page>
      )}

      {shift.view === 'redops' && (
        <Page width={1000}>
          <RedOpsView onDefend={handleDefendFromRedOps} progress={redProgress} onRunFinished={handleRedRunFinished} />
        </Page>
      )}

      {shift.view === 'team' && (
        <Page width={1000}>
          <TeamTab progress={progress} closedCases={closedCases} warRoomActive={!!shift.warRoom} rank={career.rank} />
        </Page>
      )}

      {shift.view === 'progress' && (
        <Page width={1440}>
          <ProgressView
            progress={progress}
            currentFocus={shift.focus}
            onToggleAdaptive={toggleAdaptive}
            onClearHistory={clearHistory}
            hasLastReport={!!lastReport}
            onOpenLastReport={() => lastReport && setReportView({ report: lastReport, mode: 'last' })}
          />
        </Page>
      )}

      {shift.view === 'leaderboard' && (
        <Page width={900}>
          <LeaderboardView progress={progress} redProgress={redProgress} onOpenSettings={() => setView('settings')} />
        </Page>
      )}

      {shift.view === 'settings' && (
        <Page width={900}>
          <SettingsView />
        </Page>
      )}

      </Suspense>

      {shift.view === 'queue' && (
        <CaseWorkspace
          queue={queue}
          scenario={scenario}
          caseFile={caseFile}
          cases={shift.cases}
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
        <Suspense fallback={null}>
          <ShiftReportCard report={reportView.report} mode={reportView.mode} onClose={() => setReportView(null)} />
        </Suspense>
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
