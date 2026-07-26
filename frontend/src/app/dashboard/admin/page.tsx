'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function GlobalAdminPage() {
  const { t } = useLanguage();
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  if (!user?.is_superuser) {
    return (
      <div className="p-8">
        <div className="bg-destructive/10 text-destructive border border-destructive/25 p-4 rounded-md">
          {t('misc.admin.accessDenied')}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-paper mb-6">{t('misc.admin.title')}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-void-surface rounded-lg p-6 border border-edge">
          <h3 className="text-sm font-medium text-paper-faint mb-2">{t('misc.admin.totalOrganizations')}</h3>
          <p className="text-3xl font-bold font-display text-paper tabular-nums">1</p>
        </div>
        <div className="bg-void-surface rounded-lg p-6 border border-edge">
          <h3 className="text-sm font-medium text-paper-faint mb-2">{t('misc.admin.totalUsers')}</h3>
          <p className="text-3xl font-bold font-display text-paper tabular-nums">1</p>
        </div>
        <div className="bg-void-surface rounded-lg p-6 border border-edge">
          <h3 className="text-sm font-medium text-paper-faint mb-2">{t('misc.admin.systemStatus')}</h3>
          <p className="text-3xl font-bold font-display text-success">{t('misc.admin.statusHealthy')}</p>
        </div>
      </div>
    </div>
  );
}
