'use client';

/**
 * magnetic — subtle magnetic-hover attraction (Epic SIGNAL, W-B).
 *
 * The element eases a few pixels toward the cursor while hovered and
 * springs back on leave. Deliberately restrained (Constitution: motion
 * never blocks reading) and automatically DISABLED when:
 *   - the user prefers reduced motion,
 *   - the primary pointer is coarse (touch), or
 *   - the event's pointer type is not a mouse.
 *
 * Usage (spread onto a Framer Motion element):
 *
 *   const magnetic = useMagneticHover<HTMLDivElement>();
 *   <motion.div
 *     ref={magnetic.ref}
 *     style={{ x: magnetic.x, y: magnetic.y }}
 *     onPointerMove={magnetic.onPointerMove}
 *     onPointerLeave={magnetic.onPointerLeave}
 *   />
 *
 * Transform-only (x/y) — never triggers layout.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useMotionValue,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from 'framer-motion';

export interface MagneticHoverOptions {
  /** Max displacement (px) when the cursor sits at the element's edge. Default 6. */
  strength?: number;
  /** Spring stiffness. Default 320. */
  stiffness?: number;
  /** Spring damping. Default 24. */
  damping?: number;
}

export interface MagneticHoverBindings<T extends HTMLElement> {
  ref: React.RefObject<T>;
  /** Sprung offsets — pass to a motion element's `style={{ x, y }}`. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  onPointerMove: (event: React.PointerEvent<T>) => void;
  onPointerLeave: () => void;
  /** True when the effect is inert (reduced motion / touch). */
  disabled: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useMagneticHover<T extends HTMLElement = HTMLElement>(
  options: MagneticHoverOptions = {},
): MagneticHoverBindings<T> {
  const { strength = 6, stiffness = 320, damping = 24 } = options;

  const ref = useRef<T>(null);
  const reducedMotion = useReducedMotion();
  const [coarsePointer, setCoarsePointer] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarsePointer(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const disabled = Boolean(reducedMotion) || coarsePointer;

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness, damping, mass: 0.4 });
  const y = useSpring(rawY, { stiffness, damping, mass: 0.4 });

  // Snap home whenever the effect turns inert mid-interaction.
  useEffect(() => {
    if (disabled) {
      rawX.set(0);
      rawY.set(0);
    }
  }, [disabled, rawX, rawY]);

  const onPointerMove = useCallback(
    (event: React.PointerEvent<T>) => {
      if (disabled || event.pointerType !== 'mouse') return;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratioX = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const ratioY = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      rawX.set(clamp(ratioX, -1, 1) * strength);
      rawY.set(clamp(ratioY, -1, 1) * strength);
    },
    [disabled, rawX, rawY, strength],
  );

  const onPointerLeave = useCallback(() => {
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  return { ref, x, y, onPointerMove, onPointerLeave, disabled };
}
