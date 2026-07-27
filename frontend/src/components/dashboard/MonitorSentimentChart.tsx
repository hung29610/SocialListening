'use client';

import React from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { chartColors, ChartA11ySummary } from './chartTheme';

interface SentimentBreakdown {
  positive_count: number;
  negative_count: number;
  neutral_count: number;
  positive_pct: number;
  negative_pct: number;
  neutral_pct: number;
}

interface MonitorSentimentChartProps {
  data: SentimentBreakdown | null;
  isLoading: boolean;
}

/**
 * MonitorSentimentChart — Enhanced donut chart with center label
 * Biểu đồ tròn sentiment với nhãn trung tâm hiển thị tổng số.
 *
 * Colors come from the SIGNAL chart theme (`./chartTheme`):
 * - Tích cực: chartColors.positive
 * - Trung lập: chartColors.neutral
 * - Tiêu cực: chartColors.negative
 */
export default function MonitorSentimentChart({
  data,
  isLoading,
}: MonitorSentimentChartProps) {
  const reducedMotion = useReducedMotion();
  if (isLoading) {
    return (
      <div className="h-72 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-signal/30 border-t-signal rounded-full animate-spin motion-reduce:animate-none" />
      </div>
    );
  }

  if (!data || (data.positive_count + data.negative_count + data.neutral_count) === 0) {
    return (
      <div className="h-72 flex flex-col items-center justify-center text-paper-faint">
        <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
        <p className="text-sm">Chưa có dữ liệu sắc thái</p>
      </div>
    );
  }

  const total = data.positive_count + data.negative_count + data.neutral_count;

  const chartData = [
    { name: 'Tích cực', value: data.positive_count, color: chartColors.positive, pct: data.positive_pct },
    { name: 'Trung lập', value: data.neutral_count, color: chartColors.neutral, pct: data.neutral_pct },
    { name: 'Tiêu cực', value: data.negative_count, color: chartColors.negative, pct: data.negative_pct },
  ].filter((item) => item.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0].payload;
      return (
        <div className="bg-void-surface text-paper px-4 py-2.5 rounded-xl shadow-tile border border-edge-strong text-sm">
          <p className="font-semibold">{entry.name}</p>
          <p className="text-paper-muted">
            {entry.value} đề cập ({entry.pct}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({
    cx,
    cy,
  }: any) => {
    return (
      <g>
        <text
          x={cx}
          y={cy - 8}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-paper text-2xl font-bold"
          style={{ fontSize: '24px', fontWeight: 700 }}
        >
          {total.toLocaleString('vi-VN')}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-paper-faint text-xs"
          style={{ fontSize: '11px' }}
        >
          đề cập
        </text>
      </g>
    );
  };

  return (
    <div className="h-72 w-full" role="img" aria-labelledby="monitor-sentiment-chart-summary">
      <ChartA11ySummary id="monitor-sentiment-chart-summary">
        Sentiment chart showing {data.positive_count} positive, {data.neutral_count} neutral, and {data.negative_count} negative mentions.
      </ChartA11ySummary>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
            animationBegin={0}
            animationDuration={180}
            isAnimationActive={!reducedMotion}
            animationEasing="ease-out"
            label={false}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                className="hover:opacity-80 transition-opacity duration-200 motion-reduce:transition-none cursor-pointer"
              />
            ))}
          </Pie>
          {/* Center label */}
          <Pie
            data={[{ value: 1 }]}
            cx="50%"
            cy="50%"
            innerRadius={0}
            outerRadius={0}
            dataKey="value"
            label={renderCustomLabel}
            isAnimationActive={false}
          >
            <Cell fill="transparent" />
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            iconSize={10}
            formatter={(value: string) => (
              <span className="text-sm text-paper-muted">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
