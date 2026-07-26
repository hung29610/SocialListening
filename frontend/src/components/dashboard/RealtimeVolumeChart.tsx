'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  chartColors,
  chartGrid,
  chartAxisTick,
  chartTooltipStyle,
  chartTooltipItemStyle,
} from './chartTheme';

type VolumePoint = {
  time: string;
  mentions: number;
};

export default function RealtimeVolumeChart({
  data,
  isLoading,
}: {
  data: VolumePoint[];
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
        {t('crisis.charts.noVolumeData')}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray={chartGrid.strokeDasharray} stroke={chartGrid.stroke} />
        <XAxis dataKey="label" tick={{ ...chartAxisTick, fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ ...chartAxisTick, fontSize: 10 }} allowDecimals={false} />
        <Tooltip
          contentStyle={chartTooltipStyle}
          itemStyle={chartTooltipItemStyle}
        />
        <Line
          type="monotone"
          dataKey="mentions"
          name="Mentions"
          stroke={chartColors.accent}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: chartColors.accentBright }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
