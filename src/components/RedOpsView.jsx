// Play the incident from the attacker's side, as a live operation: a chain of
// choices — never freeform code, the same discipline as the Respond tab — where
// the SOC reacts after every move. Each move is revealed the moment you commit
// it (caught or slipped past, and why), the SOC's alertness climbs and makes
// your later moves louder, and you can lie low once to shake it off or abort
// and bank what you have. At the end you get an evasion score and a button to
// go defend the same incident as the analyst.

import { useState } from 'react';
import { SCENARIOS } from '../data/scenarios/index.js';
import { RED_OPS } from '../data/redops.js';
import {
  ALERTNESS_LABELS, BURN_LEVEL, DWELL_PENALTY, PENALTY_PER_LEVEL,
  abortRun, canGoDark, currentStageIndex, goDark, playStage, scoreRun, startRun,
} from '../engine/redopsRun.js';
import { announce, matchRedRun } from '../engine/easterEggs.js';
import { RED_BAR, redStatus } from '../engine/redProgress.js';
import { C, MONO, TONE } from '../theme.js';
import { Badge, Button, Callout, Card, SectionLabel } from '../ui/primitives.jsx';
import { IconAlertOctagon, IconCheck, IconClock, IconCrosshair, IconRadio, IconX } from '../ui/icons.jsx';

const AVAILABLE = Object.keys(RED_OPS)
  .map((id) => SCENARIOS.find((s) => s.id === id))
  .filter(Boolean);

const LEVEL_TONE = [TONE.positive, TONE.coaching, TONE.concerned, TONE.concerned];

// The attacker-side career: rank, what the next promotion needs, and the record
// behind it. A rank is a checkpoint, so it is shown even before any run.
function RedCareer({ status }) {
  const { stats } = status;
  return (
    <Card style={{ padding: 16, marginBottom: 18 }}>
      <SectionLabel icon={<IconCrosshair size={13} />}>Red Ops career</SectionLabel>
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>{status.rank}</div>
        <span style={{ fontSize: 12, color: C.textSecondary }}>
          {status.next ? `working toward ${status.next}` : 'top rank reached'}
        </span>
      </div>
      {status.viaCheckpoint && (
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
          Locked in as a checkpoint. Clearing your record doesn't take back a rank you already earned.
        </div>
      )}
      {status.next ? (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: 12.5, color: C.textSecondary, marginBottom: 6 }}>
            Promotion to <strong>{status.next}</strong> needs:
          </div>
          {status.criteria.map((c) => (
            <div key={c.label} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 12.5, padding: '3px 0', color: c.met ? C.text : C.textSecondary }}>
              <span style={{ color: c.met ? C.success : C.textMuted, display: 'flex', flexShrink: 0, transform: 'translateY(2px)' }}>
                {c.met ? <IconCheck size={13} /> : <IconX size={13} />}
              </span>
              <span style={{ flex: 1 }}>{c.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.textMuted }}>{c.current} / {c.target}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12.5, color: C.textSecondary }}>
          Every operation cleared at {RED_BAR}+, a ghost run on record, and a clean recent streak.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <Badge label={`${stats.runs} run${stats.runs === 1 ? '' : 's'}`} tone={TONE.neutral} />
        <Badge label={`${stats.completed} completed`} tone={TONE.neutral} />
        <Badge label={`${stats.ghosts} ghost`} tone={stats.ghosts ? TONE.positive : TONE.neutral} title="Objective reached without a single move being caught" />
        <Badge label={`${stats.burned} burned`} tone={stats.burned ? TONE.concerned : TONE.neutral} />
        <Badge label={`${stats.aborted} aborted`} tone={stats.aborted ? TONE.coaching : TONE.neutral} />
      </div>
    </Card>
  );
}

