import type { Metadata } from 'next';
import Link from 'next/link';
import PublicSiteShell from '@/components/public/PublicSiteShell';
import { Section } from '@/components/ui/Section';
import { GlassTile } from '@/components/ui/GlassTile';
import { Display } from '@/components/ui/Display';
import { Reveal } from '@/components/landing/scene-motion';

/**
 * /features — SIGNAL system (Epic SIGNAL, ADR 0002 — W-C).
 * Structure adapted from the read-only reference worktree
 * (nope360-public-experience-v2 → PublicFeaturesPage), restyled to
 * SIGNAL tokens. Module list mirrors the REAL dashboard routes
 * (frontend/src/app/dashboard/*) — nothing listed that doesn't exist.
 */

export const metadata: Metadata = {
  title: 'Tính năng — Nope360',
  description:
    'Toàn bộ vòng lặp social listening của Nope360: dự án & từ khóa, nguồn & lần quét, mentions, phân tích AI, cảnh báo & sự cố, đối thủ, báo cáo.',
};

/* Each module maps to a real dashboard area (src/app/dashboard/…). */
const MODULES = [
  {
    title: 'Dự án & từ khóa',
    body: 'Tổ chức workspace theo dự án; khai báo 9 loại từ khóa — thương hiệu, đối thủ, hashtag, cụm tiêu cực và hơn nữa.',
    route: 'projects · keywords',
  },
  {
    title: 'Nguồn & lần quét',
    body: 'Cấu hình 12 loại nguồn public, đặt lịch quét từ hằng giờ đến hằng năm hoặc quét thủ công với từ khóa và nguồn tự chọn.',
    route: 'sources · scan · monitor',
  },
  {
    title: 'Luồng mention',
    body: 'Mọi mention khớp từ khóa về một dòng thời gian, gộp trùng lặp, lọc theo nguồn, sắc thái và thời gian.',
    route: 'mentions',
  },
  {
    title: 'Phân tích AI & sắc thái',
    body: 'Sentiment kèm độ tin cậy, nhãn ngữ cảnh tiếng Việt, điểm rủi ro 0–100, mức khủng hoảng 1–5 và đề xuất hành động.',
    route: 'analytics · summary',
  },
  {
    title: 'Cảnh báo & sự cố',
    body: 'Tín hiệu rủi ro cao thành cảnh báo; cảnh báo nghiêm trọng thành sự cố có trạng thái, theo dõi đến khi đóng.',
    route: 'alerts · incidents',
  },
  {
    title: 'Đối thủ & so sánh',
    body: 'Share of voice và so sánh sắc thái giữa thương hiệu của bạn với từng đối thủ trên cùng khung thời gian.',
    route: 'competitors · comparison',
  },
  {
    title: 'Báo cáo',
    body: 'Tóm tắt 3 dòng cho lãnh đạo, bản phân tích đầy đủ và xuất báo cáo chia sẻ cho vận hành, truyền thông, điều hành.',
    route: 'reports',
  },
  {
    title: 'Quản trị & cài đặt',
    body: 'Quyền truy cập theo tổ chức, cấu hình nhà cung cấp AI (Gemini, OpenAI hoặc endpoint riêng), giao diện tối/sáng.',
    route: 'organization · settings',
  },
] as const;

const OUTCOMES = ['Độ phủ', 'Ngữ cảnh', 'Ưu tiên', 'Phản hồi'] as const;

export default function FeaturesPage() {
  return (
    <PublicSiteShell>
      <Section as="header" aria-labelledby="features-heading" spacing="compact" width="wide" className="pt-16 md:pt-24">
        <p className="mb-4 font-display text-eyebrow font-semibold uppercase text-signal dark:text-signal-bright">
          Tính năng
        </p>
        <Display as="h1" size="2xl" balance id="features-heading" className="max-w-4xl text-paper">
          Một hệ thống cho toàn bộ vòng lặp lắng nghe.
        </Display>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-paper-muted">
          Các mô-đun dưới đây phản ánh đúng những gì dashboard làm hôm nay —
          từ khai báo từ khóa đầu tiên đến bản báo cáo cuối cùng.
        </p>
      </Section>

      <Section aria-label="Mô-đun sản phẩm" width="wide">
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODULES.map((module, index) => (
            <Reveal as="li" key={module.title} delay={(index % 4) * 70} className="min-w-0">
              <GlassTile className="flex h-full flex-col">
                <p className="font-display text-eyebrow font-semibold uppercase text-signal dark:text-signal-bright">
                  {module.route}
                </p>
                <h2 className="mt-4 font-display text-lg font-bold text-paper">
                  {module.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-paper-muted">
                  {module.body}
                </p>
              </GlassTile>
            </Reveal>
          ))}
        </ul>
      </Section>

      <Section
        aria-labelledby="outcomes-heading"
        eyebrow="Kết quả vận hành"
        heading={<span id="outcomes-heading">Nghe thấy → hiểu đúng → hành động kịp.</span>}
        width="wide"
        className="border-y border-edge bg-void-surface"
      >
        <ol className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {OUTCOMES.map((outcome, index) => (
            <Reveal as="li" key={outcome} delay={index * 80}>
              <div className="h-full rounded-tile border border-edge bg-void-raised/60 p-6">
                <p
                  aria-hidden="true"
                  className="font-display text-metric font-extrabold tabular-nums text-signal/25 dark:text-signal/30"
                >
                  0{index + 1}
                </p>
                <p className="mt-3 font-display text-lg font-bold text-paper">{outcome}</p>
              </div>
            </Reveal>
          ))}
        </ol>
        <Reveal delay={160} className="mt-12 flex flex-col gap-3 sm:flex-row">
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
            Đăng nhập
          </Link>
        </Reveal>
      </Section>
    </PublicSiteShell>
  );
}
