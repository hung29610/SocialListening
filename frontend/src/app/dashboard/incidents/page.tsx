'use client';

import { useEffect, useState } from 'react';
import { FileText, Eye, Plus, X, Check } from 'lucide-react';
import { incidents as incidentsApi, getErrorMessage } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import Link from 'next/link';
import EvidenceLockerModal from '@/components/dashboard/EvidenceLockerModal';
import CrisisWarRoomModal from '@/components/dashboard/CrisisWarRoomModal';
import { ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const STATUS_OPTIONS = [
  { value: 'new', key: 'new' },
  { value: 'verifying', key: 'verifying' },
  { value: 'responding', key: 'responding' },
  { value: 'waiting_legal', key: 'waitingLegal' },
  { value: 'waiting_platform', key: 'waitingPlatform' },
  { value: 'resolved', key: 'resolved' },
  { value: 'closed', key: 'closed' },
];

export default function IncidentsPage() {
  const { t } = useLanguage();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    deadline: '',
    mention_id: '',
  });

  // Update status modal
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [updateForm, setUpdateForm] = useState({ status: '', resolution_notes: '' });

  // View logs modal
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [logIncidentId, setLogIncidentId] = useState<number | null>(null);
  const [newLog, setNewLog] = useState('');
  
  // Evidence Locker modal
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidenceIncident, setEvidenceIncident] = useState<any>(null);
  
  // Crisis War Room modal
  const [showWarRoom, setShowWarRoom] = useState(false);
  const [warRoomIncident, setWarRoomIncident] = useState<any>(null);

  useEffect(() => {
    fetchIncidents();
  }, [filter]);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, page_size: 50 };
      if (filter !== 'all') params.status = filter;
      const data = await incidentsApi.list(params);
      setIncidents(data.items || []);
    } catch (error: any) {
      toast.error(getErrorMessage(error) || t('reputationPage.incidents.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!createForm.title.trim()) {
      toast.error(t('reputationPage.incidents.errors.titleRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await incidentsApi.create({
        title: createForm.title,
        description: createForm.description || undefined,
        mention_id: createForm.mention_id ? parseInt(createForm.mention_id) : undefined,
        deadline: createForm.deadline ? new Date(createForm.deadline).toISOString() : undefined,
      });
      toast.success(t('reputationPage.incidents.createSuccess'));
      setShowCreate(false);
      setCreateForm({ title: '', description: '', deadline: '', mention_id: '' });
      fetchIncidents();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || t('reputationPage.incidents.errors.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const openUpdateStatus = (incident: any) => {
    setSelectedIncident(incident);
    setUpdateForm({ status: incident.status, resolution_notes: '' });
    setShowUpdateStatus(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedIncident) return;
    try {
      await incidentsApi.update(selectedIncident.id, {
        status: updateForm.status,
        resolution_notes: updateForm.resolution_notes || undefined,
      });
      toast.success(t('reputationPage.incidents.updateStatusSuccess'));
      setShowUpdateStatus(false);
      fetchIncidents();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || t('reputationPage.incidents.errors.updateStatusFailed'));
    }
  };

  const openLogs = async (incident: any) => {
    setLogIncidentId(incident.id);
    setSelectedIncident(incident);
    try {
      const data = await incidentsApi.getLogs(incident.id);
      setLogs(data || []);
    } catch {
      setLogs([]);
    }
    setShowLogs(true);
  };

  const handleAddLog = async () => {
    if (!logIncidentId || !newLog.trim()) return;
    try {
      await incidentsApi.addLog(logIncidentId, { action: 'note', notes: newLog });
      toast.success(t('reputationPage.incidents.logAdded'));
      setNewLog('');
      const data = await incidentsApi.getLogs(logIncidentId);
      setLogs(data || []);
    } catch (error: any) {
      toast.error(getErrorMessage(error) || t('reputationPage.incidents.errors.addLogFailed'));
    }
  };

  const getStatusColor = (status: string) => {
    const map: Record<string, string> = {
      new: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20',
      verifying: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      responding: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
      waiting_legal: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
      waiting_platform: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
      resolved: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      closed: 'bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-gray-700',
    };
    return map[status] || 'bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-gray-700';
  };

  const getStatusLabel = (s: string) => {
    const found = STATUS_OPTIONS.find((x) => x.value === s);
    return found ? t(`reputationPage.incidents.status.${found.key}`) : s;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-500 dark:text-gray-400 font-medium tracking-wide">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide">{t('reputationPage.incidents.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{t('reputationPage.incidents.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20 font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>{t('reputationPage.incidents.create')}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'all' ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 border border-indigo-500/50' : 'bg-white dark:bg-[#111827] text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-800 hover:text-white hover:bg-white dark:bg-[#1E293B]'}`}
        >
          {t('common.all')}
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === s.value ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 border border-indigo-500/50' : 'bg-white dark:bg-[#111827] text-slate-500 dark:text-gray-400 border border-slate-200 dark:border-gray-800 hover:text-white hover:bg-white dark:bg-[#1E293B]'}`}
          >
            {t(`reputationPage.incidents.status.${s.key}`)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {incidents.length === 0 ? (
          <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-xl bg-white dark:bg-[#1E293B] flex items-center justify-center mx-auto mb-4 border border-slate-200 dark:border-gray-800 shadow-sm">
              <FileText className="w-8 h-8 text-gray-500" />
            </div>
            <p className="text-slate-500 dark:text-gray-400 font-medium tracking-wide">{t('reputationPage.incidents.empty')}</p>
          </div>
        ) : (
          incidents.map((incident) => (
            <div key={incident.id} className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-5 sm:p-6 hover:bg-white dark:bg-[#1E293B]/30 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 flex-wrap gap-2">
                    <FileText className="w-5 h-5 text-gray-500" />
                    <h3 className="font-bold text-slate-900 dark:text-white">{incident.title}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${getStatusColor(incident.status)}`}>
                      {getStatusLabel(incident.status)}
                    </span>
                    {incident.is_overdue && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border bg-rose-500/10 text-rose-400 border-rose-500/20">
                        {t('reputationPage.incidents.overdue')}
                      </span>
                    )}
                  </div>
                    {incident.description && (
                      <p className="text-sm text-slate-500 dark:text-gray-400 mt-3 leading-relaxed">{incident.description}</p>
                    )}
                    {incident.mention_id && (
                      <div className="mt-4">
                        <Link
                          href={`/dashboard/mentions/${incident.mention_id}`}
                          className="inline-flex items-center text-xs font-semibold tracking-wide text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1.5" />
                          {t('reputationPage.viewSourceMention', { id: incident.mention_id })}
                        </Link>
                      </div>
                    )}
                    <div className="flex items-center space-x-4 text-xs font-medium text-gray-500 mt-4">
                    <span>{t('reputationPage.incidents.createdAt', { date: new Date(incident.created_at).toLocaleString('vi-VN') })}</span>
                    {incident.deadline && (
                      <span>{t('reputationPage.incidents.deadlineAt', { date: new Date(incident.deadline).toLocaleString('vi-VN') })}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2 sm:ml-4 flex-shrink-0">
                  <button
                    onClick={() => {
                      setWarRoomIncident(incident);
                      setShowWarRoom(true);
                    }}
                    className="p-2 text-slate-500 dark:text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
                    title={t('reputationPage.incidents.warRoom')}
                  >
                    <ShieldAlert className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setEvidenceIncident(incident);
                      setShowEvidence(true);
                    }}
                    className="p-2 text-slate-500 dark:text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors border border-transparent hover:border-emerald-500/20"
                    title={t('reputationPage.incidents.evidenceLocker')}
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => openLogs(incident)}
                    className="p-2 text-slate-500 dark:text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors border border-transparent hover:border-indigo-500/20"
                    title={t('reputationPage.incidents.viewHistory')}
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => openUpdateStatus(incident)}
                    className="p-2 text-slate-500 dark:text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors border border-transparent hover:border-amber-500/20"
                    title={t('reputationPage.incidents.updateStatus')}
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Incident Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setShowCreate(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg transform transition-all overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#1E293B]/30">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('reputationPage.incidents.create')}</h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-slate-700 dark:text-gray-300 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    {t('reputationPage.fields.title')} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder={t('reputationPage.incidents.form.titlePlaceholder')}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">{t('reputationPage.incidents.form.descriptionLabel')}</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    rows={4}
                    placeholder={t('reputationPage.incidents.form.descriptionPlaceholder')}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">{t('reputationPage.incidents.form.deadlineLabel')}</label>
                  <input
                    type="datetime-local"
                    value={createForm.deadline}
                    onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    {t('reputationPage.incidents.form.mentionIdLabel')}
                  </label>
                  <input
                    type="number"
                    value={createForm.mention_id}
                    onChange={(e) => setCreateForm({ ...createForm, mention_id: e.target.value })}
                    placeholder={t('reputationPage.incidents.form.mentionIdPlaceholder')}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1E293B]/30 flex justify-end space-x-3">
                <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-slate-700 dark:text-gray-300 bg-white dark:bg-[#111827] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors font-medium">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting || !createForm.title.trim()}
                  className="px-5 py-2.5 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-500/20 font-medium"
                >
                  {submitting ? t('reputationPage.creating') : t('reputationPage.incidents.create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {showUpdateStatus && selectedIncident && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setShowUpdateStatus(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md transform transition-all overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#1E293B]/30">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('reputationPage.incidents.updateStatus')}</h2>
                <button onClick={() => setShowUpdateStatus(false)} className="text-gray-500 hover:text-slate-700 dark:text-gray-300 transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    {t('reputationPage.fields.status')} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={updateForm.status}
                    onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{t(`reputationPage.incidents.status.${s.key}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    {t('reputationPage.incidents.form.resolutionNotesLabel')}
                  </label>
                  <textarea
                    value={updateForm.resolution_notes}
                    onChange={(e) => setUpdateForm({ ...updateForm, resolution_notes: e.target.value })}
                    rows={4}
                    placeholder={t('reputationPage.incidents.form.resolutionNotesPlaceholder')}
                    className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 resize-none"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1E293B]/30 flex justify-end space-x-3">
                <button onClick={() => setShowUpdateStatus(false)} className="px-5 py-2.5 text-slate-700 dark:text-gray-300 bg-white dark:bg-[#111827] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors font-medium">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleUpdateStatus}
                  className="px-5 py-2.5 text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-500/20 font-medium"
                >
                  {t('common.update')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogs && selectedIncident && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity" onClick={() => setShowLogs(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-[#1E293B]/30 shrink-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate pr-4">
                  {t('reputationPage.incidents.historyTitle', { title: selectedIncident.title })}
                </h2>
                <button onClick={() => setShowLogs(false)} className="text-gray-500 hover:text-slate-700 dark:text-gray-300 transition-colors shrink-0">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {logs.length === 0 ? (
                  <p className="text-slate-500 dark:text-gray-400 font-medium tracking-wide text-center py-4">{t('reputationPage.incidents.noHistory')}</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="border-l-[3px] border-indigo-500 pl-4 py-1.5">
                      <div className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wide">{log.action}</div>
                      {log.notes && <div className="text-sm text-slate-500 dark:text-gray-400 mt-1">{log.notes}</div>}
                      {(log.old_status || log.new_status) && (
                        <div className="text-xs font-medium text-gray-500 mt-2 bg-gray-800/50 inline-block px-2 py-1 rounded">
                          {log.old_status} <span className="text-slate-500 dark:text-gray-400 mx-1">→</span> {log.new_status}
                        </div>
                      )}
                      <div className="text-xs font-medium text-gray-500 mt-2 flex items-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50 mr-2" />
                        {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-white dark:bg-[#1E293B]/30 flex gap-3 shrink-0">
                <input
                  type="text"
                  value={newLog}
                  onChange={(e) => setNewLog(e.target.value)}
                  placeholder={t('reputationPage.incidents.addNotePlaceholder')}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLog()}
                />
                <button
                  onClick={handleAddLog}
                  disabled={!newLog.trim()}
                  className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed text-sm font-medium transition-colors shadow-sm shadow-indigo-500/20"
                >
                  {t('common.add')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Locker Modal */}
      <EvidenceLockerModal
        isOpen={showEvidence}
        onClose={() => setShowEvidence(false)}
        incident={evidenceIncident}
      />

      {/* Crisis War Room Modal */}
      <CrisisWarRoomModal
        isOpen={showWarRoom}
        onClose={() => setShowWarRoom(false)}
        incident={warRoomIncident}
      />
    </div>
  );
}