function ScenarioPicker({ onPick, status }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Red Ops</h1>
        <span style={{ fontSize: 12.5, color: C.textSecondary }}>run the attack side, then go defend it</span>
      </div>
      <p style={{ fontSize: 12.5, color: C.textMuted, margin: '0 0 20px', lineHeight: 1.55, maxWidth: 760 }}>
        Every choice here is a decision an attacker makes, not code you write. The SOC reacts to each move as you make
        it: a caught move raises its alertness and makes everything after it louder, three catches burn the
        operation, and you can go dark once to shake the analyst off or abort and bank what you have. At the end you get
        an evasion score, and a button to go defend this exact incident as the analyst.
      </p>
      <RedCareer status={status} />
      {AVAILABLE.map((scenario) => {
        const best = status.stats.best[scenario.id];
        return (
        <Card key={scenario.id} style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{scenario.queueLabel}</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 3 }}>{RED_OPS[scenario.id].crew}</div>
              <div style={{ marginTop: 8 }}>
                {best === undefined
                  ? <Badge label="Not cleared yet" tone={TONE.neutral} />
                  : <Badge label={`Best completed run: ${best}${best >= RED_BAR ? ' · cleared' : ` · below the ${RED_BAR} bar`}`} tone={best >= RED_BAR ? TONE.positive : TONE.coaching} />}
              </div>
            </div>
            <Button variant="primary" onClick={() => onPick(scenario.id)}>
              <IconCrosshair size={14} /> Start operation
            </Button>
          </div>
        </Card>
        );
      })}
    </div>
  );
}

// The SOC's alertness as a four-step ladder, so the consequence of a caught
// move is something you can see and not a number in a debrief.
function AlertnessLadder({ level }) {
  return (
    <div role="group" aria-label={`SOC alertness: ${ALERTNESS_LABELS[level]}`} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {ALERTNESS_LABELS.map((label, i) => {
        const active = i === level;
        const tone = LEVEL_TONE[i];
        return (
          <span
            key={label}
            aria-current={active ? 'step' : undefined}
            style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, letterSpacing: 0.3,
              background: active ? tone.bg : 'transparent', color: active ? tone.fg : C.textMuted,
              border: `1px solid ${active ? tone.border : C.border}`, opacity: i > level ? 0.55 : 1,
            }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

// Effective stealth against the line the SOC's detection draws: left of the
// marker is caught, right of it slips past.
function StealthMeter({ pick }) {
  const pct = (n) => `${Math.max(0, Math.min(100, n))}%`;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: 'relative', height: 10, background: C.surfaceAlt, borderRadius: 5, border: `1px solid ${C.border}` }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(pick.effectiveStealth), borderRadius: 5,
          background: pick.caught ? C.danger : C.success,
        }} />
        <div
          title={`Detection line: ${pick.threshold}`}
          style={{ position: 'absolute', left: pct(pick.threshold), top: -4, bottom: -4, width: 2, background: C.text }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: C.textSecondary, marginTop: 5, fontFamily: MONO }}>
        <span>
          stealth {pick.effectiveStealth}
          {pick.penalty > 0 && ` (${pick.stealth} base, −${pick.penalty} for SOC alertness)`}
        </span>
        <span>detection line {pick.threshold}</span>
      </div>
    </div>
  );
}

