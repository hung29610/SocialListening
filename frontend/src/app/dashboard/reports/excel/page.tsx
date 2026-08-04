'use client';

import { useState } from 'react';
import { FileSpreadsheet, Download, RefreshCcw, Table, Check } from 'lucide-react';
import { mentions as mentionsApi, reports as reportsApi } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';
import { ReportDataScopeNotice } from '@/components/reports/ReportDataScopeNotice';

const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

const DATE_RANGE_OPTIONS = [
  { label: 'Today', value: '1d', days: 1 },
  { label: 'Last 7 days', value: '7d', days: 7 },
  { label: 'Last 30 days', value: '30d', days: 30 },
  { label: 'Last 90 days', value: '90d', days: 90 },
  { label: 'All time', value: 'all', days: null },
];

export default function ExcelReportPage() {
  const { activeProject } = useProject();
  const { t } = useLanguage();
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(false);
  const [exportScope, setExportScope] = useState<'all' | 'mentions'>('all');

  const handleExport = async () => {
    try {
      setLoading(true);
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

      let blob;
      let filename;

      if (exportScope === 'all') {
        if (!activeProject?.id) throw new Error(t('reports.exportRequestError'));
        const blob = await reportsApi.requestExport('excel', activeProject.id, {
          date_from: params.date_from,
          date_to: params.date_to,
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `nope360-project-${activeProject.id}-report.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(t('reports.excelDownloaded'));
      } else {
        // Raw mentions CSV still synchronous
        const blob = await mentionsApi.exportCsv(params);
        const filename = `Nope360_Mentions_Export_${new Date().toISOString().slice(0, 10)}.csv`;
        if (!blob || blob.size === 0) {
          toast.error(t('reports.noFilteredData'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t('reports.csvDownloaded'));
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || t('reports.exportRequestError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">

      {/* Data Scope Notice */}
      <ReportDataScopeNotice
        projectName={activeProject?.name}
        dateRange={dateRange}
        dateRangeLabel={DATE_RANGE_OPTIONS.find(r => r.value === dateRange)?.label}
      />
      <p className="text-sm text-paper-muted">{t('reports.noRetentionNotice')}</p>

      <div className="bg-void-surface rounded-2xl shadow-tile border border-edge overflow-hidden">

        {/* Header */}
        <div className="p-8 border-b border-edge">
          <div className="w-12 h-12 bg-signal/10 rounded-xl flex items-center justify-center mb-6">
            <FileSpreadsheet className="w-6 h-6 text-signal dark:text-signal-bright" />
          </div>
          <h2 className="text-2xl font-bold text-paper mb-2">{t('reports.excelTitle')}</h2>
          <p className="text-paper-muted text-sm">{t('reports.excelSubtitle')}</p>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-8">

          <div className="space-y-4">
            <label className="text-sm font-semibold text-paper">{t('reports.dataScope')}</label>

            <div
              className={cn(
                "p-4 rounded-xl border-2 cursor-pointer transition-colors duration-150 motion-reduce:transition-none flex items-start gap-4",
                exportScope === 'all' ? "border-signal bg-signal/10" : "border-edge hover:border-edge-strong"
              )}
              onClick={() => setExportScope('all')}
            >
              <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5", exportScope === 'all' ? "border-signal bg-signal" : "border-edge-strong")}>
                {exportScope === 'all' && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <div>
                <h4 className="font-bold text-paper mb-1">{t('reports.dataScopeAllTitle')}</h4>
                <p className="text-sm text-paper-muted">{t('reports.dataScopeAllDesc')}</p>
              </div>
            </div>

            <div
              className={cn(
                "p-4 rounded-xl border-2 cursor-pointer transition-colors duration-150 motion-reduce:transition-none flex items-start gap-4",
                exportScope === 'mentions' ? "border-signal bg-signal/10" : "border-edge hover:border-edge-strong"
              )}
              onClick={() => setExportScope('mentions')}
            >
              <div className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5", exportScope === 'mentions' ? "border-signal bg-signal" : "border-edge-strong")}>
                {exportScope === 'mentions' && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <div>
                <h4 className="font-bold text-paper mb-1">{t('reports.dataScopeMentionsTitle')}</h4>
                <p className="text-sm text-paper-muted">{t('reports.dataScopeMentionsDesc')}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-semibold text-paper">{t('reports.timeRange')}</label>
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="w-full max-w-xs bg-void-surface border border-edge-strong rounded-xl px-4 py-3 text-sm text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
            >
              {DATE_RANGE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{
                  opt.value === '1d' ? t('reports.dateToday') :
                  opt.value === '7d' ? t('reports.date7d') :
                  opt.value === '30d' ? t('reports.date30d') :
                  opt.value === '90d' ? t('reports.date90d') :
                  t('reports.dateAll')
                }</option>
              ))}
            </select>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-8 bg-void-raised border-t border-edge flex justify-end gap-4">
          <button
            disabled={loading}
            onClick={handleExport}
            className="px-8 py-3 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white rounded-xl font-bold flex items-center gap-2 transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void disabled:opacity-50"
          >
            {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Table className="w-5 h-5" />}
            {loading ? t('reports.generating') : t('reports.generateExcel')}
          </button>
        </div>

      </div>

    </div>
  );
}
