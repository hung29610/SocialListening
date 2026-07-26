'use client';

import { useEffect, useState } from 'react';
import { Link2, CheckCircle2, AlertCircle, Clock, RefreshCcw, ExternalLink, Rss, Globe, Youtube, Facebook, Instagram, Twitter, Video, Mic } from 'lucide-react';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

interface Capabilities {
  web?: { status: string };
  youtube?: { status: string };
  facebook?: { status: string };
  instagram?: { status: string };
  rss?: { status: string; active_sources?: number };
  tiktok?: { status: string };
  twitter?: { status: string };
}

/**
 * Backend status -> i18n key suffix. Every status the API can emit is mapped, so
 * an unmapped value shows the raw code instead of silently reading as "ready".
 */
const STATUS_KEYS: Record<string, string> = {
  READY: 'ready',
  CONFIG_REQUIRED: 'configRequired',
  CONNECT_REQUIRED: 'connectRequired',
  CONNECTOR_REQUIRED: 'connectorRequired',
  NO_SOURCES: 'noSources',
  PENDING_VALIDATION: 'pendingValidation',
  ERROR: 'error',
  COMING_SOON: 'comingSoon',
};

const STATUS_COLORS: Record<string, string> = {
  READY: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
  CONFIG_REQUIRED: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
  CONNECT_REQUIRED: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
  CONNECTOR_REQUIRED: 'text-gray-500 bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20',
  NO_SOURCES: 'text-orange-600 bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20',
  PENDING_VALIDATION: 'text-sky-600 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/20',
  ERROR: 'text-rose-600 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20',
  COMING_SOON: 'text-gray-500 bg-gray-50 dark:bg-gray-500/10 border-gray-200 dark:border-gray-500/20',
};

export default function IntegrationsPage() {
  const [caps, setCaps] = useState<Capabilities>({});
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    fetchCapabilities();
  }, []);

  const fetchCapabilities = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/integrations/capabilities');
      setCaps(res.data);
    } catch {
      toast.error(t('integrations.loadStatusFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleMetaConnect = async () => {
    try {
      const res = await api.get('/api/integrations/meta/auth-url');
      if (res.data?.url) {
        window.location.href = res.data.url;
      } else {
        toast.error(t('integrations.meta.noOAuthUrl'));
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '';
      // The backend flags a missing Meta app config in its detail message.
      if (detail.includes('META_APP_ID') || detail.includes('cấu hình')) {
        toast.error(t('integrations.meta.configRequired'));
      } else {
        toast.error(detail || t('integrations.meta.connectFailed'));
      }
    }
  };

  // Platform names are product names and stay untranslated; only the
  // descriptions and status text come from the dictionary.
  const integrations = [
    {
      key: 'web',
      label: 'Web Search',
      icon: Globe,
      color: 'text-indigo-500',
      description: t('integrations.card.webDesc'),
      action: null,
      actionLabel: null,
    },
    {
      key: 'youtube',
      label: 'YouTube',
      icon: Youtube,
      color: 'text-red-500',
      description: t('integrations.card.youtubeDesc'),
      action: null,
      actionLabel: null,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      icon: Facebook,
      color: 'text-blue-600',
      description: t('integrations.card.facebookDesc'),
      action: handleMetaConnect,
      actionLabel: t('integrations.action.connect'),
    },
    {
      key: 'instagram',
      label: 'Instagram',
      icon: Instagram,
      color: 'text-fuchsia-500',
      description: t('integrations.card.instagramDesc'),
      action: handleMetaConnect,
      actionLabel: t('integrations.action.connect'),
    },
    {
      key: 'rss',
      label: 'RSS Feeds',
      icon: Rss,
      color: 'text-orange-500',
      description: t('integrations.card.rssDesc'),
      action: () => router.push('/dashboard/sources'),
      actionLabel: t('integrations.action.addRssSource'),
    },
    {
      key: 'twitter',
      label: 'X / Twitter',
      icon: Twitter,
      color: 'text-sky-500',
      description: t('integrations.card.twitterDesc'),
      action: null,
      actionLabel: null,
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      icon: Video,
      color: 'text-pink-500',
      description: t('integrations.card.tiktokDesc'),
      action: null,
      actionLabel: null,
      forceStatus: 'CONNECTOR_REQUIRED',
    },
    {
      key: 'podcasts',
      label: 'Podcasts',
      icon: Mic,
      color: 'text-purple-500',
      description: t('integrations.card.podcastsDesc'),
      action: null,
      actionLabel: null,
      forceStatus: 'COMING_SOON',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
            <Link2 className="w-6 h-6 text-indigo-500" />
            {t('integrations.title')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            {t('integrations.subtitle')}
          </p>
        </div>
        <button
          onClick={fetchCapabilities}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {t('integrations.refresh')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-slate-500 dark:text-gray-400">
          <RefreshCcw className="w-5 h-5 animate-spin mr-2" /> {t('integrations.loadingStatus')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((intg) => {
            const capStatus = (caps as any)[intg.key]?.status || intg.forceStatus || 'CONFIG_REQUIRED';
            const status = intg.forceStatus || capStatus;
            const isReady = status === 'READY';
            const statusKey = STATUS_KEYS[status];
            const statusLabel = statusKey ? t(`integrations.status.${statusKey}`) : status;
            const statusClass = STATUS_COLORS[status] || STATUS_COLORS.CONFIG_REQUIRED;
            const canAct = Boolean(intg.action) && ['CONNECT_REQUIRED', 'NO_SOURCES', 'ERROR', 'PENDING_VALIDATION'].includes(status);

            return (
              <div
                key={intg.key}
                className="bg-white dark:bg-[#050A15] rounded-2xl shadow border border-gray-200 dark:border-white/10 p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gray-50 dark:bg-white/5 flex items-center justify-center border border-gray-100 dark:border-white/10`}>
                      <intg.icon className={`w-6 h-6 ${intg.color}`} />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900 dark:text-white">{intg.label}</h2>
                      <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 max-w-sm">{intg.description}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${statusClass}`}>
                    {statusLabel}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {isReady ? (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      {t('integrations.hint.ready')}
                    </div>
                  ) : status === 'CONFIG_REQUIRED' ? (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {t('integrations.hint.configRequired')}
                    </div>
                  ) : status === 'CONNECTOR_REQUIRED' ? (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {t('integrations.hint.connectorRequired')}
                    </div>
                  ) : status === 'ERROR' ? (
                    <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {t('integrations.hint.error')}
                    </div>
                  ) : status === 'PENDING_VALIDATION' ? (
                    <div className="flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400">
                      <Clock className="w-3.5 h-3.5" />
                      {t('integrations.hint.pendingValidation')}
                    </div>
                  ) : status === 'COMING_SOON' ? (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      {t('integrations.hint.comingSoon')}
                    </div>
                  ) : null}

                  {canAct ? (
                    <button
                      onClick={intg.action ?? undefined}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {intg.actionLabel}
                    </button>
                  ) : null}

                  {intg.key === 'facebook' || intg.key === 'instagram' ? (
                    <Link
                      href="/dashboard/integrations/meta"
                      className="ml-auto text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      {t('integrations.manageAccounts')} <ExternalLink className="w-3 h-3" />
                    </Link>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
