// Persona reactions

import { COMPANY } from '../data/scenarios/index.js';
import { isResolvedCorrectly, underEscalated, overEscalated, SEVERITY_ORDER } from './scoring.js';
import { nextNudge } from './mentor.js';

function ciso(tone, message) {
  return { from: COMPANY.ciso.name, role: COMPANY.ciso.title, tone, message };
}

function teamLead(tone, message) {
  return { from: COMPANY.teamLead.name, role: COMPANY.teamLead.title, tone, message };
}

function tier2(tone, message) {
  return { from: COMPANY.tier2.name, role: COMPANY.tier2.title, tone, message };
}

function detectionEng(tone, message) {
  return { from: COMPANY.detectionEng.name, role: COMPANY.detectionEng.title, tone, message };
}

function irLead(tone, message) {
  return { from: COMPANY.irLead.name, role: COMPANY.irLead.title, tone, message };
}

// War Room announcement
export function generateWarRoomAlert(sourceScenario) {
  return irLead(
    'concerned',
    `${sourceScenario.queueLabel} just came back on us. Whatever didn't get closed off there is still live, and it moved. I need eyes on the new alert right now — the clock on this one is real.`
  );
}

// Tier 2 nudge
export function generateTier2Nudge(scenario, caseFile) {
  const { key, message } = nextNudge(scenario, caseFile);
  return { key, persona: tier2('coaching', message) };
}

export function generateCisoResponse(scenario, submission, score) {
  const escalateTarget = scenario.truth.escalation === 'escalate_ir' ? 'Incident Response' : 'Tier 2';
  const { investigation, response } = score;

  // Harm first
  if (response.harmful.length) {
    const worst = response.harmful[0];
    return ciso(
      'concerned',
      `Before anything else: "${worst.label}" should not have happened. I can coach a wrong severity or a thin writeup — an action that causes its own damage is a different conversation, because now someone else has to clean up after the response as well as the incident. Walk me through what you knew when you did it.`
    );
  }
  if (underEscalated(scenario, submission)) {
    return ciso(
      'concerned',
      `This needed to go to ${escalateTarget}, not sit here closed out. Walk me through why you didn't escalate — what would you need to see in an alert like this to flag it as more than routine?`
    );
  }
  if (overEscalated(scenario, submission)) {
    return ciso(
      'neutral',
      `I'd rather see caution than a missed incident, but escalating this one to ${submission.escalation === 'escalate_ir' ? 'IR' : 'Tier 2'} is going to pull people off real work. What in the evidence made this feel higher-severity than it was? Let's talk about tightening the triage criteria so we're not creating alert fatigue on the response team.`
    );
  }
  if (investigation.coverage < 0.5) {
    const missed = investigation.missed[0];
    return ciso(
      'coaching',
      `You landed on the right call, but you got there without doing the work — you never ran ${missed ? `"${missed}"` : 'the checks this alert calls for'}. On a shift where the answer isn't this clean, that habit turns into a missed incident. Right answer, wrong process.`
    );
  }
  if (response.missing.length) {
    return ciso(
      'coaching',
      `The call was right and the writeup holds up, but the response stopped short — nobody actually did "${response.missing[0]}". A correct classification that isn't followed by the containment action is a ticket, not a response. Close the loop before you close the alert.`
    );
  }
  if (score.severityDistance !== null && score.severityDistance >= 2) {
    return ciso(
      'coaching',
      `Escalation call was right, but you rated this ${submission.severity} when it's ${scenario.truth.severity}. Severity is what drives who gets paged and how fast — being two steps off changes the response even when the escalation path is correct.`
    );
  }
  if (investigation.noiseSearches >= 6) {
    return ciso(
      'coaching',
      `Right outcome, and I want to flag something in how you got there: a lot of searches came back empty. On a busy shift that's the difference between clearing your queue and drowning in it. Read the evidence, decide what question you're asking, then search — not the other way around.`
    );
  }
  if (score.overallScore >= 85 && investigation.coverage === 1) {
    return ciso(
      'positive',
      `Good work — this is a clean, complete case. You worked the evidence before you called it, the response matched the finding, and the writeup is something I can hand to IR or file for the record without rewriting it. Keep this standard up.`
    );
  }
  return ciso(
    'coaching',
    `Escalation call was right, but the report's missing some detail I'd want on record — see the checklist below for what to tighten up. Small gaps like this slow IR down when they pick up the handoff.`
  );
}

