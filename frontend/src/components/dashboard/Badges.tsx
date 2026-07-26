import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Dashboard status badges on the SIGNAL tokens (Epic SIGNAL, ADR 0002).
 *
 * Sentiment pills live in `@/components/ui/SentimentBadge` — the legacy
 * SentimentBadge that used to live here was migrated there (W-D ticket,
 * see src/styles/README.md migration note).
 *
 * Severity/risk ladders use semantic status tokens (destructive/warning)
 * plus the neutral paper scale — never the signal accent (one-accent rule).
 */

const badgeBase =
  'px-2.5 py-0.5 rounded-full text-xs font-medium border tracking-wide';

export function SeverityBadge({ severity }: { severity: string }) {
  const { t } = useLanguage();
  const colors: Record<string, string> = {
    critical: 'bg-destructive/10 text-destructive border-destructive/25',
    high: 'bg-warning/10 text-warning border-warning/25',
    medium: 'bg-warning/[0.06] text-warning border-warning/20',
    low: 'bg-sentiment-neutral/10 text-sentiment-neutral border-sentiment-neutral/25',
  };
  const bgClass = colors[severity?.toLowerCase()] || 'bg-void-raised text-paper-muted border-edge';

  return (
    <span className={`${badgeBase} ${bgClass}`}>
      {severity ? severity.toUpperCase() : t('crisis.badges.severityUnknown')}
    </span>
  );
}

export function RiskBadge({ score }: { score: number | null | undefined }) {
  const { t } = useLanguage();
  if (score === null || score === undefined) return null;

  let color = 'bg-sentiment-neutral/10 text-sentiment-neutral border-sentiment-neutral/25';
  if (score >= 80) color = 'bg-destructive/10 text-destructive border-destructive/25';
  else if (score >= 60) color = 'bg-warning/10 text-warning border-warning/25';
  else if (score >= 40) color = 'bg-warning/[0.06] text-warning border-warning/20';

  return (
    <span className={`${badgeBase} ${color} tabular-nums`}>
      {t('crisis.riskWithScore', { score })}
    </span>
  );
}

export function CrisisLevelBadge({ level }: { level: number | null | undefined }) {
  const { t } = useLanguage();
  if (!level) return null;
  return (
    <span className={`${badgeBase} bg-destructive/10 text-destructive border-destructive/25 tabular-nums`}>
      {t('crisis.badges.crisisLevel', { level })}
    </span>
  );
}

export function SidebarBadge({ count }: { count: number }) {
  if (!count || count <= 0) return null;

  return (
    <span className="inline-flex items-center justify-center px-2 py-1 text-[10px] font-bold leading-none tabular-nums text-destructive-foreground bg-destructive rounded-full ml-auto tracking-wide">
      {count > 99 ? '99+' : count}
    </span>
  );
}
