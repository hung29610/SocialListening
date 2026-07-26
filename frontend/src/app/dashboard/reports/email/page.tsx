'use client';

import { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle2, RefreshCcw, Clock, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { reports, systemSettings } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const WEEKDAY_OPTIONS = [
  { value: 0, labelKey: 'reportsPage.email.weekday.mon' },
  { value: 1, labelKey: 'reportsPage.email.weekday.tue' },
  { value: 2, labelKey: 'reportsPage.email.weekday.wed' },
  { value: 3, labelKey: 'reportsPage.email.weekday.thu' },
  { value: 4, labelKey: 'reportsPage.email.weekday.fri' },
  { value: 5, labelKey: 'reportsPage.email.weekday.sat' },
  { value: 6, labelKey: 'reportsPage.email.weekday.sun' },
];

export default function EmailReportsPage() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailConfigured, setEmailConfigured] = useState(true);
  
  const [form, setForm] = useState({
    report_email_recipients: '',
    daily_report_enabled: false,
    daily_report_time: '09:00',
    weekly_report_enabled: false,
    weekly_report_day: 0,
    weekly_report_time: '09:00'
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await reports.getEmailSchedules();
      setForm({
        report_email_recipients: data.report_email_recipients || '',
        daily_report_enabled: data.daily_report_enabled || false,
        daily_report_time: data.daily_report_time || '09:00',
        weekly_report_enabled: data.weekly_report_enabled || false,
        weekly_report_day: data.weekly_report_day || 0,
        weekly_report_time: data.weekly_report_time || '09:00'
      });
      setEmailConfigured(data.email_provider_configured);
    } catch (err: any) {
      toast.error(t('reportsPage.email.errors.loadFailed') + ' ' + (err?.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const emails = form.report_email_recipients.trim();
    if ((form.daily_report_enabled || form.weekly_report_enabled) && !emails) {
      toast.error(t('reportsPage.email.errors.recipientsRequired'));
      return;
    }
    
    if (emails) {
      const emailList = emails.split(',').map(e => e.trim()).filter(Boolean);
      const invalid = emailList.filter(e => !e.includes('@'));
      if (invalid.length > 0) {
        toast.error(t('reportsPage.email.errors.invalidEmails', { emails: invalid.join(', ') }));
        return;
      }
    }

    setSaving(true);
    try {
      // First get all current system settings to not overwrite them
      const currentSettings = await systemSettings.getNotifications();
      
      await systemSettings.updateNotifications({
        ...currentSettings,
        report_email_recipients: emails,
        daily_report_enabled: form.daily_report_enabled,
        daily_report_time: form.daily_report_time,
        weekly_report_enabled: form.weekly_report_enabled,
        weekly_report_day: Number(form.weekly_report_day),
        weekly_report_time: form.weekly_report_time
      });
      toast.success(t('reportsPage.email.saveSuccess'));
    } catch (err: any) {
      toast.error(t('reportsPage.email.errors.saveFailed') + ' ' + (err?.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async (type: 'daily' | 'weekly') => {
    setSending(true);
    try {
      const res = await reports.sendEmailReportNow(type);
      toast.success(res.message || t('reportsPage.email.sendSuccess'));
    } catch (err: any) {
      toast.error(t('reportsPage.email.errors.sendFailed') + ' ' + (err?.response?.data?.detail || err.message));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><RefreshCcw className="w-8 h-8 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
          <Mail className="w-6 h-6 text-indigo-400" />
          {t('reportsPage.email.title')}
        </h1>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
          {t('reportsPage.email.subtitle')}
        </p>
      </div>

      {!emailConfigured && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 text-sm text-red-700 dark:text-red-400 font-medium flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong>{t('reportsPage.email.providerMissingTitle')}</strong> {t('reportsPage.email.providerMissingBody')}
            <br />
            {t('reportsPage.email.providerMissingHint')}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-8">
        <div className="flex items-center gap-4 mb-8 pb-8 border-b border-gray-100 dark:border-white/10">
          <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center">
            <Send className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('reportsPage.email.scheduleTitle')}</h2>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{t('reportsPage.email.scheduleDesc')}</p>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300">{t('reportsPage.email.recipientsLabel')}</label>
            <input
              type="text"
              value={form.report_email_recipients}
              onChange={e => setForm({ ...form, report_email_recipients: e.target.value })}
              placeholder={t('reportsPage.email.recipientsPlaceholder')}
              className="w-full bg-gray-50 dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Daily Settings */}
            <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    {t('reportsPage.email.dailyTitle')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{t('reportsPage.email.dailyDesc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={form.daily_report_enabled} onChange={e => setForm({ ...form, daily_report_enabled: e.target.checked })} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm text-gray-600 dark:text-gray-400">{t('reportsPage.email.sendTime')}</label>
                <input
                  type="time"
                  disabled={!form.daily_report_enabled}
                  value={form.daily_report_time}
                  onChange={e => setForm({ ...form, daily_report_time: e.target.value })}
                  className="w-full bg-white dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>

              <button
                onClick={() => handleSendNow('daily')}
                disabled={sending || !emailConfigured || !form.report_email_recipients}
                className="w-full py-2 bg-white dark:bg-white/5 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-3 h-3" />
                {t('reportsPage.email.sendTestDaily')}
              </button>
            </div>

            {/* Weekly Settings */}
            <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    {t('reportsPage.email.weeklyTitle')}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{t('reportsPage.email.weeklyDesc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={form.weekly_report_enabled} onChange={e => setForm({ ...form, weekly_report_enabled: e.target.checked })} />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                </label>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">{t('reportsPage.email.sendDay')}</label>
                  <select
                    disabled={!form.weekly_report_enabled}
                    value={form.weekly_report_day}
                    onChange={e => setForm({ ...form, weekly_report_day: Number(e.target.value) })}
                    className="w-full bg-white dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {WEEKDAY_OPTIONS.map(day => (
                      <option key={day.value} value={day.value}>{t(day.labelKey)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-gray-600 dark:text-gray-400">{t('reportsPage.email.sendTime')}</label>
                  <input
                    type="time"
                    disabled={!form.weekly_report_enabled}
                    value={form.weekly_report_time}
                    onChange={e => setForm({ ...form, weekly_report_time: e.target.value })}
                    className="w-full bg-white dark:bg-[#0a0f1c] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                onClick={() => handleSendNow('weekly')}
                disabled={sending || !emailConfigured || !form.report_email_recipients}
                className="w-full py-2 bg-white dark:bg-white/5 border border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send className="w-3 h-3" />
                {t('reportsPage.email.sendTestWeekly')}
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 dark:border-white/10 flex justify-end gap-3">
            <button
              onClick={loadSettings}
              className="px-6 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-white rounded-lg font-medium transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {t('settings.saveConfig')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