export function generateCeoResponse(scenario, submission) {
  const { ceo } = COMPANY;
  const reachedIr = scenario.truth.escalation === 'escalate_ir' && submission.escalation === 'escalate_ir';
  if (!reachedIr) return null;

  const message =
    scenario.id === 'phishing-bec-ambiguous'
      ? `I need three things in the next ten minutes, in plain English: did we lose money, is this contained, and do we owe anyone — a customer, a regulator — a phone call today? Don't send me the technical writeup, send me those three answers first.`
      : scenario.id === 'insider-after-hours-ambiguous'
        ? `Careful with this one. Until HR and Legal have looked at it, nothing in writing should read like we've already decided what this person did. Tell me what data is potentially out the door and what we're obligated to do about it — that's what I need to know today.`
        : `Are we safe right now, and does this touch customer data or anything I need to be ready to talk about publicly? Give me the plain-language version, not the log excerpts.`;

  return { from: ceo.name, role: ceo.title, tone: 'business', message };
}

// End-of-shift review
export function generateShiftSummary(results) {
  const total = results.length;
  if (!total) return null;

  const resolved = results.filter((r) => isResolvedCorrectly(r.score)).length;
  const avgScore = Math.round(results.reduce((sum, r) => sum + r.score.overallScore, 0) / total);
  const missedEscalations = results.filter((r) => !r.score.escalationCorrect).length;
  const harmfulActions = results.reduce((sum, r) => sum + r.score.response.harmful.length, 0);
  const assisted = results.filter((r) => r.score.assisted).length;
  const investigationCoverage =
    results.reduce((sum, r) => sum + (r.score.investigation?.coverage ?? 1), 0) / total;

  let tone = 'coaching';
  let message;
  if (harmfulActions > 0) {
    tone = 'concerned';
    message = `${harmfulActions} response action${harmfulActions === 1 ? '' : 's'} this shift caused damage of ${harmfulActions === 1 ? 'its' : 'their'} own — an isolated business system, evidence destroyed, or someone tipped off. That is the category I want to talk about first, ahead of scores. The instinct to do something is right; the sequencing is what we need to work on.`;
  } else if (missedEscalations > 0) {
    tone = 'concerned';
    message = `${missedEscalations} of ${total} alerts this shift went the wrong way on escalation. That's the number I care about most — classification errors are fixable in review, escalation errors are how incidents get missed. Let's go through those specific ones together.`;
  } else if (investigationCoverage < 0.6) {
    message = `Every escalation call was right, which matters. But you're deciding faster than you're investigating — you skipped a lot of the searches and lookups these alerts called for. On a quiet shift that works out; on a real one it won't.`;
  } else if (avgScore >= 85) {
    tone = 'positive';
    message = `Solid shift — ${resolved} of ${total} resolved cleanly at a ${avgScore} average, the evidence was worked before the calls were made, and nothing broke along the way. This is the standard I'd want a new L1 measured against.`;
  } else {
    message = `${resolved} of ${total} resolved cleanly, ${avgScore} average. The calls were right; the documentation is where the points went. Tighten the reports and this is a strong shift.`;
  }

  return {
    total,
    resolved,
    avgScore,
    missedEscalations,
    harmfulActions,
    assisted,
    investigationCoverage,
    // Shift lead voice
    persona: teamLead(tone, message),
  };
}

// Severity-gap feedback
const SEVERITY_GAP_MIN_SAMPLE = 4;

export function generateDetectionEngResponse(history, library) {
  const byId = Object.fromEntries(library.map((s) => [s.id, s]));
  const gapped = history.filter((r) => {
    const scenario = byId[r.scenarioId];
    if (!scenario) return false;
    const gap = Math.abs(
      SEVERITY_ORDER.indexOf(scenario.alert.reportedSeverity) - SEVERITY_ORDER.indexOf(scenario.truth.severity)
    );
    return gap >= 2;
  });
  if (gapped.length < SEVERITY_GAP_MIN_SAMPLE) return null;

  const caught = gapped.filter((r) => r.outcomes.severity === true).length;
  const rate = caught / gapped.length;

  if (rate >= 0.8) {
    return detectionEng(
      'positive',
      `I pulled your history on the alerts where our rules are furthest off — ${caught} of ${gapped.length} times you caught it anyway and rated the real severity, not what the tool printed. That's exactly the signal I need to know a bad rule isn't also making a bad analyst.`
    );
  }
  if (rate <= 0.4) {
    return detectionEng(
      'coaching',
      `Looking at your history: on the ${gapped.length} alerts where our detection is most miscalibrated, you only caught the real severity ${caught} times. I own the rules, not your judgment, but a reported severity should be a starting point for you, not the answer — especially on the ones I already know are wrong.`
    );
  }
  return null;
}
