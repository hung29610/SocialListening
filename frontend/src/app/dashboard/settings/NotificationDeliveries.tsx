'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { RefreshCw, Search, ChevronLeft, ChevronRight, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

interface DeliveryLog {
  id: number;
  event_type: string;
  channel: string;
  destination: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
  payload: string | null;
}

export default function NotificationDeliveries() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [channelFilter, setChannelFilter] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<DeliveryLog | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        page_size: '20'
      });
      if (statusFilter) params.append('status', statusFilter);
      if (channelFilter) params.append('channel', channelFilter);

      const response = await api.get(`/api/admin/settings/notifications/deliveries?${params}`);
      const data = response.data;
      setLogs(data.items);
      setTotalPages(data.total_pages);
    } catch (error) {
      console.error(error);
      toast.error(t('settingsPage.deliveries.errors.connectFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, statusFilter, channelFilter]);

  const handleRetry = async (logId: number) => {
    setRetryingId(logId);
    try {
      await api.post(`/api/admin/settings/notifications/deliveries/${logId}/retry`);
      toast.success(t('settingsPage.deliveries.retryQueued'));
      fetchLogs();
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.detail || t('settingsPage.deliveries.errors.retryFailed'));
    } finally {
      setRetryingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
 return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">{t('settingsPage.deliveries.status.sent')}</span>; case 'failed': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">{t('settingsPage.deliveries.status.failed')}</span>; case 'retrying': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">{t('settingsPage.deliveries.status.retrying')}</span>; case 'skipped': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">{t('settingsPage.deliveries.status.skipped')}</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-void-raised text-paper-muted border border-edge">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
 <h2 className="text-xl font-bold text-paper tracking-wide">{t('settings.tabs.deliveryLogsDesc')}</h2> <p className="text-sm text-paper-muted mt-1">{t('settingsPage.deliveries.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <select 
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-void-surface border border-edge-strong rounded-lg text-sm text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
          >
            <option value="">{t('settingsPage.deliveries.filters.allStatuses')}</option>
            <option value="sent">{t('settingsPage.deliveries.status.sent')}</option>
            <option value="failed">{t('settingsPage.deliveries.status.failed')}</option>
            <option value="retrying">{t('settingsPage.deliveries.status.retrying')}</option>
          </select>
          <select 
            value={channelFilter}
            onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-void-surface border border-edge-strong rounded-lg text-sm text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
          >
            <option value="">{t('settingsPage.deliveries.filters.allChannels')}</option>
            <option value="email">{t('auth.emailLabel')}</option>
            <option value="webhook">Webhook</option>
          </select>
          <button onClick={fetchLogs} className="p-2 bg-signal/10 text-signal dark:text-signal-bright hover:bg-signal/20 rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="bg-void-surface border border-edge rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-eyebrow font-semibold text-paper-faint uppercase bg-void-raised border-b border-edge">
              <tr>
                <th className="px-6 py-4">{t('settingsPage.deliveries.table.time')}</th>
                <th className="px-6 py-4">{t('settingsPage.deliveries.table.eventType')}</th>
                <th className="px-6 py-4">{t('settingsPage.deliveries.table.channel')}</th>
                <th className="px-6 py-4">{t('settingsPage.deliveries.table.destination')}</th>
                <th className="px-6 py-4">{t('settingsPage.deliveries.table.status')}</th>
                <th className="px-6 py-4">{t('settingsPage.deliveries.table.attempts')}</th>
                <th className="px-6 py-4 text-right">{t('settingsPage.deliveries.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center"><div className="animate-spin motion-reduce:animate-none rounded-full h-8 w-8 border-b-2 border-signal mx-auto"></div></td></tr>
              ) : logs.length === 0 ? (
 <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-500">{t('common.noData')}</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="border-b border-edge hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none">
                    <td className="px-6 py-4 whitespace-nowrap text-paper-muted tabular-nums">{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                    <td className="px-6 py-4 font-medium text-paper">{log.event_type}</td>
                    <td className="px-6 py-4 text-paper-muted uppercase text-xs font-bold tracking-wider">{log.channel}</td>
                    <td className="px-6 py-4 text-paper-muted max-w-[200px] truncate" title={log.destination}>{log.destination}</td>
                    <td className="px-6 py-4">{getStatusBadge(log.status)}</td>
                    <td className="px-6 py-4 text-paper-muted tabular-nums">{log.attempt_count}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-xs text-signal dark:text-signal-bright hover:text-signal-deep dark:hover:text-signal font-medium rounded transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                      >
                        {t('settingsPage.deliveries.actions.detail')}
                      </button>
                      {log.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(log.id)}
                          disabled={retryingId === log.id}
                          className="text-xs px-2 py-1 bg-signal text-white rounded hover:bg-signal-deep dark:hover:bg-signal-bright disabled:opacity-50 transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                        >
                          {retryingId === log.id ? t('settingsPage.deliveries.actions.sending') : t('reports.retry')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
 <div className="px-6 py-4 border-t border-edge flex items-center justify-between"> <span className="text-sm text-paper-muted ">{t('settingsPage.deliveries.pagination', { page, total: totalPages })}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1 border border-edge-strong text-paper-muted rounded hover:bg-void-raised disabled:opacity-50 transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1 border border-edge-strong text-paper-muted rounded hover:bg-void-raised disabled:opacity-50 transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"> <div className="bg-void-surface border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"> <div className="flex items-center justify-between p-6 border-b border-gray-800"> <h3 className="text-lg font-bold text-white flex items-center gap-2"> {t('settingsPage.deliveries.detail.title')} <span className="text-sm font-normal text-gray-400">#{selectedLog.id}</span>
              </h3>
              <button onClick={() => setSelectedLog(null)} className="text-paper-faint hover:text-paper transition-colors duration-150 motion-reduce:transition-none rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
              <div className="grid grid-cols-2 gap-4">
 <div><span className="text-gray-400">{t('settingsPage.deliveries.table.channel')}:</span> <span className="text-white font-medium ml-2">{selectedLog.channel}</span></div> <div><span className="text-gray-400">{t('settingsPage.deliveries.table.destination')}:</span> <span className="text-white font-medium ml-2">{selectedLog.destination}</span></div> <div><span className="text-gray-400">{t('settingsPage.deliveries.table.status')}:</span> <div className="inline-block ml-2">{getStatusBadge(selectedLog.status)}</div></div> <div><span className="text-gray-400">{t('settingsPage.deliveries.detail.attempts')}:</span> <span className="text-white font-medium ml-2">{selectedLog.attempt_count}</span></div>
              </div>

              {selectedLog.last_error && (
                <div className="bg-destructive/10 border border-destructive/25 p-4 rounded-xl flex gap-3 text-destructive">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <pre className="whitespace-pre-wrap font-mono text-xs overflow-x-auto">{selectedLog.last_error}</pre>
                </div>
              )}

              {selectedLog.payload && (
                <div>
 <h4 className="text-gray-400 mb-2 font-medium">{t('settingsPage.deliveries.detail.payload')}</h4> <div className="bg-[#0B1120] border border-gray-800 p-4 rounded-xl overflow-x-auto"> <pre className="text-gray-300 font-mono text-xs">{JSON.stringify(JSON.parse(selectedLog.payload), null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
