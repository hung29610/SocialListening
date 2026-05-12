'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Shield, Building, Mail, Bell, Globe, Palette, FileText } from 'lucide-react';
import { auth } from '@/lib/api';
import { canAccessAdmin, type User } from '@/lib/permissions';
import LoadingSpinner from '@/components/LoadingSpinner';
import Forbidden from '@/components/Forbidden';
import UserManagement from './UserManagement';
import RoleManagement from './RoleManagement';
import OrganizationSettings from './OrganizationSettings';
import EmailSettings from './EmailSettings';
import NotificationSettings from './NotificationSettings';

type TabId = 'users' | 'permissions' | 'organization' | 'email' | 'notifications' | 'api' | 'branding' | 'logs';

interface Tab {
  id: TabId;
  name: string;
  icon: any;
  description: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('users');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <LoadingSpinner message="Đang kiểm tra quyền truy cập..." />;
  }

  // Check if user has admin access
  if (!canAccessAdmin(user)) {
    return <Forbidden message="Chỉ quản trị viên mới có thể truy cập trang Cài đặt." />;
  }

  const tabs: Tab[] = [
    { id: 'users', name: 'Quản lý người dùng', icon: Users, description: 'Thêm, sửa, xóa người dùng' },
    { id: 'permissions', name: 'Quản lý quyền', icon: Shield, description: 'Phân quyền và vai trò' },
    { id: 'organization', name: 'Thông tin tổ chức', icon: Building, description: 'Cấu hình công ty' },
    { id: 'email', name: 'Cấu hình Email', icon: Mail, description: 'SMTP và templates' },
    { id: 'notifications', name: 'Thông báo', icon: Bell, description: 'Cài đặt thông báo' },
    { id: 'api', name: 'API & Webhooks', icon: Globe, description: 'API keys và webhooks' },
    { id: 'branding', name: 'Giao diện', icon: Palette, description: 'Logo và màu sắc' },
    { id: 'logs', name: 'Audit Logs', icon: FileText, description: 'Lịch sử hoạt động' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />;
      case 'permissions':
        return <RoleManagement />;
      case 'organization':
        return <OrganizationSettings />;
      case 'email':
        return <EmailSettings />;
      case 'notifications':
        return <NotificationSettings />;
      case 'api':
        return <ComingSoon title="API & Webhooks" />;
      case 'branding':
        return <ComingSoon title="Giao diện & Branding" />;
      case 'logs':
        return <ComingSoon title="Audit Logs" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">⚙️ Cài đặt</h1>
        <p className="mt-2 text-gray-600">Quản lý cấu hình hệ thống và người dùng</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
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
