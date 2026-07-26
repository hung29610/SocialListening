'use client';

/**
 * FinalCTA — closing statement + call to action (Epic SIGNAL — W-C).
 */

import Link from 'next/link';
import { Section } from '@/components/ui/Section';
import { Display } from '@/components/ui/Display';
import { Reveal } from './scene-motion';

export default function FinalCTA() {
  return (
    <Section aria-labelledby="cta-heading" width="default" spacing="spacious">
      <Reveal className="relative overflow-hidden rounded-tile border border-edge bg-void-surface px-6 py-16 text-center md:px-16 md:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 w-[36rem] max-w-full rounded-full bg-signal/10 blur-3xl dark:bg-signal/15"
        />
        <div className="relative">
          <p className="font-display text-eyebrow font-semibold uppercase text-signal dark:text-signal-bright">
            Bắt đầu hôm nay
          </p>
          <Display as="h2" size="xl" balance id="cta-heading" className="mx-auto mt-4 max-w-3xl text-paper">
            Ngừng đọc nhiễu. Bắt đầu nghe tín hiệu.
          </Display>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-paper-muted">
            Tạo workspace, khai báo từ khóa đầu tiên và để Nope360 theo dõi phần
            còn lại của internet giúp bạn.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-signal px-8 py-4 text-base font-semibold text-white shadow-glow-signal-sm transition-colors hover:bg-signal-bright"
            >
              Tạo workspace
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-edge-strong px-8 py-4 text-base font-semibold text-paper transition-colors hover:border-signal hover:text-signal dark:hover:text-signal-bright"
            >
              Tôi đã có tài khoản
            </Link>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
