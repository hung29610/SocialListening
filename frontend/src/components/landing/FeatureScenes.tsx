'use client';

/**
 * FeatureScenes — scroll-driven scenes for the domain loop
 * (Epic SIGNAL, ADR 0002 — W-C).
 *
 * One scene per verified domain step (FEATURE_STATUS.md, all DONE):
 *   Monitor (Keyword→Scan) → Mentions → AI Analysis & Sentiment →
 *   Alerts & Incidents → Reports.
 *
 * Visuals are schematic interface vignettes: real product vocabulary
 * (KeywordType, CrawlFrequency, SentimentScore, suggested_action —
 * all verbatim from backend/app/models + ai_service.py) over skeleton
 * bars. No invented data, numbers, or quotes anywhere.
 *
 * Motion: thin framer-motion helpers from ./scene-motion (swappable
 * for W-B's lib/motion). Content is readable without JS-motion and
 * under prefers-reduced-motion everything renders static.
 */

import { Section } from '@/components/ui/Section';
import { GlassTile } from '@/components/ui/GlassTile';
import { SentimentBadge } from '@/components/ui/SentimentBadge';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  ParallaxLayer,
  Reveal,
  ScrollRail,
  ScrollRailContainer,
} from './scene-motion';

/* ── Schematic atoms (aria-hidden decorations, no fake copy) ──────── */

function SkeletonLine({ width }: { width: string }) {
  return (
    <span
      className="block h-2 rounded-full bg-paper-faint/20"
      style={{ width }}
    />
  );
}

