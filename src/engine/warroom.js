// War Room escalation

import { WAR_ROOM_SCENARIOS } from '../data/scenarios/index.js';
import { queueOrder } from './deal.js';

// Threat left live?
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

// Inject the War Room alert
export function withWarRoom(hand, warRoom) {
  const scenario = resolveWarRoomScenario(warRoom);
  if (!scenario) return hand;
  return [...hand, scenario].sort(queueOrder);
}
