import { useCallback, useEffect, useMemo, useState } from 'react';
import { COMPANY, SCENARIOS } from './data/scenarios/index.js';
import { buildShift } from './data/estate.js';
import { dealShift } from './engine/deal.js';
import { runQuery } from './engine/query.js';
import { lookupIndicator } from './engine/intel.js';
import { scoreCase, isResolvedCorrectly, searchKey } from './engine/scoring.js';
import { advanceCheckpoint, buildRecord, careerStatus, emptyProgress, planFocus, recordCase } from './engine/progress.js';
import ProgressView from './components/ProgressView.jsx';
import TriageView from './components/TriageView.jsx';
import { generateShiftSummary, generateWarRoomAlert } from './engine/personas.js';
import { warRoomTriggered, followOnFor, withWarRoom, resolveWarRoomScenario } from './engine/warroom.js';
import { clearFastTriageRuns } from './engine/fasttriageStore.js';
import { withRedOpsTarget } from './engine/redops.js';
import { instantiateScenario } from './engine/scenarioVariants.js';
import { C, FONT, MONO, THEME_CSS, TONE, severityTone } from './theme.js';
import { Badge, Button, Card, IconButton, PersonaMessage, SectionLabel, Tabs } from './ui/primitives.jsx';
import { formatDuration } from './ui/helpers.js';
import {
  IconActivity, IconDashboard, IconGraduationCap, IconInbox, IconListChecks, IconMoon, IconRotate, IconSettings, IconShield, IconSparkles, IconSun, IconTrendingUp, IconUser, IconUsers, IconZap,
} from './ui/icons.jsx';
import AlertQueue from './components/AlertQueue.jsx';
import { caseStatus, slaState } from './engine/case.js';
import { decodeBase64 } from './engine/decode.js';
import CaseTimeline from './components/CaseTimeline.jsx';
import OverviewTab from './components/OverviewTab.jsx';
import InvestigateTab from './components/InvestigateTab.jsx';
import IntelTab from './components/IntelTab.jsx';
import RespondTab from './components/RespondTab.jsx';
import ReportTab from './components/ReportTab.jsx';
import DebriefTab, { ShiftSummary } from './components/DebriefTab.jsx';
import Dashboard from './components/Dashboard.jsx';
import TeamTab from './components/TeamTab.jsx';
import RedOpsView from './components/RedOpsView.jsx';
import FastTriageView from './components/FastTriageView.jsx';
import SettingsView from './components/SettingsView.jsx';
import EndShiftModal from './components/EndShiftModal.jsx';
import { buildShiftHandoff } from './engine/handoff.js';

const STORAGE_KEY = 'soc-analyst-sim:shift:v2';

// The console's sections, in rail order. Each also answers to a URL hash
// (#triage and so on), so a link can open straight onto a tab.
const VIEWS = ['dashboard', 'queue', 'triage', 'fasttriage', 'redops', 'team', 'progress', 'settings'];

// The Triage tab's working state: what's pasted, the latest verdict, and this session's history.
const EMPTY_TRIAGE = { input: '', result: null, issues: [], history: [], guideOpen: false, guideFormat: 0 };

function viewFromHash() {
  const hash = typeof window === 'undefined' ? '' : window.location.hash.slice(1);
  return VIEWS.includes(hash) ? hash : null;
}

// Separate from the shift, because it has to outlive every shift reset.
const PROGRESS_KEY = 'soc-analyst-sim:progress:v1';

function loadProgress() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || 'null');
    if (!parsed || !Array.isArray(parsed.history)) return emptyProgress();
    return {
      history: parsed.history,
      adaptive: parsed.adaptive !== false,
      // A rank is a checkpoint, not a reflection of live history — it has to
      // survive the same round-trip as everything else or a reload silently
      // demotes an earned rank back to Trainee.
      checkpointRankIndex: Number.isInteger(parsed.checkpointRankIndex) ? parsed.checkpointRankIndex : 0,
    };
  } catch {
    return emptyProgress();
  }
}

function saveProgress(progress) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable: progress lasts for this session only.
  }
}

