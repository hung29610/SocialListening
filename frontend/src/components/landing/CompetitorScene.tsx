'use client';

import { Section } from '@/components/ui/Section';
import { GlassTile } from '@/components/ui/GlassTile';
import { ParallaxLayer, Reveal } from './scene-motion';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Competitor and hashtag tracking is supported by the product. The landing
 * preview intentionally contains no unsourced numbers; live distributions
 * belong in the authenticated dashboard once a comparison is configured.
 */
export default function CompetitorScene() {
  const { t } = useLanguage();
  return (
    <Section
      aria-labelledby="competitors-heading"
      eyebrow="Competitors and hashtags"
      heading={<span id="competitors-heading">{t('landingCompetitors.heading')}</span>}
      intro="Track competitors and campaign hashtags, then compare share of voice and sentiment in the dashboard using analyzed mentions."
      width="wide"
    >
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <Reveal>
          <ul className="space-y-6">
            <li className="border-l-2 border-signal pl-5">
              <h3 className="font-display text-lg font-bold text-paper">{t('landingCompetitors.shareTitle')}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-paper-muted">
                {t('landingCompetitors.shareDescription')}
              </p>
            </li>
            <li className="border-l-2 border-signal pl-5">
              <h3 className="font-display text-lg font-bold text-paper">{t('landingCompetitors.sentimentTitle')}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-paper-muted">
                {t('landingCompetitors.sentimentDescription')}
              </p>
            </li>
            <li className="border-l-2 border-signal pl-5">
              <h3 className="font-display text-lg font-bold text-paper">{t('landingCompetitors.hashtagTitle')}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-paper-muted">
                {t('landingCompetitors.hashtagDescription')}
              </p>
            </li>
          </ul>
        </Reveal>

        <ParallaxLayer distance={28} aria-hidden="true">
          <GlassTile padding="lg">
            <p className="font-display text-eyebrow font-semibold uppercase text-paper-faint">{t('landingCompetitors.shareTitle')}</p>
            <div className="mt-4 rounded-xl border border-dashed border-signal/40 bg-signal/5 p-5">
              <p className="font-display text-sm font-semibold uppercase tracking-eyebrow text-signal dark:text-signal-bright">
                {t('landingCompetitors.sharePlaceholder')}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-paper-muted">
                {t('landingCompetitors.sharePlaceholderDescription')}
              </p>
              <div className="mt-5 space-y-2" aria-hidden="true">
                <div className="h-2.5 w-full rounded-full bg-paper-faint/20" />
                <div className="h-2.5 w-4/5 rounded-full bg-paper-faint/20" />
                <div className="h-2.5 w-3/5 rounded-full bg-paper-faint/20" />
              </div>
            </div>

            <p className="mt-7 border-t border-edge pt-5 font-display text-eyebrow font-semibold uppercase text-paper-faint">
              {t('landingCompetitors.sentimentTitle')}
            </p>
            <div className="mt-4 rounded-xl border border-dashed border-signal/40 bg-signal/5 p-5">
              <p className="font-display text-sm font-semibold uppercase tracking-eyebrow text-signal dark:text-signal-bright">
                {t('landingCompetitors.sentimentPlaceholder')}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-paper-muted">
                {t('landingCompetitors.sentimentPlaceholderDescription')}
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
