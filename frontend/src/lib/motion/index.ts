/**
 * SIGNAL motion engine — public API (Epic SIGNAL, ADR 0002 — W-B).
 *
 * Import from `@/lib/motion`. See ./README.md for the consumer guide
 * (W-C's feature scenes are the primary consumer).
 */

export {
  MentionParticleField,
  type MentionParticleFieldProps,
} from './MentionParticleField';

export {
  SceneReveal,
  signalEase,
  useParallax,
  useScrollScene,
  type SceneRevealProps,
  type ScrollScene,
  type ScrollSceneOffset,
  type ScrollSceneOptions,
} from './scroll-scene';

export {
  useMagneticHover,
  type MagneticHoverBindings,
  type MagneticHoverOptions,
} from './magnetic';

export { prefersReducedMotion, usePrefersReducedMotion } from './reduced-motion';

export {
  hslaFromToken,
  readSignalPalette,
  watchDocumentTheme,
  type SignalCanvasPalette,
} from './signal-tokens';
