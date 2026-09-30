// The alert queue view: the queue on the left, the open case in the middle (its
// header, the tabs, and whichever tab is showing), and the case notes on the
// right. It owns no state. Everything it shows comes in as props and every action
// goes back out through a handler, so the shift logic stays in one place.

import { SCENARIOS } from '../data/scenarios/index.js';
import { caseStatus, slaState } from '../engine/case.js';
import { generateWarRoomAlert } from '../engine/personas.js';
import { isResolvedCorrectly } from '../engine/scoring.js';
import { C, MONO, TONE, severityTone } from '../theme.js';
import { formatDuration } from '../ui/helpers.js';
import { IconGraduationCap, IconSparkles } from '../ui/icons.jsx';
import { Badge, Button, Card, PersonaMessage, SectionLabel, Tabs } from '../ui/primitives.jsx';
import AlertQueue from './AlertQueue.jsx';
import CaseTimeline from './CaseTimeline.jsx';
import DebriefTab, { ShiftSummary } from './DebriefTab.jsx';
import IntelTab from './IntelTab.jsx';
import InvestigateTab from './InvestigateTab.jsx';
import OverviewTab from './OverviewTab.jsx';
import ReportTab from './ReportTab.jsx';
import RespondTab from './RespondTab.jsx';

export default function CaseWorkspace({
  queue, scenario, caseFile, cases, now, warRoom, shiftSummary, redOps, walkthrough, tab,
  onSelectScenario, onEndShift, onSkipToDebrief, onToggleWalkthrough, onSetTab, onAskTier2,
  onSearch, onDecode, onLookup, onAct, onFormChange, onSubmit, onRetry,
}) {
  const result = caseFile.result;
  const closed = !!result;
  const elapsed = closed ? result.score.elapsedMs : caseFile.startedAt ? now - caseFile.startedAt : 0;
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
  <div className="sim-body">
    <AlertQueue
      scenarios={queue}
      currentId={scenario.id}
      cases={cases}
      now={now}
      onSelect={onSelectScenario}
    />

    <main className="sim-main">
      {warRoom && !cases[warRoom.scenarioId]?.result && (
        <Card tone={TONE.concerned} style={{ padding: '14px 18px', marginBottom: 20 }}>
          <SectionLabel style={{ marginBottom: 10 }}>War room — this shift just escalated</SectionLabel>
          <PersonaMessage
            persona={generateWarRoomAlert(
              SCENARIOS.find((s) => s.id === warRoom.sourceId) || scenario
            )}
          />
        </Card>
      )}

      {shiftSummary && <ShiftSummary summary={shiftSummary} onReset={onEndShift} />}

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
              onClick={onSkipToDebrief}
              title="Demo shortcut — auto-fills the correct answer and jumps to Debrief. Doesn't count toward your stats."
            >
              <IconSparkles size={14} /> Skip to debrief
            </Button>
          )}
          <Button
            variant={walkthrough ? 'primary' : 'secondary'}
            onClick={onToggleWalkthrough}
            aria-expanded={walkthrough}
          >
            {walkthrough ? <><IconGraduationCap size={14} /> Hide walkthrough</> : <><IconGraduationCap size={14} /> Learn mode</>}
          </Button>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onSelect={onSetTab} />

      <div style={{ marginTop: 20 }}>
        {tab === 'overview' && (
          <OverviewTab
            key={scenario.id}
            scenario={scenario}
            showWalkthrough={walkthrough}
            caseFile={caseFile}
            closed={closed}
            onAskTier2={onAskTier2}
          />
        )}
        {tab === 'investigate' && (
          <InvestigateTab
            scenario={scenario}
            caseFile={caseFile}
            onSearch={onSearch}
            onDecode={onDecode}
            readOnly={closed}
          />
        )}
        {tab === 'intel' && <IntelTab caseFile={caseFile} onLookup={onLookup} readOnly={closed} />}
        {tab === 'respond' && (
          <RespondTab scenario={scenario} caseFile={caseFile} onAct={onAct} readOnly={closed} />
        )}
        {tab === 'report' && (
          <ReportTab
            scenario={scenario}
            caseFile={caseFile}
            form={caseFile.form}
            onChange={onFormChange}
            onSubmit={onSubmit}
            disabled={closed}
          />
        )}
        {tab === 'debrief' && closed && (
          <DebriefTab scenario={scenario} result={result} onRetry={onRetry} timeline={caseFile.timeline} actions={caseFile.actions} redOps={redOps} />
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
  );
}