function SocConsole({ log }) {
  return (
    <Card style={{ padding: 14, position: 'sticky', top: 12 }}>
      <SectionLabel icon={<IconRadio size={13} />}>SOC console: what they see</SectionLabel>
      {log.length === 0 && (
        <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.55 }}>
          Quiet. Nothing has fired yet. Every move you commit shows up here the way the defenders would see it.
        </div>
      )}
      <ol aria-live="polite" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column-reverse', gap: 10 }}>
        {log.map((entry, i) => {
          const tone = entry.kind === 'alert' ? TONE.concerned : entry.kind === 'dark' ? TONE.business : TONE.positive;
          return (
            <li key={i} style={{ fontSize: 12.5, lineHeight: 1.5, color: C.text, borderLeft: `3px solid ${tone.border}`, paddingLeft: 10 }}>
              {entry.stageLabel && <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{entry.stageLabel}</div>}
              {entry.text}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function Operation({ scenario, ops, onFinish }) {
  const [run, setRun] = useState(startRun);
  const [selected, setSelected] = useState(null);
  // 'choose' while picking a move; 'reveal' right after committing one.
  const [phase, setPhase] = useState('choose');

  const index = phase === 'reveal' ? currentStageIndex(run) - 1 : currentStageIndex(run);
  const stage = ops.stages[index];
  const lastPick = run.picks[run.picks.length - 1];
  const over = run.status !== 'active';
  const level = Math.min(run.detections, BURN_LEVEL);
  const penalty = run.detections * PENALTY_PER_LEVEL;

  function commit() {
    if (!selected) return;
    setRun(playStage(run, ops, selected));
    setSelected(null);
    setPhase('reveal');
  }

  function next() {
    if (over) onFinish(run);
    else setPhase('choose');
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{ops.crew}</h1>
        <Badge label={`Stage ${Math.min(index + 1, ops.stages.length)} of ${ops.stages.length}`} tone={TONE.primary} />
        {run.dwellDays > 0 && <Badge label={`${run.dwellDays} day${run.dwellDays === 1 ? '' : 's'} dwelling`} tone={TONE.business} />}
      </div>
      <div style={{ fontSize: 12.5, color: C.textSecondary, marginBottom: 4 }}>{scenario.queueLabel}</div>
      <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 16, lineHeight: 1.55, maxWidth: 760 }}>{ops.objective}</div>

      <Card style={{ padding: '12px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.5, marginBottom: 6 }}>SOC ALERTNESS</div>
            <AlertnessLadder level={level} />
          </div>
          {!over && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                onClick={() => setRun(goDark(run))}
                disabled={phase === 'reveal' || !canGoDark(run)}
                title={canGoDark(run)
                  ? `Lie low for a day: the SOC drops one alertness level, and it costs ${DWELL_PENALTY} points. Once per operation.`
                  : run.darkUsed ? 'Already used your one day of lying low.' : 'Nothing to hide from yet. Only useful once the SOC has noticed you.'}
              >
                <IconClock size={14} /> Go dark
              </Button>
              <Button variant="ghost" onClick={() => onFinish(abortRun(run))} title="End the operation now and score what you have. Unfinished stages count against you.">
                Abort operation
              </Button>
            </div>
          )}
        </div>
        {penalty > 0 && !over && (
          <div style={{ fontSize: 12, color: C.warning, marginTop: 8 }}>
            The SOC is watching your foothold: every move from here is {penalty} stealth points louder.
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 460px', minWidth: 0 }}>
          {phase === 'choose' && stage && (
            <>
              <Card style={{ padding: 18, marginBottom: 16 }}>
                <SectionLabel icon={<IconCrosshair size={13} />}>{stage.label}: {stage.prompt}</SectionLabel>
                {stage.choices.map((choice) => {
                  const isSelected = selected === choice.id;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() => setSelected(choice.id)}
                      aria-pressed={isSelected}
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
              <Button variant="primary" disabled={!selected} onClick={commit} style={{ width: '100%', justifyContent: 'center' }}>
                Commit move
              </Button>
            </>
          )}

          {phase === 'reveal' && lastPick && (
            <>
              <Card tone={lastPick.caught ? TONE.concerned : TONE.positive} style={{ padding: 18, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ color: lastPick.caught ? C.danger : C.success, display: 'flex' }}>
                    {lastPick.caught ? <IconAlertOctagon size={18} /> : <IconCheck size={18} />}
                  </span>
                  <strong style={{ fontSize: 15, color: lastPick.caught ? C.danger : C.success }}>
                    {lastPick.caught ? 'Caught' : 'Slipped past'}
                  </strong>
                  <span style={{ fontSize: 12.5, color: C.textSecondary }}>{lastPick.stageLabel}: {lastPick.choiceLabel}</span>
                </div>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{lastPick.note}</div>
                <StealthMeter pick={lastPick} />
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>
                  {lastPick.tactic} is caught {lastPick.tacticDetectionPct}% of the time at this bank.
                  {lastPick.canonical && ' This is what really happened in the incident.'}
                </div>
              </Card>

              {run.status === 'burned' && (
                <Callout tone={TONE.concerned} title="Burned" style={{ marginBottom: 16 }}>
                  Three of your moves were caught. The host is isolated and your access is gone. Whatever stages were left
                  are unplayed, and they count against your score.
                </Callout>
              )}
              {run.status === 'complete' && (
                <Callout tone={TONE.positive} title="Objective reached" style={{ marginBottom: 16 }}>
                  You got through every stage. Your score reflects how loud each move was once the SOC started watching.
                </Callout>
              )}
              <Button variant="primary" onClick={next} style={{ width: '100%', justifyContent: 'center' }}>
                {over ? 'See the debrief' : 'Next stage'}
              </Button>
            </>
          )}
        </div>

        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <SocConsole log={run.log} />
        </div>
      </div>
    </div>
  );
}

const OUTCOME = {
  complete: { title: 'Operation complete', tone: null },
  burned: { title: 'Operation burned', tone: TONE.concerned },
  aborted: { title: 'Operation aborted', tone: TONE.coaching },
};

function Debrief({ scenario, ops, result, promotedTo, onDefend, onRestart }) {
  const { evasionScore, breakdown, outcome, notReached, dwellDays } = result;
  const caughtCount = breakdown.filter((b) => b.caught).length;
  const tone = OUTCOME[outcome]?.tone
    || (evasionScore >= 60 ? TONE.positive : evasionScore >= 35 ? TONE.coaching : TONE.concerned);

  return (
    <div>
      <Card tone={tone} style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: tone.fg }}>{OUTCOME[outcome]?.title} — {ops.crew}</div>
            <div style={{ fontSize: 12.5, color: C.textSecondary, marginTop: 3 }}>
              {caughtCount} of {breakdown.length} moves caught{dwellDays > 0 ? ` · ${dwellDays} day of lying low` : ''}
              {notReached.length > 0 ? ` · ${notReached.length} stage${notReached.length === 1 ? '' : 's'} not reached` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textSecondary, letterSpacing: 0.5 }}>EVASION SCORE</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: tone.fg }}>{evasionScore}<span style={{ fontSize: 13, fontWeight: 500, color: C.textSecondary }}>/100</span></div>
          </div>
        </div>
      </Card>

      {promotedTo && (
        <Callout tone={TONE.positive} title={`Promoted: ${promotedTo}`} style={{ marginBottom: 16 }}>
          That run cleared the bar. The rank is a checkpoint now, so clearing your record won't take it back.
        </Callout>
      )}

      <Card style={{ padding: 18, marginBottom: 16 }}>
        <SectionLabel>How each move looked to the SOC</SectionLabel>
        {breakdown.map((b, i) => (
          <div key={b.stageId} style={{ padding: '10px 0', borderBottom: i < breakdown.length - 1 || notReached.length ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span>{b.stageLabel}: {b.choiceLabel}</span>
                <Badge label={b.caught ? <><IconX size={10} /> Caught</> : <><IconCheck size={10} /> Slipped past</>} tone={b.caught ? TONE.concerned : TONE.positive} />
                {b.canonical && <Badge label="what really happened" tone={TONE.neutral} />}
              </div>
              <div style={{ fontSize: 12.5, color: C.textSecondary, fontFamily: MONO, minWidth: 0, overflowWrap: 'anywhere' }}>
                stealth {b.effectiveStealth}{b.penalty > 0 ? ` (${b.stealth} −${b.penalty})` : ''} vs line {b.threshold} · {b.tactic} caught {b.tacticDetectionPct}%
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.5 }}>{b.note}</div>
          </div>
        ))}
        {notReached.map((label) => (
          <div key={label} style={{ padding: '10px 0', fontSize: 12.5, color: C.textMuted }}>
            {label}: not reached. Counts as zero toward the score.
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

export default function RedOpsView({ onDefend, progress, onRunFinished }) {
  const [scenarioId, setScenarioId] = useState(null);
  const [result, setResult] = useState(null);
  const [promotedTo, setPromotedTo] = useState(null);
  const status = redStatus(progress.history, Object.keys(RED_OPS), progress.checkpointRankIndex);

  if (!scenarioId) return <ScenarioPicker status={status} onPick={(id) => { setScenarioId(id); setResult(null); setPromotedTo(null); }} />;

  const scenario = SCENARIOS.find((s) => s.id === scenarioId);
  const ops = RED_OPS[scenarioId];

  if (!result) {
    return (
      <Operation
        key={scenarioId}
        scenario={scenario}
        ops={ops}
        onFinish={(run) => {
          const scored = scoreRun(ops, run);
          const egg = matchRedRun(scored);
          if (egg) announce(egg);
          setPromotedTo(onRunFinished(scenarioId, scored));
          setResult(scored);
        }}
      />
    );
  }

  return (
    <Debrief
      scenario={scenario}
      ops={ops}
      result={result}
      promotedTo={promotedTo}
      onDefend={onDefend}
      onRestart={() => { setScenarioId(null); setResult(null); }}
    />
  );
}
