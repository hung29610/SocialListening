'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Bell, Save, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export default function NotificationSettings() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState({
    webhookUrl: '',
    telegramWebhook: '',
    slackWebhook: '',
    discordWebhook: '',
    systemAlertsEnabled: true,
    alertChannels: ['email'] as string[],
    dailyReportEnabled: false,
    dailyReportTime: '09:00',
    weeklyReportEnabled: false,
    weeklyReportDay: 0,
    weeklyReportTime: '09:00'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/api/admin/settings/notifications');
      const data = response.data;
      setSettings({
        webhookUrl: data.webhook_url || '',
        telegramWebhook: data.telegram_webhook || '',
        slackWebhook: data.slack_webhook || '',
        discordWebhook: data.discord_webhook || '',
        systemAlertsEnabled: data.system_alerts_enabled !== undefined ? data.system_alerts_enabled : true,
        alertChannels: data.alert_channels || ['email'],
        dailyReportEnabled: data.daily_report_enabled || false,
        dailyReportTime: data.daily_report_time || '09:00',
        weeklyReportEnabled: data.weekly_report_enabled || false,
        weeklyReportDay: data.weekly_report_day || 0,
        weeklyReportTime: data.weekly_report_time || '09:00'
      });
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      toast.error(t('settingsPage.notifications.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/api/admin/settings/notifications', {
        webhook_url: settings.webhookUrl,
        telegram_webhook: settings.telegramWebhook,
        slack_webhook: settings.slackWebhook,
        discord_webhook: settings.discordWebhook,
        system_alerts_enabled: settings.systemAlertsEnabled,
        alert_channels: settings.alertChannels,
        daily_report_enabled: settings.dailyReportEnabled,
        daily_report_time: settings.dailyReportTime,
        weekly_report_enabled: settings.weeklyReportEnabled,
        weekly_report_day: settings.weeklyReportDay,
        weekly_report_time: settings.weeklyReportTime
      });
      toast.success(t('settingsPage.notifications.saved'));
    } catch (error: any) {
      console.error('Failed to save notification settings:', error);
      toast.error(t('settingsPage.notifications.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (channel: string) => {
    setTesting(channel);
    try {
      const response = await api.post(`/api/admin/settings/notifications/test?channel=${channel}`);
      const data = response.data;
      toast.success(data.message || t('settingsPage.notifications.testSuccess', { channel }));
    } catch (error: any) {
      console.error(`Failed to test ${channel}:`, error);
      toast.error(error.response?.data?.detail || t('settingsPage.notifications.testFailed', { channel }));
    } finally {
      setTesting(null);
    }
  };

  const toggleChannel = (channel: string) => {
    if (settings.alertChannels.includes(channel)) {
      setSettings({
        ...settings,
        alertChannels: settings.alertChannels.filter(c => c !== channel)
      });
    } else {
      setSettings({
        ...settings,
        alertChannels: [...settings.alertChannels, channel]
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">{t('settings.tabs.systemNotifications')}</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{t('settingsPage.notifications.subtitle')}</p>
      </div>

      {/* System Alerts */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-gray-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide">{t('settingsPage.notifications.systemAlerts.title')}</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{t('settingsPage.notifications.systemAlerts.desc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.systemAlertsEnabled}
              onChange={(e) => setSettings({ ...settings, systemAlertsEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-200 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>
        </div>

        {/* Alert Channels */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-4">{t('settingsPage.notifications.channelsLabel')}</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['email', 'telegram', 'slack', 'discord'].map((channel) => (
              <label key={channel} className="flex items-center cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.alertChannels.includes(channel)}
                  onChange={() => toggleChannel(channel)}
                  className="w-4 h-4 rounded bg-white dark:bg-[#111827] border-gray-600 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-gray-900 transition-colors"
                />
                <span className="ml-3 text-sm font-medium text-slate-700 dark:text-gray-300 capitalize group-hover:text-slate-900 dark:text-white transition-colors">{channel}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Webhook URLs */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6 space-y-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide flex items-center">
          <Bell className="w-5 h-5 mr-2 text-indigo-400" />
          {t('settingsPage.notifications.webhookUrlsTitle')}
        </h3>

        <div className="space-y-6">
          {/* Generic Webhook */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('settingsPage.notifications.genericWebhook')}
            </label>
            <div className="flex space-x-3">
              <input
                type="url"
                value={settings.webhookUrl}
                onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 transition-shadow"
                placeholder="https://your-webhook-url.com"
              />
              <button
                onClick={() => handleTest('webhook')}
                disabled={!settings.webhookUrl || testing === 'webhook'}
                className="px-4 py-2.5 border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
                title={t('settingsPage.notifications.testWebhook')}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Telegram */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('settingsPage.notifications.telegramWebhook')}
            </label>
            <div className="flex space-x-3">
              <input
                type="url"
                value={settings.telegramWebhook}
                onChange={(e) => setSettings({ ...settings, telegramWebhook: e.target.value })}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 transition-shadow"
                placeholder="https://api.telegram.org/bot..."
              />
              <button
                onClick={() => handleTest('telegram')}
                disabled={!settings.telegramWebhook || testing === 'telegram'}
                className="px-4 py-2.5 border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
                title={t('settingsPage.notifications.testTelegram')}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Slack */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('settingsPage.notifications.slackWebhook')}
            </label>
            <div className="flex space-x-3">
              <input
                type="url"
                value={settings.slackWebhook}
                onChange={(e) => setSettings({ ...settings, slackWebhook: e.target.value })}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 transition-shadow"
                placeholder="https://hooks.slack.com/services/..."
              />
              <button
                onClick={() => handleTest('slack')}
                disabled={!settings.slackWebhook || testing === 'slack'}
                className="px-4 py-2.5 border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
                title={t('settingsPage.notifications.testSlack')}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Discord */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('settingsPage.notifications.discordWebhook')}
            </label>
            <div className="flex space-x-3">
              <input
                type="url"
                value={settings.discordWebhook}
                onChange={(e) => setSettings({ ...settings, discordWebhook: e.target.value })}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500 transition-shadow"
                placeholder="https://discord.com/api/webhooks/..."
              />
              <button
                onClick={() => handleTest('discord')}
                disabled={!settings.discordWebhook || testing === 'discord'}
                className="px-4 py-2.5 border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
                title={t('settingsPage.notifications.testDiscord')}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Scheduling */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-wide mb-2">{t('settingsPage.notifications.scheduled.title')}</h3>

        {/* Daily Report */}
        <div className="flex items-center justify-between py-4 border-b border-slate-200 dark:border-gray-800">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-gray-200">{t('settingsPage.notifications.scheduled.daily')}</p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{t('settingsPage.notifications.scheduled.dailyDesc')}</p>
          </div>
          <div className="flex items-center space-x-4">
            <input
              type="time"
              value={settings.dailyReportTime}
              onChange={(e) => setSettings({ ...settings, dailyReportTime: e.target.value })}
              disabled={!settings.dailyReportEnabled}
              className="px-3 py-2 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dailyReportEnabled}
                onChange={(e) => setSettings({ ...settings, dailyReportEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-200 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {/* Weekly Report */}
        <div className="flex items-center justify-between py-4">
          <div className="flex-1 pr-4">
            <p className="text-sm font-medium text-gray-200">{t('settingsPage.notifications.scheduled.weekly')}</p>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{t('settingsPage.notifications.scheduled.weeklyDesc')}</p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={settings.weeklyReportDay}
              onChange={(e) => setSettings({ ...settings, weeklyReportDay: parseInt(e.target.value) })}
              disabled={!settings.weeklyReportEnabled}
              className="px-3 py-2 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="0">{t('settingsPage.notifications.weekdays.mon')}</option>
              <option value="1">{t('settingsPage.notifications.weekdays.tue')}</option>
              <option value="2">{t('settingsPage.notifications.weekdays.wed')}</option>
              <option value="3">{t('settingsPage.notifications.weekdays.thu')}</option>
              <option value="4">{t('settingsPage.notifications.weekdays.fri')}</option>
              <option value="5">{t('settingsPage.notifications.weekdays.sat')}</option>
              <option value="6">{t('settingsPage.notifications.weekdays.sun')}</option>
            </select>
            <input
              type="time"
              value={settings.weeklyReportTime}
              onChange={(e) => setSettings({ ...settings, weeklyReportTime: e.target.value })}
              disabled={!settings.weeklyReportEnabled}
              className="px-3 py-2 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.weeklyReportEnabled}
                onChange={(e) => setSettings({ ...settings, weeklyReportEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-200 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20 font-medium"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? t('common.saving') : t('settings.saveConfig')}
        </button>
      </div>

      {/* Info */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
        <p className="text-sm text-indigo-200">
          <strong className="text-indigo-300">{t('settingsPage.notifications.noteLabel')}</strong>{' '}
          {t('settingsPage.notifications.note')}
        </p>
      </div>
    </div>
  );
}
