'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertTriangle, FileText, Send, X, Package } from 'lucide-react';
import { serviceRequests as serviceRequestsApi, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import toast, { Toaster } from 'react-hot-toast';

export default function ServiceRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [request, setRequest] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [actionNote, setActionNote] = useState('');

  const requestId = Number(params?.id);
  const isAdmin = user?.is_superuser === true;

  useEffect(() => {
    if (requestId) {
      fetchData();
    }
  }, [requestId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqData, logsData, delData] = await Promise.allSettled([
        serviceRequestsApi.get(requestId),
        serviceRequestsApi.getLogs(requestId),
        serviceRequestsApi.getDeliverables(requestId)
      ]);

      if (reqData.status === 'fulfilled') setRequest(reqData.value);
      if (logsData.status === 'fulfilled') setLogs(logsData.value);
      if (delData.status === 'fulfilled') setDeliverables(delData.value);
    } catch (error: any) {
      toast.error(t('servicesPage.requestDetail.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionFn: any, payload: any, modalSetter: any) => {
    try {
      await actionFn(requestId, payload);
      toast.success(t('servicesPage.requestDetail.actionSuccess'));
      modalSetter(false);
      setActionNote('');
      fetchData();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || t('servicesPage.requestDetail.errors.actionFailed'));
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'draft': 'bg-gray-800 text-slate-500 border-slate-300',
      'submitted': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      'pending_approval': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      'approved': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'in_progress': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      'waiting_external_response': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      'completed': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'rejected': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      'cancelled': 'bg-gray-800 text-slate-500 border-slate-300'
    };
    return `${colors[status] || 'bg-gray-800 text-slate-500 border-slate-300'} border`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">{t('common.loading')}</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertTriangle className="w-12 h-12 text-rose-500" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('servicesPage.requestDetail.notFound')}</h2>
        <button onClick={() => router.push('/dashboard/services')} className="text-indigo-500 hover:underline">
          {t('servicesPage.requestDetail.backToList')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.push('/dashboard/services')} className="p-2 bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {t('servicesPage.requestDetail.heading')} <span className="text-indigo-500">#{request.id}</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{request.service?.name}</p>
          </div>
        </div>

        {/* Actions based on role and status */}
        <div className="flex space-x-3">
          {request.status === 'draft' && (
            <button onClick={() => setShowSubmitModal(true)} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              <Send className="w-4 h-4 mr-2" /> {t('servicesPage.requestDetail.actions.submit')}
            </button>
          )}

          {['draft', 'submitted', 'pending_approval'].includes(request.status) && (
            <button onClick={() => setShowCancelModal(true)} className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">
              <X className="w-4 h-4 mr-2" /> {t('common.cancel')}
            </button>
          )}

          {isAdmin && request.approval_status === 'pending' && (
            <>
              <button onClick={() => setShowRejectModal(true)} className="px-4 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 transition">
                {t('servicesPage.requestDetail.actions.reject')}
              </button>
              <button onClick={() => handleAction(serviceRequestsApi.approve, {}, () => {})} className="px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition">
                {t('servicesPage.requestDetail.actions.approve')}
              </button>
            </>
          )}

          {isAdmin && (request.status === 'in_progress' || request.status === 'waiting_external_response') && (
            <button onClick={() => setShowCompleteModal(true)} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
              <CheckCircle className="w-4 h-4 mr-2" /> {t('servicesPage.requestDetail.actions.complete')}
            </button>
          )}

          {isAdmin && request.status === 'approved' && (
             <button onClick={() => handleAction(serviceRequestsApi.update, { status: 'in_progress' }, () => {})} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">
               {t('servicesPage.requestDetail.actions.start')}
             </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('servicesPage.requestDetail.title')}</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">{t('servicesPage.table.status')}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-bold uppercase rounded ${getStatusColor(request.status)}`}>
                  {request.status.replace('_', ' ')}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">{t('servicesPage.requestDetail.reason')}</p>
                <p className="text-sm text-slate-800 dark:text-gray-300 mt-1">{request.request_reason || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">{t('servicesPage.form.desiredOutcome')}</p>
                <p className="text-sm text-slate-800 dark:text-gray-300 mt-1">{request.desired_outcome || 'N/A'}</p>
              </div>
              {request.result_summary && (
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-4 rounded-xl mt-4">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">{t('servicesPage.requestDetail.actualResult')}</p>
                  <p className="text-sm text-slate-800 dark:text-emerald-100 mt-1">{request.result_summary}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
             <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
               <Package className="w-5 h-5 mr-2 text-indigo-500" />
               {t('servicesPage.requestDetail.deliverables', { count: deliverables.length })}
             </h3>
             {deliverables.length === 0 ? (
               <p className="text-sm text-gray-500 italic">{t('servicesPage.requestDetail.noDeliverables')}</p>
             ) : (
               <div className="space-y-3">
                 {deliverables.map(d => (
                   <div key={d.id} className="p-3 border border-slate-200 dark:border-gray-700 rounded-lg bg-slate-50 dark:bg-[#1E293B]">
                     <p className="text-sm font-medium text-slate-900 dark:text-white">{d.name}</p>
                     {d.description && <p className="text-xs text-gray-500 mt-1">{d.description}</p>}
                     {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-500 hover:underline mt-2 inline-block">{t('servicesPage.requestDetail.viewAttachment')}</a>}
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>

        {/* Right Column: Timelines & Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('servicesPage.requestDetail.info')}</h3>
            <div className="space-y-4">
               <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">{t('servicesPage.table.service')}</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-gray-300">{request.service?.name}</p>
               </div>
               <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">{t('servicesPage.requestDetail.createdAt')}</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-gray-300">{new Date(request.created_at).toLocaleString('vi-VN')}</p>
               </div>
               <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase">{t('servicesPage.table.priority')}</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-gray-300 capitalize">{request.priority}</p>
               </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-6 shadow-sm">
             <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
               <Clock className="w-5 h-5 mr-2 text-slate-400" />
               {t('servicesPage.requestDetail.activityLog')}
             </h3>
             <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {logs.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">{t('servicesPage.requestDetail.noLogs')}</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="relative pl-4 border-l-2 border-indigo-500/30 pb-4 last:pb-0">
                      <div className="absolute w-2 h-2 bg-indigo-500 rounded-full -left-[5px] top-1.5" />
                      <p className="text-xs text-gray-500">{new Date(log.created_at).toLocaleString('vi-VN')}</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">
                        {log.action.replace('_', ' ').toUpperCase()}
                      </p>
                      {log.note && <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">{log.note}</p>}
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 dark:text-white">{t('servicesPage.requestDetail.rejectModal.title')}</h3>
            <textarea
              className="w-full p-3 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              rows={4}
              placeholder={t('servicesPage.requestDetail.rejectModal.placeholder')}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowRejectModal(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">{t('common.cancel')}</button>
              <button onClick={() => handleAction(serviceRequestsApi.reject, { note: actionNote }, setShowRejectModal)} className="px-4 py-2 bg-rose-600 text-white rounded-lg">{t('servicesPage.requestDetail.actions.reject')}</button>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 dark:text-white">{t('servicesPage.requestDetail.completeModal.title')}</h3>
            <textarea
              className="w-full p-3 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              rows={4}
              placeholder={t('servicesPage.requestDetail.completeModal.placeholder')}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowCompleteModal(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">{t('common.cancel')}</button>
              <button onClick={() => handleAction(serviceRequestsApi.complete, { result_summary: actionNote }, setShowCompleteModal)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg">{t('common.confirm')}</button>
            </div>
          </div>
        </div>
      )}

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 dark:text-white">{t('servicesPage.requestDetail.actions.submit')}</h3>
            <textarea
              className="w-full p-3 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              rows={2}
              placeholder={t('servicesPage.requestDetail.submitModal.placeholder')}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowSubmitModal(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">{t('common.cancel')}</button>
              <button onClick={() => handleAction(serviceRequestsApi.submit, { note: actionNote }, setShowSubmitModal)} className="px-4 py-2 bg-blue-600 text-white rounded-lg">{t('servicesPage.requestDetail.actions.send')}</button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 dark:text-white">{t('servicesPage.requestDetail.cancelModal.title')}</h3>
            <textarea
              className="w-full p-3 border rounded-lg dark:bg-gray-900 dark:border-gray-700 dark:text-white"
              rows={3}
              placeholder={t('servicesPage.requestDetail.cancelModal.placeholder')}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowCancelModal(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">{t('servicesPage.actions.close')}</button>
              <button onClick={() => handleAction(serviceRequestsApi.cancel, { note: actionNote }, setShowCancelModal)} className="px-4 py-2 bg-gray-600 text-white rounded-lg">{t('servicesPage.requestDetail.cancelModal.confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
