'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Trash2, Search, Globe, Facebook, Youtube, Clock,
  Radar, CheckCircle, XCircle, Ban, Rss, ExternalLink, RefreshCw,
  Loader2, Plug, Wifi, WifiOff, Sparkles, BarChart3, TrendingUp,
} from 'lucide-react';
import { sources as sourcesApi, discoveredSources as dsApi, discovery as discoveryApi, getErrorMessage, getUserFacingErrorMessage, dashboard } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import ScheduleSelector from '@/components/ScheduleSelector';
import FeedDiscoveryPanel from '@/components/sources/FeedDiscoveryPanel';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

/* Shared micro-interaction primitives (SIGNAL: 150–250ms, reduced-motion honored) */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';
const focusRingOffset =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void';

type SourceTab = 'active' | 'discovered' | 'connectors';

interface Source {
  id: number;
  name: string;
  url: string;
  source_type: string;
  category?: string;
  platform?: string;
  domain?: string;
  is_active: boolean;
  crawl_frequency: string;
  crawl_time: string | null;
  crawl_day_of_week: number | null;
  crawl_day_of_month: number | null;
  crawl_month: number | null;
  next_crawl_at: string | null;
  last_crawled_at: string | null;
  created_at: string;
}

export default function SourcesPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<SourceTab>('active');
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; sourceId: number | null; sourceName: string }>({
    isOpen: false,
    sourceId: null,
    sourceName: ''
  });
  const [showTestSources, setShowTestSources] = useState(false);
  const [newSource, setNewSource] = useState({
    name: '',
    url: '',
    rss_url: '',
    source_type: 'website',
    crawl_frequency: 'manual' as 'manual' | 'daily' | 'weekly' | 'monthly' | 'yearly',
    schedule: {
      hours: [] as number[],
      daysOfWeek: [] as number[],
      daysOfMonth: [] as number[],
      months: [] as number[],
      time: '09:00'
    }
  });

  // Discovered sources state
  const [discoveredSources, setDiscoveredSources] = useState<any[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  const [dsFilter, setDsFilter] = useState('candidate');
  const [dsActionLoading, setDsActionLoading] = useState<number | null>(null);

  // Connector state
  const [connectors, setConnectors] = useState<any[]>([]);
  const [connectorsLoading, setConnectorsLoading] = useState(false);

  // Top domains state
  const [topDomains, setTopDomains] = useState<any[]>([]);
  const [topDomainsLoading, setTopDomainsLoading] = useState(false);

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    if (activeTab === 'discovered') fetchDiscoveredSources();
    if (activeTab === 'connectors') fetchConnectors();
    if (activeTab === 'active') fetchTopDomains();
  }, [activeTab, dsFilter]);

  const fetchTopDomains = async () => {
    try {
      setTopDomainsLoading(true);
      const data = await dashboard.summary();
      setTopDomains(data.top_sources || []);
    } catch (error: any) {
      console.error('Error fetching top domains:', error);
    } finally {
      setTopDomainsLoading(false);
    }
  };

  const fetchDiscoveredSources = async () => {
    try {
      setDsLoading(true);
      const data = await dsApi.list({ status: dsFilter || undefined, page_size: 100 });
      setDiscoveredSources(data.items || []);
    } catch (error: any) {
      if (error?.response?.status !== 401) console.error('Error fetching discovered sources:', error);
    } finally {
      setDsLoading(false);
    }
  };

  const fetchConnectors = async () => {
    try {
      setConnectorsLoading(true);
      const data = await discoveryApi.connectorStatus();
      setConnectors(data.connectors || []);
    } catch (error: any) {
      if (error?.response?.status !== 401) console.error('Error fetching connectors:', error);
    } finally {
      setConnectorsLoading(false);
    }
  };

  const handleDsAction = async (id: number, action: 'approve-rss' | 'approve-website' | 'reject' | 'block') => {
    try {
      setDsActionLoading(id);
      switch (action) {
        case 'approve-rss': await dsApi.approveRss(id); toast.success(t('sourcesPage.toast.rssApproved')); break;
        case 'approve-website': await dsApi.approveWebsite(id); toast.success(t('sourcesPage.toast.websiteApproved')); break;
        case 'reject': await dsApi.reject(id); toast.success(t('sourcesPage.toast.sourceRejected')); break;
        case 'block': await dsApi.block(id); toast.success(t('sourcesPage.toast.domainBlocked')); break;
      }
      fetchDiscoveredSources();
      if (action === 'approve-rss' || action === 'approve-website') fetchSources();
    } catch (error: any) {
      if (error?.response?.status === 409) { toast(t('sourcesPage.toast.sourceExists'), { icon: 'ℹ️' }); }
      else { toast.error(getErrorMessage(error)); }
    } finally {
      setDsActionLoading(null);
    }
  };

  const handleRefreshRss = async (id: number) => {
    try {
      setDsActionLoading(id);
      const result = await dsApi.refreshRss(id);
      toast.success(result.message || t('sourcesPage.toast.rssChecked'));
      fetchDiscoveredSources();
    } catch (error: any) {
      toast.error(getErrorMessage(error));
    } finally {
      setDsActionLoading(null);
    }
  };

  const fetchSources = async () => {
    try {
      setLoading(true);
      const data = await sourcesApi.list();
      setSources(data);
    } catch (error: any) {
      console.error('Error fetching sources:', error);
      // Don't toast for 401 — global interceptor handles redirect
      if (error?.response?.status !== 401) {
        toast.error(getUserFacingErrorMessage(
          error,
          t('sourcesPage.errors.loadFailed')
        ));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddSource = async () => {
    if (!newSource.name.trim()) {
      toast.error(t('sourcesPage.validation.nameRequired'));
      return;
    }

    if (newSource.source_type === 'rss') {
      if (!newSource.rss_url?.trim()) {
        toast.error(t('sourcesPage.validation.rssUrlRequired'));
        return;
      }
      const rssUrl = newSource.rss_url.trim().toLowerCase();
      const isHtmlPage = rssUrl.match(/\.(htm|html|php|asp|aspx)($|\?)/i);
      const hasRssKeywords = rssUrl.match(/(\.xml|\/feed|\/rss|rss\.|\.rss|atom|syndication)/i);
      const isRootDomain = rssUrl.match(/^https?:\/\/[^\/]+\/?$/);

      if (isHtmlPage || (!hasRssKeywords && isRootDomain)) {
        toast.error(t('sourcesPage.validation.notRssFeed'));
        return;
      }
    } else {
      if (!newSource.url?.trim()) {
        toast.error(t('sourcesPage.validation.urlRequired'));
        return;
      }
    }

    try {
      const payload: any = {
        name: newSource.name,
        url: newSource.source_type === 'rss' ? newSource.rss_url : newSource.url,
        source_type: newSource.source_type,
        is_active: true,
        crawl_frequency: newSource.crawl_frequency
      };

      // Add schedule fields based on frequency
      if (newSource.crawl_frequency === 'daily') {
        payload.schedule_hours = newSource.schedule.hours;
        if (newSource.schedule.hours.length === 0) {
          toast.error(t('sourcesPage.validation.hoursRequired'));
          return;
        }
      } else if (newSource.crawl_frequency === 'weekly') {
        payload.schedule_days_of_week = newSource.schedule.daysOfWeek;
        payload.crawl_time = newSource.schedule.time;
        if (newSource.schedule.daysOfWeek.length === 0) {
          toast.error(t('sourcesPage.validation.daysOfWeekRequired'));
          return;
        }
      } else if (newSource.crawl_frequency === 'monthly') {
        payload.schedule_days_of_month = newSource.schedule.daysOfMonth;
        payload.crawl_time = newSource.schedule.time;
        if (newSource.schedule.daysOfMonth.length === 0) {
          toast.error(t('sourcesPage.validation.daysOfMonthRequired'));
          return;
        }
      } else if (newSource.crawl_frequency === 'yearly') {
        payload.schedule_months = newSource.schedule.months;
        payload.schedule_days_of_month = newSource.schedule.daysOfMonth;
        payload.crawl_time = newSource.schedule.time;
        if (newSource.schedule.months.length === 0 || newSource.schedule.daysOfMonth.length === 0) {
          toast.error(t('sourcesPage.validation.monthAndDayRequired'));
          return;
        }
      }

      await sourcesApi.create(payload);

      setShowAddModal(false);
      setNewSource({
        name: '',
        url: '',
        rss_url: '',
        source_type: 'website',
        crawl_frequency: 'manual',
        schedule: {
          hours: [],
          daysOfWeek: [],
          daysOfMonth: [],
          months: [],
          time: '09:00'
        }
      });
      toast.success(t('sourcesPage.toast.addSuccess'));
      fetchSources();
    } catch (error: any) {
      console.error('Error adding source:', error);
      toast.error(t('sourcesPage.errors.addFailed', { message: getErrorMessage(error) }));
    }
  };

  const handleDeleteSource = async () => {
    if (!deleteConfirm.sourceId) return;

    try {
      await sourcesApi.delete(deleteConfirm.sourceId);
      toast.success(t('sourcesPage.toast.deleteSuccess'));
      fetchSources();
    } catch (error: any) {
      console.error('Error deleting source:', error);
      toast.error(t('sourcesPage.errors.deleteFailed', { message: getErrorMessage(error) }));
    }
  };

  const handleToggleActive = async (source: Source) => {
    try {
      await sourcesApi.update(source.id, {
        is_active: !source.is_active
      });
      fetchSources();
      toast.success(t(!source.is_active ? 'sourcesPage.toast.sourceEnabled' : 'sourcesPage.toast.sourceDisabled'));
    } catch (error: any) {
      console.error('Error toggling source:', error);
      toast.error(t('sourcesPage.errors.updateFailed', { message: getErrorMessage(error) }));
    }
  };

  const filteredSources = sources.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.url.toLowerCase().includes(searchTerm.toLowerCase());
    const isTest = s.url.includes('example.com') || /daily source|weekly source|monthly source|yearly source/i.test(s.name);

    if (!showTestSources && isTest) return false;
    return matchesSearch;
  });

  const getSourceIcon = (type: string) => {
    if (type.includes('facebook')) return <Facebook className="w-5 h-5 text-paper-muted" />;
    if (type.includes('youtube')) return <Youtube className="w-5 h-5 text-paper-muted" />;
    return <Globe className="w-5 h-5 text-paper-muted" />;
  };

  const getSourceTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      'facebook_page': 'sourcesPage.sourceType.facebookPage',
      'facebook_group': 'sourcesPage.sourceType.facebookGroup',
      'facebook_profile': 'sourcesPage.sourceType.facebookProfile',
      'youtube_channel': 'sourcesPage.sourceType.youtubeChannel',
      'youtube_video': 'sourcesPage.sourceType.youtubeVideo',
      'website': 'sourcesPage.sourceType.website',
      'news': 'sourcesPage.sourceType.news',
      'rss': 'sourcesPage.sourceType.rss',
      'forum': 'sourcesPage.sourceType.forum',
      'manual_url': 'sourcesPage.sourceType.manualUrl'
    };
    return typeMap[type] ? t(typeMap[type]) : type;
  };

  const getFrequencyText = (frequency: string) => {
    switch (frequency) {
      case 'daily': return t('sourcesPage.frequency.daily');
      case 'weekly': return t('sourcesPage.frequency.weekly');
      case 'monthly': return t('sourcesPage.frequency.monthly');
      case 'yearly': return t('sourcesPage.frequency.yearly');
      default: return t('sourcesPage.frequency.manual');
    }
  };

  const getScheduleDescription = (source: Source) => {
    if (source.crawl_frequency === 'manual') return t('sourcesPage.schedule.manual');

    const time = source.crawl_time || '09:00';

    if (source.crawl_frequency === 'daily') {
      return t('sourcesPage.schedule.daily', { time });
    } else if (source.crawl_frequency === 'weekly') {
      const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      const dayName = t(`sourcesPage.weekday.${days[source.crawl_day_of_week || 0]}`);
      return t('sourcesPage.schedule.weekly', { day: dayName, time });
    } else if (source.crawl_frequency === 'monthly') {
      return t('sourcesPage.schedule.monthly', { day: source.crawl_day_of_month || 1, time });
    } else if (source.crawl_frequency === 'yearly') {
      const months = ['', 'jan', 'feb', 'mar', 'apr', 'may', 'jun',
                     'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const monthName = t(`sourcesPage.month.${months[source.crawl_month || 1]}`);
      return t('sourcesPage.schedule.yearly', { month: monthName, day: source.crawl_day_of_month || 1, time });
    }

    return t('sourcesPage.schedule.unknown');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-paper-muted font-medium tracking-wide">{t('common.loading')}</div>
      </div>
    );
  }

  const tabItems: { key: SourceTab; label: string; icon: React.ReactNode }[] = [
    { key: 'active', label: t('sourcesPage.tabs.active'), icon: <Globe className="w-4 h-4" /> },
    { key: 'discovered', label: t('sourcesPage.tabs.discovered'), icon: <Radar className="w-4 h-4" /> },
    { key: 'connectors', label: t('sourcesPage.tabs.connectors'), icon: <Plug className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-paper tracking-wide">{t('sourcesPage.title')}</h1>
          <p className="text-sm text-paper-muted mt-1">
            {t('sourcesPage.subtitle')}
          </p>
        </div>
        {activeTab === 'active' && (
          <button
            onClick={() => setShowAddModal(true)}
            className={`flex items-center px-4 py-2.5 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none font-medium ${focusRingOffset}`}
          >
            <Plus className="w-5 h-5 mr-2" />
            {t('sourcesPage.actions.addSource')}
          </button>
        )}
      </div>

      {/* Meta Banner */}
      <div className="bg-signal/10 border border-signal/25 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-signal/15 rounded-lg">
            <Globe className="w-5 h-5 text-signal dark:text-signal-bright" />
          </div>
          <div>
            <h3 className="text-paper font-medium">{t('sourcesPage.metaBanner.title')}</h3>
            <p className="text-sm text-paper-muted mt-0.5">{t('sourcesPage.metaBanner.desc')}</p>
          </div>
        </div>
        <a
          href="/dashboard/integrations/meta"
          className={`px-5 py-2.5 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white font-medium rounded-lg text-sm transition-colors duration-150 motion-reduce:transition-none whitespace-nowrap ${focusRingOffset}`}
        >
          {t('sourcesPage.metaBanner.cta')}
        </a>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-void-surface border border-edge rounded-xl p-1 mb-4">
        {tabItems.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 motion-reduce:transition-none flex-1 justify-center ${focusRing} ${
              activeTab === tab.key
                ? 'bg-signal/[0.08] text-signal dark:text-signal-bright border border-signal/20'
                : 'text-paper-muted hover:text-paper hover:bg-paper/[0.04] border border-transparent'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          TAB 1: ACTIVE SOURCES
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'active' && (<>
      {/* Feed auto-discovery + OPML import: preview, then explicit confirmation */}
      <div className="mb-6">
        <FeedDiscoveryPanel onImported={fetchSources} />
      </div>

      {/* Top Domains Section */}
      <div className="bg-void-surface rounded-2xl border border-edge p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-paper tracking-wide flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-signal dark:text-signal-bright" />
            {t('sourcesPage.topDomains.title')}
          </h2>
          <span className="text-eyebrow font-semibold uppercase bg-signal/10 border border-signal/25 text-signal dark:text-signal-bright px-3 py-1.5 rounded-lg">
            {t('sourcesPage.topDomains.badge')}
          </span>
        </div>
        {topDomainsLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-signal dark:text-signal-bright animate-spin motion-reduce:animate-none" />
          </div>
        ) : topDomains && topDomains.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {Array.isArray(topDomains) && topDomains.slice(0, 10).map((domain: any, idx: number) => (
              <Link
                key={idx}
                href={`/dashboard/mentions?search=${encodeURIComponent(domain.domain || '')}`}
                className={`flex items-center gap-3 p-3 bg-void-raised rounded-xl hover:border-signal/40 border border-transparent transition-colors duration-150 motion-reduce:transition-none group ${focusRing}`}
              >
                <div className="w-8 h-8 bg-signal/10 rounded-lg flex items-center justify-center text-signal dark:text-signal-bright font-bold text-sm tabular-nums flex-shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-paper truncate group-hover:text-signal dark:group-hover:text-signal-bright transition-colors duration-150 motion-reduce:transition-none">
                    {domain.domain || domain.name || t('mentions.page.unknownSource')}
                  </p>
                  <p className="text-xs text-paper-faint tabular-nums">{domain.mention_count || 0} mentions</p>
                </div>
                <TrendingUp className="w-4 h-4 text-sentiment-positive flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 motion-reduce:transition-none" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-paper-faint">
            <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">{t('sourcesPage.topDomains.empty')}</p>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-paper-faint w-5 h-5" />
          <input
            type="text"
            placeholder={t('sourcesPage.search.placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
          />
        </div>
        <div className="flex items-center gap-3 bg-void-surface px-4 py-3 border border-edge rounded-xl w-full sm:w-auto">
          <input
            type="checkbox"
            id="showTestSources"
            checked={showTestSources}
            onChange={(e) => setShowTestSources(e.target.checked)}
            className={`w-4 h-4 text-signal bg-void-surface border-edge-strong rounded ${focusRing}`}
          />
          <label htmlFor="showTestSources" className="text-sm font-medium text-paper-muted cursor-pointer select-none">
            {t('sourcesPage.filters.showTestSources')}
          </label>
        </div>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredSources.length === 0 ? (
          <div className="col-span-full bg-void-surface border border-edge rounded-2xl p-10 text-center text-paper-muted font-medium tracking-wide">
            <div className="w-16 h-16 rounded-xl bg-void-raised flex items-center justify-center mx-auto mb-4 border border-edge">
              <Globe className="w-8 h-8 text-paper-faint" />
            </div>
            {searchTerm ? t('sourcesPage.empty.noMatch') : t('sourcesPage.empty.noSources')}
          </div>
        ) : (
          filteredSources.map((source) => {
            const isTest = source.url.includes('example.com') || /daily source|weekly source|monthly source|yearly source/i.test(source.name);
            const isSupported = ['rss', 'website'].includes((source.source_type || '').toLowerCase());
            const isUnsupported = !isSupported && source.source_type;

            return (
              <div key={source.id} className="bg-void-surface rounded-2xl border border-edge p-6 transition-all duration-200 motion-reduce:transition-none hover:border-signal/40 group flex flex-col h-full hover:-translate-y-1 motion-reduce:hover:translate-y-0">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 bg-void-raised rounded-xl border border-edge group-hover:scale-110 transition-transform duration-200 motion-reduce:transition-none">
                      {getSourceIcon(source.source_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-paper tracking-wide truncate max-w-[150px]" title={source.name}>{source.name}</h3>
                        {(() => {
                          if (isUnsupported) {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-void-raised text-paper-faint border border-edge">
                                {t('sourcesPage.badge.unsupported')}
                              </span>
                            );
                          }
                          if (isTest) {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-void-raised text-paper-faint border border-edge">
                                {t('sourcesPage.badge.testSource')}
                              </span>
                            );
                          }
                          const error = (source as any).last_error;
                          const isInvalidRss = error && (error.includes('invalid_rss_feed') ||
                                               error.includes('invalid_xml') ||
                                               error.includes('parse_failed') ||
                                               error.includes('Feed parse error') ||
                                               error.includes('not well-formed') ||
                                               error.includes('invalid token') ||
                                               (source.source_type === 'rss' && error.includes('not well-formed')));
                          // Guard failures are a distinct, honest state: the URL is
                          // structurally rejected rather than "just" bad XML.
                          const isBlockedTarget = error && (error.includes('blocked_target') ||
                                                  error.includes('unsupported_scheme') ||
                                                  error.includes('credentials_in_url') ||
                                                  error.includes('blocked_port'));
                          const isAiConfigError = error && (error.includes('ai_provider_not_configured') || 
                                                  error.includes('openai_dependency_missing') || 
                                                  error.includes('AI chưa cấu hình') ||
                                                  error.includes('thiếu package openai') ||
                                                  error.includes('openai package not installed'));
                          
                          if (isBlockedTarget) {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-destructive/10 text-destructive border border-destructive/25">
                                {t('sourcesPage.badge.blockedUrl')}
                              </span>
                            );
                          } else if (isInvalidRss) {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-destructive/10 text-destructive border border-destructive/25">
                                {t('sourcesPage.badge.invalidRss')}
                              </span>
                            );
                          } else if (error && !isAiConfigError) {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-destructive/10 text-destructive border border-destructive/25">
                                {t('sourcesPage.badge.crawlError')}
                              </span>
                            );
                          } else if (source.last_crawled_at) {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-success/10 text-success border border-success/25">
                                {t('sourcesPage.badge.crawlSuccess')}
                              </span>
                            );
                          } else {
                            return (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-void-raised text-paper-faint border border-edge">
                                {t('sourcesPage.badge.notCrawled')}
                              </span>
                            );
                          }
                        })()}
                      </div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-[11px] font-medium tracking-wider uppercase text-paper-faint">{getSourceTypeText(source.source_type)}</p>
                        {source.category && (
                          <span className="text-[10px] font-medium tracking-wider uppercase text-signal dark:text-signal-bright bg-signal/10 px-1.5 py-0.5 rounded border border-signal/20">
                            {source.category}
                          </span>
                        )}
                        {(() => {
                          if (isUnsupported || isTest) return null;

                          const error = (source as any).last_error;
                          const isAiConfigError = error && (error.includes('ai_provider_not_configured') ||
                                                  error.includes('openai_dependency_missing') ||
                                                  error.includes('AI chưa cấu hình') ||
                                                  error.includes('thiếu package openai') ||
                                                  error.includes('openai package not installed'));

                          if (isAiConfigError) {
                             return (
                               <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-warning/10 text-warning border border-warning/25">
                                 {t('sourcesPage.badge.aiNotConfigured')}
                               </span>
                             );
                          } else if (source.last_crawled_at && (!error || error === '')) {
                             return (
                               <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-info/10 text-info border border-info/25">
                                 {t('sourcesPage.badge.aiAnalyzed')}
                               </span>
                             );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                <button
                  onClick={() => handleToggleActive(source)}
                  className={`px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-md transition-colors duration-150 motion-reduce:transition-none border ${focusRing} ${
                    source.is_active
                      ? 'bg-success/10 text-success border-success/25 hover:bg-success/20'
                      : 'bg-void-raised text-paper-faint border-edge hover:text-paper-muted'
                  }`}
                >
                  {source.is_active ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="space-y-3 mb-6 flex-1">
                <p className="text-sm text-paper-muted truncate bg-void-raised p-3 rounded-xl border border-edge" title={source.url}>
                  <span className="font-medium text-paper-faint mr-2 block text-xs uppercase tracking-wider mb-1">URL</span> {source.url}
                </p>

                {/* Schedule Info */}
                <div className="flex items-center space-x-3 text-sm text-paper-muted px-1">
                  <Clock className="w-4 h-4 text-signal dark:text-signal-bright flex-shrink-0" />
                  <div className="flex-1 truncate" title={getScheduleDescription(source)}>
                    {getScheduleDescription(source)}
                  </div>
                </div>

                {source.next_crawl_at && (
                  <p className="text-xs text-paper-faint px-1 truncate tabular-nums">
                    <span className="font-medium mr-1 text-paper-muted">{t('sourcesPage.card.nextCrawl')}</span>
                    {new Date(source.next_crawl_at).toLocaleString('vi-VN')}
                  </p>
                )}

                <p className="text-xs text-paper-faint px-1 truncate tabular-nums">
                  <span className="font-medium mr-1 text-paper-muted">{t('sourcesPage.card.lastCrawl')}</span>
                  {source.last_crawled_at
                    ? new Date(source.last_crawled_at).toLocaleString('vi-VN')
                    : t('sourcesPage.badge.notCrawled')
                  }
                </p>
                {(() => {
                  const error = (source as any).last_error;
                  if (!error) return null;

                  // Check if invalid RSS feed
                  const isInvalidRss = error.includes('invalid_rss_feed') ||
                                       error.includes('Feed parse error') ||
                                       error.includes('not well-formed') ||
                                       error.includes('invalid token') ||
                                       (source.source_type === 'rss' && error.includes('not well-formed'));

                  if (isInvalidRss) {
                    return (
                      <div className="text-xs mt-3 p-2.5 bg-destructive/5 border border-destructive/20 rounded-lg">
                        <span className="text-destructive opacity-90 block mb-1">
                          {t('sourcesPage.card.rssNotFeedTitle')}
                        </span>
                        <span className="text-paper-faint text-[11px] block leading-relaxed">
                          {t('sourcesPage.card.rssNotFeedHint')}
                        </span>
                      </div>
                    );
                  }

                  // Check if OpenAI dependency / config issue
                  const isAiConfigError = error.includes('ai_provider_not_configured') ||
                                          error.includes('openai_dependency_missing') ||
                                          error.includes('AI chưa cấu hình') ||
                                          error.includes('thiếu package openai') ||
                                          error.includes('openai package not installed');

                  if (isAiConfigError) {
                    return (
                      <div className="text-xs mt-3 p-2.5 bg-warning/5 border border-warning/20 rounded-lg">
                        <span className="text-warning opacity-90">
                          {t('sourcesPage.card.aiConfigNote')}
                        </span>
                      </div>
                    );
                  }

                  // Default clean display
                  let cleanMsg = error;
                  if (error.includes(': ')) {
                    const parts = error.split(': ');
                    if (parts.length > 1) {
                      cleanMsg = Array.isArray(parts) ? parts.slice(1).join(': ') : error;
                    }
                  }

                  if (isTest) {
                    return (
                      <div className="text-xs text-paper-muted mt-3 p-2.5 bg-void-raised border border-edge rounded-lg" title={error}>
                        <span className="font-semibold text-paper-faint block mb-1 uppercase tracking-wider text-[10px]">{t('sourcesPage.card.testSourceNote')}</span>
                        <span className="opacity-90">{cleanMsg.substring(0, 100)}{cleanMsg.length > 100 ? '...' : ''}</span>
                      </div>
                    );
                  }

                  return (
                    <div className="text-xs text-destructive mt-3 p-2.5 bg-destructive/5 border border-destructive/20 rounded-lg" title={error}>
                      <span className="font-semibold text-destructive block mb-1 uppercase tracking-wider text-[10px]">{t('sourcesPage.card.lastCrawlError')}</span>
                      <span className="opacity-90">{cleanMsg.substring(0, 100)}{cleanMsg.length > 100 ? '...' : ''}</span>
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end pt-4 border-t border-edge mt-auto">
                <button
                  onClick={() => setDeleteConfirm({ isOpen: true, sourceId: source.id, sourceName: source.name })}
                  className={`p-1.5 text-paper-faint hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-destructive/20 ${focusRing}`}
                  title={t('sourcesPage.actions.deleteSource')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, sourceId: null, sourceName: '' })}
        onConfirm={handleDeleteSource}
        title={t('sourcesPage.actions.deleteSource')}
        message={t('sourcesPage.deleteDialog.message', { name: deleteConfirm.sourceName })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        type="danger"
      />
      </>)}

      {/* ════════════════════════════════════════════════════════════════
          TAB 2: DISCOVERED SOURCES
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'discovered' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-eyebrow font-semibold text-paper-faint uppercase">{t('sourcesPage.discovered.statusLabel')}</span>
            {[
              { key: 'candidate', label: t('sourcesPage.discovered.status.candidate'), chip: 'bg-warning/15 text-warning border-warning/25' },
              { key: 'approved', label: t('sourcesPage.discovered.status.approved'), chip: 'bg-success/15 text-success border-success/25' },
              { key: 'rejected', label: t('sourcesPage.discovered.filter.rejected'), chip: 'bg-destructive/15 text-destructive border-destructive/25' },
              { key: 'blocked', label: t('sourcesPage.discovered.filter.blocked'), chip: 'bg-destructive/15 text-destructive border-destructive/25' },
              { key: '', label: t('common.all'), chip: 'bg-void-raised text-paper border-edge-strong' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setDsFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-150 motion-reduce:transition-none border ${focusRing} ${
                  dsFilter === f.key
                    ? f.chip
                    : 'bg-void-surface text-paper-faint hover:text-paper border-edge hover:border-edge-strong'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {dsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 text-signal dark:text-signal-bright animate-spin motion-reduce:animate-none" />
            </div>
          ) : discoveredSources.length === 0 ? (
            <div className="bg-void-surface border border-edge rounded-2xl p-10 text-center">
              <Radar className="w-10 h-10 text-paper-faint mx-auto mb-3" />
              <p className="text-sm text-paper-muted font-medium">{t('sourcesPage.discovered.empty.title')}</p>
              <p className="text-xs text-paper-faint mt-1">{t('sourcesPage.discovered.empty.hint')}</p>
            </div>
          ) : (
            <div className="bg-void-surface border border-edge rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-void-raised text-left text-[11px] tracking-eyebrow font-semibold text-paper-faint uppercase border-b border-edge">
                      <th scope="col" className="px-4 py-3">{t('sourcesPage.discovered.table.source')}</th>
                      <th scope="col" className="px-4 py-3 hidden md:table-cell">{t('sourcesPage.discovered.table.type')}</th>
                      <th scope="col" className="px-4 py-3 hidden lg:table-cell">RSS</th>
                      <th scope="col" className="px-4 py-3 hidden lg:table-cell">{t('sourcesPage.discovered.table.mentions')}</th>
                      <th scope="col" className="px-4 py-3 hidden xl:table-cell">{t('sourcesPage.discovered.table.matchedKeywords')}</th>
                      <th scope="col" className="px-4 py-3">{t('sourcesPage.discovered.table.score')}</th>
                      <th scope="col" className="px-4 py-3">{t('sourcesPage.discovered.table.status')}</th>
                      <th scope="col" className="px-4 py-3 text-right">{t('sourcesPage.discovered.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-edge">
                    {discoveredSources.map((ds: any) => (
                      <tr key={ds.id} className="hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none">
                        <td className="px-4 py-3">
                          <div className="font-medium text-paper text-sm truncate max-w-[200px]" title={ds.source_name}>{ds.source_name || ds.domain}</div>
                          <div className="text-[11px] text-paper-faint truncate max-w-[200px]">{ds.domain}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-paper-muted capitalize">{ds.source_type || '—'}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {ds.rss_valid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-success bg-success/10 px-2 py-0.5 rounded border border-success/25">
                              <Rss className="w-3 h-3" /> {t('sourcesPage.discovered.hasRss')}
                            </span>
                          ) : (
                            <span className="text-[10px] text-paper-faint">{t('sourcesPage.discovered.noRss')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-xs text-paper-muted font-medium tabular-nums">{ds.sample_mentions_count || 0}</span>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {(Array.isArray(ds.matched_keywords_json) ? ds.matched_keywords_json : []).slice(0, 3).map((kw: string, i: number) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-signal/10 text-signal dark:text-signal-bright rounded border border-signal/20 truncate max-w-[80px]">{kw}</span>
                            ))}
                            {(ds.matched_keywords_json || []).length > 3 && (
                              <span className="text-[10px] text-paper-faint tabular-nums">+{(ds.matched_keywords_json || []).length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1.5 bg-void-raised rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-200 motion-reduce:transition-none ${
                                  (ds.relevance_score || 0) >= 50 ? 'bg-success' : (ds.relevance_score || 0) >= 25 ? 'bg-warning' : 'bg-paper-faint'
                                }`}
                                style={{ width: `${Math.min(ds.relevance_score || 0, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-paper-muted font-medium w-7 tabular-nums">{Math.round(ds.relevance_score || 0)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {ds.status === 'candidate' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/25">{t('sourcesPage.discovered.status.candidate')}</span>
                          )}
                          {ds.status === 'approved' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-success/10 text-success border border-success/25">{t('sourcesPage.discovered.status.approved')}</span>
                          )}
                          {ds.status === 'rejected' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-destructive/10 text-destructive border border-destructive/25">{t('sourcesPage.discovered.status.rejected')}</span>
                          )}
                          {ds.status === 'blocked' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-destructive/10 text-destructive border border-destructive/25">{t('sourcesPage.discovered.status.blocked')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {ds.status === 'candidate' && (
                            <div className="flex items-center justify-end gap-1">
                              {ds.rss_valid && (
                                <button
                                  onClick={() => handleDsAction(ds.id, 'approve-rss')}
                                  disabled={dsActionLoading === ds.id}
                                  className={`p-1.5 text-success hover:bg-success/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-success/25 ${focusRing}`} title={t('sourcesPage.discovered.actions.approveRss')}
                                >
                                  {dsActionLoading === ds.id ? <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" /> : <Rss className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              <button
                                onClick={() => handleDsAction(ds.id, 'approve-website')}
                                disabled={dsActionLoading === ds.id}
                                className={`p-1.5 text-signal dark:text-signal-bright hover:bg-signal/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-signal/25 ${focusRing}`} title={t('sourcesPage.discovered.actions.approveWebsite')}
                              >
                                {dsActionLoading === ds.id ? <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" /> : <CheckCircle className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleDsAction(ds.id, 'reject')}
                                disabled={dsActionLoading === ds.id}
                                className={`p-1.5 text-paper-faint hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-destructive/20 ${focusRing}`} title={t('sourcesPage.discovered.actions.reject')}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDsAction(ds.id, 'block')}
                                disabled={dsActionLoading === ds.id}
                                className={`p-1.5 text-paper-faint hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-destructive/20 ${focusRing}`} title={t('sourcesPage.discovered.actions.block')}
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleRefreshRss(ds.id)}
                                disabled={dsActionLoading === ds.id}
                                className={`p-1.5 text-paper-faint hover:text-info hover:bg-info/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-info/25 ${focusRing}`} title={t('sourcesPage.discovered.actions.recheckRss')}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          {ds.status === 'approved' && ds.approved_source_id && (
                            <span className="text-[10px] text-success tabular-nums">{t('sourcesPage.discovered.sourceRef', { id: ds.approved_source_id })}</span>
                          )}
                          {ds.status === 'blocked' && (
                            <span className="text-[10px] text-paper-faint truncate max-w-[100px]" title={ds.blocked_reason}>{ds.blocked_reason || t('sourcesPage.discovered.filter.blocked')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          TAB 3: CONNECTORS
         ════════════════════════════════════════════════════════════════ */}
      {activeTab === 'connectors' && (
        <div className="space-y-4">
          {connectorsLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 text-signal dark:text-signal-bright animate-spin motion-reduce:animate-none" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {connectors.map((c: any) => (
                <div key={c.key} className={`bg-void-surface rounded-2xl border p-5 transition-all duration-200 motion-reduce:transition-none hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 flex flex-col h-full ${
                  c.status === 'active' || c.status === 'limited' ? 'border-success/25 hover:border-success/40'
                    : c.status === 'config_required' ? 'border-warning/25 hover:border-warning/40'
                    : 'border-edge hover:border-edge-strong'
                }`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl border ${
                        c.status === 'active' || c.status === 'limited' ? 'bg-success/10 border-success/25'
                          : c.status === 'config_required' ? 'bg-warning/10 border-warning/25'
                          : 'bg-void-raised border-edge'
                      }`}>
                        {c.status === 'active' || c.status === 'limited' ? <Wifi className="w-5 h-5 text-success" />
                          : c.status === 'config_required' ? <Sparkles className="w-5 h-5 text-warning" />
                          : <WifiOff className="w-5 h-5 text-paper-faint" />}
                      </div>
                      <div>
                        <h3 className="font-semibold text-paper text-sm">{c.name}</h3>
                      </div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-right max-w-[120px] ${
                      c.status === 'active' || c.status === 'limited' ? 'bg-success/10 text-success border border-success/25'
                        : c.status === 'config_required' ? 'bg-warning/10 text-warning border border-warning/25'
                        : 'bg-void-raised text-paper-faint border border-edge'
                    }`}>{c.status_label}</span>
                  </div>
                  <p className="text-xs text-paper-muted leading-relaxed flex-1 mb-4">{c.description}</p>

                  {c.limitations && (
                    <div className="mb-4 text-[11px] p-2 bg-signal/10 border border-signal/20 rounded-lg text-signal dark:text-signal-bright">
                      💡 {c.limitations}
                    </div>
                  )}

                  <div className="mt-auto">
                    {c.status === 'oauth_required' && (
                      <a href="/dashboard/integrations/meta" className={`w-full bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white font-medium py-2 rounded-lg text-sm transition-colors duration-150 motion-reduce:transition-none flex items-center justify-center ${focusRingOffset}`}>
                          <Plug className="w-4 h-4 mr-2" /> {t('sourcesPage.connectors.configureMeta')}
                      </a>
                    )}
                    {c.status === 'limited' && (
                      <a href="/dashboard/integrations/meta" className={`w-full bg-signal/10 border border-signal/25 hover:bg-signal/20 text-signal dark:text-signal-bright font-medium py-2 rounded-lg text-sm transition-colors duration-150 motion-reduce:transition-none block text-center ${focusRing}`}>
                          {t('integrations.manageAccounts')}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-void-surface border border-edge rounded-2xl shadow-tile w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-signal/60" />
            <div className="p-6 border-b border-edge bg-void-surface/[0.85] sticky top-0 z-10 backdrop-blur-xl">
              <h2 className="text-xl font-bold text-paper">{t('sourcesPage.form.title')}</h2>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-paper-muted mb-2">
                  {t('sourcesPage.form.nameLabel')} *
                </label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                  placeholder={t('sourcesPage.form.namePlaceholder')}
                  autoFocus
                />
              </div>

              {newSource.source_type !== 'rss' && (
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('sourcesPage.form.urlLabel')} *
                  </label>
                  <input
                    type="url"
                    value={newSource.url}
                    onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                    placeholder="https://example.com"
                  />
                </div>
              )}

              {newSource.source_type === 'rss' && (
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('sourcesPage.form.rssSiteLabel')}
                  </label>
                  <input
                    type="url"
                    value={newSource.url}
                    onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                    placeholder="https://example.com"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-paper-muted mb-2">
                  {t('sourcesPage.form.sourceTypeLabel')}
                </label>
                <select
                  value={newSource.source_type}
                  onChange={(e) => setNewSource({ ...newSource, source_type: e.target.value })}
                  className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                >
                  <option value="website">{t('sourcesPage.sourceType.website')}</option>
                  <option value="facebook_page">{t('sourcesPage.sourceType.facebookPage')}</option>
                  <option value="facebook_group">{t('sourcesPage.sourceType.facebookGroup')}</option>
                  <option value="facebook_profile">{t('sourcesPage.sourceType.facebookProfile')}</option>
                  <option value="youtube_channel">{t('sourcesPage.sourceType.youtubeChannel')}</option>
                  <option value="youtube_video">{t('sourcesPage.sourceType.youtubeVideo')}</option>
                  <option value="news">{t('sourcesPage.sourceType.news')}</option>
                  <option value="rss">{t('sourcesPage.sourceType.rss')}</option>
                  <option value="forum">{t('sourcesPage.sourceType.forum')}</option>
                  <option value="manual_url">{t('sourcesPage.sourceType.manualUrl')}</option>
                </select>
              </div>

              {/* Dynamic form based on source type */}
              {/* Website, News, Forum, Manual URL - just need URL */}
              {['website', 'news', 'forum', 'manual_url'].includes(newSource.source_type) && (
                <div className="bg-signal/10 border border-signal/20 rounded-xl p-4">
                  <p className="text-sm text-paper-muted">
                    <strong className="text-signal dark:text-signal-bright">{t('sourcesPage.form.webNoteLabel')}</strong> {t('sourcesPage.form.webNote')}
                  </p>
                </div>
              )}

              {/* Facebook - need login credentials */}
              {newSource.source_type.startsWith('facebook_') && (
                <div className="bg-warning/10 border border-warning/25 rounded-xl p-4 space-y-4">
                  <p className="text-sm text-warning font-medium">
                    <strong className="text-warning">{t('sourcesPage.form.facebookHeading')}</strong> {t('sourcesPage.form.facebookNote')}
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-paper-muted mb-1.5">
                      {t('sourcesPage.form.facebookEmailLabel')}
                    </label>
                    <input
                      type="text"
                      placeholder={t('auth.emailPlaceholder')}
                      className="w-full px-3 py-2 bg-void-surface border border-edge-strong rounded-lg text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-paper-muted mb-1.5">
                      {t('auth.passwordLabel')}
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="w-full px-3 py-2 bg-void-surface border border-edge-strong rounded-lg text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                    />
                  </div>
                  <p className="text-xs text-paper-muted">
                    ⚠️ {t('sourcesPage.form.credentialsNote')}
                  </p>
                </div>
              )}

              {/* YouTube - need API key or login */}
              {newSource.source_type.startsWith('youtube_') && (
                <div className="bg-void-raised border border-edge rounded-xl p-4 space-y-4">
                  <p className="text-sm text-paper-muted font-medium">
                    <strong className="text-paper">{t('sourcesPage.form.youtubeHeading')}</strong> {t('sourcesPage.form.youtubeNote')}
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-paper-muted mb-1.5">
                      {t('sourcesPage.form.accessMethodLabel')}
                    </label>
                    <select className="w-full px-3 py-2 bg-void-surface border border-edge-strong rounded-lg text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal">
                      <option value="public">{t('sourcesPage.form.accessPublic')}</option>
                      <option value="api_key">{t('sourcesPage.form.accessApiKey')}</option>
                      <option value="login">{t('sourcesPage.form.accessGoogleLogin')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-paper-muted mb-1.5">
                      {t('sourcesPage.form.youtubeApiKeyOptional')}
                    </label>
                    <input
                      type="text"
                      placeholder="AIzaSy..."
                      className="w-full px-3 py-2 bg-void-surface border border-edge-strong rounded-lg text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                    />
                  </div>
                  <p className="text-xs text-paper-muted">
                    💡 {t('sourcesPage.form.youtubeApiKeyNote')}
                  </p>
                </div>
              )}

              {/* RSS - need feed settings */}
              {newSource.source_type === 'rss' && (
                <div className="bg-void-raised border border-edge rounded-xl p-4 space-y-4">
                  <p className="text-sm text-paper-muted font-medium">
                    <strong className="text-paper">{t('sourcesPage.form.rssHeading')}</strong> {t('sourcesPage.form.rssNote')}
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-paper-muted mb-1.5">
                      {t('sourcesPage.form.rssUrlLabel')} *
                    </label>
                    <input
                      type="url"
                      value={newSource.rss_url || ''}
                      onChange={(e) => setNewSource({ ...newSource, rss_url: e.target.value })}
                      placeholder="https://example.com/feed.xml"
                      className="w-full px-3 py-2 bg-void-surface border border-edge-strong rounded-lg text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                    />
                    <p className="text-xs text-paper-faint mt-1.5">
                      {t('sourcesPage.form.rssUrlHint')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-paper-muted mb-1.5">
                      {t('sourcesPage.form.rssMaxItemsLabel')}
                    </label>
                    <input
                      type="number"
                      defaultValue={50}
                      min={1}
                      max={500}
                      className="w-full px-3 py-2 bg-void-surface border border-edge-strong rounded-lg text-paper tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                    />
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="rss-full-content"
                      className={`w-4 h-4 text-signal bg-void-surface border-edge-strong rounded ${focusRing}`}
                    />
                    <label htmlFor="rss-full-content" className="ml-3 text-sm text-paper-muted cursor-pointer">
                      {t('sourcesPage.form.rssFullContent')}
                    </label>
                  </div>
                </div>
              )}

              {/* Crawl Schedule */}
              <div className="border-t border-edge pt-5 mt-2">
                <h3 className="text-base font-semibold text-paper mb-4">{t('sourcesPage.form.scheduleTitle')}</h3>

                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('sourcesPage.form.frequencyLabel')}
                  </label>
                  <select
                    value={newSource.crawl_frequency}
                    onChange={(e) => setNewSource({
                      ...newSource,
                      crawl_frequency: e.target.value as 'manual' | 'daily' | 'weekly' | 'monthly' | 'yearly'
                    })}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                  >
                    <option value="manual">{t('sourcesPage.form.frequencyManual')}</option>
                    <option value="daily">{t('sourcesPage.frequency.daily')}</option>
                    <option value="weekly">{t('sourcesPage.frequency.weekly')}</option>
                    <option value="monthly">{t('sourcesPage.frequency.monthly')}</option>
                    <option value="yearly">{t('sourcesPage.frequency.yearly')}</option>
                  </select>
                </div>

                {/* Schedule Selector Component wrapper in dark mode via CSS global .dark but let's assume it works. The component might need inline fix if it still relies on legacy stock text colors */}
                <div className="mt-4 schedule-dark-wrapper">
                  <ScheduleSelector
                    frequency={newSource.crawl_frequency}
                    value={newSource.schedule}
                    onChange={(schedule) => setNewSource({ ...newSource, schedule })}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-edge bg-void-surface/[0.85] rounded-b-2xl flex justify-end space-x-3 sticky bottom-0 backdrop-blur-xl">
              <button
                onClick={() => setShowAddModal(false)}
                className={`px-5 py-2.5 text-sm font-medium text-paper-muted bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised hover:text-paper transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleAddSource}
                className={`px-5 py-2.5 text-sm font-medium text-white bg-signal rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none ${focusRingOffset}`}
              >
                {t('sourcesPage.actions.addSource')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