// The focus is decided once, when a shift is dealt, and stored on the shift.
// The hand is re-derived from the shift on every load, so reading live history
// instead would re-deal a different hand the moment a case closed, and drop
// the analyst's open cases.
function focusFor(progress) {
  return progress?.adaptive ? planFocus(progress.history, SCENARIOS) : null;
}

function validFocus(focus) {
  return focus && typeof focus === 'object' && focus.weights && typeof focus.weights === 'object' ? focus : null;
}

const EMPTY_FORM = {
  classification: '',
  severity: '',
  mitreTechnique: '',
  summary: '',
  remediation: '',
  escalation: '',
};

const EMPTY_CASE = {
  startedAt: null,
  searches: [],
  searchKeys: [],
  intel: [],
  intelChecked: [],
  actions: [],
  decodes: [],
  timeline: [],
  form: EMPTY_FORM,
  result: null,
  assisted: false,
  attempts: 0,
  lastRange: '15m',
  noiseSearches: 0,
  nudgeAsks: {},
};

// `deal` is the hand counter, not the hand: the seven alerts are re-derived
// from (shiftStartedAt, deal) on every load, so a reload restores the queue you
// were working and "Reset shift" — same clock, next counter — deals a new one.
const EMPTY_SHIFT = {
  theme: 'light', view: 'dashboard', cases: {}, shiftStartedAt: null, deal: 0, focus: null,
  warRoom: null, redOpsTarget: null, redOps: null, previousHandIds: [],
};

// A shift board that just keeps counting is not what a SOC dashboard is for —
// after this long the queue, SLA clocks, and estate feed should look like a
// new shift walked in, not a stale tab someone forgot to close.
const SHIFT_RESET_MS = 12 * 60 * 60 * 1000;

function loadShift() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SHIFT;
    const parsed = JSON.parse(raw);
    const theme = parsed.theme === 'dark' ? 'dark' : 'light';
    const stale = !parsed.shiftStartedAt || Date.now() - parsed.shiftStartedAt > SHIFT_RESET_MS;
    if (stale) return { ...EMPTY_SHIFT, theme };

    // Cases for alerts that are not in this hand are dropped rather than kept
    // invisibly: the board has to agree with the queue it is counting. A War
    // Room alert isn't part of the dealt hand, so its id has to be added to
    // the valid set by hand or its case (and the alert itself) would vanish
    // on reload.
    const deal = Number.isInteger(parsed.deal) ? parsed.deal : 0;
    const focus = validFocus(parsed.focus);
    const warRoom = resolveWarRoomScenario(parsed.warRoom) ? parsed.warRoom : null;
    // Same reasoning as War Room: a Red Ops target alert isn't part of the
    // dealt hand either, so it needs the same manual add to the valid set.
    const redOpsTarget = typeof parsed.redOpsTarget === 'string' && SCENARIOS.some((s) => s.id === parsed.redOpsTarget)
      ? parsed.redOpsTarget
      : null;
    const redOps = parsed.redOps && typeof parsed.redOps.scenarioId === 'string' ? parsed.redOps : null;
    const previousHandIds = Array.isArray(parsed.previousHandIds)
      ? parsed.previousHandIds.filter((id) => typeof id === 'string')
      : [];
    const valid = new Set(
      dealShift(parsed.shiftStartedAt, deal, undefined, focus, new Set(previousHandIds)).map((s) => s.id)
    );
    if (warRoom) valid.add(warRoom.scenarioId);
    if (redOpsTarget) valid.add(redOpsTarget);
    const cases = Object.fromEntries(
      Object.entries(parsed.cases || {})
        .filter(([id]) => valid.has(id))
        .map(([id, value]) => [id, { ...EMPTY_CASE, ...value }])
    );
    return {
      theme,
      view: VIEWS.includes(parsed.view) ? parsed.view : 'dashboard',
      cases,
      shiftStartedAt: parsed.shiftStartedAt,
      deal,
      focus,
      warRoom,
      redOpsTarget,
      redOps,
      previousHandIds,
    };
  } catch {
    return EMPTY_SHIFT;
  }
}

