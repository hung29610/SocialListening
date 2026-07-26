'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Play, Link as LinkIcon, History, AlertTriangle, CheckCircle, XCircle,
  Clock, RefreshCw, Loader2, Activity, Sparkles, Radar, Plus,
  Filter, Eye, EyeOff, CheckSquare, Square, Rss, Globe, FlaskConical,
  ChevronDown, ChevronUp, ExternalLink, Search, Globe2, Network,
} from 'lucide-react';
import { crawl, keywords as keywordsApi, sources as sourcesApi, discovery as discoveryApi, getErrorMessage, API_BASE_URL } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import ScanSchedulesPanel from '@/components/ScanSchedulesPanel';
import { useLanguage } from '@/contexts/LanguageContext';

/* Shared micro-interaction primitives (SIGNAL: 150–250ms, reduced-motion honored) */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';
const focusRingOffset =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void';

interface WorkerStatus {
  scheduler_enabled: boolean;
  worker_mode: string;
  worker_running: boolean;
  last_worker_heartbeat: string | null;
  active_sources: number;
  due_sources: number;
  running_jobs: number;
  last_error: string | null;
  is_locked?: boolean;
  scan_interval_minutes?: number;
  last_started_at?: string | null;
  last_finished_at?: string | null;
  last_success_at?: string | null;
  last_scan_count?: number;
  skipped_due_to_lock_count?: number;
}

interface CrawlJob {
  id: number;
  job_type: string;
  source_ids: number[] | null;
  status: string;
  total_sources: number;
  processed_sources: number;
  mentions_found: number;
  error_message: string | null;
  retry_count: number;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  project_id?: number;
}

type SourceFilter = 'all' | 'rss' | 'website' | 'global_search' | 'active';

const TEST_SOURCE_PATTERNS = [
  'example.com',
  'daily source',
  'weekly source',
  'monthly source',
  'yearly source',
];

function isTestSource(source: any): boolean {
  const url = (source.url || '').toLowerCase();
  const name = (source.name || '').toLowerCase();
  return TEST_SOURCE_PATTERNS.some(
    (p) => url.includes(p) || name.includes(p)
  );
}

