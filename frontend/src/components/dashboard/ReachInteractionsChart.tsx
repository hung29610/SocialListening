'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
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

type Point = {
  time: string;
  reach: number;
  interactions: number;
};

export default function ReachInteractionsChart({
  data,
  isLoading,
}: {
  data: Point[];
  isLoading?: boolean;
}) {
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="h-[220px] flex items-center justify-center text-paper-faint text-sm">
        {t('common.loading')}
      </div>
    );
  }

  const chartData = (data || []).map((d) => ({
    ...d,
    label: new Date(d.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  }));

  if (!chartData.length) {
    return (
      <div className="h-[220px] flex items-center justify-center text-paper-faint text-sm">
        {t('crisis.charts.noReachData')}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray={chartGrid.strokeDasharray} stroke={chartGrid.stroke} />
        <XAxis dataKey="label" tick={{ ...chartAxisTick, fontSize: 10 }} />
        <YAxis tick={{ ...chartAxisTick, fontSize: 10 }} />
        <Tooltip
          contentStyle={chartTooltipStyle}
          itemStyle={chartTooltipItemStyle}
        />
        <Legend wrapperStyle={chartLegendStyle} />
        <Bar dataKey="reach" name={t('dashboard.metrics.reach')} fill={chartColors.accent} radius={[4, 4, 0, 0]} />
        <Bar dataKey="interactions" name={t('dashboard.metrics.interactions')} fill={chartColors.inkMuted} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
