'use client';

import { useEffect, useState } from 'react';
import { incidents } from '@/lib/api';
import { Plus, AlertTriangle, Clock, User, Calendar } from 'lucide-react';

export default function IncidentsPage() {
  const [incidentList, setIncidentList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');

  useEffect(() => {
    fetchIncidents();
  }, [filter]);

  const fetchIncidents = async () => {
    try {
      const params: any = {};
      if (filter !== 'all') {
        params.status = filter;
      }
      const data = await incidents.list(params);
      setIncidentList(data);
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
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

  const stats = {
    total: incidentList.length,
    open: incidentList.filter(i => i.status === 'open').length,
    in_progress: incidentList.filter(i => i.status === 'in_progress').length,
    resolved: incidentList.filter(i => i.status === 'resolved').length,
    closed: incidentList.filter(i => i.status === 'closed').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý sự cố</h1>
          <p className="mt-1 text-sm text-gray-500">
            Theo dõi và xử lý các sự cố danh tiếng
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tạo sự cố
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <StatCard
          label="Tổng sự cố"
          value={stats.total}
          color="blue"
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <StatCard
          label="Mới mở"
          value={stats.open}
          color="red"
          active={filter === 'open'}
          onClick={() => setFilter('open')}
        />
        <StatCard
          label="Đang xử lý"
          value={stats.in_progress}
          color="yellow"
          active={filter === 'in_progress'}
          onClick={() => setFilter('in_progress')}
        />
        <StatCard
          label="Đã giải quyết"
          value={stats.resolved}
          color="green"
          active={filter === 'resolved'}
          onClick={() => setFilter('resolved')}
        />
        <StatCard
          label="Đã đóng"
          value={stats.closed}
          color="gray"
          active={filter === 'closed'}
          onClick={() => setFilter('closed')}
        />
      </div>

      {/* Incidents List */}
      <div className="space-y-4">
        {incidentList.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <AlertTriangle className="w-12 h-12 mx-auto text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Không có sự cố
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {filter === 'all'
                ? 'Chưa có sự cố nào được tạo'
                : `Không có sự cố ở trạng thái "${filter}"`
              }
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Tạo sự cố đầu tiên
            </button>
          </div>
        ) : (
          incidentList.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} onUpdate={fetchIncidents} />
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <IncidentModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            fetchIncidents();
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color, active, onClick }: any) {
  const colors: any = {
    blue: active ? 'bg-blue-100 border-blue-500' : 'bg-white border-gray-200',
    red: active ? 'bg-red-100 border-red-500' : 'bg-white border-gray-200',
    yellow: active ? 'bg-yellow-100 border-yellow-500' : 'bg-white border-gray-200',
    green: active ? 'bg-green-100 border-green-500' : 'bg-white border-gray-200',
    gray: active ? 'bg-gray-100 border-gray-500' : 'bg-white border-gray-200',
  };

  const textColors: any = {
    blue: 'text-blue-900',
    red: 'text-red-900',
    yellow: 'text-yellow-900',
    green: 'text-green-900',
    gray: 'text-gray-900',
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

function IncidentCard({ incident, onUpdate }: any) {
  const [showDetails, setShowDetails] = useState(false);

  const statusColors: any = {
    open: 'bg-red-100 text-red-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-gray-100 text-gray-800',
  };

  const statusLabels: any = {
    open: 'Mới mở',
    in_progress: 'Đang xử lý',
    resolved: 'Đã giải quyết',
    closed: 'Đã đóng',
  };

  const priorityColors: any = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-orange-100 text-orange-800',
    critical: 'bg-red-100 text-red-800',
  };

  const priorityLabels: any = {
    low: 'Thấp',
    medium: 'Trung bình',
    high: 'Cao',
    critical: 'Nghiêm trọng',
  };

  const isOverdue = incident.deadline && new Date(incident.deadline) < new Date() && 
                     incident.status !== 'resolved' && incident.status !== 'closed';

  return (
    <div className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center space-x-2 mb-2">
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              statusColors[incident.status]
            }`}>
              {statusLabels[incident.status]}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              priorityColors[incident.priority]
            }`}>
              {priorityLabels[incident.priority]}
            </span>
            {isOverdue && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-red-200 text-red-900">
                Quá hạn
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900">
            {incident.title}
          </h3>

          {/* Description */}
          {incident.description && (
            <p className="mt-2 text-sm text-gray-600 line-clamp-2">
              {incident.description}
            </p>
          )}

          {/* Metadata */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            {incident.assigned_to_name && (
              <div className="flex items-center">
                <User className="w-4 h-4 mr-1" />
                {incident.assigned_to_name}
              </div>
            )}
            {incident.deadline && (
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                Hạn: {new Date(incident.deadline).toLocaleDateString('vi-VN')}
              </div>
            )}
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              Tạo: {new Date(incident.created_at).toLocaleDateString('vi-VN')}
            </div>
          </div>

          {/* Related Mentions */}
          {incident.mention_count > 0 && (
            <div className="mt-3 text-sm text-gray-600">
              <span className="font-medium">{incident.mention_count}</span> mentions liên quan
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex space-x-3">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              {showDetails ? 'Ẩn chi tiết' : 'Xem chi tiết'}
            </button>
          </div>

          {/* Details */}
          {showDetails && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
              {incident.internal_notes && (
                <div>
                  <div className="text-sm font-medium text-gray-700">Ghi chú nội bộ:</div>
                  <p className="mt-1 text-sm text-gray-600">{incident.internal_notes}</p>
                </div>
              )}
              {incident.resolution_notes && (
                <div>
                  <div className="text-sm font-medium text-gray-700">Ghi chú giải quyết:</div>
                  <p className="mt-1 text-sm text-gray-600">{incident.resolution_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Priority Icon */}
        <div className="ml-4">
          <AlertTriangle className={`w-8 h-8 ${
            incident.priority === 'critical' ? 'text-red-600' :
            incident.priority === 'high' ? 'text-orange-600' :
            incident.priority === 'medium' ? 'text-yellow-600' :
            'text-blue-600'
          }`} />
        </div>
      </div>
    </div>
  );
}

function IncidentModal({ onClose, onSuccess }: any) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    status: 'open',
    deadline: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await incidents.create(formData);
      onSuccess();
    } catch (error) {
      console.error('Failed to create incident:', error);
      alert('Không thể tạo sự cố');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
        <h2 className="text-xl font-bold text-gray-900">Tạo sự cố mới</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tiêu đề *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="VD: Tin thất thiệt về sản phẩm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Mô tả
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Mô tả chi tiết về sự cố"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Mức độ ưu tiên
            </label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
              <option value="critical">Nghiêm trọng</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Hạn xử lý
            </label>
            <input
              type="datetime-local"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Đang tạo...' : 'Tạo sự cố'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
