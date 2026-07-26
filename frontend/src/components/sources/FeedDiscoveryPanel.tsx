'use client';

import { useRef, useState } from 'react';
import { Loader2, Rss, Search, Upload, Ban, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { localizedApiErrorMessage } from '@/lib/apiErrors';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Two real ways to bring more genuine sources in:
 *
 *  1. paste a website URL and let the backend read the feeds the page itself
 *     advertises (<link rel="alternate" type="application/rss+xml">)
 *  2. upload an OPML export from any feed reader
 *
 * Both flows are preview-then-confirm: nothing is stored until the user selects
 * feeds and presses import, and imported feeds start disabled so nothing claims
 * to be "connected" before a collection run has actually succeeded.
 */

type CandidateStatus = 'available' | 'blocked';

interface Candidate {
  url: string;
  title?: string | null;
  kind?: string;
  status: CandidateStatus;
  error_code?: string;
  error_message?: string;
}

interface ImportResultRow {
  url: string;
  name?: string | null;
  status: 'created' | 'duplicate' | 'blocked' | 'invalid' | 'failed';
  error_code?: string;
  error_message?: string;
  source_id?: number | null;
}

interface ImportSummary {
  created: number;
  duplicate: number;
  blocked: number;
  invalid: number;
  failed: number;
  total: number;
}

const STATUS_STYLES: Record<string, string> = {
  created: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  duplicate: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  blocked: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',
  invalid: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',
  failed: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',
  available: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20',
};

export interface FeedDiscoveryPanelProps {
  /** Called after a successful import so the parent can refresh its list. */
  onImported?: () => void;
}

export default function FeedDiscoveryPanel({ onImported }: FeedDiscoveryPanelProps) {
  const { t, language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState('');
  const [searched, setSearched] = useState(false);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [inputWasFeed, setInputWasFeed] = useState(false);

  const [opmlTitle, setOpmlTitle] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResultRow[] | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const resetPreview = () => {
    setCandidates([]);
    setSelected({});
    setImportResults(null);
    setImportSummary(null);
    setPageTitle(null);
    setOpmlTitle(null);
    setInputWasFeed(false);
    setDiscoverError('');
  };

  const availableCandidates = candidates.filter(c => c.status === 'available');
  const selectedUrls = availableCandidates.filter(c => selected[c.url]).map(c => c.url);

  const handleDiscover = async () => {
    const url = websiteUrl.trim();
    if (!url) {
      toast.error(t('sourceDiscovery.errors.urlRequired'));
      return;
    }
    resetPreview();
    setSearched(true);
    setDiscovering(true);
    try {
      const response = await api.post('/api/sources/discover-feeds', { url });
      const data = response.data;
      if (!data.ok) {
        const code = data.error_code as string | undefined;
        setDiscoverError(code ? t(`errors.code.${code}`) : t('errors.unknown'));
        return;
      }
      setPageTitle(data.page_title ?? null);
      setInputWasFeed(Boolean(data.input_was_feed));
      const found: Candidate[] = data.feeds ?? [];
      setCandidates(found);
      setSelected(
        Object.fromEntries(found.filter(f => f.status === 'available').map(f => [f.url, true])),
      );
    } catch (error) {
      setDiscoverError(localizedApiErrorMessage(error, t, language));
    } finally {
      setDiscovering(false);
    }
  };

  const handleOpmlChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    resetPreview();
    setSearched(true);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/api/sources/opml/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = response.data;
      setOpmlTitle(data.title ?? null);
      const found: Candidate[] = data.feeds ?? [];
      setCandidates(found);
      setSelected(
        Object.fromEntries(found.filter(f => f.status === 'available').map(f => [f.url, true])),
      );
      if (data.truncated) toast(t('sourceDiscovery.opml.truncated'), { icon: 'ℹ️' });
    } catch (error) {
      setDiscoverError(localizedApiErrorMessage(error, t, language));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (selectedUrls.length === 0) {
      toast.error(t('sourceDiscovery.errors.selectAtLeastOne'));
      return;
    }
    setImporting(true);
    try {
      const feeds = availableCandidates
        .filter(c => selected[c.url])
        .map(c => ({ url: c.url, name: c.title || undefined, kind: c.kind }));
      const response = await api.post('/api/sources/import-feeds', { feeds, activate: false });
      setImportResults(response.data.results ?? []);
      setImportSummary(response.data.summary ?? null);

      const created = response.data.summary?.created ?? 0;
      if (created > 0) {
        toast.success(t('sourceDiscovery.import.created', { count: created }));
        onImported?.();
      } else {
        toast(t('sourceDiscovery.import.noneCreated'), { icon: 'ℹ️' });
      }
    } catch (error) {
      toast.error(localizedApiErrorMessage(error, t, language));
    } finally {
      setImporting(false);
    }
  };

  const statusLabel = (status: string) => t(`sourceDiscovery.status.${status}`);

  return (
    <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-[#050A15]">
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
          <Rss className="h-4 w-4 text-orange-500" />
          {t('sourceDiscovery.title')}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">{t('sourceDiscovery.subtitle')}</p>
      </div>

      {/* ── 1. Website auto-discovery ── */}
      <div className="space-y-2">
        <label htmlFor="discovery-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('sourceDiscovery.website.label')}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="discovery-url"
            type="url"
            inputMode="url"
            value={websiteUrl}
            onChange={e => setWebsiteUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleDiscover();
            }}
            placeholder={t('sourceDiscovery.website.placeholder')}
            className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm transition-colors placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 dark:border-white/10 dark:bg-white/[0.07] dark:text-white"
          />
          <button
            type="button"
            onClick={handleDiscover}
            disabled={discovering || uploading}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {discovering ? t('sourceDiscovery.website.searching') : t('sourceDiscovery.website.search')}
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-gray-400">{t('sourceDiscovery.website.hint')}</p>
      </div>

      {/* ── 2. OPML import ── */}
      <div className="space-y-2 border-t border-gray-100 pt-4 dark:border-white/5">
        <label htmlFor="opml-file" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('sourceDiscovery.opml.label')}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            id="opml-file"
            ref={fileInputRef}
            type="file"
            accept=".opml,.xml,text/xml,application/xml"
            onChange={handleOpmlChange}
            disabled={uploading || discovering}
            className="block w-full min-w-0 cursor-pointer rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-indigo-700 dark:border-white/10 dark:bg-white/[0.07] dark:text-white dark:file:bg-indigo-500/10 dark:file:text-indigo-300"
          />
          {uploading && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('sourceDiscovery.opml.parsing')}
            </span>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400">
          <Upload className="h-3 w-3" />
          {t('sourceDiscovery.opml.hint')}
        </p>
      </div>

      {/* ── Errors ── */}
      {discoverError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{discoverError}</span>
        </div>
      )}

      {/* ── Honest empty state ── */}
      {searched && !discovering && !uploading && !discoverError && candidates.length === 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('sourceDiscovery.emptyState')}</span>
        </div>
      )}

      {/* ── Candidate list ── */}
      {candidates.length > 0 && (
        <div className="space-y-3 border-t border-gray-100 pt-4 dark:border-white/5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t('sourceDiscovery.results.title', { count: candidates.length })}
              </h3>
              {(pageTitle || opmlTitle) && (
                <p className="text-xs text-slate-500 dark:text-gray-400">{pageTitle || opmlTitle}</p>
              )}
              {inputWasFeed && (
                <p className="text-xs text-sky-600 dark:text-sky-400">{t('sourceDiscovery.results.inputWasFeed')}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelected(Object.fromEntries(availableCandidates.map(c => [c.url, true])))
                }
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {t('sourceDiscovery.results.selectAll')}
              </button>
              <button
                type="button"
                onClick={() => setSelected({})}
                className="text-xs font-medium text-slate-500 hover:underline dark:text-gray-400"
              >
                {t('sourceDiscovery.results.clearSelection')}
              </button>
            </div>
          </div>

          <ul className="space-y-2">
            {candidates.map(candidate => {
              const blocked = candidate.status === 'blocked';
              return (
                <li
                  key={candidate.url}
                  className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 dark:border-white/10"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(selected[candidate.url])}
                    disabled={blocked}
                    onChange={e => setSelected(prev => ({ ...prev, [candidate.url]: e.target.checked }))}
                    aria-label={t('sourceDiscovery.results.selectFeed', {
                      name: candidate.title || candidate.url,
                    })}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {candidate.title || candidate.url}
                    </p>
                    <p className="truncate text-xs text-slate-500 dark:text-gray-400">{candidate.url}</p>
                    {blocked && candidate.error_code && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
                        <Ban className="h-3 w-3" />
                        {t(`errors.code.${candidate.error_code}`)}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      STATUS_STYLES[candidate.status] || STATUS_STYLES.available
                    }`}
                  >
                    {statusLabel(candidate.status)}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-gray-400">
              {t('sourceDiscovery.results.willBeDisabled')}
            </p>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || selectedUrls.length === 0}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {importing
                ? t('sourceDiscovery.import.importing')
                : t('sourceDiscovery.import.confirm', { count: selectedUrls.length })}
            </button>
          </div>
        </div>
      )}

      {/* ── Per-feed import outcome ── */}
      {importResults && importSummary && (
        <div className="space-y-2 border-t border-gray-100 pt-4 dark:border-white/5">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('sourceDiscovery.import.resultTitle')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            {t('sourceDiscovery.import.summary', {
              created: importSummary.created,
              duplicate: importSummary.duplicate,
              blocked: importSummary.blocked,
              invalid: importSummary.invalid,
              failed: importSummary.failed,
            })}
          </p>
          <ul className="space-y-1.5">
            {importResults.map(row => (
              <li
                key={`${row.url}-${row.status}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-white/5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-800 dark:text-gray-200">
                    {row.name || row.url}
                  </p>
                  {row.error_code && (
                    <p className="truncate text-[11px] text-slate-500 dark:text-gray-400">
                      {t(`errors.code.${row.error_code}`)}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    STATUS_STYLES[row.status] || STATUS_STYLES.failed
                  }`}
                >
                  {statusLabel(row.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
