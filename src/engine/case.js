// Case state derived from what the analyst has done so far: whether an alert is
// untouched, being worked, or closed, and how it stands against its response
// target. Real queues sort on the second one.

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

// Your own SLA compliance for this shift, which is what the gauge on the
// dashboard should be showing: an estate-wide number nobody in the room can
// move is decoration, and a dashboard full of decoration teaches an analyst to
// ignore dashboards.
//
// An alert counts as handled once you have closed it, or once its clock has run
// out while it sat there — a breach you have not noticed yet is still a breach.
// Untouched alerts with time left are not counted either way, so the figure
// starts at 100% and is only ever moved by something you did or failed to do.
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
    // null until there is something to measure — the caller decides how to
    // render "nothing has happened yet", which is not the same as 0%.
    pct: handled ? Math.round((onTime / handled) * 100) : null,
  };
}
