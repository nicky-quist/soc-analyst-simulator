import { useCallback, useEffect, useMemo, useState } from 'react';
import { SCENARIOS, COMPANY } from './data/scenarios/index.js';
import { runQuery } from './engine/query.js';
import { lookupIndicator } from './engine/intel.js';
import { scoreCase, isResolvedCorrectly, searchKey } from './engine/scoring.js';
import { generateShiftSummary } from './engine/personas.js';
import { C, FONT, MONO, THEME_CSS, TONE, severityTone } from './theme.js';
import { Badge, Button, Card, IconButton, SectionLabel, Tabs } from './ui/primitives.jsx';
import { formatDuration } from './ui/helpers.js';
import {
  IconDashboard, IconGraduationCap, IconInbox, IconMoon, IconRotate, IconShield, IconSun, IconUser,
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

const STORAGE_KEY = 'soc-analyst-sim:shift:v2';

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
};

const EMPTY_SHIFT = { theme: 'light', view: 'dashboard', cases: {}, shiftStartedAt: null };

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

    const valid = new Set(SCENARIOS.map((s) => s.id));
    const cases = Object.fromEntries(
      Object.entries(parsed.cases || {})
        .filter(([id]) => valid.has(id))
        .map(([id, value]) => [id, { ...EMPTY_CASE, ...value }])
    );
    return {
      theme,
      view: parsed.view === 'queue' ? 'queue' : 'dashboard',
      cases,
      shiftStartedAt: parsed.shiftStartedAt,
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

export default function SOCAnalystSim() {
  const [shift, setShift] = useState(() => startClock(loadShift(), SCENARIOS[0].id));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [tab, setTab] = useState('overview');
  const [walkthrough, setWalkthrough] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const scenario = SCENARIOS[currentIndex];
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
        const fresh = { ...startClock(EMPTY_SHIFT, SCENARIOS[0].id), theme: prev.theme };
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
    updateCase((current) => ({
      ...current,
      result: { submission: current.form, score, attempt: current.attempts + 1 },
      attempts: current.attempts + 1,
      timeline: note(current, 'report', `Report submitted — case closed (${score.overallScore}/100)`),
    }));
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
    setTab(shift.cases[SCENARIOS[index].id]?.result ? 'debrief' : 'overview');
    setWalkthrough(false);
    update((prev) => startClock(prev, SCENARIOS[index].id));
  }

  function toggleWalkthrough() {
    const opening = !walkthrough;
    setWalkthrough(opening);
    setTab('overview');
    if (opening && !closed) updateCase((current) => ({ ...current, assisted: true }));
  }

  const handleReset = useCallback(() => {
    const fresh = startClock(EMPTY_SHIFT, SCENARIOS[0].id);
    saveShift({ ...fresh, theme: shift.theme });
    setShift({ ...fresh, theme: shift.theme });
    setCurrentIndex(0);
    setTab('overview');
    setWalkthrough(false);
  }, [shift.theme]);

  function setView(view) {
    update((prev) => ({ ...prev, view }));
  }

  function toggleTheme() {
    update((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  }

  const closedCases = useMemo(
    () => SCENARIOS.map((s) => shift.cases[s.id]?.result).filter(Boolean),
    [shift.cases]
  );
  const avgScore = closedCases.length
    ? Math.round(closedCases.reduce((sum, r) => sum + r.score.overallScore, 0) / closedCases.length)
    : null;
  const slaBreaches = SCENARIOS.filter((s) => slaState(s, shift.cases[s.id], now).breached).length;
  const shiftSummary = closedCases.length === SCENARIOS.length
    ? generateShiftSummary(SCENARIOS.map((s) => shift.cases[s.id].result))
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
              <IconDashboard size={18} />
            </button>
            <button
              type="button"
              className="rail-nav-btn"
              data-active={shift.view === 'queue'}
              onClick={() => setView('queue')}
              aria-current={shift.view === 'queue' ? 'page' : undefined}
              title="Alert queue"
            >
              <IconInbox size={18} />
              {SCENARIOS.length - closedCases.length > 0 && (
                <span className="rail-count">{SCENARIOS.length - closedCases.length}</span>
              )}
            </button>
          </nav>

          <div style={{ flex: 1 }} />

          <IconButton
            icon={shift.theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
            title="Toggle colour theme"
            onClick={toggleTheme}
          />
          {closedCases.length > 0 && (
            <IconButton icon={<IconRotate size={16} />} title="Reset shift (also auto-resets every 12h)" onClick={handleReset} />
          )}
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
            {COMPANY.analyst.title} · {COMPANY.analyst.shift}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge label={`${SCENARIOS.length - closedCases.length} open`} tone={TONE.primary} />
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
              <div style={{ fontSize: 10.5, color: C.textMuted }}>{COMPANY.analyst.title}</div>
            </div>
          </div>
        </div>
      </header>

      {shift.view === 'dashboard' && (
        <main className="sim-main" style={{ maxWidth: 1440, margin: '0 auto', width: '100%' }}>
          <Dashboard
            scenarios={SCENARIOS}
            cases={shift.cases}
            now={now}
            onOpenAlert={selectScenario}
          />
        </main>
      )}

      {shift.view === 'queue' && (
      <div className="sim-body">
        <AlertQueue
          scenarios={SCENARIOS}
          currentId={scenario.id}
          cases={shift.cases}
          now={now}
          onSelect={selectScenario}
        />

        <main className="sim-main">
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
            <Button
              variant={walkthrough ? 'primary' : 'secondary'}
              onClick={toggleWalkthrough}
              aria-expanded={walkthrough}
              style={{ flexShrink: 0 }}
            >
              {walkthrough ? <><IconGraduationCap size={14} /> Hide walkthrough</> : <><IconGraduationCap size={14} /> Learn mode</>}
            </Button>
          </div>

          <Tabs tabs={tabs} active={tab} onSelect={setTab} />

          <div style={{ marginTop: 20 }}>
            {tab === 'overview' && <OverviewTab scenario={scenario} showWalkthrough={walkthrough} />}
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
              <DebriefTab scenario={scenario} result={result} onRetry={handleRetry} />
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
    </div>
  );
}
