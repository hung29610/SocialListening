'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import { alerts as alertsApi } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const params: any = { page: 1, page_size: 50 };
      if (filter !== 'all') {
        params.status = filter;
      }
      const data = await alertsApi.list(params);
      setAlerts(data.items);
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      await alertsApi.acknowledge(id);
      toast.success('Đã xác nhận cảnh báo');
      fetchAlerts();
    } catch (error: any) {
      toast.error('Lỗi khi xác nhận cảnh báo');
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await alertsApi.resolve(id);
      toast.success('Đã giải quyết cảnh báo');
      fetchAlerts();
    } catch (error: any) {
      toast.error('Lỗi khi giải quyết cảnh báo');
    }
  };

  const getSeverityColor = (severity: string) => {
    if (severity === 'critical') return 'bg-red-100 text-red-800 border-red-200';
    if (severity === 'high') return 'bg-orange-100 text-orange-800 border-orange-200';
    if (severity === 'medium') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-lg text-gray-600">Đang tải...</div></div>;
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cảnh Báo</h1>
        <p className="text-sm text-gray-500 mt-1">Quản lý các cảnh báo từ hệ thống</p>
      </div>

      {/* Filters */}
      <div className="flex space-x-2">
        {['all', 'new', 'acknowledged', 'resolved'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg ${filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border'}`}
          >
            {f === 'all' ? 'Tất cả' : f === 'new' ? 'Mới' : f === 'acknowledged' ? 'Đã xác nhận' : 'Đã giải quyết'}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {alerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Không có cảnh báo nào
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className={`bg-white rounded-lg shadow p-6 border-l-4 ${getSeverityColor(alert.severity)}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <AlertTriangle className="w-5 h-5" />
                    <h3 className="font-semibold text-gray-900">{alert.title}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </div>
                  {alert.message && <p className="text-sm text-gray-600 mt-2">{alert.message}</p>}
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(alert.created_at).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="flex space-x-2 ml-4">
                  {alert.status === 'new' && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Xác nhận"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                  {alert.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                      title="Giải quyết"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
