'use client';

/**
 * scroll-scene — scroll-driven scene utilities (Epic SIGNAL, W-B).
 *
 * Thin, typed layer over Framer Motion 11's `useScroll`/`useTransform`
 * that standardizes how SIGNAL scenes bind to scroll. Designed for the
 * landing feature scenes (W-C) as much as for the hero:
 *
 * - `useScrollScene()` — track a scene container, get a 0→1 progress
 *   `MotionValue`. Default offset suits PINNED scenes (container taller
 *   than the viewport with a `sticky` stage inside). For plain in-flow
 *   reveal scenes pass `offset: ['start end', 'end start']`.
 * - `useParallax(progress)` — transform-only parallax drift, frozen at
 *   0 under reduced motion.
 * - `<SceneReveal>` — viewport-entry fade/rise wrapper. Opacity-only
 *   and instant under reduced motion. NEVER wrap the page's LCP
 *   element (e.g. the hero headline): it server-renders `opacity: 0`.
 * - `signalEase` — the epic's shared ease (matches `--ease-out-expo`).
 *
 * Everything here animates transform/opacity only — no layout thrash.
 */

import React, { useRef } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type HTMLMotionProps,
  type MotionValue,
} from 'framer-motion';

/** Scroll offset tuple type, lifted from Framer's `useScroll` options. */
export type ScrollSceneOffset = NonNullable<Parameters<typeof useScroll>[0]>['offset'];

export interface ScrollSceneOptions {
  /**
   * Framer scroll offset. Default `['start start', 'end end']`:
   * 0 when the scene pins to the viewport top, 1 when its bottom edge
   * reaches the viewport bottom (end of the pin).
   */
  offset?: ScrollSceneOffset;
}

export interface ScrollScene<T extends HTMLElement> {
  /** Attach to the scene's outer (scroll-length) element. */
  ref: React.RefObject<T>;
  /** Raw scene progress, 0→1. Derive everything with `useTransform`. */
  progress: MotionValue<number>;
}

/** The epic's shared expo-out ease (mirrors `--ease-out-expo` in globals.css). */
export const signalEase = [0.19, 1, 0.22, 1] as const;

export function useScrollScene<T extends HTMLElement = HTMLDivElement>(
  options: ScrollSceneOptions = {},
): ScrollScene<T> {
  const ref = useRef<T>(null);
  const { scrollYProgress } = useScroll({
    target: ref as React.RefObject<HTMLElement>,
    offset: options.offset ?? ['start start', 'end end'],
  });
  return { ref, progress: scrollYProgress };
}

/**
 * Map scene progress to a subtle y drift (px): `-distance/2` at 0 →
 * `+distance/2` at 1. Returns a constant 0 under reduced motion.
 * Pass to `style={{ y }}` on a motion element.
 */
export function useParallax(
  progress: MotionValue<number>,
  distance = 48,
): MotionValue<number> {
  const reduced = useReducedMotion();
  const drift = useTransform(progress, [0, 1], [-distance / 2, distance / 2]);
  const still = useMotionValue(0);
  return reduced ? still : drift;
}

export interface SceneRevealProps extends HTMLMotionProps<'div'> {
  /** Rise distance in px. Default 28. */
  distance?: number;
  /** Transition delay in seconds. Default 0. */
  delay?: number;
  /** Animate only the first time the element enters. Default true. */
  once?: boolean;
  /** Portion of the element that must be visible to trigger. Default 0.3. */
  amount?: number;
}

/**
 * Fade/rise reveal on viewport entry. Under reduced motion the CSS
 * belt (`motion-reduce:!…`) guarantees the content is visible and
 * untransformed even before hydration settles.
 */
export const SceneReveal: React.FC<SceneRevealProps> = ({
  distance = 28,
  delay = 0,
  once = true,
  amount = 0.3,
  className = '',
  children,
  ...rest
}) => {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={
        reduced
          ? { duration: 0 }
          : { duration: 0.7, delay, ease: signalEase }
      }
      className={`motion-reduce:!transform-none motion-reduce:!opacity-100 ${className}`.trim()}
      {...rest}
    >
      {children}
    </motion.div>
  );
};
