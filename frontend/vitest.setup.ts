/**
 * Test environment setup.
 *
 * Keeps each test isolated: localStorage is cleared between tests so a persisted
 * language from one case cannot leak into the next.
 */
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

beforeEach(() => {
  try {
    window.localStorage.clear();
  } catch {
    /* storage unavailable in this environment */
  }
  document.documentElement.lang = 'vi';
});

afterEach(() => {
  cleanup();
});
