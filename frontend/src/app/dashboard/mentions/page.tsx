'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Search, Eye, Trash2, FileText, X, ExternalLink,
  ArrowUpDown, ChevronDown, ChevronUp, Filter, BarChart3,
  Globe, Rss, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, BrainCircuit, Loader2,
  Facebook, Youtube, RefreshCw, SlidersHorizontal, Sparkles,
  Twitter, Instagram, Mic, Video, Link2Off, Tag,
  SearchCode, Download, CheckSquare, Square, Calendar,
  Scan, ChevronLeft, ChevronRight, Info, Link2, ShieldAlert, ShieldCheck
} from 'lucide-react';
import { mentions as mentionsApi, dashboard, keywords as keywordsApi, crawl, savedFilters } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useDialog } from '@/components/ui/Dialog';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  chartColors,
  chartGrid,
  chartAxisTick,
  chartTooltipStyle,
  chartTooltipItemStyle,
  chartTooltipLabelStyle,
} from '@/components/dashboard/chartTheme';
import { getSafeVisitUrl, getVisitUrlStatus } from '@/lib/visit-url';
import { MentionFilterBar } from '@/components/mentions/MentionFilterBar';
import { MentionActiveFilterChips } from '@/components/mentions/MentionActiveFilterChips';
import { MentionActionMenu } from '@/components/mentions/MentionActionMenu';
import { MentionEmptyResults } from '@/components/mentions/MentionEmptyResults';
import { AntiNoiseNotice } from '@/components/mentions/AntiNoiseNotice';
import { MentionFilterErrorState } from '@/components/mentions/MentionFilterErrorState';
import { useLanguage } from '@/contexts/LanguageContext';
import { SentimentBadge } from '@/components/ui/SentimentBadge';

/* ═══════════════════════════════════════════════════════════════════════════
   TYPE DEFINITIONS
   ═══════════════════════════════════════════════════════════════════════════ */

interface MentionItem {
  id: number;
  job_id: number | null;
  source_id: number;
  source_name: string;
  source_type: string;
  title: string | null;
  content: string;
  url: string | null;
  canonical_url?: string | null;
  original_url?: string | null;
  permalink?: string | null;
  source_url?: string | null;
  visit_url_invalid_reason?: string | null;
  source_integrity_level?: 'high' | 'medium' | 'low' | 'unavailable' | null;
  source_confidence?: number | 'low' | 'high' | null;
  author: string | null;
  published_at: string | null;
  collected_at: string | null;
  is_reviewed: boolean;
  is_muted: boolean;
  add_to_report: boolean;
  matched_keywords: any[] | null;
  snippet: string | null;
  sentiment: string | null;
  domain: string | null;
  influence_score: number | null;
  tags?: string[] | string;
  tags_json: string[] | null;
  risk_score?: number;
  crisis_level?: number;
  ai_analysis: {
    sentiment: string | null;
    risk_score: number | null;
    crisis_level: number | null;
    summary_vi: string | null;
    suggested_action: string | null;
    ai_provider: string | null;
    vietnamese_context_label: string | null;
    tone: string | null;
    sarcasm_possible: boolean | null;
    complaint_type: string | null;
    sensitive_signal: boolean | null;
  } | null;
  metadata: {
    source_type?: string;
    discovery_job_id?: number;
    [key: string]: any;
  } | null;
  visit_count?: number;
  last_visited_at?: string | null;
  is_visited?: boolean;
  matched_in?: string[];
  match_strength?: string;
}

