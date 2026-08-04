'use client';
import { useState } from 'react';
import { FileText, Download, RefreshCcw, Eye, Settings2, Palette, Layout, Type, Lock } from 'lucide-react';
import { reports as reportsApi } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { ReportDataScopeNotice } from '@/components/reports/ReportDataScopeNotice';
import { PdfPreviewModal } from './PdfPreviewModal';

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

/* SIGNAL shared micro-interaction primitive (150–250ms, reduced-motion honored) */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';

const DATE_RANGE_OPTIONS = [
  { label: 'Today', value: '1d', days: 1 },
  { label: 'Last 7 days', value: '7d', days: 7 },
  { label: 'Last 30 days', value: '30d', days: 30 },
  { label: 'Last 90 days', value: '90d', days: 90 },
  { label: 'All time', value: 'all', days: null },
];

const AVAILABLE_SECTIONS = [
  { id: 'summary', title: 'Summary', desc: 'Title page with basic info' },
  { id: 'overview', title: 'Overview', desc: 'KPIs and high-level metrics' },
  { id: 'executive_summary', title: 'Executive Summary', desc: 'AI-generated summary text' },
  { id: 'analysis', title: 'Analysis', desc: 'Sentiment breakdown and volume trend' },
  { id: 'ai_visibility', title: 'AI Visibility', desc: 'Brand visibility in AI models', disabled: true, reason: 'AI visibility score not supported by current data model.' },
  { id: 'demographics', title: 'Demographics', desc: 'Audience age and gender', disabled: true, reason: 'Demographics parsing not fully implemented in current pipeline.' },
  { id: 'project_comparison', title: 'Project Comparison', desc: 'Compare with other projects', disabled: true, reason: 'Only single-project reporting supported currently.' },
  { id: 'period_comparison', title: 'Period Comparison', desc: 'Compare with previous period' },
  { id: 'influencers_sources', title: 'Influencers & Sources', desc: 'Top authors and platforms' },
  { id: 'active_sites', title: 'Active Sites', desc: 'Most active domains', disabled: true, reason: 'Included inside Sources section.' },
  { id: 'influential_sites', title: 'Most Influential Sites', desc: 'Sites by influence score', disabled: true, reason: 'Influence scores per site not currently tracked.' },
  { id: 'mention_tags', title: 'Mention Tags', desc: 'Distribution of applied tags', disabled: true, reason: 'Mention tags not natively supported in reports endpoint.' },
  { id: 'top_mentions', title: 'Top Mentions', desc: 'Most impactful mentions by reach' },
  { id: 'recent_mentions', title: 'Recent Mentions', desc: 'Latest mentions chronologically' },
  { id: 'sentiment', title: 'Sentiment', desc: 'Detailed sentiment analysis', disabled: true, reason: 'Included inside Analysis section in this version.' },
  { id: 'mentions_reach', title: 'Mentions & Reach', desc: 'Volume and reach over time', disabled: true, reason: 'Included inside Analysis section in this version.' },
  { id: 'categories', title: 'Categories / Sources', desc: 'Top domains and tags', disabled: true, reason: 'Included inside Influencers & Sources section.' },
  { id: 'trending_hashtags', title: 'Trending Hashtags / Links', desc: 'Most common hashtags', disabled: true, reason: 'Hashtag extraction not fully supported by current data model.' },
  { id: 'emojis', title: 'Emojis / Discussion Context', desc: 'Frequently used emojis', disabled: true, reason: 'Emoji extraction not supported by current data model.' }
];

