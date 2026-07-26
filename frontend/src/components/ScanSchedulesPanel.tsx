'use client';

import { useState, useEffect } from 'react';
import { Clock, Play, Trash2, Plus, RefreshCw, Edit2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { crawl } from '@/lib/api';
import toast from 'react-hot-toast';
import { useLanguage } from '@/contexts/LanguageContext';

interface ScanSchedule {
  id: number;
  name: string;
  description?: string;
  cron_expression: string;
  timezone: string;
  is_active: boolean;
  next_run_at?: string;
  last_run_at?: string;
}

export default function ScanSchedulesPanel({ keywordGroups }: { keywordGroups: any[] }) {
  const { t } = useLanguage();
  const [schedules, setSchedules] = useState<ScanSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cron_expression: '0 * * * *', // Every hour
    keyword_group_ids: [] as number[],
    is_active: true,
  });

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const res = await crawl.getSchedules(1, 100);
      setSchedules(res.items || []);
    } catch (err: any) {
      toast.error(t('scanPage.schedules.loadError', { message: err.response?.data?.detail || err.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim() || formData.keyword_group_ids.length === 0) {
      toast.error(t('scanPage.schedules.nameAndGroupRequired'));
      return;
    }

    try {
      if (editingId) {
        await crawl.updateSchedule(editingId, formData);
        toast.success(t('scanPage.schedules.updated'));
      } else {
        await crawl.createSchedule(formData);
        toast.success(t('scanPage.schedules.created'));
      }
      setShowModal(false);
      fetchSchedules();
    } catch (err: any) {
      toast.error(t('scanPage.schedules.saveError', { message: err.response?.data?.detail || err.message }));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('scanPage.schedules.deleteConfirm'))) return;
    try {
      await crawl.deleteSchedule(id);
      toast.success(t('scanPage.schedules.deleted'));
      fetchSchedules();
    } catch (err: any) {
      toast.error(t('scanPage.schedules.deleteError', { message: err.response?.data?.detail || err.message }));
    }
  };

  const handleTrigger = async (id: number) => {
    try {
      await crawl.triggerSchedule(id);
      toast.success(t('scanPage.schedules.triggered'));
      fetchSchedules();
    } catch (err: any) {
      toast.error(t('scanPage.schedules.triggerError', { message: err.response?.data?.detail || err.message }));
    }
  };

  const openModal = (schedule?: ScanSchedule) => {
    if (schedule) {
      setEditingId(schedule.id);
      setFormData({
        name: schedule.name,
        description: schedule.description || '',
        cron_expression: schedule.cron_expression,
        keyword_group_ids: (schedule as any).keyword_group_ids || [],
        is_active: schedule.is_active,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        cron_expression: '0 * * * *',
        keyword_group_ids: [],
        is_active: true,
      });
    }
    setShowModal(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('vi-VN');
  };

  return (
    <div className="bg-[#0f172a] border border-slate-200 dark:border-gray-800 rounded-xl mb-6">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-800 flex justify-between items-center">
        <div>
          <h2 className="text-base font-semibold text-gray-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" /> {t('scanPage.schedules.title')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            {t('scanPage.schedules.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchSchedules}
            className="p-2 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 transition"
            title={t('scanPage.actions.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-500 transition"
          >
            <Plus className="w-4 h-4" /> {t('scanPage.schedules.addNew')}
          </button>
        </div>
      </div>

      <div className="p-0 overflow-x-auto">
        {schedules.length === 0 && !loading ? (
          <div className="text-center py-8 px-4 text-gray-500 text-sm">
            {t('scanPage.schedules.empty')}
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 dark:bg-[#0B1220] text-gray-500 uppercase text-[11px] font-medium border-b border-gray-800">
              <tr>
                <th className="px-4 py-3">{t('scanPage.schedules.colName')}</th>
                <th className="px-4 py-3">{t('scanPage.schedules.colCron')}</th>
                <th className="px-4 py-3 text-center">{t('scanPage.table.status')}</th>
                <th className="px-4 py-3">{t('scanPage.schedules.colLastRun')}</th>
                <th className="px-4 py-3 text-right">{t('scanPage.schedules.colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-gray-200">{s.name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">{s.description || '—'}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-emerald-400">
                    {s.cron_expression}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.is_active ? (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                        <CheckCircle className="w-3 h-3" /> {t('scanPage.schedules.on')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded border border-gray-700">
                        <XCircle className="w-3 h-3" /> {t('scanPage.schedules.off')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {formatDate(s.last_run_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleTrigger(s.id)} className="p-1.5 text-indigo-400 hover:bg-indigo-400/10 rounded transition" title={t('scanPage.schedules.runNow')}>
                        <Play className="w-4 h-4" />
                      </button>
                      <button onClick={() => openModal(s)} className="p-1.5 text-amber-400 hover:bg-amber-400/10 rounded transition" title={t('scanPage.schedules.edit')}>
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 text-rose-400 hover:bg-rose-400/10 rounded transition" title={t('common.delete')}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e293b] border border-gray-700 rounded-xl w-full max-w-lg p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-100 mb-4">{editingId ? t('scanPage.schedules.editTitle') : t('scanPage.schedules.createTitle')}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('scanPage.schedules.nameLabel')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#0f172a] border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  placeholder={t('scanPage.schedules.namePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('scanPage.schedules.cronLabel')}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.cron_expression}
                    onChange={(e) => setFormData({ ...formData, cron_expression: e.target.value })}
                    className="w-full font-mono bg-[#0f172a] border border-gray-600 rounded px-3 py-2 text-emerald-400 focus:outline-none focus:border-indigo-500"
                    placeholder="0 * * * *"
                  />
                  <div className="text-xs text-gray-500 flex flex-col justify-center">
                    <span>* * * * * (m h d M w)</span>
                    <a href="https://crontab.guru" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">{t('scanPage.schedules.cronGuide')}</a>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t('scanPage.schedules.groupsLabel')}</label>
                <select
                  multiple
                  value={formData.keyword_group_ids.map(String)}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                    setFormData({ ...formData, keyword_group_ids: values });
                  }}
                  className="w-full h-32 bg-[#0f172a] border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  {keywordGroups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">{t('scanPage.schedules.multiSelectHint')}</p>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-600 bg-gray-700 text-indigo-500 focus:ring-indigo-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-300 cursor-pointer">{t('scanPage.schedules.activeLabel')}</label>
              </div>

            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded hover:bg-gray-600 transition"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-500 transition flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> {t('settings.saveConfig')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
