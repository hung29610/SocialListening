'use client';
import { useState, useEffect } from 'react';
import { FileText, Download, RefreshCcw, Eye, Settings2, Palette, Layout, Type, Lock } from 'lucide-react';
import { reports as reportsApi } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { ReportDataScopeNotice } from '@/components/reports/ReportDataScopeNotice';
import { ExportHistoryTable } from '@/components/reports/ExportHistoryTable';
import { PdfPreviewModal } from './PdfPreviewModal';

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

/* SIGNAL shared micro-interaction primitive (150–250ms, reduced-motion honored) */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';

const DATE_RANGE_OPTIONS = [
  { labelKey: 'reports.dateToday', value: '1d', days: 1 },
  { labelKey: 'reports.date7d', value: '7d', days: 7 },
  { labelKey: 'reports.date30d', value: '30d', days: 30 },
  { labelKey: 'reports.date90d', value: '90d', days: 90 },
  { labelKey: 'reports.dateAll', value: 'all', days: null },
];

const FONT_OPTIONS = [
  { value: 'Helvetica', labelKey: 'reportsPage.pdf.font.helveticaDefault' },
  { value: 'Times-Roman', labelKey: 'reportsPage.pdf.font.timesNewRoman' },
  { value: 'Courier', labelKey: 'reportsPage.pdf.font.courier' },
];

const ASPECT_RATIO_OPTIONS = [
  { value: 'vertical', labelKey: 'reportsPage.pdf.aspect.vertical' },
  { value: 'horizontal', labelKey: 'reportsPage.pdf.aspect.horizontal' },
];

const AVAILABLE_SECTIONS = [
  { id: 'summary', titleKey: 'reports.summary', descKey: 'reportsPage.pdf.sections.summary.desc' },
  { id: 'overview', titleKey: 'reportsPage.pdf.sections.overview.title', descKey: 'reportsPage.pdf.sections.overview.desc' },
  { id: 'executive_summary', titleKey: 'reportsPage.pdf.sections.executiveSummary.title', descKey: 'reportsPage.pdf.sections.executiveSummary.desc' },
  { id: 'analysis', titleKey: 'reportsPage.pdf.sections.analysis.title', descKey: 'reportsPage.pdf.sections.analysis.desc' },
  { id: 'ai_visibility', titleKey: 'reportsPage.pdf.sections.aiVisibility.title', descKey: 'reportsPage.pdf.sections.aiVisibility.desc', disabled: true, reasonKey: 'reportsPage.pdf.sections.aiVisibility.reason' },
  { id: 'demographics', titleKey: 'reportsPage.pdf.sections.demographics.title', descKey: 'reportsPage.pdf.sections.demographics.desc', disabled: true, reasonKey: 'reportsPage.pdf.sections.demographics.reason' },
  { id: 'project_comparison', titleKey: 'reportsPage.pdf.sections.projectComparison.title', descKey: 'reportsPage.pdf.sections.projectComparison.desc', disabled: true, reasonKey: 'reportsPage.pdf.sections.projectComparison.reason' },
  { id: 'period_comparison', titleKey: 'reportsPage.pdf.sections.periodComparison.title', descKey: 'reportsPage.pdf.sections.periodComparison.desc' },
  { id: 'influencers_sources', titleKey: 'reports.influencers', descKey: 'reportsPage.pdf.sections.influencersSources.desc' },
  { id: 'active_sites', titleKey: 'reportsPage.pdf.sections.activeSites.title', descKey: 'reportsPage.pdf.sections.activeSites.desc', disabled: true, reasonKey: 'reportsPage.pdf.sections.activeSites.reason' },
  { id: 'influential_sites', titleKey: 'reportsPage.pdf.sections.influentialSites.title', descKey: 'reportsPage.pdf.sections.influentialSites.desc', disabled: true, reasonKey: 'reportsPage.pdf.sections.influentialSites.reason' },
  { id: 'mention_tags', titleKey: 'reportsPage.pdf.sections.mentionTags.title', descKey: 'reportsPage.pdf.sections.mentionTags.desc', disabled: true, reasonKey: 'reportsPage.pdf.sections.mentionTags.reason' },
  { id: 'top_mentions', titleKey: 'reportsPage.pdf.sections.topMentions.title', descKey: 'reportsPage.pdf.sections.topMentions.desc' },
  { id: 'recent_mentions', titleKey: 'reportsPage.pdf.sections.recentMentions.title', descKey: 'reportsPage.pdf.sections.recentMentions.desc' },
  { id: 'sentiment', titleKey: 'reports.sentiment', descKey: 'reportsPage.pdf.sections.sentiment.desc', disabled: true, reasonKey: 'reportsPage.pdf.sections.sentiment.reason' },
  { id: 'mentions_reach', titleKey: 'reportsPage.pdf.sections.mentionsReach.title', descKey: 'reportsPage.pdf.sections.mentionsReach.desc', disabled: true, reasonKey: 'reportsPage.pdf.sections.mentionsReach.reason' },
  { id: 'categories', titleKey: 'reportsPage.pdf.sections.categories.title', descKey: 'reportsPage.pdf.sections.categories.desc', disabled: true, reasonKey: 'reportsPage.pdf.sections.categories.reason' },
  { id: 'trending_hashtags', titleKey: 'reportsPage.pdf.sections.trendingHashtags.title', descKey: 'reportsPage.pdf.sections.trendingHashtags.desc', disabled: true, reasonKey: 'reportsPage.pdf.sections.trendingHashtags.reason' },
  { id: 'emojis', titleKey: 'reportsPage.pdf.sections.emojis.title', descKey: 'reportsPage.pdf.sections.emojis.desc', disabled: true, reasonKey: 'reportsPage.pdf.sections.emojis.reason' }
];

