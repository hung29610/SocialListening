'use client';

import { useEffect, useState } from 'react';
import { alerts } from '@/lib/api';
import { Bell, CheckCircle, AlertTriangle, Clock, ExternalLink } from 'lucide-react';

export default function AlertsPage() {
  const [alertList, setAlertList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'acknowledged' | 'resolved'>('all');

  useEffect(() => {
    fetchAlerts();
  }, [filter]);

  const fetchAlerts = async () => {
    try {
      const params: any = {};
      if (filter !== 'all') {
        params.status = filter;
      }
      const data = await alerts.list(params);
      setAlertList(data);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: number) => {
    try {
      await alerts.acknowledge(id);
      fetchAlerts();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
      alert('Không thể xác nhận cảnh báo');
    }
  };

  const handleResolve = async (id: number) => {
    try {
      await alerts.resolve(id);
      fetchAlerts();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      alert('Không thể giải quyết cảnh báo');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Đang tải...</div>
      </div>
    );
  }

  const stats = {
    total: alertList.length,
    pending: alertList.filter(a => a.status === 'pending').length,
    acknowledged: alertList.filter(a => a.status === 'acknowledged').length,
    resolved: alertList.filter(a => a.status === 'resolved').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cảnh báo</h1>
        <p className="mt-1 text-sm text-gray-500">
          Quản lý các cảnh báo rủi ro
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label="Tổng cảnh báo"
          value={stats.total}
          color="blue"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <StatCard
          label="Chờ xử lý"
          value={stats.pending}
          color="red"
          active={filter === 'pending'}
          onClick={() => setFilter('pending')}
        />
        <StatCard
          label="Đã xác nhận"
          value={stats.acknowledged}
          color="yellow"
          active={filter === 'acknowledged'}
          onClick={() => setFilter('acknowledged')}
        />
        <StatCard
          label="Đã giải quyết"
          value={stats.resolved}
          color="green"
          active={filter === 'resolved'}
          onClick={() => setFilter('resolved')}
        />
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {alertList.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <Bell className="w-12 h-12 mx-auto text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Không có cảnh báo
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {filter === 'all' 
                ? 'Chưa có cảnh báo nào được tạo'
                : `Không có cảnh báo ở trạng thái "${filter}"`
              }
            </p>
          </div>
        ) : (
          alertList.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, active, onClick }: any) {
  const colors: any = {
    blue: active ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200',
    red: active ? 'bg-red-100 border-red-500' : 'bg-white border-gray-200',
    yellow: active ? 'bg-yellow-100 border-yellow-500' : 'bg-white border-gray-200',
    green: active ? 'bg-green-100 border-green-500' : 'bg-white border-gray-200',
  };

  const textColors: any = {
    blue: 'text-blue-900',
    red: 'text-red-900',
    yellow: 'text-yellow-900',
    green: 'text-green-900',
  };

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg shadow border-2 transition-all hover:shadow-md ${colors[color]}`}
    >
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${textColors[color]}`}>
        {value}
      </div>
    </button>
  );
}

function AlertCard({ alert, onAcknowledge, onResolve }: any) {
  const severityColors: any = {
    low: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    medium: 'bg-orange-100 text-orange-800 border-orange-300',
    high: 'bg-red-100 text-red-800 border-red-300',
    critical: 'bg-red-200 text-red-900 border-red-400',
  };

  const statusColors: any = {
    pending: 'bg-red-100 text-red-800',
    acknowledged: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
  };

  const statusLabels: any = {
    pending: 'Chờ xử lý',
    acknowledged: 'Đã xác nhận',
    resolved: 'Đã giải quyết',
  };

  const severityLabels: any = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    critical: 'Nghiêm trọng',
  };

  return (
    <div className={`p-6 bg-white rounded-lg shadow border-l-4 ${
      severityColors[alert.severity] || severityColors.medium
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center space-x-2 mb-2">
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              statusColors[alert.status]
            }`}>
              {statusLabels[alert.status]}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              severityColors[alert.severity]
            }`}>
              {severityLabels[alert.severity]}
            </span>
            {alert.crisis_level && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                Crisis Level: {alert.crisis_level}/5
              </span>
            )}
          </div>

          {/* Alert Type */}
          <h3 className="text-lg font-semibold text-gray-900">
            {alert.alert_type === 'negative_mention' && 'Đề cập tiêu cực'}
            {alert.alert_type === 'high_risk' && 'Rủi ro cao'}
            {alert.alert_type === 'crisis' && 'Khủng hoảng'}
            {alert.alert_type === 'spike' && 'Tăng đột biến'}
          </h3>

          {/* Reason */}
          {alert.reason && (
            <p className="mt-2 text-sm text-gray-600">{alert.reason}</p>
          )}

          {/* Mention Info */}
          {alert.mention && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-900">
                {alert.mention.title || 'Không có tiêu đề'}
              </div>
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                {alert.mention.content_snippet}
              </p>
              {alert.mention.url && (
                <a
                  href={alert.mention.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center text-sm text-blue-600 hover:text-blue-700"
                >
                  Xem nguồn
                  <ExternalLink className="w-4 h-4 ml-1" />
                </a>
              )}
            </div>
          )}

          {/* Metadata */}
          <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              {new Date(alert.created_at).toLocaleString('vi-VN')}
            </div>
            {alert.risk_score !== null && (
              <div>Risk Score: {alert.risk_score}/100</div>
            )}
          </div>

          {/* Actions */}
          {alert.status !== 'resolved' && (
            <div className="mt-4 flex space-x-3">
              {alert.status === 'pending' && (
                <button
                  onClick={() => onAcknowledge(alert.id)}
                  className="flex items-center px-3 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-300 rounded-lg hover:bg-yellow-100"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Xác nhận
                </button>
              )}
              <button
                onClick={() => onResolve(alert.id)}
                className="flex items-center px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-300 rounded-lg hover:bg-green-100"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Giải quyết
              </button>
            </div>
          )}
        </div>

        {/* Severity Icon */}
        <div className="ml-4">
          {alert.severity === 'critical' ? (
            <AlertTriangle className="w-8 h-8 text-red-600" />
          ) : (
            <Bell className="w-8 h-8 text-orange-600" />
          )}
        </div>
      </div>
    </div>
  );
}
