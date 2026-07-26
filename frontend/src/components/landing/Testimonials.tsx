'use client';

/**
 * Testimonials — COPY_TBD placeholder structure (Epic SIGNAL — W-C).
 *
 * Constitution: NO fake names, companies or quotes styled as real.
 * This section ships the designed structure with every content slot
 * explicitly and visibly flagged COPY_TBD until the human team
 * provides verified customer stories.
 */

import { Section } from '@/components/ui/Section';
import { GlassTile } from '@/components/ui/GlassTile';
import { Reveal } from './scene-motion';

const PLACEHOLDER_SLOTS = [1, 2, 3] as const;

export default function Testimonials() {
  return (
    <Section
      aria-labelledby="stories-heading"
      eyebrow="Câu chuyện sử dụng"
      heading={<span id="stories-heading">Đội ngũ thật, kết quả thật.</span>}
      intro="Phần này chờ câu chuyện có kiểm chứng từ khách hàng thật — chúng tôi không đăng lời chứng thực bịa."
      width="wide"
      className="bg-void-surface"
    >
      <ul className="grid gap-4 md:grid-cols-3">
        {PLACEHOLDER_SLOTS.map((slot, index) => (
          <Reveal as="li" key={slot} delay={index * 80} className="min-w-0">
            <GlassTile className="flex h-full flex-col">
              <p className="inline-flex w-fit items-center rounded-full border border-edge bg-void-raised px-3 py-1 font-display text-eyebrow font-semibold uppercase text-paper-faint">
                COPY_TBD
              </p>
              <p className="mt-5 flex-1 text-sm leading-relaxed text-paper-muted">
                Trích dẫn khách hàng đang chờ xác minh. Vị trí này chỉ hiển thị
                câu chuyện thật, từ đội ngũ thật, với sự đồng ý của họ.
              </p>
              <div className="mt-6 flex items-center gap-3 border-t border-edge pt-5">
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 place-items-center rounded-full border border-edge bg-void-raised font-display text-xs font-bold text-paper-faint"
                >
                  ?
                </span>
                <div className="text-xs text-paper-faint">
                  <p className="font-semibold">COPY_TBD — Tên</p>
                  <p>COPY_TBD — Vai trò, tổ chức</p>
                </div>
              </div>
            </GlassTile>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
