'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('access_token');
    console.log('Token in dashboard:', token ? 'exists' : 'not found');
    
    if (!token) {
      console.log('No token found, redirecting to login');
      window.location.href = '/login';
      return;
    }

    // Set user data
    setUser({
      email: 'user@example.com',
      full_name: 'User Name',
      token: token
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Social Listening Dashboard
              </h1>
              <p className="text-gray-600">Chào mừng, {user.full_name || user.email}!</p>
              <p className="text-xs text-gray-400">Token: {user.token ? 'Có' : 'Không có'}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                      <span className="text-white font-bold">M</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Mentions hôm nay
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">0</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                      <span className="text-white font-bold">A</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Cảnh báo
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">0</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                      <span className="text-white font-bold">I</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Sự cố
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">0</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                      <span className="text-white font-bold">S</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Nguồn
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">0</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Thao tác nhanh
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Link
                  href="/dashboard/keywords"
                  className="p-4 border border-gray-300 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
                      <span className="text-blue-600 font-bold">K</span>
                    </div>
                    <h4 className="font-medium text-gray-900">Từ khóa</h4>
                    <p className="text-sm text-gray-500">Quản lý từ khóa giám sát</p>
                  </div>
                </Link>

                <Link
                  href="/dashboard/sources"
                  className="p-4 border border-gray-300 rounded-lg hover:border-green-500 hover:shadow-md transition-all"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
                      <span className="text-green-600 font-bold">S</span>
                    </div>
                    <h4 className="font-medium text-gray-900">Nguồn</h4>
                    <p className="text-sm text-gray-500">Quản lý nguồn dữ liệu</p>
                  </div>
                </Link>

                <Link
                  href="/dashboard/mentions"
                  className="p-4 border border-gray-300 rounded-lg hover:border-purple-500 hover:shadow-md transition-all"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
                      <span className="text-purple-600 font-bold">M</span>
                    </div>
                    <h4 className="font-medium text-gray-900">Mentions</h4>
                    <p className="text-sm text-gray-500">Xem các đề cập</p>
                  </div>
                </Link>

                <Link
                  href="/dashboard/alerts"
                  className="p-4 border border-gray-300 rounded-lg hover:border-red-500 hover:shadow-md transition-all"
                >
                  <div className="text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-lg mx-auto mb-3 flex items-center justify-center">
                      <span className="text-red-600 font-bold">A</span>
                    </div>
                    <h4 className="font-medium text-gray-900">Cảnh báo</h4>
                    <p className="text-sm text-gray-500">Quản lý cảnh báo</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mt-8 bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                Hoạt động gần đây
              </h3>
              <div className="text-center py-8 text-gray-500">
                <p>Chưa có hoạt động nào</p>
                <p className="text-sm mt-2">Bắt đầu bằng cách thêm từ khóa và nguồn dữ liệu</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}