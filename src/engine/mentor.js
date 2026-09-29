// The Tier 2 nudge: a coworker you can ask for help mid-investigation, not
// just a debrief after you've already closed the case. Deterministic, like
// the rest of this project's core loop — no model call, just the same
// evaluateInvestigation() the grader already runs, pointed at what you
// haven't done yet instead of what you missed.
//
// Marked "assisted" the moment you ask, the same way opening Learn Mode is —
// asking a coworker for a pointer is real SOC practice, but it means this
// attempt shouldn't count toward your skill stats as unaided work.
//
// Asking twice about the same still-missing thing isn't the same question
// again — Tier 2 gets more direct each time, rather than repeating the same
// hint verbatim, which is what asking a real coworker twice actually gets
// you. `askCounts` is keyed by the target the previous asks were about (a
// search id, an intel indicator, or an action id) so escalation is specific
// to that one gap, not a global "how many times have you clicked this."

import { evaluateInvestigation } from './scoring.js';

// Level 0 is the first time this particular gap comes up; 1 is the second ask
// about the exact same gap with nothing done about it yet; 2+ stops hinting
// and just tells you to go do it.
function phraseAt(level, phrases) {
  return phrases[Math.min(level, phrases.length - 1)];
}

export function nextNudge(scenario, caseFile = {}) {
  // Accepts either the live in-progress case shape (searchKeys/actions) or the
  // one scoreCase() builds at submit time (searchesRun/actionsTaken) — the
  // nudge is asked for mid-investigation, so it has to work with the former.
  const investigation = evaluateInvestigation(scenario, {
    searchesRun: caseFile.searchesRun || caseFile.searchKeys,
    intelChecked: caseFile.intelChecked,
  });
  const askCounts = caseFile.nudgeAsks || {};

  if (investigation.missedSearches.length) {
    const term = investigation.missedSearches[0];
    const key = `search:${term}`;
    const level = askCounts[key] || 0;
    return {
      key,
      message: phraseAt(level, [
        `Have you pulled up ${JSON.stringify(term)} yet? That's where I'd look next.`,
        `Seriously — go run ${JSON.stringify(term)}. I already pointed you at it, don't ask me again until you have.`,
        `${JSON.stringify(term)}. That's the search. Go run it, then come back if you actually need something else.`,
      ]),
    };
  }

  if (investigation.missedIntel.length) {
    const indicator = investigation.missedIntel[0];
    const key = `intel:${indicator}`;
    const level = askCounts[key] || 0;
    return {
      key,
      message: phraseAt(level, [
        `Run ${indicator} through Intel before you decide anything — don't guess at a verdict.`,
        `You keep asking instead of running ${indicator} through Intel. It takes ten seconds.`,
        `${indicator} — Intel tab, now. I'm not saying it a third time.`,
      ]),
    };
  }

  const taken = caseFile.actionsTaken || caseFile.actions || [];
  const requiredActions = scenario.truth.requiredActions || [];
  const missingActionId = requiredActions.find((id) => !taken.includes(id));
  if (missingActionId) {
    const action = (scenario.actions || []).find((a) => a.id === missingActionId);
    const label = action ? `"${action.label}"` : 'containment';
    const key = `action:${missingActionId}`;
    const level = askCounts[key] || 0;
    return {
      key,
      message: phraseAt(level, [
        `You've got the evidence. Nothing's been done about it yet though — has ${label} happened?`,
        `${label} still hasn't happened. That's not a question anymore — go do it.`,
        `I already told you: ${label}. Do it before you ask again.`,
      ]),
    };
  }

  const key = 'covered';
  const level = askCounts[key] || 0;
  return {
    key,
    message: phraseAt(level, [
      "You've covered what this one needs. Trust what you found and write it up — don't go looking for more just to feel sure.",
      "Nothing's changed since I told you that. Write the report.",
    ]),
  };
}
