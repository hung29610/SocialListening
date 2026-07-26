# SIGNAL Design Tokens

Epic SIGNAL (ADR 0002 — `docs/adr/0002-signal-design-direction.md`).
Single source of truth: `frontend/src/styles/tokens.css`, imported by
`src/app/globals.css` and mapped into Tailwind in `frontend/tailwind.config.ts`.

## Theme mechanism (existing — integrated, not reinvented)

The app already themes via **next-themes v0.4** with `attribute="class"`,
`defaultTheme="system"` (`src/app/layout.tsx` → `src/components/ThemeProvider.tsx`)
and Tailwind `darkMode: 'class'`. SIGNAL tokens plug into exactly that:

- `:root` → **light** set ("studio paper", separately art-directed)
- `.dark` → **dark** set (canonical SIGNAL art direction)

There is no `[data-theme]` attribute in this app — do not introduce one.
(`src/contexts/ThemeContext.tsx` is a legacy, unimported provider; ignore it.)

Token names are **roles**, constant across themes: `void` is always the page
canvas, `paper` is always the primary foreground, whatever theme is active.

## Core palette

| Token | Tailwind | Dark (canonical) | Light ("studio paper") | Role |
|---|---|---|---|---|
| `--void` | `bg-void` | `#050510` void | `#F6F4EE` warm paper | Page canvas |
| `--void-surface` | `bg-void-surface` | `#0B0B1A` | `#FFFFFF` | Raised band / surface |
| `--void-raised` | `bg-void-raised` | `#131325` | `#F9F8F4` | Tile base over surface |
| `--paper` | `text-paper` | `#F4F2EC` paper | `#121221` ink | Primary foreground |
| `--paper-muted` | `text-paper-muted` | `#BFBBB0` | `#48485B` | Secondary text |
| `--paper-faint` | `text-paper-faint` | `#7B7B8E` | `#717184` | Captions / tertiary |
| `--signal` | `text-signal` … | `#473DFF` | `#2920D5` | **THE** accent |
| `--signal-bright` | `text-signal-bright` | `#6E66FF` | `#473EEA` | Hover / small accent text on dark |
| `--signal-deep` | `bg-signal-deep` | `#3329BC` | `#241BA7` | Pressed / underlays |
| `--sentiment-positive` | `text-sentiment-positive` | `#45D391` | `#157F4D` | Positive sentiment |
| `--sentiment-negative` | `text-sentiment-negative` | `#EE5867` | `#B81E2D` | Negative sentiment |
| `--sentiment-neutral` | `text-sentiment-neutral` | `#9297AA` | `#606576` | Neutral sentiment |
| `--edge` | `border-edge` | `#1F1F33` | `#DFDBD3` | Hairline rules |
| `--edge-strong` | `border-edge-strong` | `#313149` | `#C6C0B3` | Emphasized rules |

Stored as raw HSL triplets, so Tailwind opacity modifiers work:
`bg-signal/20`, `border-sentiment-positive/25`, etc.

### The accent: why `#473DFF`

The Constitution mandates exactly one electric blue-violet accent in
`#3932DC` territory. `#3932DC` itself (L ≈ 53%) sinks on `#050510`; SIGNAL
must read as **light emitted from the void**. `--signal` keeps the hue
(243°) at full chroma and lifts lightness to 62% → `#473DFF`: contrast
3.3:1 on void — passes WCAG for large display type and graphics, which is
what the accent is for. For **small accent text on dark** use
`--signal-bright` (`#6E66FF`, 4.8:1). In light mode the same hue is
re-inked to 74%/48% → `#2920D5` (8.4:1 on the paper canvas).

One accent means one: no second accent hue anywhere. Sentiment colors are
data encoding, not accents.

## Light mode — art direction, not inversion

The light theme is designed as **"studio paper"**: the printed edition of
the same magazine, not a flipped negative.

