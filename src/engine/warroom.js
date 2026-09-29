// War Room: a bad-enough response to a trigger scenario escalates the shift
// mid-flight — a new, time-critical alert gets injected into the live queue,
// correlated back to the case that caused it. Deterministic, like everything
// else here: no dice roll, the trigger is exactly "did the response leave the
// threat live," which the grader already computed.
//
// One rule keeps this from spiraling: a shift can only have one War Room
// active at a time, and a War Room follow-on can never itself trigger another
// one, so a bad night gets one escalation, not a chain reaction.

import { WAR_ROOM_SCENARIOS } from '../data/scenarios/index.js';
import { queueOrder } from './deal.js';

// A response "left the threat live" if a required containment step never
// happened, or if the analyst actively did something harmful — either one
// means the thing the alert was warning about is still in progress.
export function warRoomTriggered(scenario, score) {
  if (scenario.warRoomFollowOn) return false;
  if (!WAR_ROOM_SCENARIOS[scenario.id]) return false;
  return score.response.harmful.length > 0 || score.response.missing.length > 0;
}

export function followOnFor(scenario) {
  return WAR_ROOM_SCENARIOS[scenario.id] || null;
}

export function resolveWarRoomScenario(warRoom) {
  if (!warRoom) return null;
  return Object.values(WAR_ROOM_SCENARIOS).find((s) => s.id === warRoom.scenarioId) || null;
}

// Injects the active War Room alert into a dealt hand, sorted by the same
// rule as everything else in the queue — it does not just get appended, a
// 5-minute-SLA CRITICAL alert belongs near the top.
export function withWarRoom(hand, warRoom) {
  const scenario = resolveWarRoomScenario(warRoom);
  if (!scenario) return hand;
  return [...hand, scenario].sort(queueOrder);
}
