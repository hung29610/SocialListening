'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { User as UserIcon, Save, Upload } from 'lucide-react';
import { auth, api } from '@/lib/api';
import { getRoleDisplayName, getRoleBadgeColor } from '@/lib/permissions';
import toast from 'react-hot-toast';

export default function PersonalProfile() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState({
    full_name: '',
    email: '',
    phone: '',
    department: '',
    role: ''
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const user = await auth.getCurrentUser();
      setProfile({
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
        department: user.department || '',
        role: user.role || 'viewer'
      });
      // Load avatar if exists
      if (user.avatar_url) {
        setAvatarUrl(user.avatar_url);
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      toast.error(t('settingsPage.profile.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return; // Prevent double-click
    
    if (!profile.full_name || profile.full_name.trim() === '') {
      toast.error(t('settingsPage.profile.errors.nameRequired'));
      return;
    }

    setSaving(true);
    try {
      await api.put('/api/auth/me/profile', {
        full_name: profile.full_name.trim(),
        phone: profile.phone?.trim() || null,
        department: profile.department?.trim() || null
      });

      toast.success(`✅ ${t('settingsPage.profile.saveSuccess')}`);
      await loadProfile(); // Reload to verify
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.detail || error.message || t('settingsPage.profile.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('settingsPage.profile.errors.imageTypeInvalid'));
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('settingsPage.profile.errors.imageTooLarge'));
      return;
    }

    setUploading(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);

      // TODO: Upload to server when avatar endpoint is ready
      // For now, just show preview
      toast.success(`✅ ${t('settingsPage.profile.avatarUploadedPreview')}`);
      
      // Uncomment when backend avatar endpoint is ready:
      /*
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await api.post('/api/auth/me/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const data = response.data;
      setAvatarUrl(data.avatar_url);
      toast.success('✅ Đã cập nhật ảnh đại diện');
      */
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error(error.message || t('settingsPage.profile.errors.avatarUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-wide">{t('settings.tabs.profile')}</h2>
        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{t('settingsPage.profile.subtitle')}</p>
      </div>

      {/* Avatar */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center space-x-6">
          <div className="w-24 h-24 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-full flex items-center justify-center overflow-hidden shadow-inner">
            {avatarUrl ? (
              <img src={avatarUrl} alt={t('settingsPage.profile.avatarAlt')} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-12 h-12 text-gray-500" />
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg"
              onChange={handleFileChange}
              className="hidden"
            />
            <button 
              onClick={handleUploadClick}
              disabled={uploading}
              className="flex items-center px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20 font-medium"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? t('common.loading') : t('common.uploadLogo')}
            </button>
            <p className="text-xs text-gray-500 mt-2 font-medium">{t('settingsPage.profile.avatarHint')}</p>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-gray-800 rounded-xl shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('auth.fullNameLabel')} *
            </label>
            <input
              type="text"
              value={profile.full_name}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('auth.emailLabel')}
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B]/50 border border-slate-200 dark:border-gray-800 rounded-xl text-gray-500 cursor-not-allowed opacity-70"
            />
            <p className="text-xs text-gray-500 mt-1.5 font-medium">{t('settingsPage.profile.emailImmutable')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('settingsPage.profile.phone')}
            </label>
            <input
              type="tel"
              value={profile.phone}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
              placeholder="+84 xxx xxx xxx"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('settingsPage.profile.department')}
            </label>
            <input
              type="text"
              value={profile.department}
              onChange={(e) => setProfile({ ...profile, department: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white placeholder-gray-500"
              placeholder={t('settingsPage.profile.departmentPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              {t('settingsPage.profile.role')}
            </label>
            <div className="flex items-center space-x-3 mt-1">
              <span className={`px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${getRoleBadgeColor(profile.role)}`}>
                {getRoleDisplayName(profile.role, t)}
              </span>
              <span className="text-xs font-medium text-gray-500">{t('settingsPage.profile.roleAdminOnly')}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-gray-800">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20 font-medium"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? t('common.saving') : t('settings.saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}
