'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileText, Search, Filter, Download, Calendar, User, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '@/lib/api';

interface AuditLog {
  id: number;
  user_id: number | null;
  action: string;
  resource_type: string | null;
  resource_id: number | null;
  details: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface FilterParams {
  user_id: string;
  action: string;
  resource_type: string;
  start_date: string;
  end_date: string;
  limit: number;
  offset: number;
}

export default function AuditLogs() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterParams>({
    user_id: '',
    action: '',
    resource_type: '',
    start_date: '',
    end_date: '',
    limit: 100,
    offset: 0
  });
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadLogs();
    loadStats();
  }, []);

  const loadLogs = async () => {
    try {
      // Build query params
      const params = new URLSearchParams();
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.action) params.append('action', filters.action);
      if (filters.resource_type) params.append('resource_type', filters.resource_type);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      params.append('limit', filters.limit.toString());
      params.append('offset', filters.offset.toString());

      const response = await api.get(`/api/admin/audit/?${params}`);
      setLogs(response.data);
    } catch (error) {
      console.error('Error loading audit logs:', error);
      toast.error(t('settingsPage.auditLogs.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get('/api/admin/audit/stats/summary');
      setStats(response.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleSearch = () => {
    setLoading(true);
    loadLogs();
  };

  const handleReset = () => {
    setFilters({
      user_id: '',
      action: '',
      resource_type: '',
      start_date: '',
      end_date: '',
      limit: 100,
      offset: 0
    });
    setTimeout(() => {
      setLoading(true);
      loadLogs();
    }, 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN');
  };

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'text-success bg-success/10 border border-success/25';
    if (action.includes('update')) return 'text-info bg-info/10 border border-info/25';
    if (action.includes('delete')) return 'text-destructive bg-destructive/10 border border-destructive/25';
    return 'text-paper-muted bg-void-raised border border-edge';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin motion-reduce:animate-none rounded-full h-8 w-8 border-b-2 border-signal"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-paper tracking-wide">{t('settings.tabs.logs')}</h2>
          <p className="text-sm text-paper-muted mt-1">{t('settingsPage.auditLogs.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center px-4 py-2.5 text-paper-muted bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised hover:text-paper transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
        >
          <Filter className="w-4 h-4 mr-2" />
          {showFilters ? t('settingsPage.auditLogs.hideFilters') : t('settingsPage.auditLogs.showFilters')}
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-void-surface border border-edge rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-paper-muted">{t('settingsPage.auditLogs.stats.totalLogs')}</p>
                <p className="text-2xl font-bold text-paper tracking-wide tabular-nums mt-1">{stats.total_logs}</p>
              </div>
              <div className="p-3 bg-signal/10 border border-signal/25 rounded-xl">
                <Activity className="w-6 h-6 text-signal dark:text-signal-bright" />
              </div>
            </div>
          </div>

          <div className="bg-void-surface border border-edge rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-paper-muted">{t('settingsPage.auditLogs.stats.actionTypes')}</p>
                <p className="text-2xl font-bold text-paper tracking-wide tabular-nums mt-1">{stats.by_action?.length || 0}</p>
              </div>
              <div className="p-3 bg-void-raised border border-edge rounded-xl">
                <FileText className="w-6 h-6 text-paper-muted" />
              </div>
            </div>
          </div>

          <div className="bg-void-surface border border-edge rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-paper-muted">{t('settingsPage.auditLogs.stats.displayed')}</p>
                <p className="text-2xl font-bold text-paper tracking-wide tabular-nums mt-1">{logs.length}</p>
              </div>
              <div className="p-3 bg-void-raised border border-edge rounded-xl">
                <Search className="w-6 h-6 text-paper-muted" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-void-surface border border-edge rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-paper tracking-wide mb-6">{t('settingsPage.auditLogs.filters.title')}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-paper-muted mb-2">{t('settingsPage.auditLogs.filters.userId')}</label>
              <input
                type="number"
                value={filters.user_id}
                onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-shadow motion-reduce:transition-none"
                placeholder={t('settingsPage.auditLogs.filters.userIdPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-paper-muted mb-2">{t('settingsPage.auditLogs.filters.action')}</label>
              <input
                type="text"
                value={filters.action}
                onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-shadow motion-reduce:transition-none"
                placeholder={t('settingsPage.auditLogs.filters.actionPlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-paper-muted mb-2">{t('settingsPage.auditLogs.filters.resourceType')}</label>
              <input
                type="text"
                value={filters.resource_type}
                onChange={(e) => setFilters({ ...filters, resource_type: e.target.value })}
                className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-shadow motion-reduce:transition-none"
                placeholder={t('settingsPage.auditLogs.filters.resourceTypePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-paper-muted mb-2">{t('settingsPage.auditLogs.filters.startDate')}</label>
              <input
                type="datetime-local"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper dark:[color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-shadow motion-reduce:transition-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-paper-muted mb-2">{t('settingsPage.auditLogs.filters.endDate')}</label>
              <input
                type="datetime-local"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper dark:[color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-shadow motion-reduce:transition-none"
              />
            </div>

            <div>
 <label className="block text-sm font-medium text-paper-muted mb-2">{t('settingsPage.auditLogs.filters.limit')}</label>
              <select
                value={filters.limit}
                onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper dark:[color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-shadow motion-reduce:transition-none"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-edge">
            <button
              onClick={handleReset}
              className="px-6 py-2.5 text-paper-muted bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised hover:text-paper transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
            >
              {t('settingsPage.auditLogs.filters.reset')}
            </button>
            <button
              onClick={handleSearch}
              className="flex items-center px-6 py-2.5 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
            >
              <Search className="w-4 h-4 mr-2" />
              {t('settingsPage.auditLogs.filters.search')}
            </button>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-void-surface border border-edge rounded-xl overflow-hidden shadow-sm">
        {logs.length === 0 ? (
          <div className="text-center py-12">
 <FileText className="w-12 h-12 mx-auto text-gray-600 mb-3" /> <p className="text-paper-muted font-medium tracking-wide">{t('settingsPage.auditLogs.empty')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-void-raised border-b border-edge">
                <tr>
 <th className="px-6 py-4 text-left text-xs font-semibold text-paper-muted uppercase tracking-wider">{t('settingsPage.auditLogs.table.time')}</th> <th className="px-6 py-4 text-left text-xs font-semibold text-paper-muted uppercase tracking-wider">{t('settingsPage.auditLogs.table.user')}</th> <th className="px-6 py-4 text-left text-xs font-semibold text-paper-muted uppercase tracking-wider">{t('settingsPage.auditLogs.table.action')}</th> <th className="px-6 py-4 text-left text-xs font-semibold text-paper-muted uppercase tracking-wider">{t('settingsPage.auditLogs.table.resource')}</th> <th className="px-6 py-4 text-left text-xs font-semibold text-paper-muted uppercase tracking-wider">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none">
                    <td className="px-6 py-4 text-sm text-paper font-medium whitespace-nowrap tabular-nums">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm text-paper-muted tabular-nums">
                      {log.user_id ? (
 <span className="flex items-center text-paper-muted "> <User className="w-4 h-4 mr-2 text-signal" /> {t('reports.exportId')}: {log.user_id} </span> ) : ( <span className="text-gray-500 font-medium">{t('settingsPage.auditLogs.table.system')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-md tracking-wide ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-paper-muted font-medium">
                      {log.resource_type && (
                        <span>
                          {log.resource_type}
                          {log.resource_id && <span className="text-paper-faint ml-1 tabular-nums">#{log.resource_id}</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-paper-faint font-mono tracking-wider tabular-nums">
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {logs.length > 0 && (
        <div className="flex items-center justify-between">
 <p className="text-sm font-medium text-paper-muted "> {t('settingsPage.auditLogs.showing')} <span className="text-paper ">{filters.offset + 1} - {filters.offset + logs.length}</span> logs
          </p>
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) });
                setTimeout(loadLogs, 100);
              }}
              disabled={filters.offset === 0}
              className="px-5 py-2.5 text-paper-muted bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised hover:text-paper transition-colors duration-150 motion-reduce:transition-none font-medium disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
            >
              {t('settingsPage.auditLogs.prev')}
            </button>
            <button
              onClick={() => {
                setFilters({ ...filters, offset: filters.offset + filters.limit });
                setTimeout(loadLogs, 100);
              }}
              disabled={logs.length < filters.limit}
              className="px-5 py-2.5 text-paper-muted bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised hover:text-paper transition-colors duration-150 motion-reduce:transition-none font-medium disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
            >
              {t('settingsPage.auditLogs.next')}
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
 <div className="bg-signal/10 border border-signal/20 rounded-xl p-4"> <p className="text-sm text-signal"> <strong className="text-signal">{t('settingsPage.auditLogs.noteLabel')}</strong>{' '} {t('settingsPage.auditLogs.note')}
        </p>
      </div>
    </div>
  );
}
