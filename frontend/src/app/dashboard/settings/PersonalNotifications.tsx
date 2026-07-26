'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Bell, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export default function PersonalNotifications() {
  const { t } = useLanguage();
  const [settings, setSettings] = useState({
    emailNotifications: true,
    inAppNotifications: true,
    alertNotifications: true,
    incidentNotifications: true,
    reportNotifications: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/api/auth/me/notification-settings');
      const data = response.data;
      setSettings({
        emailNotifications: data.email_notifications,
        inAppNotifications: data.in_app_notifications,
        alertNotifications: data.alert_notifications,
        incidentNotifications: data.incident_notifications,
        reportNotifications: data.report_notifications
      });
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      toast.error(t('settingsPage.personalNotifications.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    console.log('🔵 [PersonalNotifications] handleSave called');
    console.log('🔵 [PersonalNotifications] Current settings:', settings);
    
    setSaving(true);
    try {
      const payload = {
        email_notifications: settings.emailNotifications,
        in_app_notifications: settings.inAppNotifications,
        alert_notifications: settings.alertNotifications,
        incident_notifications: settings.incidentNotifications,
        report_notifications: settings.reportNotifications
      };
      console.log('🔵 [PersonalNotifications] Payload:', payload);
      
      const response = await api.put('/api/auth/me/notification-settings', payload);
      const data = response.data;
      console.log('✅ [PersonalNotifications] Success:', data);
      toast.success(`✅ ${t('settingsPage.personalNotifications.saved')}`);
    } catch (error: any) {
      console.error('❌ [PersonalNotifications] Exception:', error);
      toast.error(error.response?.data?.detail || t('settingsPage.personalNotifications.errors.saveFailed'));
    } finally {
      setSaving(false);
      console.log('🔵 [PersonalNotifications] handleSave finished');
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
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">{t('settings.tabs.personalNotificationsDesc')}</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{t('settingsPage.personalNotifications.subtitle')}</p>
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6 space-y-4">
        <div className="space-y-4">
          {[
            {
              key: 'emailNotifications',
              label: t('settingsPage.personalNotifications.items.email.label'),
              description: t('settingsPage.personalNotifications.items.email.desc')
            },
            {
              key: 'inAppNotifications',
              label: t('settingsPage.personalNotifications.items.inApp.label'),
              description: t('settingsPage.personalNotifications.items.inApp.desc')
            },
            {
              key: 'alertNotifications',
              label: t('settingsPage.personalNotifications.items.alerts.label'),
              description: t('settingsPage.personalNotifications.items.alerts.desc')
            },
            {
              key: 'incidentNotifications',
              label: t('settingsPage.personalNotifications.items.incidents.label'),
              description: t('settingsPage.personalNotifications.items.incidents.desc')
            },
            {
              key: 'reportNotifications',
              label: t('settingsPage.personalNotifications.items.reports.label'),
              description: t('settingsPage.personalNotifications.items.reports.desc')
            }
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-3 border-b border-slate-200 dark:border-gray-800 last:border-0">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</p>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{item.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input
                  type="checkbox"
                  checked={settings[item.key as keyof typeof settings]}
                  onChange={(e) => {
                    console.log(`🔴 TOGGLE - ${item.key}:`, e.target.checked);
                    setSettings({ ...settings, [item.key]: e.target.checked });
                  }}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white dark:bg-[#1E293B] peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-gray-800">
          <button
            onClick={() => {
              console.log('🔴 SAVE BUTTON CLICKED');
              console.log('🔴 Current settings:', settings);
              handleSave();
            }}
            disabled={saving}
            className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20 font-medium"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? t('common.saving') : t('settings.saveSettings')}
          </button>
        </div>
      </div>
    </div>
  );
}
