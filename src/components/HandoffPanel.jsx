// Live handoff notes

import { useState } from 'react';
import { C, TONE } from '../theme.js';
import { Badge, Button, Callout, Card, SectionLabel } from '../ui/primitives.jsx';
import { formatDuration } from '../ui/helpers.js';
import { IconFileCheck } from '../ui/icons.jsx';
import { buildShiftHandoff, formatHandoffText } from '../engine/handoff.js';

function CopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable
    }
  }
  return <Button variant="ghost" onClick={copy}>{copied ? 'Copied' : label}</Button>;
}

function NoteCard({ note }) {
  const text = formatHandoffText([note]);
  return (
    <Card style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{note.label}</div>
          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 2 }}>{note.ref}</div>
        </div>
        <Badge
          label={note.escalatedTo ? `Escalated — ${note.escalatedTo}` : note.closed ? 'Closed' : 'Open'}
          tone={note.escalatedTo ? TONE.concerned : note.closed ? TONE.neutral : TONE.coaching}
        />
      </div>
      <div style={{ fontSize: 12.5, color: C.textSecondary, marginBottom: 6 }}>
        {note.findings} · on it for {formatDuration(note.elapsedMs)}
      </div>
      {note.stillNeeded.length > 0 && (
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, lineHeight: 1.5 }}>
          Still needed: {note.stillNeeded.join('; ')}
        </div>
      )}
      <CopyButton text={text} label="Copy this note" />
    </Card>
  );
}

export default function HandoffPanel({ scenarios, cases }) {
  const notes = buildShiftHandoff(scenarios, cases);

  if (!notes.length) {
    return (
      <Callout tone={TONE.positive} title="Nothing to hand off">
        Every case worked this shift was closed out cleanly — no open threads for the next analyst.
      </Callout>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <SectionLabel icon={<IconFileCheck size={13} />} style={{ marginBottom: 0 }}>
          {notes.length} case{notes.length === 1 ? '' : 's'} to hand off
        </SectionLabel>
        <CopyButton text={formatHandoffText(notes)} label="Copy all" />
      </div>
      {notes.map((note) => <NoteCard key={note.scenarioId} note={note} />)}
    </div>
  );
}
