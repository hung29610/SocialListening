'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Facebook,
  Globe,
  Instagram,
  Link2,
  MessageCircle,
  Newspaper,
  RefreshCcw,
  Rss,
  Twitter,
  Video,
  Youtube,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useConnectorCapabilities } from '@/hooks/useConnectorCapabilities';
import { api } from '@/lib/api';
import type { CapabilityState, ConnectorId } from '@/lib/connectorCapabilities';

const capabilityStateClasses: Record<CapabilityState, string> = {
  READY: 'text-success bg-success/10 border-success/25',
  CONFIG_REQUIRED: 'text-warning bg-warning/10 border-warning/25',
  OAUTH_REQUIRED: 'text-warning bg-warning/10 border-warning/25',
  BEST_EFFORT_UNSUPPORTED: 'text-paper-muted bg-void-raised border-edge',
  NOT_IMPLEMENTED: 'text-paper-faint bg-void-raised border-edge',
};

const CONNECTORS: Array<{ id: ConnectorId; icon: typeof Globe }> = [
  { id: 'rss', icon: Rss },
  { id: 'website', icon: Globe },
  { id: 'google_news_rss', icon: Newspaper },
  { id: 'newsapi', icon: Newspaper },
  { id: 'youtube', icon: Youtube },
  { id: 'facebook_page', icon: Facebook },
  { id: 'instagram_business', icon: Instagram },
  { id: 'twitter', icon: Twitter },
  { id: 'reddit', icon: MessageCircle },
  { id: 'tiktok', icon: Video },
];

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';

export default function IntegrationsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { data, loading, error, refresh } = useConnectorCapabilities();

  const authorizeMeta = async () => {
    try {
      const response = await api.post('/api/integrations/meta/auth-url');
      if (!response.data?.url) throw new Error('missing_oauth_url');
      window.location.href = response.data.url;
    } catch {
      toast.error(t('connectorContract.metaOAuthError'));
    }
  };

  const runAction = (id: ConnectorId, action: string | null) => {
    if (action === 'ADD_SOURCE') router.push('/dashboard/sources');
    if (action === 'META_OAUTH' && (id === 'facebook_page' || id === 'instagram_business')) {
      void authorizeMeta();
    }
  };

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-paper tracking-wide flex items-center gap-2">
            <Link2 className="w-6 h-6 text-signal dark:text-signal-bright" />
            {t('connectorContract.title')}
          </h1>
          <p className="text-sm text-paper-muted mt-1">{t('connectorContract.subtitle')}</p>
        </div>
        <button onClick={() => void refresh()} disabled={loading} className={`flex items-center gap-2 px-4 py-2 bg-signal text-white rounded-lg font-medium text-sm disabled:opacity-50 ${focusRing}`}>
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} />
          {t('connectorContract.refresh')}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t('connectorContract.loadError')}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CONNECTORS.map(({ id, icon: Icon }) => {
          const capability = data?.connectors[id];
          const state = capability?.state ?? 'CONFIG_REQUIRED';
          const canAct = Boolean(capability?.action_enabled && capability.action);
          return (
            <div key={id} className="bg-void-surface rounded-2xl border border-edge p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-void-raised flex items-center justify-center border border-edge">
                    <Icon className="w-6 h-6 text-paper-muted" />
                  </div>
                  <div>
                    <h2 className="font-bold text-paper">{t(`connectorContract.connectors.${id}.label`)}</h2>
                    <p className="text-xs text-paper-muted mt-0.5 max-w-sm">{t(`connectorContract.connectors.${id}.description`)}</p>
                  </div>
                </div>
                <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-eyebrow px-2.5 py-1 rounded-lg border ${capabilityStateClasses[state]}`}>
                  {t(`connectorContract.states.${state}`)}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                {state === 'READY' ? <CheckCircle2 className="w-4 h-4 text-success" /> : <AlertCircle className="w-4 h-4 text-warning" />}
                <p className="text-xs text-paper-muted">{t(`connectorContract.reasons.${capability?.reason_code ?? 'UNAVAILABLE'}`)}</p>
                {canAct && (
                  <button onClick={() => runAction(id, capability?.action ?? null)} className={`ml-auto px-3 py-2 bg-signal text-white text-xs font-bold rounded-lg ${focusRing}`}>
                    {t(`connectorContract.actions.${capability?.action}`)}
                  </button>
                )}
                {(id === 'facebook_page' || id === 'instagram_business') && (
                  <Link href="/dashboard/integrations/meta" className={`ml-auto text-xs text-signal flex items-center gap-1 ${focusRing}`}>
                    {t('connectorContract.manageMeta')} <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
              {capability && capability.missing_prerequisites.length > 0 && (
                <p className="mt-3 text-[11px] text-paper-faint">
                  {t('connectorContract.missing')}: {capability.missing_prerequisites.join(', ')}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
