'use client';

/**
 * scene-motion — thin scroll-motion helpers for the SIGNAL landing scenes
 * (Epic SIGNAL, ADR 0002 — W-C).
 *
 * Deliberately minimal and SWAPPABLE: when W-B's motion engine
 * (`@/lib/motion`) lands on the epic branch, these helpers can be
 * replaced by their `lib/motion` equivalents without touching scene
 * markup (same component shapes: Reveal / ParallaxLayer / ScrollRail).
 *
 * Accessibility / robustness contract:
 * - Content is ALWAYS readable without JS-motion: `Reveal` renders
 *   fully visible on the server and only hides elements *after*
 *   hydration, and only when they are still below the viewport.
 * - `prefers-reduced-motion` disables every effect (framer's
 *   useReducedMotion + the global reduced-motion CSS in globals.css).
 * - Parallax and the scroll rail are decorative only (aria-hidden
 *   callers), so scroll-linked motion never gates content.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';

/* ── Reveal ─────────────────────────────────────────────────────────
   Fade-and-rise on first scroll into view. CSS-transition based (not
   framer `initial`) so server HTML never ships hidden content. */

interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'li' | 'figure' | 'article';
  /** Transition delay in ms (stagger by hand: 0, 80, 160…). */
  delay?: number;
}

export function Reveal({
  as: Tag = 'div',
  delay = 0,
  className = '',
  style,
  children,
  ...props
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [hidden, setHidden] = useState(false);
  const [shown, setShown] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    // Only hide elements that are still below the fold at hydration
    // time — in-view content (e.g. the LCP hero) is never blanked.
    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;
    if (inView) {
      setShown(true);
      return;
    }

    setHidden(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduceMotion]);

  const state = hidden && !shown ? 'opacity-0 translate-y-6' : 'opacity-100 translate-y-0';

  return (
    <Tag
      // Reveal is polymorphic over block tags; the ref only reads layout.
      ref={ref as never}
      className={`transition-[opacity,transform] duration-700 ease-out will-change-transform motion-reduce:transition-none ${state} ${className}`.trim()}
      style={{ ...style, transitionDelay: delay ? `${delay}ms` : undefined }}
      {...props}
    >
      {children}
    </Tag>
  );
}

/* ── ParallaxLayer ──────────────────────────────────────────────────
   Slight scroll-linked drift for decorative visuals. Callers mark the
   layer aria-hidden when it is pure decoration. */

interface ParallaxLayerProps {
  children: React.ReactNode;
  /** Total drift in px across the element's scroll journey. */
  distance?: number;
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export function ParallaxLayer({
  children,
  distance = 48,
  className,
  ...props
}: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [distance, -distance],
  );

  return (
    <motion.div ref={ref} style={{ y }} className={className} {...props}>
      {children}
    </motion.div>
  );
}

/* ── ScrollRail ─────────────────────────────────────────────────────
   Decorative progress line that fills as the wrapped scenes scroll.
   Content never depends on it (aria-hidden). */

const RailContext = createContext<React.RefObject<HTMLDivElement> | null>(null);

export function ScrollRailContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <RailContext.Provider value={ref}>
      <div ref={ref} className={`relative ${className}`.trim()}>
        {children}
      </div>
    </RailContext.Provider>
  );
}

export function ScrollRail({ className = '' }: { className?: string }) {
  const container = useContext(RailContext);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: container ?? undefined,
    offset: ['start 0.7', 'end 0.7'],
  });
  const scaleY = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    mass: 0.4,
  });

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-0 top-0 w-px bg-edge ${className}`.trim()}
    >
      <motion.div
        className="absolute inset-x-0 top-0 h-full origin-top bg-signal"
        style={{ scaleY: reduceMotion ? 1 : scaleY }}
      />
    </div>
  );
}
