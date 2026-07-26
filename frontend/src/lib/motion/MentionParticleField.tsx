'use client';

/**
 * MentionParticleField — the SIGNAL "noise → signal" canvas
 * (Epic SIGNAL, ADR 0002 — W-B motion engine).
 *
 * A canvas-2D field of raw mention noise: dust motes and hairline text
 * fragments drifting chaotically. As `progress` moves 0 → 1 the field
 * RESOLVES: particles lock onto waveform lanes that funnel toward the
 * `focus` point (where the hero's insight card sits) — the product
 * metaphor made literal.
 *
 * Hard rules implemented here (Design Constitution):
 * - Plain canvas 2D, no WebGL, no new deps.
 * - Decorative only: `aria-hidden`, `pointer-events-none`; never a
 *   dependency of LCP content.
 * - 60fps: one rAF loop with clamped delta timing; draw is
 *   allocation-free; DPR-aware (capped at 2); density adapts to
 *   viewport area.
 * - Pauses when offscreen (IntersectionObserver) and when the tab is
 *   hidden (visibilitychange).
 * - `prefers-reduced-motion`: no animation loop at all — a single
 *   static frame of the fully RESOLVED state is drawn (never blank),
 *   and re-drawn on resize/theme change.
 * - Zero hardcoded palette values: colors are read from the SIGNAL
 *   tokens at runtime and re-read when the theme class flips.
 */

import React, { useEffect, useRef } from 'react';
import type { MotionValue } from 'framer-motion';
import {
  hslaFromToken,
  readSignalPalette,
  watchDocumentTheme,
} from './signal-tokens';

export interface MentionParticleFieldProps {
  /**
   * Resolve progress: 0 = raw noise, 1 = fully resolved signal.
   * Accepts a Framer `MotionValue` (scroll-driven, zero re-renders) or
   * a plain number. Default 0 (ambient noise).
   */
  progress?: MotionValue<number> | number;
  /**
   * Point the resolved lanes funnel toward, as fractions of the canvas
   * (0..1). Aim it at the element the noise "becomes". Default
   * `{ x: 0.72, y: 0.55 }`.
   */
  focus?: { x: number; y: number };
  /** Particles per 100,000 css px². Default 32 (≈415 at 1440×900). */
  density?: number;
  /** Hard cap regardless of viewport area. Default 420. */
  maxParticles?: number;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  /** Base y of the noise wander, px. */
  by: number;
  seedA: number;
  seedB: number;
  /** Drift speed in the noise state, px/s. */
  driftX: number;
  /** Flow speed in the resolved state, px/s. */
  flowX: number;
  lane: number;
  laneJitter: number;
  /** Per-particle resolve stagger threshold (0..0.5). */
  resolveAt: number;
  size: number;
  /** 0 → dot; >0 → dash of this length. */
  dashLen: number;
  /** 0 dust | 1 signal | 2 positive | 3 negative | 4 neutral. */
  colorKey: number;
  alpha: number;
}

