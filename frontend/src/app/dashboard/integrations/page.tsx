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
  rss?: { status: string };
  tiktok?: { status: string };
  twitter?: { status: string };
}

const STATUS_LABELS: Record<string, string> = {
  READY: 'Connected',
  CONFIG_REQUIRED: 'Config required',
  CONNECT_REQUIRED: 'Connect required',
  CONNECTOR_REQUIRED: 'Connector required',
  NO_SOURCES: 'No sources',
  COMING_SOON: 'Coming soon',
};

const STATUS_COLORS: Record<string, string> = {
  READY: 'text-success bg-success/10 border-success/25',
  CONFIG_REQUIRED: 'text-warning bg-warning/10 border-warning/25',
  CONNECT_REQUIRED: 'text-destructive bg-destructive/10 border-destructive/25',
  CONNECTOR_REQUIRED: 'text-paper-faint bg-void-raised border-edge',
  NO_SOURCES: 'text-warning bg-warning/[0.06] border-warning/20',
  COMING_SOON: 'text-paper-faint bg-void-raised border-edge',
};

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';
const focusRingOffset =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void';

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
      toast.error('Lỗi tải trạng thái integrations');
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
        toast.error('Không nhận được OAuth URL từ server');
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail || '';
      if (detail.includes('cấu hình')) {
        toast.error('Config required: META_APP_ID/META_APP_SECRET chưa được cấu hình trên server');
      } else {
        toast.error(detail || 'Lỗi kết nối Meta');
      }
    }
  };

  const integrations = [
    {
      key: 'web',
      label: 'Web Search',
      icon: Globe,
      color: 'text-signal dark:text-signal-bright',
      description: 'Thu thập mentions từ toàn bộ web qua Search API.',
      action: null,
      actionLabel: null,
    },
    {
      key: 'youtube',
      label: 'YouTube',
      icon: Youtube,
      color: 'text-paper-muted',
      description: t('integrationsPage.platforms.youtube.description'),
      action: null,
      actionLabel: null,
    },
    {
      key: 'facebook',
      label: 'Facebook',
      icon: Facebook,
      color: 'text-paper-muted',
      description: 'Kết nối Facebook Page qua Meta OAuth để theo dõi bình luận.',
      action: handleMetaConnect,
      actionLabel: 'Connect',
    },
    {
      key: 'instagram',
      label: 'Instagram',
      icon: Instagram,
      color: 'text-paper-muted',
      description: 'Kết nối Instagram Business qua Meta OAuth.',
      action: handleMetaConnect,
      actionLabel: 'Connect',
    },
    {
      key: 'rss',
      label: 'RSS Feeds',
      icon: Rss,
      color: 'text-paper-muted',
      description: 'Theo dõi RSS/Atom feeds từ blog, báo điện tử.',
      action: () => router.push('/dashboard/sources'),
      actionLabel: 'Add RSS Source',
    },
    {
      key: 'twitter',
      label: 'X / Twitter',
      icon: Twitter,
      color: 'text-paper-muted',
      description: 'Thu thập tweets, threads qua X API v2.',
      action: null,
      actionLabel: null,
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      icon: Video,
      color: 'text-paper-muted',
      description: 'Chưa có connector TikTok hợp pháp khả dụng.',
      action: null,
      actionLabel: null,
      forceStatus: 'CONNECTOR_REQUIRED',
    },
    {
      key: 'podcasts',
      label: 'Podcasts',
      icon: Mic,
      color: 'text-paper-muted',
      description: 'Thu thập từ podcast platforms.',
      action: null,
      actionLabel: null,
      forceStatus: 'COMING_SOON',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-paper tracking-wide flex items-center gap-2">
            <Link2 className="w-6 h-6 text-signal dark:text-signal-bright" />
            Integrations
          </h1>
          <p className="text-sm text-paper-muted mt-1">
            Trạng thái kết nối với từng nguồn dữ liệu và nền tảng mạng xã hội.
          </p>
        </div>
        <button
          onClick={fetchCapabilities}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white rounded-lg font-medium text-sm transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 ${focusRingOffset}`}
        >
          <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-paper-muted">
          <RefreshCcw className="w-5 h-5 animate-spin mr-2" /> Đang tải trạng thái...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((intg) => {
            const capStatus = (caps as any)[intg.key]?.status || intg.forceStatus || 'CONFIG_REQUIRED';
            const status = intg.forceStatus || capStatus;
            const isReady = status === 'READY';
            const statusLabel = STATUS_LABELS[status] || status;
            const statusClass = STATUS_COLORS[status] || STATUS_COLORS.CONFIG_REQUIRED;

            return (
              <div
                key={intg.key}
                className="bg-void-surface rounded-2xl border border-edge p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-void-raised flex items-center justify-center border border-edge`}>
                      <intg.icon className={`w-6 h-6 ${intg.color}`} />
                    </div>
                    <div>
                      <h2 className="font-bold text-paper">{intg.label}</h2>
                      <p className="text-xs text-paper-muted mt-0.5 max-w-sm">{intg.description}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-eyebrow px-2.5 py-1 rounded-lg border ${statusClass}`}>
                    {statusLabel}
                  </span>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  {isReady ? (
                    <div className="flex items-center gap-1.5 text-sm font-medium text-success">
                      <CheckCircle2 className="w-4 h-4" />
                      Đang hoạt động — dữ liệu đang được thu thập
                    </div>
                  ) : intg.action && (status === 'CONNECT_REQUIRED' || status === 'NO_SOURCES') ? (
                    <button
                      onClick={intg.action}
                      className={`flex items-center gap-2 px-4 py-2 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white text-sm font-bold rounded-lg transition-colors duration-150 motion-reduce:transition-none ${focusRingOffset}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {intg.actionLabel}
                    </button>
                  ) : status === 'CONFIG_REQUIRED' ? (
                    <div className="flex items-center gap-1.5 text-xs text-warning">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Cần cấu hình API key trên server — liên hệ admin
                    </div>
                  ) : status === 'CONNECTOR_REQUIRED' ? (
                    <div className="flex items-center gap-1.5 text-xs text-paper-faint">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Không có connector hợp pháp — Connector required
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-paper-faint">
                      <Clock className="w-3.5 h-3.5" />
                      Coming soon
                    </div>
                  )}

                  {intg.key === 'facebook' || intg.key === 'instagram' ? (
                    <Link
                      href="/dashboard/integrations/meta"
                      className={`ml-auto text-xs text-signal dark:text-signal-bright hover:underline flex items-center gap-1 rounded ${focusRing}`}
                    >
                      Quản lý tài khoản <ExternalLink className="w-3 h-3" />
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
