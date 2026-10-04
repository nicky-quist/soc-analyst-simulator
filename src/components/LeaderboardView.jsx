// Leaderboards

import { useMemo, useState } from 'react';
import { EGGS } from '../data/easterEggs.js';
import { RED_OPS } from '../data/redops.js';
import { SCENARIOS } from '../data/scenarios/index.js';
import { loadFound } from '../engine/easterEggsStore.js';
import { loadFastTriageRuns } from '../engine/fasttriageStore.js';
import { RULES, buildBoards, standingText } from '../engine/leaderboard.js';
import { mergeBoards, standingPayload } from '../engine/online.js';
import { useOnline } from '../lib/useOnline.js';
import OnlineAccount from './OnlineAccount.jsx';
import { C, MONO, TONE } from '../theme.js';
import { Badge, Button, Callout, Card, Tabs } from '../ui/primitives.jsx';
import { IconTrophy } from '../ui/icons.jsx';

const RANK_TONE = [TONE.neutral, TONE.business, TONE.positive];
const GRADE_TONE = { A: TONE.positive, B: TONE.positive, C: TONE.coaching, D: TONE.coaching, F: TONE.concerned };

function Place({ rank }) {
  const medal = rank <= 3;
  return (
    <div style={{
      width: 34, height: 34, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 800, fontFamily: MONO,
      background: medal ? C.primarySoft : C.surfaceAlt, color: medal ? C.primaryStrong : C.textSecondary,
      border: `1px solid ${medal ? C.primary : C.border}`,
    }}>
      {rank}
    </div>
  );
}

function Row({ entry, children }) {
  return (
    <div
      aria-current={entry.isYou ? 'true' : undefined}
      style={{
        display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px', borderRadius: 8, flexWrap: 'wrap',
        background: entry.isYou ? C.primarySoft : 'transparent',
        border: `1px solid ${entry.isYou ? C.primary : 'transparent'}`,
      }}
    >
      <Place rank={entry.rank} />
      <div style={{ flex: '1 1 160px', minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {entry.name}
          {entry.isYou && <Badge label="You" tone={TONE.primary} />}
        </div>
        <div style={{ fontSize: 11.5, color: C.textMuted }}>{entry.role}</div>
      </div>
      <div style={{ flex: '1 1 220px', minWidth: 0 }}>{children}</div>
    </div>
  );
}

function RankLine({ entry, detail }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <Badge label={entry.rankLabel} tone={RANK_TONE[entry.rankIndex]} />
      <span style={{ fontSize: 12, color: C.textSecondary, fontFamily: MONO }}>{detail}</span>
    </div>
  );
}

function SecretsLine({ entry, total }) {
  const pct = total ? Math.round((entry.count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: C.surfaceAlt, border: `1px solid ${C.border}`, overflow: 'hidden' }} role="presentation">
        <div style={{ width: `${pct}%`, height: '100%', background: C.primary }} />
      </div>
      <span style={{ fontSize: 12, color: C.textSecondary, fontFamily: MONO, minWidth: 52, textAlign: 'right' }}>{entry.count} / {total}</span>
    </div>
  );
}

function gradeLabel(score) {
  return score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';
}

const TABS = [
  { id: 'blue', label: 'Blue Team' },
  { id: 'red', label: 'Red Team' },
  { id: 'fast', label: 'Fast Triage' },
  { id: 'secrets', label: 'Secrets' },
];

const SCOPES = [
  { id: 'everyone', label: 'Everyone' },
  { id: 'club', label: 'Club only' },
];

