// Fast Triage: twenty alert cards against a clock, no searching, no feedback
// until the end. The full shift trains depth; this trains the volume side of
// the job, where the skill is reading the two facts that decide an alert.
//
// A run lives in component state only. Refreshing mid-run abandons it, the same
// as walking away from a real queue, and only finished runs are kept.

import { useCallback, useEffect, useRef, useState } from 'react';
import { DISPOSITIONS } from '../data/fasttriage.js';
import { KEEP_RUNS, loadFastTriageRuns as loadRuns, saveFastTriageRuns as saveRuns } from '../engine/fasttriageStore.js';
import { announce, matchFastTriage } from '../engine/easterEggs.js';
import { RUN_SECONDS, RUN_SIZE, dealRun, scoreRun } from '../engine/fasttriage.js';
import { C, MONO, TONE, severityTone } from '../theme.js';
import { Badge, Button, Callout, Card, Metric, SectionLabel } from '../ui/primitives.jsx';
import { IconAlertOctagon, IconCheck, IconClock, IconListChecks, IconX } from '../ui/icons.jsx';

const clock = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const CHOICE_LABEL = Object.fromEntries(DISPOSITIONS.map((d) => [d.value, d.label]));
const GRADE_TONE = { A: TONE.positive, B: TONE.positive, C: TONE.coaching, D: TONE.coaching, F: TONE.concerned };
const OUTCOME_TONE = {
  correct: TONE.positive, overtriage: TONE.coaching, undertriage: TONE.concerned, skipped: TONE.neutral,
};
const OUTCOME_LABEL = {
  correct: 'Correct', overtriage: 'Over-escalated', undertriage: 'Under-triaged', skipped: 'Not reached',
};

