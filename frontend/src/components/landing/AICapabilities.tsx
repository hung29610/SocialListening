'use client';

/**
 * AICapabilities — what the AI layer actually does (Epic SIGNAL — W-C).
 *
 * Every claim verified in backend/app/services/ai_service.py and
 * backend/app/models/mention.py:
 *   - sentiment (positive/neutral/negative) + confidence_score
 *   - vietnamese_context_label on AIAnalysis
 *   - risk_score 0–100, crisis_level 1–5
 *   - suggested_action (monitor/respond/escalate/legal_review) +
 *     responsible_department (customer_service/PR/legal/executive)
 *   - executive brief (summary_3_lines + full_brief)
 *   - configurable provider (Gemini / OpenAI / custom endpoint) with a
 *     safe NEUTRAL fallback when the provider errors.
 * NOT claimed: automatic multi-provider failover — the code runs ONE
 * active provider config; no failover chain exists (verified, cut per
 * product-truth rule and recorded in the W-C result file).
 */

import { Section } from '@/components/ui/Section';
import { GlassTile } from '@/components/ui/GlassTile';
import { Reveal } from './scene-motion';

const CAPABILITIES = [
  {
    title: 'Sắc thái kèm độ tin cậy',
    body: 'Mỗi mention được phân loại tích cực, trung lập hoặc tiêu cực — luôn kèm điểm tin cậy để đội ngũ biết khi nào nên tự đọc lại.',
  },
  {
    title: 'Nhãn ngữ cảnh tiếng Việt',
    body: 'AI gắn nhãn ngữ cảnh dành riêng cho tiếng Việt — mỉa mai, tin giật gân hay phàn nàn thật sự được đọc đúng như người Việt đọc.',
  },
  {
    title: 'Điểm rủi ro & mức khủng hoảng',
    body: 'Thang rủi ro 0–100 và mức khủng hoảng 1–5 giúp xếp hạng điều cần xử lý trước, thay vì trôi theo dòng thời gian.',
  },
  {
    title: 'Đề xuất hành động',
    body: 'Từng phân tích đi kèm đề xuất: theo dõi, phản hồi, leo thang hay rà soát pháp lý — và phòng ban nên tiếp nhận.',
  },
  {
    title: 'Tóm tắt cho lãnh đạo',
    body: 'AI viết bản tóm tắt 3 dòng và bản phân tích đầy đủ bằng tiếng Việt, sẵn sàng đưa vào báo cáo điều hành.',
  },
  {
    title: 'Nhà cung cấp AI do bạn chọn',
    body: 'Cấu hình Gemini, OpenAI hoặc endpoint tùy chỉnh của riêng bạn. Khi nhà cung cấp lỗi, hệ thống trả kết quả trung tính an toàn — pipeline không bao giờ nghẽn.',
  },
] as const;

export default function AICapabilities() {
  return (
    <Section
      aria-labelledby="ai-heading"
      eyebrow="Lớp phân tích AI"
      heading={<span id="ai-heading">AI hiểu tiếng Việt, không chỉ dịch tiếng Việt.</span>}
      intro="Lớp phân tích được thiết kế cho thị trường Việt Nam: sắc thái, ngữ cảnh và rủi ro được đọc bằng đúng ngôn ngữ mà khách hàng của bạn đang dùng."
      width="wide"
      className="bg-void-surface"
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CAPABILITIES.map((capability, index) => (
          <Reveal as="li" key={capability.title} delay={(index % 3) * 80} className="min-w-0">
            <GlassTile className="h-full">
              <span
                aria-hidden="true"
                className="block h-1 w-8 rounded-full bg-signal"
              />
              <h3 className="mt-4 font-display text-lg font-bold text-paper">
                {capability.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-paper-muted">
                {capability.body}
              </p>
            </GlassTile>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
