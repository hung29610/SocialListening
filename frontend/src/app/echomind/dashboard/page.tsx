'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { MessageSquare, ThumbsUp, ThumbsDown, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { chartColors, chartGrid, chartAxisTick, chartTooltipStyle, chartTooltipItemStyle, ChartA11ySummary } from '@/components/dashboard/chartTheme';
import { useLanguage } from '@/contexts/LanguageContext';

interface TimelineItem {
  time: string;
  count: number;
}

interface SentimentItem {
  name: string;
  value: number;
}

interface Analytics {
  total_mentions: number;
  positive_mentions: number;
  negative_mentions: number;
  neutral_mentions: number;
  avg_sentiment_score: number;
  timeline: TimelineItem[];
  sentiment_distribution: SentimentItem[];
}

const COLORS = { Positive: chartColors.positive, Negative: chartColors.negative, Neutral: chartColors.neutral };

export default function DashboardPage() {
  const { t } = useLanguage();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get('/api/echomind/analytics/summary');
      setAnalytics(res.data);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading && !analytics) {
    return <div className="text-paper-muted p-8 text-center">Loading dashboard...</div>;
  }

  if (!analytics) return null;

  const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
    <div className="bg-void-surface border border-edge rounded-xl p-6 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-paper-muted mb-1">{title}</p>
        <p className="text-3xl font-bold text-paper">{value}</p>
      </div>
      <div className={`p-4 rounded-xl ${colorClass} bg-opacity-10`}>
        <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-paper">Dashboard</h2>
        <p className="text-paper-muted mt-1">Overview of your brand&apos;s social listening performance.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Mentions" value={analytics.total_mentions} icon={MessageSquare} colorClass="bg-signal text-signal" />
        <StatCard title="Positive Mentions" value={analytics.positive_mentions} icon={ThumbsUp} colorClass="bg-sentiment-positive text-sentiment-positive" />
        <StatCard title="Negative Mentions" value={analytics.negative_mentions} icon={ThumbsDown} colorClass="bg-sentiment-negative text-sentiment-negative" />
        <StatCard title="Avg Sentiment" value={analytics.avg_sentiment_score.toFixed(2)} icon={Activity} colorClass="bg-signal text-signal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart */}
        <div className="lg:col-span-2 bg-void-surface border border-edge rounded-xl p-6">
          <h3 className="text-lg font-semibold text-paper mb-6">Mention Volume Over Time</h3>
          <div className="h-72" role="img" aria-labelledby="echomind-volume-summary">
            <ChartA11ySummary id="echomind-volume-summary">{t('a11y.echomindVolume', { count: analytics.timeline.length })}</ChartA11ySummary>
            {analytics.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.timeline}>
                  <CartesianGrid {...chartGrid} />
                  <XAxis dataKey="time" tick={chartAxisTick} />
                  <YAxis tick={chartAxisTick} />
                  <RechartsTooltip 
                    contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Line isAnimationActive={false} type="monotone" dataKey="count" stroke={chartColors.accent} strokeWidth={3} dot={{ fill: chartColors.accent, r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-paper-faint">No timeline data available</div>
            )}
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-void-surface border border-edge rounded-xl p-6">
          <h3 className="text-lg font-semibold text-paper mb-6">Sentiment Distribution</h3>
          <div className="h-72" role="img" aria-labelledby="echomind-sentiment-summary">
            <ChartA11ySummary id="echomind-sentiment-summary">{t('a11y.echomindSentiment')}</ChartA11ySummary>
            {analytics.total_mentions > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    isAnimationActive={false}
                    data={analytics.sentiment_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {analytics.sentiment_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={(COLORS as any)[entry.name]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-paper-faint">No sentiment data available</div>
            )}
          </div>
          {analytics.total_mentions > 0 && (
            <div className="flex justify-center gap-4 mt-4">
              {analytics.sentiment_distribution.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (COLORS as any)[item.name] }}></div>
                  <span className="text-sm text-paper-muted">{item.name} ({item.value})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
