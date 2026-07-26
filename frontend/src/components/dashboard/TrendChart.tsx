import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  chartColors,
  chartGrid,
  chartAxisTick,
  chartTooltipStyle,
  chartTooltipItemStyle,
  chartLegendStyle,
} from './chartTheme';

interface TrendChartProps {
  data: any[];
  isLoading: boolean;
}

export default function TrendChart({ data, isLoading }: TrendChartProps) {
  const { t } = useLanguage();

  if (isLoading) {
    return <div className="h-72 flex items-center justify-center text-paper-faint font-medium">{t('crisis.charts.loadingChart')}</div>;
  }

  if (!data || data.length === 0) {
    return <div className="h-72 flex items-center justify-center text-paper-faint font-medium">{t('crisis.charts.noTrendData')}</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray={chartGrid.strokeDasharray} vertical={false} stroke={chartGrid.stroke} />
          <XAxis
            dataKey="date"
            tick={chartAxisTick}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => {
              // Format if it's a date string like YYYY-MM-DD
              if (typeof value === 'string' && value.includes('-')) {
                const parts = value.split('-');
                if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
              }
              return value;
            }}
          />
          <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={chartTooltipStyle}
            itemStyle={chartTooltipItemStyle}
          />
          <Legend wrapperStyle={{ paddingTop: '20px', ...chartLegendStyle }} />

          {/* Accent = the one primary/total series; sentiment + status tokens for the rest */}
          <Line type="monotone" name={t('dashboard.metrics.totalMentions')} dataKey="total_mentions" stroke={chartColors.accent} strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: chartColors.accentBright }} />
          <Line type="monotone" name={t('mentions.sentiment.negative')} dataKey="negative_mentions" stroke={chartColors.negative} strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
          <Line type="monotone" name={t('crisis.charts.alerts')} dataKey="alerts" stroke={chartColors.warning} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
          <Line type="monotone" name={t('crisis.charts.incidents')} dataKey="incidents" stroke={chartColors.inkMuted} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
