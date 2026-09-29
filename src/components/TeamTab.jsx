// The org chart, drawn only as deep as a Tier-1 shift ever actually reaches.
// Built from COMPANY in data/scenarios/index.js — add a role there with a
// reportsTo and it appears here for free, in the right tier, with no changes
// needed in this file.

import { COMPANY } from '../data/scenarios/index.js';
import { C, TONE } from '../theme.js';
import { Callout, Card, SectionLabel } from '../ui/primitives.jsx';
import { initials } from '../ui/helpers.js';
import { IconUsers } from '../ui/icons.jsx';
import { generateDetectionEngResponse } from '../engine/personas.js';
import { SCENARIOS } from '../data/scenarios/index.js';

// Cross-functional contacts don't live in COMPANY — they're one-off
// characters carried on individual scenarios' response actions (the ones with
// a `consequence`), so a full company roster would have to scan the library
// rather than list a fixed cast. Named here for the chart's footnote instead
// of faked into the reporting tree they were never meant to be part of.
const CROSS_FUNCTIONAL = [
  'Data Platform Lead', 'Employment Counsel', 'Security Engineering Manager', 'Head of IT Service Delivery',
];

function buildLevels() {
  const roles = Object.entries(COMPANY).filter(([, v]) => v && typeof v === 'object' && v.title);
  const byKey = Object.fromEntries(roles);
  const depth = (key, seen = new Set()) => {
    const role = byKey[key];
    if (!role || !role.reportsTo || seen.has(key)) return 0;
    return 1 + depth(role.reportsTo, new Set(seen).add(key));
  };
  const levels = {};
  for (const [key, role] of roles) {
    const d = depth(key);
    (levels[d] ||= []).push({ key, ...role });
  }
  return Object.entries(levels)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, people]) => people);
}

function RoleCard({ person, isYou }) {
  return (
    <Card
      accent={isYou ? C.primary : undefined}
      style={{ padding: '12px 16px', minWidth: 200, maxWidth: 260, textAlign: 'left' }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: isYou ? TONE.primary.bg : C.surfaceAlt, color: isYou ? TONE.primary.fg : C.textSecondary,
          border: `1px solid ${isYou ? TONE.primary.border : C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
        }}>
          {initials(person.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{person.name}</div>
          <div style={{ fontSize: 11.5, color: C.textSecondary, marginBottom: 5 }}>{person.title}</div>
          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>{person.blurb}</div>
        </div>
      </div>
    </Card>
  );
}

export default function TeamTab({ progress }) {
  const levels = buildLevels();
  // Reversed for display: CEO at the top of the org chart, you at the bottom
  // of the queue — depth 0 (no manager) is the CEO, so render highest depth first.
  const rows = [...levels].reverse();
  const detectionEngNote = generateDetectionEngResponse(progress.history, SCENARIOS);

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{COMPANY.name} — Security org</h1>
        <span style={{ fontSize: 12.5, color: C.textSecondary }}>who's who at {COMPANY.soc}</span>
      </div>
      <p style={{ fontSize: 12.5, color: C.textMuted, margin: '0 0 20px', lineHeight: 1.55, maxWidth: 760 }}>
        Only the roles that actually touch a Tier-1 shift. Tier 2 will point you at what you haven't checked yet if
        you ask from the Overview tab — that's real help, so it's marked assisted the same way Learn Mode is.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        {rows.map((people, i) => (
          <div key={i} style={{ width: '100%' }}>
            {i > 0 && (
              <div style={{ width: 1, height: 18, background: C.border, margin: '0 auto' }} />
            )}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              {people.map((person) => (
                <RoleCard key={person.key} person={person} isYou={person.key === 'analyst'} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionLabel icon={<IconUsers size={13} />}>Also in the building</SectionLabel>
        <Callout tone={TONE.neutral}>
          Not in the reporting line — they show up only on the specific scenarios their department owns, when a
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
