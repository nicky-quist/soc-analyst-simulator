// The UI smoke tests run in jsdom under Vitest. The engines are covered by the
// Node test runner in tests/ (`npm test`), which has no dependencies; this is
// the one place a DOM is needed, to drive the console the way a person does.
// Kept separate from vite.config.js so the dev server settings (open the
// browser, the GitHub Pages base path) do not leak into the tests.

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests-ui/**/*.test.jsx'],
    setupFiles: ['tests-ui/setup.js'],
  },
});
