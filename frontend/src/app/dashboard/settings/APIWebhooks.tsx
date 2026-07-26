'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Key, Plus, Copy, Eye, EyeOff, Trash2, Power, PowerOff, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '@/lib/api';
import { useDialog } from '@/components/ui/Dialog';

interface APIKey {
  id: number;
  name: string;
  prefix: string;
  permissions: string[];
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface APIKeyCreateResponse extends APIKey {
  full_key: string;
}

export default function APIWebhooks() {
  const { t } = useLanguage();
  const { confirm } = useDialog();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    name: '',
    permissions: [] as string[],
    expires_at: ''
  });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [availablePermissions] = useState([
    'mentions.read', 'mentions.write',
    'keywords.read', 'keywords.write',
    'sources.read', 'sources.write',
    'reports.read', 'alerts.read'
  ]);

  useEffect(() => {
    loadAPIKeys();
  }, []);

  const loadAPIKeys = async () => {
    try {
      const response = await api.get('/api/api-keys/');
      setApiKeys(response.data);
    } catch (error) {
      console.error('Error loading API keys:', error);
      toast.error(t('settingsPage.api.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        name: newKeyData.name,
        permissions: newKeyData.permissions,
        expires_at: newKeyData.expires_at || null
      };

      const response = await api.post('/api/api-keys/', payload);
      const data: APIKeyCreateResponse = response.data;
      setCreatedKey(data.full_key);
      toast.success(t('settingsPage.api.created'));
      loadAPIKeys();
    } catch (error: any) {
      console.error('Error creating API key:', error);
      toast.error(error.response?.data?.detail || t('settingsPage.api.errors.createFailed'));
    }
  };

  const handleRevoke = async (keyId: number) => {
    const ok = await confirm({
      title: t('settingsPage.api.revokeConfirm.title'),
      message: t('settingsPage.api.revokeConfirm.message'),
      variant: 'danger'
    });
    if (!ok) return;

    try {
      await api.delete(`/api/api-keys/${keyId}`);
      toast.success(t('settingsPage.api.revoked'));
      loadAPIKeys();
    } catch (error) {
      console.error('Error revoking API key:', error);
      toast.error(t('settingsPage.api.errors.revokeFailed'));
    }
  };

  const handleToggleActive = async (keyId: number, currentStatus: boolean) => {
    try {
      const action = currentStatus ? 'deactivate' : 'activate';
      await api.post(`/api/api-keys/${keyId}/${action}`);
      toast.success(currentStatus ? t('settingsPage.api.deactivated') : t('settingsPage.api.activated'));
      loadAPIKeys();
    } catch (error) {
      console.error('Error toggling API key:', error);
      toast.error(t('settingsPage.api.errors.toggleFailed'));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t('settingsPage.api.copied'));
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return t('settingsPage.api.noExpiry');
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin motion-reduce:animate-none rounded-full h-8 w-8 border-b-2 border-signal"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-paper tracking-wide">{t('settingsPage.api.title')}</h2>
          <p className="text-sm text-paper-muted mt-1">{t('settingsPage.api.subtitle')}</p>
        </div>
        <button 
          onClick={() => {
            setShowModal(true);
            setCreatedKey(null);
            setNewKeyData({ name: '', permissions: [], expires_at: '' });
          }}
          className="flex items-center px-6 py-2.5 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
        >
          <Plus className="w-5 h-5 mr-2" />
          {t('settingsPage.api.create')}
        </button>
      </div>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <div className="text-center py-12 bg-void-surface border border-edge rounded-xl shadow-sm">
            <Key className="w-12 h-12 mx-auto text-paper-faint mb-3" />
            <p className="text-paper-muted font-medium tracking-wide">{t('settingsPage.api.empty.title')}</p>
            <p className="text-sm text-paper-muted mt-1">{t('settingsPage.api.empty.desc')}</p>
          </div>
        ) : (
          apiKeys.map((key) => (
            <div key={key.id} className={`bg-void-surface border border-edge rounded-xl p-5 shadow-sm transition-opacity motion-reduce:transition-none ${!key.is_active ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-signal/10 border border-signal/25 rounded-lg">
                      <Key className="w-4 h-4 text-signal dark:text-signal-bright" />
                    </div>
                    <h3 className="font-bold text-paper tracking-wide">{key.name}</h3>
                    {!key.is_active && (
                      <span className="px-2.5 py-1 text-xs font-medium bg-void-raised text-paper-faint border border-edge rounded-md">
                        {t('settingsPage.api.inactive')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 mb-4">
                    <code className="px-4 py-1.5 bg-void-raised border border-edge-strong text-paper-muted rounded-lg text-sm font-mono tracking-wider">
                      {key.prefix}••••••••
                    </code>
                    <button
                      onClick={() => copyToClipboard(key.prefix)}
                      className="p-1.5 text-paper-faint hover:text-signal dark:hover:text-signal-bright hover:bg-signal/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                      title={t('settingsPage.api.copyPrefix')}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-5 text-xs text-paper-muted font-medium">
                    <span className="flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-paper-faint" />
                      {t('settingsPage.api.createdAt')} {formatDate(key.created_at)}
                    </span>
                    {key.expires_at && (
                      <span className="flex items-center text-warning/80">
                        <Calendar className="w-3.5 h-3.5 mr-1.5" />
                        {t('settingsPage.api.expiresAt')} {formatDate(key.expires_at)}
                      </span>
                    )}
                    {key.last_used_at && (
                      <span className="flex items-center text-signal/80 dark:text-signal-bright/80">
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        {t('settingsPage.api.lastUsed')} {formatDate(key.last_used_at)}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-edge">
                    <p className="text-xs font-medium text-paper-muted mb-2.5">{t('settingsPage.api.permissionsCount', { count: key.permissions.length })}</p>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(key.permissions) && key.permissions.slice(0, 5).map((perm, idx) => (
                        <span key={idx} className="px-2.5 py-1 text-[11px] font-medium bg-void-raised text-paper-muted border border-edge rounded-md uppercase tracking-wider">
                          {perm}
                        </span>
                      ))}
                      {key.permissions.length > 5 && (
                        <span className="px-2.5 py-1 text-[11px] font-medium bg-void-raised text-paper-faint border border-edge rounded-md tabular-nums">
                          +{key.permissions.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2 ml-4">
                  <button
                    onClick={() => handleToggleActive(key.id, key.is_active)}
                    className={`p-2 rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 ${key.is_active ? 'text-warning hover:bg-warning/10' : 'text-success hover:bg-success/10'}`}
                    title={key.is_active ? t('settingsPage.api.deactivate') : t('settingsPage.api.activate')}
                  >
                    {key.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleRevoke(key.id)}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                    title={t('settingsPage.api.revoke')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-void-surface border border-edge rounded-2xl shadow-tile max-w-lg w-full">
            <div className="p-6 border-b border-edge">
              <h3 className="text-lg font-bold text-paper tracking-wide">
                {createdKey ? t('settingsPage.api.modal.createdTitle') : t('settingsPage.api.modal.newTitle')}
              </h3>
            </div>

            {createdKey ? (
              <div className="p-6 space-y-6">
                <div className="bg-warning/10 border border-warning/25 rounded-xl p-5">
                  <p className="text-sm text-warning font-bold tracking-wide mb-2 flex items-center">
                    <span className="mr-2">⚠️</span> {t('settingsPage.api.modal.warningTitle')}
                  </p>
                  <p className="text-sm text-paper-muted">
                    {t('settingsPage.api.modal.warningBody')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-3">
                    {t('settingsPage.api.modal.yourKey')}
                  </label>
                  <div className="flex items-center space-x-3">
                    <code className="flex-1 px-4 py-3 bg-void-raised border border-signal/25 text-signal dark:text-signal-bright rounded-xl text-sm font-mono break-all tracking-wider">
                      {createdKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdKey)}
                      className="p-3 text-signal dark:text-signal-bright hover:bg-signal/10 rounded-xl transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-signal/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                      title={t('settingsPage.api.copy')}
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setCreatedKey(null);
                    }}
                    className="px-6 py-2.5 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                  >
                    {t('settingsPage.api.close')}
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('settingsPage.api.form.name')} <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={newKeyData.name}
                    onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                    placeholder={t('settingsPage.api.form.namePlaceholder')}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('settingsPage.api.form.permissions')}
                  </label>
                  <div className="border border-edge bg-void-raised rounded-xl p-4 max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                      {availablePermissions.map((perm) => (
                        <label key={perm} className="flex items-center space-x-3 cursor-pointer group p-1.5 hover:bg-paper/[0.04] rounded-lg transition-colors duration-150 motion-reduce:transition-none">
                          <input
                            type="checkbox"
                            checked={newKeyData.permissions.includes(perm)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewKeyData({ ...newKeyData, permissions: [...newKeyData.permissions, perm] });
                              } else {
                                setNewKeyData({ ...newKeyData, permissions: newKeyData.permissions.filter(p => p !== perm) });
                              }
                            }}
                            className="w-4 h-4 rounded accent-signal bg-void-surface border-edge-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                          />
                          <span className="text-sm font-medium text-paper-muted group-hover:text-paper transition-colors duration-150 motion-reduce:transition-none">{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('settingsPage.api.form.expiresAt')}
                  </label>
                  <input
                    type="datetime-local"
                    value={newKeyData.expires_at}
                    onChange={(e) => setNewKeyData({ ...newKeyData, expires_at: e.target.value })}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl text-paper dark:[color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-6 border-t border-edge">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-6 py-2.5 bg-void-surface text-paper-muted border border-edge-strong rounded-xl hover:bg-void-raised hover:text-paper transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-signal text-white rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                  >
                    {t('settingsPage.api.create')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-signal/10 border border-signal/25 rounded-xl p-4">
        <p className="text-sm text-paper-muted">
          <strong className="text-signal dark:text-signal-bright">{t('settingsPage.api.noteLabel')}</strong>{' '}
          {t('settingsPage.api.note')}
        </p>
      </div>
    </div>
  );
}
