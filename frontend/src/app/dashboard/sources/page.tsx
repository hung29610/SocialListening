'use client';

import { useEffect, useState } from 'react';
import { sources, crawl } from '@/lib/api';
import { Plus, Search, Globe, Play, Edit2, Trash2 } from 'lucide-react';

export default function SourcesPage() {
  const [sourceList, setSourceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSources, setSelectedSources] = useState<number[]>([]);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const data = await sources.list();
      setSourceList(data);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCrawl = async () => {
    if (selectedSources.length === 0) {
      alert('Vui lòng chọn ít nhất một nguồn');
      return;
    }

    try {
      await crawl.manual({
        source_ids: selectedSources,
        keyword_group_ids: [], // Will use all active keyword groups
      });
      alert('Đã bắt đầu quét thủ công');
      setSelectedSources([]);
    } catch (error) {
      console.error('Failed to start manual crawl:', error);
      alert('Không thể bắt đầu quét');
    }
  };

  const filteredSources = sourceList.filter(source =>
    source.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    source.url.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-600">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quản lý nguồn</h1>
          <p className="mt-1 text-sm text-gray-500">
            Thêm và quản lý các nguồn để giám sát
          </p>
        </div>
        <div className="flex space-x-3">
          {selectedSources.length > 0 && (
            <button
              onClick={handleManualCrawl}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Quét ngay ({selectedSources.length})
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Thêm nguồn
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm nguồn..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Sources List */}
      {filteredSources.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Globe className="w-12 h-12 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Chưa có nguồn nào
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Thêm nguồn đầu tiên để bắt đầu giám sát
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Thêm nguồn
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredSources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              isSelected={selectedSources.includes(source.id)}
              onToggleSelect={() => {
                setSelectedSources(prev =>
                  prev.includes(source.id)
                    ? prev.filter(id => id !== source.id)
                    : [...prev, source.id]
                );
              }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <SourceModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            fetchSources();
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

function SourceCard({ source, isSelected, onToggleSelect }: any) {
  const platformColors: any = {
    facebook: 'bg-blue-100 text-blue-800',
    youtube: 'bg-red-100 text-red-800',
    news: 'bg-purple-100 text-purple-800',
    rss: 'bg-orange-100 text-orange-800',
    web: 'bg-gray-100 text-gray-800',
  };

  const platformColor = platformColors[source.platform_type] || platformColors.web;

  return (
    <div className={`p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow border-2 ${
      isSelected ? 'border-blue-500' : 'border-transparent'
    }`}>
      <div className="flex items-start space-x-4">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900">{source.name}</h3>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-sm text-blue-600 hover:text-blue-700 truncate block"
              >
                {source.url}
              </a>
            </div>
            <span className={`ml-4 px-3 py-1 text-xs font-medium rounded-full ${platformColor}`}>
              {source.platform_type.toUpperCase()}
            </span>
          </div>

          {/* Stats */}
          <div className="mt-3 flex items-center space-x-6 text-sm text-gray-600">
            <div>
              <span className="font-medium">Tần suất:</span>{' '}
              {source.crawl_frequency_minutes} phút
            </div>
            {source.last_crawled_at && (
              <div>
                <span className="font-medium">Quét lần cuối:</span>{' '}
                {new Date(source.last_crawled_at).toLocaleString('vi-VN')}
              </div>
            )}
            <div>
              <span className={`font-medium ${source.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                {source.is_active ? '● Hoạt động' : '○ Tạm dừng'}
              </span>
            </div>
          </div>

          {/* Metadata */}
          {source.metadata && Object.keys(source.metadata).length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              <span className="font-medium">Metadata:</span>{' '}
              {JSON.stringify(source.metadata)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceModal({ onClose, onSuccess }: any) {
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    platform_type: 'web',
    crawl_frequency_minutes: 60,
    is_active: true,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await sources.create(formData);
      onSuccess();
    } catch (error) {
      console.error('Failed to create source:', error);
      alert('Không thể tạo nguồn');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
        <h2 className="text-xl font-bold text-gray-900">Thêm nguồn mới</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tên nguồn *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="VD: VnExpress"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              URL *
            </label>
            <input
              type="url"
              required
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Loại nền tảng *
            </label>
            <select
              value={formData.platform_type}
              onChange={(e) => setFormData({ ...formData, platform_type: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="web">Website</option>
              <option value="rss">RSS Feed</option>
              <option value="news">Báo chí</option>
              <option value="facebook">Facebook</option>
              <option value="youtube">YouTube</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tần suất quét (phút)
            </label>
            <input
              type="number"
              min="5"
              value={formData.crawl_frequency_minutes}
              onChange={(e) => setFormData({ ...formData, crawl_frequency_minutes: parseInt(e.target.value) })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Tối thiểu 5 phút. Khuyến nghị: 60 phút
            </p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_active" className="ml-2 text-sm text-gray-700">
              Kích hoạt ngay
            </label>
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
              {loading ? 'Đang lưu...' : 'Thêm nguồn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
