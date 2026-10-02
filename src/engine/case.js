// Case status and SLA

export function caseStatus(caseFile) {
  if (!caseFile) return 'new';
  if (caseFile.result) return 'closed';
  const touched = (caseFile.searches?.length || 0) + (caseFile.intel?.length || 0) + (caseFile.actions?.length || 0);
  return touched > 0 ? 'in_progress' : 'new';
}

export function slaState(scenario, caseFile, now) {
  const total = scenario.alert.slaMinutes;
  const closedAt = caseFile?.result?.score?.elapsedMs;
  const elapsedMs = closedAt != null ? closedAt : caseFile?.startedAt ? now - caseFile.startedAt : 0;
  const remaining = total * 60_000 - elapsedMs;
  return { total, elapsedMs, remaining, breached: remaining < 0 };
}

// Your SLA compliance this shift
export function shiftCompliance(scenarios, cases, now) {
  let handled = 0;
  let onTime = 0;
  let breached = 0;

  for (const scenario of scenarios) {
    const caseFile = cases[scenario.id];
    const state = slaState(scenario, caseFile, now);
    const closed = !!caseFile?.result;
    if (!closed && !state.breached) continue;

    handled += 1;
    if (state.breached) breached += 1;
    else onTime += 1;
  }

  return {
    handled,
    onTime,
    breached,
    // null until something is handled
    pct: handled ? Math.round((onTime / handled) * 100) : null,
  };
}