export default function PdfReportPage() {
  const { activeProject } = useProject();
  const { t } = useLanguage();
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [exportHistory, setExportHistory] = useState<any[]>([]);
  const [exportHistoryLoading, setExportHistoryLoading] = useState(true);

  // Customization State
  // NOTE: accent/font colors are EXPORT CONFIG sent to the backend PDF
  // renderer (baked into the generated document) — they are data, not UI
  // palette, so they intentionally stay as raw hex values.
  const [sections, setSections] = useState(AVAILABLE_SECTIONS.map(s => ({ ...s, enabled: !s.disabled })));
  const [theme, setTheme] = useState('light');
  const [accentColor, setAccentColor] = useState('#3b82f6');
  const [fontColor, setFontColor] = useState('#1e293b');
  const [fontFamily, setFontFamily] = useState('Helvetica');
  const [aspectRatio, setAspectRatio] = useState('vertical');
  const [language, setLanguage] = useState('english');

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchExports();
    const interval = setInterval(() => {
      setExportHistory(prev => {
        if (prev.some(e => e.status === 'pending' || e.status === 'running')) {
          fetchExports();
        }
        return prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchExports = async () => {
    setExportHistoryLoading(true);
    try {
      const res = await reportsApi.listExports(1, 10, 'pdf');
      setExportHistory(res.items || []);
    } catch (e) {}
    finally { setExportHistoryLoading(false); }
  };

  const getParams = () => {
    const params: Record<string, any> = {};
    if (activeProject) params.project_id = activeProject.id;
    const selectedRange = DATE_RANGE_OPTIONS.find(r => r.value === dateRange);
    if (selectedRange?.days) {
      const now = new Date();
      const from = new Date();
      from.setDate(now.getDate() - selectedRange.days);
      params.date_from = from.toISOString();
      params.date_to = now.toISOString();
    }
    return params;
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const params = getParams();

      const config = {
        date_from: params.date_from,
        date_to: params.date_to,
        sections: sections.filter(s => s.enabled).map(s => ({ id: s.id, enabled: true })),
        theme,
        accent_color: accentColor,
        font_color: fontColor,
        font_style: fontFamily,
        aspect_ratio: aspectRatio,
        language
      };

      await reportsApi.requestExport('pdf', activeProject?.id, config);
      toast.success(t('reports.pdfRequested'));
      fetchExports();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || t('reports.exportRequestError'));
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async () => {
    try {
      setPreviewLoading(true);
      setPreviewOpen(true);
      const params = getParams();
      const res = await reportsApi.summaryData(params);
      setPreviewData(res);
    } catch (error) {
      toast.error(t('reportsPage.pdf.errors.previewLoadFailed'));
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadFile = async (exportId: number, filename: string) => {
    try {
      const blob = await reportsApi.downloadExport(exportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(t('reports.downloadFailed'));
    }
  };

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id && !s.disabled ? { ...s, enabled: !s.enabled } : s));
  };

  const selectedDateRange = DATE_RANGE_OPTIONS.find(r => r.value === dateRange);
  const selectedDateRangeLabel = selectedDateRange ? t(selectedDateRange.labelKey) : undefined;

  return (
    <div className="max-w-7xl mx-auto py-10 space-y-6">
      <ReportDataScopeNotice
        projectName={activeProject?.name}
        dateRange={dateRange}
        dateRangeLabel={selectedDateRangeLabel}
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Main Content Area: Sections List */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-void-surface rounded-2xl shadow-tile border border-edge p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-paper">{t('reports.reportContent')}</h2>
                <p className="text-paper-muted mt-1">{t('reportsPage.pdf.contentHint')}</p>
              </div>
              <div className="p-3 bg-signal/10 rounded-xl">
                <FileText className="w-6 h-6 text-signal dark:text-signal-bright" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sections.map((section) => (
                <div key={section.id} className={cn("flex flex-col p-4 rounded-xl border", section.disabled ? "border-edge bg-void-raised opacity-60" : "border-edge bg-void-raised")}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-paper">{t(section.titleKey)}</h3>
                      <p className="text-sm text-paper-muted mt-1">{t(section.descKey)}</p>
                    </div>
                    {!section.disabled && (
                      <label className="relative inline-flex items-center cursor-pointer mt-1">
                        <input type="checkbox" className="sr-only peer" checked={section.enabled} onChange={() => toggleSection(section.id)} />
                        <div className="w-9 h-5 bg-edge-strong peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-signal/70 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-void after:border-edge after:border after:rounded-full after:h-4 after:w-4 after:transition-all motion-reduce:after:transition-none peer-checked:bg-signal"></div>
                      </label>
                    )}
                  </div>
                  {section.disabled && (
                    <div className="mt-3 text-xs font-medium text-warning bg-warning/10 p-2 rounded">
                      {t('reportsPage.pdf.unavailable')} {section.reasonKey ? t(section.reasonKey) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar: Customization & Actions */}
        <div className="space-y-6">
          <div className="bg-void-surface rounded-2xl shadow-tile border border-edge p-6">
            <h3 className="text-lg font-bold text-paper mb-6 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-paper-faint" /> {t('reports.customizeReport')}
            </h3>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-paper flex items-center gap-2 mb-2">
                  <Layout className="w-4 h-4 text-paper-faint" /> {t('reportsPage.pdf.theme')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setTheme('light')} className={cn("p-2 rounded-lg border text-sm font-medium transition-colors duration-150 motion-reduce:transition-none", focusRing, theme === 'light' ? "border-signal bg-signal/10 text-signal dark:text-signal-bright" : "border-edge text-paper-muted hover:border-edge-strong")}>{t('reportsPage.pdf.themeLight')}</button>
                  <button onClick={() => setTheme('dark')} className={cn("p-2 rounded-lg border text-sm font-medium transition-colors duration-150 motion-reduce:transition-none", focusRing, theme === 'dark' ? "border-signal bg-signal/10 text-signal dark:text-signal-bright" : "border-edge text-paper-muted hover:border-edge-strong")}>{t('reportsPage.pdf.themeDark')}</button>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-paper flex items-center gap-2 mb-2">
                  <Palette className="w-4 h-4 text-paper-faint" /> {t('reports.pickAccentColor')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {/* Export accent swatches: raw hex by design — sent to the backend PDF renderer as accent_color. */}
                  {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6'].map(c => (
                    <button key={c} onClick={() => setAccentColor(c)} className={cn("w-6 h-6 rounded-full border-2 border-transparent transition-transform duration-150 motion-reduce:transition-none motion-reduce:hover:scale-100", focusRing, accentColor === c ? "scale-110 ring-2 ring-signal ring-offset-2 ring-offset-void-surface" : "")} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-paper flex items-center gap-2 mb-2">
                  <Type className="w-4 h-4 text-paper-faint" /> {t('reportsPage.pdf.fontFamily')}
                </label>
                <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="w-full bg-void-surface border border-edge-strong rounded-lg px-3 py-2 text-sm text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal">
                  {FONT_OPTIONS.map(font => (
                    <option key={font.value} value={font.value}>{t(font.labelKey)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-paper mb-2 block">{t('reports.chooseFontColor')}</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={fontColor} onChange={e => setFontColor(e.target.value)} className="w-10 h-10 rounded border-0 cursor-pointer bg-transparent p-0" />
                  <span className="text-sm font-mono text-paper-muted">{fontColor}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-paper mb-2 block">{t('reportsPage.pdf.aspectRatio')}</label>
                <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-void-surface border border-edge-strong rounded-lg px-3 py-2 text-sm text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal">
                  {ASPECT_RATIO_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-paper mb-2 block">{t('reportsPage.pdf.language')}</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-void-surface border border-edge-strong rounded-lg px-3 py-2 text-sm text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal">
                  <option value="english">{t('reportsPage.pdf.languageEnglish')}</option>
                  <option value="vietnamese" disabled>{t('reportsPage.pdf.languageVietnamese')}</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-paper mb-2 block">{t('reportsPage.pdf.reportLogo')}</label>
                <div className="w-full flex flex-col items-center justify-center gap-2 bg-void-raised border border-edge rounded-lg px-3 py-4 text-sm opacity-70">
                  <Lock className="w-5 h-5 text-paper-faint" />
                  <span className="text-paper-faint text-center text-xs px-2">{t('reportsPage.pdf.logoDisabled')}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-paper mb-2 block">{t('reports.timeRange')}</label>
                <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="w-full bg-void-surface border border-edge-strong rounded-lg px-3 py-2 text-sm text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal">
                  {DATE_RANGE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-void-surface rounded-2xl shadow-tile border border-edge p-6 flex flex-col gap-3">
            <button onClick={loadPreview} className={`w-full py-3 px-4 bg-void-raised border border-edge text-paper hover:border-edge-strong rounded-xl font-bold flex items-center justify-center gap-2 transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>
              <Eye className="w-5 h-5" /> {t('reportsPage.pdf.livePreview')}
            </button>
            <button onClick={handleGenerate} disabled={loading} className={`w-full py-3 px-4 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors duration-150 motion-reduce:transition-none ${focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:opacity-50`}>
              {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {loading ? t('reports.generating') : t('reportsPage.pdf.generate')}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-void-surface p-6 rounded-2xl shadow-tile border border-edge">
        <h3 className="text-lg font-bold text-paper mb-4">{t('reports.recentExports')}</h3>
        <ExportHistoryTable exports={exportHistory} loading={exportHistoryLoading} onDownload={downloadFile} />
      </div>

      <PdfPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        data={previewData}
        loading={previewLoading}
        config={{ sections, theme, accentColor, fontColor, fontFamily, aspectRatio, language }}
      />
    </div>
  );
}
