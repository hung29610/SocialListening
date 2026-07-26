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
      new: 'bg-info/10 text-info border border-info/25',
      verifying: 'bg-warning/[0.06] text-warning border border-warning/20',
      responding: 'bg-warning/10 text-warning border border-warning/25',
      waiting_legal: 'bg-sentiment-neutral/10 text-sentiment-neutral border border-sentiment-neutral/25',
      waiting_platform: 'bg-info/[0.06] text-info border border-info/20',
      resolved: 'bg-success/10 text-success border border-success/25',
      closed: 'bg-void-raised text-paper-muted border border-edge',
    };
    return map[status] || 'bg-void-raised text-paper-muted border border-edge';
  };

  const getStatusLabel = (s: string) => {
    const found = STATUS_OPTIONS.find((x) => x.value === s);
    return found ? t(`reputationPage.incidents.status.${found.key}`) : s;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-paper-muted font-medium tracking-wide">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-paper tracking-wide">{t('reputationPage.incidents.title')}</h1>
          <p className="text-sm text-paper-muted mt-1">{t('reputationPage.incidents.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        >
          <Plus className="w-4 h-4" />
          <span>{t('reputationPage.incidents.create')}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 ${filter === 'all' ? 'bg-signal/10 text-signal dark:text-signal-bright border border-signal/25' : 'bg-void-surface text-paper-muted border border-edge hover:text-paper hover:bg-void-raised'}`}
        >
          {t('common.all')}
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 ${filter === s.value ? 'bg-signal/10 text-signal dark:text-signal-bright border border-signal/25' : 'bg-void-surface text-paper-muted border border-edge hover:text-paper hover:bg-void-raised'}`}
          >
            {t(`reputationPage.incidents.status.${s.key}`)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {incidents.length === 0 ? (
          <div className="bg-void-surface border border-edge rounded-xl p-12 text-center">
            <div className="w-16 h-16 rounded-xl bg-void-raised flex items-center justify-center mx-auto mb-4 border border-edge">
              <FileText className="w-8 h-8 text-paper-faint" />
            </div>
            <p className="text-paper-muted font-medium tracking-wide">{t('reputationPage.incidents.empty')}</p>
          </div>
        ) : (
          incidents.map((incident) => (
            <div key={incident.id} className="bg-void-surface border border-edge rounded-xl p-5 sm:p-6 hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3 flex-wrap gap-2">
                    <FileText className="w-5 h-5 text-paper-faint" />
                    <h3 className="font-bold text-paper">{incident.title}</h3>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow rounded ${getStatusColor(incident.status)}`}>
                      {getStatusLabel(incident.status)}
                    </span>
                    {incident.is_overdue && (
                      <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-eyebrow rounded border bg-destructive/10 text-destructive border-destructive/25">
                        {t('reputationPage.incidents.overdue')}
                      </span>
                    )}
                  </div>
                    {incident.description && (
                      <p className="text-sm text-paper-muted mt-3 leading-relaxed">{incident.description}</p>
                    )}
                    {incident.mention_id && (
                      <div className="mt-4">
                        <Link
                          href={`/dashboard/mentions/${incident.mention_id}`}
                          className="inline-flex items-center text-xs font-semibold tracking-wide text-signal dark:text-signal-bright bg-signal/10 hover:bg-signal/15 border border-signal/25 px-3 py-1.5 rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                        >
                          <FileText className="w-3.5 h-3.5 mr-1.5" />
                          {t('reputationPage.viewSourceMention', { id: incident.mention_id })}
                        </Link>
                      </div>
                    )}
                    <div className="flex items-center space-x-4 text-xs font-medium text-paper-faint mt-4">
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
                    className="p-2 text-paper-muted hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-destructive/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                    title={t('reputationPage.incidents.warRoom')}
                  >
                    <ShieldAlert className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setEvidenceIncident(incident);
                      setShowEvidence(true);
                    }}
                    className="p-2 text-paper-muted hover:text-success hover:bg-success/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-success/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                    title={t('reputationPage.incidents.evidenceLocker')}
                  >
                    <FileText className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => openLogs(incident)}
                    className="p-2 text-paper-muted hover:text-signal dark:hover:text-signal-bright hover:bg-signal/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-signal/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                    title={t('reputationPage.incidents.viewHistory')}
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => openUpdateStatus(incident)}
                    className="p-2 text-paper-muted hover:text-warning hover:bg-warning/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-warning/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
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
          <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none" onClick={() => setShowCreate(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-void-surface border border-edge rounded-2xl shadow-tile w-full max-w-lg transform transition-all duration-150 motion-reduce:transition-none overflow-hidden">
              <div className="p-6 border-b border-edge flex items-center justify-between bg-void-raised">
                <h2 className="text-xl font-bold text-paper">{t('reputationPage.incidents.create')}</h2>
                <button onClick={() => setShowCreate(false)} className="text-paper-faint hover:text-paper rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('reputationPage.fields.title')} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder={t('reputationPage.incidents.form.titlePlaceholder')}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper placeholder:text-paper-faint"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">{t('reputationPage.incidents.form.descriptionLabel')}</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    rows={4}
                    placeholder={t('reputationPage.incidents.form.descriptionPlaceholder')}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper placeholder:text-paper-faint resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">{t('reputationPage.incidents.form.deadlineLabel')}</label>
                  <input
                    type="datetime-local"
                    value={createForm.deadline}
                    onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('reputationPage.incidents.form.mentionIdLabel')}
                  </label>
                  <input
                    type="number"
                    value={createForm.mention_id}
                    onChange={(e) => setCreateForm({ ...createForm, mention_id: e.target.value })}
                    placeholder={t('reputationPage.incidents.form.mentionIdPlaceholder')}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper placeholder:text-paper-faint"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-edge bg-void-raised flex justify-end space-x-3">
                <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 text-paper-muted bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised hover:text-paper transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={submitting || !createForm.title.trim()}
                  className="px-5 py-2.5 text-white bg-signal rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright disabled:bg-void-raised disabled:text-paper-faint disabled:cursor-not-allowed transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
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
          <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none" onClick={() => setShowUpdateStatus(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-void-surface border border-edge rounded-2xl shadow-tile w-full max-w-md transform transition-all duration-150 motion-reduce:transition-none overflow-hidden">
              <div className="p-6 border-b border-edge flex items-center justify-between bg-void-raised">
                <h2 className="text-xl font-bold text-paper">{t('reputationPage.incidents.updateStatus')}</h2>
                <button onClick={() => setShowUpdateStatus(false)} className="text-paper-faint hover:text-paper rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('reputationPage.fields.status')} <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={updateForm.status}
                    onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{t(`reputationPage.incidents.status.${s.key}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('reputationPage.incidents.form.resolutionNotesLabel')}
                  </label>
                  <textarea
                    value={updateForm.resolution_notes}
                    onChange={(e) => setUpdateForm({ ...updateForm, resolution_notes: e.target.value })}
                    rows={4}
                    placeholder={t('reputationPage.incidents.form.resolutionNotesPlaceholder')}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper placeholder:text-paper-faint resize-none"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-edge bg-void-raised flex justify-end space-x-3">
                <button onClick={() => setShowUpdateStatus(false)} className="px-5 py-2.5 text-paper-muted bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised hover:text-paper transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleUpdateStatus}
                  className="px-5 py-2.5 text-white bg-signal rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
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
          <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none" onClick={() => setShowLogs(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-void-surface border border-edge rounded-2xl shadow-tile w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b border-edge flex items-center justify-between bg-void-raised shrink-0">
                <h2 className="text-xl font-bold text-paper truncate pr-4">
                  {t('reputationPage.incidents.historyTitle', { title: selectedIncident.title })}
                </h2>
                <button onClick={() => setShowLogs(false)} className="text-paper-faint hover:text-paper rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 shrink-0">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {logs.length === 0 ? (
                  <p className="text-paper-muted font-medium tracking-wide text-center py-4">{t('reputationPage.incidents.noHistory')}</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="border-l-[3px] border-signal pl-4 py-1.5">
                      <div className="text-sm font-bold text-paper uppercase tracking-wide">{log.action}</div>
                      {log.notes && <div className="text-sm text-paper-muted mt-1">{log.notes}</div>}
                      {(log.old_status || log.new_status) && (
                        <div className="text-xs font-medium text-paper-faint mt-2 bg-void-raised inline-block px-2 py-1 rounded">
                          {log.old_status} <span className="text-paper-muted mx-1">→</span> {log.new_status}
                        </div>
                      )}
                      <div className="text-xs font-medium text-paper-faint mt-2 flex items-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-signal/50 mr-2" />
                        {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : ''}
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 border-t border-edge bg-void-raised flex gap-3 shrink-0">
                <input
                  type="text"
                  value={newLog}
                  onChange={(e) => setNewLog(e.target.value)}
                  placeholder={t('reputationPage.incidents.addNotePlaceholder')}
                  className="flex-1 px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper placeholder:text-paper-faint text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLog()}
                />
                <button
                  onClick={handleAddLog}
                  disabled={!newLog.trim()}
                  className="px-5 py-2.5 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright disabled:bg-void-raised disabled:text-paper-faint disabled:cursor-not-allowed text-sm font-medium transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
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
