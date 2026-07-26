import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
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
    return <div className="h-64 flex items-center justify-center text-gray-500 font-medium tracking-wide">{t('common.loading')}</div>;
  }

  if (!data || data.total === 0) {
    return <div className="h-64 flex items-center justify-center text-gray-500 font-medium tracking-wide">{t('dashboard.charts.noSentimentData')}</div>;
  }

  const chartData = [
    { name: t('mentions.sentiment.positive'), value: data.positive, color: '#10B981' }, // emerald-500
    { name: t('mentions.sentiment.neutral'), value: data.neutral, color: '#9CA3AF' }, // gray-400
    { name: t('mentions.sentiment.negative'), value: data.negative, color: '#F43F5E' }, // rose-500
    { name: t('crisis.sentiment.unanalyzed'), value: data.unknown || 0, color: '#4B5563' }, // gray-600
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
            contentStyle={{ 
              borderRadius: '12px', 
              border: '1px solid #374151', 
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
              backgroundColor: '#1E293B',
              color: '#F3F4F6'
            }}
            itemStyle={{ color: '#E5E7EB' }}
          />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ color: '#9CA3AF' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
