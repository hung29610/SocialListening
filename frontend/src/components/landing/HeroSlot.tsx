import Link from 'next/link';
import { Display } from '@/components/ui/Display';
import { SignalWaveMark } from '@/components/public/PublicSiteShell';

/**
 * HeroSlot — static SIGNAL hero fallback (Epic SIGNAL, ADR 0002 — W-C).
 *
 * W-B builds the real `SignalHero` (canvas particle mention stream) in
 * `@/components/landing/hero/` on its own branch. Until that lands on
 * the epic branch, this static token-styled hero keeps `/` complete:
 * Display statement + CTAs + truthful trust strip, zero particles,
 * zero motion (LCP-friendly, no-JS safe, zero CLS).
 *
 * INTEGRATION (one line, in src/app/page.tsx):
 *   replace  `import HeroSlot from '@/components/landing/HeroSlot';`
 *   with     `import { SignalHero as HeroSlot } from '@/components/landing/hero';`
 * per the mount contract documented in state/EPIC_SIGNAL_WB_RESULT.md
 * (props `{ className?: string }`; SignalHero renders the page <h1>,
 * exactly like this fallback, so the swap keeps heading order intact).
 */

/* Truthful trust strip — product facts verified in the repo
   (backend/app/models/source.py, ai_service.py, FEATURE_STATUS.md). */
const TRUST_FACTS = [
  '12 loại nguồn public',
  'AI sentiment tiếng Việt',
  'Cảnh báo & sự cố',
  'Báo cáo lãnh đạo',
] as const;

export default function HeroSlot() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden bg-void"
    >
      {/* Static signal glow — pure CSS, no canvas, aria-hidden */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 mx-auto h-[32rem] w-[52rem] max-w-full rounded-full bg-signal/10 blur-3xl dark:bg-signal/15"
      />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-6 pb-24 pt-24 text-center md:px-8 md:pb-32 md:pt-32">
        <p className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-edge bg-void-raised/70 px-4 py-2 font-display text-eyebrow font-semibold uppercase text-signal dark:text-signal-bright">
          <span className="h-1.5 w-1.5 rounded-full bg-signal shadow-glow-signal-sm" />
          Nope360 · Social listening
        </p>

        <Display as="h1" size="2xl" balance id="hero-heading" className="max-w-5xl text-paper">
          Internet là nhiễu.
          <br />
          <span className="text-signal dark:text-signal-bright">Nope360 là tín hiệu.</span>
        </Display>

        <p className="mt-8 max-w-2xl text-balance text-lg leading-relaxed text-paper-muted">
          Theo dõi mọi cuộc thảo luận public về thương hiệu của bạn, để AI đọc
          đúng ngữ cảnh tiếng Việt, và nhận cảnh báo trước khi vấn đề trở thành
          khủng hoảng.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full bg-signal px-8 py-4 text-base font-semibold text-white shadow-glow-signal-sm transition-colors hover:bg-signal-bright"
          >
            Bắt đầu theo dõi
          </Link>
          <Link
            href="/features"
            className="inline-flex items-center justify-center rounded-full border border-edge-strong px-8 py-4 text-base font-semibold text-paper transition-colors hover:border-signal hover:text-signal dark:hover:text-signal-bright"
          >
            Khám phá tính năng
          </Link>
        </div>

        <SignalWaveMark className="mt-16" />

        <ul
          aria-label="Năng lực sản phẩm"
          className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
        >
          {TRUST_FACTS.map((fact) => (
            <li
              key={fact}
              className="font-display text-eyebrow font-semibold uppercase text-paper-faint"
            >
              {fact}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