const LANES = 6;
const MIN_PARTICLES = 70;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export const MentionParticleField: React.FC<MentionParticleFieldProps> = ({
  progress = 0,
  focus,
  density = 32,
  maxParticles = 420,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef(0);
  const focusX = focus?.x ?? 0.72;
  const focusY = focus?.y ?? 0.55;

  /* Keep the engine fed with the latest progress without re-renders. */
  useEffect(() => {
    if (typeof progress === 'number') {
      progressRef.current = clamp01(progress);
      return;
    }
    progressRef.current = clamp01(progress.get());
    return progress.on('change', (value) => {
      progressRef.current = clamp01(value);
    });
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let destroyed = false;
    let width = 0;
    let height = 0;
    let rafId: number | null = null;
    let lastTime = 0;
    let elapsed = 0;
    let intersecting = false;
    let colors: string[] = [];
    let particles: Particle[] = [];
    const lanePhases = Array.from({ length: LANES }, () => Math.random() * Math.PI * 2);

    const rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = rmQuery.matches;

    const rebuildColors = () => {
      const palette = readSignalPalette(canvas);
      colors = [
        hslaFromToken(palette.paperFaint),
        hslaFromToken(palette.signal),
        hslaFromToken(palette.sentimentPositive),
        hslaFromToken(palette.sentimentNegative),
        hslaFromToken(palette.sentimentNeutral),
      ];
    };

    const makeParticle = (): Particle => {
      const roll = Math.random();
      let colorKey = 0;
      let dashLen = 0;
      let alpha: number;
      if (roll < 0.42) {
        colorKey = 0; // dust dot
        alpha = 0.2 + Math.random() * 0.25;
      } else if (roll < 0.62) {
        colorKey = 0; // dust dash — a fragment of raw text
        dashLen = 6 + Math.random() * 10;
        alpha = 0.16 + Math.random() * 0.2;
      } else if (roll < 0.78) {
        colorKey = 1; // signal dot
        alpha = 0.35 + Math.random() * 0.4;
      } else if (roll < 0.86) {
        colorKey = 1; // signal dash
        dashLen = 8 + Math.random() * 8;
        alpha = 0.3 + Math.random() * 0.3;
      } else {
        colorKey = 2 + Math.floor(Math.random() * 3); // sentiment dot
        alpha = 0.3 + Math.random() * 0.3;
      }
      return {
        x: Math.random() * Math.max(width, 1),
        y: 0,
        by: (0.08 + Math.random() * 0.84) * Math.max(height, 1),
        seedA: Math.random() * Math.PI * 2,
        seedB: Math.random() * Math.PI * 2,
        driftX: 14 + Math.random() * 34,
        flowX: 70 + Math.random() * 55,
        lane: Math.floor(Math.random() * LANES),
        laneJitter: (Math.random() - 0.5) * 7,
        resolveAt: Math.random() * 0.5,
        size: 0.9 + Math.random() * 1.5,
        dashLen,
        colorKey,
        alpha,
      };
    };

    const setSize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w === 0 || h === 0) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = w;
      height = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(
        Math.max(Math.round(((w * h) / 100000) * density), MIN_PARTICLES),
        maxParticles,
      );
      particles = Array.from({ length: target }, makeParticle);
      return true;
    };

    const laneGapBase = () => Math.min(Math.max(height * 0.06, 18), 44);

    /** Resolved-state y for lane `lane` at position `x`, time `t`. */
    const laneY = (x: number, lane: number, t: number): number => {
      const fx = focusX * width;
      const funnel = clamp01((fx - x) / Math.max(fx, 1));
      const gap = laneGapBase() * (0.16 + 0.84 * funnel);
      const ripple = (2 + 10 * funnel) * Math.sin(x * 0.014 - t * 2.1 + lanePhases[lane]);
      return focusY * height + (lane - (LANES - 1) / 2) * gap + ripple;
    };

    const noiseY = (p: Particle, t: number): number =>
      p.by +
      height * 0.05 * Math.sin(t * 0.6 + p.seedA) +
      height * 0.035 * Math.sin(t * 1.15 + p.seedB);

    const drawParticle = (p: Particle, ease: number, globalP: number) => {
      let mul: number;
      if (p.colorKey === 0) {
        mul = 1 - 0.55 * globalP; // noise dims as the signal emerges
      } else if (p.colorKey === 1) {
        mul = 0.7 + 0.3 * ease; // the accent brightens
      } else {
        mul = 0.65 + 0.35 * ease;
      }
      ctx.globalAlpha = clamp01(p.alpha * mul);
      ctx.fillStyle = colors[p.colorKey];
      if (p.dashLen > 0) {
        ctx.fillRect(p.x, p.y, p.dashLen, 1.25);
      } else if (p.size <= 1.4) {
        ctx.fillRect(p.x, p.y, p.size, p.size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = (dt: number) => {
      const globalP = progressRef.current;
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        const local = clamp01((globalP - p.resolveAt) / 0.5);
        const ease = local * local * (3 - 2 * local); // smoothstep
        const vx = p.driftX + (p.flowX - p.driftX) * ease;
        p.x += vx * dt;
        if (p.x > width + 30) {
          p.x = -20 - Math.random() * 60;
          p.by = (0.08 + Math.random() * 0.84) * height;
        }
        const ny = noiseY(p, elapsed);
        const ly = laneY(p.x, p.lane, elapsed) + p.laneJitter;
        p.y = ny + (ly - ny) * ease;
        drawParticle(p, ease, globalP);
      }
      ctx.globalAlpha = 1;
    };

    /** Single static frame of the fully resolved state (reduced motion). */
    const drawStaticResolved = () => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.y = laneY(p.x, p.lane, 0) + p.laneJitter;
        drawParticle(p, 1, 1);
      }
      ctx.globalAlpha = 1;
    };

    const tick = (now: number) => {
      if (destroyed || rafId === null) return;
      const dt = Math.min(Math.max((now - lastTime) / 1000, 0), 1 / 30);
      lastTime = now;
      elapsed += dt;
      step(dt);
      rafId = requestAnimationFrame(tick);
    };

    const syncLoop = () => {
      const shouldRun = !destroyed && !reduced && intersecting && !document.hidden;
      if (shouldRun && rafId === null) {
        lastTime = performance.now();
        rafId = requestAnimationFrame(tick);
      } else if (!shouldRun && rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const repaintPaused = () => {
      if (destroyed) return;
      if (reduced) drawStaticResolved();
      else if (rafId === null) step(0);
    };

    // ── boot ──────────────────────────────────────────────────────
    rebuildColors();
    if (setSize()) {
      if (reduced) drawStaticResolved();
      else step(0); // paint the noise state immediately, no blank flash
    }

    const onRmChange = () => {
      reduced = rmQuery.matches;
      if (reduced) drawStaticResolved();
      syncLoop();
    };
    rmQuery.addEventListener('change', onRmChange);

    const onVisibility = () => syncLoop();
    document.addEventListener('visibilitychange', onVisibility);

    const io = new IntersectionObserver((entries) => {
      intersecting = entries[0]?.isIntersecting ?? false;
      syncLoop();
    });
    io.observe(canvas);

    let resizeQueued = false;
    const ro = new ResizeObserver(() => {
      if (resizeQueued) return;
      resizeQueued = true;
      requestAnimationFrame(() => {
        resizeQueued = false;
        if (destroyed) return;
        if (setSize()) repaintPaused();
      });
    });
    ro.observe(canvas);

    const unwatchTheme = watchDocumentTheme(() => {
      rebuildColors();
      repaintPaused();
    });

    return () => {
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      rmQuery.removeEventListener('change', onRmChange);
      document.removeEventListener('visibilitychange', onVisibility);
      io.disconnect();
      ro.disconnect();
      unwatchTheme();
    };
  }, [density, maxParticles, focusX, focusY]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`.trim()}
    />
  );
};
