import React from 'react';

/**
 * SentimentBadge — sentiment pill on the first-class sentiment tokens
 * (Epic SIGNAL, ADR 0002).
 *
 * Accepts sentiment exactly as the codebase represents it: a lowercase
 * string (`'positive' | 'negative' | 'neutral'`, sometimes prefixed
 * variants like `negative_*`) that may be `null`/`undefined` when a
 * mention has not been analyzed yet (see src/app/dashboard/mentions,
 * src/components/dashboard/SentimentTag.tsx). Unknown non-null values
 * fall back to neutral styling, matching existing behavior.
 */

export type SentimentValue = 'positive' | 'negative' | 'neutral';

interface SentimentBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Raw sentiment value as stored on mentions (string | null). */
  sentiment: string | null | undefined;
  /** Override the default (Vietnamese) label. */
  label?: React.ReactNode;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export function normalizeSentiment(raw: string | null | undefined): SentimentValue | null {
  if (!raw) return null;
  const value = raw.toLowerCase();
  if (value.startsWith('positive')) return 'positive';
  if (value.startsWith('negative')) return 'negative';
  if (value.startsWith('neutral')) return 'neutral';
  return null;
}

const configs: Record<SentimentValue, { badge: string; dot: string; label: string }> = {
  positive: {
    badge: 'bg-sentiment-positive/10 text-sentiment-positive border-sentiment-positive/25',
    dot: 'bg-sentiment-positive',
    label: 'Tích cực',
  },
  negative: {
    badge: 'bg-sentiment-negative/10 text-sentiment-negative border-sentiment-negative/25',
    dot: 'bg-sentiment-negative',
    label: 'Tiêu cực',
  },
  neutral: {
    badge: 'bg-sentiment-neutral/10 text-sentiment-neutral border-sentiment-neutral/25',
    dot: 'bg-sentiment-neutral',
    label: 'Trung lập',
  },
};

const pending = {
  badge: 'bg-paper-faint/10 text-paper-faint border-paper-faint/25',
  dot: 'bg-paper-faint',
  label: 'Chưa phân tích',
};

export const SentimentBadge: React.FC<SentimentBadgeProps> = ({
  sentiment,
  label,
  size = 'md',
  showDot = true,
  className = '',
  ...props
}) => {
  const normalized = normalizeSentiment(sentiment);
  const fallback = sentiment ? configs.neutral : pending;
  const current = normalized ? configs[normalized] : fallback;

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
  const dotSize = size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2';

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold uppercase tracking-wider ${current.badge} ${sizeClasses} ${className}`.trim()}
      {...props}
    >
      {showDot && <span className={`shrink-0 rounded-full ${dotSize} ${current.dot}`} />}
      {label ?? current.label}
    </span>
  );
};
