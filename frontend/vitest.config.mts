import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Minimal test setup for the Nope360 frontend.
 *
 * jsdom + Testing Library so locale resolution, the language switcher, localized
 * API errors and the new source-discovery UI can be asserted at the component
 * level. `globals: true` keeps the existing jest-style `describe/it/expect`
 * files working unchanged.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
});
