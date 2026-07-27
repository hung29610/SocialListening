'use client';

/**
 * reduced-motion — Epic SIGNAL motion engine (W-B).
 *
 * The Design Constitution makes `prefers-reduced-motion` a hard rule:
 * every scene, hover and canvas effect must be fully usable with
 * motion off. Consume the preference through this module so the whole
 * epic keys off one implementation.
 *
 * - `usePrefersReducedMotion()` — reactive hook (Framer Motion's
 *   `useReducedMotion` re-exported under the engine's name). Returns
 *   `null` on the server / first render, then `true | false`.
 * - `prefersReducedMotion()` — imperative one-shot check for
 *   non-React code paths (canvas engines, event handlers).
 */

export { useReducedMotion as usePrefersReducedMotion } from 'framer-motion';

/** Imperative check; safe on the server (returns `false`). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
