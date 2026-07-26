'use client';

import { useState, useEffect } from 'react';
import { Shield, Facebook, Instagram, CheckCircle2, XCircle, Loader2, ArrowLeft, Plug, LogOut, CheckSquare, Square } from 'lucide-react';
import Link from 'next/link';
import { useDialog } from '@/components/ui/Dialog';
import { useLanguage } from '@/contexts/LanguageContext';

interface MetaAccount {
  id: number;
  external_id: string;
  provider: string;
  account_type: string;
  name: string;
  selected: boolean;
}

interface MetaStatus {
  status: 'config_required' | 'oauth_required' | 'limited' | 'active';
  label: string;
  message: string;
  granted_scopes: string[];
  missing_scopes: string[];
  accounts: MetaAccount[];
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';
const focusRingOffset =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void';

export default function MetaIntegrationPage() {
  const { confirm } = useDialog();
  const { t } = useLanguage();
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Using relative URLs to proxy through Next.js rewrites

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/integrations/meta/status`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setMetaStatus(data);
    } catch (err) {
      console.error(err);
      setError(t('landing.metaIntegration.errors.serverConnection'));
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/integrations/meta/auth-url`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(t('landing.metaIntegration.errors.noConnectUrl'));
        setActionLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError(t('landing.metaIntegration.errors.apiCall'));
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: t('landing.metaIntegration.disconnectTitle'),
      message: t('landing.metaIntegration.disconnectConfirm'),
      variant: 'danger'
    });
    if (!ok) return;
    try {
      setActionLoading(true);
      await fetch(`/api/integrations/meta/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      await fetchStatus();
      setSuccessMsg(t('landing.metaIntegration.disconnected'));
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setError(t('landing.metaIntegration.errors.disconnect'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAccount = async (accountId: string, currentSelected: boolean) => {
    try {
      const res = await fetch(`/api/integrations/meta/select-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ account_id: accountId, selected: !currentSelected })
      });
      if (res.ok) {
        // Update local state smoothly
        setMetaStatus(prev => prev ? {
          ...prev,
          accounts: prev.accounts.map(acc =>
            acc.external_id === accountId ? { ...acc, selected: !currentSelected } : acc
          )
        } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestConnection = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/integrations/meta/test-connection`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(t('landing.metaIntegration.testOk'));
      } else {
        setError(data.message || t('landing.metaIntegration.errors.connectionFailed'));
      }
      setTimeout(() => { setSuccessMsg(''); setError(''); }, 3000);
    } catch (err) {
      console.error(err);
      setError(t('landing.metaIntegration.errors.testFailed'));
      setTimeout(() => setError(''), 3000);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Link href="/dashboard/sources" className={`inline-flex items-center text-sm font-medium text-paper-muted hover:text-paper mb-6 transition-colors duration-150 motion-reduce:transition-none rounded ${focusRing}`}>
        <ArrowLeft className="w-4 h-4 mr-2" /> {t('landing.metaIntegration.backToSources')}
      </Link>

      <div className="bg-void-surface border border-edge rounded-3xl overflow-hidden shadow-tile">
        <div className="p-8 border-b border-edge bg-void-raised relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-signal/50" />
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-signal/10 rounded-2xl border border-signal/25">
              <Facebook className="w-8 h-8 text-signal dark:text-signal-bright" />
            </div>
            <div className="p-3 bg-signal/10 rounded-2xl border border-signal/25">
              <Instagram className="w-8 h-8 text-signal dark:text-signal-bright" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-paper mb-2 tracking-tight">{t('landing.metaIntegration.title')}</h1>
          <p className="text-paper-muted max-w-2xl leading-relaxed">
            {t('landing.metaIntegration.introBefore')}{' '}
            <strong>{t('landing.metaIntegration.introStrong')}</strong>{' '}
            {t('landing.metaIntegration.introAfter')}
          </p>
        </div>

        <div className="p-8 space-y-8">
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/25 rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="text-destructive text-sm">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-success/10 border border-success/25 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
              <div className="text-success text-sm">{successMsg}</div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 text-signal dark:text-signal-bright animate-spin" />
            </div>
          ) : metaStatus ? (
            <>
              {/* Status Section */}
              <div className="bg-void-raised border border-edge rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-paper mb-1">{t('landing.metaIntegration.connectionStatus')}</h2>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-eyebrow ${
                        metaStatus.status === 'active' ? 'bg-success/10 text-success border border-success/25'
                        : metaStatus.status === 'limited' ? 'bg-warning/10 text-warning border border-warning/25'
                        : 'bg-paper-faint/10 text-paper-muted border border-paper-faint/20'
                      }`}>
                        {metaStatus.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {(metaStatus.status === 'active' || metaStatus.status === 'limited') ? (
                      <>
                        <button
                          onClick={handleTestConnection}
                          disabled={actionLoading}
                          className={`flex-1 sm:flex-none px-4 py-2 bg-signal/10 hover:bg-signal/20 text-signal dark:text-signal-bright border border-signal/25 rounded-xl text-sm font-medium transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 ${focusRing}`}
                        >
                          {t('landing.metaIntegration.testConnection')}
                        </button>
                        <button
                          onClick={handleDisconnect}
                          disabled={actionLoading}
                          className={`flex-1 sm:flex-none px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/25 rounded-xl text-sm font-medium transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 flex items-center justify-center gap-2 ${focusRing}`}
                        >
                          <LogOut className="w-4 h-4" /> {t('landing.metaIntegration.disconnect')}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleConnect}
                        disabled={actionLoading || metaStatus.status === 'config_required'}
                        className={`w-full sm:w-auto px-6 py-2.5 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white rounded-xl text-sm font-medium transition-colors duration-150 motion-reduce:transition-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${focusRingOffset}`}
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                        {t('landing.metaIntegration.connectCta')}
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-sm text-paper-muted mt-2 bg-paper/[0.04] p-3 rounded-xl border border-edge">
                  <Shield className="w-4 h-4 inline-block mr-1 text-paper-faint" />
                  {metaStatus.message}
                </p>
              </div>

              {/* Permissions Section */}
              {(metaStatus.status === 'active' || metaStatus.status === 'limited') && (
                <div className="bg-void-raised border border-edge rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-paper mb-4">{t('landing.metaIntegration.grantedScopes')}</h2>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {metaStatus.granted_scopes.map((scope, idx) => (
                      <span key={idx} className="px-3 py-1 bg-success/10 border border-success/25 text-success text-xs rounded-lg flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {scope}
                      </span>
                    ))}
                    {metaStatus.missing_scopes.map((scope, idx) => (
                      <span key={idx} className="px-3 py-1 bg-destructive/10 border border-destructive/25 text-destructive text-xs rounded-lg flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> {scope} {t('landing.metaIntegration.missingScopeSuffix')}
                      </span>
                    ))}
                  </div>
                  {metaStatus.missing_scopes.length > 0 && (
                    <p className="text-xs text-warning mt-2">
                      ⚠️ {t('landing.metaIntegration.missingScopesWarning')}
                    </p>
                  )}
                </div>
              )}

              {/* Accounts Section */}
              {(metaStatus.status === 'active' || metaStatus.status === 'limited') && (
                <div className="bg-void-raised border border-edge rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-paper">{t('landing.metaIntegration.accountsAndPages')}</h2>
                    <span className="text-xs text-paper-muted">{t('landing.metaIntegration.selectSourcesHint')}</span>
                  </div>

                  {metaStatus.accounts.length === 0 ? (
                    <div className="text-center py-8 text-paper-faint text-sm bg-paper/[0.04] rounded-xl border border-edge">
                      {t('landing.metaIntegration.noAccounts')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {metaStatus.accounts.map(acc => (
                        <div
                          key={acc.id}
                          onClick={() => handleToggleAccount(acc.external_id, acc.selected)}
                          className={`p-4 rounded-xl border transition-colors duration-150 motion-reduce:transition-none cursor-pointer flex items-center gap-4 ${
                            acc.selected ? 'bg-signal/10 border-signal/25' : 'bg-void-surface border-edge hover:border-edge-strong'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {acc.provider === 'facebook' ? (
                              <div className="w-10 h-10 rounded-full bg-signal/10 flex items-center justify-center border border-signal/25">
                                <Facebook className="w-5 h-5 text-signal dark:text-signal-bright" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-signal/10 flex items-center justify-center border border-signal/25">
                                <Instagram className="w-5 h-5 text-signal dark:text-signal-bright" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-paper truncate">{acc.name}</h3>
                            <p className="text-xs text-paper-faint uppercase tracking-eyebrow">{acc.account_type}</p>
                          </div>
                          <div>
                            {acc.selected ? (
                              <CheckSquare className="w-5 h-5 text-signal dark:text-signal-bright" />
                            ) : (
                              <Square className="w-5 h-5 text-paper-faint" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
