'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Shield, Building, Mail, Bell, Globe, Palette, FileText, User as UserIcon, Lock, Monitor, Settings, Sparkles } from 'lucide-react';
import { auth } from '@/lib/api';
import { canAccessAdmin, type User } from '@/lib/permissions';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useLanguage } from '@/contexts/LanguageContext';
import PersonalProfile from './PersonalProfile';
import SecuritySettings from './SecuritySettings';
import PersonalNotifications from './PersonalNotifications';
import UserManagement from './UserManagement';
import RoleManagement from './RoleManagement';
import OrganizationSettings from './OrganizationSettings';
import EmailSettings from './EmailSettings';
import NotificationSettings from './NotificationSettings';
import NotificationDeliveries from './NotificationDeliveries';
import APIWebhooks from './APIWebhooks';
import BrandingSettings from './BrandingSettings';
import AuditLogs from './AuditLogs';
import AIModelSettings from './AIModelSettings';

type TabId = 'profile' | 'security' | 'personal-notifications' | 
             'users' | 'permissions' | 'organization' | 'email' | 'system-notifications' | 'delivery-logs' | 'api' | 'branding' | 'logs' | 'ai-model';

interface Tab {
  id: TabId;
  name: string;
  icon: any;
  description: string;
  adminOnly?: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = canAccessAdmin(user);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          router.replace('/login');
          return;
        }

        const userData = await auth.getCurrentUser();
        setUser(userData);
        setLoading(false);
      } catch (error) {
        console.error('Failed to get user:', error);
        localStorage.removeItem('access_token');
        localStorage.removeItem('cached_user');
        router.replace('/login?expired=1');
        setLoading(false);
      }
    };

    checkAccess();
  }, [router]);

  // Block access to admin tabs for normal users
  useEffect(() => {
    const adminTabs: TabId[] = ['users', 'permissions', 'organization', 'email', 'system-notifications', 'delivery-logs', 'api', 'branding', 'logs', 'ai-model'];
    if (!loading && !isAdmin && adminTabs.includes(activeTab)) {
      setActiveTab('profile');
    }
  }, [activeTab, isAdmin, loading]);

  if (loading) {
    return <LoadingSpinner message={t('settings.loading')} />;
  }

  // Personal settings tabs - available to all users
  const personalTabs: Tab[] = [
    { id: 'profile', name: t('settings.tabs.profile'), icon: UserIcon, description: t('settings.tabs.profileDesc') },
    { id: 'security', name: t('settings.tabs.security'), icon: Lock, description: t('settings.tabs.securityDesc') },
    { id: 'personal-notifications', name: t('settings.tabs.personalNotifications'), icon: Bell, description: t('settings.tabs.personalNotificationsDesc') },
  ];

  // Admin settings tabs - only for admin/super_admin
  const adminTabs: Tab[] = [
    { id: 'users', name: t('settings.tabs.users'), icon: Users, description: t('settings.tabs.usersDesc'), adminOnly: true },
    { id: 'permissions', name: t('settings.tabs.permissions'), icon: Shield, description: t('settings.tabs.permissionsDesc'), adminOnly: true },
    { id: 'organization', name: t('settings.tabs.organization'), icon: Building, description: t('settings.tabs.organizationDesc'), adminOnly: true },
    { id: 'email', name: t('settings.tabs.email'), icon: Mail, description: t('settings.tabs.emailDesc'), adminOnly: true },
    { id: 'system-notifications', name: t('settings.tabs.systemNotifications'), icon: Bell, description: t('settings.tabs.systemNotificationsDesc'), adminOnly: true },
    { id: 'delivery-logs', name: t('settings.tabs.deliveryLogs'), icon: Mail, description: t('settings.tabs.deliveryLogsDesc'), adminOnly: true },
    { id: 'api', name: t('settings.tabs.api'), icon: Globe, description: t('settings.tabs.apiDesc'), adminOnly: true },
    { id: 'branding', name: t('settings.tabs.branding'), icon: Palette, description: t('settings.tabs.brandingDesc'), adminOnly: true },
    { id: 'logs', name: t('settings.tabs.logs'), icon: FileText, description: t('settings.tabs.logsDesc'), adminOnly: true },
    { id: 'ai-model', name: t('settings.tabs.aiModel'), icon: Sparkles, description: t('settings.tabs.aiModelDesc'), adminOnly: true },
  ];

  // Combine tabs based on role
  const allTabs = isAdmin ? [...personalTabs, ...adminTabs] : personalTabs;

  const renderTabContent = () => {
    // Block admin tabs for normal users
    const adminTabs: TabId[] = ['users', 'permissions', 'organization', 'email', 'system-notifications', 'delivery-logs', 'api', 'branding', 'logs', 'ai-model'];
    if (!isAdmin && adminTabs.includes(activeTab)) {
      return (
        <div className="bg-destructive/10 border border-destructive/25 rounded-xl p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold text-destructive mb-2">{t('settings.noAccessTitle')}</h3>
          <p className="text-destructive/80">{t('settings.noAccessDesc')}</p>
        </div>
      );
    }

    switch (activeTab) {
      // Personal settings
      case 'profile':
        return <PersonalProfile />;
      case 'security':
        return <SecuritySettings />;
      case 'personal-notifications':
        return <PersonalNotifications />;
      
      // Admin settings
      case 'users':
        return <UserManagement />;
      case 'permissions':
        return <RoleManagement />;
      case 'organization':
        return <OrganizationSettings />;
      case 'email':
        return <EmailSettings />;
      case 'system-notifications':
        return <NotificationSettings />;
      case 'delivery-logs':
        return <NotificationDeliveries />;
      case 'api':
        return <APIWebhooks />;
      case 'branding':
        return <BrandingSettings />;
      case 'logs':
        return <AuditLogs />;
      case 'ai-model':
        return <AIModelSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden bg-void-surface border border-edge rounded-2xl shadow-tile">
        <div className="relative px-8 py-10">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-signal/10 border border-signal/25 rounded-xl">
              <Settings className="w-8 h-8 text-signal dark:text-signal-bright" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-paper tracking-wide">
                {isAdmin ? t('settings.title') : t('settings.personalTitle')}
              </h1>
              <p className="mt-2 text-paper-muted">
                {isAdmin 
                  ? t('settings.subtitleAdmin')
                  : t('settings.subtitlePersonal')
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-void-surface border border-edge rounded-2xl shadow-tile overflow-hidden">
        <div className="border-b border-edge">
          <nav className="flex overflow-x-auto -mb-px pb-2">
            {/* Personal Settings Group */}
            {personalTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex items-center px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 ${
                    isActive
                      ? 'border-signal text-signal dark:text-signal-bright bg-signal/[0.06]'
                      : 'border-transparent text-paper-muted hover:text-paper hover:bg-paper/[0.04]'
                  }`}
                >
                  <Icon className={`w-5 h-5 mr-2 transition-transform duration-200 motion-reduce:transition-none ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                  {tab.name}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-signal"></div>
                  )}
                </button>
              );
            })}

            {/* Admin Settings Group - Only for admin */}
            {isAdmin && (
              <>
                <div className="border-l border-edge mx-2 my-3" />
                {adminTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`group relative flex items-center px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors duration-200 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 ${
                        isActive
                          ? 'border-signal text-signal dark:text-signal-bright bg-signal/[0.06]'
                          : 'border-transparent text-paper-muted hover:text-paper hover:bg-paper/[0.04]'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mr-2 transition-transform duration-200 motion-reduce:transition-none ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                      {tab.name}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-signal"></div>
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </nav>
        </div>

        {/* Tab Content with animation */}
        <div className="p-8 animate-fadeIn">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  const { t } = useLanguage();
  return (
    <div className="text-center py-12 bg-void-surface border border-edge rounded-xl">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-void-raised border border-edge-strong mb-4">
        <FileText className="w-8 h-8 text-paper-faint" />
      </div>
      <h3 className="text-lg font-medium text-paper mb-2">{title}</h3>
      <p className="text-paper-muted">{t('settingsPage.comingSoon.description')}</p>
    </div>
  );
}
