'use client';

/**
 * SignalHero — the SIGNAL landing hero (Epic SIGNAL, ADR 0002 — W-B).
 *
 * Full-viewport pinned scroll scene: a canvas field of raw mention
 * noise resolves into a clean glass insight card as the visitor
 * scrolls — the product thesis (noise → signal) as the opening scene.
 *
 * Mount contract (for W-C):
 *   import { SignalHero } from '@/components/landing/hero';
 *   <main className="bg-void"><SignalHero />…scenes…</main>
 * - No required props. `className` passes through to the outer section.
 * - Occupies 190vh of scroll length (100svh visual, pinned) with
 *   motion enabled; collapses to a single static viewport under
 *   `prefers-reduced-motion` (pure CSS, no hydration dependency).
 * - Renders the page's `<h1>` — the page must not add another.
 * - The headline is the LCP element and is server-rendered visible;
 *   the canvas is decorative (`aria-hidden`) and never gates LCP.
 * - Transform/opacity motion only → zero CLS by construction.
 *
 * Copy: all invented copy is draft and flagged `data-copy-tbd`
 * (Design Constitution — truthful placeholders only).
 */

import React from 'react';
import Link from 'next/link';
import { motion, useTransform } from 'framer-motion';
import { Display } from '@/components/ui/Display';
import {
  MentionParticleField,
  useMagneticHover,
  usePrefersReducedMotion,
  useScrollScene,
} from '@/lib/motion';
import { HeroInsightCard } from './HeroInsightCard';

/** Magnetic wrapper for the CTAs — inert on touch / reduced motion. */
const MagneticWrap: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const magnetic = useMagneticHover<HTMLDivElement>({ strength: 5 });
  return (
    <motion.div
      ref={magnetic.ref}
      style={{ x: magnetic.x, y: magnetic.y }}
      onPointerMove={magnetic.onPointerMove}
      onPointerLeave={magnetic.onPointerLeave}
      className={`inline-block ${className}`.trim()}
    >
      {children}
    </motion.div>
  );
};

const ctaBase =
  'inline-flex items-center justify-center rounded-pill px-8 py-4 text-base font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-void';

export interface SignalHeroProps {
  className?: string;
}

export const SignalHero: React.FC<SignalHeroProps> = ({ className = '' }) => {
  const { ref, progress } = useScrollScene<HTMLElement>();
  const reduced = usePrefersReducedMotion();

  /* Scene choreography — every value derives from scroll progress. */
  const resolve = useTransform(progress, [0.05, 0.75], [0, 1]);
  const copyY = useTransform(progress, [0, 1], [0, -32]);
  const cardOpacity = useTransform(progress, [0.16, 0.5], [0, 1]);
  const cardY = useTransform(progress, [0.16, 0.55], [64, 0]);
  const cardScale = useTransform(progress, [0.16, 0.55], [0.95, 1]);
  const cueOpacity = useTransform(progress, [0, 0.12], [1, 0]);

  return (
    <section
      ref={ref}
      className={`relative h-[190vh] bg-void text-paper motion-reduce:h-auto ${className}`.trim()}
      data-signal-scene="hero"
    >
      <div className="sticky top-0 flex min-h-screen flex-col overflow-hidden supports-[min-height:100svh]:min-h-svh motion-reduce:static">
        {/* Decorative noise field — resolves toward the insight card */}
        <MentionParticleField
          progress={reduced ? 1 : resolve}
          focus={{ x: 0.72, y: 0.52 }}
          className="z-0"
        />

        {/* Depth + readability scrims (token-driven, no hardcoded palette) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-2/3 bg-gradient-to-r from-void/80 via-void/30 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-gradient-to-b from-transparent to-void"
        />

        <div className="relative z-10 mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 items-center gap-12 px-6 py-24 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
          {/* Statement block — the LCP element lives here, always visible */}
          <motion.div
            style={reduced ? undefined : { y: copyY }}
            className="max-w-3xl motion-reduce:!transform-none"
          >
            <p className="font-display text-eyebrow font-semibold uppercase text-signal dark:text-signal-bright">
              Nope360 · Social listening
            </p>

            {/* COPY_TBD: statement headline draft per epic brief */}
            <div className="mt-6" data-copy-tbd="hero-headline">
              <Display as="h1" size="2xl" balance>
                Hear everything.
                <br />
                <span className="text-signal dark:text-signal-bright">Miss nothing.</span>
              </Display>
            </div>

            {/* COPY_TBD: subcopy draft — mirrors the product's own description */}
            <p
              className="mt-8 max-w-xl text-base leading-relaxed text-paper-muted md:text-lg"
              data-copy-tbd="hero-subcopy"
            >
              Nope360 lắng nghe các nguồn công khai, thu thập mention, phân tích sắc
              thái bằng AI và cảnh báo trước khi rủi ro trở thành khủng hoảng.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <MagneticWrap>
                <Link
                  href="/register"
                  data-copy-tbd="hero-cta-primary"
                  className={`${ctaBase} bg-signal text-void-surface shadow-glow-signal-sm hover:bg-signal-deep hover:shadow-glow-signal dark:text-paper`}
                >
                  Tạo tài khoản
                </Link>
              </MagneticWrap>
              <MagneticWrap>
                <Link
                  href="/login"
                  className={`${ctaBase} border border-edge-strong text-paper hover:border-signal hover:text-signal dark:hover:text-signal-bright`}
                >
                  Đăng nhập
                </Link>
              </MagneticWrap>
            </div>

            {/* Trust strip — pure placeholder, no invented logos/claims */}
            <div className="mt-14 border-t border-edge pt-6" data-copy-tbd="hero-trust-strip">
              <p className="font-display text-eyebrow font-semibold uppercase text-paper-faint">
                Trust strip · COPY_TBD
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-2">
                {[0, 1, 2, 3].map((slot) => (
                  <span key={slot} className="text-sm font-medium text-paper-faint/60">
                    COPY_TBD
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* The resolved signal — glass insight card built from real product shapes */}
          <motion.div
            style={reduced ? undefined : { opacity: cardOpacity, y: cardY, scale: cardScale }}
            className="w-full max-w-md justify-self-center motion-reduce:!transform-none motion-reduce:!opacity-100 lg:justify-self-end"
          >
            <HeroInsightCard />
          </motion.div>
        </div>

        {/* Scroll cue — motion-only affordance, hidden under reduced motion */}
        <motion.div
          aria-hidden="true"
          style={reduced ? undefined : { opacity: cueOpacity }}
          className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center motion-reduce:hidden"
        >
          <div className="flex flex-col items-center gap-3">
            <span
              className="font-display text-eyebrow font-semibold uppercase text-paper-faint"
              data-copy-tbd="hero-scroll-cue"
            >
              Cuộn để lọc nhiễu · COPY_TBD
            </span>
            <motion.span
              className="block h-10 w-px origin-top bg-gradient-to-b from-signal to-transparent"
              initial={{ scaleY: 0.25, opacity: 0.25 }}
              whileInView={reduced ? undefined : { scaleY: [0.25, 1, 0.25], opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
};
