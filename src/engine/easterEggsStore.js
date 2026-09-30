// Which secrets have been found. Its own storage key, so Reset everything
// leaves it alone (like a rank, finding one is not a stat that can be reset by
// accident) and Settings has its own button to forget them.

import { EGG_BY_ID } from '../data/easterEggs.js';

export const EGGS_KEY = 'soc-analyst-sim:eggs:v1';

export function loadFound() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(EGGS_KEY) || 'null');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && EGG_BY_ID[id]) : [];
  } catch {
    return [];
  }
}

export function saveFound(found) {
  try {
    window.localStorage.setItem(EGGS_KEY, JSON.stringify(found));
  } catch {
    // Storage unavailable: finds last for this session only.
  }
}

export function clearFound() {
  try {
    window.localStorage.removeItem(EGGS_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

// Returns the next list and whether this find was new.
export function unlock(found, id) {
  if (!EGG_BY_ID[id] || found.includes(id)) return { found, isNew: false };
  return { found: [...found, id], isNew: true };
}
