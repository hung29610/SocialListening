'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, FileText, ExternalLink, Activity } from 'lucide-react';
import { mentions as mentionsApi, alerts as alertsApi, incidents as incidentsApi, reputation } from '@/lib/api';
import { getSafeVisitUrl } from '@/lib/visit-url';
import toast, { Toaster } from 'react-hot-toast';
import ExecutiveBriefModal from '@/components/dashboard/ExecutiveBriefModal';
import { useLanguage } from '@/contexts/LanguageContext';

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

  const getSentimentColor = (sentiment: string) => {
    if (sentiment === 'positive') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (sentiment === 'neutral') return 'bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-700';
    if (sentiment === 'negative') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    return 'bg-gray-800 text-slate-500 dark:text-gray-400 border-slate-300 dark:border-gray-700';
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-rose-500';
    if (score >= 60) return 'text-orange-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-emerald-500';
  };

  const getRiskBgColor = (score: number) => {
    if (score >= 80) return 'bg-rose-500/10 border-rose-500/20';
    if (score >= 60) return 'bg-orange-500/10 border-orange-500/20';
    if (score >= 40) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-emerald-500/10 border-emerald-500/20';
  };

  const getSafeUrl = (url: string | null | undefined) => {
    return getSafeVisitUrl(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-500 dark:text-gray-400 font-medium tracking-wide">{t('common.loading')}</div>
      </div>
    );
  }

  if (!mention) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 dark:text-gray-400 font-medium tracking-wide">{t('mentionsPage.detail.notFound')}</p>
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
          className="p-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 hover:bg-gray-800 rounded-xl transition-all shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide">{t('mentionsPage.detail.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1 font-mono">{t('reports.exportId')}: {mention.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Content Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden">
            {mention.ai_analysis?.sentiment === 'negative' && <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 blur-3xl rounded-full" />}
            {mention.ai_analysis?.sentiment === 'positive' && <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full" />}
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 leading-snug relative z-10">
              {mention.title || t('mentions.page.noTitle')}
            </h2>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {mention.content}
              </p>
            </div>
            <div className="mt-8 pt-5 border-t border-slate-200 dark:border-gray-800">
              {(() => {
                const bestUrl = getSafeUrl(mention.canonical_url || mention.original_url || mention.permalink || mention.source_url || mention.url || '');
                if (!bestUrl) return null;
                return (
                  <a 
                    href={bestUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center font-medium transition-colors text-indigo-400 hover:text-indigo-300"
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
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6 sm:p-8">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center">{t('mentionsPage.detail.matchedKeywords')}</h3>
              <div className="flex flex-wrap gap-2.5">
                {keywordTexts(mention.matched_keywords).map((kw: string, idx: number) => (
                  <span key={idx} className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 text-sm rounded-lg font-semibold tracking-wide border border-indigo-500/20 uppercase">
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
            <div className="bg-[#050A15]/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('mentionsPage.detail.aiAnalysis')}</h3>
                {mention.ai_analysis.ai_provider === 'failed' && (
                  <span className="px-2.5 py-1 text-xs font-bold tracking-wider text-red-400 bg-red-500/10 rounded-md border border-red-500/20">
                    {t('mentionsPage.detail.aiFailed')}
                  </span>
                )}
                {(mention.ai_analysis.ai_provider === 'dummy' || mention.ai_analysis.ai_provider === 'dummy_ai') && (
                  <span className="px-2.5 py-1 text-xs font-bold tracking-wider text-amber-400 bg-amber-500/10 rounded-md border border-amber-500/20">
                    {t('mentionsPage.detail.ruleBased')}
                  </span>
                )}
                {mention.ai_analysis.ai_provider && !['dummy', 'dummy_ai', 'failed'].includes(mention.ai_analysis.ai_provider) && (
                  <span className="px-2.5 py-1 text-xs font-bold tracking-wider text-indigo-400 bg-indigo-500/10 rounded-md border border-indigo-500/20 uppercase">
                    {mention.ai_analysis.ai_provider}
                  </span>
                )}
              </div>
              
              {/* Risk Score - Prominent */}
              <div className={`p-5 rounded-xl border mb-6 flex flex-col items-center justify-center ${getRiskBgColor(mention.ai_analysis.risk_score)}`}>
                <div className={`text-4xl font-black ${getRiskColor(mention.ai_analysis.risk_score)}`}>
                  {mention.ai_analysis.risk_score}
                </div>
                <div className="text-xs font-bold tracking-wider uppercase text-gray-500 mt-2">{t('mentionsPage.detail.riskScore')}</div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-gray-800 pb-3">
                  <span className="text-sm font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[11px]">{t('mentions.page.sentimentTitle')}</span>
                  <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border ${getSentimentColor(mention.ai_analysis.sentiment)}`}>
                    {mention.ai_analysis.sentiment}
                  </span>
                </div>
                
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-gray-800 pb-3">
                  <span className="text-sm font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[11px]">{t('mentionsPage.detail.crisisLevel')}</span>
                  <div className="flex items-center space-x-1.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`w-2.5 h-2.5 rounded-full ${
                          level <= mention.ai_analysis.crisis_level
                            ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
                            : 'bg-gray-800'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-[11px] font-bold tracking-wider text-slate-900 dark:text-white">
                      {mention.ai_analysis.crisis_level}/5
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-b border-slate-200 dark:border-gray-800 pb-3">
                  <span className="text-sm font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[11px]">{t('mentionsPage.detail.suggestedAction')}</span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                    {mention.ai_analysis.suggested_action?.replace('_', ' ')}
                  </span>
                </div>

                {mention.ai_analysis.responsible_department && (
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-gray-800 pb-3">
                    <span className="text-sm font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[11px]">{t('mentionsPage.detail.department')}</span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white capitalize">
                      {mention.ai_analysis.responsible_department?.replace('_', ' ')}
                    </span>
                  </div>
                )}

                {mention.ai_analysis.confidence_score && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider text-[11px]">{t('mentionsPage.detail.confidence')}</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {mention.ai_analysis.confidence_score}%
                    </span>
                  </div>
                )}
              </div>

              {mention.ai_analysis.summary_vi && (
                <div className="mt-6 pt-5 border-t border-slate-200 dark:border-gray-800">
                  <h4 className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-3">{t('mentionsPage.detail.aiSummaryLabel')}</h4>
                  <p className="text-sm text-slate-700 dark:text-gray-300 bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-gray-800 p-4 rounded-xl leading-relaxed">
                    {mention.ai_analysis.summary_vi}
                  </p>
                </div>
              )}

              {/* Risk-to-Action Engine Block */}
              {mention.ai_analysis.urgency && (
                <div className="mt-6 pt-5 border-t border-slate-200 dark:border-gray-800">
                  <h4 className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center">
                    <Activity className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                    {t('mentionsPage.detail.riskToAction')}
                  </h4>
                  <div className="bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-gray-800 p-4 rounded-xl space-y-4">
                    {mention.ai_analysis.why_it_matters && (
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">{t('mentionsPage.detail.whyItMatters')}</span>
                        <p className="text-sm text-slate-700 dark:text-gray-300">{mention.ai_analysis.why_it_matters}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">{t('mentionsPage.detail.urgency')}</span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-md ${
                          mention.ai_analysis.urgency === 'critical' ? 'bg-rose-500/10 text-rose-400' :
                          mention.ai_analysis.urgency === 'high' ? 'bg-orange-500/10 text-orange-400' :
                          mention.ai_analysis.urgency === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {mention.ai_analysis.urgency.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">{t('mentionsPage.detail.responseType')}</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{mention.ai_analysis.response_type?.replace(/_/g, ' ')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">{t('mentionsPage.detail.recommendedOwner')}</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{mention.ai_analysis.recommended_owner}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">{t('mentionsPage.detail.deadline')}</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{mention.ai_analysis.deadline_suggestion}</span>
                      </div>
                    </div>
                    {mention.ai_analysis.escalation_needed && (
                      <div className="pt-2">
                        <span className="inline-flex items-center px-2 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold rounded">
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
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-widest text-[11px] border-b border-white/10 pb-2">{t('mentionsPage.detail.actionsTitle')}</h3>
            <div className="space-y-4">
              <button
                onClick={handleCreateAlert}
                className="w-full flex items-center justify-center px-4 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors font-semibold shadow-sm shadow-amber-500/20"
              >
                <AlertTriangle className="w-5 h-5 mr-2" />
                {t('mentionsPage.detail.createAlert')}
              </button>
              <button
                onClick={() => setIsBriefModalOpen(true)}
                className="flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-900/20 transition-all focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <FileText className="w-4 h-4 mr-2" />
                {t('mentionsPage.detail.createBrief')}
              </button>
              <button
                onClick={handleCreateReputationCase}
                className="w-full flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold shadow-sm shadow-indigo-500/20"
              >
                <FileText className="w-5 h-5 mr-2" />
                {t('mentionsPage.detail.createCase')}
              </button>
              <button
                onClick={handleCreateIncident}
                className="w-full flex items-center justify-center px-4 py-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors font-semibold shadow-sm shadow-rose-500/20"
              >
                <FileText className="w-5 h-5 mr-2" />
                {t('mentionsPage.detail.createIncident')}
              </button>
            </div>
          </div>

          {/* Meta Information */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-5 uppercase tracking-widest text-[11px] border-b border-white/10 pb-2">{t('mentionsPage.detail.systemInfo')}</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-gray-400 font-medium">{t('mentionsPage.detail.collectedAt')}</span>
                <span className="text-slate-900 dark:text-white font-medium">
                  {new Date(mention.collected_at).toLocaleString('vi-VN')}
                </span>
              </div>
              {mention.published_at && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-gray-400 font-medium">{t('mentionsPage.detail.publishedAt')}</span>
                  <span className="text-slate-900 dark:text-white font-medium">
                    {new Date(mention.published_at).toLocaleString('vi-VN')}
                  </span>
                </div>
              )}
              {mention.author && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-gray-400 font-medium">{t('mentionsPage.detail.author')}</span>
                  <span className="text-slate-900 dark:text-white font-medium">{mention.author}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-gray-400 font-medium">{t('mentionsPage.detail.sourceId')}</span>
                <span className="text-slate-900 dark:text-white font-mono">{mention.source_id}</span>
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
