'use client';

/**
 * MetricsBand — giant truthful numerals (Epic SIGNAL — W-C).
 *
 * Constitution: numbers are either VERIFIED in this repo or flagged
 * COPY_TBD — never invented. The four numerals below are all verified:
 *   12 source types   backend/app/models/source.py::SourceType
 *   9 keyword types   backend/app/models/keyword.py::KeywordType
 *   6 scan schedules  backend/app/models/source.py::CrawlFrequency
 *   0–100 risk score  ai_service.py::analyze_mention / mention.py
 * Business metrics (mentions processed, customers, uptime…) are NOT
 * verifiable from the repo → explicit COPY_TBD placeholder row.
 */

import { Section } from '@/components/ui/Section';
import { MetricStat } from '@/components/ui/MetricStat';
import { Reveal } from './scene-motion';

const VERIFIED_METRICS = [
  { value: '12', label: 'Loại nguồn public', hint: 'Facebook · Instagram · YouTube · báo chí · RSS · diễn đàn · web' },
  { value: '9', label: 'Loại từ khóa', hint: 'Thương hiệu, đối thủ, hashtag, cụm tiêu cực…' },
  { value: '6', label: 'Lịch quét', hint: 'Từ hằng giờ đến hằng năm, kèm quét thủ công' },
  { value: '0–100', label: 'Thang điểm rủi ro', hint: 'Kèm mức khủng hoảng 1–5 cho từng mention' },
] as const;

export default function MetricsBand() {
  return (
    <Section
      aria-labelledby="metrics-heading"
      className="border-y border-edge bg-void-surface"
      width="wide"
    >
      <h2 id="metrics-heading" className="sr-only">
        Năng lực sản phẩm theo số liệu
      </h2>
      <div className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
        {VERIFIED_METRICS.map((metric, index) => (
          <Reveal key={metric.label} delay={index * 90}>
            <MetricStat
              size="lg"
              value={metric.value}
              label={metric.label}
              hint={metric.hint}
            />
          </Reveal>
        ))}
      </div>
      {/* COPY_TBD: business metrics (mentions processed / teams onboard /
          time-to-alert) need real, sourced numbers from the human team
          before they may appear here. Structure reserved, no fake data. */}
      <Reveal delay={200}>
        <p className="mt-14 border-t border-edge pt-6 text-sm text-paper-faint">
          <span className="font-display font-semibold uppercase tracking-eyebrow text-paper-muted">
            COPY_TBD
          </span>{' '}
          — số liệu vận hành (mention đã xử lý, số đội ngũ sử dụng, thời gian
          phát cảnh báo) sẽ được bổ sung khi có nguồn kiểm chứng.
        </p>
      </Reveal>
    </Section>
  );
}
