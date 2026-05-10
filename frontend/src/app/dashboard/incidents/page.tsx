'use client';

import { useEffect, useState } from 'react';
import { FileText, Eye } from 'lucide-react';
import { incidents as incidentsApi } from '@/lib/api';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const data = await incidentsApi.list({ page: 1, page_size: 50 });
      setIncidents(data.items);
    } catch (error: any) {
      console.error('Error fetching incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'new') return 'bg-blue-100 text-blue-800';
    if (status === 'verifying') return 'bg-yellow-100 text-yellow-800';
    if (status === 'responding') return 'bg-orange-100 text-orange-800';
    if (status === 'resolved') return 'bg-green-100 text-green-800';
    if (status === 'closed') return 'bg-gray-100 text-gray-800';
    return 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-lg text-gray-600">Đang tải...</div></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sự Cố</h1>
        <p className="text-sm text-gray-500 mt-1">Quản lý các sự cố cần xử lý</p>
      </div>

      <div className="space-y-4">
        {incidents.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Không có sự cố nào
          </div>
        ) : (
          incidents.map((incident) => (
            <div key={incident.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">{incident.title}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(incident.status)}`}>
                      {incident.status}
                    </span>
                    {incident.is_overdue && (
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                        Quá hạn
                      </span>
                    )}
                  </div>
                  {incident.description && (
                    <p className="text-sm text-gray-600 mt-2">{incident.description}</p>
                  )}
                  <div className="flex items-center space-x-4 text-xs text-gray-500 mt-2">
                    <span>Tạo: {new Date(incident.created_at).toLocaleString('vi-VN')}</span>
                    {incident.deadline && (
                      <span>Deadline: {new Date(incident.deadline).toLocaleString('vi-VN')}</span>
                    )}
                  </div>
                </div>
                <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg ml-4">
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
