'use client';

import { useState, useEffect } from 'react';
import { PieChart, BarChart3, TrendingUp, TrendingDown, Sparkles, RefreshCcw, Globe } from 'lucide-react';
import { mentions as mentionsApi } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import { useLanguage } from '@/contexts/LanguageContext';
import toast from 'react-hot-toast';

export default function AnalysisPage() {
  const { t } = useLanguage();
  const { activeProject } = useProject();
  const [summary, setSummary] = useState<any>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSummary();
  }, [activeProject?.id]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const data = await mentionsApi.summary(activeProject?.id);
      setSummary(data);
    } catch (error) {
      toast.error(t('summary.page.errFetch'));
    } finally {
      setLoading(false);
    }
  };

  const handleAiSummary = async () => {
    if (!activeProject?.id) {
      toast.error(t('summary.page.errSelectProject'));
      return;
    }
    if (!summary || summary.total === 0) {
      toast.error(t('summary.page.errNoMentions'));
      return;
    }
    try {
      setAiLoading(true);
      const res = await mentionsApi.summarize({ project_id: activeProject.id });
      if (res && typeof res === 'object' && res.summary) {
        let text = `${t('summary.page.aiOverview')}\n${res.summary}\n\n`;
        if (res.sentiment_insights) text += `${t('summary.page.aiEvaluation')}\n${res.sentiment_insights}\n\n`;
        if (res.top_topics?.length) text += `${t('summary.page.aiTopics')}\n- ${res.top_topics.join('\n- ')}\n\n`;
        if (res.risks?.length) text += `${t('summary.page.aiRisks')}\n${res.risks.map((r: any) => `- [${(r.level || '').toUpperCase()}] ${r.title}: ${r.reason}`).join('\n')}\n\n`;
        if (res.recommended_actions?.length) text += `${t('summary.page.aiActions')}\n- ${res.recommended_actions.join('\n- ')}\n\n`;
        if (res.data_quality_notes) text += `${t('summary.page.aiDataNotes')}\n${res.data_quality_notes}\n\n`;
        text += `${t('summary.page.aiAnalyzed')} ${res.mentions_analyzed || 0} ${t('summary.page.aiAt')} ${res.generated_at || new Date().toLocaleString()})`;
        setAiText(text);
      } else {
        setAiText(res.summary || res.result || t('summary.page.errNoResult'));
      }
    } catch (error: any) {
      console.error('[API Error] POST /api/mentions/summarize ->', error?.response?.status || error.message);
      const detail = error?.response?.data?.detail || '';
      toast.error(detail || t('summary.page.errAiFail'));
    } finally {
      setAiLoading(false);
    }
  };

  const total = summary?.total || 0;
  const positive = summary?.positive || 0;
  const negative = summary?.negative || 0;
  const neutral = summary?.neutral || 0;
  const byDay: Array<{ date: string; count: number }> = summary?.by_day || [];
  const bySource: Record<string, number> = summary?.by_source_type || {};

  const sentimentPct = total > 0 ? {
    pos: Math.round((positive / total) * 100),
    neg: Math.round((negative / total) * 100),
    neu: Math.round((neutral / total) * 100),
  } : { pos: 0, neg: 0, neu: 0 };

  const maxDayCount = Math.max(...byDay.map(d => d.count), 1);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-paper tracking-wide flex items-center gap-2">
            <PieChart className="w-6 h-6 text-signal dark:text-signal-bright" />
            {t('summary.page.title')}
          </h1>
          <p className="text-sm text-paper-muted mt-1">
            {t('summary.page.subtitle')}
            {activeProject ? ` — ${activeProject.name}` : ''}.
          </p>
        </div>
        <button
          onClick={fetchSummary}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white rounded-lg font-medium transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          {t('summary.page.refresh')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-paper-muted">
          <RefreshCcw className="w-5 h-5 mr-2 animate-spin motion-reduce:animate-none" /> {t('summary.page.loading')}
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: t('summary.page.totalMentions'), value: total, color: 'text-signal dark:text-signal-bright', bg: 'bg-signal/10', icon: BarChart3 },
              { label: t('summary.page.positive'), value: positive, color: 'text-sentiment-positive', bg: 'bg-sentiment-positive/10', icon: TrendingUp },
              { label: t('summary.page.negative'), value: negative, color: 'text-sentiment-negative', bg: 'bg-sentiment-negative/10', icon: TrendingDown },
              { label: t('summary.page.neutral'), value: neutral, color: 'text-sentiment-neutral', bg: 'bg-sentiment-neutral/10', icon: BarChart3 },
            ].map((kpi) => (
              <div key={kpi.label} className={`${kpi.bg} rounded-xl p-4 border border-edge`}>
                <div className="flex items-center gap-2 mb-2">
                  <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  <span className="text-eyebrow font-semibold uppercase text-paper-faint">{kpi.label}</span>
                </div>
                <p className={`text-3xl font-black tabular-nums ${kpi.color}`}>{kpi.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AI Summary */}
            <div className="lg:col-span-2 bg-signal/[0.06] rounded-2xl border border-signal/20 p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-signal/10 rounded-lg border border-signal/25">
                    <Sparkles className="w-5 h-5 text-signal dark:text-signal-bright" />
                  </div>
                  <h2 className="text-lg font-bold text-signal dark:text-signal-bright">{t('summary.page.aiTitle')}</h2>
                </div>
                <button
                  onClick={handleAiSummary}
                  disabled={aiLoading || total === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white text-sm font-bold rounded-lg disabled:opacity-50 transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                >
                  {aiLoading ? <RefreshCcw className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {aiLoading ? t('summary.page.aiLoading') : t('summary.page.aiButton')}
                </button>
              </div>
              {aiText ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-paper-muted whitespace-pre-wrap">
                  {aiText}
                </div>
              ) : total === 0 ? (
                <p className="text-paper-muted text-sm">{t('summary.page.noData')}</p>
              ) : (
                <p className="text-paper-muted text-sm">{t('summary.page.aiPrompt')} {total} {t('summary.page.aiPromptSuffix')}</p>
              )}
            </div>

            {/* Sentiment Donut */}
            <div className="bg-void-surface rounded-2xl border border-edge p-6">
              <h2 className="text-base font-bold text-paper mb-4">{t('summary.page.sentimentTitle')}</h2>
              {total === 0 ? (
                <p className="text-paper-muted text-sm text-center py-8">{t('summary.page.noDataShort')}</p>
              ) : (
                <>
                  <div className="relative h-40 flex items-center justify-center mb-4">
                    <svg viewBox="0 0 36 36" className="w-40 h-40 -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-void-raised" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-sentiment-positive"
                        strokeWidth="3"
                        strokeDasharray={`${sentimentPct.pos} ${100 - sentimentPct.pos}`}
                        strokeDashoffset="0"
                      />
                      <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-sentiment-negative"
                        strokeWidth="3"
                        strokeDasharray={`${sentimentPct.neg} ${100 - sentimentPct.neg}`}
                        strokeDashoffset={`${-(sentimentPct.pos)}`}
                      />
                      <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-sentiment-neutral"
                        strokeWidth="3"
                        strokeDasharray={`${sentimentPct.neu} ${100 - sentimentPct.neu}`}
                        strokeDashoffset={`${-(sentimentPct.pos + sentimentPct.neg)}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                      <span className="text-2xl font-black text-paper tabular-nums">{sentimentPct.pos}%</span>
                      <span className="text-xs text-paper-faint uppercase">{t('summary.page.positive')}</span>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {[
                      { label: t('summary.page.positive'), pct: sentimentPct.pos, count: positive, color: 'bg-sentiment-positive' },
                      { label: t('summary.page.negative'), pct: sentimentPct.neg, count: negative, color: 'bg-sentiment-negative' },
                      { label: t('summary.page.neutral'), pct: sentimentPct.neu, count: neutral, color: 'bg-sentiment-neutral' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                        <span className="text-paper-muted flex-1">{s.label}</span>
                        <span className="font-bold text-paper tabular-nums">{s.count.toLocaleString()}</span>
                        <span className="text-paper-faint w-10 text-right tabular-nums">{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trend Chart */}
            <div className="bg-void-surface rounded-2xl border border-edge p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-paper-faint" />
                <h2 className="text-base font-bold text-paper">
                  {summary?.trend_start && summary?.trend_end 
                    ? t('summary.page.trendTitle').replace('{start}', summary.trend_start).replace('{end}', summary.trend_end)
                    : t('summary.page.trendDefault')}
                </h2>
              </div>
              {byDay.length === 0 ? (
                <p className="text-paper-muted text-sm text-center py-8">{t('summary.page.noDataShort')}</p>
              ) : (
                <div className="flex items-end gap-2 h-40">
                  {byDay.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-signal rounded-t-md opacity-80 hover:opacity-100 transition-opacity duration-150 motion-reduce:transition-none"
                        style={{ height: `${Math.round((d.count / maxDayCount) * 130)}px`, minHeight: '4px' }}
                        title={`${d.date}: ${d.count} mentions`}
                      />
                      <span className="text-[9px] text-paper-faint truncate">{typeof d.date === 'string' ? d.date.slice(5) : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sources */}
            <div className="bg-void-surface rounded-2xl border border-edge p-6">
              <h2 className="text-base font-bold text-paper mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4 text-signal dark:text-signal-bright" />
                {t('summary.page.sourcesTitle')}
              </h2>
              {Object.keys(bySource).length === 0 ? (
                <p className="text-paper-muted text-sm text-center py-8">{t('summary.page.noSourceData')}</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(bySource || {})
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .slice(0, 8)
                    .map(([source, count]) => {
                      const pct = total > 0 ? Math.round(((count as number) / total) * 100) : 0;
                      return (
                        <div key={source}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-paper-muted capitalize">{source}</span>
                            <span className="font-bold text-paper tabular-nums">{(count as number).toLocaleString()} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-void-raised rounded-full overflow-hidden">
                            <div className="h-full bg-signal rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
