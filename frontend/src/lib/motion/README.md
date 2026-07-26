# SIGNAL motion engine (`@/lib/motion`)

Epic SIGNAL (ADR 0002), W-B. Reusable scroll/motion utilities on
Framer Motion 11 — **no new runtime deps**. Everything animates
transform/opacity only and honors `prefers-reduced-motion` as a hard
rule. Primary consumer: the landing feature scenes (W-C) and the hero.

## API

### `useScrollScene<T>(options?) → { ref, progress }`

Binds a scene container to scroll. `progress` is a `MotionValue`
0→1 — derive everything from it with `useTransform` (re-render-free).

- Default offset `['start start', 'end end']` fits **pinned** scenes:
  an outer container taller than the viewport (`h-[190vh]`) with a
  `sticky top-0 h-svh` stage inside. Progress runs while the stage is
  pinned.
- For plain in-flow scenes pass `offset: ['start end', 'end start']`
  (progress = element crossing the viewport).

```tsx
const { ref, progress } = useScrollScene<HTMLElement>();
const opacity = useTransform(progress, [0.2, 0.5], [0, 1]);
<section ref={ref} className="relative h-[190vh] motion-reduce:h-auto">
  <div className="sticky top-0 h-svh motion-reduce:static">
    <motion.div style={{ opacity }} … />
```

Reduced motion: gate the `style` prop (`reduced ? undefined : {…}`)
and add the CSS belt `motion-reduce:!opacity-100
motion-reduce:!transform-none` so content is correct pre-hydration.

### `<SceneReveal>`

Viewport-entry fade/rise wrapper (`motion.div` props pass through).
Props: `distance` (28), `delay` (0), `once` (true), `amount` (0.3).
Instant + opacity-only under reduced motion, with the CSS belt baked
in. **Never wrap the page's LCP element** — it server-renders
`opacity: 0`.

### `useParallax(progress, distance?) → MotionValue<number>`

Subtle y drift for a pinned scene; constant 0 under reduced motion.
Transform-only: `style={{ y: useParallax(progress, 48) }}`.

### `useMagneticHover<T>(options?) → { ref, x, y, onPointerMove, onPointerLeave, disabled }`

Magnetic hover attraction (default max 6px). Auto-disabled on reduced
motion, coarse pointers, and non-mouse pointer events.

```tsx
const m = useMagneticHover<HTMLDivElement>();
<motion.div ref={m.ref} style={{ x: m.x, y: m.y }}
  onPointerMove={m.onPointerMove} onPointerLeave={m.onPointerLeave} />
```

### `<MentionParticleField>`

The "noise → signal" canvas (see component JSDoc for the full spec).
Decorative (`aria-hidden`, `pointer-events-none`), absolutely fills its
**positioned** parent. Drive `progress` (0 noise → 1 resolved) with a
scene `MotionValue`; aim `focus` at the element the noise resolves
into. DPR-aware, viewport-adaptive density, pauses offscreen, static
resolved frame under reduced motion.

### `signalEase`

The epic's shared expo-out ease tuple (mirrors `--ease-out-expo`).

### `usePrefersReducedMotion()` / `prefersReducedMotion()`

Reactive hook (may be `null` on first render) / imperative check.

### `readSignalPalette` / `hslaFromToken` / `watchDocumentTheme`

Low-level bridge for further canvas work: read SIGNAL tokens from
computed style (never hardcode palette values), build canvas color
strings, observe theme flips (next-themes toggles the `dark` class).

## Rules of the road

1. Transform/opacity only for DOM motion — no width/height/top/left.
2. Scroll-driven values live in `MotionValue`s, not React state.
3. Every effect needs its reduced-motion story (usually: static end
   state). The engine primitives handle theirs; compose accordingly.
4. Canvas colors come from `readSignalPalette` — reviewers reject
   hex/hsl literals (Design Constitution).
