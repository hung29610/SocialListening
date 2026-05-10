'use client';

import { useEffect, useState } from 'react';
import { BarChart3, AlertTriangle, FileText, Database, TrendingUp, TrendingDown } from 'lucide-react';
import { dashboard } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const data = await dashboard.get();
      setMetrics(data);
    } catch (error: any) {
      console.error('Error fetching dashboard:', error);
      toast.error('Lỗi khi tải dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Đang tải...</div>
      </div>
    );
  }

  const stats = [
    {
      name: 'Tổng Mentions',
      value: metrics?.metrics?.total_mentions || 0,
      icon: Database,
      color: 'bg-blue-500',
      change: null
    },
    {
      name: 'Mentions Hôm Nay',
      value: metrics?.metrics?.mentions_today || 0,
      icon: TrendingUp,
      color: 'bg-green-500',
      change: null
    },
    {
      name: 'Mentions Tiêu Cực',
      value: metrics?.metrics?.negative_mentions || 0,
      icon: TrendingDown,
      color: 'bg-red-500',
      change: null
    },
    {
      name: 'Cảnh Báo',
      value: metrics?.metrics?.total_alerts || 0,
      icon: AlertTriangle,
      color: 'bg-yellow-500',
      change: null
    },
    {
      name: 'Sự Cố',
      value: metrics?.metrics?.total_incidents || 0,
      icon: FileText,
      color: 'bg-purple-500',
      change: null
    },
    {
      name: 'Nguồn Hoạt Động',
      value: metrics?.metrics?.total_sources || 0,
      icon: BarChart3,
      color: 'bg-indigo-500',
      change: null
    }
  ];

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tổng quan về hoạt động giám sát mạng xã hội
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
              </div>
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Latest Mentions */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Mentions Mới Nhất</h2>
        </div>
        <div className="p-6">
          {!metrics?.latest_mentions || metrics.latest_mentions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Chưa có mention nào</p>
          ) : (
            <div className="space-y-4">
              {metrics.latest_mentions.map((mention: any) => (
                <div key={mention.id} className="border-l-4 border-blue-500 pl-4 py-2">
                  <h3 className="font-medium text-gray-900">{mention.title || 'No title'}</h3>
                  <p className="text-sm text-gray-600 mt-1">{mention.content}</p>
                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                    <span>{new Date(mention.collected_at).toLocaleString('vi-VN')}</span>
                    <a href={mention.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Xem nguồn
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Latest Alerts */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Cảnh Báo Mới Nhất</h2>
        </div>
        <div className="p-6">
          {!metrics?.latest_alerts || metrics.latest_alerts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Chưa có cảnh báo nào</p>
          ) : (
            <div className="space-y-4">
              {metrics.latest_alerts.map((alert: any) => (
                <div key={alert.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                  <AlertTriangle className={`w-5 h-5 mt-0.5 ${
                    alert.severity === 'critical' ? 'text-red-600' :
                    alert.severity === 'high' ? 'text-orange-600' :
                    alert.severity === 'medium' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`} />
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{alert.title}</h3>
                    <div className="flex items-center space-x-3 mt-2 text-xs">
                      <span className={`px-2 py-1 rounded-full ${
                        alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        alert.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                        alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {alert.severity}
                      </span>
                      <span className="text-gray-500">
                        {new Date(alert.created_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
