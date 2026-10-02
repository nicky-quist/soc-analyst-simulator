// UI smoke tests in jsdom, kept apart from the dev config

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests-ui/**/*.test.jsx'],
    setupFiles: ['tests-ui/setup.js'],
    // Headroom for full end-to-end case runs
    testTimeout: 20_000,
  },
});