export default function PdfReportPage() {
  const { activeProject } = useProject();
  const { t } = useLanguage();
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(false);

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

      if (!activeProject?.id) throw new Error('Select a project before exporting');
      const blob = await reportsApi.requestExport('pdf', activeProject.id, config);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nope360-project-${activeProject.id}-report.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(t('reports.pdfDownloaded'));
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Error requesting export');
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
      toast.error('Failed to load preview data');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const toggleSection = (id: string) => {
    setSections(prev => prev.map(s => s.id === id && !s.disabled ? { ...s, enabled: !s.enabled } : s));
  };

  return (
    <div className="max-w-7xl mx-auto py-10 space-y-6">
      <ReportDataScopeNotice
        projectName={activeProject?.name}
        dateRange={dateRange}
        dateRangeLabel={DATE_RANGE_OPTIONS.find(r => r.value === dateRange)?.label}
      />
      <p className="text-sm text-paper-muted">{t('reports.noRetentionNotice')}</p>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

        {/* Main Content Area: Sections List */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-void-surface rounded-2xl shadow-tile border border-edge p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-paper">Report Content</h2>
                <p className="text-paper-muted mt-1">Select the sections to include in your PDF.</p>
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
                      <h3 className="font-semibold text-paper">{section.title}</h3>
                      <p className="text-sm text-paper-muted mt-1">{section.desc}</p>
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
                      Unavailable: {section.reason}
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
              <Settings2 className="w-5 h-5 text-paper-faint" /> Customization
            </h3>

            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-paper flex items-center gap-2 mb-2">
                  <Layout className="w-4 h-4 text-paper-faint" /> Theme
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setTheme('light')} className={cn("p-2 rounded-lg border text-sm font-medium transition-colors duration-150 motion-reduce:transition-none", focusRing, theme === 'light' ? "border-signal bg-signal/10 text-signal dark:text-signal-bright" : "border-edge text-paper-muted hover:border-edge-strong")}>Light</button>
                  <button onClick={() => setTheme('dark')} className={cn("p-2 rounded-lg border text-sm font-medium transition-colors duration-150 motion-reduce:transition-none", focusRing, theme === 'dark' ? "border-signal bg-signal/10 text-signal dark:text-signal-bright" : "border-edge text-paper-muted hover:border-edge-strong")}>Dark</button>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-paper flex items-center gap-2 mb-2">
                  <Palette className="w-4 h-4 text-paper-faint" /> Accent Color
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
                  <Type className="w-4 h-4 text-paper-faint" /> Font Family
                </label>
                <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="w-full bg-void-surface border border-edge-strong rounded-lg px-3 py-2 text-sm text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal">
                  <option value="Helvetica">Helvetica (Default)</option>
                  <option value="Times-Roman">Times New Roman</option>
                  <option value="Courier">Courier</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-paper mb-2 block">Font Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={fontColor} onChange={e => setFontColor(e.target.value)} className="w-10 h-10 rounded border-0 cursor-pointer bg-transparent p-0" />
                  <span className="text-sm font-mono text-paper-muted">{fontColor}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-paper mb-2 block">Aspect Ratio</label>
                <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="w-full bg-void-surface border border-edge-strong rounded-lg px-3 py-2 text-sm text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal">
                  <option value="vertical">Vertical (A4 Portrait)</option>
                  <option value="horizontal">Horizontal (Landscape)</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-paper mb-2 block">Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full bg-void-surface border border-edge-strong rounded-lg px-3 py-2 text-sm text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal">
                  <option value="english">English</option>
                  <option value="vietnamese" disabled>Vietnamese (Not translated in PDF yet)</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-paper mb-2 block">Report Logo</label>
                <div className="w-full flex flex-col items-center justify-center gap-2 bg-void-raised border border-edge rounded-lg px-3 py-4 text-sm opacity-70">
                  <Lock className="w-5 h-5 text-paper-faint" />
                  <span className="text-paper-faint text-center text-xs px-2">Logo upload is disabled until report asset storage is implemented.</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-paper mb-2 block">Time Range</label>
                <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="w-full bg-void-surface border border-edge-strong rounded-lg px-3 py-2 text-sm text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal">
                  {DATE_RANGE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-void-surface rounded-2xl shadow-tile border border-edge p-6 flex flex-col gap-3">
            <button onClick={loadPreview} className={`w-full py-3 px-4 bg-void-raised border border-edge text-paper hover:border-edge-strong rounded-xl font-bold flex items-center justify-center gap-2 transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>
              <Eye className="w-5 h-5" /> Live Preview
            </button>
            <button onClick={handleGenerate} disabled={loading} className={`w-full py-3 px-4 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors duration-150 motion-reduce:transition-none ${focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:opacity-50`}>
              {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              {loading ? 'Generating...' : 'Generate PDF'}
            </button>
          </div>
        </div>
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