export default function LeaderboardView({ progress, redProgress, onOpenSettings }) {
  const [scope, setScope] = useState('everyone');
  const [board, setBoard] = useState('blue');
  const [copied, setCopied] = useState(false);
  const [found] = useState(loadFound);
  const [fastRuns] = useState(loadFastTriageRuns);

  const rosterBoards = useMemo(() => buildBoards({
    progress,
    redProgress,
    found,
    library: SCENARIOS,
    operationIds: Object.keys(RED_OPS),
    secretsTotal: EGGS.length,
    fastRuns,
  }), [progress, redProgress, found, fastRuns]);

  const payload = useMemo(() => standingPayload({
    progress, redProgress, found, fastRuns, library: SCENARIOS, operationIds: Object.keys(RED_OPS),
  }), [progress, redProgress, found, fastRuns]);

  const clubOnly = scope === 'club';
  const live = useOnline({ active: true, clubOnly, payload });
  const boards = useMemo(() => mergeBoards({
    roster: rosterBoards,
    rows: live.rows,
    clubOnly,
    youName: live.profile?.display_name ?? null,
    youIsClub: !!live.profile?.club_member,
  }), [rosterBoards, live.rows, live.profile, clubOnly]);

  const rows = boards[board];
  const you = rows.find((r) => r.isYou);
  const size = rows.length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(standingText(boards));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable: nothing to do.
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Leaderboard</h1>
        <span style={{ fontSize: 12.5, color: C.textSecondary }}>you against the SEA SOC roster and real players</span>
      </div>
      <p style={{ fontSize: 12.5, color: C.textMuted, margin: '0 0 14px', lineHeight: 1.55, maxWidth: 760 }}>
        Four boards, one list. The SEA SOC roster is fictional and fixed; the real players are other people signed in
        with GitHub. Sign in and your standing is shared and keeps itself up to date as you play, under a display name
        you choose. Ties share a rank, and you are listed first among them.
      </p>

      <div style={{ marginBottom: 16 }}>
        <OnlineAccount session={live.session} profile={live.profile} onSaved={live.refresh} />
        {live.error && (
          <Callout tone={TONE.coaching} style={{ marginTop: 10 }}>
            Couldn't reach the online players, so only the roster is shown: {live.error}
          </Callout>
        )}
        <div style={{ marginTop: 12 }}>
          <Tabs tabs={SCOPES} active={scope} onSelect={setScope} />
        </div>
      </div>

      <Tabs tabs={TABS} active={board} onSelect={setBoard} />

      <Card style={{ padding: 16, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: C.primaryStrong, display: 'flex' }}><IconTrophy size={18} /></span>
            <strong style={{ fontSize: 14, color: C.text }}>
              {you ? `You are #${you.rank} of ${size}` : 'Join the club to appear on this board'}
            </strong>
          </div>
          {you && <Button variant="secondary" onClick={copy}>{copied ? 'Copied' : 'Copy my standing'}</Button>}
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>{RULES[board]}</div>

        {!rows.length && (
          <div style={{ fontSize: 13, color: C.textMuted, padding: '8px 4px' }}>No one is on this board yet.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map((entry) => (
            <Row key={entry.id} entry={entry}>
              {board === 'blue' && (
                <RankLine
                  entry={entry}
                  detail={`cleared ${entry.cleared}/${boards.totals.blue} · avg ${entry.avg ?? 'n/a'}`}
                />
              )}
              {board === 'red' && (
                <RankLine
                  entry={entry}
                  detail={`ops ${entry.cleared}/${boards.totals.red} · ghost ${entry.ghosts} · best ${entry.best ?? 'n/a'}`}
                />
              )}
              {board === 'fast' && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  {entry.best === null ? (
                    <Badge label="No runs yet" tone={TONE.neutral} />
                  ) : (
                    <Badge label={`${entry.grade ?? gradeLabel(entry.best)} · ${entry.best}`} tone={GRADE_TONE[entry.grade ?? gradeLabel(entry.best)]} />
                  )}
                  <span style={{ fontSize: 12, color: C.textSecondary, fontFamily: MONO }}>
                    {entry.best === null
                      ? 'run one in Fast Triage'
                      : `${entry.avgSeconds === null ? 'n/a' : `${Math.round(entry.avgSeconds)}s`} per alert · ${entry.runs} run${entry.runs === 1 ? '' : 's'}`}
                  </span>
                </div>
              )}
              {board === 'secrets' && <SecretsLine entry={entry} total={boards.totals.secrets} />}
            </Row>
          ))}
        </div>
      </Card>

      {board === 'secrets' && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: C.textMuted }}>
          Hints and the option to forget what you've found are in{' '}
          <Button variant="ghost" onClick={onOpenSettings} style={{ padding: '2px 6px', fontSize: 12.5 }}>Settings</Button>.
        </div>
      )}
    </div>
  );
}
