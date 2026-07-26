'use client';

/**
 * CompetitorScene — competitor & hashtag tracking (Epic SIGNAL — W-C).
 *
 * SUPPORTED, verified (state/EPIC_SIGNAL_PRODUCT_TRUTH.md):
 *   - backend/app/api/competitors.py `/summary` returns Share of Voice
 *     and sentiment comparison between brand and competitor keywords
 *   - frontend/src/app/dashboard/competitors/page.tsx renders both
 *   - KeywordType.HASHTAG is a first-class keyword type
 * Visual is a schematic (abstract bar widths, no invented numbers).
 */

import { Section } from '@/components/ui/Section';
import { GlassTile } from '@/components/ui/GlassTile';
import { ParallaxLayer, Reveal } from './scene-motion';

const SHARE_ROWS = [
  { label: 'Thương hiệu của bạn', width: '72%', brand: true },
  { label: 'Đối thủ A', width: '48%', brand: false },
  { label: 'Đối thủ B', width: '31%', brand: false },
] as const;

const SENTIMENT_ROWS = [
  { positive: '45%', neutral: '35%', negative: '20%' },
  { positive: '30%', neutral: '42%', negative: '28%' },
] as const;

export default function CompetitorScene() {
  return (
    <Section
      aria-labelledby="competitors-heading"
      eyebrow="Đối thủ & hashtag"
      heading={<span id="competitors-heading">Biết mình đứng đâu trong cuộc thảo luận.</span>}
      intro="Khai báo đối thủ như một loại từ khóa riêng, theo dõi hashtag chiến dịch, và so sánh thị phần thảo luận (share of voice) cùng sắc thái giữa thương hiệu của bạn và thị trường — ngay trong dashboard."
      width="wide"
    >
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <Reveal>
          <ul className="space-y-6">
            {[
              {
                title: 'Share of voice',
                body: 'So sánh khối lượng mention giữa thương hiệu và từng đối thủ trên cùng khung thời gian.',
              },
              {
                title: 'So sánh sắc thái',
                body: 'Đặt tỷ lệ tích cực – trung lập – tiêu cực của bạn cạnh đối thủ để thấy vị thế cảm xúc thật.',
              },
              {
                title: 'Hashtag là từ khóa hạng nhất',
                body: 'Theo dõi #hashtag chiến dịch như mọi từ khóa khác: quét theo lịch, phân tích sắc thái, kích cảnh báo.',
              },
            ].map((item) => (
              <li key={item.title} className="border-l-2 border-signal pl-5">
                <h3 className="font-display text-lg font-bold text-paper">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-paper-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </Reveal>

        <ParallaxLayer distance={28} aria-hidden="true">
          <GlassTile padding="lg">
            <p className="font-display text-eyebrow font-semibold uppercase text-paper-faint">
              Share of voice
            </p>
            <ul className="mt-4 space-y-3">
              {SHARE_ROWS.map((row) => (
                <li key={row.label}>
                  <div className="flex items-center justify-between text-xs text-paper-muted">
                    <span className={row.brand ? 'font-semibold text-paper' : ''}>
                      {row.label}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-void-raised">
                    <div
                      className={`h-full rounded-full ${
                        row.brand ? 'bg-signal' : 'bg-paper-faint/30'
                      }`}
                      style={{ width: row.width }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-7 border-t border-edge pt-5 font-display text-eyebrow font-semibold uppercase text-paper-faint">
              So sánh sắc thái
            </p>
            <ul className="mt-4 space-y-3">
              {SENTIMENT_ROWS.map((row, index) => (
                <li key={index} className="flex h-2.5 overflow-hidden rounded-full bg-void-raised">
                  <span className="h-full bg-sentiment-positive" style={{ width: row.positive }} />
                  <span className="h-full bg-sentiment-neutral" style={{ width: row.neutral }} />
                  <span className="h-full bg-sentiment-negative" style={{ width: row.negative }} />
                </li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-paper-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sentiment-positive" /> Tích cực
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sentiment-neutral" /> Trung lập
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sentiment-negative" /> Tiêu cực
              </span>
            </div>
          </GlassTile>
        </ParallaxLayer>
      </div>
    </Section>
  );
}
