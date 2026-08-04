'use client';

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  chartColors,
  chartGrid,
  chartAxisTick,
  chartTooltipStyle,
  chartTooltipItemStyle,
  ChartA11ySummary,
} from './chartTheme';
import { useLanguage } from '@/contexts/LanguageContext';

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
        Đang tải...
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
        Chưa có dữ liệu volume
      </div>
    );
  }

  return (
    <div role="img" aria-labelledby="realtime-volume-chart-summary">
      <ChartA11ySummary id="realtime-volume-chart-summary">
        {t('a11y.realtimeVolume', { count: chartData.length })}
      </ChartA11ySummary>
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
          isAnimationActive={false}
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
    </div>
  );
}
