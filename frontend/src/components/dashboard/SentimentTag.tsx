'use client';

import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SentimentTagProps {
  sentiment: string | null;
  size?: 'sm' | 'md';
}

/**
 * SentimentTag — Color-coded sentiment pill
 * Nhãn cảm xúc với màu sắc:
 * - Tích cực (positive): Green
 * - Tiêu cực (negative_*): Red
 * - Trung lập (neutral): Gray
 */

const SENTIMENT_CONFIG: Record<string, { bg: string; text: string; labelKey: string; dot: string }> = {
  positive: {
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    labelKey: 'mentions.sentiment.positive',
    dot: 'bg-emerald-500',
  },
  neutral: {
    bg: 'bg-gray-500/10 border-gray-500/20',
    text: 'text-gray-600 dark:text-slate-500 dark:text-gray-400',
    labelKey: 'mentions.sentiment.neutral',
    dot: 'bg-gray-400',
  },
  negative: {
    bg: 'bg-red-500/10 border-red-500/20',
    text: 'text-red-600 dark:text-red-400',
    labelKey: 'mentions.sentiment.negative',
    dot: 'bg-red-500',
  },
};

export default function SentimentTag({ sentiment, size = 'sm' }: SentimentTagProps) {
  const { t } = useLanguage();

  if (!sentiment) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-gray-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 rounded-full border border-gray-200 dark:border-slate-300 dark:border-gray-700">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        {t('crisis.sentiment.unanalyzed')}
      </span>
    );
  }

  const config = SENTIMENT_CONFIG[sentiment] || SENTIMENT_CONFIG.neutral;

  const sizeClasses = size === 'md'
    ? 'px-3 py-1 text-xs'
    : 'px-2 py-0.5 text-[11px]';

  return (
    <span
      className={`
        inline-flex items-center gap-1.5
        ${sizeClasses}
        ${config.bg} ${config.text}
        border rounded-full font-medium
        whitespace-nowrap
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {t(config.labelKey)}
    </span>
  );
}
