'use client';

import { useState } from 'react';
import { Lock, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SecuritySettings() {
  const { t } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const handleChangePassword = async () => {
    if (saving) return; // Prevent double-click

    // Validation
    if (!passwords.current || !passwords.new || !passwords.confirm) {
      toast.error(`❌ ${t('settingsPage.security.errors.missingFields')}`);
      return;
    }

    if (passwords.new !== passwords.confirm) {
      toast.error(`❌ ${t('settingsPage.security.errors.mismatch')}`);
      return;
    }

    if (passwords.new.length < 8) {
      toast.error(`❌ ${t('auth.errorPasswordTooShort')}`);
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/auth/me/change-password', {
        current_password: passwords.current,
        new_password: passwords.new,
        confirm_password: passwords.confirm
      });

      toast.success(`✅ ${t('settingsPage.security.changeSuccess')}`);
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(`❌ ${error.response?.data?.detail || error.message || t('settingsPage.security.errors.changeFailed')}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">{t('settingsPage.security.title')}</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{t('settingsPage.security.subtitle')}</p>
      </div>

      {/* Change Password */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6 space-y-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
          <Lock className="w-5 h-5 mr-2 text-indigo-400" />
          {t('settingsPage.security.changePassword')}
        </h3>

        <div className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('settingsPage.security.currentPassword')} *
            </label>
            <input
              type="password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
              placeholder="••••••••"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('settingsPage.security.newPassword')} *
            </label>
            <input
              type="password"
              value={passwords.new}
              onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
              placeholder="••••••••"
            />
            <p className="text-xs text-gray-500 mt-1.5 font-medium">{t('settingsPage.security.passwordHint')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('settingsPage.security.confirmNewPassword')} *
            </label>
            <input
              type="password"
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-gray-800">
          <button
            onClick={handleChangePassword}
            disabled={saving}
            className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20 font-medium"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? t('common.saving') : t('settingsPage.security.changePassword')}
          </button>
        </div>
      </div>

      {/* Security Info */}
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
        <p className="text-sm text-indigo-200">
          <strong className="text-indigo-300">{t('settingsPage.security.noteLabel')}</strong> {t('settingsPage.security.note')}
        </p>
      </div>
    </div>
  );
}
