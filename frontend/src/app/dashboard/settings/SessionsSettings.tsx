'use client';

import { useState, useEffect } from 'react';
import { Clock, Monitor, LogOut, AlertCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDialog } from '@/components/ui/Dialog';
import { api } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

interface Session {
  id: number;
  device_type: string;
  ip_address: string | null;
  user_agent: string | null;
  location: string | null;
  created_at: string;
  last_active_at: string;
  expires_at: string;
}

export default function SessionsSettings() {
  const { t } = useLanguage();
  const { confirm } = useDialog();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<number | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await api.get('/api/auth/me/sessions');
      const data = response.data;
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      toast.error(t('settingsPage.sessions.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const revokeSession = async (sessionId: number) => {
    if (revoking) return;

    const ok = await confirm({
      title: t('settingsPage.sessions.revokeTitle'),
      message: t('settingsPage.sessions.revokeMessage'),
      variant: 'warning'
    });
    if (!ok) {
      return;
    }

    setRevoking(sessionId);
    try {
      await api.post(`/api/auth/me/sessions/${sessionId}/revoke`);
      toast.success(`✅ ${t('settingsPage.sessions.revokeSuccess')}`);
      loadSessions(); // Reload sessions
    } catch (error: any) {
      console.error('Failed to revoke session:', error);
      toast.error(error.response?.data?.detail || t('settingsPage.sessions.errors.revokeFailed'));
    } finally {
      setRevoking(null);
    }
  };

  const logoutAllOtherSessions = async () => {
    const ok = await confirm({
      title: t('settingsPage.sessions.logoutAllTitle'),
      message: t('settingsPage.sessions.logoutAllMessage'),
      variant: 'warning'
    });
    if (!ok) {
      return;
    }

    try {
      await api.post('/api/auth/me/logout-other-sessions');
      toast.success(`✅ ${t('settingsPage.sessions.logoutAllSuccess')}`);
      loadSessions(); // Reload sessions
    } catch (error: any) {
      console.error('Failed to logout other sessions:', error);
      toast.error(error.response?.data?.detail || t('settingsPage.sessions.errors.logoutAllFailed'));
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('vi-VN');
    } catch {
      return 'N/A';
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return '📱';
      case 'tablet':
        return '📱';
      case 'desktop':
        return '💻';
      default:
        return '🖥️';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{t('settingsPage.sessions.title')}</h2>
        <p className="text-sm text-gray-600 mt-1">{t('settingsPage.sessions.subtitle')}</p>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-yellow-900 mb-2">
                {t('settingsPage.sessions.emptyTitle')}
              </h3>
              <p className="text-sm text-yellow-800">
                {t('settingsPage.sessions.emptyDesc')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Logout All Button */}
          <div className="flex justify-end">
            <button
              onClick={logoutAllOtherSessions}
              className="flex items-center px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('settingsPage.sessions.logoutAllOthers')}
            </button>
          </div>

          {/* Sessions */}
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="text-3xl">
                      {getDeviceIcon(session.device_type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {session.device_type === 'unknown' ? t('settingsPage.sessions.unknownDevice') : session.device_type}
                      </p>
                      {session.user_agent && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                          {session.user_agent}
                        </p>
                      )}
                      {session.ip_address && (
                        <p className="text-xs text-gray-500 mt-1">
                          IP: {session.ip_address}
                        </p>
                      )}
                      {session.location && (
                        <p className="text-xs text-gray-500 mt-1">
                          📍 {session.location}
                        </p>
                      )}
                      <div className="flex items-center mt-2 text-xs text-gray-500 space-x-4">
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {t('settingsPage.sessions.loggedInAt')} {formatDate(session.created_at)}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {t('settingsPage.sessions.lastActive')} {formatDate(session.last_active_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => revokeSession(session.id)}
                    disabled={revoking === session.id}
                    className="flex items-center px-3 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-4"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {revoking === session.id ? t('settingsPage.sessions.revoking') : t('settingsPage.sessions.logout')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>{t('settingsPage.sessions.noteLabel')}</strong> {t('settingsPage.sessions.note')}
        </p>
      </div>
    </div>
  );
}
