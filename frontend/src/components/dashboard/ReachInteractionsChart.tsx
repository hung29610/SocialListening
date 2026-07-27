'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  chartColors,
  chartGrid,
  chartAxisTick,
  chartTooltipStyle,
  chartTooltipItemStyle,
  chartLegendStyle,
  ChartA11ySummary,
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
        Chưa có dữ liệu reach / tương tác
      </div>
    );
  }

  return (
    <div role="img" aria-labelledby="reach-interactions-chart-summary">
      <ChartA11ySummary id="reach-interactions-chart-summary">
        Bar chart comparing reach and interactions across {chartData.length} time points.
      </ChartA11ySummary>
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
        <Bar dataKey="reach" name="Reach" fill={chartColors.accent} radius={[4, 4, 0, 0]} />
        <Bar dataKey="interactions" name="Tương tác" fill={chartColors.inkMuted} radius={[4, 4, 0, 0]} />
      </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