function Intro({ runs, onStart }) {
  const best = runs.length ? Math.max(...runs.map((r) => r.score)) : null;
  const recent = runs.slice(-5).reverse();
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Fast Triage</h1>
        <span style={{ fontSize: 12.5, color: C.textSecondary }}>volume, not depth</span>
      </div>
      <p style={{ fontSize: 12.5, color: C.textMuted, margin: '0 0 18px', lineHeight: 1.55, maxWidth: 760 }}>
        {RUN_SIZE} alerts, {Math.round(RUN_SECONDS / 60)} minutes. Each card gives you the fields a SIEM row would and
        nothing to search: read it, then close it, send it to Tier 2, or page IR. You get no feedback until the end,
        which is how a real queue works. The reported severity is only what the tool said. About a third of the run
        is alerts that read scary and are benign, or read routine and are real.
      </p>

      <Card style={{ padding: 16, marginBottom: 16 }}>
        <SectionLabel icon={<IconListChecks size={13} />}>The three calls</SectionLabel>
        {DISPOSITIONS.map((d, i) => (
          <div key={d.value} style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '4px 0', fontSize: 13 }}>
            <kbd style={{ fontFamily: MONO, fontSize: 11.5, border: `1px solid ${C.borderStrong}`, borderRadius: 4, padding: '1px 6px', color: C.textSecondary }}>{i + 1}</kbd>
            <strong style={{ color: C.text, minWidth: 64 }}>{d.label}</strong>
            <span style={{ color: C.textSecondary }}>{d.hint}</span>
          </div>
        ))}
        <p style={{ fontSize: 12, color: C.textMuted, margin: '10px 0 0', lineHeight: 1.55 }}>
          Scoring is weighted, not a plain percent. Closing a live intrusion costs several times what sending a benign
          alert to Tier 2 does, and a run that closes one can't grade above C.
        </p>
      </Card>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <Button variant="primary" onClick={onStart}><IconClock size={14} /> Start run</Button>
        {best !== null && <Badge label={`Best ${best}`} tone={TONE.positive} />}
        {runs.length > 0 && <Badge label={`${runs.length} run${runs.length === 1 ? '' : 's'} on record`} tone={TONE.neutral} />}
      </div>

      {recent.length > 0 && (
        <Card style={{ padding: 16 }}>
          <SectionLabel>Recent runs</SectionLabel>
          {recent.map((r) => (
            <div key={r.at} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '5px 0', fontSize: 12.5, flexWrap: 'wrap' }}>
              <Badge label={r.grade} tone={GRADE_TONE[r.grade] || TONE.neutral} />
              <strong style={{ color: C.text, minWidth: 36 }}>{r.score}</strong>
              <span style={{ color: C.textSecondary }}>
                {r.correct}/{r.total} correct · {r.closedLive} live threat{r.closedLive === 1 ? '' : 's'} closed
                {r.avgSeconds !== null && r.avgSeconds !== undefined ? ` · ${r.avgSeconds.toFixed(0)}s per alert` : ''}
              </span>
              <span style={{ color: C.textMuted, marginLeft: 'auto' }}>{new Date(r.at).toLocaleDateString()}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function Running({ alerts, onFinish }) {
  const [index, setIndex] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);
  const cardShownAt = useRef(startedAt);
  const answers = useRef({});
  const done = useRef(false);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onFinish(answers.current);
  }, [onFinish]);

  const remaining = RUN_SECONDS - (now - startedAt) / 1000;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (remaining <= 0) finish();
  }, [remaining, finish]);

  const answer = useCallback((choice) => {
    if (done.current) return;
    const t = Date.now();
    answers.current[alerts[index].id] = { choice, ms: t - cardShownAt.current };
    cardShownAt.current = t;
    if (index + 1 >= alerts.length) finish();
    else setIndex(index + 1);
  }, [alerts, index, finish]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const d = DISPOSITIONS[Number(e.key) - 1];
      if (d) answer(d.value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answer]);

  const alert = alerts[index];
  const low = remaining <= 60;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Fast Triage</h1>
        <Badge label={`Alert ${index + 1} of ${alerts.length}`} tone={TONE.primary} />
        <span style={{
          marginLeft: 'auto', fontFamily: MONO, fontSize: 15, fontWeight: 700,
          color: low ? C.danger : C.text,
        }} role="timer" aria-label="Time remaining">
          {clock(remaining)}
        </span>
      </div>

      <div
        style={{ height: 4, background: C.surfaceAlt, borderRadius: 2, marginBottom: 18, overflow: 'hidden' }}
        role="progressbar" aria-valuemin={0} aria-valuemax={alerts.length} aria-valuenow={index}
      >
        <div style={{ height: '100%', width: `${(index / alerts.length) * 100}%`, background: C.primary, transition: 'width 0.2s' }} />
      </div>

      <Card style={{ padding: 20, marginBottom: 16 }} key={alert.id}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
          <Badge label={alert.severity} tone={severityTone(alert.severity)} title="What the tool reported. Yours to confirm or overturn." />
          <span style={{ fontSize: 12, color: C.textMuted }}>{alert.source}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 14, lineHeight: 1.4 }}>{alert.rule}</div>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(110px, max-content) 1fr', gap: '7px 16px', fontSize: 13 }}>
          {alert.facts.map(([label, value]) => (
            <div key={label} style={{ display: 'contents' }}>
              <dt style={{ color: C.textSecondary, fontWeight: 600 }}>{label}</dt>
              <dd style={{ margin: 0, color: C.text, fontFamily: MONO, fontSize: 12.5, lineHeight: 1.5 }}>{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {DISPOSITIONS.map((d, i) => (
          <Button
            key={d.value}
            variant={d.value === 'ir' ? 'danger' : d.value === 'tier2' ? 'primary' : 'secondary'}
            onClick={() => answer(d.value)}
            style={{ flex: '1 1 140px', justifyContent: 'center', padding: '12px 14px' }}
            title={d.hint}
          >
            <kbd style={{ fontFamily: MONO, fontSize: 11, opacity: 0.7 }}>{i + 1}</kbd> {d.label}
          </Button>
        ))}
      </div>
      <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 10 }}>Press 1, 2 or 3 to answer. No going back.</div>
    </div>
  );
}

