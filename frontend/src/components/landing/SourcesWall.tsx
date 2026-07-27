'use client';

/**
 * SourcesWall — "không bỏ lỡ một mention nào" (Epic SIGNAL — W-C).
 *
 * Shows EXACTLY the source types the product supports, verified against
 * `backend/app/models/source.py::SourceType` (12 enum values), grouped
 * per state/EPIC_SIGNAL_PRODUCT_TRUTH.md. Typographic tiles only — no
 * third-party logos, and no unsupported platforms (no Twitter/X,
 * TikTok, LinkedIn, Reddit, Threads).
 */

import { Section } from '@/components/ui/Section';
import { GlassTile } from '@/components/ui/GlassTile';
import { Reveal } from './scene-motion';

interface SourceGroup {
  name: string;
  /** Verbatim SourceType coverage, humanized. */
  detail: string;
  /** Abstract monogram — typographic, never a third-party logo. */
  mark: string;
}

const SOURCE_GROUPS: SourceGroup[] = [
  { name: 'Facebook', detail: 'Trang · Nhóm · Trang cá nhân', mark: 'Fb' },
  { name: 'Instagram', detail: 'Tài khoản business', mark: 'Ig' },
  { name: 'YouTube', detail: 'Kênh · Video', mark: 'Yt' },
  { name: 'Báo & tin tức', detail: 'Trang tin trong nước và quốc tế', mark: 'Nw' },
  { name: 'RSS', detail: 'Mọi nguồn phát RSS feed', mark: 'Rss' },
  { name: 'Diễn đàn', detail: 'Forum & cộng đồng thảo luận', mark: 'Fm' },
  { name: 'Website', detail: 'Trang web bất kỳ', mark: 'Wb' },
  { name: 'URL thủ công', detail: 'Nạp trực tiếp đường dẫn cần theo dõi', mark: 'Url' },
  { name: 'Tìm kiếm toàn cầu', detail: 'Quét mở rộng ngoài nguồn đã cấu hình', mark: 'Gs' },
];

export default function SourcesWall() {
  return (
    <Section
      aria-labelledby="sources-heading"
      eyebrow="Nguồn được hỗ trợ"
      heading={
        <span id="sources-heading">Không bỏ lỡ một mention nào.</span>
      }
      intro="12 loại nguồn public — đúng những gì sản phẩm thu thập hôm nay, không hơn không kém. Mỗi nguồn được quét theo lịch bạn chọn và đổ về cùng một luồng mention."
      width="wide"
      className="bg-void-surface"
    >
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3">
        {SOURCE_GROUPS.map((group, index) => (
          <Reveal as="li" key={group.name} delay={(index % 3) * 80} className="min-w-0">
            <GlassTile interactive className="h-full">
              <span
                aria-hidden="true"
                className="inline-grid h-10 w-10 place-items-center rounded-xl border border-edge bg-void-raised font-display text-sm font-bold text-signal dark:text-signal-bright"
              >
                {group.mark}
              </span>
              <p className="mt-4 font-display text-lg font-bold text-paper">
                {group.name}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-paper-muted">
                {group.detail}
              </p>
            </GlassTile>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
