import type { Metadata } from 'next';
import Link from 'next/link';
import PublicSiteShell from '@/components/public/PublicSiteShell';
import { Section } from '@/components/ui/Section';
import { GlassTile } from '@/components/ui/GlassTile';
import { Display } from '@/components/ui/Display';
import { Reveal } from '@/components/landing/scene-motion';

/**
 * /about — SIGNAL system (Epic SIGNAL, ADR 0002 — W-C).
 * Structure adapted from the read-only reference worktree
 * (nope360-public-experience-v2 → PublicAboutPage), restyled to
 * SIGNAL tokens and the shared PublicSiteShell.
 */

export const metadata: Metadata = {
  title: 'Giới thiệu — Nope360',
  description:
    'Vì sao Nope360 tồn tại: giúp đội ngũ Việt Nam nghe thấy tín hiệu thị trường sớm, hiểu đúng ngữ cảnh và phản hồi có trách nhiệm.',
};

const PILLARS = [
  {
    title: 'Sứ mệnh',
    body: 'Giúp đội ngũ nhìn thấy tín hiệu sớm, hiểu bối cảnh đầy đủ và phản hồi bằng dữ liệu có thể kiểm chứng — trước khi vấn đề thành khủng hoảng.',
  },
  {
    title: 'Triết lý sản phẩm',
    body: 'Ít nhiễu hơn, nhiều ngữ cảnh hơn. Mọi màn hình phải giúp người dùng ưu tiên hành động, thay vì chỉ tiêu thụ thêm một dashboard.',
  },
  {
    title: 'Vì sao tín hiệu sớm quan trọng',
    body: 'Cuộc thảo luận công khai thường báo trước sự dịch chuyển trong nhận thức, rủi ro và cơ hội — trước khi báo cáo nội bộ kịp phản ánh.',
  },
  {
    title: 'AI có trách nhiệm',
    body: 'AI để tóm tắt, phân loại và tăng tốc đọc hiểu. Quyết định vận hành vẫn thuộc về con người — có kiểm tra, có ngữ cảnh, có trách nhiệm.',
  },
] as const;

const PRINCIPLES = [
  'Ngôn ngữ sản phẩm trung thực, không tô vẽ số liệu.',
  'Giao diện tối và sáng đều được thiết kế riêng, dễ đọc trước khi đẹp.',
  'Một hệ thống token và component dùng chung từ landing đến dashboard.',
] as const;

export default function AboutPage() {
  return (
    <PublicSiteShell>
      <Section as="header" aria-labelledby="about-heading" spacing="compact" width="wide" className="pt-16 md:pt-24">
        <p className="mb-4 font-display text-eyebrow font-semibold uppercase text-signal dark:text-signal-bright">
          Giới thiệu Nope360
        </p>
        <Display as="h1" size="2xl" balance id="about-heading" className="max-w-4xl text-paper">
          Cuộc thảo luận public chuyển động rất nhanh. Đội ngũ nghiêm túc cần tín hiệu sớm.
        </Display>
        <p className="mt-8 max-w-2xl text-lg leading-relaxed text-paper-muted">
          Nope360 giúp đội vận hành, truyền thông và thương hiệu tại Việt Nam
          quan sát thảo luận công khai với đủ cấu trúc để biết điều gì quan
          trọng, điều gì đang đổi chiều và điều gì cần phản hồi.
        </p>
      </Section>

      <Section aria-label="Trụ cột sản phẩm" width="wide">
        <ul className="grid gap-4 md:grid-cols-2">
          {PILLARS.map((pillar, index) => (
            <Reveal as="li" key={pillar.title} delay={(index % 2) * 80} className="min-w-0">
              <GlassTile padding="lg" className="h-full">
                <span aria-hidden="true" className="block h-1 w-8 rounded-full bg-signal" />
                <h2 className="mt-5 font-display text-display-md font-bold text-paper">
                  {pillar.title}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-paper-muted">
                  {pillar.body}
                </p>
              </GlassTile>
            </Reveal>
          ))}
        </ul>
      </Section>

      <Section
        aria-labelledby="principles-heading"
        eyebrow="Nguyên tắc thiết kế"
        heading={<span id="principles-heading">Chúng tôi xây sản phẩm như thế nào.</span>}
        width="wide"
        className="border-y border-edge bg-void-surface"
      >
        <ul className="grid gap-4 md:grid-cols-3">
          {PRINCIPLES.map((principle, index) => (
            <Reveal as="li" key={principle} delay={index * 80}>
              <div className="h-full rounded-tile border border-edge bg-void-raised/60 p-6">
                <p
                  aria-hidden="true"
                  className="font-display text-metric font-extrabold tabular-nums text-signal/25 dark:text-signal/30"
                >
                  0{index + 1}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-paper-muted">{principle}</p>
              </div>
            </Reveal>
          ))}
        </ul>
        <Reveal delay={160} className="mt-12">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-full bg-signal px-8 py-4 text-base font-semibold text-white shadow-glow-signal-sm transition-colors hover:bg-signal-bright"
          >
            Bắt đầu với Nope360
          </Link>
        </Reveal>
      </Section>
    </PublicSiteShell>
  );
}
