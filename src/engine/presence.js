// Team presence from shift state

import { generateDetectionEngResponse } from './personas.js';

export const STATUS = {
  ONLINE: 'online',
  BUSY: 'busy',
  AWAY: 'away',
  OFFLINE: 'offline',
};

// ctx: { closedCases, warRoomActive, progress, library }
export function presenceFor(personKey, ctx) {
  const { closedCases = [], warRoomActive = false, progress = { history: [] }, library = [] } = ctx;

  switch (personKey) {
    case 'tier2':
      return { status: STATUS.ONLINE, label: 'Available — ask for a nudge from Overview' };

    case 'teamLead':
      return { status: STATUS.ONLINE, label: 'Running the shift' };

    case 'irLead':
      return warRoomActive
        ? { status: STATUS.BUSY, label: 'On the War Room bridge' }
        : { status: STATUS.ONLINE, label: 'Available' };

    case 'ciso':
      return closedCases.length > 0
        ? { status: STATUS.BUSY, label: 'Reviewing your closed cases' }
        : { status: STATUS.AWAY, label: 'Nothing closed yet this shift' };

    case 'ceo': {
      const reachedIr = closedCases.some((r) => r.submission?.escalation === 'escalate_ir');
      return reachedIr
        ? { status: STATUS.ONLINE, label: 'In the loop — a case reached IR this shift' }
        : { status: STATUS.OFFLINE, label: "Doesn't surface unless something reaches IR" };
    }

    case 'detectionEng': {
      const note = generateDetectionEngResponse(progress.history || [], library);
      return note
        ? { status: STATUS.BUSY, label: 'Has feedback on your severity calls' }
        : { status: STATUS.AWAY, label: 'Needs more history to say anything yet' };
    }

    default:
      return { status: STATUS.OFFLINE, label: 'Not reachable from the queue' };
  }
}
