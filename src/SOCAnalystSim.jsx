import { useEffect, useMemo, useState } from 'react';
import { SCENARIOS, COMPANY } from './data/scenarios/index.js';
import { runQuery } from './engine/query.js';
import { lookupIndicator } from './engine/intel.js';
import { scoreCase, isResolvedCorrectly, searchKey } from './engine/scoring.js';
import { generateShiftSummary } from './engine/personas.js';
import { C, FONT, MONO, THEME_CSS, TONE, severityTone } from './theme.js';
import { Badge, Button, Card, SectionLabel, Tabs } from './ui/primitives.jsx';
import { formatDuration, initials } from './ui/helpers.js';
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

const EMPTY_SHIFT = { theme: 'dark', view: 'dashboard', cases: {} };

function loadShift() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SHIFT;
    const parsed = JSON.parse(raw);
    const valid = new Set(SCENARIOS.map((s) => s.id));
    const cases = Object.fromEntries(
      Object.entries(parsed.cases || {})
        .filter(([id]) => valid.has(id))
        .map(([id, value]) => [id, { ...EMPTY_CASE, ...value }])
    );
    return {
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      view: parsed.view === 'queue' ? 'queue' : 'dashboard',
      cases,
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
  if (existing.startedAt || existing.result) return shift;
  return { ...shift, cases: { ...shift.cases, [scenarioId]: { ...existing, startedAt: Date.now() } } };
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

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
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

  function handleReset() {
    const fresh = startClock(EMPTY_SHIFT, SCENARIOS[0].id);
    saveShift({ ...fresh, theme: shift.theme });
    setShift({ ...fresh, theme: shift.theme });
    setCurrentIndex(0);
    setTab('overview');
    setWalkthrough(false);
  }

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
        .sim-btn:hover:not(:disabled) { filter: brightness(1.12); }
        .sim-btn-primary:hover:not(:disabled) { box-shadow: 0 0 0 3px rgba(59,130,246,0.25); }
        .sim-tile { transition: transform 0.15s, box-shadow 0.15s; }
        .sim-tile:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg) !important; }
        table tbody tr:hover { background: var(--surface-hover) !important; }
        .sim-alert-row { transition: background 0.1s; }
        .sim-body { display: grid; grid-template-columns: 272px minmax(0, 1fr) 300px; align-items: start; }
        .sim-queue { background: var(--surface); border-right: 1px solid var(--border); position: sticky; top: 0; max-height: 100vh; overflow-y: auto; }
        .sim-main { padding: 20px 24px 60px; min-width: 0; }
        .sim-rail { border-left: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; max-height: 100vh; overflow-y: auto; padding: 16px; }
        .sim-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .sim-dash-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; align-items: start; }
        @media (max-width: 1000px) {
          .sim-dash-grid { grid-template-columns: minmax(0, 1fr); }
          .sim-dash-grid > * { grid-column: span 1 !important; }
        }
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
      `}</style>

      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {/* accent bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${C.primary} 0%, ${C.info} 60%, transparent 100%)` }} />
        <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.primary} 0%, #1d4ed8 100%)`,
            color: C.onPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 13, letterSpacing: 0.5, flexShrink: 0,
            boxShadow: `0 0 0 1px ${C.primaryStrong}30, 0 2px 8px rgba(59,130,246,0.3)`,
          }}>
            {initials(COMPANY.name).slice(0, 2)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: 0.1 }}>{COMPANY.soc}</div>
            <div style={{ fontSize: 11, color: C.textMuted, fontFamily: MONO, letterSpacing: 0.3 }}>
              {COMPANY.analyst.title} · {COMPANY.analyst.shift}
            </div>
          </div>

          <div style={{ width: 1, height: 28, background: C.border, margin: '0 4px' }} />

          <nav aria-label="Console sections" style={{ display: 'flex', gap: 4 }}>
            {[{ id: 'dashboard', label: 'Dashboard' }, { id: 'queue', label: 'Alert Queue' }].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                aria-current={shift.view === item.id ? 'page' : undefined}
                className="sim-btn"
                style={{
                  background: shift.view === item.id ? C.primarySoft : 'transparent',
                  color: shift.view === item.id ? C.primaryStrong : C.textSecondary,
                  border: `1px solid ${shift.view === item.id ? C.primary : 'transparent'}`,
                  padding: '6px 13px', fontSize: 12.5, fontWeight: 600, borderRadius: 6,
                  cursor: 'pointer', fontFamily: FONT, transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}
              >
                {item.label}
                {item.id === 'queue' && (
                  <span style={{
                    marginLeft: 7, fontSize: 11, fontWeight: 700, padding: '1px 6px',
                    borderRadius: 999, background: C.primarySoft, color: C.primaryStrong,
                    border: `1px solid ${C.primary}`,
                  }}>
                    {SCENARIOS.length - closedCases.length}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center', flexWrap: 'wrap' }}>
            <Badge label={`${SCENARIOS.length - closedCases.length} open`} tone={TONE.primary} />
            <Badge label={`${closedCases.length} closed`} tone={TONE.neutral} />
            {avgScore !== null && (
              <Badge label={`Avg ${avgScore}`} tone={avgScore >= 70 ? TONE.positive : TONE.coaching} />
            )}
            <Badge label={`${slaBreaches} SLA breach${slaBreaches === 1 ? '' : 'es'}`} tone={slaBreaches ? TONE.concerned : TONE.neutral} />
            <Button variant="ghost" onClick={toggleTheme} aria-label="Toggle colour theme" style={{ fontSize: 16 }}>
              {shift.theme === 'dark' ? '☀' : '☾'}
            </Button>
            {closedCases.length > 0 && <Button variant="ghost" onClick={handleReset}>Reset</Button>}
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
              {walkthrough ? 'Hide walkthrough' : '📖 Learn mode'}
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
  );
}
