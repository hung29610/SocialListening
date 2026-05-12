'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { canAccessAdmin, type User } from '@/lib/permissions';
import { 
  LayoutDashboard, 
  Key, 
  Globe, 
  FileText, 
  Bell, 
  AlertTriangle, 
  LogOut,
  Menu,
  X,
  Settings,
  Briefcase
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check token first
        const token = localStorage.getItem('access_token');
        if (!token) {
          console.log('No token, redirecting to login');
          router.push('/login');
          return;
        }

        // Try to get user info
        const userData = await auth.getCurrentUser();
        setUser(userData);
        setLoading(false);
      } catch (error) {
        console.error('Auth error:', error);
        // If API fails, use mock data instead of redirecting
        setUser({
          email: 'user@example.com',
          full_name: 'User'
        });
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = () => {
    auth.logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <LoadingSpinner 
        message="Đang khởi động..."
        submessage="Lần đầu truy cập có thể mất 30-60 giây để server khởi động. Vui lòng đợi trong giây lát."
      />
    );
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Scan Center', href: '/dashboard/scan', icon: FileText },
    { name: 'Từ khóa', href: '/dashboard/keywords', icon: Key },
    { name: 'Nguồn', href: '/dashboard/sources', icon: Globe },
    { name: 'Mentions', href: '/dashboard/mentions', icon: FileText },
    { name: 'Cảnh báo', href: '/dashboard/alerts', icon: Bell },
    { name: 'Sự cố', href: '/dashboard/incidents', icon: AlertTriangle },
    { name: 'Dịch vụ', href: '/dashboard/services', icon: Briefcase },
  ];

  // Admin-only menu items
  const adminNavigation = [
    { name: 'Cài đặt', href: '/dashboard/settings', icon: Settings },
  ];

  // Combine navigation based on user role
  const allNavigation = canAccessAdmin(user) 
    ? [...navigation, ...adminNavigation]
    : navigation;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b">
            <h1 className="text-xl font-bold text-gray-900">Social Listening</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {allNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="p-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.full_name || user?.email}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-3 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                title="Đăng xuất"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center h-16 px-4 bg-white border-b lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
        </div>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
