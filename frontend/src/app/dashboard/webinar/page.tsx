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
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-blue-900 to-[#030614] border border-blue-500/30 p-12 text-center flex flex-col items-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-500/20 blur-[100px] pointer-events-none" />

        <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-6 relative z-10 border border-blue-400/30">
          <Award className="w-10 h-10 text-blue-400" />
        </div>

        <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-widest rounded-full mb-4 relative z-10 border border-blue-500/30">
          {t('landing.webinar.badge')}
        </span>

        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-6 relative z-10 max-w-3xl leading-tight">
          {t('landing.webinar.heroTitlePrefix')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Nope360</span>
        </h1>

        <p className="text-lg text-blue-200/70 max-w-2xl mb-10 relative z-10">
          {t('landing.webinar.heroSubtitle')}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 relative z-10">
          <button
            onClick={handleRegister}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 text-lg"
          >
            <CheckCircle2 className="w-5 h-5" />
            {t('landing.webinar.reserveCta')}
          </button>
          <Link href="/dashboard" className="px-8 py-4 bg-white/5 hover:bg-white/10 text-slate-900 dark:text-white rounded-xl font-bold transition-all border border-white/10 flex items-center justify-center">
            {t('common.backToDashboard')}
          </Link>
        </div>
      </div>

      {/* Details Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 flex flex-col items-center text-center">
          <Calendar className="w-8 h-8 text-cyan-400 mb-4" />
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">{t('landing.webinar.scheduleLabel')}</h3>
          <p className="text-sm text-zinc-400">{t('landing.webinar.scheduleDate')}<br/>{t('landing.webinar.scheduleTime')}</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 flex flex-col items-center text-center">
          <PlayCircle className="w-8 h-8 text-rose-400 mb-4" />
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">{t('landing.webinar.formatLabel')}</h3>
          <p className="text-sm text-zinc-400">{t('landing.webinar.formatValue')}<br/>{t('landing.webinar.formatNote')}</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 flex flex-col items-center text-center">
          <Users className="w-8 h-8 text-emerald-400 mb-4" />
          <h3 className="font-bold text-slate-900 dark:text-white mb-2">{t('landing.webinar.audienceLabel')}</h3>
          <p className="text-sm text-zinc-400">{t('landing.webinar.audienceValue')}</p>
        </div>
      </div>
    </div>
  );
}