- The canvas is **warm paper** (`#F6F4EE`, same 45° warm hue family as the
  dark theme's paper text), never plain white and never an inverted void.
  Surfaces are white like mounted prints on that paper.
- Foreground is a violet-cast **ink** (`#121221`), not `#000`.
- The accent is **re-inked deeper**, not reused: `#2920D5` holds 8.4:1 on
  paper where the dark theme's `#473DFF` would wash out.
- **Glow becomes shadow**: `--glow-signal` is a neon emission on dark and a
  soft ink shadow on light. Light emits in the void; ink absorbs on paper.
- Glass flips material: smoked violet glass (dark) → frosted white (light).
- Sentiment moves from luminous (readable on void) to ink-weight (≥5:1 on
  white surfaces).

## Glass, glows, depth

| Token | Notes |
|---|---|
| `--glass-surface` / `--glass-surface-opaque` | Translucent body + no-`backdrop-filter` fallback |
| `--glass-edge` / `--glass-edge-strong` | Hairline glass borders (carry own alpha) |
| `--glass-highlight` | Inner top light (inset 1px) |
| `--glass-blur` | 20px dark / 16px light |
| `--glow-signal`, `--glow-signal-sm` | `shadow-glow-signal`, `shadow-glow-signal-sm` |
| `--shadow-tile` | `shadow-tile` — deep tile drop |

The composed surface is the plain CSS class `.signal-glass`
(+ `.signal-glass--glow`) in `tokens.css`, consumed by the `GlassTile`
primitive. It degrades gracefully via `@supports not (backdrop-filter…)`.

## 8px grid

All spacing sits on an 8px grid. Tailwind's default rem scale already is
8px-based at even steps (`gap-2` = 8px, `p-6` = 48px…). Additions:

- `--space-1…16` (8→128px) for hand-written CSS,
- `--space-band` = `clamp(6rem, 4.5rem + 6vw, 10rem)` — section rhythm,
  exposed as `py-band`,
- Tailwind spacing `18` (72px), `22` (88px), `30` (120px).

**Layout spacing sits on the 8px grid** (section rhythm, gaps between
blocks, container padding). **4px half-steps are allowed for micro-spacing
inside components** — badge padding, icon gaps, dot offsets (`px-2.5`,
`gap-1.5`, `py-0.5`), matching the shipped primitives and legacy pills.
Never introduce values off the 4px lattice (no `py-[13px]`).

## Type scale

| Tailwind | Token | Clamp | Use |
|---|---|---|---|
| `text-display-2xl` | `--text-display-2xl` | 3.5rem → 8rem | Hero statement |
| `text-display-xl` | `--text-display-xl` | 3rem → 6rem | Section headings |
| `text-display-lg` | `--text-display-lg` | 2.5rem → 4.5rem | Sub-scenes |
| `text-display-md` | `--text-display-md` | 2rem → 3rem | Cards / auth |
| `text-metric-lg` | `--text-metric-lg` | 3rem → 5.5rem | Giant stat numerals |
| `text-metric` | `--text-metric` | 2.25rem → 3.5rem | Stat numerals |
| `text-eyebrow` | `--text-eyebrow` | 0.75rem | Small-caps kickers |

Display sizes embed leading `0.95–1.05` and tracking `-0.045em`
(`tracking-display`); metrics embed `-0.04em` and must add
`tabular-nums`; eyebrows embed `+0.18em` (`tracking-eyebrow`) and are
composed with `uppercase font-semibold`.

**Faces:** the SIGNAL display face is **Space Grotesk**, loaded
dependency-free via `next/font/google` in `layout.tsx` and exposed as the
CSS variable `--font-display` on `<body>`. Consume it via the Tailwind
utility `font-display` (fallbacks: Inter → system sans) — `Display` and
`Section`'s eyebrow already apply it. Body/UI text stays **Inter**
(`next/font`, applied on `<body>`). Do not load additional fonts.

## Radii

Existing `--radius-*` family (globals.css) still applies. SIGNAL adds
`--radius-tile` = 20px (`rounded-tile`) for glass tiles.

## Primitives (`src/components/ui/`)

| Component | Purpose |
|---|---|
| `Section` | Layout band: eyebrow/heading/intro slots, `py-band` rhythm, width variants |
| `Display` | Editorial display text on the clamp scale |
| `MetricStat` | Giant tabular numeral + small-caps label (+ hint) |
| `GlassTile` | `.signal-glass` surface; `glow`, `interactive`, `padding` variants |
| `SentimentBadge` | Sentiment pill; accepts raw `string \| null` mention sentiment |

`MentionParticleField` is **not** here — it belongs to the motion engine
(W-B, `lib/motion` + hero).

> **Migration note (W-D):** TWO legacy sentiment pills predate
> `ui/SentimentBadge` and must be migrated to it during the dashboard sync:
> `components/dashboard/SentimentTag.tsx` (default export) and the
> same-named `SentimentBadge` in `components/dashboard/Badges.tsx`
> (used by `MentionCard.tsx` and `CrisisWarRoomModal.tsx`). The name
> collision is intentional until then and conflict-free: both are only ever
> imported by explicit module path (`@/components/dashboard/Badges` vs
> `@/components/ui/SentimentBadge`) and `components/ui/` has no barrel
> index, so imports cannot ambiguate.

## Usage rules

1. **Never hardcode palette values.** No hex/hsl/rgb literals, no Tailwind
   stock colors (`indigo-500`, `slate-*`) in SIGNAL surfaces — reviewers
   reject them. Consume tokens via the Tailwind utilities above.
2. **One accent.** `--signal` (+ bright/deep states) is the only accent.
3. **Small accent text on dark uses `signal-bright`**, e.g.
   `text-signal dark:text-signal-bright` (the eyebrow pattern in `Section`).
4. **Dark and light are both designed.** Never invert; if a new token is
   needed, design both values in `tokens.css`.
5. **Truthful content only.** Unknown numbers/copy ship as `COPY_TBD`.
6. **Additive to the legacy system.** The pre-SIGNAL variables
   (`--background`, `--primary`, …) in `globals.css` keep powering existing
   dashboard components until their ticket migrates them. New SIGNAL work
   must use SIGNAL tokens only.
