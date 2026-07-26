'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Palette, RotateCcw, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useDialog } from '@/components/ui/Dialog';
import { api } from '@/lib/api';

interface BrandingData {
  id: number;
  primary_color: string;
  secondary_color: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  favicon_url: string | null;
  login_background_url: string | null;
  custom_css: string | null;
  created_at: string;
  updated_at: string | null;
}

export default function BrandingSettings() {
  const { t } = useLanguage();
  const { confirm } = useDialog();
  const [settings, setSettings] = useState<BrandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    primary_color: '#3B82F6',
    secondary_color: '#10B981',
    logo_light_url: '',
    logo_dark_url: '',
    favicon_url: '',
    login_background_url: '',
    custom_css: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/api/branding/');
      const data = response.data;
      setSettings(data);
      setFormData({
        primary_color: data.primary_color,
        secondary_color: data.secondary_color,
        logo_light_url: data.logo_light_url || '',
        logo_dark_url: data.logo_dark_url || '',
        favicon_url: data.favicon_url || '',
        login_background_url: data.login_background_url || '',
        custom_css: data.custom_css || ''
      });
    } catch (error) {
      console.error('Error loading branding settings:', error);
      toast.error(t('settingsPage.branding.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await api.put('/api/branding/', formData);
      const data = response.data;
      setSettings(data);
      toast.success(t('settingsPage.branding.saveSuccess'));
    } catch (error) {
      console.error('Error saving branding settings:', error);
      toast.error(t('settingsPage.branding.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: t('settingsPage.branding.resetConfirmTitle'),
      message: t('settingsPage.branding.resetConfirmMessage'),
      variant: 'warning'
    });
    if (!ok) return;

    try {
      const response = await api.post('/api/branding/reset');
      const data = response.data;
      setSettings(data);
      setFormData({
        primary_color: data.primary_color,
        secondary_color: data.secondary_color,
        logo_light_url: data.logo_light_url || '',
        logo_dark_url: data.logo_dark_url || '',
        favicon_url: data.favicon_url || '',
        login_background_url: data.login_background_url || '',
        custom_css: data.custom_css || ''
      });
      toast.success(t('settingsPage.branding.resetSuccess'));
    } catch (error) {
      console.error('Error resetting branding settings:', error);
      toast.error(t('settingsPage.branding.errors.resetFailed'));
    }
  };

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">{t('settings.tabs.branding')}</h2>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{t('settingsPage.branding.subtitle')}</p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center px-4 py-2.5 text-slate-700 dark:text-gray-300 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl hover:bg-gray-800 transition-colors font-medium shadow-sm"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {t('settingsPage.branding.resetDefaults')}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Color Settings */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center">
            <Palette className="w-5 h-5 mr-2 text-indigo-400" />
            {t('settingsPage.branding.colors')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                {t('settingsPage.branding.primaryColor')}
              </label>
              <div className="flex items-center space-x-3">
                <div className="relative overflow-hidden rounded-lg w-12 h-10 border border-slate-300 dark:border-gray-700 shrink-0">
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                    className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                  />
                </div>
                <input
                  type="text"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-mono"
                  placeholder="#3B82F6"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                {t('settingsPage.branding.secondaryColor')}
              </label>
              <div className="flex items-center space-x-3">
                <div className="relative overflow-hidden rounded-lg w-12 h-10 border border-slate-300 dark:border-gray-700 shrink-0">
                  <input
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                    className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                  />
                </div>
                <input
                  type="text"
                  value={formData.secondary_color}
                  onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-mono"
                  placeholder="#10B981"
                  pattern="^#[0-9A-Fa-f]{6}$"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Logo & Images */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">{t('settingsPage.branding.logoAndImages')}</h3>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                {t('settingsPage.branding.logoLight')}
              </label>
              <input
                type="url"
                value={formData.logo_light_url}
                onChange={(e) => setFormData({ ...formData, logo_light_url: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
                placeholder="https://example.com/logo-light.png"
              />
              <p className="text-xs text-gray-500 mt-1.5 font-medium">{t('settingsPage.branding.logoLightHint')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                {t('settingsPage.branding.logoDark')}
              </label>
              <input
                type="url"
                value={formData.logo_dark_url}
                onChange={(e) => setFormData({ ...formData, logo_dark_url: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
                placeholder="https://example.com/logo-dark.png"
              />
              <p className="text-xs text-gray-500 mt-1.5 font-medium">{t('settingsPage.branding.logoDarkHint')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                {t('settingsPage.branding.favicon')}
              </label>
              <input
                type="url"
                value={formData.favicon_url}
                onChange={(e) => setFormData({ ...formData, favicon_url: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
                placeholder="https://example.com/favicon.ico"
              />
              <p className="text-xs text-gray-500 mt-1.5 font-medium">{t('settingsPage.branding.faviconHint')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                {t('settingsPage.branding.loginBackground')}
              </label>
              <input
                type="url"
                value={formData.login_background_url}
                onChange={(e) => setFormData({ ...formData, login_background_url: e.target.value })}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
                placeholder="https://example.com/login-bg.jpg"
              />
              <p className="text-xs text-gray-500 mt-1.5 font-medium">{t('settingsPage.branding.loginBackgroundHint')}</p>
            </div>
          </div>
        </div>

        {/* Custom CSS */}
        <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">{t('settingsPage.branding.customCssTitle')}</h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('settingsPage.branding.customCssLabel')}
            </label>
            <textarea
              value={formData.custom_css}
              onChange={(e) => setFormData({ ...formData, custom_css: e.target.value })}
              className="w-full px-4 py-3 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-mono text-sm placeholder-gray-500 resize-y"
              rows={8}
              placeholder=".custom-class { color: red; }"
            />
            <p className="text-xs text-gray-500 mt-2 font-medium">
              {t('settingsPage.branding.customCssHint')}
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20 font-medium"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? t('common.saving') : t('settings.saveSettings')}
          </button>
        </div>
      </form>

      {/* Info Box */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
        <p className="text-sm text-indigo-200">
          <strong className="text-indigo-300">{t('settingsPage.branding.noteLabel')}</strong> {t('settingsPage.branding.noteBody')}
        </p>
      </div>
    </div>
  );
}
