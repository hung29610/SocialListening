'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Search, Globe, Facebook, Youtube, Clock } from 'lucide-react';
import { sources as sourcesApi } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';

interface Source {
  id: number;
  name: string;
  url: string;
  source_type: string;
  is_active: boolean;
  crawl_frequency: string;
  crawl_time: string | null;
  crawl_day_of_week: number | null;
  crawl_day_of_month: number | null;
  crawl_month: number | null;
  next_crawl_at: string | null;
  last_crawled_at: string | null;
  created_at: string;
}

export default function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newSource, setNewSource] = useState({
    name: '',
    url: '',
    source_type: 'website',
    crawl_frequency: 'manual',
    crawl_time: '09:00',
    crawl_day_of_week: 0,
    crawl_day_of_month: 1,
    crawl_month: 1
  });

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      setLoading(true);
      const data = await sourcesApi.list();
      setSources(data);
    } catch (error: any) {
      console.error('Error fetching sources:', error);
      toast.error('Lỗi khi tải danh sách nguồn');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSource = async () => {
    if (!newSource.name.trim() || !newSource.url.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    try {
      const payload: any = {
        name: newSource.name,
        url: newSource.url,
        source_type: newSource.source_type,
        is_active: true,
        crawl_frequency: newSource.crawl_frequency
      };

      // Add schedule fields based on frequency
      if (newSource.crawl_frequency === 'daily') {
        payload.crawl_time = newSource.crawl_time;
      } else if (newSource.crawl_frequency === 'weekly') {
        payload.crawl_time = newSource.crawl_time;
        payload.crawl_day_of_week = newSource.crawl_day_of_week;
      } else if (newSource.crawl_frequency === 'monthly') {
        payload.crawl_time = newSource.crawl_time;
        payload.crawl_day_of_month = newSource.crawl_day_of_month;
      } else if (newSource.crawl_frequency === 'yearly') {
        payload.crawl_time = newSource.crawl_time;
        payload.crawl_day_of_month = newSource.crawl_day_of_month;
        payload.crawl_month = newSource.crawl_month;
      }

      await sourcesApi.create(payload);
      
      setShowAddModal(false);
      setNewSource({ 
        name: '', 
        url: '', 
        source_type: 'website',
        crawl_frequency: 'manual',
        crawl_time: '09:00',
        crawl_day_of_week: 0,
        crawl_day_of_month: 1,
        crawl_month: 1
      });
      toast.success('Thêm nguồn thành công!');
      fetchSources();
    } catch (error: any) {
      console.error('Error adding source:', error);
      toast.error('Lỗi khi thêm nguồn');
    }
  };

  const handleDeleteSource = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa nguồn này?')) return;

    try {
      await sourcesApi.delete(id);
      toast.success('Xóa nguồn thành công!');
      fetchSources();
    } catch (error: any) {
      console.error('Error deleting source:', error);
      toast.error('Lỗi khi xóa nguồn');
    }
  };

  const handleToggleActive = async (source: Source) => {
    try {
      await sourcesApi.update(source.id, {
        is_active: !source.is_active
      });
      fetchSources();
      toast.success(`Đã ${!source.is_active ? 'bật' : 'tắt'} nguồn`);
    } catch (error: any) {
      console.error('Error toggling source:', error);
      toast.error('Lỗi khi cập nhật nguồn');
    }
  };

  const filteredSources = sources.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'facebook': return <Facebook className="w-5 h-5 text-blue-600" />;
      case 'youtube': return <Youtube className="w-5 h-5 text-red-600" />;
      default: return <Globe className="w-5 h-5 text-gray-600" />;
    }
  };

  const getSourceTypeText = (type: string) => {
    switch (type) {
      case 'facebook': return 'Facebook';
      case 'youtube': return 'YouTube';
      case 'website': return 'Website';
      case 'rss': return 'RSS Feed';
      case 'twitter': return 'Twitter';
      case 'instagram': return 'Instagram';
      default: return type;
    }
  };

  const getFrequencyText = (frequency: string) => {
    switch (frequency) {
      case 'daily': return 'Hằng ngày';
      case 'weekly': return 'Hằng tuần';
      case 'monthly': return 'Hằng tháng';
      case 'yearly': return 'Hằng năm';
      default: return 'Thủ công';
    }
  };

  const getScheduleDescription = (source: Source) => {
    if (source.crawl_frequency === 'manual') return 'Quét thủ công';
    
    const time = source.crawl_time || '09:00';
    
    if (source.crawl_frequency === 'daily') {
      return `Hằng ngày lúc ${time}`;
    } else if (source.crawl_frequency === 'weekly') {
      const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
      const dayName = days[source.crawl_day_of_week || 0];
      return `Hằng tuần vào ${dayName} lúc ${time}`;
    } else if (source.crawl_frequency === 'monthly') {
      return `Hằng tháng ngày ${source.crawl_day_of_month || 1} lúc ${time}`;
    } else if (source.crawl_frequency === 'yearly') {
      const months = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
                     'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
      const monthName = months[source.crawl_month || 1];
      return `Hằng năm ${monthName} ngày ${source.crawl_day_of_month || 1} lúc ${time}`;
    }
    
    return 'Không xác định';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý nguồn</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý các nguồn dữ liệu để thu thập thông tin
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Thêm nguồn
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Tìm kiếm nguồn..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSources.length === 0 ? (
          <div className="col-span-full bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Không có nguồn nào. Hãy thêm nguồn đầu tiên!
          </div>
        ) : (
          filteredSources.map((source) => (
            <div key={source.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getSourceIcon(source.source_type)}
                  <div>
                    <h3 className="font-semibold text-gray-900">{source.name}</h3>
                    <p className="text-xs text-gray-500">{getSourceTypeText(source.source_type)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleActive(source)}
                  className={`px-2 py-1 text-xs font-medium rounded-full transition-colors ${
                    source.is_active
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {source.is_active ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600 truncate">
                  <span className="font-medium">URL:</span> {source.url}
                </p>
                
                {/* Schedule Info */}
                <div className="flex items-center space-x-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <div>
                    <span className="font-medium text-gray-700">Lịch:</span>
                    <span className="text-gray-600 ml-1">{getScheduleDescription(source)}</span>
                  </div>
                </div>
                
                {source.next_crawl_at && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Lần tiếp theo:</span>{' '}
                    {new Date(source.next_crawl_at).toLocaleString('vi-VN')}
                  </p>
                )}
                
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Lần cuối:</span>{' '}
                  {source.last_crawled_at 
                    ? new Date(source.last_crawled_at).toLocaleString('vi-VN')
                    : 'Chưa crawl'
                  }
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Tạo lúc:</span>{' '}
                  {new Date(source.created_at).toLocaleString('vi-VN')}
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleDeleteSource(source.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Thêm nguồn mới</h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tên nguồn *
                </label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ví dụ: VnExpress"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL *
                </label>
                <input
                  type="url"
                  value={newSource.url}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Loại nguồn
                </label>
                <select
                  value={newSource.source_type}
                  onChange={(e) => setNewSource({ ...newSource, source_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="website">Website</option>
                  <option value="facebook">Facebook</option>
                  <option value="youtube">YouTube</option>
                  <option value="twitter">Twitter</option>
                  <option value="instagram">Instagram</option>
                  <option value="rss">RSS Feed</option>
                </select>
              </div>

              {/* Crawl Schedule */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-medium text-gray-900 mb-3">Lịch Quét</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tần suất quét
                  </label>
                  <select
                    value={newSource.crawl_frequency}
                    onChange={(e) => setNewSource({ ...newSource, crawl_frequency: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="manual">Thủ công</option>
                    <option value="daily">Hằng ngày</option>
                    <option value="weekly">Hằng tuần</option>
                    <option value="monthly">Hằng tháng</option>
                    <option value="yearly">Hằng năm</option>
                  </select>
                </div>

                {/* Time picker for all scheduled frequencies */}
                {newSource.crawl_frequency !== 'manual' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Giờ quét
                    </label>
                    <input
                      type="time"
                      value={newSource.crawl_time}
                      onChange={(e) => setNewSource({ ...newSource, crawl_time: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                {/* Day of week picker for weekly */}
                {newSource.crawl_frequency === 'weekly' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Thứ trong tuần
                    </label>
                    <select
                      value={newSource.crawl_day_of_week}
                      onChange={(e) => setNewSource({ ...newSource, crawl_day_of_week: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={0}>Thứ 2</option>
                      <option value={1}>Thứ 3</option>
                      <option value={2}>Thứ 4</option>
                      <option value={3}>Thứ 5</option>
                      <option value={4}>Thứ 6</option>
                      <option value={5}>Thứ 7</option>
                      <option value={6}>Chủ nhật</option>
                    </select>
                  </div>
                )}

                {/* Day of month picker for monthly and yearly */}
                {(newSource.crawl_frequency === 'monthly' || newSource.crawl_frequency === 'yearly') && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ngày trong tháng
                    </label>
                    <select
                      value={newSource.crawl_day_of_month}
                      onChange={(e) => setNewSource({ ...newSource, crawl_day_of_month: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>Ngày {day}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Month picker for yearly */}
                {newSource.crawl_frequency === 'yearly' && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tháng
                    </label>
                    <select
                      value={newSource.crawl_month}
                      onChange={(e) => setNewSource({ ...newSource, crawl_month: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={1}>Tháng 1</option>
                      <option value={2}>Tháng 2</option>
                      <option value={3}>Tháng 3</option>
                      <option value={4}>Tháng 4</option>
                      <option value={5}>Tháng 5</option>
                      <option value={6}>Tháng 6</option>
                      <option value={7}>Tháng 7</option>
                      <option value={8}>Tháng 8</option>
                      <option value={9}>Tháng 9</option>
                      <option value={10}>Tháng 10</option>
                      <option value={11}>Tháng 11</option>
                      <option value={12}>Tháng 12</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end space-x-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleAddSource}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Thêm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
