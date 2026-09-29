// Play the incident from the attacker's side: a chain of choices, never
// freeform code — same discipline as the Respond tab. Pick a scenario that
// has a Red Ops chain, walk its stages, get an evasion score, then go defend
// the same incident as the analyst and see how the two scores compare.

import { useState } from 'react';
import { SCENARIOS } from '../data/scenarios/index.js';
import { RED_OPS } from '../data/redops.js';
import { scoreRedRun } from '../engine/redops.js';
import { C, TONE } from '../theme.js';
import { Badge, Button, Callout, Card, SectionLabel } from '../ui/primitives.jsx';
import { IconCheck, IconTarget, IconZap } from '../ui/icons.jsx';

const AVAILABLE = Object.keys(RED_OPS)
  .map((id) => SCENARIOS.find((s) => s.id === id))
  .filter(Boolean);

function ScenarioPicker({ onPick }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Red Ops</h1>
        <span style={{ fontSize: 12.5, color: C.textSecondary }}>run the attack side, then go defend it</span>
      </div>
      <p style={{ fontSize: 12.5, color: C.textMuted, margin: '0 0 20px', lineHeight: 1.55, maxWidth: 760 }}>
        Every choice here is a decision an attacker makes, not code you write — pick one option per stage, same as
        Respond. At the end you get an evasion score, and a button to go defend this exact incident as the analyst.
        Play both hats and see which one wins.
      </p>
      {AVAILABLE.map((scenario) => (
        <Card key={scenario.id} style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{scenario.queueLabel}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{RED_OPS[scenario.id].crew}</div>
            </div>
            <Button variant="primary" onClick={() => onPick(scenario.id)}>
              <IconZap size={14} /> Start operation
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function StagePlay({ scenario, ops, onFinish }) {
  const [stageIndex, setStageIndex] = useState(0);
  const [choiceIds, setChoiceIds] = useState([]);
  const [selected, setSelected] = useState(null);
  const stage = ops.stages[stageIndex];
  const isLast = stageIndex === ops.stages.length - 1;

  function confirmStage() {
    const next = [...choiceIds, selected];
    if (isLast) {
      onFinish(next);
      return;
    }
    setChoiceIds(next);
    setSelected(null);
    setStageIndex(stageIndex + 1);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{ops.crew}</h1>
        <Badge label={`Stage ${stageIndex + 1} of ${ops.stages.length}`} tone={TONE.primary} />
      </div>
      <div style={{ fontSize: 12.5, color: C.textSecondary, marginBottom: 4 }}>{scenario.queueLabel}</div>
      <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 20, lineHeight: 1.55, maxWidth: 760 }}>{ops.objective}</div>

      <Card style={{ padding: 18, marginBottom: 16 }}>
        <SectionLabel icon={<IconTarget size={13} />}>{stage.label} — {stage.prompt}</SectionLabel>
        {stage.choices.map((choice) => {
          const isSelected = selected === choice.id;
          return (
            <button
              key={choice.id}
              type="button"
              onClick={() => setSelected(choice.id)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                background: isSelected ? C.primarySoft : C.surface,
                border: `1px solid ${isSelected ? C.primary : C.border}`,
                borderRadius: 8, padding: '12px 14px', marginBottom: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isSelected && <IconCheck size={14} style={{ color: C.primaryStrong, flexShrink: 0 }} />}
                <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{choice.label}</span>
              </div>
            </button>
          );
        })}
      </Card>

      <Button variant="primary" disabled={!selected} onClick={confirmStage} style={{ width: '100%', justifyContent: 'center' }}>
        {isLast ? 'Finish operation' : 'Continue'}
      </Button>
    </div>
  );
}

function Debrief({ scenario, ops, result, onDefend, onRestart }) {
  const { evasionScore, breakdown } = result;
  const tone = evasionScore >= 60 ? TONE.positive : evasionScore >= 35 ? TONE.coaching : TONE.concerned;

  return (
    <div>
      <Card tone={tone} style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: tone.fg }}>Operation complete — {ops.crew}</div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.5 }}>EVASION SCORE</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: tone.fg }}>{evasionScore}<span style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary }}>/100</span></div>
          </div>
        </div>
      </Card>

      <Card style={{ padding: 18, marginBottom: 16 }}>
        <SectionLabel>How each choice would have looked to the SOC</SectionLabel>
        {breakdown.map((b, i) => (
          <div key={i} style={{ padding: '10px 0', borderBottom: i < breakdown.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
                {b.stageLabel}: {b.choiceLabel}
                {b.canonical && <span style={{ marginLeft: 8 }}><Badge label="what really happened" tone={TONE.neutral} /></span>}
              </div>
              <div style={{ fontSize: 12.5, color: C.textSecondary, fontFamily: 'monospace', flexShrink: 0 }}>
                stealth {b.stealth} · {b.tactic} caught {b.tacticDetectionPct}% of the time
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>{b.note}</div>
          </div>
        ))}
      </Card>

      <Callout tone={TONE.primary} style={{ marginBottom: 16 }}>
        Now go work this exact alert as the Tier 1 analyst — your evasion score here gets compared against your own
        defense score once you close the case.
      </Callout>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={() => onDefend(scenario.id, result)} style={{ flex: '1 1 220px', justifyContent: 'center' }}>
          Defend this incident now →
        </Button>
        <Button variant="ghost" onClick={onRestart}>Run a different operation</Button>
      </div>
    </div>
  );
}

export default function RedOpsView({ onDefend }) {
  const [scenarioId, setScenarioId] = useState(null);
  const [result, setResult] = useState(null);

  if (!scenarioId) return <ScenarioPicker onPick={(id) => { setScenarioId(id); setResult(null); }} />;

  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  const ops = RED_OPS[scenarioId];

  if (!result) {
    return (
      <StagePlay
        scenario={scenario}
        ops={ops}
        onFinish={(choiceIds) => setResult(scoreRedRun(ops, choiceIds))}
      />
    );
  }

  return (
    <Debrief
      scenario={scenario}
      ops={ops}
      result={result}
      onDefend={onDefend}
      onRestart={() => { setScenarioId(null); setResult(null); }}
    />
  );
}
