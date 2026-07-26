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
  if (isLoading) {
    return <div className="h-72 flex items-center justify-center text-paper-faint font-medium">Đang tải biểu đồ...</div>;
  }

  if (!data || data.length === 0) {
    return <div className="h-72 flex items-center justify-center text-paper-faint font-medium">Chưa có dữ liệu xu hướng</div>;
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
          <Line type="monotone" name="Tổng Mentions" dataKey="total_mentions" stroke={chartColors.accent} strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: chartColors.accentBright }} />
          <Line type="monotone" name="Tiêu Cực" dataKey="negative_mentions" stroke={chartColors.negative} strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
          <Line type="monotone" name="Cảnh Báo" dataKey="alerts" stroke={chartColors.warning} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
          <Line type="monotone" name="Sự Cố" dataKey="incidents" stroke={chartColors.inkMuted} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
