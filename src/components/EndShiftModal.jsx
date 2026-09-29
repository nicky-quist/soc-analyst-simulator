// The moment "ending a shift" becomes real instead of just re-dealing a hand:
// every open or escalated case has to go to someone, and who that is isn't a
// choice you make here — it was already decided by the escalation call on the
// Report tab. This just makes that consequence visible before you walk away.

import { COMPANY } from '../data/scenarios/index.js';
import { buildShiftHandoff } from '../engine/handoff.js';
import { C, TONE } from '../theme.js';
import { Badge, Button, Card, SectionLabel } from '../ui/primitives.jsx';
import { formatDuration } from '../ui/helpers.js';
import { IconFileCheck } from '../ui/icons.jsx';

const NEXT_SHIFT_RECIPIENT = {
  name: 'Next shift',
  title: "Tier 1 Analyst — your seat, next time",
  blurb: "Nobody escalated this. It just carries into the next queue, same as any open alert would.",
};

function recipientFor(note) {
  if (note.escalatedTo === 'IR') return COMPANY.irLead;
  if (note.escalatedTo === 'Tier 2') return COMPANY.tier2;
  return NEXT_SHIFT_RECIPIENT;
}

function initials(name) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

function NoteCard({ note }) {
  const recipient = recipientFor(note);
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
      <div style={{ fontSize: 12.5, color: C.textSecondary, marginBottom: 8 }}>
        {note.findings} · on it for {formatDuration(note.elapsedMs)}
      </div>
      {note.stillNeeded.length > 0 && (
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
          Still needed: {note.stillNeeded.join('; ')}
        </div>
      )}
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', background: C.surfaceAlt, border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800,
          color: C.textSecondary, flexShrink: 0,
        }}>
          {initials(recipient.name)}
        </div>
        <div style={{ lineHeight: 1.3, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>Goes to {recipient.name}</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>{recipient.title}</div>
        </div>
      </div>
    </Card>
  );
}

export default function EndShiftModal({ scenarios, cases, onConfirm, onCancel }) {
  const notes = buildShiftHandoff(scenarios, cases);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review handoff before ending shift"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, boxShadow: C.shadow,
        maxWidth: 620, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: 22,
      }}>
        <SectionLabel icon={<IconFileCheck size={14} />}>Before you end this shift</SectionLabel>
        <p style={{ fontSize: 12.5, color: C.textSecondary, lineHeight: 1.55, margin: '4px 0 16px' }}>
          {notes.length} case{notes.length === 1 ? '' : 's'} {notes.length === 1 ? 'is' : 'are'} still open or
          escalated. Here's exactly who picks each one up.
        </p>

        {notes.map((note) => <NoteCard key={note.scenarioId} note={note} />)}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
          <Button variant="ghost" onClick={onCancel}>Keep working</Button>
          <Button variant="primary" onClick={onConfirm}>I've reviewed this — end shift</Button>
        </div>
      </div>
    </div>
  );
}
