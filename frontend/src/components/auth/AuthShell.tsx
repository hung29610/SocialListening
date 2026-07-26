import React from 'react';
import Link from 'next/link';
import { Display } from '@/components/ui/Display';
import { GlassTile } from '@/components/ui/GlassTile';

/**
 * AuthShell — two-zone SIGNAL layout for /login and /register
 * (Epic SIGNAL, ADR 0002).
 *
 * Zones: an editorial brand statement (eyebrow + display headline) and
 * the form zone rendered on a GlassTile. On mobile the form comes
 * first; on desktop the brand zone sits left, the form right.
 *
 * Canvas + type are fully token-driven (void/paper/signal — dark and
 * light both designed, see src/styles/tokens.css). Entrance motion is
 * the existing fade/slide utilities (≤300ms), disabled automatically
 * under prefers-reduced-motion via globals.css. No particles on auth.
 */

/** Text input styling for SIGNAL auth forms (16px base size avoids iOS zoom). */
export const authInputClass =
  'block w-full min-w-0 rounded-xl border border-edge-strong bg-void-surface px-4 py-3 text-base text-paper transition-colors duration-150 placeholder:text-paper-faint focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/25 motion-reduce:transition-none dark:bg-void-raised dark:focus:border-signal-bright dark:focus:ring-signal-bright/30';

/** Form label styling. */
export const authLabelClass = 'mb-2 block text-sm font-medium text-paper';

/**
 * Primary submit action — the ONE signal accent doing its job.
 * Label is `--void-surface` (white) on light, `--paper` on dark: ≥5.5:1
 * on every state. Dark hover raises the glow instead of lightening the
 * fill (keeps AA on the label); light hover lifts to signal-bright.
 */
export const authSubmitClass =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-signal px-4 py-3 text-sm font-semibold text-void-surface shadow-glow-signal-sm transition-[background-color,box-shadow] duration-200 hover:bg-signal-bright active:bg-signal-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-void-surface disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none dark:text-paper dark:hover:bg-signal dark:hover:shadow-glow-signal dark:focus-visible:ring-signal-bright';

/** Inline accent link (small accent text on dark = signal-bright, per styles/README). */
export const authLinkClass =
  'font-semibold text-signal underline-offset-4 transition-colors hover:underline motion-reduce:transition-none dark:text-signal-bright';

/** Form-level error banner (sentiment-negative is data/status encoding, not a second accent). */
export const authErrorClass =
  'rounded-xl border border-sentiment-negative/30 bg-sentiment-negative/10 px-4 py-3 text-sm text-sentiment-negative';

interface AuthShellProps {
  /** Small-caps kicker above the brand statement. */
  brandEyebrow: React.ReactNode;
  /** Editorial display headline for the brand zone. */
  brandHeadline: React.ReactNode;
  /** Supporting copy under the headline. */
  brandBody: React.ReactNode;
  /** Form-zone content, rendered inside the GlassTile. */
  children: React.ReactNode;
}

export function AuthShell({ brandEyebrow, brandHeadline, brandBody, children }: AuthShellProps) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-void text-paper">
      {/* Ambient signal wash — token-driven; subtle ink tint on paper, emitted light on void */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[70vh] bg-[radial-gradient(72%_85%_at_50%_0%,hsl(var(--signal)/0.06),transparent_62%)] dark:bg-[radial-gradient(72%_85%_at_50%_0%,hsl(var(--signal)/0.16),transparent_62%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-6xl flex-col px-6 py-6 md:px-8">
        <header>
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-void dark:focus-visible:ring-signal-bright"
          >
            <span
              aria-hidden="true"
              className="grid h-10 w-10 place-items-center rounded-xl bg-signal text-sm font-black text-void-surface shadow-glow-signal-sm dark:text-paper"
            >
              N
            </span>
            <span className="font-display text-sm font-semibold uppercase tracking-eyebrow text-paper">
              Nope360
            </span>
          </Link>
        </header>

        <main className="grid flex-1 content-center gap-12 py-10 md:py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,29rem)] lg:items-center lg:gap-16">
          {/* Brand zone — second on mobile (form first), left on desktop */}
          <div className="order-2 mx-auto w-full max-w-md animate-fadeIn lg:order-1 lg:mx-0 lg:max-w-none">
            <p className="font-display text-eyebrow font-semibold uppercase text-signal dark:text-signal-bright">
              {brandEyebrow}
            </p>
            <Display as="p" size="lg" balance className="mt-5 text-paper">
              {brandHeadline}
            </Display>
            <p className="mt-6 max-w-md text-base leading-relaxed text-paper-muted">{brandBody}</p>
          </div>

          {/* Form zone */}
          <div className="order-1 mx-auto w-full max-w-md animate-fadeInUp lg:order-2 lg:mx-0 lg:max-w-none">
            <GlassTile as="section" padding="none" className="p-6 sm:p-8">
              {children}
            </GlassTile>
          </div>
        </main>
      </div>
    </div>
  );
}
