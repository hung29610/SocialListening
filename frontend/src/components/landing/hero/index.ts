/**
 * SIGNAL landing hero — public API (Epic SIGNAL, ADR 0002 — W-B).
 *
 * Mount contract for the landing page (W-C):
 *   import { SignalHero } from '@/components/landing/hero';
 *   <main className="bg-void"><SignalHero /></main>
 *
 * See SignalHero's JSDoc for scroll-length, reduced-motion and
 * heading-level guarantees.
 */

export { SignalHero, type SignalHeroProps } from './SignalHero';
export { HeroInsightCard } from './HeroInsightCard';
