// Found secrets storage

import { EGG_BY_ID } from '../data/easterEggs.js';
import { clearStored, readStored, writeStored } from './localStore.js';

export const EGGS_KEY = 'soc-analyst-sim:eggs:v1';

export function loadFound() {
  return readStored(EGGS_KEY, [], (parsed) =>
    Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string' && EGG_BY_ID[id]) : null);
}

export const saveFound = (found) => writeStored(EGGS_KEY, found);
export const clearFound = () => clearStored(EGGS_KEY);

// Returns the next list and whether this find was new.
export function unlock(found, id) {
  if (!EGG_BY_ID[id] || found.includes(id)) return { found, isNew: false };
  return { found: [...found, id], isNew: true };
}
