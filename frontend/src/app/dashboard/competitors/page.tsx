'use client';

import { useState, useEffect } from 'react';
import { BarChart as BarChartIcon, TrendingUp, Search, RefreshCcw } from 'lucide-react';
import { competitors } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell
} from 'recharts';
import {
  chartColors,
  chartGrid,
  chartAxisTick,
  chartTooltipStyle,
  chartTooltipItemStyle,
  chartLegendStyle,
} from '@/components/dashboard/chartTheme';
import { useLanguage } from '@/contexts/LanguageContext';

export default function CompetitorsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await competitors.summary();
      setData(res);
    } catch (error) {
      toast.error('Lỗi tải dữ liệu đối thủ');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-paper-muted font-medium tracking-wide flex items-center">
          <RefreshCcw className="w-5 h-5 mr-2 animate-spin motion-reduce:animate-none text-signal dark:text-signal-bright" />
          Đang phân tích dữ liệu đối thủ...
        </div>
      </div>
    );
  }

  if (data && !data.has_competitors) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="w-24 h-24 bg-void-raised rounded-full flex items-center justify-center mb-6">
          <BarChartIcon className="w-12 h-12 text-paper-faint" />
        </div>
        <h2 className="text-2xl font-bold text-paper tracking-wide mb-2">Chưa cấu hình Từ Khóa Đối Thủ</h2>
        <p className="text-paper-muted max-w-md">
          Bạn cần thêm các từ khóa có loại là "Competitor" trong phần Quản lý Từ khóa để hệ thống có thể so sánh Share of Voice.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-paper tracking-wide">Phân Tích Đối Thủ</h1>
          <p className="text-sm text-paper-muted mt-1">So sánh thị phần thảo luận (Share of Voice) và cảm xúc.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Share of Voice Chart */}
        <div className="bg-void-surface border border-edge rounded-2xl p-6">
          <h3 className="text-lg font-bold text-paper mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-signal dark:text-signal-bright" />
            Share of Voice (Thị phần thảo luận)
          </h3>
          <div className="h-80" role="img" aria-labelledby="competitor-share-chart-summary">
            <p id="competitor-share-chart-summary" className="sr-only">
              {t('a11y.competitorShare')}
            </p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.data || []}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid {...chartGrid} vertical={false} />
                <XAxis dataKey="name" stroke={chartGrid.stroke} tick={chartAxisTick} />
                <YAxis stroke={chartGrid.stroke} tick={chartAxisTick} tickFormatter={(val) => `${val}%`} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  itemStyle={chartTooltipItemStyle}
                  formatter={(value: number) => [`${value}%`, 'Share of Voice']}
                />
                <Bar isAnimationActive={false}
                  dataKey="share_of_voice"
                  radius={[6, 6, 0, 0]}
                >
                  {
                    (data?.data || []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.is_brand ? chartColors.accent : chartColors.inkFaint} />
                    ))
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Comparison */}
        <div className="bg-void-surface border border-edge rounded-2xl p-6">
          <h3 className="text-lg font-bold text-paper mb-6 flex items-center">
            <BarChartIcon className="w-5 h-5 mr-2 text-paper-faint" />
            Cảm xúc (Sentiment)
          </h3>
          <div className="h-80" role="img" aria-labelledby="competitor-sentiment-chart-summary">
            <p id="competitor-sentiment-chart-summary" className="sr-only">
              {t('a11y.competitorSentiment')}
            </p>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={data?.data || []}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid {...chartGrid} horizontal={false} />
                <XAxis type="number" stroke={chartGrid.stroke} tick={chartAxisTick} />
                <YAxis dataKey="name" type="category" stroke={chartGrid.stroke} tick={chartAxisTick} width={120} />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Legend wrapperStyle={chartLegendStyle} />
                <Bar isAnimationActive={false} dataKey="sentiment.positive" name="Tích cực" stackId="a" fill={chartColors.positive} radius={[0, 0, 0, 0]} />
                <Bar isAnimationActive={false} dataKey="sentiment.neutral" name="Trung lập" stackId="a" fill={chartColors.neutral} />
                <Bar isAnimationActive={false} dataKey="sentiment.negative" name="Tiêu cực" stackId="a" fill={chartColors.negative} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Raw Data Table */}
      <div className="bg-void-surface border border-edge rounded-2xl overflow-hidden mt-8">
        <div className="px-6 py-4 border-b border-edge">
          <h3 className="text-lg font-bold text-paper">Bảng dữ liệu chi tiết</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-void-raised text-eyebrow font-semibold uppercase text-paper-faint border-b border-edge">
                <th scope="col" className="px-6 py-4">Thương hiệu</th>
                <th scope="col" className="px-6 py-4">Share of Voice</th>
                <th scope="col" className="px-6 py-4">Tổng Lượng Mentions</th>
                <th scope="col" className="px-6 py-4">Tích cực</th>
                <th scope="col" className="px-6 py-4">Tiêu cực</th>
              </tr>
            </thead>
            <tbody>
              {(data?.data || []).map((row: any, i: number) => (
                <tr key={i} className="border-b border-edge hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-3 ${row.is_brand ? 'bg-signal' : 'bg-paper-faint'}`}></div>
                      <span className={`font-semibold ${row.is_brand ? 'text-signal dark:text-signal-bright' : 'text-paper-muted'}`}>{row.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-paper tabular-nums">{row.share_of_voice}%</td>
                  <td className="px-6 py-4 text-paper-muted tabular-nums">{row.volume.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sentiment-positive font-medium tabular-nums">{row.sentiment.positive.toLocaleString()}</td>
                  <td className="px-6 py-4 text-sentiment-negative font-medium tabular-nums">{row.sentiment.negative.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
