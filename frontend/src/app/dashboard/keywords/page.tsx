'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { keywords as keywordsApi } from '@/lib/api';

interface Keyword {
  id: number;
  keyword: string;
  keyword_type: string;
  is_active: boolean;
  created_at: string;
  group_id: number;
}

interface KeywordGroup {
  id: number;
  name: string;
  description: string | null;
  priority: number;
  is_active: boolean;
  keyword_count: number;
  created_at: string;
}

export default function KeywordsPage() {
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [groupKeywords, setGroupKeywords] = useState<Record<number, Keyword[]>>({});
  const [loading, setLoading] = useState(true);
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [showAddKeywordModal, setShowAddKeywordModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    priority: 3
  });
  
  const [newKeyword, setNewKeyword] = useState({
    keyword: '',
    keyword_type: 'general'
  });

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await keywordsApi.listGroups();
      setGroups(data);
    } catch (error: any) {
      console.error('Error fetching groups:', error);
      alert('Lỗi khi tải danh sách nhóm từ khóa: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchKeywordsInGroup = async (groupId: number) => {
    try {
      const data = await keywordsApi.listKeywordsInGroup(groupId);
      setGroupKeywords(prev => ({ ...prev, [groupId]: data }));
    } catch (error: any) {
      console.error('Error fetching keywords:', error);
      alert('Lỗi khi tải từ khóa: ' + (error.response?.data?.detail || error.message));
    }
  };

  const toggleGroup = async (groupId: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
      // Fetch keywords if not already loaded
      if (!groupKeywords[groupId]) {
        await fetchKeywordsInGroup(groupId);
      }
    }
    setExpandedGroups(newExpanded);
  };

  const handleAddGroup = async () => {
    if (!newGroup.name.trim()) {
      alert('Vui lòng nhập tên nhóm');
      return;
    }

    try {
      await keywordsApi.createGroup({
        name: newGroup.name,
        description: newGroup.description || null,
        priority: newGroup.priority,
        is_active: true
      });
      
      setShowAddGroupModal(false);
      setNewGroup({ name: '', description: '', priority: 3 });
      alert('Thêm nhóm thành công!');
      fetchGroups();
    } catch (error: any) {
      console.error('Error adding group:', error);
      alert('Lỗi khi thêm nhóm: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleAddKeyword = async () => {
    if (!newKeyword.keyword.trim() || !selectedGroupId) {
      alert('Vui lòng nhập từ khóa');
      return;
    }

    try {
      await keywordsApi.createKeyword({
        keyword: newKeyword.keyword,
        keyword_type: newKeyword.keyword_type,
        group_id: selectedGroupId,
        is_active: true
      });
      
      setShowAddKeywordModal(false);
      setNewKeyword({ keyword: '', keyword_type: 'general' });
      alert('Thêm từ khóa thành công!');
      
      // Refresh keywords in group
      await fetchKeywordsInGroup(selectedGroupId);
      // Refresh groups to update count
      fetchGroups();
    } catch (error: any) {
      console.error('Error adding keyword:', error);
      alert('Lỗi khi thêm từ khóa: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteKeyword = async (keywordId: number, groupId: number) => {
    if (!confirm('Bạn có chắc muốn xóa từ khóa này?')) return;

    try {
      await keywordsApi.deleteKeyword(keywordId);
      alert('Xóa từ khóa thành công!');
      
      // Refresh keywords in group
      await fetchKeywordsInGroup(groupId);
      // Refresh groups to update count
      fetchGroups();
    } catch (error: any) {
      console.error('Error deleting keyword:', error);
      alert('Lỗi khi xóa từ khóa: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleToggleKeywordActive = async (keyword: Keyword) => {
    try {
      await keywordsApi.updateKeyword(keyword.id, {
        is_active: !keyword.is_active
      });
      
      // Refresh keywords in group
      await fetchKeywordsInGroup(keyword.group_id);
    } catch (error: any) {
      console.error('Error toggling keyword:', error);
      alert('Lỗi khi cập nhật từ khóa: ' + (error.response?.data?.detail || error.message));
    }
  };

  const openAddKeywordModal = (groupId: number) => {
    setSelectedGroupId(groupId);
    setShowAddKeywordModal(true);
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPriorityColor = (priority: number) => {
    if (priority >= 4) return 'bg-red-100 text-red-800';
    if (priority >= 3) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getPriorityText = (priority: number) => {
    if (priority >= 4) return 'Cao';
    if (priority >= 3) return 'Trung bình';
    return 'Thấp';
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
            Quản lý các nhóm từ khóa và từ khóa để giám sát
          </p>
        </div>
        <button
          onClick={() => setShowAddGroupModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5 mr-2" />
          Thêm nhóm
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Tìm kiếm nhóm từ khóa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Groups List */}
      <div className="space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Không có nhóm từ khóa nào. Hãy tạo nhóm đầu tiên!
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.id} className="bg-white rounded-lg shadow">
              {/* Group Header */}
              <div className="p-4 flex items-center justify-between border-b">
                <div className="flex items-center space-x-4 flex-1">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {expandedGroups.has(group.id) ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </button>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h3 className="font-semibold text-gray-900">{group.name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(group.priority)}`}>
                        {getPriorityText(group.priority)}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        group.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {group.is_active ? 'Hoạt động' : 'Tắt'}
                      </span>
                    </div>
                    {group.description && (
                      <p className="text-sm text-gray-500 mt-1">{group.description}</p>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    {group.keyword_count} từ khóa
                  </div>
                </div>
                
                <button
                  onClick={() => openAddKeywordModal(group.id)}
                  className="ml-4 px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Thêm từ khóa
                </button>
              </div>

              {/* Keywords List */}
              {expandedGroups.has(group.id) && (
                <div className="p-4">
                  {!groupKeywords[group.id] ? (
                    <div className="text-center text-gray-500 py-4">Đang tải...</div>
                  ) : groupKeywords[group.id].length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                      Chưa có từ khóa nào trong nhóm này
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {groupKeywords[group.id].map((keyword) => (
                        <div
                          key={keyword.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                        >
                          <div className="flex items-center space-x-3">
                            <span className="font-medium text-gray-900">{keyword.keyword}</span>
                            <span className="text-xs text-gray-500">{keyword.keyword_type}</span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleToggleKeywordActive(keyword)}
                              className={`px-2 py-1 text-xs font-medium rounded-full ${
                                keyword.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {keyword.is_active ? 'ON' : 'OFF'}
                            </button>
                            <button
                              onClick={() => handleDeleteKeyword(keyword.id, group.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Add Group Modal */}
      {showAddGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Thêm nhóm từ khóa mới</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên nhóm *
                </label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ví dụ: Chất lượng sản phẩm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Mô tả về nhóm từ khóa này..."
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Độ ưu tiên (1-5)
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={newGroup.priority}
                  onChange={(e) => setNewGroup({ ...newGroup, priority: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddGroupModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Hủy
              </button>
              <button
                onClick={handleAddGroup}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Keyword Modal */}
      {showAddKeywordModal && (
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
                  Loại từ khóa
                </label>
                <select
                  value={newKeyword.keyword_type}
                  onChange={(e) => setNewKeyword({ ...newKeyword, keyword_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="general">General</option>
                  <option value="brand">Brand</option>
                  <option value="product">Product</option>
                  <option value="competitor">Competitor</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddKeywordModal(false)}
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
