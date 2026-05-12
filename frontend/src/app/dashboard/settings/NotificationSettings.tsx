'use client';

import { useState, useEffect } from 'react';
import { Bell, Save, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NotificationSettings() {
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
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/admin/settings/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
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
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      toast.error('Không thể tải cấu hình thông báo');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/admin/settings/notifications', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
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
        })
      });

      if (response.ok) {
        toast.success('Đã lưu cấu hình thông báo');
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Không thể lưu cấu hình');
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error);
      toast.error('Không thể lưu cấu hình thông báo');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (channel: string) => {
    setTesting(channel);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`https://social-listening-backend.onrender.com/api/admin/settings/notifications/test?channel=${channel}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || `Test ${channel} thành công`);
      } else {
        const error = await response.json();
        toast.error(error.detail || `Test ${channel} thất bại`);
      }
    } catch (error) {
      console.error(`Failed to test ${channel}:`, error);
      toast.error(`Không thể test ${channel}`);
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Thông báo hệ thống</h2>
        <p className="text-sm text-gray-600 mt-1">Cấu hình kênh thông báo và báo cáo tự động</p>
      </div>

      {/* System Alerts */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Cảnh báo hệ thống</h3>
            <p className="text-sm text-gray-600 mt-1">Bật/tắt thông báo cảnh báo tự động</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.systemAlertsEnabled}
              onChange={(e) => setSettings({ ...settings, systemAlertsEnabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* Alert Channels */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-3">Kênh thông báo</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['email', 'telegram', 'slack', 'discord'].map((channel) => (
              <label key={channel} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.alertChannels.includes(channel)}
                  onChange={() => toggleChannel(channel)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-900 capitalize">{channel}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Webhook URLs */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Bell className="w-5 h-5 mr-2" />
          Webhook URLs
        </h3>

        <div className="space-y-4">
          {/* Generic Webhook */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Generic Webhook URL
            </label>
            <div className="flex space-x-2">
              <input
                type="url"
                value={settings.webhookUrl}
                onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://your-webhook-url.com"
              />
              <button
                onClick={() => handleTest('webhook')}
                disabled={!settings.webhookUrl || testing === 'webhook'}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Telegram */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Telegram Webhook
            </label>
            <div className="flex space-x-2">
              <input
                type="url"
                value={settings.telegramWebhook}
                onChange={(e) => setSettings({ ...settings, telegramWebhook: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://api.telegram.org/bot..."
              />
              <button
                onClick={() => handleTest('telegram')}
                disabled={!settings.telegramWebhook || testing === 'telegram'}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Slack */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Slack Webhook
            </label>
            <div className="flex space-x-2">
              <input
                type="url"
                value={settings.slackWebhook}
                onChange={(e) => setSettings({ ...settings, slackWebhook: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://hooks.slack.com/services/..."
              />
              <button
                onClick={() => handleTest('slack')}
                disabled={!settings.slackWebhook || testing === 'slack'}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Discord */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Discord Webhook
            </label>
            <div className="flex space-x-2">
              <input
                type="url"
                value={settings.discordWebhook}
                onChange={(e) => setSettings({ ...settings, discordWebhook: e.target.value })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://discord.com/api/webhooks/..."
              />
              <button
                onClick={() => handleTest('discord')}
                disabled={!settings.discordWebhook || testing === 'discord'}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Scheduling */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Báo cáo tự động</h3>

        {/* Daily Report */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Báo cáo hàng ngày</p>
            <p className="text-xs text-gray-500 mt-1">Gửi báo cáo tổng hợp mỗi ngày</p>
          </div>
          <div className="flex items-center space-x-4">
            <input
              type="time"
              value={settings.dailyReportTime}
              onChange={(e) => setSettings({ ...settings, dailyReportTime: e.target.value })}
              disabled={!settings.dailyReportEnabled}
              className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dailyReportEnabled}
                onChange={(e) => setSettings({ ...settings, dailyReportEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Weekly Report */}
        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Báo cáo hàng tuần</p>
            <p className="text-xs text-gray-500 mt-1">Gửi báo cáo tổng hợp mỗi tuần</p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={settings.weeklyReportDay}
              onChange={(e) => setSettings({ ...settings, weeklyReportDay: parseInt(e.target.value) })}
              disabled={!settings.weeklyReportEnabled}
              className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <option value="0">Thứ 2</option>
              <option value="1">Thứ 3</option>
              <option value="2">Thứ 4</option>
              <option value="3">Thứ 5</option>
              <option value="4">Thứ 6</option>
              <option value="5">Thứ 7</option>
              <option value="6">Chủ nhật</option>
            </select>
            <input
              type="time"
              value={settings.weeklyReportTime}
              onChange={(e) => setSettings({ ...settings, weeklyReportTime: e.target.value })}
              disabled={!settings.weeklyReportEnabled}
              className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.weeklyReportEnabled}
                onChange={(e) => setSettings({ ...settings, weeklyReportEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Lưu ý:</strong> Báo cáo tự động sẽ được gửi qua các kênh đã cấu hình. 
          Đảm bảo đã cấu hình Email hoặc Webhook trước khi bật báo cáo tự động.
        </p>
      </div>
    </div>
  );
}