function Chip({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'signal';
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
        tone === 'signal'
          ? 'border-signal/30 bg-signal/10 text-signal dark:text-signal-bright'
          : 'border-edge bg-void-raised text-paper-muted'
      }`}
    >
      {children}
    </span>
  );
}

/* ── Scene visuals ────────────────────────────────────────────────── */

function MonitorVisual() {
  const { t } = useLanguage();
  return (
    <GlassTile padding="lg" aria-hidden="true">
      <p className="font-display text-eyebrow font-semibold uppercase text-paper-faint">
        Từ khóa theo dõi
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip tone="signal">Thương hiệu</Chip>
        <Chip>Đối thủ</Chip>
        <Chip>#hashtag</Chip>
        <Chip>Cụm tiêu cực</Chip>
        <Chip>Nhân sự chủ chốt</Chip>
      </div>
      <p className="mt-6 font-display text-eyebrow font-semibold uppercase text-paper-faint">
        Lịch quét
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {['Hằng giờ', 'Hằng ngày', 'Hằng tuần', 'Hằng tháng', 'Hằng năm', 'Thủ công'].map(
          (frequency, index) => (
            <Chip key={frequency} tone={index === 0 ? 'signal' : 'default'}>
              {frequency}
            </Chip>
          ),
        )}
      </div>
      <div className="mt-6 space-y-2 border-t border-edge pt-5">
        <p className="text-xs font-semibold uppercase tracking-eyebrow text-signal dark:text-signal-bright">{t('landingFeatures.scanPlaceholder')}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-paper-muted">Đang quét nguồn…</span>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal motion-reduce:animate-none" />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-void-raised">
          <div className="h-full w-2/3 rounded-full bg-signal/70" />
        </div>
      </div>
    </GlassTile>
  );
}

function MentionsVisual() {
  const rows = [
    { source: 'COPY_TBD source', sentiment: null },
    { source: 'COPY_TBD source', sentiment: null },
    { source: 'COPY_TBD source', sentiment: null },
  ] as const;

  return (
    <GlassTile padding="lg" aria-hidden="true">
      <div className="flex items-center justify-between">
        <p className="font-display text-eyebrow font-semibold uppercase text-paper-faint">
          Luồng mention
        </p>
        <Chip>Đã gộp trùng lặp</Chip>
      </div>
      <ul className="mt-5 space-y-3">
        {rows.map((row, index) => (
          <li
            key={index}
            className="rounded-xl border border-edge bg-void-raised/60 p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <Chip>{row.source}</Chip>
              <SentimentBadge sentiment={row.sentiment} label="COPY_TBD" size="sm" />
            </div>
            <div className="mt-3 space-y-2">
              <SkeletonLine width="92%" />
              <SkeletonLine width="71%" />
            </div>
          </li>
        ))}
      </ul>
    </GlassTile>
  );
}

function AnalysisVisual() {
  const { t } = useLanguage();
  return (
    <GlassTile padding="lg" glow aria-hidden="true">
      <p className="font-display text-eyebrow font-semibold uppercase text-paper-faint">
        Phân bố sắc thái
      </p>
      <div className="mt-4 rounded-xl border border-dashed border-signal/40 bg-signal/5 p-4">
        <p className="font-display text-sm font-semibold uppercase tracking-eyebrow text-signal dark:text-signal-bright">
          {t('landingFeatures.sentimentPlaceholder')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-paper-muted">
          {t('landingFeatures.sentimentPlaceholderDescription')}
        </p>
        <div className="mt-4 space-y-2" aria-hidden="true">
          <div className="h-2 w-full rounded-full bg-sentiment-positive/20" />
          <div className="h-2 w-full rounded-full bg-sentiment-neutral/20" />
          <div className="h-2 w-full rounded-full bg-sentiment-negative/20" />
        </div>
      </div>

      <div className="mt-6 border-t border-edge pt-5">
        <div className="flex items-center justify-between text-xs text-paper-muted">
          <span>Điểm rủi ro</span>
          <span className="tabular-nums">0 — 100</span>
        </div>
        <div className="mt-2 rounded-xl border border-dashed border-signal/40 bg-signal/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-eyebrow text-signal dark:text-signal-bright">{t('landingFeatures.riskPlaceholder')}</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-void-raised">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-sentiment-positive/30 via-sentiment-neutral/30 to-sentiment-negative/30" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-paper-muted">
          <span>Mức khủng hoảng</span>
          <span className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((level) => (
              <span
                key={level}
                className="h-2 w-2 rounded-full border border-edge bg-void-raised"
              />
            ))}
          </span>
        </div>
      </div>

      <div className="mt-6 border-t border-edge pt-5">
        <p className="font-display text-eyebrow font-semibold uppercase text-paper-faint">
          Nhãn ngữ cảnh tiếng Việt
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="h-6 w-24 rounded-full bg-paper-faint/15" />
          <span className="h-6 w-16 rounded-full bg-paper-faint/15" />
          <span className="h-6 w-20 rounded-full bg-paper-faint/15" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {['Theo dõi', 'Phản hồi', 'Leo thang', 'Rà soát pháp lý'].map((action, index) => (
            <Chip key={action} tone={index === 2 ? 'signal' : 'default'}>
              {action}
            </Chip>
          ))}
        </div>
      </div>
    </GlassTile>
  );
}

function AlertsVisual() {
  const { t } = useLanguage();
  return (
    <GlassTile padding="lg" aria-hidden="true">
      <div className="flex items-center justify-between">
        <p className="font-display text-eyebrow font-semibold uppercase text-paper-faint">
          Cảnh báo
        </p>
        <span className="inline-flex items-center gap-2 rounded-full border border-sentiment-negative/25 bg-sentiment-negative/10 px-3 py-1 text-xs font-semibold text-sentiment-negative">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sentiment-negative motion-reduce:animate-none" />
          Tín hiệu nóng
        </span>
      </div>
      <p className="mt-5 rounded-xl border border-dashed border-signal/40 bg-signal/5 p-4 text-sm leading-relaxed text-paper-muted">
        <span className="font-display font-semibold uppercase tracking-eyebrow text-signal dark:text-signal-bright">{t('landingFeatures.alertPlaceholder')}</span>
        <br />{t('landingFeatures.alertPlaceholderDescription')}
      </p>
      <ul className="mt-3 space-y-3" aria-hidden="true">
        {[1, 2, 3].map((index) => (
          <li
            key={index}
            className="flex items-center gap-3 rounded-xl border border-edge bg-void-raised/60 p-4"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-paper-faint/40" />
            <SkeletonLine width="100%" />
          </li>
        ))}
      </ul>
      <div className="mt-5 flex items-center gap-3 border-t border-edge pt-5">
        <Chip tone="signal">Chuyển thành sự cố</Chip>
        <span className="text-xs text-paper-muted">theo dõi đến khi xử lý xong</span>
      </div>
    </GlassTile>
  );
}

function ReportsVisual() {
  const { t } = useLanguage();
  return (
    <GlassTile padding="lg" aria-hidden="true">
      <div className="flex items-center justify-between">
        <p className="font-display text-eyebrow font-semibold uppercase text-paper-faint">
          Báo cáo lãnh đạo
        </p>
        <Chip>Xuất báo cáo</Chip>
      </div>
      <div className="mt-5 rounded-xl border border-edge bg-void-raised/60 p-4">
        <p className="text-xs font-semibold text-paper-muted">Tóm tắt 3 dòng</p>
        <div className="mt-3 space-y-2">
          <SkeletonLine width="95%" />
          <SkeletonLine width="88%" />
          <SkeletonLine width="64%" />
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-eyebrow text-signal dark:text-signal-bright">{t('landingFeatures.reportPlaceholder')}</p>
      <div className="mt-3 rounded-xl border border-edge bg-void-raised/60 p-4">
        <p className="text-xs font-semibold text-paper-muted">Bản phân tích đầy đủ</p>
        <div className="mt-3 grid grid-cols-3 items-end gap-2">
          {[1, 2, 3].map((index) => (
            <div key={index} className="flex h-16 items-end rounded-lg bg-void-raised">
              <div
                className="h-1/2 w-full rounded-lg bg-signal/30"
              />
            </div>
          ))}
        </div>
      </div>
    </GlassTile>
  );
}

/* ── Scenes ───────────────────────────────────────────────────────── */

interface Scene {
  index: string;
  title: string;
  body: string;
  facts: string[];
  visual: React.ReactNode;
}

const SCENES: Scene[] = [
  {
    index: '01',
    title: 'Giám sát: từ từ khóa đến lần quét',
    body: 'Khai báo thương hiệu, đối thủ, hashtag hay cụm từ tiêu cực cần theo dõi, gán nguồn và để hệ thống quét theo lịch — từ hằng giờ đến hằng năm, hoặc quét thủ công đúng lúc bạn cần.',
    facts: ['9 loại từ khóa', '6 tần suất quét', 'Quét thủ công theo yêu cầu'],
    visual: <MonitorVisual />,
  },
  {
    index: '02',
    title: 'Mention đổ về một luồng duy nhất',
    body: 'Mọi bài viết, bình luận và tin bài khớp từ khóa được thu về cùng một dòng thời gian, tự động gộp trùng lặp để đội ngũ đọc tín hiệu chứ không đọc lại cùng một nhiễu.',
    facts: ['Gộp trùng lặp tự động', 'Lọc theo nguồn & thời gian'],
    visual: <MentionsVisual />,
  },
  {
    index: '03',
    title: 'AI đọc đúng ngữ cảnh tiếng Việt',
    body: 'Từng mention được phân tích sắc thái kèm độ tin cậy, chấm điểm rủi ro 0–100, xếp mức khủng hoảng 1–5 và gắn nhãn ngữ cảnh tiếng Việt — kèm đề xuất hành động và phòng ban phụ trách.',
    facts: ['Sentiment + độ tin cậy', 'Nhãn ngữ cảnh tiếng Việt', 'Đề xuất hành động'],
    visual: <AnalysisVisual />,
  },
  {
    index: '04',
    title: 'Cảnh báo trước khi thành khủng hoảng',
    body: 'Tín hiệu rủi ro cao kích hoạt cảnh báo ngay lập tức. Cảnh báo nghiêm trọng chuyển thành sự cố có trạng thái, được theo dõi đến khi đội ngũ xử lý xong — không tín hiệu nào rơi rụng.',
    facts: ['Cảnh báo theo mức rủi ro', 'Quản lý sự cố đầu-cuối'],
    visual: <AlertsVisual />,
  },
  {
    index: '05',
    title: 'Báo cáo kể đúng câu chuyện dữ liệu',
    body: 'Từ luồng mention đến bản tóm tắt 3 dòng cho lãnh đạo và báo cáo phân tích đầy đủ — xuất ra để chia sẻ, với nguồn gốc từng con số luôn truy vết được về cuộc thảo luận ban đầu.',
    facts: ['Tóm tắt lãnh đạo 3 dòng', 'Xuất báo cáo chia sẻ'],
    visual: <ReportsVisual />,
  },
];

export default function FeatureScenes() {
  return (
    <Section
      aria-labelledby="scenes-heading"
      eyebrow="Vòng lặp sản phẩm"
      heading={<span id="scenes-heading">Từ nhiễu thành tín hiệu, trong năm bước.</span>}
      intro="Đúng vòng lặp mà workspace của bạn vận hành mỗi ngày: giám sát, thu mention, phân tích bằng AI, cảnh báo và báo cáo."
      width="wide"
    >
      <ScrollRailContainer className="lg:pl-14">
        <ScrollRail className="hidden lg:block lg:left-0" />
        <ol className="space-y-24 md:space-y-32">
          {SCENES.map((scene, index) => {
            const flip = index % 2 === 1;
            return (
              <li
                key={scene.index}
                aria-labelledby={`scene-${scene.index}-title`}
                className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
              >
                <Reveal className={flip ? 'lg:order-2' : ''}>
                  <p
                    aria-hidden="true"
                    className="font-display text-metric font-extrabold tabular-nums text-signal/25 dark:text-signal/30"
                  >
                    {scene.index}
                  </p>
                  <h3
                    id={`scene-${scene.index}-title`}
                    className="mt-3 max-w-xl text-balance font-display text-display-md font-bold text-paper"
                  >
                    {scene.title}
                  </h3>
                  <p className="mt-5 max-w-xl text-base leading-relaxed text-paper-muted">
                    {scene.body}
                  </p>
                  <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                    {scene.facts.map((fact) => (
                      <li
                        key={fact}
                        className="flex items-center gap-2 text-sm font-medium text-paper-muted"
                      >
                        <span
                          aria-hidden="true"
                          className="h-1 w-4 rounded-full bg-signal"
                        />
                        {fact}
                      </li>
                    ))}
                  </ul>
                </Reveal>
                <ParallaxLayer
                  distance={32}
                  className={flip ? 'lg:order-1' : ''}
                  aria-hidden="true"
                >
                  {scene.visual}
                </ParallaxLayer>
              </li>
            );
          })}
        </ol>
      </ScrollRailContainer>
    </Section>
  );
}
