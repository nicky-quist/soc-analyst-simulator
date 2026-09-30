// Shared setup for the UI smoke tests: a clean browser for every test, a fixed
// clock so the dealt hand is stable, and the handful of browser APIs jsdom does
// not implement.

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
  // Only Date is faked: timers stay real, so the console's own ticker and
  // Testing Library's waiting keep working. 10:00 local, so the night-owl secret
  // stays quiet.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 29, 10, 0, 0));
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
