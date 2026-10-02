// localStorage access

// Read with fallback
export function readStored(key, fallback, parse = (value) => value) {
  try {
    return parse(JSON.parse(window.localStorage.getItem(key) || 'null')) ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable
  }
}

export function clearStored(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
