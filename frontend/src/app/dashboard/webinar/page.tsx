'use client';

import { Award, Calendar, Users, PlayCircle, CheckCircle2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useDialog } from '@/components/ui/Dialog';
import { useLanguage } from '@/contexts/LanguageContext';

export default function WebinarPage() {
  const { prompt, alert } = useDialog();
  const { t } = useLanguage();

  const handleRegister = async () => {
    const email = await prompt({
      title: t('landing.webinar.registerTitle'),
      message: t('landing.webinar.registerMessage'),
      placeholder: 'your@email.com',
      confirmText: t('landing.webinar.registerConfirm'),
      icon: <Mail className="w-6 h-6" />,
    });
    if (email === null) return;
    if (email && email.includes('@')) {
      localStorage.setItem('webinar_registered', email);
      await alert({
        title: `${t('landing.webinar.successTitle')} 🎉`,
        message: t('landing.webinar.successMessage', { email }),
        variant: 'success',
        confirmText: t('landing.webinar.successConfirm'),
      });
    } else {
      await alert({
        title: t('landing.webinar.invalidEmailTitle'),
        message: t('landing.webinar.invalidEmailMessage'),
        variant: 'warning',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden bg-void-raised border border-edge p-12 text-center flex flex-col items-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-signal/20 blur-[100px] pointer-events-none" />

        <div className="w-20 h-20 bg-signal/10 rounded-full flex items-center justify-center mb-6 relative z-10 border border-signal/25">
          <Award className="w-10 h-10 text-signal dark:text-signal-bright" />
        </div>

        <span className="px-3 py-1 bg-signal/10 text-signal dark:text-signal-bright text-eyebrow font-semibold uppercase tracking-eyebrow rounded-full mb-4 relative z-10 border border-signal/25">
          {t('landing.webinar.badge')}
        </span>

        <h1 className="text-4xl md:text-5xl font-display font-bold text-paper tracking-tight mb-6 relative z-10 max-w-3xl leading-tight">
          {t('landing.webinar.heroTitlePrefix')} <span className="text-signal dark:text-signal-bright">Nope360</span>
        </h1>

        <p className="text-lg text-paper-muted max-w-2xl mb-10 relative z-10">
          {t('landing.webinar.heroSubtitle')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 relative z-10">
          <button
            onClick={handleRegister}
            className="px-8 py-4 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white rounded-xl font-bold transition-colors duration-150 motion-reduce:transition-none shadow-glow-signal flex items-center justify-center gap-2 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          >
            <CheckCircle2 className="w-5 h-5" />
            {t('landing.webinar.reserveCta')}
          </button>
          <Link href="/dashboard" className="px-8 py-4 bg-void-surface hover:bg-void-raised text-paper rounded-xl font-bold transition-colors duration-150 motion-reduce:transition-none border border-edge-strong flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
            {t('common.backToDashboard')}
          </Link>
        </div>
      </div>

      {/* Details Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-void-surface rounded-2xl border border-edge p-6 flex flex-col items-center text-center">
          <Calendar className="w-8 h-8 text-signal dark:text-signal-bright mb-4" />
          <h3 className="font-bold text-paper mb-2">{t('landing.webinar.scheduleLabel')}</h3>
          <p className="text-sm text-paper-muted">{t('landing.webinar.scheduleDate')}<br/>{t('landing.webinar.scheduleTime')}</p>
        </div>

        <div className="bg-void-surface rounded-2xl border border-edge p-6 flex flex-col items-center text-center">
          <PlayCircle className="w-8 h-8 text-signal dark:text-signal-bright mb-4" />
          <h3 className="font-bold text-paper mb-2">{t('landing.webinar.formatLabel')}</h3>
          <p className="text-sm text-paper-muted">{t('landing.webinar.formatValue')}<br/>{t('landing.webinar.formatNote')}</p>
        </div>

        <div className="bg-void-surface rounded-2xl border border-edge p-6 flex flex-col items-center text-center">
          <Users className="w-8 h-8 text-signal dark:text-signal-bright mb-4" />
          <h3 className="font-bold text-paper mb-2">{t('landing.webinar.audienceLabel')}</h3>
          <p className="text-sm text-paper-muted">{t('landing.webinar.audienceValue')}</p>
        </div>
      </div>
    </div>
  );
}
