'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, FileText, ExternalLink, Activity } from 'lucide-react';
import { mentions as mentionsApi, alerts as alertsApi, incidents as incidentsApi, reputation } from '@/lib/api';
import { getSafeVisitUrl } from '@/lib/visit-url';
import toast, { Toaster } from 'react-hot-toast';
import ExecutiveBriefModal from '@/components/dashboard/ExecutiveBriefModal';
import { useLanguage } from '@/contexts/LanguageContext';
import { SentimentBadge } from '@/components/ui/SentimentBadge';

/* Shared SIGNAL micro-interaction primitive (focus states, reduced-motion honored) */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';

function keywordToText(keyword: any): string | null {
  if (typeof keyword === 'string') return keyword.trim() || null;
  if (!keyword || typeof keyword !== 'object') return null;
  const value = keyword.keyword ?? keyword.name ?? keyword.value ?? keyword.text ?? keyword.search_query;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function keywordTexts(keywords: any[] | null | undefined): string[] {
  return (keywords || []).map(keywordToText).filter((value): value is string => Boolean(value));
}

export default function MentionDetailPage() {
  const { t } = useLanguage();
  const params = useParams();
  const router = useRouter();
  const [mention, setMention] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isBriefModalOpen, setIsBriefModalOpen] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchMention(parseInt(params.id as string));
    }
  }, [params.id]);

  const fetchMention = async (id: number) => {
    try {
      setLoading(true);
      const data = await mentionsApi.get(id);
      setMention(data);
    } catch (error: any) {
      console.error('Error fetching mention:', error);
      // Don't toast here — we redirect back immediately, and the toast
      // would linger on the list page, confusing the user.
      router.push('/dashboard/mentions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async () => {
    if (!mention) return;
    
    try {
      await alertsApi.create({
        mention_id: mention.id,
        title: `Alert: ${mention.title || 'No title'}`,
        severity: mention.ai_analysis?.risk_score >= 70 ? 'high' : 'medium',
        message: `Risk score: ${mention.ai_analysis?.risk_score}`
      });
      toast.success(t('mentionsPage.detail.alertCreated'));
    } catch (error: any) {
      console.error('Error creating alert:', error);
      toast.error(t('mentionsPage.detail.alertError'));
    }
  };

  const handleCreateIncident = async () => {
    if (!mention) return;
    
    try {
      await incidentsApi.create({
        mention_id: mention.id,
        title: `Incident: ${mention.title || 'No title'}`,
        description: mention.ai_analysis?.summary_vi || ''
      });
      toast.success(t('mentionsPage.detail.incidentCreated'));
    } catch (error: any) {
      console.error('Error creating incident:', error);
      toast.error(t('mentionsPage.detail.incidentError'));
    }
  };

  const handleCreateReputationCase = async () => {
    if (!mention) return;
    const toastId = toast.loading(t('mentionsPage.detail.caseCreating'));
    try {
      const newCase = await reputation.createFromMention(mention.id);
      toast.success(t('mentionsPage.detail.caseCreated'), { id: toastId });
      // Redirect to the new case
      router.push(`/dashboard/reputation`);
    } catch (error: any) {
      console.error('Error creating reputation case:', error);
      toast.error(t('mentionsPage.detail.caseError'), { id: toastId });
    }
  };

  /* Severity ladder on the legacy semantic tokens (SIGNAL contract):
     critical → destructive, high/medium → warning (weaker tint), safe → success. */
  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-destructive';
    if (score >= 40) return 'text-warning';
    return 'text-success';
  };

  const getRiskBgColor = (score: number) => {
    if (score >= 80) return 'bg-destructive/10 border-destructive/25';
    if (score >= 60) return 'bg-warning/10 border-warning/25';
    if (score >= 40) return 'bg-warning/[0.06] border-warning/15';
    return 'bg-success/10 border-success/25';
  };

  const getSafeUrl = (url: string | null | undefined) => {
    return getSafeVisitUrl(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-paper-muted font-medium tracking-wide">{t('common.loading')}</div>
      </div>
    );
  }

  if (!mention) {
    return (
      <div className="text-center py-12">
        <p className="text-paper-muted font-medium tracking-wide">{t('mentionsPage.detail.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center space-x-4 mb-6">
        <button
          onClick={() => router.back()}
          className={`p-2 text-paper-muted hover:text-paper bg-void-surface border border-edge hover:bg-void-raised rounded-xl transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-paper tracking-wide">{t('mentionsPage.detail.title')}</h1>
          <p className="text-sm text-paper-faint mt-1 font-mono">{t('reports.exportId')}: {mention.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Content Card */}
          <div className="bg-void-surface border border-edge rounded-2xl shadow-tile p-6 sm:p-8 relative overflow-hidden">
            {mention.ai_analysis?.sentiment === 'negative' && <div className="absolute top-0 right-0 w-64 h-64 bg-sentiment-negative/10 blur-3xl rounded-full" />}
            {mention.ai_analysis?.sentiment === 'positive' && <div className="absolute top-0 right-0 w-64 h-64 bg-sentiment-positive/10 blur-3xl rounded-full" />}
            <h2 className="text-xl font-bold text-paper mb-6 leading-snug relative z-10">
              {mention.title || t('mentions.page.noTitle')}
            </h2>
            <div className="max-w-none">
              <p className="text-paper-muted leading-relaxed whitespace-pre-wrap">
                {mention.content}
              </p>
            </div>
            <div className="mt-8 pt-5 border-t border-edge">
              {(() => {
                const bestUrl = getSafeUrl(mention.canonical_url || mention.original_url || mention.permalink || mention.source_url || mention.url || '');
                if (!bestUrl) return null;
                return (
                  <a
                    href={bestUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center font-medium transition-colors duration-150 motion-reduce:transition-none text-signal dark:text-signal-bright hover:text-signal-deep dark:hover:text-signal rounded ${focusRing}`}
                    title={t('mentionsPage.detail.sourceTooltip')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    {t('mentionsPage.detail.viewOriginal')}
                  </a>
                );
              })()}
            </div>
          </div>

          {/* Matched Keywords */}
          {keywordTexts(mention.matched_keywords).length > 0 && (
            <div className="bg-void-surface border border-edge rounded-2xl shadow-tile p-6 sm:p-8">
              <h3 className="text-lg font-bold text-paper mb-5 flex items-center">{t('mentionsPage.detail.matchedKeywords')}</h3>
              <div className="flex flex-wrap gap-2.5">
                {keywordTexts(mention.matched_keywords).map((kw: string, idx: number) => (
                  <span key={idx} className="px-3 py-1.5 bg-signal/10 text-signal dark:text-signal-bright text-sm rounded-lg font-semibold tracking-wide border border-signal/25 uppercase">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* AI Analysis */}
          {mention.ai_analysis && (
            <div className="bg-void-surface border border-edge rounded-2xl shadow-tile p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-signal/50" />
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-paper">{t('mentionsPage.detail.aiAnalysis')}</h3>
                {mention.ai_analysis.ai_provider === 'failed' && (
                  <span className="px-2.5 py-1 text-xs font-bold tracking-wider text-destructive bg-destructive/10 rounded-md border border-destructive/25">
                    {t('mentionsPage.detail.aiFailed')}
                  </span>
                )}
                {(mention.ai_analysis.ai_provider === 'dummy' || mention.ai_analysis.ai_provider === 'dummy_ai') && (
                  <span className="px-2.5 py-1 text-xs font-bold tracking-wider text-warning bg-warning/10 rounded-md border border-warning/25">
                    {t('mentionsPage.detail.ruleBased')}
                  </span>
                )}
                {mention.ai_analysis.ai_provider && !['dummy', 'dummy_ai', 'failed'].includes(mention.ai_analysis.ai_provider) && (
                  <span className="px-2.5 py-1 text-xs font-bold tracking-wider text-signal dark:text-signal-bright bg-signal/10 rounded-md border border-signal/25 uppercase">
                    {mention.ai_analysis.ai_provider}
                  </span>
                )}
              </div>

              {/* Risk Score - Prominent */}
              <div className={`p-5 rounded-xl border mb-6 flex flex-col items-center justify-center ${getRiskBgColor(mention.ai_analysis.risk_score)}`}>
                <div className={`text-4xl font-black tabular-nums ${getRiskColor(mention.ai_analysis.risk_score)}`}>
                  {mention.ai_analysis.risk_score}
                </div>
                <div className="text-xs font-bold tracking-wider uppercase text-paper-faint mt-2">{t('mentionsPage.detail.riskScore')}</div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-edge pb-3">
                  <span className="text-sm font-medium text-paper-faint uppercase tracking-wider text-[11px]">{t('mentions.page.sentimentTitle')}</span>
                  <SentimentBadge
                    sentiment={mention.ai_analysis.sentiment}
                    label={mention.ai_analysis.sentiment}
                    size="sm"
                    showDot={false}
                  />
                </div>

                <div className="flex justify-between items-center border-b border-edge pb-3">
                  <span className="text-sm font-medium text-paper-faint uppercase tracking-wider text-[11px]">{t('mentionsPage.detail.crisisLevel')}</span>
                  <div className="flex items-center space-x-1.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`w-2.5 h-2.5 rounded-full ${
                          level <= mention.ai_analysis.crisis_level
                            ? 'bg-destructive'
                            : 'bg-edge'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-[11px] font-bold tracking-wider text-paper tabular-nums">
                      {mention.ai_analysis.crisis_level}/5
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-b border-edge pb-3">
                  <span className="text-sm font-medium text-paper-faint uppercase tracking-wider text-[11px]">{t('mentionsPage.detail.suggestedAction')}</span>
                  <span className="text-sm font-semibold text-paper capitalize">
                    {mention.ai_analysis.suggested_action?.replace('_', ' ')}
                  </span>
                </div>

                {mention.ai_analysis.responsible_department && (
                  <div className="flex justify-between items-center border-b border-edge pb-3">
                    <span className="text-sm font-medium text-paper-faint uppercase tracking-wider text-[11px]">{t('mentionsPage.detail.department')}</span>
                    <span className="text-sm font-semibold text-paper capitalize">
                      {mention.ai_analysis.responsible_department?.replace('_', ' ')}
                    </span>
                  </div>
                )}

                {mention.ai_analysis.confidence_score && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-paper-faint uppercase tracking-wider text-[11px]">{t('mentionsPage.detail.confidence')}</span>
                    <span className="text-sm font-bold text-paper tabular-nums">
                      {mention.ai_analysis.confidence_score}%
                    </span>
                  </div>
                )}
              </div>

              {mention.ai_analysis.summary_vi && (
                <div className="mt-6 pt-5 border-t border-edge">
                  <h4 className="text-[11px] font-bold text-paper-faint uppercase tracking-wider mb-3">{t('mentionsPage.detail.aiSummaryLabel')}</h4>
                  <p className="text-sm text-paper-muted bg-void-raised border border-edge p-4 rounded-xl leading-relaxed">
                    {mention.ai_analysis.summary_vi}
                  </p>
                </div>
              )}

              {/* Risk-to-Action Engine Block */}
              {mention.ai_analysis.urgency && (
                <div className="mt-6 pt-5 border-t border-edge">
                  <h4 className="text-[11px] font-bold text-paper-faint uppercase tracking-wider mb-3 flex items-center">
                    <Activity className="w-3.5 h-3.5 mr-1.5 text-signal dark:text-signal-bright" />
                    {t('mentionsPage.detail.riskToAction')}
                  </h4>
                  <div className="bg-void-raised border border-edge p-4 rounded-xl space-y-4">
                    {mention.ai_analysis.why_it_matters && (
                      <div>
                        <span className="text-[10px] font-bold text-paper-faint uppercase block mb-1">{t('mentionsPage.detail.whyItMatters')}</span>
                        <p className="text-sm text-paper-muted">{mention.ai_analysis.why_it_matters}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-paper-faint uppercase block mb-1">{t('mentionsPage.detail.urgency')}</span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${
                          mention.ai_analysis.urgency === 'critical' ? 'bg-destructive/10 text-destructive' :
                          mention.ai_analysis.urgency === 'high' ? 'bg-warning/15 text-warning' :
                          mention.ai_analysis.urgency === 'medium' ? 'bg-warning/10 text-warning' :
                          'bg-success/10 text-success'
                        }`}>
                          {mention.ai_analysis.urgency.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-paper-faint uppercase block mb-1">{t('mentionsPage.detail.responseType')}</span>
                        <span className="text-sm font-medium text-paper">{mention.ai_analysis.response_type?.replace(/_/g, ' ')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-paper-faint uppercase block mb-1">{t('mentionsPage.detail.recommendedOwner')}</span>
                        <span className="text-sm font-medium text-paper">{mention.ai_analysis.recommended_owner}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-paper-faint uppercase block mb-1">{t('mentionsPage.detail.deadline')}</span>
                        <span className="text-sm font-medium text-paper">{mention.ai_analysis.deadline_suggestion}</span>
                      </div>
                    </div>
                    {mention.ai_analysis.escalation_needed && (
                      <div className="pt-2">
                        <span className="inline-flex items-center px-2 py-1 bg-destructive/10 border border-destructive/25 text-destructive text-xs font-bold rounded">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {t('mentionsPage.detail.escalationRequired')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="bg-void-surface border border-edge rounded-2xl shadow-tile p-6">
            <h3 className="text-lg font-bold text-paper mb-5 uppercase tracking-widest text-[11px] border-b border-edge pb-2">{t('mentionsPage.detail.actionsTitle')}</h3>
            <div className="space-y-4">
              <button
                onClick={handleCreateAlert}
                className="w-full flex items-center justify-center px-4 py-3 bg-warning text-white rounded-xl hover:bg-warning/90 transition-colors duration-150 motion-reduce:transition-none font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
              >
                <AlertTriangle className="w-5 h-5 mr-2" />
                {t('mentionsPage.detail.createAlert')}
              </button>
              <button
                onClick={() => setIsBriefModalOpen(true)}
                className="flex items-center px-4 py-2.5 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white text-sm font-semibold rounded-xl transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
              >
                <FileText className="w-4 h-4 mr-2" />
                {t('mentionsPage.detail.createBrief')}
              </button>
              <button
                onClick={handleCreateReputationCase}
                className="w-full flex items-center justify-center px-4 py-3 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
              >
                <FileText className="w-5 h-5 mr-2" />
                {t('mentionsPage.detail.createCase')}
              </button>
              <button
                onClick={handleCreateIncident}
                className="w-full flex items-center justify-center px-4 py-3 bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90 transition-colors duration-150 motion-reduce:transition-none font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
              >
                <FileText className="w-5 h-5 mr-2" />
                {t('mentionsPage.detail.createIncident')}
              </button>
            </div>
          </div>

          {/* Meta Information */}
          <div className="bg-void-surface border border-edge rounded-2xl shadow-tile p-6">
            <h3 className="text-lg font-bold text-paper mb-5 uppercase tracking-widest text-[11px] border-b border-edge pb-2">{t('mentionsPage.detail.systemInfo')}</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-paper-muted font-medium">{t('mentionsPage.detail.collectedAt')}</span>
                <span className="text-paper font-medium tabular-nums">
                  {new Date(mention.collected_at).toLocaleString('vi-VN')}
                </span>
              </div>
              {mention.published_at && (
                <div className="flex justify-between items-center">
                  <span className="text-paper-muted font-medium">{t('mentionsPage.detail.publishedAt')}</span>
                  <span className="text-paper font-medium tabular-nums">
                    {new Date(mention.published_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              )}
              {mention.author && (
                <div className="flex justify-between items-center">
                  <span className="text-paper-muted font-medium">{t('mentionsPage.detail.author')}</span>
                  <span className="text-paper font-medium">{mention.author}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-paper-muted font-medium">{t('mentionsPage.detail.sourceId')}</span>
                <span className="text-paper font-mono">{mention.source_id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ExecutiveBriefModal
        isOpen={isBriefModalOpen}
        onClose={() => setIsBriefModalOpen(false)}
        mentionIds={mention ? [mention.id] : undefined}
      />
    </div>
  );
}
