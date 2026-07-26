'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function MonitorRedirect() {
  const { t } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/scan');
  }, [router]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-signal dark:text-signal-bright mb-4" />
      <p className="text-paper-muted">{t('misc.monitor.redirecting')}</p>
    </div>
  );
}