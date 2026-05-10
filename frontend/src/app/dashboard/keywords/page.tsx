'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Search } from 'lucide-react';

interface Keyword {
  id: number;
  keyword: string;
  category: string;
  priority: string;
  is_active: boolean;
  created_at: string;
}

export default function KeywordsPage() {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newKeyword, setNewKeyword] = useState({
    keyword: '',
    category: '',
    priority: 'medium'
  });

  useEffect(() => {
    fetchKeywords();
  }, []);

  const fetchKeywords = async () => {
    try {
      // Mock data for now
      setKeywords([
        { id: 1, keyword: 'sản phẩm lỗi', category: 'Chất lượng', priority: 'high', is_active: true, created_at: '2024-01-01' },
        { id: 2, keyword: 'dịch vụ tốt', category: 'Dịch vụ', priority: 'medium', is_active: true, created_at: '2024-01-02' },
        { id: 3, keyword: 'giao hàng chậm', category: 'Vận chuyển', priority: 'high', is_active: true, created_at: '2024-01-03' },
      ]);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching keywords:', error);
      setLoading(false);
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.keyword.trim()) {
      alert('Vui lòng nhập từ khóa');
      return;
    }

    try {
      // TODO: Call API
      const newId = Math.max(...keywords.map(k => k.id), 0) + 1;
      const keyword: Keyword = {
        id: newId,
        keyword: newKeyword.keyword,
        category: newKeyword.category || 'Khác',
        priority: newKeyword.priority,
        is_active: true,
        created_at: new Date().toISOString()
      };
      
      setKeywords([...keywords, keyword]);
      setShowAddModal(false);
      setNewKeyword({ keyword: '', category: '', priority: 'medium' });
      alert('Thêm từ khóa thành công!');
    } catch (error) {
      console.error('Error adding keyword:', error);
      alert('Lỗi khi thêm từ khóa');
    }
  };

  const handleDeleteKeyword = async (id: number) => {
    if (!confirm('Bạn có chắc muốn xóa từ khóa này?')) return;

    try {
      // TODO: Call API
      setKeywords(keywords.filter(k => k.id !== id));
      alert('Xóa từ khóa thành công!');
    } catch (error) {
      console.error('Error deleting keyword:', error);
      alert('Lỗi khi xóa từ khóa');
    }
  };

  const handleToggleActive = async (id: number) => {
    try {
      // TODO: Call API
      setKeywords(keywords.map(k => 
        k.id === id ? { ...k, is_active: !k.is_active } : k
      ));
    } catch (error) {
      console.error('Error toggling keyword:', error);
    }
  };

  const filteredKeywords = keywords.filter(k =>
    k.keyword.toLowerCase().includes(searchTerm.toLowerCase()) ||
    k.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return 'Cao';
      case 'medium': return 'Trung bình';
      case 'low': return 'Thấp';
      default: return priority;
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
          <h1 className="text-2xl font-bold text-gray-900">Quản lý từ khóa</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý các từ khóa để giám sát trên mạng xã hội
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Thêm từ khóa
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Tìm kiếm từ khóa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Keywords Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Từ khóa
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Danh mục
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Độ ưu tiên
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Trạng thái
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredKeywords.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Không có từ khóa nào
                </td>
              </tr>
            ) : (
              filteredKeywords.map((keyword) => (
                <tr key={keyword.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {keyword.keyword}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{keyword.category}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(keyword.priority)}`}>
                      {getPriorityText(keyword.priority)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleToggleActive(keyword.id)}
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        keyword.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {keyword.is_active ? 'Hoạt động' : 'Tắt'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDeleteKeyword(keyword.id)}
                      className="text-red-600 hover:text-red-900 ml-4"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Thêm từ khóa mới</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Từ khóa *
                </label>
                <input
                  type="text"
                  value={newKeyword.keyword}
                  onChange={(e) => setNewKeyword({ ...newKeyword, keyword: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập từ khóa..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Danh mục
                </label>
                <input
                  type="text"
                  value={newKeyword.category}
                  onChange={(e) => setNewKeyword({ ...newKeyword, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ví dụ: Chất lượng, Dịch vụ..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Độ ưu tiên
                </label>
                <select
                  value={newKeyword.priority}
                  onChange={(e) => setNewKeyword({ ...newKeyword, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Thấp</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Cao</option>
                </select>
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
                onClick={handleAddKeyword}
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