interface Filters {
  sentiment: string | null;
  source_type: string | null;
  min_risk_score: number | null;
  min_influence_score: number | null;
  add_to_report?: boolean | null;
  sort_by: string;
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const SENTIMENT_OPTIONS = [
  { value: 'positive', label: 'Tích cực', labelKey: 'mentions.sentiment.positive', dot: 'bg-sentiment-positive', bg: 'bg-sentiment-positive/10 border-sentiment-positive/25 text-sentiment-positive' },
  { value: 'neutral', label: 'Trung lập', labelKey: 'mentions.sentiment.neutral', dot: 'bg-sentiment-neutral', bg: 'bg-sentiment-neutral/10 border-sentiment-neutral/25 text-sentiment-neutral' },
  { value: 'negative', label: 'Tiêu cực', labelKey: 'mentions.sentiment.negative', dot: 'bg-sentiment-negative', bg: 'bg-sentiment-negative/10 border-sentiment-negative/25 text-sentiment-negative' },
];

/* One accent only (SIGNAL): per-network brand hues collapse to the neutral ink ramp. */
const SOURCE_TYPE_OPTIONS = [
  { value: 'web', label: 'Web', labelKey: 'mentions.sourceType.web', icon: Globe, color: 'text-paper-muted', disabled: false },
  { value: 'news', label: 'News', labelKey: 'mentions.sourceType.news', icon: FileText, color: 'text-paper-muted', disabled: false },
  { value: 'blog', label: 'Blogs/Forums', labelKey: 'mentions.sourceType.blog', icon: FileText, color: 'text-paper-muted', disabled: false },
  { value: 'video', label: 'YouTube', labelKey: 'mentions.sourceType.video', icon: Youtube, color: 'text-paper-muted', disabled: false },
  { value: 'rss', label: 'RSS', labelKey: 'mentions.sourceType.rss', icon: Rss, color: 'text-paper-muted', disabled: false },
  { value: 'facebook_page', label: 'Facebook', labelKey: 'mentions.sourceType.facebook_page', icon: Facebook, color: 'text-paper-muted', disabled: true, msg: 'Kết nối', msgKey: 'mentions.sourceType.msg.connect' },
  { value: 'instagram', label: 'Instagram', labelKey: 'mentions.sourceType.instagram', icon: Instagram, color: 'text-paper-muted', disabled: true, msg: 'Kết nối', msgKey: 'mentions.sourceType.msg.connect' },
  { value: 'twitter', label: 'X/Twitter', labelKey: 'mentions.sourceType.twitter', icon: Twitter, color: 'text-paper-muted', disabled: true, msg: 'Sắp hỗ trợ', msgKey: 'mentions.sourceType.msg.comingSoon' },
  { value: 'reddit', label: 'Reddit', labelKey: 'mentions.sourceType.reddit', icon: Globe, color: 'text-paper-muted', disabled: true, msg: 'Sắp hỗ trợ', msgKey: 'mentions.sourceType.msg.comingSoon' },
  { value: 'tiktok', label: 'TikTok', labelKey: 'mentions.sourceType.tiktok', icon: Video, color: 'text-paper-muted', disabled: true, msg: 'Kết nối', msgKey: 'mentions.sourceType.msg.connect' },
  { value: 'podcast', label: 'Podcasts', labelKey: 'mentions.sourceType.podcast', icon: Mic, color: 'text-paper-muted', disabled: true, msg: 'Sắp hỗ trợ', msgKey: 'mentions.sourceType.msg.comingSoon' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Mới nhất', labelKey: 'mentions.sort.newest' },
  { value: 'oldest', label: 'Cũ nhất', labelKey: 'mentions.sort.oldest' },
  { value: 'risk_high', label: 'Risk cao → thấp', labelKey: 'mentions.sort.risk_high' },
  { value: 'risk_low', label: 'Risk thấp → cao', labelKey: 'mentions.sort.risk_low' },
  { value: 'influence_high', label: 'Ảnh hưởng cao', labelKey: 'mentions.sort.influence_high' },
  { value: 'engagement_high', label: 'Tương tác cao', labelKey: 'mentions.sort.engagement_high' },
];

const RISK_PRESETS = [
  { value: null, label: 'Tất cả', labelKey: 'mentions.risk.all' },
  { value: 40, label: '≥ 40' },
  { value: 60, label: '≥ 60' },
  { value: 80, label: '≥ 80' },
];

/* Shared SIGNAL micro-interaction primitive (focus states, reduced-motion honored) */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function SourceIcon({ type, className }: { type: string; className?: string }) {
  const baseClass = className || 'w-4 h-4';
  switch (type?.toLowerCase()) {
    case 'facebook':
    case 'facebook_page':
    case 'facebook_group':
      return <Facebook className={baseClass} />;
    case 'instagram':
      return <Instagram className={baseClass} />;
    case 'twitter':
      return <Twitter className={baseClass} />;
    case 'tiktok':
    case 'video':
    case 'youtube':
      return <Youtube className={baseClass} />;
    case 'rss':
      return <Rss className={baseClass} />;
    case 'news':
    case 'blog':
      return <FileText className={baseClass} />;
    default:
      return <Globe className={baseClass} />;
  }
}

function formatRelativeTime(dateStr: string | null, t?: any) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t ? t('mentions.time.justNow') : 'Vừa xong';
  if (diffMin < 60) return `${diffMin} ${t ? t('mentions.time.minutesAgo') : 'phút trước'}`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ${t ? t('mentions.time.hoursAgo') : 'giờ trước'}`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ${t ? t('mentions.time.daysAgo') : 'ngày trước'}`;
  return d.toLocaleDateString('vi-VN');
}

function highlightKeywords(text: string, keywords: any[] | null) {
  if (!keywords || keywords.length === 0 || !text) return text;
  const kwStrings = keywords
    .map((k: any) => (typeof k === 'string' ? k : k.keyword))
    .filter(Boolean);
  if (kwStrings.length === 0) return text;
  const escaped = kwStrings.map((s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = `(${escaped.join('|')})`;
  const splitRegex = new RegExp(pattern, 'gi');
  const parts = text.split(splitRegex);
  return parts.map((part, i) => {
    // Use a fresh regex per test to avoid lastIndex statefulness
    const testRegex = new RegExp(pattern, 'i');
    return testRegex.test(part) ? (
      <mark key={i} className="bg-signal/20 text-signal dark:text-signal-bright rounded px-0.5">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    );
  });
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-warning/25 text-paper rounded px-0.5 font-medium">{part}</mark>
      : part
  );
}

function getSafeUrl(url: string | null | undefined): string | null {
  return getSafeVisitUrl(url) || null;
}

function getSourceIntegrityLabel(level: string | null | undefined, t?: any): { label: string; color: string; title: string } | null {
  switch (level) {
    case 'high': return null; // No badge for high confidence — expected baseline
    case 'medium': return { label: '\u25cf', color: 'text-warning/70', title: t ? t('mentions.trust.medium') : 'Nguồn: độ tin cậy trung bình' };
    case 'low': return { label: '\u25cf', color: 'text-warning', title: t ? t('mentions.trust.low') : 'Nguồn: độ tin cậy thấp — link có thể không chính xác' };
    case 'unavailable': return { label: '\u25cf', color: 'text-paper-faint', title: t ? t('mentions.trust.unavailable') : 'Nguồn: không xác minh được' };
    default: return null;
  }
}

function keywordToText(keyword: any): string | null {
  if (typeof keyword === 'string') return keyword.trim() || null;
  if (!keyword || typeof keyword !== 'object') return null;
  const value = keyword.keyword ?? keyword.name ?? keyword.value ?? keyword.text ?? keyword.search_query;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function keywordTexts(keywords: any[] | null | undefined): string[] {
  return (keywords || []).map(keywordToText).filter((value): value is string => Boolean(value));
}

// Use extracted helper
import { getMentionSourceLabel } from '@/lib/utils/mentions';

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function MentionsPageContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialJobId = searchParams?.get('job_id');
  const initialSearch = searchParams?.get('q') || searchParams?.get('keyword');

  const initialProjectId = searchParams?.get('project_id');

  const translatedSortOptions = React.useMemo(() => SORT_OPTIONS.map(opt => ({
    ...opt,
    label: opt.labelKey ? t(opt.labelKey) : opt.label
  })), [t]);

  const translatedSourceTypeOptions = React.useMemo(() => SOURCE_TYPE_OPTIONS.map(opt => ({
    ...opt,
    label: opt.labelKey ? t(opt.labelKey) : opt.label,
    msg: opt.msgKey ? t(opt.msgKey) : opt.msg
  })), [t]);

  // Data
  const [mentionsList, setMentionsList] = useState<MentionItem[]>([]);
  const [totalMentions, setTotalMentions] = useState<number>(0);
  const [totalPages, setTotalPages] = useState(1);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [sentimentSummary, setSentimentSummary] = useState<any>(null);
  const [topicsData, setTopicsData] = useState<any[]>([]);
  const [sourceCounts, setSourceCounts] = useState<Record<string, number>>({});
  const { activeProject, setActiveProject, projects, fetchProjects } = useProject();
  const { confirm, prompt } = useDialog();
  // UI state
  const [loading, setLoading] = useState(true);
  const [loadingChart, setLoadingChart] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(initialSearch || '');
  const [searchInput, setSearchInput] = useState(initialSearch || '');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'reach' | 'sentiment'>('reach');
  const [chartTimeRange, setChartTimeRange] = useState<'days' | 'weeks' | 'months'>('days');

  const currentFetchIdRef = useRef<number>(0);
  const chartFetchIdRef = useRef<number>(0);
  const sourceFetchIdRef = useRef<number>(0);
  const scannedKeywordsRef = useRef<Set<string>>(new Set());

  const [searchState, setSearchState] = useState<'IDLE' | 'TYPING' | 'SEARCHING_DB' | 'LOCAL_RESULTS_FOUND' | 'NO_LOCAL_RESULTS' | 'AUTO_SCAN_STARTING' | 'AUTO_SCAN_RUNNING' | 'AUTO_SCAN_COMPLETED' | 'AUTO_SCAN_NO_RESULTS' | 'AUTO_SCAN_FAILED'>('IDLE');

  useEffect(() => {
    const handleTyping = () => setSearchState('TYPING');
    window.addEventListener('topbar_search_typing', handleTyping);
    return () => window.removeEventListener('topbar_search_typing', handleTyping);
  }, []);

  useEffect(() => {
    const q = searchParams?.get('q') || searchParams?.get('keyword') || '';
    if (q !== searchTerm) {
      setSearchTerm(q);
      setSearchInput(q);
      setPage(1);
      setActiveScanJobId(null);
      setActiveScanKeyword('');
      setScanJobStatus(null);
      // Reset scanned keywords when query changes so new scan triggers
      if (q) {
        scannedKeywordsRef.current?.clear();
        setSearchState('SEARCHING_DB');
      } else {
        setSearchState('IDLE');
      }
    } else {
      setSearchState(prev => prev === 'TYPING' ? (q ? 'LOCAL_RESULTS_FOUND' : 'IDLE') : prev);
    }
  }, [searchParams, searchTerm]);
  const [filters, setFilters] = useState<Filters>({
    sentiment: null,
    source_type: null,
    min_risk_score: null,
    min_influence_score: null,
    sort_by: 'newest',
  });
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false);
  const [savedFiltersList, setSavedFiltersList] = useState<any[]>([]);
  const [saveFilterModalOpen, setSaveFilterModalOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const [saveFilterOverwrite, setSaveFilterOverwrite] = useState(false);
  const [dateRange, setDateRange] = useState('30d');
  const [summarizeDrawerOpen, setSummarizeDrawerOpen] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; mentionId: number | null; mentionTitle: string }>({
    isOpen: false,
    mentionId: null,
    mentionTitle: '',
  });
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === mentionsList.length && mentionsList.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(mentionsList.map((m) => m.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: t('mentions.page.bulkDeleteTitle').replace('{count}', String(selectedIds.size)),
      message: t('mentions.page.bulkDeleteMessage').replace('{count}', String(selectedIds.size)),
      confirmText: t('mentions.page.bulkDeleteConfirm'),
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await mentionsApi.bulkDelete(Array.from(selectedIds));
      toast.success(t('mentions.page.bulkDeleted').replace('{count}', String(selectedIds.size)));
      setSelectedIds(new Set());
      fetchMentions();
    } catch (e) {
      toast.error(t('mentions.page.bulkDeleteError'));
    }
  };

  const handleBulkReview = async (isReviewed: boolean) => {
    if (selectedIds.size === 0) return;
    try {
      await mentionsApi.bulkReview(Array.from(selectedIds), isReviewed);
      toast.success(`Đã đánh dấu ${selectedIds.size} mentions`);
      setMentionsList(prev => prev.map(m => selectedIds.has(m.id) ? { ...m, is_reviewed: isReviewed } : m));
      setSelectedIds(new Set());
    } catch (e) {
      toast.error('Lỗi cập nhật mentions');
    }
  };

  const handleBulkSentiment = async (sentiment: string) => {
    if (selectedIds.size === 0) return;
    try {
      await mentionsApi.bulkSentiment(Array.from(selectedIds), sentiment);
      toast.success(`Đã cập nhật cảm xúc ${selectedIds.size} mentions`);
      setMentionsList(prev => prev.map(m => selectedIds.has(m.id) ? { ...m, sentiment } : m));
      setSelectedIds(new Set());
    } catch (e) {
      toast.error('Lỗi cập nhật mentions');
    }
  };

  const hasSyncedUrlProject = useRef(false);

  // NEW SCAN STATES
  const [activeScanJobId, setActiveScanJobId] = useState<number | null>(null);
  const [activeScanKeyword, setActiveScanKeyword] = useState<string>('');
  const [scanJobStatus, setScanJobStatus] = useState<any>(null);

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const scanStartTimeRef = useRef<number | null>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const savedFiltersRef = useRef<HTMLDivElement>(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
      if (savedFiltersRef.current && !savedFiltersRef.current.contains(e.target as Node)) {
        setSavedFiltersOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch saved filters
  useEffect(() => {
    if (activeProject) {
      fetchSavedFilters();
    }
  }, [activeProject]);

  const fetchSavedFilters = async () => {
    try {
      const data = await savedFilters.list(activeProject?.id);
      setSavedFiltersList(data.items || []);
    } catch (error) {
      console.error('Error fetching saved filters:', error);
    }
  };

  const handleSaveFilter = async () => {
    if (!saveFilterName.trim()) {
      toast.error('Vui lòng nhập tên bộ lọc');
      return;
    }

    try {
      const filterJson = {
        ...filters,
        search_term: searchTerm,
      };

      // Check if filter with same name exists
      const existingFilter = savedFiltersList.find((sf: any) => sf.name === saveFilterName.trim());

      if (existingFilter && !saveFilterOverwrite) {
        const ok = await confirm({
          title: 'Ghi đè bộ lọc',
          message: `Bộ lọc "${saveFilterName}" đã tồn tại. Bạn có muốn ghi đè không?`,
          confirmText: 'Ghi đè',
          cancelText: t('common.cancel'),
          variant: 'warning',
        });
        if (!ok) {
          return;
        }
        setSaveFilterOverwrite(true);
      }

      if (existingFilter) {
        await savedFilters.update(existingFilter.id, { name: saveFilterName.trim(), filter_json: filterJson });
        toast.success('Đã cập nhật bộ lọc');
      } else {
        await savedFilters.create({ name: saveFilterName.trim(), filter_json: filterJson }, activeProject?.id);
        toast.success('Đã lưu bộ lọc');
      }

      setSaveFilterModalOpen(false);
      setSaveFilterName('');
      setSaveFilterOverwrite(false);
      fetchSavedFilters();
    } catch (error) {
      toast.error('Lỗi khi lưu bộ lọc');
    }
  };

  const openSaveFilterModal = () => {
    setSaveFilterName('');
    setSaveFilterOverwrite(false);
    setSaveFilterModalOpen(true);
  };

  const handleApplyFilter = async (filterId: number) => {
    try {
      const filter = await savedFilters.get(filterId);
      const filterJson = filter.filter_json;

      // Apply filters
      setFilters({
        sentiment: filterJson.sentiment || null,
        source_type: filterJson.source_type || null,
        min_risk_score: filterJson.min_risk_score || null,
        min_influence_score: filterJson.min_influence_score || null,
        sort_by: filterJson.sort_by || 'newest',
      });
      setSearchTerm(filterJson.search_term || '');
      setSearchInput(filterJson.search_term || '');
      setPage(1);
      const newParams = new URLSearchParams(searchParams?.toString() || '');
      if (filterJson.search_term) {
        newParams.set('q', filterJson.search_term);
      } else {
        newParams.delete('q');
      }
      newParams.delete('keyword');
      newParams.delete('job_id');
      const queryString = newParams.toString();
      router.push(queryString ? `/dashboard/mentions?${queryString}` : '/dashboard/mentions');

      toast.success('Đã áp dụng bộ lọc');
      setSavedFiltersOpen(false);
    } catch (error) {
      toast.error('Lỗi khi áp dụng bộ lọc');
    }
  };

  const handleDeleteFilter = async (filterId: number) => {
    const ok = await confirm({
      title: t('mentions.page.deleteFilterTitle'),
      message: t('mentions.page.deleteFilterMessage'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      variant: 'danger'
    });
    if (!ok) return;

    try {
      await savedFilters.delete(filterId);
      toast.success('Đã xóa bộ lọc');
      fetchSavedFilters();
    } catch (error) {
      toast.error('Lỗi khi xóa bộ lọc');
    }
  };

  const handleSummarize = async () => {
    try {
      setSummarizing(true);
      setAiSummary(null);

      const payload: any = {
        project_id: activeProject?.id,
      };

      // Add filters
      if (filters.sentiment) payload.filters = { ...payload.filters, sentiment: filters.sentiment };
      if (filters.source_type) payload.filters = { ...payload.filters, source_type: filters.source_type };
      if (filters.min_risk_score !== null) payload.filters = { ...payload.filters, min_risk_score: filters.min_risk_score };
      if (filters.min_influence_score !== null) payload.filters = { ...payload.filters, min_influence_score: filters.min_influence_score };
      if (searchTerm) payload.filters = { ...payload.filters, search_query: searchTerm };

      // If specific mention IDs are selected (future feature), add them
      // For now, summarize based on current filtered view

      const result = await mentionsApi.summarize(payload);
      setAiSummary(result);
      setSummarizeDrawerOpen(true);
      toast.success('Đã tạo tóm tắt AI');
    } catch (error: any) {
      console.error('[API Error] POST /api/mentions/summarize ->', error?.response?.status || error.message);
      toast.error(error?.response?.data?.detail || 'Không tạo được tóm tắt AI lúc này');
    } finally {
      setSummarizing(false);
    }
  };

  /* ─── DATA FETCHING ─────────────────────────────────────────────────── */

  const fetchMentions = useCallback(async (forceRefresh = false, forcePage1 = false) => {
    const fetchId = ++currentFetchIdRef.current;
    try {
      setLoading(true);
      const currentPage = forcePage1 ? 1 : page;
      // Khi page = 1 (tá»©c lÃ  query/filter thay Ä'á»•i), clear dá»¯ liá»‡u cÅ© Ä'á»ƒ hiá»ƒn thá»‹ loading chÃ­nh xÃ¡c
      if (currentPage === 1) {
        setMentionsList([]);
      }

      const params: any = {
        page: currentPage,
        page_size: 20,
        sort_by: filters.sort_by,
      };
      if (forceRefresh === true) {
        params.refresh = true;
      }
      if (initialJobId) {
        params.job_id = initialJobId;
      } else {
        // Apply q instead of keyword so backend searches only title, snippet, and content.
        if (searchTerm) {
          params.q = searchTerm;
        }
        if (filters.sentiment) params.sentiment = filters.sentiment;
        if (filters.source_type) params.source_type = filters.source_type;
        if (filters.min_risk_score !== null) params.min_risk_score = filters.min_risk_score;
        if (filters.min_influence_score !== null) params.min_influence_score = filters.min_influence_score;

        if (dateRange && dateRange !== 'all') {
          const now = new Date();
          const from = new Date();
          if (dateRange === '1d') from.setDate(now.getDate() - 1);
          else if (dateRange === '7d') from.setDate(now.getDate() - 7);
          else if (dateRange === '30d') from.setDate(now.getDate() - 30);
          else if (dateRange === '90d') from.setDate(now.getDate() - 90);

          params.date_from = from.toISOString();
          params.date_to = now.toISOString();
        }
      }
      if (activeProject) params.project_id = activeProject.id;

      const data = await mentionsApi.list(params);
      if (fetchId !== currentFetchIdRef.current) return;

      setFetchError(null);
      setMentionsList(data.items);
      setTotalMentions(data.total);
      setTotalPages(data.total_pages);

      // Auto-trigger scan on EVERY search (not just empty results) if < threshold
      if (searchTerm && !initialJobId && !activeScanJobId && activeProject) {
        const keywordLower = searchTerm.toLowerCase().trim();
        const allowlist = ['tth', 'fpt', 'vtv', 'vnpt', 'f88', '24h'];
        const isAllowedShort = allowlist.includes(keywordLower);

        if ((keywordLower.length >= 3 || isAllowedShort) && !scannedKeywordsRef.current?.has(keywordLower)) {
          if (data.total < 20) {
            scannedKeywordsRef.current?.add(keywordLower);
            // Show existing results immediately, scan runs in background
            if (data.total > 0) {
              setSearchState('LOCAL_RESULTS_FOUND');
            } else {
              setSearchState('AUTO_SCAN_STARTING');
            }
            crawl.manualScan({
                project_id: activeProject.id,
                query: searchTerm,
                expand_keywords: true,
                mode: 'AUTO_DISCOVERY',
                source_types: filters.source_type ? [filters.source_type] : [],
                max_results: 20,
                auto_triggered: true,
                reason: 'live_search_low_results',
                current_result_count: data.total
              }).then((res) => {
              if (fetchId !== currentFetchIdRef.current) return;
              if (res.message === "Returned existing recent job to prevent duplicate crawl" || res.message === "Returned existing running job to prevent duplicate crawl") {
                toast.success(`Đang theo dõi tiến độ quét '${searchTerm}'...`, { icon: '🔍' });
              } else {
                toast.success(`Đang quét thêm '${searchTerm}' do ít kết quả...`, { icon: '🔍' });
              }
              setActiveScanJobId(res.job_id);
              setActiveScanKeyword(searchTerm);
              setScanJobStatus({ status: 'QUEUED' });
              setSearchState('AUTO_SCAN_RUNNING');
              scanStartTimeRef.current = Date.now();
            }).catch((err) => {
              console.error('Scan error:', err);
              setSearchState(data.total > 0 ? 'LOCAL_RESULTS_FOUND' : 'AUTO_SCAN_FAILED');
              scannedKeywordsRef.current?.delete(keywordLower);
            });
          } else {
            // Sufficient results, no need to auto-scan
            setSearchState('LOCAL_RESULTS_FOUND');
          }
        } else {
          // Already scanned or too short
          if (data.total === 0) setSearchState('NO_LOCAL_RESULTS');
          else setSearchState('LOCAL_RESULTS_FOUND');
        }
      } else if (data.total === 0 && searchTerm) {
        setSearchState('NO_LOCAL_RESULTS');
      } else {
        if (searchTerm) setSearchState('LOCAL_RESULTS_FOUND');
        else setSearchState('IDLE');
      }
    } catch (error: any) {
      if (fetchId !== currentFetchIdRef.current) return;
      console.error('Error fetching mentions:', error);
      const errMsg = error.response?.data?.detail || error.message || 'Lỗi khi tải mentions';
      setFetchError(errMsg);
      toast.error(errMsg);
      setSearchState('NO_LOCAL_RESULTS');
    } finally {
      if (fetchId === currentFetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [page, filters, initialJobId, searchTerm, activeProject?.id, dateRange]);

  const fetchMentionsRef = useRef(fetchMentions);
  useEffect(() => {
    fetchMentionsRef.current = fetchMentions;
  }, [fetchMentions]);

  
  const fetchTopicsData = useCallback(async () => {
    try {
      const params: any = {};
      if (activeProject) params.project_id = activeProject.id;
      if (searchTerm) params.search_query = searchTerm;
      if (filters.source_type) params.source_type = filters.source_type;
      if (filters.sentiment) params.sentiment = filters.sentiment;
      if (filters.min_influence_score) params.min_influence_score = filters.min_influence_score;
      
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        const from = new Date();
        if (dateRange === '1d') from.setDate(now.getDate() - 1);
        else if (dateRange === '7d') from.setDate(now.getDate() - 7);
        else if (dateRange === '30d') from.setDate(now.getDate() - 30);
        else if (dateRange === '90d') from.setDate(now.getDate() - 90);
        params.date_from = from.toISOString();
        params.date_to = now.toISOString();
      }

      const response = await mentionsApi.topics(params);
      setTopicsData(response.topics || []);
    } catch (error) {
      console.error('Error fetching topics:', error);
    }
  }, [activeProject, searchTerm, filters, dateRange]);

  const fetchChartData = useCallback(async () => {
    const fetchId = ++chartFetchIdRef.current;
    if (fetchId === chartFetchIdRef.current) setChartLoading(true);
    try {
      let granularity = 'daily';
      if (chartTimeRange === 'days') {
        granularity = 'daily';
      } else if (chartTimeRange === 'weeks') {
        granularity = 'weekly';
      } else if (chartTimeRange === 'months') {
        granularity = 'monthly';
      }

      const now = new Date();
      let fromDate = new Date();
      let toDate = new Date();
      
      if (dateRange === '1d') fromDate.setDate(now.getDate() - 1);
      else if (dateRange === '7d') fromDate.setDate(now.getDate() - 7);
      else if (dateRange === '30d') fromDate.setDate(now.getDate() - 30);
      else if (dateRange === '90d') fromDate.setDate(now.getDate() - 90);

      const params: any = {
        granularity,
        q: searchTerm || undefined,
        project_id: activeProject?.id || undefined,
        sentiment: filters.sentiment || undefined,
        source_type: filters.source_type || undefined,
        min_risk_score: filters.min_risk_score || undefined,
        min_influence_score: filters.min_influence_score || undefined,
        date_from: dateRange !== 'all' ? fromDate.toISOString() : undefined,
        date_to: dateRange !== 'all' ? toDate.toISOString() : undefined,
      };

      const res = await mentionsApi.charts(params);
      if (fetchId !== chartFetchIdRef.current) return;
      if (res && res.items) {
        setChartData(res.items);
      } else {
        setChartData([]);
      }
    } catch (err) {
      if (fetchId !== chartFetchIdRef.current) return;
      console.error('Failed to fetch chart data', err);
      setChartData([]);
    } finally {
      if (fetchId === chartFetchIdRef.current) {
        setChartLoading(false);
      }
    }
  }, [activeProject?.id, chartTimeRange, searchTerm, filters.sentiment, filters.source_type, filters.min_risk_score, filters.min_influence_score, dateRange]);

  const fetchSourceCounts = useCallback(async () => {
    const fetchId = ++sourceFetchIdRef.current;
    if (!activeProject && !searchTerm && !initialJobId) return;
    try {
      const params: any = {};
      if (initialJobId) {
        params.job_id = initialJobId;
      } else {
        if (searchTerm) params.q = searchTerm;
        if (filters.sentiment) params.sentiment = filters.sentiment;
        if (filters.min_risk_score !== null) params.min_risk_score = filters.min_risk_score;
        if (filters.min_influence_score !== null) params.min_influence_score = filters.min_influence_score;

        if (dateRange && dateRange !== 'all') {
          const now = new Date();
          const from = new Date();
          if (dateRange === '1d') from.setDate(now.getDate() - 1);
          else if (dateRange === '7d') from.setDate(now.getDate() - 7);
          else if (dateRange === '30d') from.setDate(now.getDate() - 30);
          else if (dateRange === '90d') from.setDate(now.getDate() - 90);
          params.date_from = from.toISOString();
          params.date_to = now.toISOString();
        }
      }
      if (activeProject) params.project_id = activeProject.id;
      const counts = await mentionsApi.sourceCounts(params);
      if (fetchId !== sourceFetchIdRef.current) return;
      setSourceCounts(counts);
    } catch (error) {
      if (fetchId !== sourceFetchIdRef.current) return;
      console.error('Error fetching source counts:', error);
    }
  }, [filters.sentiment, filters.min_risk_score, filters.min_influence_score, initialJobId, searchTerm, activeProject?.id, dateRange]);

  useEffect(() => {
    fetchMentions();
  }, [fetchMentions]);

  useEffect(() => {
    fetchSourceCounts();
  }, [fetchSourceCounts]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  useEffect(() => {
    // Reset state on project change to prevent stale data
    setMentionsList([]);
    setPage(1);

    const newParams = new URLSearchParams(searchParams?.toString() || '');
    if (newParams.has('job_id')) {
      newParams.delete('job_id');
      router.replace(`/dashboard/mentions?${newParams.toString()}`);
    }
  }, [activeProject?.id, router, searchParams]);


  /* ─── SCAN NOW LOGIC ────────────────────────────────────────────────── */
  const [scanConfirm, setScanConfirm] = useState({ isOpen: false, keyword: '' });

  const executeScan = async (keyword: string) => {
    if (!activeProject) return;
    try {
      const res = await crawl.manualScan({
        project_id: activeProject.id,
        query: keyword,
        source_types: filters.source_type ? filters.source_type.split(',') : [],
        expand_keywords: true,
        mode: 'AUTO_DISCOVERY',
        source_ids: [],
        max_results: 100,
      });
      if (res.message === "Returned existing running job to prevent duplicate crawl") {
        toast.success("Đang có job quét tương tự đang chạy. Tự động theo dõi tiến độ...");
      } else {
        toast.success(`Đang quét dữ liệu mới cho từ khóa ${keyword}...`);
      }
      setActiveScanJobId(res.job_id);
      setActiveScanKeyword(keyword);
      setScanJobStatus({ status: 'QUEUED' });
      setScanConfirm({ isOpen: false, keyword: '' });
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || err.message || 'Lỗi khi bắt đầu quét';
      toast.error(`Lỗi: ${errMsg}`);
    }
  };

  const handleScanClick = () => {
    if (!activeProject) {
      toast.error('Vui lòng chọn project trước.');
      return;
    }
    const keyword = searchTerm || activeProject.name || 'TTH';

    // Warn if scanning a keyword that differs from the project name
    const projectNameStr = activeProject.name.toLowerCase().trim();
    const keywordStr = keyword.toLowerCase().trim();

    if (projectNameStr !== keywordStr && !projectNameStr.includes(keywordStr)) {
      setScanConfirm({ isOpen: true, keyword });
    } else {
      executeScan(keyword);
    }
  };

  useEffect(() => {
    if (!activeScanJobId) return;
    const interval = setInterval(async () => {
      if (scanStartTimeRef.current && Date.now() - scanStartTimeRef.current > 90000) {
        clearInterval(interval);
        setSearchState('AUTO_SCAN_FAILED');
        setScanJobStatus((prev: any) => ({ ...prev, status: 'TIMEOUT', error_message: 'Job quét đang chạy lâu hơn bình thường (90s). Vui lòng kiểm tra lại Worker/Status.' }));
        return;
      }

      try {
        const data = await crawl.getJob(activeScanJobId);
        setScanJobStatus(data);
        const status = data.status?.toUpperCase();
        if (['COMPLETED', 'COMPLETED_NO_RESULTS', 'FAILED', 'PARTIAL_FAILED', 'TIMEOUT'].includes(status)) {
          clearInterval(interval);
          scanStartTimeRef.current = null;

          if (status === 'COMPLETED' || status === 'PARTIAL_FAILED') {
            setSearchState('AUTO_SCAN_COMPLETED');
            setPage(1);
            // Use .then() so we clear activeScanJobId AFTER the refetch completes,
            // preventing any accidental double-scan trigger in between
            Promise.resolve(fetchMentionsRef.current(true, true)).finally(() => {
              setActiveScanJobId(null);
            });
          } else if (status === 'COMPLETED_NO_RESULTS') {
            setSearchState('AUTO_SCAN_NO_RESULTS');
            setActiveScanJobId(null);
          } else {
            setSearchState('AUTO_SCAN_FAILED');
            setActiveScanJobId(null);
          }
        } else {
            setSearchState('AUTO_SCAN_RUNNING');
        }
      } catch (err) {
        console.error(err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeScanJobId, router, searchParams]);

  /* ─── PROJECT / SCAN ACTIONS ─────────────────────────────────────────── */



  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchTerm(val);
      setPage(1);
      setActiveScanJobId(null);
      setActiveScanKeyword('');
      setScanJobStatus(null);
      setSearchState('IDLE');
      const newParams = new URLSearchParams(searchParams?.toString() || '');
      if (val) {
        newParams.set('q', val);
      } else {
        newParams.delete('q');
      }
      newParams.delete('job_id'); // Always clear job_id when searching
      router.push(`/dashboard/mentions?${newParams.toString()}`);
    }, 400);
  };


  /* ─── FILTER ACTIONS ────────────────────────────────────────────────── */

  const updateFilter = (key: keyof Filters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearAllFilters = () => {
    setFilters({ sentiment: null, source_type: null, min_risk_score: null, min_influence_score: null, sort_by: 'newest' });
    setSearchTerm('');
    setSearchInput('');
    setPage(1);
    router.push('/dashboard/mentions'); // Clear URL params completely
  };

  const hasActiveFilters = filters.sentiment || filters.source_type || filters.min_risk_score !== null || searchTerm;

  const activeFilterCount = [filters.sentiment, filters.source_type, filters.min_risk_score, searchTerm].filter(Boolean).length;

  /* ─── MENTION ACTIONS ───────────────────────────────────────────────── */

  const handleDelete = async () => {
    if (!deleteConfirm.mentionId) return;
    try {
      await mentionsApi.delete(deleteConfirm.mentionId);
      toast.success(t('mentions.page.deleteSuccess'));
      fetchMentions();
    } catch (error: any) {
      toast.error(t('mentions.page.deleteError'));
    }
  };

  const handleAction = async (mentionId: number, action: string, apiCall: () => Promise<any>, successMsg: string) => {
    setActionLoading((prev) => ({ ...prev, [`${mentionId}_${action}`]: true }));
    try {
      await apiCall();
      toast.success(successMsg);
      fetchMentions();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Có lỗi xảy ra');
    } finally {
      setActionLoading((prev) => ({ ...prev, [`${mentionId}_${action}`]: false }));
    }
  };

  const handleVisit = async (mention: MentionItem) => {
    const safeUrl = getSafeUrl(mention.canonical_url || mention.original_url || mention.permalink || mention.source_url || mention.url);
    if (!safeUrl) {
      toast.error(mention.visit_url_invalid_reason || 'Không có link bài gốc hợp lệ');
      return;
    }

    window.open(safeUrl, '_blank', 'noopener,noreferrer');

    // Optimistic update
    setMentionsList(prev => prev.map(m => {
      if (m.id === mention.id) {
        return {
          ...m,
          is_visited: true,
          visit_count: (m.visit_count || 0) + 1
        };
      }
      return m;
    }));

    try {
      await mentionsApi.visit(mention.id);
    } catch (error) {
      console.error('Lỗi khi ghi nhận visit', error);
    }
  };

  const handleToggleAddToReport = async (mentionId: number, currentStatus: boolean) => {
    setActionLoading((prev) => ({ ...prev, [`${mentionId}_add_to_report`]: true }));
    try {
      await mentionsApi.addToReport(mentionId, !currentStatus);
      toast.success(!currentStatus ? 'Đã thêm vào báo cáo' : 'Đã xóa khỏi báo cáo');
      fetchMentions();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Có lỗi xảy ra');
    } finally {
      setActionLoading((prev) => ({ ...prev, [`${mentionId}_add_to_report`]: false }));
    }
  };

  const handleExportCsv = async () => {
    try {
      const params: Record<string, unknown> = {};
      if (activeProject) params.project_id = activeProject.id;
      if (filters.sentiment) params.sentiment = filters.sentiment;
      if (filters.source_type) params.source_type = filters.source_type;
      if (filters.min_risk_score !== null) params.min_risk_score = filters.min_risk_score;
      if (filters.min_influence_score !== null) params.min_influence_score = filters.min_influence_score;
      if (searchTerm) params.q = searchTerm;
      if (dateRange && dateRange !== 'all') {
        const now = new Date();
        const from = new Date();
        if (dateRange === '1d') from.setDate(now.getDate() - 1);
        else if (dateRange === '7d') from.setDate(now.getDate() - 7);
        else if (dateRange === '30d') from.setDate(now.getDate() - 30);
        else if (dateRange === '90d') from.setDate(now.getDate() - 90);
        params.date_from = from.toISOString();
        params.date_to = now.toISOString();
      }
      const blob = await mentionsApi.exportCsv(params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mentions_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Đã xuất CSV');
    } catch {
      toast.error('Lỗi khi xuất CSV');
    }
  };

  /* ─── SENTIMENT SUMMARY STATS ───────────────────────────────────────── */

  const summaryStats = sentimentSummary
    ? [
        { label: 'Tổng mentions', value: sentimentSummary.total || 0, icon: BarChart3, color: 'text-signal dark:text-signal-bright', bg: 'bg-signal/10' },
        { label: 'Tích cực', value: sentimentSummary.positive || 0, icon: TrendingUp, color: 'text-sentiment-positive', bg: 'bg-sentiment-positive/10' },
        { label: 'Tiêu cực', value: sentimentSummary.negative || 0, icon: TrendingDown, color: 'text-sentiment-negative', bg: 'bg-sentiment-negative/10' },
        { label: 'Trung lập', value: sentimentSummary.neutral || 0, icon: Minus, color: 'text-sentiment-neutral', bg: 'bg-sentiment-neutral/10' },
      ]
    : [];

  /* ═══════════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto min-h-screen">
      <Toaster position="top-right" />

      {/* ─── LEFT MAIN COLUMN (75%) ─────────────────────────────────────────── */}
      <div className="flex-1 w-full lg:w-[75%] min-w-0 flex flex-col gap-6">

        {/* Header & Filter Controls */}
        <MentionFilterBar
          searchInput={searchInput}
          onSearchChange={handleSearchChange}
          onScanClick={handleScanClick}
          onExportClick={handleExportCsv}
          onRefreshClick={() => { fetchMentions(); fetchChartData(); }}
          onSaveFilterClick={openSaveFilterModal}
          onClearFilters={clearAllFilters}
          isScanning={activeScanJobId !== null}
          isLoading={loading}
          hasActiveFilters={!!hasActiveFilters}
          sortValue={filters.sort_by}
          onSortChange={(val) => { setFilters({ ...filters, sort_by: val }); setPage(1); }}
          sortOptions={translatedSortOptions}
          sortOpen={sortOpen}
          setSortOpen={setSortOpen}
        />

        <MentionActiveFilterChips
          filters={filters}
          searchTerm={searchTerm}
          dateRange={dateRange}
          onRemoveFilter={(key) => {
            if (key === 'search') { setSearchTerm(''); setSearchInput(''); }
            else if (key === 'dateRange') setDateRange('all');
            else updateFilter(key as any, null);
          }}
          onClearAll={clearAllFilters}
        />

        <div ref={savedFiltersRef} className="relative flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-void-surface p-3">
          <div>
            <p className="text-sm font-bold text-paper">Bộ lọc đã lưu</p>
            <p className="text-xs text-paper-muted">
              {activeProject ? `Project: ${activeProject.name}` : 'Chọn project để dùng bộ lọc đã lưu'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSavedFiltersOpen((open) => !open)}
              disabled={!activeProject}
              className={`inline-flex items-center gap-2 rounded-lg border border-edge bg-void-raised px-3 py-2 text-sm font-bold text-paper-muted transition-colors duration-150 motion-reduce:transition-none hover:text-paper hover:bg-paper/[0.04] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Danh sách bộ lọc ({savedFiltersList.length})
              <ChevronDown className={`h-4 w-4 transition-transform duration-150 motion-reduce:transition-none ${savedFiltersOpen ? 'rotate-180' : ''}`} />
            </button>
            <button
              type="button"
              onClick={openSaveFilterModal}
              disabled={!activeProject}
              className="rounded-lg bg-signal px-3 py-2 text-sm font-bold text-white transition-colors duration-150 motion-reduce:transition-none hover:bg-signal-deep dark:hover:bg-signal-bright disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
            >
              Lưu bộ lọc hiện tại
            </button>
          </div>
          {savedFiltersOpen && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border border-edge bg-void-surface p-3 shadow-tile">
              {savedFiltersList.length === 0 ? (
                <div className="rounded-lg border border-dashed border-edge p-4 text-sm text-paper-muted">
                  Chưa có bộ lọc đã lưu cho project này. Hãy cấu hình bộ lọc và chọn “Lưu bộ lọc hiện tại”.
                </div>
              ) : (
                <div className="space-y-2" role="list" aria-label="Danh sách bộ lọc đã lưu">
                  {savedFiltersList.map((filter: any) => (
                    <div key={filter.id} role="listitem" className="flex flex-col gap-3 rounded-lg border border-edge p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-paper">{filter.name}</p>
                        <p className="text-xs text-paper-muted">
                          {filter.filter_json?.search_term ? `Từ khóa: ${filter.filter_json.search_term}` : 'Không có từ khóa'}
                          {filter.filter_json?.sentiment ? ` • Cảm xúc: ${filter.filter_json.sentiment}` : ''}
                          {filter.filter_json?.source_type ? ` • Nguồn: ${filter.filter_json.source_type}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleApplyFilter(filter.id)}
                          className={`rounded-md bg-signal/10 px-3 py-1.5 text-xs font-bold text-signal dark:text-signal-bright hover:bg-signal/15 transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
                        >
                          Áp dụng
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFilter(filter.id)}
                          className={`rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scan / Search Status */}
        {(searchTerm || activeScanJobId || scanJobStatus) && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-paper-muted">
            {searchTerm && (
              <span className="font-medium bg-void-surface border border-edge px-3 py-1.5 rounded-lg">
                Tìm thấy <span className="font-bold text-paper tabular-nums">{totalMentions}</span> {t('mentions.page.resultsFor')} <span className="text-signal dark:text-signal-bright font-bold">'{searchTerm}'</span>
              </span>
            )}

            {activeScanJobId && (
              <span className="flex items-center gap-1.5 text-signal dark:text-signal-bright bg-signal/10 border border-signal/25 px-3 py-1.5 rounded-lg">
                <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
                {t('mentions.page.scanningNew')}
              </span>
            )}

            {!activeScanJobId && scanJobStatus && scanJobStatus.status === 'COMPLETED' && (
              <span className="flex items-center gap-1.5 text-success bg-success/10 border border-success/25 px-3 py-1.5 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t('mentions.page.scanComplete')} {scanJobStatus.meta_data?.actual_raw_results_count || 0}, {t('mentions.page.scanNew')} {scanJobStatus.meta_data?.created_mentions_count || 0}, {t('mentions.page.scanSkip')} {scanJobStatus.meta_data?.duplicate_mentions_count || 0} {t('mentions.page.scanDuplicate')}.
              </span>
            )}
            {!activeScanJobId && scanJobStatus && scanJobStatus.status === 'PARTIAL_FAILED' && (
              <span className="flex items-center gap-1.5 text-warning bg-warning/10 border border-warning/25 px-3 py-1.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t('mentions.page.scanPartialFail')} {scanJobStatus.meta_data?.actual_raw_results_count || 0}, thêm mới {scanJobStatus.meta_data?.created_mentions_count || 0}.
              </span>
            )}
          </div>
        )}

        {/* Chart Section */}
        <div className="bg-void-surface rounded-xl border border-edge overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-edge gap-2 pb-2 sm:pb-0">
            <div className="flex items-center">
              <button
                onClick={() => setActiveChartTab('reach')}
                className={`px-4 sm:px-6 py-3 border-b-2 text-sm font-bold transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${activeChartTab === 'reach' ? 'border-signal text-paper' : 'border-transparent text-paper-muted hover:text-paper'}`}
              >
                Mentions & Reach
              </button>
              <button
                onClick={() => setActiveChartTab('sentiment')}
                className={`px-4 sm:px-6 py-3 border-b-2 text-sm font-bold transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${activeChartTab === 'sentiment' ? 'border-signal text-paper' : 'border-transparent text-paper-muted hover:text-paper'}`}
              >
                Cảm xúc
              </button>
            </div>
            <div className="text-[11px] font-medium text-paper-faint hidden xl:block mr-2 px-4 text-right">
               Xu hướng đề cập trong dự án (Không phụ thuộc bộ lọc hiện tại)
            </div>
            <div className="ml-auto pr-4 flex items-center gap-2">
               <div className="flex bg-void-raised p-0.5 rounded-lg border border-edge">
                 <button
                   onClick={() => setChartTimeRange('days')}
                   className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${chartTimeRange === 'days' ? 'bg-void-surface text-paper' : 'text-paper-muted hover:text-paper'}`}
                 >{t('mentions.page.days')}</button>
                 <button
                   onClick={() => setChartTimeRange('weeks')}
                   className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${chartTimeRange === 'weeks' ? 'bg-void-surface text-paper' : 'text-paper-muted hover:text-paper'}`}
                 >{t('mentions.page.weeks')}</button>
                 <button
                   onClick={() => setChartTimeRange('months')}
                   className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${chartTimeRange === 'months' ? 'bg-void-surface text-paper' : 'text-paper-muted hover:text-paper'}`}
                 >{t('mentions.page.months')}</button>
               </div>
            </div>
          </div>

          <div className="px-5 pt-2 pb-5" role="img" aria-labelledby="mentions-summary-chart">
            <p id="mentions-summary-chart" className="sr-only">
              Mentions chart showing mention volume or sentiment across the selected time range.
            </p>
            {chartLoading ? (
              <div className="w-full h-56 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin motion-reduce:animate-none text-signal dark:text-signal-bright" />
              </div>
            ) : chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <CartesianGrid {...chartGrid} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={chartAxisTick}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    tick={chartAxisTick}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                    width={36}
                  />
                  <Tooltip
                    cursor={{ fill: chartColors.accent, fillOpacity: 0.08 }}
                    contentStyle={chartTooltipStyle}
                    itemStyle={chartTooltipItemStyle}
                    labelStyle={chartTooltipLabelStyle}
                  />
                  {activeChartTab === 'reach' ? (
                    <Bar isAnimationActive={false} dataKey="mentions" name="Mentions" fill={chartColors.accent} radius={[5, 5, 0, 0]} maxBarSize={36} />
                  ) : (
                    <>
                      <Bar isAnimationActive={false} dataKey="positive" name="Tích cực" stackId="a" fill={chartColors.positive} maxBarSize={36} />
                      <Bar isAnimationActive={false} dataKey="neutral" name="Trung lập" stackId="a" fill={chartColors.neutral} maxBarSize={36} />
                      <Bar isAnimationActive={false} dataKey="negative" name="Tiêu cực" stackId="a" fill={chartColors.negative} radius={[5, 5, 0, 0]} maxBarSize={36} />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-56 flex items-center justify-center text-sm text-paper-faint">
                Không có dữ liệu biểu đồ
              </div>
            )}
          </div>
          <div className="px-6 pb-4 flex items-center gap-6">
             {activeChartTab === 'reach' ? (
               <>
                 <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-signal"></span><span className="text-xs font-bold text-signal dark:text-signal-bright">Mentions</span></div>
                 <div className="flex items-center gap-2"><span className="w-3 h-0.5 bg-paper-muted"></span><span className="text-xs font-bold text-paper-muted">Reach</span></div>
               </>
             ) : (
               <>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-sentiment-positive"></span><span className="text-xs font-bold text-sentiment-positive">{t('mentions.sentiment.positive')}</span></div>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-sentiment-neutral"></span><span className="text-xs font-bold text-sentiment-neutral">{t('mentions.sentiment.neutral')}</span></div>
                 <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-sentiment-negative"></span><span className="text-xs font-bold text-sentiment-negative">{t('mentions.sentiment.negative')}</span></div>
               </>
             )}
          </div>
        </div>

        {/* Pagination Bar Top */}
        <div className="flex items-center justify-between bg-void-surface px-4 py-3 rounded-xl border border-edge">
           <div className="text-sm font-medium text-paper-muted">
             {loading && !mentionsList.length ? t('common.loading') : totalMentions >= 0 ? `${totalMentions.toLocaleString()} ${t('common.results')} ${searchTerm ? `${t('common.for')} '${searchTerm}'` : ''}` : t('common.loading')}
           </div>

           {totalPages > 1 && (
             <div className="flex items-center gap-1 text-sm text-paper-muted">
               {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => (
                 <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 flex items-center justify-center rounded-md tabular-nums transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${page === i + 1 ? 'text-signal dark:text-signal-bright font-bold bg-signal/10' : 'hover:bg-void-raised'}`}>
                   {i + 1}
                 </button>
               ))}
               {totalPages > 5 && <span className="px-1">...</span>}
               {totalPages > 5 && (
                 <button onClick={() => setPage(totalPages)} className={`w-8 h-8 flex items-center justify-center rounded-md tabular-nums transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${page === totalPages ? 'text-signal dark:text-signal-bright font-bold bg-signal/10' : 'hover:bg-void-raised'}`}>
                   {totalPages}
                 </button>
               )}
               <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className={`p-1.5 hover:bg-void-raised rounded-md disabled:opacity-50 text-signal dark:text-signal-bright transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>
                 <ChevronRight className="w-5 h-5" />
               </button>
             </div>
           )}
        </div>

        {/* MENTIONS LIST */}
        <div className="space-y-4">
          {fetchError ? (
            <MentionFilterErrorState 
              errorMessage={fetchError} 
              onRetry={() => { setFetchError(null); fetchMentions(); }} 
            />
          ) : loading && !mentionsList.length ? (
            <div className="py-4 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse motion-reduce:animate-none flex flex-col sm:flex-row gap-4 p-5 bg-void-surface border border-edge rounded-xl">
                  <div className="w-12 h-12 bg-void-raised rounded-xl"></div>
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-void-raised rounded w-3/4"></div>
                    <div className="h-3 bg-void-raised rounded w-full"></div>
                    <div className="h-3 bg-void-raised rounded w-5/6"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : mentionsList.length === 0 ? (
            <MentionEmptyResults
              searchState={searchState}
              searchTerm={searchTerm}
              dateRange={dateRange}
              hasFilters={!!filters.source_type}
              onExtend7Days={() => { setDateRange('7d'); setPage(1); }}
              onExtend30Days={() => { setDateRange('30d'); setPage(1); }}
              onClearFilters={() => { setFilters(prev => ({...prev, source_type: null})); setPage(1); }}
              onScanClick={handleScanClick}
              isScanning={activeScanJobId !== null}
            />
          ) : (
            <div className="space-y-4">
              {loading && mentionsList.length > 0 && (
                <div className="sticky top-0 z-10 flex items-center justify-center py-2 text-signal dark:text-signal-bright bg-void-surface/90 backdrop-blur-sm border border-signal/25 text-sm font-medium gap-2 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
                  {searchTerm ? `${t('mentions.page.updatingResultsFor')} "${searchTerm}"...` : t('mentions.page.updatingList')}
                </div>
              )}
              {searchState === 'TYPING' && !loading && mentionsList.length > 0 && (
                <div className="sticky top-0 z-10 flex items-center justify-center py-2 text-paper-muted bg-void-surface/90 backdrop-blur-sm border border-edge text-sm font-medium gap-2 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" /> {t('mentions.page.typing')}
                </div>
              )}
              {['AUTO_SCAN_STARTING', 'AUTO_SCAN_RUNNING'].includes(searchState) && (
                <div className="bg-signal/10 border border-signal/25 rounded-lg p-3 mb-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-signal dark:text-signal-bright animate-spin motion-reduce:animate-none" />
                  <span className="text-sm text-paper font-medium">
                    {t('mentions.page.autoScanningBg')} '{searchTerm}' {t('mentions.page.autoScanningSuffix')}
                  </span>
                </div>
              )}
              {searchState === 'AUTO_SCAN_COMPLETED' && scanJobStatus && (
                <div className="bg-success/10 border border-success/25 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-3 border-b border-success/25 pb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-success" />
                      <span className="text-sm text-success font-bold">
                        {t('mentions.page.scanDone')} (Job #{scanJobStatus.job_id})
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-paper-muted">
                    <div><span className="font-semibold text-paper">{t('mentions.page.originalQuery')}</span> {scanJobStatus.meta_data?.query || searchTerm}</div>
                    <div><span className="font-semibold text-paper">{t('mentions.page.scanSource')}</span> {scanJobStatus.summary?.adapters_ready?.join(', ') || 'Tất cả'}</div>
                    <div><span className="font-semibold text-paper">{t('mentions.page.rawResults')}</span> {scanJobStatus.summary?.serpapi_result_count || 0}</div>
                    <div><span className="font-semibold text-paper">{t('mentions.page.newCreated')}</span> <span className="font-bold text-success">{scanJobStatus.summary?.new_mentions_created || 0} mentions</span></div>
                    <div><span className="font-semibold text-paper">{t('mentions.page.skipDuplicate')}</span> {scanJobStatus.summary?.duplicates_skipped || 0}</div>
                  </div>
                </div>
              )}
              {/* Bulk Action Bar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between px-4 py-3 bg-signal/10 border border-signal/25 rounded-xl mb-2">
                  <div className="flex items-center gap-4 text-sm font-bold text-signal dark:text-signal-bright">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === mentionsList.length && mentionsList.length > 0}
                      onChange={toggleSelectAll}
                      className={`w-4 h-4 rounded border-edge-strong accent-signal cursor-pointer ${focusRing}`}
                    />
                    <span>{selectedIds.size} đã chọn</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className={`px-2 py-1.5 text-xs font-bold text-paper bg-void-surface border border-edge-strong rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal`}
                      onChange={(e) => {
                         if (e.target.value) {
                           handleBulkSentiment(e.target.value);
                           e.target.value = "";
                         }
                      }}
                    >
                      <option value="">-- {t('mentions.page.sentimentTitle')} --</option>
                      <option value="positive">Tích cực</option>
                      <option value="neutral">Trung lập</option>
                      <option value="negative">Tiêu cực</option>
                    </select>
                    <button
                      onClick={() => handleBulkReview(true)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-success bg-success/10 border border-success/25 rounded-lg hover:bg-success/20 transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      Đánh dấu Review
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-destructive bg-destructive/10 border border-destructive/25 rounded-lg hover:bg-destructive/20 transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Xóa
                    </button>
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className={`px-3 py-1.5 text-xs font-bold text-paper-faint hover:text-paper transition-colors duration-150 motion-reduce:transition-none rounded-lg ${focusRing}`}
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              )}
              {mentionsList.map((mention) => {
const getMentionSourceLabel = (mention: any) => {
  if (mention.source_name && mention.source_name.trim() !== '') return mention.source_name;
  if (mention.domain && mention.domain.trim() !== '') return mention.domain;
  return mention.source_type || t('mentions.page.unknownSource');
};

const extractDomain = (url: string | null | undefined) => {
  try {
    if (!url) return '';
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const getSourceIntegrityLabel = (level: string | null | undefined) => {
  switch (level) {
    case 'high': return { label: t('mentions.trust.high'), color: 'bg-success/10 text-success border-success/25 px-1.5 py-0.5 rounded border font-bold', title: t('mentions.trust.safe') };
    case 'low': return { label: t('mentions.trust.low'), color: 'bg-warning/10 text-warning border-warning/25 px-1.5 py-0.5 rounded border font-bold', title: t('mentions.trust.low') };
    default: return null;
  }
};
return (
              <div key={mention.id} className="bg-void-surface rounded-xl border border-edge group hover:border-edge-strong transition-colors duration-150 motion-reduce:transition-none">

                {/* Source & Provenance Header */}
                <div className="px-5 py-3 bg-void-raised border-b border-edge flex flex-wrap items-center justify-between gap-2 rounded-t-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-edge bg-void-surface text-signal dark:text-signal-bright">
                      <SourceIcon type={mention.source_type} className="w-4 h-4" />
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-paper tracking-wide">
                          {getMentionSourceLabel(mention)}
                        </span>
                        {/* Trust Badges */}
                        {(() => {
                          const isLowConfidence = mention.source_confidence === 'low' || (typeof mention.source_confidence === 'number' && mention.source_confidence < 0.5);
                          if (typeof mention.source_confidence !== 'undefined' && !isLowConfidence) {
                             return <span className="text-[10px] bg-success/10 text-success border border-success/25 px-1.5 py-0.5 rounded font-bold" title={t('mentions.trust.safe')}>{t('mentions.trust.high')}</span>;
                          }
                          if (isLowConfidence) {
                             return <span className="text-[10px] bg-warning/10 text-warning border border-warning/25 px-1.5 py-0.5 rounded font-bold" title={t('mentions.trust.low')}>{t('mentions.trust.low')}</span>;
                          }
                          return null;
                        })()}
                        {activeScanJobId && mention.job_id === activeScanJobId && (
                           <span className="bg-signal/10 text-signal dark:text-signal-bright text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded-sm shrink-0 border border-signal/25">{t('mentions.page.newBadge')}</span>
                        )}
                      </div>
                      <span className="text-[11px] text-paper-faint font-medium tracking-wider uppercase">
                        {mention.source_type ? t(`mentions.sourceType.${mention.source_type}`) || mention.source_type : (t('common.unknownSource') || 'Unknown Source')} • {mention.published_at ? new Date(mention.published_at).toLocaleString('vi-VN') : new Date(mention.collected_at!).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    {mention.ai_analysis?.ai_provider && (
                       <span className={
                         mention.ai_analysis.ai_provider === 'failed'
                         ? "bg-destructive/10 text-destructive px-2 py-1 rounded-md text-[10px] font-bold border border-destructive/25"
                         : "bg-signal/10 text-signal dark:text-signal-bright px-2 py-1 rounded-md text-[10px] font-bold border border-signal/25"
                       }>
                         {mention.ai_analysis.ai_provider === 'failed' ? 'AI FAILED' :
                          ['dummy', 'dummy_ai'].includes(mention.ai_analysis.ai_provider) ? 'RULE-BASED' :
                          mention.ai_analysis.ai_provider.toUpperCase()}
                       </span>
                     )}
                    <div className="relative inline-flex items-center">
                      <SentimentBadge sentiment={mention.sentiment} size="sm" />
                       <select
                         value={mention.sentiment === 'positive' ? 'positive' : mention.sentiment === 'negative' ? 'negative' : 'neutral'}
                         onChange={(e) => handleAction(mention.id, 'sentiment', () => mentionsApi.updateSentiment(mention.id, e.target.value), 'Đã cập nhật sentiment')}
                         aria-label="Edit mention sentiment"
                         className={`absolute inset-0 h-full w-full cursor-pointer opacity-0 ${focusRing}`}
                       >
                         <option value="positive" className="text-sentiment-positive font-bold">Positive</option>
                         <option value="neutral" className="text-sentiment-neutral font-bold">{t('mentions.sentiment.neutral') || 'Neutral'}</option>
                         <option value="negative" className="text-sentiment-negative font-bold">Negative</option>
                       </select>
                     </div>
                  </div>
                </div>

                {/* Main Content */}
                <div className="p-5 flex flex-col md:flex-row gap-5">
                  {/* Media Rendering safely */}
                  {(() => {
                    const meta = mention.metadata || (mention as any).meta_data;
                    if (!meta) return null;

                    const mediaUrl = meta.media_url;
                    let imageUrl = meta.image_url || meta.media_thumbnail;
                    
                    // Validate image url
                    const isSafeImage = imageUrl && typeof imageUrl === 'string' && !imageUrl.startsWith('sediment://') && !imageUrl.includes('image_asset_pointer') && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'));
                    if (!isSafeImage) imageUrl = null;

                    if (mediaUrl) {
                      if (mediaUrl.match(/\.(mp4|webm|ogg)$/i)) {
                        return (
                          <div className="shrink-0 w-full md:w-48 h-32 rounded-lg overflow-hidden border border-edge bg-void-raised">
                            <video controls className="w-full h-full object-cover" poster={imageUrl}>
                              <source src={mediaUrl} type="video/mp4" />
                            </video>
                          </div>
                        );
                      }
                      if (mediaUrl.match(/\.(mp3|wav|m4a)$/i)) {
                         return (
                           <div className="shrink-0 w-full md:w-48 p-3 rounded-lg border border-edge bg-void-raised flex items-center">
                             <audio controls className="w-full">
                               <source src={mediaUrl} type="audio/mpeg" />
                             </audio>
                           </div>
                         );
                      }
                    }

                    if (imageUrl) {
                      return (
                        <div className="shrink-0 w-full md:w-48 h-32 rounded-lg overflow-hidden border border-edge bg-void-raised">
                          <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-paper line-clamp-2 leading-tight" title={mention.title || mention.author || (t('common.unknownAuthor') || 'Unknown Author')}>
                       {mention.title ? highlightText(mention.title, searchTerm) : <span className="text-paper-faint italic">{t('mentions.page.noTitle')}</span>}
                    </h3>

                    <p className="text-sm text-paper-muted mt-2 line-clamp-3 leading-relaxed">
                      {(() => {
                         const contentStr = mention.snippet || mention.content || '';
                         if (!contentStr) return <span className="italic">{t('mentions.page.noDescription')}</span>;
                         
                         // Deduplicate if content starts with title
                         let displayStr = contentStr;
                         if (mention.title && displayStr.toLowerCase().startsWith(mention.title.toLowerCase())) {
                             displayStr = displayStr.substring(mention.title.length).trim();
                             if (displayStr.startsWith('-') || displayStr.startsWith(':')) {
                                 displayStr = displayStr.substring(1).trim();
                             }
                         }
                         if (!displayStr) return <span className="italic">{t('mentions.page.noDescription')}</span>;
                         return highlightText(displayStr.length > 300 ? displayStr.substring(0, 300) + '...' : displayStr, searchTerm);
                      })()}
                    </p>

                    {/* Metadata Bottom row */}
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                       {searchTerm && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {mention.matched_in && mention.matched_in.length > 0 ? (
                              <div className="text-[10px] text-signal dark:text-signal-bright font-bold flex gap-1 items-center bg-signal/10 px-2 py-0.5 rounded border border-signal/25">
                                <Search className="w-3 h-3" />
                                {mention.matched_in.join(', ')}
                              </div>
                            ) : (
                              <div className="text-[10px] text-paper-faint font-bold flex gap-1 items-center bg-void-raised px-2 py-0.5 rounded border border-edge">
                                <Search className="w-3 h-3" />
                                Semantic Match
                              </div>
                            )}
                            {mention.match_strength && (
                              <div className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                                mention.match_strength === 'exact' ? 'bg-success/10 text-success border-success/25' :
                                mention.match_strength === 'strong' ? 'bg-signal/10 text-signal dark:text-signal-bright border-signal/25' :
                                'bg-void-raised text-paper-muted border-edge'
                              }`}>
                                {mention.match_strength} match
                              </div>
                            )}
                          </div>
                       )}
                       
                       {/* Keywords */}
                       {keywordTexts(mention.matched_keywords).length > 0 && (
                         <div className="flex items-center gap-1.5 px-2 py-0.5 bg-void-raised border border-edge text-paper-muted text-[10px] tracking-wide font-bold rounded">
                           <Link2 className="w-3 h-3" />
                           {keywordTexts(mention.matched_keywords).join(', ')}
                         </div>
                       )}

                       {/* Influence & Risk */}
                       {mention.influence_score !== undefined && (
                         <span className="text-[11px] font-medium text-paper-muted border-l border-edge-strong pl-3 tabular-nums">
                           {t('mentions.card.influence') || 'Ảnh hưởng'}: <strong>{mention.influence_score}/10</strong>
                         </span>
                       )}
                       {mention.risk_score !== undefined && (
                         <span className={`text-[11px] font-medium border-l border-edge-strong pl-3 tabular-nums ${mention.risk_score >= 80 ? 'text-destructive font-bold' : 'text-paper-muted'}`}>
                           {t('mentions.card.risk') || 'Rủi ro'}: <strong>{mention.risk_score}</strong>
                         </span>
                       )}
                    </div>
                  </div>
                </div>

                 {/* Actions Footer */}
                <div className="bg-void-raised/50 px-5 py-3 border-t border-edge flex flex-wrap items-center justify-between gap-3 rounded-b-xl">
                   <div className="flex flex-wrap items-center gap-3">
                     {(() => {
                        const integrityLevel = mention.source_integrity_level;
                        const isLowIntegrity = integrityLevel === 'low' || integrityLevel === 'unavailable';
                        const visitStatus = getVisitUrlStatus(mention.canonical_url || mention.original_url || mention.permalink || mention.source_url || mention.url);
                        const safeUrl = visitStatus.url;
                        const integrityBadge = getSourceIntegrityLabel(integrityLevel);

                        if (!safeUrl || mention.visit_url_invalid_reason || isLowIntegrity) {
                          const tooltipText = mention.visit_url_invalid_reason
                            ? mention.visit_url_invalid_reason
                            : isLowIntegrity
                            ? (integrityLevel === 'low' ? 'Độ tin cậy thấp' : 'Không xác minh được nguồn')
                            : 'Không có link gốc';
                          return (
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-warning cursor-not-allowed group/tooltip relative" title={tooltipText}>
                             <Link2Off className="w-3.5 h-3.5" /> {t('mentions.missingUrl') || 'Thiếu URL gốc'}
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/tooltip:block px-2 py-1 bg-void-raised border border-edge text-paper text-[10px] rounded whitespace-nowrap z-10 shadow-tile">{tooltipText}</div>
                           </div>
                          );
                        }
                        return (
                          <>
                            <button onClick={() => handleVisit(mention)} className={`flex items-center gap-1.5 text-[11px] font-bold text-signal dark:text-signal-bright bg-signal/10 hover:bg-signal/15 px-2.5 py-1.5 rounded-lg border border-signal/25 transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>
                              <ExternalLink className="w-3.5 h-3.5" /> {t('mentions.openOriginal') || 'Mở bài gốc'}
                            </button>
                            {integrityBadge && (
                              <span
                                className={`text-[10px] ${integrityBadge.color} cursor-default`}
                                title={integrityBadge.title}
                              >
                                {integrityBadge.label}
                              </span>
                            )}
                          </>
                        );
                      })()}

                     {mention.is_visited && (
                       <div className="flex items-center gap-1.5 text-[11px] font-bold text-success bg-success/10 px-2 py-1.5 rounded-lg border border-success/25">
                         <CheckCircle2 className="w-3.5 h-3.5" /> {t('common.seen') || 'Đã xem'}
                         {(mention.visit_count ?? 0) > 0 && <span className="text-success ml-0.5 tabular-nums">({mention.visit_count})</span>}
                       </div>
                     )}

                     {(!mention.sentiment || !mention.risk_score) && (
                       <button
                         onClick={() => handleAction(mention.id, 'analyze', () => mentionsApi.analyze(mention.id), 'Đã phân tích xong')}
                         className={`flex items-center gap-1.5 text-[11px] font-bold text-paper-muted bg-void-surface border border-edge px-2.5 py-1.5 rounded-lg hover:text-paper hover:bg-paper/[0.04] transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
                         title={t('mentions.card.analyzeAi') || 'Phân tích AI'}
                       >
                         <BrainCircuit className="w-3.5 h-3.5" /> {t('mentions.card.analyzeAi') || 'Phân tích AI'}
                       </button>
                     )}
                     {(mention.risk_score !== undefined && mention.risk_score >= 50) && (
                       <button
                         onClick={() => handleAction(mention.id, 'alert', () => mentionsApi.createAlert(mention.id), 'Đã tạo cảnh báo rủi ro')}
                         className={`flex items-center gap-1.5 text-[11px] font-bold text-destructive bg-destructive/10 border border-destructive/25 px-2.5 py-1.5 rounded-lg hover:bg-destructive/20 transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
                         title={t('mentions.card.alert') || 'Tạo cảnh báo'}
                       >
                         <AlertTriangle className="w-3.5 h-3.5" /> Cảnh báo
                       </button>
                     )}
                     <div className="h-4 border-l border-edge-strong mx-1"></div>
                     <MentionActionMenu
                        mention={mention}
                        onReview={() => handleAction(mention.id, 'review', () => mentionsApi.markReviewed(mention.id), 'Đã đánh dấu xem')}
                        onTags={async () => {
                          const currentTags = mention.tags ? (Array.isArray(mention.tags) ? mention.tags.join(', ') : mention.tags) : '';
                          const input = await prompt({
                            title: 'Cập nhật tags',
                            message: 'Nhập các tags, cách nhau bằng dấu phẩy.',
                            placeholder: 'tag1, tag2, tag3...',
                            defaultValue: currentTags,
                            confirmText: t('mentions.page.saveTags'),
                          });
                          if (input !== null) {
                            const newTags = input.split(',').map((t) => t.trim()).filter(Boolean);
                            handleAction(mention.id, 'tags', () => mentionsApi.updateTags(mention.id, newTags), 'Đã cập nhật tags');
                          }
                        }}
                        onToggleReport={() => handleToggleAddToReport(mention.id, mention.add_to_report)}
                        onMuteAuthor={() => handleAction(mention.id, 'mute_author', () => mentionsApi.muteAuthor(mention.author!, activeProject!.id), `Đã ẩn tác giả ${mention.author}`)}
                        onMuteDomain={() => handleAction(mention.id, 'mute_domain', () => mentionsApi.muteDomain(mention.domain!, activeProject!.id), `Đã ẩn nguồn ${mention.domain}`)}
                        onDelete={() => setDeleteConfirm({ isOpen: true, mentionId: mention.id, mentionTitle: mention.title || '' })}
                     />
                   </div>
                   <input
                      type="checkbox"
                      checked={selectedIds.has(mention.id)}
                      onChange={() => toggleSelect(mention.id)}
                      className={`w-4 h-4 rounded border-edge-strong accent-signal cursor-pointer ${focusRing}`}
                    />
                </div>
               </div>
            );
            })
            }
            </div>
          )}
        </div>

        {/* Pagination Bar Bottom */}
        {totalPages > 1 && (
           <div className="flex items-center justify-end bg-void-surface px-4 py-3 rounded-xl border border-edge mt-2 mb-8">
             <div className="flex items-center gap-1 text-sm text-paper-muted">
               {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => (
                 <button key={i} onClick={() => setPage(i + 1)} className={`w-8 h-8 flex items-center justify-center rounded-md tabular-nums transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${page === i + 1 ? 'text-signal dark:text-signal-bright font-bold bg-signal/10' : 'hover:bg-void-raised'}`}>
                   {i + 1}
                 </button>
               ))}
               {totalPages > 5 && <span className="px-1">...</span>}
               {totalPages > 5 && (
                 <button onClick={() => setPage(totalPages)} className={`w-8 h-8 flex items-center justify-center rounded-md tabular-nums transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${page === totalPages ? 'text-signal dark:text-signal-bright font-bold bg-signal/10' : 'hover:bg-void-raised'}`}>
                   {totalPages}
                 </button>
               )}
             </div>
           </div>
        )}
      </div>

      {/* ─── RIGHT SIDEBAR (FILTERS - 25%) ───────────────────────────────── */}
      <div className="hidden lg:block w-[300px] xl:w-[320px] shrink-0 space-y-4 pb-8">

        {/* Date Range — Segmented Pill Selector */}
        <div className="bg-void-surface rounded-xl border border-edge p-4">
           <div className="flex items-center gap-2 mb-3">
             <Calendar className="w-4 h-4 text-paper-faint" />
             <h3 className="text-sm font-bold text-paper">{t('mentions.page.timeRange')}</h3>
           </div>
           <div className="flex flex-wrap gap-1.5">
             {[
               { value: '1d', label: t('mentions.page.today') },
               { value: '7d', label: t('mentions.page.7d') },
               { value: '30d', label: t('mentions.page.30d') },
               { value: '90d', label: t('mentions.page.90d') },
               { value: 'all', label: t('mentions.page.all') },
             ].map((opt) => (
               <button
                 key={opt.value}
                 onClick={() => { setDateRange(opt.value); setPage(1); }}
                 className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors duration-150 motion-reduce:transition-none border whitespace-nowrap ${focusRing} ${
                   dateRange === opt.value
                     ? 'bg-signal/10 border-signal/25 text-signal dark:text-signal-bright'
                     : 'bg-void-surface border-edge text-paper-muted hover:text-paper hover:bg-void-raised'
                 }`}
               >
                 {opt.label}
               </button>
             ))}
           </div>
        </div>

        {/* Sources — Active Grid + Collapsed Unavailable */}
        <div className="bg-void-surface rounded-xl border border-edge p-4">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-bold text-paper flex items-center gap-1.5">
               {t('mentions.sidebar.sources')}
             </h3>
             {filters.source_type && (
               <button
                 onClick={() => { setFilters({ ...filters, source_type: null }); setPage(1); }}
                 className={`text-[11px] font-bold text-paper-faint hover:text-paper bg-void-raised hover:bg-paper/[0.06] px-2 py-1 rounded transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
               >
                 {t('common.clearFilter') || 'Xóa lọc'}
               </button>
             )}
           </div>
           {/* Active Sources — vertical list */}
           <div className="flex flex-col gap-1.5">
             {translatedSourceTypeOptions.filter(s => !s.disabled).map((src) => {
               const currentSources = filters.source_type ? filters.source_type.split(',') : [];
               const isSelected = currentSources.includes(src.value);
               const count = sourceCounts[src.value] || 0;
               return (
                 <button
                   key={src.value}
                   onClick={() => {
                     let next = [...currentSources];
                     if (isSelected) {
                       next = next.filter(s => s !== src.value);
                     } else {
                       next.push(src.value);
                     }
                     setFilters({ ...filters, source_type: next.length ? next.join(',') : null });
                     setPage(1);
                   }}
                   className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 motion-reduce:transition-none border ${focusRing} ${
                     isSelected
                       ? 'bg-signal/10 border-signal/25 text-signal dark:text-signal-bright'
                       : count > 0 ? 'bg-void-surface border-edge text-paper-muted hover:border-edge-strong hover:text-paper hover:bg-void-raised' : 'bg-void-raised border-transparent text-paper-faint hover:bg-paper/[0.04]'
                   }`}
                 >
                   <div className="flex items-center gap-2">
                     <src.icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-signal dark:text-signal-bright' : count > 0 ? src.color : 'text-paper-faint'}`} />
                     <span className="truncate">{src.label}</span>
                   </div>
                   <span className={`text-xs font-bold tabular-nums ${isSelected ? 'text-signal dark:text-signal-bright' : count > 0 ? 'text-paper-muted' : 'text-paper-faint'}`}>{count.toLocaleString('vi-VN')}</span>
                 </button>
               );
             })}
           </div>
           {/* Unavailable / Connector Sources */}
           <div className="mt-4 pt-3 border-t border-edge flex flex-col gap-1.5">
             <div className="text-[11px] text-paper-faint font-semibold uppercase tracking-eyebrow mb-1 px-1">{t('mentions.page.connectorSources')}</div>
             {translatedSourceTypeOptions.filter(s => s.disabled).map((src) => (
                 <div
                   key={src.value}
                   className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium border border-transparent bg-void-raised text-paper-faint"
                 >
                   <div className="flex items-center gap-2">
                     <src.icon className="w-4 h-4 shrink-0 opacity-50" />
                     <span className="truncate">{src.label}</span>
                   </div>
                   <span className="text-[10px] font-bold text-paper-faint bg-paper/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                     {src.msg}
                   </span>
                 </div>
             ))}
           </div>
        </div>
        <AntiNoiseNotice />

        {/* Sentiment Filter */}
        <div className="bg-void-surface rounded-xl border border-edge p-4">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-bold text-paper flex items-center gap-1.5">
               Cảm xúc <Info className="w-3.5 h-3.5 text-paper-faint" />
             </h3>
           </div>
           <div className="flex flex-col gap-3">
             <label className="flex items-center gap-2 cursor-pointer">
               <input
                  type="checkbox"
                  checked={filters.sentiment?.split(',').includes('negative') || false}
                  onChange={() => {
                    const current = filters.sentiment ? filters.sentiment.split(',') : [];
                    const next = current.includes('negative') ? current.filter(s => s !== 'negative') : [...current, 'negative'];
                    setFilters({...filters, sentiment: next.length ? next.join(',') : null});
                    setPage(1);
                  }}
                  className={`rounded border-edge-strong accent-sentiment-negative ${focusRing}`}
               />
               <span className="text-xs font-medium text-sentiment-negative">Negative</span>
             </label>
             <label className="flex items-center gap-2 cursor-pointer">
               <input
                  type="checkbox"
                  checked={filters.sentiment?.split(',').includes('neutral') || false}
                  onChange={() => {
                    const current = filters.sentiment ? filters.sentiment.split(',') : [];
                    const next = current.includes('neutral') ? current.filter(s => s !== 'neutral') : [...current, 'neutral'];
                    setFilters({...filters, sentiment: next.length ? next.join(',') : null});
                    setPage(1);
                  }}
                  className={`rounded border-edge-strong accent-sentiment-neutral ${focusRing}`}
               />
               <span className="text-xs font-medium text-sentiment-neutral">{t('mentions.sentiment.neutral') || 'Neutral'}</span>
             </label>
             <label className="flex items-center gap-2 cursor-pointer">
               <input
                  type="checkbox"
                  checked={filters.sentiment?.split(',').includes('positive') || false}
                  onChange={() => {
                    const current = filters.sentiment ? filters.sentiment.split(',') : [];
                    const next = current.includes('positive') ? current.filter(s => s !== 'positive') : [...current, 'positive'];
                    setFilters({...filters, sentiment: next.length ? next.join(',') : null});
                    setPage(1);
                  }}
                  className={`rounded border-edge-strong accent-sentiment-positive ${focusRing}`}
               />
               <span className="text-xs font-medium text-sentiment-positive">Positive</span>
             </label>
           </div>
        </div>

        {/* Influence Score */}
        <div className="bg-void-surface rounded-xl border border-edge p-4">
           <div className="flex items-center justify-between mb-4">
             <h3 className="text-sm font-bold text-paper flex items-center gap-1.5">
               Điểm ảnh hưởng <Info className="w-3.5 h-3.5 text-paper-faint" />
             </h3>
           </div>
           <div className="px-2">
             <input
               type="range"
               min="0"
               max="10"
               value={filters.min_influence_score || 0}
               onChange={(e) => {
                 setFilters({ ...filters, min_influence_score: parseInt(e.target.value) });
                 setPage(1);
               }}
               className={`w-full h-1 bg-void-raised rounded-lg appearance-none cursor-pointer accent-signal ${focusRing}`}
             />
             <div className="flex justify-between text-[10px] text-paper-faint mt-2 font-medium tabular-nums">
               <span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span>
             </div>
           </div>
        </div>

      </div>

      {/* Save Filter Modal */}
      {saveFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/25 dark:bg-void/70 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="save-filter-title" className="w-full max-w-md overflow-hidden rounded-2xl border border-edge bg-void-surface shadow-tile">
            <div className="flex items-center justify-between border-b border-edge p-5">
              <div>
                <h2 id="save-filter-title" className="text-lg font-bold text-paper">Lưu bộ lọc</h2>
                <p className="text-sm text-paper-muted">Lưu cấu hình lọc hiện tại cho project đang chọn.</p>
              </div>
              <button
                type="button"
                onClick={() => setSaveFilterModalOpen(false)}
                className={`rounded-lg p-2 text-paper-faint transition-colors duration-150 motion-reduce:transition-none hover:bg-paper/[0.04] hover:text-paper ${focusRing}`}
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-5">
              <div>
                <label htmlFor="save-filter-name" className="mb-2 block text-sm font-bold text-paper-muted">Tên bộ lọc</label>
                <input
                  id="save-filter-name"
                  type="text"
                  value={saveFilterName}
                  onChange={(e) => setSaveFilterName(e.target.value)}
                  placeholder="Ví dụ: Negative web mentions"
                  className="w-full rounded-lg border border-edge-strong bg-void-surface px-3 py-2 text-sm text-paper placeholder:text-paper-faint outline-none transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                  autoFocus
                />
              </div>
              <div className="rounded-lg bg-void-raised p-3 text-xs text-paper-muted">
                <p className="font-bold text-paper">Bộ lọc hiện tại</p>
                <p>Từ khóa: {searchTerm || 'Không có'}</p>
                <p>Cảm xúc: {filters.sentiment || 'Tất cả'}</p>
                <p>Nguồn: {filters.source_type || 'Tất cả'}</p>
                <p>Sắp xếp: {filters.sort_by}</p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSaveFilterModalOpen(false)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold text-paper-muted transition-colors duration-150 motion-reduce:transition-none hover:bg-paper/[0.04] hover:text-paper ${focusRing}`}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveFilter}
                  disabled={!activeProject || !saveFilterName.trim()}
                  className="rounded-lg bg-signal px-4 py-2 text-sm font-bold text-white transition-colors duration-150 motion-reduce:transition-none hover:bg-signal-deep dark:hover:bg-signal-bright disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                >
                  Lưu bộ lọc
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scan Confirm Modal */}
      {scanConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-paper/25 dark:bg-void/70 backdrop-blur-sm">
          <div className="bg-void-surface border border-edge rounded-2xl w-full max-w-md overflow-hidden shadow-tile">
            <div className="p-6">
              <h2 className="text-xl font-bold text-paper mb-2">Xác nhận quét</h2>
              <p className="text-paper-muted mb-6 leading-relaxed">
                Từ khóa bạn đang tìm kiếm (<span className="font-bold text-signal dark:text-signal-bright">{scanConfirm.keyword}</span>) khác với tên project hiện tại (<span className="font-bold">{activeProject?.name}</span>). Bạn có chắc chắn muốn quét từ khóa này vào project hiện tại không?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setScanConfirm({ isOpen: false, keyword: '' })}
                  className={`px-5 py-2 rounded-xl text-sm font-bold text-paper-muted hover:text-paper hover:bg-paper/[0.04] transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
                >
                  Hủy
                </button>
                <button
                  onClick={() => executeScan(scanConfirm.keyword)}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                >
                  Tiếp tục quét
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MentionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-paper-faint">Đang tải dữ liệu...</div>}>
      <MentionsPageContent />
    </Suspense>
  );
}
