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
