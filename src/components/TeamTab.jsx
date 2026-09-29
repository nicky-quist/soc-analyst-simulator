// A Teams-style roster: who's actually reachable right now, not a static org
// chart. The presence dot on every card is read from real shift state (see
// engine/presence.js) — this project already tore out one fake/decorative
// chart this session because invented numbers teach an analyst to stop
// trusting the real ones, and a presence dot is no different.

import { COMPANY, SCENARIOS } from '../data/scenarios/index.js';
import { C, TONE } from '../theme.js';
import { Callout, Card, SectionLabel } from '../ui/primitives.jsx';
import { initials } from '../ui/helpers.js';
import { IconUsers } from '../ui/icons.jsx';
import { generateDetectionEngResponse } from '../engine/personas.js';
import { STATUS, presenceFor } from '../engine/presence.js';

// Cross-functional contacts don't live in COMPANY — they're one-off
// characters carried on individual scenarios' response actions (the ones with
// a `consequence`), so a full company roster would have to scan the library
// rather than list a fixed cast. Named here as a footnote instead of faked
// into a roster they were never meant to be part of.
const CROSS_FUNCTIONAL = [
  'Data Platform Lead', 'Employment Counsel', 'Security Engineering Manager', 'Head of IT Service Delivery',
];

const DOT_COLOR = {
  [STATUS.ONLINE]: C.success,
  [STATUS.BUSY]: C.warning,
  [STATUS.AWAY]: C.textMuted,
  [STATUS.OFFLINE]: C.borderStrong,
};

function reportsToLabel(key) {
  const role = COMPANY[key];
  if (!role) return null;
  const manager = role.reportsTo && COMPANY[role.reportsTo];
  return manager ? `Reports to ${manager.name}` : 'Top of the chain';
}

function PresenceDot({ status, size = 11 }) {
  return (
    <span style={{
      position: 'absolute', right: -1, bottom: -1, width: size, height: size, borderRadius: '50%',
      background: DOT_COLOR[status], border: `2px solid ${C.surface}`,
    }} />
  );
}

function ContactCard({ personKey, person, isYou, presence }) {
  return (
    <Card
      accent={isYou ? C.primary : undefined}
      style={{ padding: 14, width: 220, textAlign: 'left', flexShrink: 0 }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: isYou ? TONE.primary.bg : C.surfaceAlt, color: isYou ? TONE.primary.fg : C.textSecondary,
            border: `1px solid ${isYou ? TONE.primary.border : C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700,
          }}>
            {initials(person.name)}
          </div>
          <PresenceDot status={presence.status} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {person.name}
          </div>
          <div style={{ fontSize: 11, color: C.textSecondary, marginBottom: 4 }}>{person.title}</div>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 9, lineHeight: 1.5 }}>{presence.label}</div>
      {!isYou && (
        <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
          {reportsToLabel(personKey)}
        </div>
      )}
    </Card>
  );
}

export default function TeamTab({ progress, closedCases = [], warRoomActive = false }) {
  const roster = Object.entries(COMPANY).filter(([, v]) => v && typeof v === 'object' && v.title);
  const ctx = { closedCases, warRoomActive, progress, library: SCENARIOS };
  const detectionEngNote = generateDetectionEngResponse(progress.history, SCENARIOS);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{COMPANY.name} — Security team</h1>
        <span style={{ fontSize: 12.5, color: C.textSecondary }}>who's actually online right now</span>
      </div>
      <p style={{ fontSize: 12.5, color: C.textMuted, margin: '0 0 20px', lineHeight: 1.55, maxWidth: 760 }}>
        Presence here isn't decoration — it's read off the shift you're actually running. The CEO stays offline until
        a case reaches IR; the IR Lead moves to the bridge the moment a War Room opens. Tier 2 will point you at what
        you haven't checked yet if you ask from the Overview tab — that's real help, so it's marked assisted the same
        way Learn Mode is.
      </p>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {roster.map(([key, person]) => (
          <ContactCard
            key={key}
            personKey={key}
            person={person}
            isYou={key === 'analyst'}
            presence={key === 'analyst' ? { status: STATUS.ONLINE, label: 'You — working the queue' } : presenceFor(key, ctx)}
          />
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionLabel icon={<IconUsers size={13} />}>Also in the building</SectionLabel>
        <Callout tone={TONE.neutral}>
          Not in the roster above — they show up only on the specific scenarios their department owns, when a
          response action affects them directly: {CROSS_FUNCTIONAL.join(' · ')}.
        </Callout>
      </div>

      {detectionEngNote && (
        <div style={{ marginTop: 20 }}>
          <SectionLabel>From Detection Engineering</SectionLabel>
          <Card style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
              {detectionEngNote.from} <span style={{ fontWeight: 400, color: C.textSecondary }}>· {detectionEngNote.role}</span>
            </div>
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{detectionEngNote.message}</div>
          </Card>
        </div>
      )}
    </div>
  );
}
