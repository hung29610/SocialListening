'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { MessageSquare, ThumbsUp, ThumbsDown, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
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

const COLORS = {
  Positive: '#10b981', // emerald-500
  Negative: '#ef4444', // red-500
  Neutral: '#64748b'   // slate-500
};

export default function DashboardPage() {
  const { t } = useLanguage();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      const res = await api.get('/api/echomind/analytics/summary');
      setAnalytics(res.data);
    } catch (error) {
      toast.error(t('echomind.dashboard.errors.analyticsLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading && !analytics) {
    return <div className="text-slate-400 p-8 text-center">{t('echomind.dashboard.loading')}</div>;
  }

  if (!analytics) return null;

  const StatCard = ({ title, value, icon: Icon, colorClass }: any) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
      </div>
      <div className={`p-4 rounded-xl ${colorClass} bg-opacity-10`}>
        <Icon size={24} className={colorClass.replace('bg-', 'text-')} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">{t('dashboard.title')}</h2>
        <p className="text-slate-400 mt-1">{t('echomind.dashboard.subtitle')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={t('dashboard.metrics.totalMentions')} value={analytics.total_mentions} icon={MessageSquare} colorClass="bg-blue-500 text-blue-500" />
        <StatCard title={t('echomind.dashboard.stats.positiveMentions')} value={analytics.positive_mentions} icon={ThumbsUp} colorClass="bg-emerald-500 text-emerald-500" />
        <StatCard title={t('echomind.dashboard.stats.negativeMentions')} value={analytics.negative_mentions} icon={ThumbsDown} colorClass="bg-red-500 text-red-500" />
        <StatCard title={t('echomind.dashboard.stats.avgSentiment')} value={analytics.avg_sentiment_score.toFixed(2)} icon={Activity} colorClass="bg-purple-500 text-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">{t('echomind.dashboard.charts.mentionVolume')}</h3>
          <div className="h-72">
            {analytics.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics.timeline}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#64748b' }} />
                  <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">{t('echomind.dashboard.charts.noTimelineData')}</div>
            )}
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">{t('dashboard.charts.sentimentBreakdown')}</h3>
          <div className="h-72">
            {analytics.total_mentions > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
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
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-500">{t('dashboard.charts.noSentimentData')}</div>
            )}
          </div>
          {analytics.total_mentions > 0 && (
            <div className="flex justify-center gap-4 mt-4">
              {analytics.sentiment_distribution.map(item => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: (COLORS as any)[item.name] }}></div>
                  <span className="text-sm text-slate-400">{item.name} ({item.value})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