function Review({ result, onAgain, onExit }) {
  const missed = result.rows.filter((r) => r.outcome !== 'correct');
  const ordered = [
    ...result.rows.filter((r) => r.outcome === 'undertriage'),
    ...result.rows.filter((r) => r.outcome === 'overtriage'),
    ...result.rows.filter((r) => r.outcome === 'skipped'),
    ...result.rows.filter((r) => r.outcome === 'correct'),
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Run review</h1>
        <Badge label={`Grade ${result.grade}`} tone={GRADE_TONE[result.grade]} />
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{result.score}/100</span>
      </div>

      {result.closedLive > 0 && (
        <Callout tone={TONE.concerned} title={`You closed ${result.closedLive} live threat${result.closedLive === 1 ? '' : 's'}`} style={{ marginBottom: 14 }}>
          That is the mistake that gets a bank breached, and it caps the grade at C however clean the rest was.
          {' '}{result.rows.filter((r) => r.alert.disposition !== 'close' && r.choice === 'close').map((r) => r.alert.rule).join('; ')}.
        </Callout>
      )}
      {result.skipped > 0 && (
        <Callout tone={TONE.coaching} title={`${result.skipped} alert${result.skipped === 1 ? '' : 's'} not reached`} style={{ marginBottom: 14 }}>
          The clock ran out. Unread alerts are scored as a backlog, not as correct.
        </Callout>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <Metric label="Correct" value={`${result.correct}/${result.total}`} tone={result.accuracy >= 0.8 ? TONE.positive : TONE.coaching} />
        <Metric label="Under-triaged" value={result.missedThreats} hint="real threats sent too low" tone={result.missedThreats ? TONE.concerned : TONE.positive} />
        <Metric label="Over-escalated" value={result.overTriaged} hint="cost Tier 2 time" tone={result.overTriaged > 3 ? TONE.coaching : TONE.neutral} />
        <Metric label="Traps fell for" value={`${result.trapsMissed}/${result.trapsTotal}`} hint="scary-but-benign or routine-but-real" tone={result.trapsMissed ? TONE.coaching : TONE.positive} />
        <Metric label="Pace" value={result.avgSeconds === null ? 'n/a' : `${result.avgSeconds.toFixed(0)}s`} hint="per alert" />
      </div>

      {result.byTheme.length > 0 && (
        <Card style={{ padding: 16, marginBottom: 16 }}>
          <SectionLabel>Where you slipped</SectionLabel>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {result.byTheme.map((t) => (
              <Badge key={t.theme} label={`${t.theme}${t.count > 1 ? ` ×${t.count}` : ''}`} tone={TONE.coaching} />
            ))}
          </div>
        </Card>
      )}

      <SectionLabel>{missed.length ? 'Every alert, mistakes first' : 'Every alert'}</SectionLabel>
      {ordered.map((r) => (
        <Card key={r.alert.id} tone={r.outcome === 'correct' ? undefined : OUTCOME_TONE[r.outcome]} style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ color: OUTCOME_TONE[r.outcome].fg, display: 'flex' }}>
              {r.outcome === 'correct' ? <IconCheck size={15} /> : r.outcome === 'undertriage' ? <IconAlertOctagon size={15} /> : <IconX size={15} />}
            </span>
            <strong style={{ fontSize: 13, color: C.text }}>{r.alert.rule}</strong>
            <Badge label={OUTCOME_LABEL[r.outcome]} tone={OUTCOME_TONE[r.outcome]} />
            {r.alert.trap && <Badge label={r.alert.trap === 'overstated' ? 'read scary, benign' : 'read routine, real'} tone={TONE.business} />}
          </div>
          <div style={{ fontSize: 12.5, color: C.textSecondary, marginBottom: 4 }}>
            Reported {r.alert.severity} · you chose <strong>{r.choice === 'skipped' ? 'nothing' : CHOICE_LABEL[r.choice]}</strong> · answer <strong>{CHOICE_LABEL[r.alert.disposition]}</strong>
            {r.ms !== null && ` · ${(r.ms / 1000).toFixed(0)}s`}
          </div>
          <div style={{ fontSize: 12.5, color: C.text, lineHeight: 1.55 }}>{r.alert.tell}</div>
        </Card>
      ))}

      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={onAgain}><IconClock size={14} /> New run</Button>
        <Button onClick={onExit}>Back to overview</Button>
      </div>
    </div>
  );
}

export default function FastTriageView() {
  const [phase, setPhase] = useState('intro');
  const [alerts, setAlerts] = useState([]);
  const [result, setResult] = useState(null);
  const [runs, setRuns] = useState(loadRuns);

  function start() {
    // Date.now() plus a random word: two runs in the same millisecond still differ.
    const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
    setAlerts(dealRun(seed));
    setResult(null);
    setPhase('running');
  }

  const finish = useCallback((answers) => {
    const scored = scoreRun(alerts, answers);
    const egg = matchFastTriage(scored);
    if (egg) announce(egg);
    const record = {
      at: Date.now(), score: scored.score, grade: scored.grade, correct: scored.correct, total: scored.total,
      closedLive: scored.closedLive, avgSeconds: scored.avgSeconds,
    };
    const next = [...loadRuns(), record];
    saveRuns(next);
    setRuns(next.slice(-KEEP_RUNS));
    setResult(scored);
    setPhase('review');
  }, [alerts]);

  if (phase === 'running') return <Running alerts={alerts} onFinish={finish} />;
  if (phase === 'review' && result) return <Review result={result} onAgain={start} onExit={() => setPhase('intro')} />;
  return <Intro runs={runs} onStart={start} />;
}