export default function ScanPage() {
  const { t } = useLanguage();
  const [keywordGroups, setKeywordGroups] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
  const [selectedSources, setSelectedSources] = useState<number[]>([]);
  const [customUrl, setCustomUrl] = useState('');
  const [scanMode, setScanMode] = useState<string>('AUTO_DISCOVERY');
  const [scanCapabilities, setScanCapabilities] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);
  const [crawlJobs, setCrawlJobs] = useState<CrawlJob[]>([]);
  const [retryingJobId, setRetryingJobId] = useState<number | null>(null);

  // Auto Discovery state
  const [discoveryLimit, setDiscoveryLimit] = useState(20);
  const [discoveryDateRange, setDiscoveryDateRange] = useState('last_30_days');
  const [discoveryLanguage, setDiscoveryLanguage] = useState('vi');
  const [discoveryCountry, setDiscoveryCountry] = useState('vn');
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<any>(null);

  // Quick keyword states
  const [quickKeyword, setQuickKeyword] = useState('');
  const [quickGroupId, setQuickGroupId] = useState<number | ''>('');
  const [addingKeyword, setAddingKeyword] = useState(false);

  // Source filter states
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [hideTestSources, setHideTestSources] = useState(true);

  // UI state
  const [showCustomUrl, setShowCustomUrl] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // Debug state — tracks last API call for diagnostics
  const [debugInfo, setDebugInfo] = useState<{
    lastUrl: string;
    lastPayload: any;
    lastErrorName: string;
    lastErrorMessage: string;
    lastStatus: number | null;
    lastResponseData: any;
    hasAuthToken: boolean;
  }>({
    lastUrl: '',
    lastPayload: null,
    lastErrorName: '',
    lastErrorMessage: '',
    lastStatus: null,
    lastResponseData: null,
    hasAuthToken: typeof window !== 'undefined' ? !!localStorage.getItem('access_token') : false,
  });

  // Filtered sources
  const filteredSources = useMemo(() => {
    let result = sources;

    // Hide test sources
    if (hideTestSources) {
      result = result.filter((s) => !isTestSource(s));
    }

    // Apply type filter
    switch (sourceFilter) {
      case 'rss':
        result = result.filter((s) => (s.source_type || '').toLowerCase() === 'rss');
        break;
      case 'website':
        result = result.filter((s) => ['website', 'manual_url', 'forum'].includes((s.source_type || '').toLowerCase()));
        break;
      case 'global_search':
        result = result.filter((s) => (s.source_type || '').toLowerCase() === 'global_search');
        break;
      case 'active':
        result = result.filter((s) => s.is_active);
        break;
    }

    return result;
  }, [sources, sourceFilter, hideTestSources]);

  const realSourceCount = useMemo(
    () => sources.filter((s) => !isTestSource(s)).length,
    [sources]
  );

  useEffect(() => {
    fetchData();
    fetchWorkerStatus();
    fetchCrawlJobs();
  }, []);

  // Poll for job updates if any job is running
  useEffect(() => {
    const hasRunningJob = crawlJobs.some(j => j.status === 'running' || j.status === 'pending');
    if (hasRunningJob) {
      const interval = setInterval(() => {
        fetchWorkerStatus();
        fetchCrawlJobs();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [crawlJobs]);

  const fetchData = async () => {
    try {
      const [groupsData, sourcesData, capsData] = await Promise.all([
        keywordsApi.listGroups(),
        sourcesApi.list(),
        crawl.getCapabilities(),
      ]);
      setKeywordGroups(groupsData);
      setSources(sourcesData);
      setScanCapabilities(capsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchWorkerStatus = async () => {
    try {
      const data = await crawl.getWorkerStatus();
      setWorkerStatus(data);
    } catch (error) {
      console.error('Error fetching worker status:', error);
    }
  };

  const fetchCrawlJobs = async () => {
    try {
      const data = await crawl.getJobs(1, 20);
      setCrawlJobs(data.items || []);
    } catch (error) {
      console.error('Error fetching crawl jobs:', error);
    }
  };

  // ── Quick Add keyword (no scan) ──
  const handleQuickAdd = async () => {
    if (!quickKeyword.trim()) {
      toast.error(t('scanPage.errors.keywordRequired'));
      return;
    }
    try {
      setAddingKeyword(true);
      let targetGroupId = quickGroupId as number;
      if (!targetGroupId) {
        if (keywordGroups.length > 0) {
          targetGroupId = keywordGroups[0].id;
        } else {
          const newGroup = await keywordsApi.createGroup({
            name: 'Nhóm Mặc Định',
            description: 'Tự động tạo từ Scan Center',
          });
          targetGroupId = newGroup.id;
        }
      }
      await keywordsApi.createKeyword({
        keyword: quickKeyword,
        group_id: targetGroupId,
        keyword_type: 'general',
      });
      toast.success(t('scanPage.toast.keywordAdded', { keyword: quickKeyword }));
      setQuickKeyword('');
      await fetchData();
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast(t('scanPage.errors.keywordExists'), { icon: 'ℹ️' });
        setQuickKeyword('');
        return;
      }
      toast.error(t('scanPage.errors.generic', { message: error.response?.data?.detail || error.message }));
    } finally {
      setAddingKeyword(false);
    }
  };

  // ── Unified Scan Handler ──
  const handleScanSubmit = async () => {
    const hasKeyword = quickKeyword.trim().length > 0 || selectedGroups.length > 0;
    if (!hasKeyword) {
      toast.error(t('scanPage.errors.keywordOrGroupRequired'));
      return;
    }

    const validSources = selectedSources.filter(id => {
      const source = sources.find(s => s.id === id);
      return source && ['rss', 'website', 'global_search'].includes((source.source_type || '').toLowerCase());
    });

    if (validSources.length < selectedSources.length) {
      toast(t('scanPage.toast.skippedUnsupportedSources'), { icon: 'ℹ️' });
      setSelectedSources(validSources);
    }

    if (scanMode === 'SELECTED_SOURCES' && validSources.length === 0 && !customUrl) {
      toast.error(t('scanPage.errors.sourceRequired'));
      return;
    }

    try {
      setScanning(true);
      const loadingToast = toast.loading(t('scanPage.toast.processing'));


      let finalKeywordGroups = [...selectedGroups];
      let finalKeywords: string[] = [];

      if (quickKeyword.trim()) {
        finalKeywords.push(quickKeyword.trim());
        if (quickGroupId) {
          try {
            await keywordsApi.createKeyword({
              keyword: quickKeyword.trim(),
              group_id: quickGroupId as number,
              keyword_type: 'general',
            });
            if (!finalKeywordGroups.includes(quickGroupId as number)) {
              finalKeywordGroups.push(quickGroupId as number);
            }
          } catch (error: any) {
            if (error.response?.status !== 409) {
              console.error('Error creating quick keyword:', error);
            }
          }
        }
      }

      await fetchData();

      const payload: any = {
        keyword_group_ids: finalKeywordGroups,
        mode: scanMode,
        source_ids: validSources,
      };

      if (finalKeywords.length > 0) {
        payload.keywords = finalKeywords;
      }

      if (customUrl) {
        payload.url = customUrl;
      }

      const finalUrl = `${API_BASE_URL}/api/crawl/manual-scan`;
      setDebugInfo(prev => ({
        ...prev,
        lastUrl: finalUrl,
        lastPayload: payload,
        lastErrorName: '',
        lastErrorMessage: '',
        lastStatus: null,
        lastResponseData: null,
        hasAuthToken: !!localStorage.getItem('access_token'),
      }));

      const result = await crawl.manualScan(payload);

      setDebugInfo(prev => ({
        ...prev,
        lastStatus: 200,
        lastResponseData: result,
        lastErrorName: '',
        lastErrorMessage: '',
      }));

      toast.dismiss(loadingToast);
      if (result.message === "Returned existing running job to prevent duplicate crawl") {
        toast.success(t('scanPage.toast.duplicateJobRunning'));
      } else {
        toast.success(result.message || t('scanPage.toast.jobCreated'));
      }

      setQuickKeyword('');
      setShowHistory(true);
      fetchCrawlJobs();
      fetchWorkerStatus();
    } catch (error: any) {
      toast.dismiss();
      const errorMsg = getErrorMessage(error);
      setDebugInfo(prev => ({
        ...prev,
        lastErrorName: error?.name || error?.constructor?.name || 'Error',
        lastErrorMessage: errorMsg,
        lastStatus: error?.response?.status || null,
        lastResponseData: error?.response?.data || null,
        hasAuthToken: !!localStorage.getItem('access_token'),
      }));
      toast.error(t('scanPage.errors.generic', { message: errorMsg }));
    } finally {
      setScanning(false);
    }
  };

  const handleRetry = async (jobId: number) => {
    try {
      setRetryingJobId(jobId);
      const result = await crawl.retryJob(jobId);
      toast.success(t('scanPage.toast.retrySuccess', { count: result.mentions_found }));
      fetchCrawlJobs();
      fetchWorkerStatus();
    } catch (error: any) {
      toast.error(t('scanPage.errors.retryFailed', { message: error.response?.data?.detail || error.message }));
    } finally {
      setRetryingJobId(null);
    }
  };



  // ── Quick actions for sources ──
  const selectAllVisible = () => {
    const ids = filteredSources
      .filter((s) => ['rss', 'website'].includes((s.source_type || '').toLowerCase()))
      .map((s) => s.id);
    setSelectedSources((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearSelection = () => {
    setSelectedSources([]);
  };

  const validSelectedSources = selectedSources.filter(id => {
    const s = sources.find(src => src.id === id);
    return s && ['rss', 'website'].includes((s.source_type || '').toLowerCase());
  });

  const hasValidSources = validSelectedSources.length > 0;
  const isUrlValid = customUrl.trim().length > 0;
  const isAutoDiscoveryConfigured = scanCapabilities?.auto_discovery?.configured;

  const hasKeyword = quickKeyword.trim().length > 0 || selectedGroups.length > 0;

  const canScan = hasKeyword &&
    (scanMode !== 'SELECTED_SOURCES' || hasValidSources || isUrlValid) &&
    (scanMode !== 'AUTO_DISCOVERY' || isAutoDiscoveryConfigured);

  // Disable reason text
  const getDisableReason = () => {
    if (!hasKeyword) return t('scanPage.hints.needKeyword');
    if (scanMode === 'AUTO_DISCOVERY' && !isAutoDiscoveryConfigured) return t('scanPage.hints.serpApiRequiredForDiscovery');
    if (scanMode === 'SELECTED_SOURCES') {
      if (selectedSources.length > 0 && validSelectedSources.length === 0) return t('scanPage.hints.selectedSourcesUnsupported');
      if (customUrl.length > 0 && !isUrlValid) return t('scanPage.hints.invalidCustomUrl');
      return t('scanPage.hints.needSource');
    }
    return '';
  };

  // Update scanMode when selectedSources change
  useEffect(() => {
    if (selectedSources.length > 0 && scanMode === 'AUTO_DISCOVERY') {
      setScanMode('HYBRID');
    } else if (selectedSources.length === 0 && scanMode === 'HYBRID') {
      setScanMode(isAutoDiscoveryConfigured === false ? 'ALL_ACTIVE_SOURCES' : 'AUTO_DISCOVERY');
    }
  }, [selectedSources, isAutoDiscoveryConfigured]);

  useEffect(() => {
    if (isAutoDiscoveryConfigured === false && scanMode === 'AUTO_DISCOVERY') {
      setScanMode('ALL_ACTIVE_SOURCES');
    }
  }, [isAutoDiscoveryConfigured]);

  // ── Badge helpers ──
  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
      completed: { bg: 'bg-success/10 text-success border border-success/25', icon: <CheckCircle className="w-3 h-3 mr-1" />, label: t('scanPage.jobStatus.completed') },
      running: { bg: 'bg-signal/10 text-signal dark:text-signal-bright border border-signal/20', icon: <Loader2 className="w-3 h-3 mr-1 animate-spin motion-reduce:animate-none" />, label: t('scanPage.jobStatus.running') },
      failed: { bg: 'bg-destructive/10 text-destructive border border-destructive/25', icon: <XCircle className="w-3 h-3 mr-1" />, label: t('scanPage.jobStatus.failed') },
      pending: { bg: 'bg-warning/10 text-warning border border-warning/25', icon: <Clock className="w-3 h-3 mr-1" />, label: t('scanPage.jobStatus.pending') },
      cancelled: { bg: 'bg-void-raised text-paper-faint border border-edge', icon: <XCircle className="w-3 h-3 mr-1" />, label: t('scanPage.jobStatus.cancelled') },
    };
    const s = map[status] || { bg: 'bg-void-raised text-paper-faint border border-edge', icon: null, label: status };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${s.bg}`}>
        {s.icon}{s.label}
      </span>
    );
  };

  const getJobTypeBadge = (jobType: string) => {
    const styles: Record<string, string> = {
      manual: 'bg-signal/10 text-signal dark:text-signal-bright border border-signal/20',
      scheduled: 'bg-info/10 text-info border border-info/25',
      retry: 'bg-warning/10 text-warning border border-warning/25',
    };
    const labels: Record<string, string> = {
      manual: t('scanPage.jobType.manual'),
      scheduled: t('scanPage.jobType.scheduled'),
      retry: t('scanPage.jobType.retry'),
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${styles[jobType] || 'bg-void-raised text-paper-faint border border-edge'}`}>
        {labels[jobType] || jobType}
      </span>
    );
  };

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  const filterTabs: { key: SourceFilter; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: t('common.all'), icon: <Globe className="w-3 h-3" /> },
    { key: 'rss', label: 'RSS', icon: <Rss className="w-3 h-3" /> },
    { key: 'website', label: 'Website', icon: <LinkIcon className="w-3 h-3" /> },
    { key: 'global_search', label: 'Global Search', icon: <Sparkles className="w-3 h-3" /> },
    { key: 'active', label: 'Active', icon: <CheckCircle className="w-3 h-3" /> },
  ];

  // Count of valid selectable sources in filtered view
  const selectableCount = filteredSources.filter(
    (s) => ['rss', 'website', 'global_search'].includes((s.source_type || '').toLowerCase())
  ).length;

  // Recent completed job (for quick result display)
  const latestJob = crawlJobs.length > 0 ? crawlJobs[0] : null;

  return (
    <div className="space-y-4 max-w-[1400px]">
      <Toaster position="top-right" />

      {/* ═══════════════════════════════════════════════════════════════════
          1. PAGE HEADER
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center justify-between border-b border-edge pb-4 mb-4">
        <div className="flex items-center gap-4">
          <div className="relative flex items-center justify-center w-12 h-12">
            <div className="absolute inset-0 bg-signal/10 rounded-full blur-md" />
            <Radar className="w-6 h-6 text-signal dark:text-signal-bright relative z-10" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-paper tracking-wide">
              {t('scanPage.title')}
            </h1>
            <p className="text-xs text-paper-muted mt-1">
              {t('scanPage.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 rounded text-xs font-medium border ${isAutoDiscoveryConfigured ? 'bg-success/10 text-success border-success/25' : 'bg-destructive/10 text-destructive border-destructive/25'}`} title={!isAutoDiscoveryConfigured ? t('scanPage.hints.serpApiRequired') : undefined}>
            {t('scanPage.autoDiscovery.label')} {isAutoDiscoveryConfigured ? t('scanPage.status.ready') : t('scanPage.status.notConfigured')}
          </span>
          <button
            onClick={() => { fetchWorkerStatus(); fetchCrawlJobs(); fetchData(); }}
            className={`group relative flex items-center gap-2 px-4 py-2 text-xs font-medium text-signal dark:text-signal-bright bg-void-surface border border-signal/30 rounded-lg transition-colors duration-150 motion-reduce:transition-none hover:bg-signal/10 hover:border-signal/50 ${focusRing}`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin motion-reduce:animate-none' : 'group-hover:rotate-180 transition-transform duration-200 motion-reduce:transition-none'}`} />
            {t('scanPage.actions.sync')}
          </button>
          <button
            onClick={async () => {
              try {
                const toastId = toast.loading(t('scanPage.toast.rssStarting'));
                const { collectors } = await import('@/lib/api');
                await collectors.runRss();
                toast.success(t('scanPage.toast.rssStarted'), { id: toastId });
                fetchWorkerStatus();
              } catch (error) {
                const { getErrorMessage } = await import('@/lib/api');
                toast.error(t('scanPage.errors.generic', { message: getErrorMessage(error) }));
              }
            }}
            className={`group relative flex items-center gap-2 px-4 py-2 text-xs font-medium text-paper-muted bg-void-surface border border-edge-strong rounded-lg transition-colors duration-150 motion-reduce:transition-none hover:bg-void-raised hover:text-paper ${focusRing}`}
          >
            <Rss className="w-3.5 h-3.5" />
            {t('scanPage.actions.updateRss')}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          2. WORKER STATUS BAR — Terminal horizontal
         ═══════════════════════════════════════════════════════════════════ */}
      {workerStatus && (
        <div className={`rounded font-mono px-4 py-3 border flex flex-wrap items-center gap-x-4 gap-y-1.5 ${
          workerStatus.worker_running
            ? 'bg-success/5 border-success/30 text-success'
            : 'bg-destructive/5 border-destructive/30 text-destructive'
        }`}>
          {/* Status icon + label */}
          <div className="flex items-center gap-2">
            {workerStatus.worker_running ? (
              <Activity className="w-4 h-4 animate-pulse motion-reduce:animate-none flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="text-[11px] font-bold tracking-wider">
              {workerStatus.worker_running
                ? (workerStatus.worker_mode === 'embedded' ? 'SYS.WORKER // EMBEDDED_MODE' : 'SYS.WORKER // ONLINE')
                : 'SYS.WORKER // OFFLINE'}
            </span>
          </div>

          {/* Embedded warning */}
          {workerStatus.worker_mode === 'embedded' && (
            <span className="text-[10px] text-warning flex items-center gap-1 bg-warning/10 px-2 py-0.5 rounded border border-warning/25">
              <AlertTriangle className="w-3 h-3" />
              BACKGROUND_CRON_DISABLED
            </span>
          )}

          {/* Metrics inline */}
          <div className="flex items-center gap-3 ml-auto text-[11px] font-medium opacity-80 tabular-nums">
            <span>TARGETS: <strong>{workerStatus.active_sources}</strong></span>
            <span className="opacity-30">|</span>
            <span>QUEUE: <strong>{workerStatus.due_sources}</strong></span>
            <span className="opacity-30">|</span>
            <span>ACTIVE_JOBS: <strong>{workerStatus.running_jobs}</strong></span>
            {workerStatus.last_scan_count !== undefined && workerStatus.last_scan_count > 0 && (
              <>
                <span className="opacity-30">|</span>
                <span>LAST_SCAN: <strong>{workerStatus.last_scan_count} items</strong></span>
              </>
            )}
            {workerStatus.last_success_at && (
              <>
                <span className="opacity-30">|</span>
                <span>SUCCESS: <strong>{formatDate(workerStatus.last_success_at)}</strong></span>
              </>
            )}
            {workerStatus.last_worker_heartbeat && (
              <>
                <span className="opacity-30">|</span>
                <span>PING: <strong>{formatDate(workerStatus.last_worker_heartbeat)}</strong></span>
              </>
            )}
          </div>

          {/* Error line */}
          {workerStatus.last_error && (
            <div className="w-full mt-2 pt-2 border-t border-destructive/20">
              <span className="text-[10px] text-destructive font-bold tracking-wider inline-block truncate max-w-full">
                [ERR] {workerStatus.last_error}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          3. MAIN SCAN INPUT CARD
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-void-surface rounded-xl border border-edge p-6 mb-6 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-5">
            <div>
              <label className="text-sm font-medium text-paper-muted mb-2 block">
                {t('scanPage.form.keywordLabel')}
              </label>
              <div className="flex gap-3">
                <input
                  id="quick-keyword-input"
                  type="text"
                  value={quickKeyword}
                  onChange={(e) => setQuickKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScanSubmit()}
                  placeholder={t('scanPage.form.keywordPlaceholder')}
                  className="flex-1 bg-void-surface border border-edge-strong rounded-lg px-4 py-2.5 text-sm text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-colors duration-150 motion-reduce:transition-none"
                />
                <select
                  id="quick-keyword-group"
                  value={quickGroupId}
                  onChange={(e) => setQuickGroupId(e.target.value ? Number(e.target.value) : '')}
                  className="w-48 bg-void-surface border border-edge-strong rounded-lg px-3 py-2.5 text-sm text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                >
                  <option value="">{t('scanPage.form.groupPlaceholder')}</option>
                  {keywordGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-paper-muted mb-2 block">{t('scanPage.form.modeLabel')}</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'AUTO_DISCOVERY', label: t('scanPage.mode.autoDiscovery'), disabled: !isAutoDiscoveryConfigured },
                  { id: 'HYBRID', label: t('scanPage.mode.hybrid') },
                  { id: 'SELECTED_SOURCES', label: t('scanPage.mode.selectedSources') },
                  { id: 'ALL_ACTIVE_SOURCES', label: t('scanPage.mode.allActiveSources') }
                ].map(mode => (
                  <div key={mode.id} className="group relative">
                    <label
                      className={`inline-flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors duration-150 motion-reduce:transition-none text-sm font-medium ${
                        mode.disabled
                          ? 'bg-void-raised border-edge text-paper-faint cursor-not-allowed'
                          : scanMode === mode.id
                            ? 'bg-signal/10 border-signal/40 text-signal dark:text-signal-bright cursor-pointer'
                            : 'bg-void-surface hover:bg-void-raised border-edge-strong text-paper-muted hover:text-paper cursor-pointer'
                      }`}
                      title={mode.disabled ? t('scanPage.hints.webSearchNotConfigured') : undefined}
                    >
                      <input
                        type="radio"
                        name="scanMode"
                        value={mode.id}
                        checked={scanMode === mode.id}
                        onChange={() => {
                          if (!mode.disabled) setScanMode(mode.id);
                        }}
                        disabled={mode.disabled}
                        className={`rounded-full border-edge-strong bg-void-surface h-4 w-4 ${focusRing} ${mode.disabled ? 'opacity-50 cursor-not-allowed' : 'text-signal'}`}
                      />
                      {mode.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col justify-end gap-3 lg:border-l lg:border-edge lg:pl-6">
            <div className="mb-auto">
               <p className="text-xs text-paper-muted leading-relaxed">
                 {getDisableReason() ? (
                   <span className="text-destructive flex items-center gap-1.5"><AlertTriangle className="w-4 h-4"/> {getDisableReason()}</span>
                 ) : (
                   <span className="text-success flex items-center gap-1.5"><CheckCircle className="w-4 h-4"/> {t('scanPage.hints.readyToScan')}</span>
                 )}
               </p>
            </div>
            <button
              onClick={handleScanSubmit}
              disabled={scanning || !canScan}
              className={`w-full px-6 py-3 bg-signal text-white font-medium rounded-lg hover:bg-signal-deep dark:hover:bg-signal-bright disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors duration-150 motion-reduce:transition-none ${focusRingOffset}`}
            >
              {scanning ? <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" /> : <Radar className="w-5 h-5" />}
              {t('scanPage.actions.startScan')}
            </button>
            <button
              onClick={handleQuickAdd}
              disabled={addingKeyword || !quickKeyword.trim()}
              className={`w-full px-6 py-2.5 bg-void-raised text-paper-muted font-medium rounded-lg hover:text-paper disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-edge-strong transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
            >
              {addingKeyword ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" /> : <Plus className="w-4 h-4" />}
              {t('scanPage.actions.addKeywordOnly')}
            </button>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          4. SOURCE SELECTION CARD (Optional)
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-void-surface border border-edge rounded-xl mb-6">
        <div className="px-6 py-4 border-b border-edge">
          <h2 className="text-base font-semibold text-paper flex items-center gap-2">
            {t('scanPage.sources.title')}
          </h2>
          <p className="text-xs text-paper-muted mt-1">
            {t('scanPage.sources.subtitle')}
          </p>
        </div>

        {/* ── 4B. Source Filters + Quick Actions ─────────────────────── */}
        <div className="px-4 py-2.5 border-b border-edge flex flex-wrap items-center gap-2">
          {/* Filter tabs */}
          <span className="text-[10px] tracking-eyebrow font-semibold text-paper-faint uppercase mr-1">{t('scanPage.labels.sources')}</span>
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSourceFilter(tab.key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${
                sourceFilter === tab.key
                  ? 'bg-signal/10 text-signal dark:text-signal-bright border border-signal/25'
                  : 'bg-void-raised text-paper-faint hover:text-paper border border-edge hover:border-edge-strong'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
          <button
            onClick={() => setHideTestSources(!hideTestSources)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${
              hideTestSources
                ? 'bg-signal/10 text-signal dark:text-signal-bright border border-signal/20'
                : 'bg-void-raised text-paper-faint hover:text-paper border border-edge'
            }`}
            title={hideTestSources ? t('scanPage.sources.testHiddenTitle') : t('scanPage.sources.testShownTitle')}
          >
            {hideTestSources ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {hideTestSources ? t('scanPage.sources.hideTest') : t('scanPage.sources.showTest')}
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={selectAllVisible}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-signal dark:text-signal-bright hover:text-signal-deep dark:hover:text-signal transition-colors duration-150 motion-reduce:transition-none rounded ${focusRing}`}
            >
              <CheckSquare className="w-3 h-3" />
              {t('scanPage.sources.selectAll')}
            </button>
            <button
              onClick={clearSelection}
              className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-paper-faint hover:text-paper transition-colors duration-150 motion-reduce:transition-none rounded ${focusRing}`}
            >
              <Square className="w-3 h-3" />
              {t('scanPage.sources.clearSelection')}
            </button>
            <span className="text-[10px] text-paper-faint font-medium border-l border-edge pl-2 ml-1 tabular-nums">
              <span className="text-signal dark:text-signal-bright">{validSelectedSources.length}</span>/{selectableCount} {t('scanPage.sources.validCount')}
            </span>
          </div>
        </div>

        {/* ── 4C. Source Table — scrollable ──────────────────────────── */}
        <div className="max-h-[340px] overflow-y-auto scrollbar-hide">
          {filteredSources.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Globe className="w-8 h-8 text-paper-faint mx-auto mb-2" />
              <p className="text-xs text-paper-muted font-medium">
                {realSourceCount === 0
                  ? t('scanPage.sources.emptyNoReal')
                  : t('scanPage.sources.emptyNoMatch')}
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-void-raised text-left text-[10px] tracking-eyebrow font-semibold text-paper-faint uppercase border-b border-edge">
                  <th scope="col" className="px-3 py-2 w-8"></th>
                  <th scope="col" className="px-3 py-2">{t('scanPage.table.source')}</th>
                  <th scope="col" className="px-3 py-2 hidden md:table-cell w-20">{t('scanPage.table.type')}</th>
                  <th scope="col" className="px-3 py-2 hidden lg:table-cell w-16">{t('scanPage.table.status')}</th>
                  <th scope="col" className="px-3 py-2 hidden xl:table-cell w-24">{t('scanPage.table.lastCrawl')}</th>
                  <th scope="col" className="px-3 py-2 hidden xl:table-cell w-24">{t('scanPage.table.nextCrawl')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {filteredSources.map((source: any) => {
                  const test = isTestSource(source);
                  const isSupported = ['rss', 'website', 'global_search'].includes((source.source_type || '').toLowerCase());
                  const isUnsupported = !isSupported && source.source_type;
                  const isSelected = selectedSources.includes(source.id);

                  return (
                    <tr
                      key={source.id}
                      className={`transition-colors duration-150 motion-reduce:transition-none ${
                        !isSupported ? 'opacity-50' : 'hover:bg-void-raised cursor-pointer'
                      } ${isSelected ? 'bg-signal/[0.06]' : ''}`}
                      onClick={() => {
                        if (!isSupported) return;
                        if (isSelected) {
                          setSelectedSources(selectedSources.filter((id) => id !== source.id));
                        } else {
                          setSelectedSources([...selectedSources, source.id]);
                          setCustomUrl('');
                        }
                      }}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isSupported}
                          onChange={() => {}}
                          className="rounded border-edge-strong text-signal bg-void-surface pointer-events-none disabled:opacity-40 h-3.5 w-3.5"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-paper truncate flex items-center gap-1.5 flex-wrap text-xs">
                              <span title={source.name}>{source.name}</span>
                              {(() => {
                                if (isUnsupported) {
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-void-raised text-paper-faint border border-edge">
                                      {t('scanPage.badge.unsupported')}
                                    </span>
                                  );
                                }
                                if (test) {
                                  return (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-void-raised text-paper-faint border border-edge">
                                      <FlaskConical className="w-2.5 h-2.5" />
                                      {t('scanPage.badge.testSource')}
                                    </span>
                                  );
                                }
                                const error = source.last_error;
                                const isInvalidRss = error && (error.includes('invalid_rss_feed') ||
                                                     error.includes('Feed parse error') ||
                                                     error.includes('not well-formed') ||
                                                     error.includes('invalid token') ||
                                                     (source.source_type === 'rss' && error.includes('not well-formed')));
                                const isAiConfigError = error && (error.includes('ai_provider_not_configured') ||
                                                        error.includes('openai_dependency_missing') ||
                                                        error.includes('AI chưa cấu hình') ||
                                                        error.includes('thiếu package openai') ||
                                                        error.includes('openai package not installed'));

                                if (isInvalidRss) {
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-destructive/10 text-destructive border border-destructive/25 flex-shrink-0">
                                      {t('scanPage.badge.invalidRss')}
                                    </span>
                                  );
                                } else if (error && !isAiConfigError) {
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-destructive/10 text-destructive border border-destructive/25 flex-shrink-0">
                                      {t('scanPage.badge.crawlError')}
                                    </span>
                                  );
                                } else if (source.last_crawled_at) {
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-success/10 text-success border border-success/25 flex-shrink-0">
                                      {t('scanPage.badge.scanSuccess')}
                                    </span>
                                  );
                                } else {
                                  return (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-void-raised text-paper-faint border border-edge flex-shrink-0">
                                      {t('scanPage.badge.notCrawled')}
                                    </span>
                                  );
                                }
                              })()}
                            </div>
                            <div className="text-[10px] text-paper-faint truncate max-w-xs mt-0.5">{source.url}</div>
                            {(() => {
                              if (isUnsupported || test) return null;

                              const error = source.last_error;
                              const isAiConfigError = error && (error.includes('ai_provider_not_configured') ||
                                                      error.includes('openai_dependency_missing') ||
                                                      error.includes('AI chưa cấu hình') ||
                                                      error.includes('thiếu package openai') ||
                                                      error.includes('openai package not installed'));

                              if (isAiConfigError) {
                                 return (
                                   <div className="mt-1 flex items-center gap-1">
                                     <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-warning/10 text-warning border border-warning/25">
                                       {t('scanPage.badge.aiNotConfigured')}
                                     </span>
                                     <span className="text-[10px] text-paper-faint truncate" title={t('scanPage.badge.aiMissingPackageTitle')}>
                                       {t('scanPage.badge.aiMissingPackage')}
                                     </span>
                                   </div>
                                 );
                              } else if (source.last_crawled_at && (!error || error === '')) {
                                 return (
                                   <div className="mt-1 flex items-center gap-1">
                                     <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-info/10 text-info border border-info/25">
                                       {t('scanPage.badge.aiAnalyzed')}
                                     </span>
                                   </div>
                                 );
                              }
                              return null;
                            })()}

                            {source.last_error && (() => {
                              const error = source.last_error;
                              const isInvalidRss = error.includes('invalid_rss_feed') ||
                                                   error.includes('Feed parse error') ||
                                                   error.includes('not well-formed') ||
                                                   error.includes('invalid token') ||
                                                   ((source.source_type || '').toLowerCase() === 'rss' && error.includes('not well-formed'));
                              if (isInvalidRss) {
                                return (
                                  <div className="text-[10px] text-destructive mt-1 truncate max-w-sm" title={t('scanPage.hints.invalidRssTitle')}>
                                    ⚠ {t('scanPage.hints.invalidRssBody')}
                                  </div>
                                );
                              }

                              // Check if AI error, if so, DO NOT display as crawl error!
                              const isAiConfigError = error.includes('ai_provider_not_configured') ||
                                                      error.includes('openai_dependency_missing') ||
                                                      error.includes('AI chưa cấu hình') ||
                                                      error.includes('thiếu package openai') ||
                                                      error.includes('openai package not installed');
                              if (isAiConfigError) {
                                return null;
                              }

                              let cleanMsg = error;
                              if (error.includes(': ')) {
                                const parts = error.split(': ');
                                if (parts.length > 1) {
                                  cleanMsg = Array.isArray(parts) ? parts.slice(1).join(': ') : error;
                                }
                              }

                              if (test) {
                                return (
                                  <div className="text-[10px] text-paper-faint mt-1 truncate max-w-sm" title={error}>
                                    ⚠ {cleanMsg} {t('scanPage.badge.testErrorSuffix')}
                                  </div>
                                );
                              }

                              return (
                                <div className="text-[10px] text-destructive mt-1 truncate max-w-sm" title={error}>
                                  ⚠ {cleanMsg}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                          isUnsupported ? 'bg-void-raised text-paper-faint border-edge' : 'bg-void-raised text-paper-muted border-edge'
                        }`}>
                          {(source.source_type || '').toLowerCase() === 'rss' ? (
                            <Rss className="w-2.5 h-2.5" />
                          ) : (
                            <Globe className="w-2.5 h-2.5" />
                          )}
                          {source.source_type || 'web'}
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden lg:table-cell">
                        <span className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${source.is_active ? 'bg-success' : 'bg-paper-faint'}`} />
                          <span className="text-[10px] text-paper-faint">{source.is_active ? 'On' : 'Off'}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 hidden xl:table-cell text-[10px] text-paper-faint tabular-nums">
                        {formatDate(source.last_crawled_at)}
                      </td>
                      <td className="px-3 py-2 hidden xl:table-cell text-[10px] text-paper-faint tabular-nums">
                        {formatDate(source.next_crawl_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── 4D. Custom URL — Collapsible ──────────────────────────── */}
        <div className="px-4 py-2 border-t border-edge">
          <button
            onClick={() => setShowCustomUrl(!showCustomUrl)}
            className={`flex items-center gap-1.5 text-[11px] text-paper-faint hover:text-paper font-medium transition-colors duration-150 motion-reduce:transition-none rounded ${focusRing}`}
          >
            {showCustomUrl ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <LinkIcon className="w-3 h-3" />
            {t('scanPage.sources.customUrlToggle')}
          </button>
          {showCustomUrl && (
            <div className="mt-2 relative animate-fadeIn motion-reduce:animate-none">
              <LinkIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-paper-faint w-3.5 h-3.5" />
              <input
                id="custom-url-input"
                type="url"
                value={customUrl}
                onChange={(e) => {
                  setCustomUrl(e.target.value);
                  if (e.target.value) setSelectedSources([]);
                }}
                placeholder={t('scanPage.sources.customUrlPlaceholder')}
                className="w-full pl-9 pr-3 py-2 bg-void-surface border border-edge-strong rounded-lg text-paper text-xs placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
              />
            </div>
          )}
        </div>
      </div>



      {/* ═══════════════════════════════════════════════════════════════════
          5. LATEST SCAN RESULT — Compact card (only if exists)
         ═══════════════════════════════════════════════════════════════════ */}
      {latestJob && (
        <div className={`rounded-xl border px-4 py-3 flex flex-wrap items-center gap-3 ${
          latestJob.status === 'completed' ? 'bg-success/5 border-success/20' :
          latestJob.status === 'failed' ? 'bg-destructive/5 border-destructive/20' :
          latestJob.status === 'running' ? 'bg-signal/5 border-signal/20' :
          'bg-void-raised border-edge'
        }`}>
          <div className="flex items-center gap-2">
            {getStatusBadge(latestJob.status)}
            {getJobTypeBadge(latestJob.job_type)}
            <span className="text-[10px] text-paper-faint font-mono">#{latestJob.id}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-paper-muted font-medium">
            <span>{t('scanPage.labels.sources')} <strong className="text-paper tabular-nums">{latestJob.processed_sources}/{latestJob.total_sources}</strong></span>
            <span>{t('scanPage.labels.mentions')} <strong className="text-paper tabular-nums">{latestJob.mentions_found}</strong></span>
            {latestJob.completed_at && <span>{t('scanPage.labels.finished')} {formatDate(latestJob.completed_at)}</span>}
          </div>
          {latestJob.mentions_found > 0 && (
            <Link
              href={latestJob.project_id ? `/dashboard/mentions?project_id=${latestJob.project_id}&job_id=${latestJob.id}` : `/dashboard/mentions?job_id=${latestJob.id}`}
              className={`ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-signal dark:text-signal-bright hover:text-signal-deep dark:hover:text-signal transition-colors duration-150 motion-reduce:transition-none rounded ${focusRing}`}
            >
              {t('scanPage.actions.viewMentions')}
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
          {latestJob.error_message && (
            <div className="w-full mt-1">
              <span className="text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20 inline-block truncate max-w-full" title={latestJob.error_message}>
                ❌ {latestJob.error_message.substring(0, 120)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          5.5. SCAN SCHEDULES PANEL
         ═══════════════════════════════════════════════════════════════════ */}
      <ScanSchedulesPanel keywordGroups={keywordGroups} />

      {/* ═══════════════════════════════════════════════════════════════════
          6. CRAWL JOBS HISTORY — Collapsible
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-void-surface rounded-xl border border-edge overflow-hidden">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`w-full px-4 py-3 flex items-center justify-between hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-signal dark:text-signal-bright" />
            <h2 className="text-sm font-semibold text-paper">{t('scanPage.history.title')}</h2>
            <span className="text-[10px] text-paper-faint font-medium bg-void-raised px-2 py-0.5 rounded tabular-nums">{crawlJobs.length}</span>
          </div>
          {showHistory ? <ChevronUp className="w-4 h-4 text-paper-faint" /> : <ChevronDown className="w-4 h-4 text-paper-faint" />}
        </button>

        {showHistory && (
          <div className="border-t border-edge divide-y divide-edge max-h-[340px] overflow-y-auto scrollbar-hide">
            {crawlJobs.length === 0 ? (
              <p className="text-paper-faint text-center py-6 text-xs font-medium">{t('scanPage.history.empty')}</p>
            ) : (
              crawlJobs.map((job) => (
                <div key={job.id} className="px-4 py-3 hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getJobTypeBadge(job.job_type)}
                      {getStatusBadge(job.status)}
                      <span className="text-[10px] text-paper-faint font-mono">#{job.id}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-paper font-medium tabular-nums">{job.mentions_found} mentions</span>
                      {job.status === 'completed' && job.mentions_found > 0 && (
                        <Link
                          href={job.project_id ? `/dashboard/mentions?project_id=${job.project_id}&job_id=${job.id}` : `/dashboard/mentions?job_id=${job.id}`}
                          className={`inline-flex items-center gap-1 text-[10px] font-medium text-signal dark:text-signal-bright hover:text-signal-deep dark:hover:text-signal transition-colors duration-150 motion-reduce:transition-none rounded ${focusRing}`}
                        >
                          <Eye className="w-3 h-3" />
                          {t('scanPage.actions.view')}
                        </Link>
                      )}
                      {(job.status === 'failed' || job.status === 'cancelled') && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          disabled={retryingJobId === job.id}
                          className={`flex items-center px-2 py-1 text-[10px] font-medium text-warning bg-warning/10 border border-warning/20 rounded-md hover:bg-warning/20 transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 ${focusRing}`}
                        >
                          {retryingJobId === job.id ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin motion-reduce:animate-none" />
                          ) : (
                            <RefreshCw className="w-3 h-3 mr-1" />
                          )}
                          {t('scanPage.actions.retry')}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-medium text-paper-faint">
                    <span>{t('scanPage.labels.sources')} <strong className="text-paper-muted tabular-nums">{job.processed_sources}/{job.total_sources}</strong></span>
                    {job.status === 'completed' && job.total_sources > job.processed_sources && (
                      <span className="text-destructive tabular-nums">{t('scanPage.history.failedSources', { count: job.total_sources - job.processed_sources })}</span>
                    )}
                    {job.created_at && <span>{t('scanPage.labels.created')} {formatDate(job.created_at)}</span>}
                    {job.completed_at && <span>{t('scanPage.labels.finished')} {formatDate(job.completed_at)}</span>}
                    {job.retry_count > 0 && <span className="text-warning tabular-nums">{t('scanPage.history.retryCount', { count: job.retry_count })}</span>}
                  </div>
                  {job.error_message && (
                    <p className="mt-1.5 text-[10px] text-destructive bg-destructive/10 px-2 py-1 rounded border border-destructive/20 truncate" title={job.error_message}>
                      ❌ {job.error_message}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          DEBUG PANEL — Collapsible connection diagnostics
         ═══════════════════════════════════════════════════════════════════ */}
      <div className="bg-void-surface border border-edge rounded-xl overflow-hidden">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className={`w-full px-4 py-3 flex items-center justify-between hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
        >
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-paper-faint" />
            <h2 className="text-sm font-semibold text-paper-muted">{t('scanPage.debug.title')}</h2>
          </div>
          {showDebug ? <ChevronUp className="w-4 h-4 text-paper-faint" /> : <ChevronDown className="w-4 h-4 text-paper-faint" />}
        </button>

        {showDebug && (
          <div className="border-t border-edge px-4 py-3 font-mono text-[11px] space-y-1.5">
            <div className="flex gap-2"><span className="text-paper-faint min-w-[160px]">NEXT_PUBLIC_API_URL:</span><span className="text-info break-all">{process.env.NEXT_PUBLIC_API_URL || '(not set — fallback to localhost)'}</span></div>
            <div className="flex gap-2"><span className="text-paper-faint min-w-[160px]">API_BASE_URL (resolved):</span><span className="text-info break-all">{API_BASE_URL}</span></div>
            <div className="flex gap-2"><span className="text-paper-faint min-w-[160px]">capabilities URL:</span><span className="text-paper-muted break-all">{API_BASE_URL}/api/crawl/capabilities</span></div>
            <div className="flex gap-2"><span className="text-paper-faint min-w-[160px]">manual-scan URL:</span><span className="text-paper-muted break-all">{API_BASE_URL}/api/crawl/manual-scan</span></div>
            <div className="flex gap-2"><span className="text-paper-faint min-w-[160px]">{t('scanPage.debug.authTokenExists')}</span><span className={debugInfo.hasAuthToken ? 'text-success' : 'text-destructive'}>{debugInfo.hasAuthToken ? 'true' : 'false'}</span></div>

            {debugInfo.lastUrl && (
              <>
                <div className="border-t border-edge mt-2 pt-2" />
                <div className="text-paper-muted font-semibold">{t('scanPage.debug.lastCall')}</div>
                <div className="flex gap-2"><span className="text-paper-faint min-w-[160px]">URL:</span><span className="text-warning break-all">{debugInfo.lastUrl}</span></div>
                <div className="flex gap-2"><span className="text-paper-faint min-w-[160px]">{t('scanPage.debug.payload')}</span><span className="text-paper-muted break-all">{JSON.stringify(debugInfo.lastPayload)}</span></div>
                <div className="flex gap-2"><span className="text-paper-faint min-w-[160px]">{t('scanPage.debug.responseStatus')}</span><span className={debugInfo.lastStatus === 200 ? 'text-success' : debugInfo.lastStatus ? 'text-destructive' : 'text-paper-faint'}>{debugInfo.lastStatus ?? '(no response)'}</span></div>
                {debugInfo.lastErrorName && (
                  <div className="flex gap-2"><span className="text-paper-faint min-w-[160px]">{t('scanPage.debug.errorName')}</span><span className="text-destructive">{debugInfo.lastErrorName}</span></div>
                )}
                {debugInfo.lastErrorMessage && (
                  <div className="flex gap-2"><span className="text-paper-faint min-w-[160px]">{t('scanPage.debug.errorMessage')}</span><span className="text-destructive break-all">{debugInfo.lastErrorMessage}</span></div>
                )}
                {debugInfo.lastResponseData && (
                  <div className="flex gap-2"><span className="text-paper-faint min-w-[160px]">{t('scanPage.debug.responseData')}</span><span className="text-paper-muted break-all">{(JSON.stringify(debugInfo.lastResponseData) || '').slice(0, 500)}</span></div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
