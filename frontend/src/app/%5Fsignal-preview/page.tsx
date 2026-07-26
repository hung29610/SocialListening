import type { Metadata } from 'next';
import { SignalHero } from '@/components/landing/hero';

/**
 * ── DEV PREVIEW ONLY — NOT A PRODUCT ROUTE ──────────────────────────
 * Epic SIGNAL (ADR 0002), W-B evidence harness.
 *
 * Mounts `SignalHero` in isolation so browser evidence (screenshots,
 * LCP/CLS, reduced-motion) can be captured without touching
 * `app/page.tsx` (W-C's lock). Linked from no navigation; noindex.
 * Removed at epic close or kept as a hidden preview (orchestrator
 * decision recorded in the W-B ticket).
 *
 * Folder name note: the granted lock path was `app/_signal-preview/**`,
 * but the app router treats `_`-prefixed folders as PRIVATE (excluded
 * from routing). The documented escape `%5F` (URL-encoded underscore)
 * yields the intended route `/_signal-preview`.
 */

export const metadata: Metadata = {
  title: 'SIGNAL hero — dev preview',
  robots: { index: false, follow: false },
};

export default function SignalHeroPreviewPage() {
  return (
    <main className="relative bg-void">
      {/* Dev-preview marker — fixed, non-interactive, outside product nav */}
      <p className="pointer-events-none fixed right-4 top-4 z-50 rounded-pill border border-edge bg-void-surface/80 px-4 py-2 font-display text-eyebrow font-semibold uppercase text-paper-faint">
        Dev preview
      </p>

      <SignalHero />

      {/* Post-hero runway: proves the pin releases and the scene hands off */}
      <section className="relative z-10 border-t border-edge bg-void-surface px-6 py-40 text-center">
        <p className="font-display text-eyebrow font-semibold uppercase text-paper-faint">
          Dev preview · vùng cuộn sau hero — không phải nội dung sản phẩm
        </p>
      </section>
    </main>
  );
}