function saveShift(shift) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(shift));
  } catch {
    // Storage unavailable (private mode / quota) — the sim still works in-memory.
  }
}

// The clock starts when an open alert is first put on screen, which is every
// path that makes one current: first render, queue click, or reopen.
function startClock(shift, scenarioId) {
  const existing = shift.cases[scenarioId] || EMPTY_CASE;
  const withShiftStamp = shift.shiftStartedAt ? shift : { ...shift, shiftStartedAt: Date.now() };
  if (existing.startedAt || existing.result) return withShiftStamp;
  return { ...withShiftStamp, cases: { ...withShiftStamp.cases, [scenarioId]: { ...existing, startedAt: Date.now() } } };
}

// A shift has to have a start before it can have a queue, so the stamp comes
// first and the hand is dealt from it.
function openShift(loaded, progress) {
  const stamped = loaded.shiftStartedAt
    ? loaded
    : { ...loaded, shiftStartedAt: Date.now(), focus: focusFor(progress) };
  const recentIds = new Set(stamped.previousHandIds || []);
  return startClock(stamped, dealShift(stamped.shiftStartedAt, stamped.deal, undefined, stamped.focus, recentIds)[0].id);
}

export default function SOCAnalystSim() {
  const [progress, setProgress] = useState(loadProgress);
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

  const elapsed = closed
    ? result.score.elapsedMs
    : caseFile.startedAt ? now - caseFile.startedAt : 0;

  function stamp() {
    return caseFile.startedAt ? Date.now() - caseFile.startedAt : 0;
  }

  function note(current, kind, text) {
    return [...current.timeline, { at: stamp(), kind, text }];
  }

  function handleSearch(query, range) {
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
      handleReset();
      return;
    }
    setShowEndShiftReview(true);
  }

  function confirmEndShift() {
    setShowEndShiftReview(false);
    handleReset();
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
    const freshShift = {
      ...openShift({ ...EMPTY_SHIFT, deal: shift.deal + 1, previousHandIds: queue.map((s) => s.id) }, freshProgress),
      theme: shift.theme,
    };
    saveShift(freshShift);
    setShift(freshShift);
    setCurrentIndex(0);
    setTab('overview');
    setWalkthrough(false);
  }, [shift.theme, shift.deal, progress.adaptive, progress.checkpointRankIndex, queue]);

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
    update((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  }

  const closedCases = useMemo(
    () => queue.map((s) => shift.cases[s.id]?.result).filter(Boolean),
    [queue, shift.cases]
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

  const sla = slaState(scenario, caseFile, now);
  const status = caseStatus(caseFile);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'investigate', label: 'Investigate', count: caseFile.searches.length || undefined },
    { id: 'intel', label: 'Intel', count: caseFile.intel.length || undefined },
    { id: 'respond', label: 'Respond', count: caseFile.actions.length || undefined },
    { id: 'report', label: 'Report' },
    ...(closed ? [{ id: 'debrief', label: 'Debrief' }] : []),
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT, color: C.text }}>
      <style>{`
        ${THEME_CSS}
        * { box-sizing: border-box; }
        body { background: var(--bg); margin: 0; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: var(--surface-alt); }
        ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--primary); }
        select:focus, input:focus, textarea:focus { outline: none; border-color: var(--primary) !important; box-shadow: 0 0 0 3px var(--primary-soft); }
        button:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
        .app-shell { display: flex; align-items: stretch; min-height: 100vh; }
        .app-rail {
          width: 60px; flex-shrink: 0; background: var(--surface); border-right: 1px solid var(--border);
          display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 0 12px;
          position: sticky; top: 0; height: 100vh;
        }
        .app-content { flex: 1; min-width: 0; }
        .rail-nav-btn {
          position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
          border-radius: 9px; cursor: pointer; font-family: inherit; border: 1px solid transparent; background: transparent;
          color: var(--text-secondary);
        }
        .rail-nav-btn[data-active="true"] { background: var(--primary-soft); color: var(--primary-strong); border-color: var(--primary); }
        .rail-nav-btn:hover:not([data-active="true"]) { background: var(--surface-alt); color: var(--text); }
        .rail-count {
          position: absolute; top: -3px; right: -3px; min-width: 15px; height: 15px; padding: 0 3px; border-radius: 999px;
          background: var(--primary); color: var(--on-primary); font-size: 9.5px; font-weight: 800; line-height: 15px;
          text-align: center; border: 1.5px solid var(--surface);
        }
        .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); flex-shrink: 0; animation: live-pulse 2s ease-in-out infinite; }
        @keyframes live-pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(52,211,153,0.5); } 50% { opacity: 0.55; box-shadow: 0 0 0 3px rgba(52,211,153,0); } }
        .sim-btn:hover:not(:disabled) { filter: brightness(1.12); }
        .sim-btn-primary:hover:not(:disabled) { box-shadow: var(--glow-primary); }
        .sim-tile { transition: transform 0.15s, box-shadow 0.15s; }
        .sim-tile:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg) !important; }
        table tbody tr:hover { background: var(--surface-hover) !important; }
        .sim-alert-row { transition: background 0.1s; }
        .sim-body { display: grid; grid-template-columns: 272px minmax(0, 1fr) 300px; align-items: start; }
        .sim-queue { background: var(--surface); border-right: 1px solid var(--border); position: sticky; top: 0; max-height: 100vh; overflow-y: auto; }
        .sim-main { padding: 20px 24px 60px; min-width: 0; }
        .sim-rail { border-left: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; max-height: 100vh; overflow-y: auto; padding: 16px; }
        .sim-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .sim-dash-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: stretch; }
        .sim-dash-grid > * { display: flex; flex-direction: column; }
        .sim-tile-row { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
        @media (max-width: 1240px) { .sim-tile-row { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 1000px) {
          .sim-dash-grid { grid-template-columns: minmax(0, 1fr); }
          .sim-dash-grid > * { grid-column: span 1 !important; }
        }
        @media (max-width: 620px) { .sim-tile-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        table tbody tr:hover { background: var(--surface-alt); }
        @media (max-width: 1200px) {
          .sim-body { grid-template-columns: 250px minmax(0, 1fr); }
          .sim-rail { grid-column: 1 / -1; border-left: none; border-top: 1px solid var(--border); position: static; max-height: none; }
        }
        @media (max-width: 900px) {
          .sim-body { display: block; }
          .sim-queue { position: static; max-height: 250px; border-right: none; border-bottom: 1px solid var(--border); }
          .sim-main { padding: 16px 14px 48px; }
          .sim-form-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 480px) {
          .app-rail { width: 48px; }
          .rail-nav-btn { width: 34px; height: 34px; }
        }
      `}</style>

      <div className="app-shell">
        <aside className="app-rail" aria-label="Primary navigation">
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: C.primary, color: C.onPrimary,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
          }}>
            <IconShield size={18} strokeWidth={2} />
          </div>

          <nav aria-label="Console sections" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              type="button"
              className="rail-nav-btn"
              data-active={shift.view === 'dashboard'}
              onClick={() => setView('dashboard')}
              aria-current={shift.view === 'dashboard' ? 'page' : undefined}
              title="Dashboard"
            >
              <IconDashboard size={19} />
            </button>
            <button
              type="button"
              className="rail-nav-btn"
              data-active={shift.view === 'queue'}
              onClick={() => setView('queue')}
              aria-current={shift.view === 'queue' ? 'page' : undefined}
              title="Alert queue"
            >
              <IconInbox size={19} />
              {queue.length - closedCases.length > 0 && (
                <span className="rail-count">{queue.length - closedCases.length}</span>
              )}
            </button>
            <button
              type="button"
              className="rail-nav-btn"
              data-active={shift.view === 'triage'}
              onClick={() => setView('triage')}
              aria-current={shift.view === 'triage' ? 'page' : undefined}
              title="Alert triage"
            >
              <IconActivity size={19} />
            </button>
            <button
              type="button"
              className="rail-nav-btn"
              data-active={shift.view === 'fasttriage'}
              onClick={() => setView('fasttriage')}
              aria-current={shift.view === 'fasttriage' ? 'page' : undefined}
              title="Fast triage"
            >
              <IconListChecks size={19} />
            </button>
            <button
              type="button"
              className="rail-nav-btn"
              data-active={shift.view === 'redops'}
              onClick={() => setView('redops')}
              aria-current={shift.view === 'redops' ? 'page' : undefined}
              title="Red Ops"
            >
              <IconZap size={19} />
            </button>
            <button
              type="button"
              className="rail-nav-btn"
              data-active={shift.view === 'team'}
              onClick={() => setView('team')}
              aria-current={shift.view === 'team' ? 'page' : undefined}
              title="Security org"
            >
              <IconUsers size={19} />
            </button>
            <button
              type="button"
              className="rail-nav-btn"
              data-active={shift.view === 'progress'}
              onClick={() => setView('progress')}
              aria-current={shift.view === 'progress' ? 'page' : undefined}
              title="Your progress"
            >
              <IconTrendingUp size={19} />
            </button>
            <button
              type="button"
              className="rail-nav-btn"
              data-active={shift.view === 'settings'}
              onClick={() => setView('settings')}
              aria-current={shift.view === 'settings' ? 'page' : undefined}
              title="Settings"
            >
              <IconSettings size={19} />
            </button>
          </nav>

          <div style={{ flex: 1 }} />

          <IconButton
            icon={shift.theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            title="Toggle color theme"
            onClick={toggleTheme}
          />
          <IconButton icon={<IconRotate size={17} />} title="End shift — review any handoff first (also auto-resets every 12h)" onClick={handleEndShift} />
        </aside>

        <div className="app-content">
      {/* Accent bar: the one piece of chrome that says "this is a console",
          now that the shield and the nav both live in the rail. */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${C.primary} 0%, ${C.info} 60%, transparent 100%)` }} />
      <header style={{
        borderBottom: `1px solid ${C.border}`, padding: '10px 20px', display: 'flex', alignItems: 'center',
        gap: 14, background: C.surface, flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{COMPANY.soc} — Analyst Console</span>
            <span className="live-dot" title="Live" />
            <span style={{ fontSize: 10, fontWeight: 700, color: C.success, letterSpacing: 0.5 }}>LIVE</span>
          </div>
          <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 1 }}>
            {career.rank} · {shiftHeader.window}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge label={`${queue.length - closedCases.length} open`} tone={TONE.primary} />
          <Badge label={`${closedCases.length} closed`} tone={TONE.neutral} />
          {avgScore !== null && (
            <Badge label={`Avg ${avgScore}`} tone={avgScore >= 70 ? TONE.positive : TONE.coaching} />
          )}
          <Badge label={`${slaBreaches} SLA breach${slaBreaches === 1 ? '' : 'es'}`} tone={slaBreaches ? TONE.concerned : TONE.neutral} />
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, marginLeft: 6, paddingLeft: 12,
            borderLeft: `1px solid ${C.border}`,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', background: C.surfaceAlt, border: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textSecondary,
            }}>
              <IconUser size={14} />
            </div>
            <div style={{ lineHeight: 1.25 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{COMPANY.analyst.name}</div>
              <div style={{ fontSize: 10.5, color: C.textMuted }}>{career.rank}</div>
            </div>
          </div>
        </div>
      </header>

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
          <RedOpsView onDefend={handleDefendFromRedOps} />
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
          />
        </main>
      )}

      {shift.view === 'settings' && (
        <main className="sim-main" style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
          <SettingsView />
        </main>
      )}

      {shift.view === 'queue' && (
      <div className="sim-body">
        <AlertQueue
          scenarios={queue}
          currentId={scenario.id}
          cases={shift.cases}
          now={now}
          onSelect={selectScenario}
        />

        <main className="sim-main">
          {shift.warRoom && !shift.cases[shift.warRoom.scenarioId]?.result && (
            <Card tone={TONE.concerned} style={{ padding: '14px 18px', marginBottom: 20 }}>
              <SectionLabel style={{ marginBottom: 10 }}>War room — this shift just escalated</SectionLabel>
              <PersonaMessage
                persona={generateWarRoomAlert(
                  SCENARIOS.find((s) => s.id === shift.warRoom.sourceId) || scenario
                )}
              />
            </Card>
          )}

          {shiftSummary && <ShiftSummary summary={shiftSummary} onReset={handleReset} />}

          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 14 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                <code style={{ fontFamily: MONO, fontSize: 11.5, color: C.textMuted }}>{scenario.alert.ref}</code>
                <Badge label={scenario.alert.reportedSeverity} tone={severityTone(scenario.alert.reportedSeverity)} />
                <Badge
                  label={closed ? 'Closed' : status === 'in_progress' ? 'In progress' : 'New'}
                  tone={closed ? TONE.neutral : status === 'in_progress' ? TONE.coaching : TONE.primary}
                />
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: sla.breached ? C.danger : C.textMuted }}>
                  {formatDuration(elapsed)} {closed ? 'to decision' : 'open'} · SLA {scenario.alert.slaMinutes}m
                </span>
              </div>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.35 }}>{scenario.queueLabel}</h1>
              <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 4 }}>{scenario.alert.rule}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
              {!closed && (
                <Button
                  variant="ghost"
                  onClick={handleSkipToDebrief}
                  title="Demo shortcut — auto-fills the correct answer and jumps to Debrief. Doesn't count toward your stats."
                >
                  <IconSparkles size={14} /> Skip to debrief
                </Button>
              )}
              <Button
                variant={walkthrough ? 'primary' : 'secondary'}
                onClick={toggleWalkthrough}
                aria-expanded={walkthrough}
              >
                {walkthrough ? <><IconGraduationCap size={14} /> Hide walkthrough</> : <><IconGraduationCap size={14} /> Learn mode</>}
              </Button>
            </div>
          </div>

          <Tabs tabs={tabs} active={tab} onSelect={setTab} />

          <div style={{ marginTop: 20 }}>
            {tab === 'overview' && (
              <OverviewTab
                key={scenario.id}
                scenario={scenario}
                showWalkthrough={walkthrough}
                caseFile={caseFile}
                closed={closed}
                onAskTier2={handleAskTier2}
              />
            )}
            {tab === 'investigate' && (
              <InvestigateTab
                scenario={scenario}
                caseFile={caseFile}
                onSearch={handleSearch}
                onDecode={handleDecode}
                readOnly={closed}
              />
            )}
            {tab === 'intel' && <IntelTab caseFile={caseFile} onLookup={handleLookup} readOnly={closed} />}
            {tab === 'respond' && (
              <RespondTab scenario={scenario} caseFile={caseFile} onAct={handleAct} readOnly={closed} />
            )}
            {tab === 'report' && (
              <ReportTab
                scenario={scenario}
                caseFile={caseFile}
                form={caseFile.form}
                onChange={handleForm}
                onSubmit={handleSubmit}
                disabled={closed}
              />
            )}
            {tab === 'debrief' && closed && (
              <DebriefTab scenario={scenario} result={result} onRetry={handleRetry} timeline={caseFile.timeline} actions={caseFile.actions} redOps={shift.redOps} />
            )}
          </div>
        </main>

        <aside className="sim-rail" aria-label="Case timeline">
          <SectionLabel>Case notes · {scenario.alert.ref}</SectionLabel>
          <CaseTimeline entries={caseFile.timeline} />
          {closed && (
            <Card style={{ padding: 12, marginTop: 16 }} tone={isResolvedCorrectly(result.score) ? TONE.positive : TONE.coaching}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: isResolvedCorrectly(result.score) ? C.success : C.warning }}>
                {isResolvedCorrectly(result.score) ? 'Resolved correctly' : 'Needs improvement'} · {result.score.overallScore}/100
              </div>
            </Card>
          )}
        </aside>
      </div>
      )}
        </div>
      </div>

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
