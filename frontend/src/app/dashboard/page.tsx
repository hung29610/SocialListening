'use client';

import { useEffect, useState } from 'react';
import { Activity, RefreshCcw } from 'lucide-react';
import { dashboard, auth } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { withTimeout } from '@/lib/utils/timeout';

import RealtimeStatsSection from '@/components/dashboard/RealtimeStatsSection';
import DashboardMetricGrid from '@/components/dashboard/DashboardMetricGrid';
import MentionTrendCard from '@/components/dashboard/MentionTrendCard';
import SentimentOverviewCard from '@/components/dashboard/SentimentOverviewCard';
import HotKeywordsCard from '@/components/dashboard/HotKeywordsCard';
import RecentMentionsPanel from '@/components/dashboard/RecentMentionsPanel';
import RiskAlertsPanel from '@/components/dashboard/RiskAlertsPanel';

import { useLanguage } from '@/contexts/LanguageContext';
import { useProject } from '@/contexts/ProjectContext';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function DashboardPage() {
  const { t } = useLanguage();
  const { activeProject, projects } = useProject();
  const [metrics, setMetrics] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [sentiment, setSentiment] = useState<any>(null);
  const [hotKeywords, setHotKeywords] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('');

  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    const cacheKey = `dash_data_${activeProject?.id || 'all'}_${timeRange}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.metrics) setMetrics(parsed.metrics);
        if (parsed.trends) setTrends(parsed.trends);
        if (parsed.sentiment) setSentiment(parsed.sentiment);
        if (parsed.hotKeywords) setHotKeywords(parsed.hotKeywords);
        setLoadingMetrics(false);
        setLoadingCharts(false);
      } catch {}
    }

    fetchUserRole();
    fetchDashboardData(cacheKey);
  }, [activeProject?.id, timeRange]);

  const fetchUserRole = async () => {
    try {
      const user = await withTimeout(auth.getCurrentUser(), 5000);
      if (user && user.role) {
        setUserRole(user.role);
      }
    } catch {}
  };

  const fetchDashboardData = async (cacheKey?: string) => {
    if (!activeProject) {
      setLoadingMetrics(false);
      setLoadingCharts(false);
      return;
    }

    try {
      if (!metrics) setLoadingMetrics(true);
      if (!trends) setLoadingCharts(true);

      const [summaryRes, trendsRes, sentimentRes, keywordsRes] = await Promise.allSettled([
        withTimeout(dashboard.summary(timeRange, activeProject.id), 15000),
        withTimeout(dashboard.trends(timeRange, activeProject.id), 15000),
        withTimeout(dashboard.sentimentSummary(timeRange, activeProject.id), 15000),
        withTimeout(dashboard.hotKeywords(timeRange === '30d' ? '7d' : 'today', activeProject.id), 15000),
      ]);

      const newData: any = {};

      if (summaryRes.status === 'fulfilled') {
        setMetrics(summaryRes.value);
        newData.metrics = summaryRes.value;
      } else {
        const err = summaryRes.reason;
        const statusCode = err?.response?.status || 'Unknown';
        const safeMsg = err?.message || String(err);
        console.error(`[Dashboard] Failed to load summary. Endpoint: /api/dashboard/summary. Status: ${statusCode}. Error: ${safeMsg}`);
        toast.error(t('dashboard.errors.summaryLoadFailed'));
      }

      if (trendsRes.status === 'fulfilled') {
        setTrends(trendsRes.value);
        newData.trends = trendsRes.value;
      }
      if (sentimentRes.status === 'fulfilled') {
        setSentiment(sentimentRes.value);
        newData.sentiment = sentimentRes.value;
      }
      if (keywordsRes.status === 'fulfilled') {
        setHotKeywords(keywordsRes.value);
        newData.hotKeywords = keywordsRes.value;
      }

      const key = cacheKey || `dash_data_${activeProject?.id || 'all'}_${timeRange}`;
      localStorage.setItem(key, JSON.stringify(newData));
    } catch (error: any) {
      console.error('[Dashboard] Failed to load dashboard data', error);
      toast.error(t('dashboard.errors.dashboardLoadFailed'));
    } finally {
      setLoadingMetrics(false);
      setLoadingCharts(false);
    }
  };

  const handleRefresh = () => {
    const cacheKey = `dash_data_${activeProject?.id || 'all'}_${timeRange}`;
    setLoadingMetrics(true);
    setLoadingCharts(true);
    fetchDashboardData(cacheKey);
  };

  return (
    <div className="min-w-0 space-y-7">
      <Toaster position="top-right" />

      <PageHeader
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        badge={
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-signal/10 border border-signal/25 rounded-full">
            <Activity className="w-3.5 h-3.5 text-signal dark:text-signal-bright" />
            <span className="text-[10px] font-semibold uppercase tracking-eyebrow text-signal dark:text-signal-bright">{t('dashboard.anomalyActive')}</span>
          </div>
        }
        actions={
          <>
            <div className="inline-flex max-w-full flex-wrap rounded-2xl border border-edge bg-void-surface p-1">
              {['today', '7d', '30d'].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`min-w-0 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 ${
                    timeRange === range
                      ? 'bg-signal/10 text-signal dark:text-signal-bright border-signal/25'
                      : 'border-transparent text-paper-muted hover:text-paper hover:bg-void-raised'
                  }`}
                >
                  {range === 'today' ? t('dashboard.timeRange.today') : range === '7d' ? t('dashboard.timeRange.7d') : t('dashboard.timeRange.30d')}
                </button>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-edge bg-void-surface text-paper-muted transition-all duration-150 motion-reduce:transition-none hover:-translate-y-0.5 hover:border-edge-strong hover:text-paper active:scale-95 motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
              title={t('dashboard.actions.refresh')}
              aria-label={t('dashboard.actions.refresh')}
            >
              <RefreshCcw className={`w-4 h-4 ${loadingCharts || loadingMetrics ? 'animate-spin motion-reduce:animate-none text-signal dark:text-signal-bright' : ''}`} />
            </button>
          </>
        }
      />

      {!activeProject ? (
        <EmptyState
          icon={<Activity className="w-8 h-8 text-signal dark:text-signal-bright" />}
          title={t('dashboard.emptyState.title')}
          description={projects && projects.length > 0 ? t('dashboard.emptyState.descSelectProject') : t('dashboard.emptyState.descNoProjects')}
        />
      ) : (
        <>
          <RealtimeStatsSection projectId={activeProject.id} />

          <div className="pt-2 space-y-7">
            <h2 className="text-xl font-bold text-paper flex items-center gap-2">
              <span className="w-1.5 h-6 bg-signal rounded-full"></span>
              {t('dashboard.historicalOverview')} ({timeRange === 'today' ? t('dashboard.timeRange.today') : timeRange === '7d' ? t('dashboard.timeRange.7d') : t('dashboard.timeRange.30d')})
            </h2>

            <DashboardMetricGrid metrics={metrics} isLoading={loadingMetrics} />

            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <MentionTrendCard trends={trends} isLoading={loadingCharts} />
              </div>
              <div>
                <SentimentOverviewCard sentiment={sentiment} isLoading={loadingCharts} />
              </div>
            </div>

            <HotKeywordsCard keywords={hotKeywords} isLoading={loadingCharts} />

            <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-2">
              <RecentMentionsPanel
                mentions={metrics?.latest_mentions || []}
                isLoading={loadingMetrics}
                userRole={userRole}
                onActionComplete={handleRefresh}
              />
              <RiskAlertsPanel
                alerts={metrics?.latest_alerts || []}
                isLoading={loadingMetrics}
                userRole={userRole}
                onActionComplete={handleRefresh}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
