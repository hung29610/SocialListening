import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  chartColors,
  chartTooltipStyle,
  chartTooltipItemStyle,
  chartLegendStyle,
} from './chartTheme';

interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
  unknown?: number;
  total: number;
}

export default function SentimentDonutChart({ data, isLoading }: { data: SentimentData | null; isLoading: boolean }) {
  const { t } = useLanguage();

  if (isLoading) {
    return <div className="h-64 flex items-center justify-center text-paper-faint font-medium tracking-wide">{t('common.loading')}</div>;
  }

  if (!data || data.total === 0) {
    return <div className="h-64 flex items-center justify-center text-paper-faint font-medium tracking-wide">{t('dashboard.charts.noSentimentData')}</div>;
  }

  const chartData = [
    { name: t('mentions.sentiment.positive'), value: data.positive, color: chartColors.positive },
    { name: t('mentions.sentiment.neutral'), value: data.neutral, color: chartColors.neutral },
    { name: t('mentions.sentiment.negative'), value: data.negative, color: chartColors.negative },
    { name: t('crisis.sentiment.unanalyzed'), value: data.unknown || 0, color: chartColors.inkFaint },
  ].filter(item => item.value > 0);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value} mention${value > 1 ? 's' : ''}`, '']}
            contentStyle={chartTooltipStyle}
            itemStyle={chartTooltipItemStyle}
          />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={chartLegendStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
