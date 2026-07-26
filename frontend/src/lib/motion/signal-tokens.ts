/**
 * signal-tokens — canvas-side bridge to the SIGNAL design tokens
 * (Epic SIGNAL, ADR 0002 — W-B motion engine).
 *
 * Canvas 2D cannot consume CSS custom properties directly, so canvas
 * work (MentionParticleField) resolves the tokens from computed style
 * at runtime. This keeps the Design Constitution's "never hardcode
 * palette values" rule intact: the single source of truth stays
 * `src/styles/tokens.css`; this module only *reads* it.
 *
 * Tokens are stored as raw HSL triplets (`"243 100% 62%"`). Use
 * `hslaFromToken` to turn a triplet into a canvas-safe color string.
 */

/** SIGNAL palette subset needed by canvas renderers, as raw HSL triplets. */
export interface SignalCanvasPalette {
  signal: string;
  signalBright: string;
  paperMuted: string;
  paperFaint: string;
  sentimentPositive: string;
  sentimentNegative: string;
  sentimentNeutral: string;
}

/**
 * Neutral degradation triplet used ONLY if a token variable is missing
 * from the cascade (i.e. tokens.css failed to load). Deliberately a
 * plain mid-gray that belongs to no theme palette.
 */
const DEGRADED = '0 0% 50%';

const TOKEN_VARS: Record<keyof SignalCanvasPalette, string> = {
  signal: '--signal',
  signalBright: '--signal-bright',
  paperMuted: '--paper-muted',
  paperFaint: '--paper-faint',
  sentimentPositive: '--sentiment-positive',
  sentimentNegative: '--sentiment-negative',
  sentimentNeutral: '--sentiment-neutral',
};

/**
 * Read the SIGNAL canvas palette from an element's computed style.
 * Call again after a theme change (see `watchDocumentTheme`) — the
 * `.dark` class swaps every variable.
 */
export function readSignalPalette(el: Element): SignalCanvasPalette {
  const styles = getComputedStyle(el);
  const out = {} as SignalCanvasPalette;
  (Object.keys(TOKEN_VARS) as Array<keyof SignalCanvasPalette>).forEach((key) => {
    const value = styles.getPropertyValue(TOKEN_VARS[key]).trim();
    out[key] = value || DEGRADED;
  });
  return out;
}

/**
 * Convert a raw HSL triplet token (`"243 100% 62%"`) into a canvas-safe
 * `hsla()` string. Uses legacy comma syntax so every canvas color
 * parser accepts it.
 */
export function hslaFromToken(triplet: string, alpha = 1): string {
  const [h, s, l] = triplet.trim().split(/\s+/);
  return `hsla(${h}, ${s}, ${l}, ${alpha})`;
}

/**
 * Observe theme flips. next-themes toggles the `dark` class on `<html>`
 * (`attribute="class"`, see src/app/layout.tsx), so a class-attribute
 * MutationObserver is the reliable signal to re-read tokens.
 * Returns an unsubscribe function.
 */
export function watchDocumentTheme(onChange: () => void): () => void {
  if (typeof document === 'undefined') return () => undefined;
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}
