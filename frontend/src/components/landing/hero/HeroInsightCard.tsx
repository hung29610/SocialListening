import React from 'react';
import { GlassTile } from '@/components/ui/GlassTile';
import { SentimentBadge } from '@/components/ui/SentimentBadge';

/**
 * HeroInsightCard — the clean insight the hero's noise resolves into
 * (Epic SIGNAL, ADR 0002 — W-B).
 *
 * Uses REAL product shapes only: a mention card (source, time,
 * content), its AI analysis (sentiment + Vietnamese context labels)
 * and the alert trail — the exact objects the dashboard works with.
 * Every value the product would supply is a truthful `COPY_TBD`
 * placeholder (Design Constitution: no fake data), marked with
 * `data-copy-tbd` for the evidence pass.
 */
export const HeroInsightCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <GlassTile as="article" padding="lg" glow className={className}>
      {/* Mention header — live dot, source, time */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60 motion-reduce:animate-none motion-reduce:opacity-0" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
          </span>
          <div>
            <p className="text-sm font-semibold text-paper">Mention mới</p>
            {/* COPY_TBD: real source + timestamp shape (e.g. "domain · 2 phút trước") */}
            <p className="text-xs text-paper-faint" data-copy-tbd="hero-mention-source">
              COPY_TBD · nguồn &amp; thời gian
            </p>
          </div>
        </div>
        <SentimentBadge sentiment={null} label="COPY_TBD" size="sm" />
      </div>

      {/* Mention content — quote body is COPY_TBD, never invented */}
      <blockquote
        className="mt-6 border-l-2 border-edge-strong pl-4 text-sm leading-relaxed text-paper-muted"
        data-copy-tbd="hero-mention-quote"
      >
        &ldquo;COPY_TBD — trích dẫn mention thực tế do người viết nội dung cung cấp.&rdquo;
      </blockquote>

      {/* AI analysis — sentiment + Vietnamese context labels (real product shapes) */}
      <div className="mt-6 border-t border-edge pt-4">
        <p className="font-display text-eyebrow font-semibold uppercase tracking-eyebrow text-paper-faint">
          Phân tích AI
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className="rounded-full border border-edge px-2.5 py-1 text-xs font-medium text-paper-muted"
            data-copy-tbd="hero-context-label"
          >
            Ngữ cảnh: COPY_TBD
          </span>
          <span
            className="rounded-full border border-edge px-2.5 py-1 text-xs font-medium text-paper-muted"
            data-copy-tbd="hero-reach-label"
          >
            Mức lan tỏa: COPY_TBD
          </span>
        </div>
      </div>

      {/* Alert trail — the product's answer to the mention */}
      <div className="mt-4 flex items-center justify-between gap-4 border-t border-edge pt-4">
        <p className="text-xs text-paper-faint" data-copy-tbd="hero-alert-line">
          Cảnh báo đã gửi · COPY_TBD
        </p>
        <span
          className="text-xs font-semibold text-signal dark:text-signal-bright"
          aria-hidden="true"
        >
          →
        </span>
      </div>
    </GlassTile>
  );
};
