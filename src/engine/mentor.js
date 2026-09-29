// The Tier 2 nudge: a coworker you can ask for help mid-investigation, not
// just a debrief after you've already closed the case. Deterministic, like
// the rest of this project's core loop — no model call, just the same
// evaluateInvestigation() the grader already runs, pointed at what you
// haven't done yet instead of what you missed.
//
// Marked "assisted" the moment you ask, the same way opening Learn Mode is —
// asking a coworker for a pointer is real SOC practice, but it means this
// attempt shouldn't count toward your skill stats as unaided work.

import { evaluateInvestigation } from './scoring.js';

export function nextNudge(scenario, caseFile = {}) {
  // Accepts either the live in-progress case shape (searchKeys/actions) or the
  // one scoreCase() builds at submit time (searchesRun/actionsTaken) — the
  // nudge is asked for mid-investigation, so it has to work with the former.
  const investigation = evaluateInvestigation(scenario, {
    searchesRun: caseFile.searchesRun || caseFile.searchKeys,
    intelChecked: caseFile.intelChecked,
  });

  if (investigation.missedSearches.length) {
    return `Have you pulled up ${JSON.stringify(investigation.missedSearches[0])} yet? That's where I'd look next.`;
  }
  if (investigation.missedIntel.length) {
    return `Run ${investigation.missedIntel[0]} through Intel before you decide anything — don't guess at a verdict.`;
  }

  const taken = caseFile.actionsTaken || caseFile.actions || [];
  const requiredActions = scenario.truth.requiredActions || [];
  const missingAction = requiredActions.find((id) => !taken.includes(id));
  if (missingAction) {
    const action = (scenario.actions || []).find((a) => a.id === missingAction);
    return `You've got the evidence. Nothing's been done about it yet though — has ${action ? `"${action.label}"` : 'containment'} happened?`;
  }

  return "You've covered what this one needs. Trust what you found and write it up — don't go looking for more just to feel sure.";
}
