'use client';

import { Section } from '@/components/ui/Section';
import { GlassTile } from '@/components/ui/GlassTile';
import { ParallaxLayer, Reveal } from './scene-motion';

/**
 * Competitor and hashtag tracking is supported by the product. The landing
 * preview intentionally contains no unsourced numbers; live distributions
 * belong in the authenticated dashboard once a comparison is configured.
 */
export default function CompetitorScene() {
  return (
    <Section
      aria-labelledby="competitors-heading"
      eyebrow="Competitors and hashtags"
      heading={<span id="competitors-heading">Know where you stand in the conversation.</span>}
      intro="Track competitors and campaign hashtags, then compare share of voice and sentiment in the dashboard using analyzed mentions."
      width="wide"
    >
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <Reveal>
          <ul className="space-y-6">
            <li className="border-l-2 border-signal pl-5">
              <h3 className="font-display text-lg font-bold text-paper">Share of voice</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-paper-muted">
                Compare mention volume between your brand and configured competitors over the same period.
              </p>
            </li>
            <li className="border-l-2 border-signal pl-5">
              <h3 className="font-display text-lg font-bold text-paper">Sentiment comparison</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-paper-muted">
                See positive, neutral, and negative distributions from real analyzed mentions side by side.
              </p>
            </li>
            <li className="border-l-2 border-signal pl-5">
              <h3 className="font-display text-lg font-bold text-paper">Hashtags are keywords</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-paper-muted">
                Track campaign hashtags like any other keyword: scan, analyze sentiment, and trigger alerts.
              </p>
            </li>
          </ul>
        </Reveal>

        <ParallaxLayer distance={28} aria-hidden="true">
          <GlassTile padding="lg">
            <p className="font-display text-eyebrow font-semibold uppercase text-paper-faint">Share of voice</p>
            <div className="mt-4 rounded-xl border border-dashed border-signal/40 bg-signal/5 p-5">
              <p className="font-display text-sm font-semibold uppercase tracking-eyebrow text-signal dark:text-signal-bright">
                COPY_TBD - live comparison preview
              </p>
              <p className="mt-2 text-sm leading-relaxed text-paper-muted">
                Verified share-of-voice values appear here after a real comparison is configured.
              </p>
              <div className="mt-5 space-y-2" aria-hidden="true">
                <div className="h-2.5 w-full rounded-full bg-paper-faint/20" />
                <div className="h-2.5 w-4/5 rounded-full bg-paper-faint/20" />
                <div className="h-2.5 w-3/5 rounded-full bg-paper-faint/20" />
              </div>
            </div>

            <p className="mt-7 border-t border-edge pt-5 font-display text-eyebrow font-semibold uppercase text-paper-faint">
              Sentiment comparison
            </p>
            <div className="mt-4 rounded-xl border border-dashed border-signal/40 bg-signal/5 p-5">
              <p className="font-display text-sm font-semibold uppercase tracking-eyebrow text-signal dark:text-signal-bright">
                COPY_TBD - sentiment comparison
              </p>
              <p className="mt-2 text-sm leading-relaxed text-paper-muted">
                Sentiment distributions are populated from analyzed mentions in the dashboard.
              </p>
              <div className="mt-5 flex h-2.5 gap-1" aria-hidden="true">
                <span className="h-full flex-1 rounded-full bg-sentiment-positive/30" />
                <span className="h-full flex-1 rounded-full bg-sentiment-neutral/30" />
                <span className="h-full flex-1 rounded-full bg-sentiment-negative/30" />
              </div>
            </div>
          </GlassTile>
        </ParallaxLayer>
      </div>
    </Section>
  );
}
