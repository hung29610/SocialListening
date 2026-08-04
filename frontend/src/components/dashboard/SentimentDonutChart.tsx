import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import {
  chartColors,
  chartTooltipStyle,
  chartTooltipItemStyle,
  chartLegendStyle,
  ChartA11ySummary,
} from './chartTheme';
import { useLanguage } from '@/contexts/LanguageContext';

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
    return <div className="h-64 flex items-center justify-center text-paper-faint font-medium tracking-wide">Đang tải...</div>;
  }

  if (!data || data.total === 0) {
    return <div className="h-64 flex items-center justify-center text-paper-faint font-medium tracking-wide">Chưa có dữ liệu sắc thái</div>;
  }

  const chartData = [
    { name: 'Tích cực', value: data.positive, color: chartColors.positive },
    { name: 'Trung lập', value: data.neutral, color: chartColors.neutral },
    { name: 'Tiêu cực', value: data.negative, color: chartColors.negative },
    { name: 'Chưa phân tích', value: data.unknown || 0, color: chartColors.inkFaint },
  ].filter(item => item.value > 0);

  return (
    <div className="h-64 w-full" role="img" aria-labelledby="sentiment-donut-chart-summary">
      <ChartA11ySummary id="sentiment-donut-chart-summary">
        {t('a11y.sentimentDonut', { positive: data.positive, neutral: data.neutral, negative: data.negative, unknown: data.unknown || 0 })}
      </ChartA11ySummary>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            isAnimationActive={false}
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
