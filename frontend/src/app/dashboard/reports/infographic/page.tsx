'use client';

import { useState, useEffect } from 'react';
import { Image as ImageIcon, RefreshCcw } from 'lucide-react';
import { reports } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  chartColors,
  chartGrid,
  chartAxisTick,
  chartTooltipStyle,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
  chartLegendStyle,
  ChartA11ySummary,
} from '@/components/dashboard/chartTheme';
import { InfographicExportNotice } from '@/components/reports/InfographicExportNotice';
import { ReportDataScopeNotice } from '@/components/reports/ReportDataScopeNotice';
import { ReportErrorState } from '@/components/reports/ReportErrorState';

export default function InfographicPage() {
  const { activeProject } = useProject();
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeProject]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const params: any = { date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() };
      if (activeProject) params.project_id = activeProject.id;

      const res = await reports.summaryData(params);
      setData(res);
    } catch (error: any) {
      const msg = error?.response?.data?.detail || error?.message || t('reports.failedToLoad');
      setFetchError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Image export is not implemented. The InfographicExportNotice component
  // replaces the previous button that called toast.error() internally.
  // The infographic renders live on SIGNAL tokens (they resolve at render
  // time, so any future canvas snapshot bakes in the active theme).

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-paper-muted font-medium flex items-center">
          <RefreshCcw className="w-5 h-5 mr-2 animate-spin text-signal dark:text-signal-bright" />
          {t('reports.loadingInfographic')}
        </div>
      </div>
    );
  }

  if (fetchError && !data) {
    return (
      <div className="max-w-5xl mx-auto">
        <ReportErrorState errorMessage={fetchError} onRetry={fetchData} />
      </div>
    );
  }

  const sentimentData = [
    { name: 'Tích cực', value: data?.metrics?.sentiment?.positive || 0, color: chartColors.positive },
    { name: 'Tiêu cực', value: data?.metrics?.sentiment?.negative || 0, color: chartColors.negative },
    { name: 'Trung lập', value: data?.metrics?.sentiment?.neutral || 0, color: chartColors.neutral },
  ].filter(item => item.value > 0);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-void-surface p-4 rounded-xl border border-edge">
        <div>
          <h1 className="text-xl font-bold text-paper flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-signal dark:text-signal-bright" />
            {t('reports.infographicTitle')}
          </h1>
        </div>
        <div>
          {/* InfographicExportNotice replaces the old misleading "Export Image" button */}
          <InfographicExportNotice />
        </div>
      </div>

      {/* Data Scope Notice */}
      <ReportDataScopeNotice
        projectName={activeProject?.name}
        dateRange="30d"
        dateRangeLabel={t('reports.infographicLast30Days')}
      />

      <div className="pb-8">
        <div id="infographic-content" className="w-full max-w-5xl mx-auto bg-void-surface rounded-3xl overflow-hidden border border-edge shadow-tile relative text-paper">

          {/* Header Banner */}
          <div className="bg-void-raised border-b border-edge px-4 py-8 sm:p-10 relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-signal/10 blur-3xl rounded-full"></div>
            <h2 className="text-3xl sm:text-5xl font-display font-black mb-4 relative z-10 tracking-tight text-paper">{t('reports.infographicBanner')}</h2>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 relative z-10">
              <span className="bg-void-surface px-4 py-1.5 rounded-full text-sm font-medium border border-edge text-paper-muted">
                {t('reports.infographicProject')}: {data?.project_name || activeProject?.name || t('reports.allProjects')}
              </span>
              <span className="bg-void-surface px-4 py-1.5 rounded-full text-sm font-medium border border-edge text-paper-muted">
                {t('reports.infographicLast30Days')}
              </span>
            </div>
          </div>

          <div className="p-4 sm:p-10 space-y-6 sm:space-y-10">

            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-void-raised border border-edge rounded-2xl p-6 text-center">
                <div className="text-eyebrow font-semibold uppercase text-paper-faint mb-2">{t('reports.totalMentions')}</div>
                <div className="text-3xl sm:text-4xl font-black tabular-nums text-signal dark:text-signal-bright break-words">{data?.metrics?.total_mentions?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-void-raised border border-edge rounded-2xl p-6 text-center">
                <div className="text-eyebrow font-semibold uppercase text-paper-faint mb-2">{t('reports.totalAlerts')}</div>
                <div className="text-3xl sm:text-4xl font-black tabular-nums text-warning break-words">{data?.metrics?.total_alerts?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-void-raised border border-edge rounded-2xl p-6 text-center">
                <div className="text-eyebrow font-semibold uppercase text-paper-faint mb-2">{t('reports.incidents')}</div>
                <div className="text-3xl sm:text-4xl font-black tabular-nums text-destructive break-words">{data?.metrics?.total_incidents?.toLocaleString() || 0}</div>
              </div>
              <div className="bg-void-raised border border-edge rounded-2xl p-6 text-center">
                <div className="text-eyebrow font-semibold uppercase text-paper-faint mb-2">{t('reports.positiveRatio')}</div>
                <div className="text-3xl sm:text-4xl font-black tabular-nums text-sentiment-positive break-words">
                  {data?.metrics?.total_mentions > 0
                    ? Math.round((data?.metrics?.sentiment?.positive || 0) / data?.metrics?.total_mentions * 100)
                    : 0}%
                </div>
              </div>
            </div>

            {/* Volume Chart */}
            {data?.trend && data.trend.length > 0 && (
              <div className="bg-void-raised border border-edge rounded-3xl p-4 sm:p-8">
                <h3 className="text-lg font-bold uppercase tracking-widest text-paper mb-6">{t('reports.volumeOfMentions')}</h3>
                <div className="h-72" role="img" aria-labelledby="infographic-volume-summary">
                  <ChartA11ySummary id="infographic-volume-summary">Infographic volume chart showing mentions across {data.trend.length} dates.</ChartA11ySummary>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.trend}>
                      <defs>
                        <linearGradient id="colorMentions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={chartColors.accent} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={chartColors.accent} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...chartGrid} vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke={chartGrid.stroke}
                        tickFormatter={formatDate}
                        tick={chartAxisTick}
                        tickMargin={10}
                      />
                      <YAxis stroke={chartGrid.stroke} tick={chartAxisTick} />
                      <RechartsTooltip
                        contentStyle={chartTooltipStyle}
                        itemStyle={chartTooltipItemStyle}
                        labelStyle={chartTooltipLabelStyle}
                      />
                      <Area
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="mentions"
                        stroke={chartColors.accent}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorMentions)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
              {/* Sentiment Pie */}
              <div className="bg-void-raised border border-edge rounded-3xl p-4 sm:p-8 flex flex-col">
                <h3 className="text-lg font-bold uppercase tracking-widest text-paper mb-6 text-center">{t('reports.sentimentBreakdown')}</h3>
                <div className="flex-1 min-h-[300px]" role="img" aria-labelledby="infographic-sentiment-summary">
                  <ChartA11ySummary id="infographic-sentiment-summary">Infographic sentiment breakdown chart showing analyzed sentiment categories.</ChartA11ySummary>
                  {sentimentData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          isAnimationActive={false}
                          data={sentimentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {sentimentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={chartTooltipStyle}
                          itemStyle={chartTooltipItemStyle}
                          labelStyle={chartTooltipLabelStyle}
                        />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={chartLegendStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-paper-faint italic">{t('reports.noSentimentData')}</div>
                  )}
                </div>
              </div>

              {/* Sources Bar Chart */}
              <div className="bg-void-raised border border-edge rounded-3xl p-4 sm:p-8 flex flex-col">
                <h3 className="text-lg font-bold uppercase tracking-widest text-paper mb-6 text-center">{t('reports.topSources')}</h3>
                <div className="flex-1 min-h-[300px]" role="img" aria-labelledby="infographic-sources-summary">
                  <ChartA11ySummary id="infographic-sources-summary">Infographic source chart showing mention counts by source.</ChartA11ySummary>
                  {data?.top_sources && data.top_sources.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={Array.isArray(data?.top_sources) ? data.top_sources.slice(0, 5) : []} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                        <CartesianGrid {...chartGrid} horizontal={true} vertical={false} />
                        <XAxis type="number" stroke={chartGrid.stroke} tick={chartAxisTick} />
                        <YAxis dataKey="name" type="category" stroke={chartGrid.stroke} width={80} tick={chartAxisTick} />
                        <RechartsTooltip
                          cursor={{ fill: chartGrid.stroke }}
                          contentStyle={chartTooltipStyle}
                          itemStyle={chartTooltipItemStyle}
                          labelStyle={chartTooltipLabelStyle}
                        />
                        <Bar isAnimationActive={false} dataKey="count" fill={chartColors.accent} radius={[0, 4, 4, 0]}>
                          {Array.isArray(data?.top_sources) && data.top_sources.slice(0, 5).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? chartColors.accent : chartColors.inkMuted} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-paper-faint italic">{t('reports.noSourceChartData')}</div>
                  )}
                </div>
              </div>
            </div>

          </div>

          <div className="py-6 mt-10 border-t border-edge text-center bg-void-raised">
            <div className="text-[10px] font-bold text-paper-faint uppercase tracking-eyebrow mb-1">{t('reports.poweredBy')}</div>
            <div className="font-black tracking-widest text-sm text-signal dark:text-signal-bright">NOPE360 INTELLIGENCE</div>
          </div>

        </div>
      </div>
    </div>
  );
}
