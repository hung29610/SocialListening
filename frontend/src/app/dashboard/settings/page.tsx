'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Shield, Building, Mail, Bell, Globe, Palette, FileText, User as UserIcon, Lock, Monitor, Settings } from 'lucide-react';
import { auth } from '@/lib/api';
import { canAccessAdmin, type User } from '@/lib/permissions';
import LoadingSpinner from '@/components/LoadingSpinner';
import PersonalProfile from './PersonalProfile';
import SecuritySettings from './SecuritySettings';
import PersonalNotifications from './PersonalNotifications';
import AppearanceSettings from './AppearanceSettings';
import SessionsSettings from './SessionsSettings';
import UserManagement from './UserManagement';
import RoleManagement from './RoleManagement';
import OrganizationSettings from './OrganizationSettings';
import EmailSettings from './EmailSettings';
import NotificationSettings from './NotificationSettings';
import APIWebhooks from './APIWebhooks';
import BrandingSettings from './BrandingSettings';
import AuditLogs from './AuditLogs';
import TestInteractive from './test-interactive';

type TabId = 'profile' | 'security' | 'personal-notifications' | 'appearance' | 'sessions' | 
             'users' | 'permissions' | 'organization' | 'email' | 'system-notifications' | 'api' | 'branding' | 'logs' | 'test';

interface Tab {
  id: TabId;
  name: string;
  icon: any;
  description: string;
  adminOnly?: boolean;
}

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isAdmin = canAccessAdmin(user);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          router.push('/login');
          return;
        }

        const userData = await auth.getCurrentUser();
        setUser(userData);
        setLoading(false);
      } catch (error) {
        console.error('Failed to get user:', error);
        setLoading(false);
      }
    };

    checkAccess();
  }, [router]);

  // Block access to admin tabs for normal users
  useEffect(() => {
    const adminTabs: TabId[] = ['users', 'permissions', 'organization', 'email', 'system-notifications', 'api', 'branding', 'logs'];
    if (!loading && !isAdmin && adminTabs.includes(activeTab)) {
      setActiveTab('profile');
    }
  }, [activeTab, isAdmin, loading]);

  if (loading) {
    return <LoadingSpinner message="Đang tải cài đặt..." />;
  }

  // Personal settings tabs - available to all users
  const personalTabs: Tab[] = [
    { id: 'test', name: '🧪 TEST', icon: FileText, description: 'Test interactive' },
    { id: 'profile', name: 'Hồ sơ cá nhân', icon: UserIcon, description: 'Thông tin cá nhân' },
    { id: 'security', name: 'Bảo mật', icon: Lock, description: 'Mật khẩu và bảo mật' },
    { id: 'personal-notifications', name: 'Thông báo', icon: Bell, description: 'Thông báo cá nhân' },
    { id: 'appearance', name: 'Giao diện', icon: Palette, description: 'Tùy chỉnh giao diện' },
    { id: 'sessions', name: 'Phiên đăng nhập', icon: Monitor, description: 'Quản lý phiên' },
  ];

  // Admin settings tabs - only for admin/super_admin
  const adminTabs: Tab[] = [
    { id: 'users', name: 'Quản lý người dùng', icon: Users, description: 'Thêm, sửa, xóa người dùng', adminOnly: true },
    { id: 'permissions', name: 'Quản lý quyền', icon: Shield, description: 'Phân quyền và vai trò', adminOnly: true },
    { id: 'organization', name: 'Thông tin tổ chức', icon: Building, description: 'Cấu hình công ty', adminOnly: true },
    { id: 'email', name: 'Cấu hình Email', icon: Mail, description: 'SMTP và templates', adminOnly: true },
    { id: 'system-notifications', name: 'Thông báo hệ thống', icon: Bell, description: 'Cài đặt thông báo', adminOnly: true },
    { id: 'api', name: 'API & Webhooks', icon: Globe, description: 'API keys và webhooks', adminOnly: true },
    { id: 'branding', name: 'Giao diện hệ thống', icon: Palette, description: 'Logo và màu sắc', adminOnly: true },
    { id: 'logs', name: 'Audit Logs', icon: FileText, description: 'Lịch sử hoạt động', adminOnly: true },
  ];

  // Combine tabs based on role
  const allTabs = isAdmin ? [...personalTabs, ...adminTabs] : personalTabs;

  const renderTabContent = () => {
    // Block admin tabs for normal users
    const adminTabs: TabId[] = ['users', 'permissions', 'organization', 'email', 'system-notifications', 'api', 'branding', 'logs'];
    if (!isAdmin && adminTabs.includes(activeTab)) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <Shield className="w-12 h-12 mx-auto mb-4 text-red-600" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Không có quyền truy cập</h3>
          <p className="text-red-700">Bạn không có quyền truy cập chức năng quản trị này.</p>
        </div>
      );
    }

    switch (activeTab) {
      // Test tab
      case 'test':
        return <TestInteractive />;
      
      // Personal settings
      case 'profile':
        return <PersonalProfile />;
      case 'security':
        return <SecuritySettings />;
      case 'personal-notifications':
        return <PersonalNotifications />;
      case 'appearance':
        return <AppearanceSettings />;
      case 'sessions':
        return <SessionsSettings />;
      
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
      case 'api':
        return <APIWebhooks />;
      case 'branding':
        return <BrandingSettings />;
      case 'logs':
        return <AuditLogs />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header with gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative px-8 py-12">
          <div className="flex items-center space-x-4 mb-4">
            <div className="p-3 bg-white bg-opacity-20 rounded-xl backdrop-blur-sm">
              <Settings className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">
                {isAdmin ? '⚙️ Cài đặt' : '👤 Cài đặt cá nhân'}
              </h1>
              <p className="mt-2 text-blue-100 text-lg">
                {isAdmin 
                  ? 'Quản lý cấu hình cá nhân, người dùng và hệ thống'
                  : 'Quản lý thông tin cá nhân, bảo mật và tùy chọn hiển thị'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs with modern design */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="border-b border-gray-100">
          <nav className="flex overflow-x-auto -mb-px scrollbar-hide">
            {/* Personal Settings Group */}
            {personalTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex items-center px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 mr-2 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                  {tab.name}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                  )}
                </button>
              );
            })}

            {/* Admin Settings Group - Only for admin */}
            {isAdmin && (
              <>
                <div className="border-l border-gray-200 mx-2 my-3" />
                {adminTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`group relative flex items-center px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-all duration-200 ${
                        isActive
                          ? 'border-purple-500 text-purple-600 bg-purple-50'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mr-2 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
                      {tab.name}
                      {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500"></div>
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
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
        <FileText className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500">Tính năng này đang được phát triển</p>
    </div>
  );
}
