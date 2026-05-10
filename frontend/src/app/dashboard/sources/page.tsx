'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Search, Globe, Facebook, Youtube } from 'lucide-react';

interface Source {
  id: number;
  name: string;
  url: string;
  source_type: string;
  is_active: boolean;
  crawl_frequency: number;
  last_crawled_at: string | null;
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
    crawl_frequency: 60
  });

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      // Mock data for now
      setSources([
        { 
          id: 1, 
          name: 'VnExpress', 
          url: 'https://vnexpress.net', 
          source_type: 'website', 
          is_active: true, 
          crawl_frequency: 60,
          last_crawled_at: '2024-01-15T10:30:00'
        },
        { 
          id: 2, 
          name: 'Facebook Page', 
          url: 'https://facebook.com/example', 
          source_type: 'facebook', 
          is_active: true, 
          crawl_frequency: 30,
          last_crawled_at: '2024-01-15T11:00:00'
        },
        { 
          id: 3, 
          name: 'YouTube Channel', 
          url: 'https://youtube.com/@example', 
          source_type: 'youtube', 
          is_active: false, 
          crawl_frequency: 120,
          last_crawled_at: null
        },
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching sources:', error);
      setLoading(false);
    }
  };

  const handleAddSource = async () => {
    if (!newSource.name.trim() || !newSource.url.trim()) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    try {
      // TODO: Call API
      const newId = Math.max(...sources.map(s => s.id), 0) + 1;
      const source: Source = {
        id: newId,
        name: newSource.name,
        url: newSource.url,
        source_type: newSource.source_type,
        is_active: true,
        crawl_frequency: newSource.crawl_frequency,
        last_crawled_at: null
      };
      
      setSources([...sources, source]);
      setShowAddModal(false);
      setNewSource({ name: '', url: '', source_type: 'website', crawl_frequency: 60 });
      alert('Thêm nguồn thành công!');
    } catch (error) {
      console.error('Error adding source:', error);
      alert('Lỗi khi thêm nguồn');
    }
  };

  const handleDeleteSource = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa nguồn này?')) return;

    try {
      // TODO: Call API
      setSources(sources.filter(s => s.id !== id));
      alert('Xóa nguồn thành công!');
    } catch (error) {
      console.error('Error deleting source:', error);
      alert('Lỗi khi xóa nguồn');
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      // TODO: Call API
      setSources(sources.map(s => 
        s.id === id ? { ...s, is_active: !s.is_active } : s
      ));
    } catch (error) {
      console.error('Error toggling source:', error);
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
      default: return type;
    }
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
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
          <div className="col-span-full text-center py-12 text-gray-500">
            Không có nguồn nào
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
                  onClick={() => handleToggleActive(source.id)}
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    source.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {source.is_active ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600 truncate">
                  <span className="font-medium">URL:</span> {source.url}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Tần suất:</span> {source.crawl_frequency} phút
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Lần cuối:</span>{' '}
                  {source.last_crawled_at 
                    ? new Date(source.last_crawled_at).toLocaleString('vi-VN')
                    : 'Chưa crawl'
                  }
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => handleDeleteSource(source.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Thêm nguồn mới</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên nguồn *
                </label>
                <input
                  type="text"
                  value={newSource.name}
                  onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ví dụ: VnExpress"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL *
                </label>
                <input
                  type="url"
                  value={newSource.url}
                  onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Loại nguồn
                </label>
                <select
                  value={newSource.source_type}
                  onChange={(e) => setNewSource({ ...newSource, source_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="website">Website</option>
                  <option value="facebook">Facebook</option>
                  <option value="youtube">YouTube</option>
                  <option value="rss">RSS Feed</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tần suất crawl (phút)
                </label>
                <input
                  type="number"
                  value={newSource.crawl_frequency}
                  onChange={(e) => setNewSource({ ...newSource, crawl_frequency: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Hủy
              </button>
              <button
                onClick={handleAddSource}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
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
