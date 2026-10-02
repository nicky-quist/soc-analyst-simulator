// UI test setup

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

beforeEach(() => {
  window.localStorage.clear();
  window.location.hash = '';
  // Fake Date only, 10:00
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
