'use client';

import { useEffect, useState } from 'react';
import { keywords } from '@/lib/api';
import { Plus, Search, Edit2, Trash2, Key } from 'lucide-react';

export default function KeywordsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const data = await keywords.listGroups();
      setGroups(data);
    } catch (error) {
      console.error('Failed to fetch keyword groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-3xl font-bold text-gray-900">Quản lý từ khóa</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tạo và quản lý nhóm từ khóa để giám sát
          </p>
        </div>
        <button
          onClick={() => setShowGroupModal(true)}
          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tạo nhóm từ khóa
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm nhóm từ khóa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Groups List */}
      {filteredGroups.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Key className="w-12 h-12 mx-auto text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            Chưa có nhóm từ khóa
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            Tạo nhóm từ khóa đầu tiên để bắt đầu giám sát
          </p>
          <button
            onClick={() => setShowGroupModal(true)}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Tạo nhóm từ khóa
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {filteredGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onEdit={() => {
                setSelectedGroup(group);
                setShowGroupModal(true);
              }}
              onAddKeyword={() => {
                setSelectedGroup(group);
                setShowKeywordModal(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showGroupModal && (
        <GroupModal
          group={selectedGroup}
          onClose={() => {
            setShowGroupModal(false);
            setSelectedGroup(null);
          }}
          onSuccess={() => {
            fetchGroups();
            setShowGroupModal(false);
            setSelectedGroup(null);
          }}
        />
      )}

      {showKeywordModal && (
        <KeywordModal
          groupId={selectedGroup?.id}
          onClose={() => {
            setShowKeywordModal(false);
            setSelectedGroup(null);
          }}
          onSuccess={() => {
            fetchGroups();
            setShowKeywordModal(false);
            setSelectedGroup(null);
          }}
        />
      )}
    </div>
  );
}

function GroupCard({ group, onEdit, onAddKeyword }: any) {
  return (
    <div className="p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
          {group.description && (
            <p className="mt-1 text-sm text-gray-600">{group.description}</p>
          )}
        </div>
        <button
          onClick={onEdit}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>

      {/* Keywords */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Từ khóa ({group.keywords?.length || 0})
          </span>
          <button
            onClick={onAddKeyword}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            + Thêm từ khóa
          </button>
        </div>

        {group.keywords && group.keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {group.keywords.map((kw: any) => (
              <span
                key={kw.id}
                className="inline-flex items-center px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-full"
              >
                {kw.keyword}
                {kw.is_negative && (
                  <span className="ml-1 text-xs text-red-600">(loại trừ)</span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Chưa có từ khóa nào</p>
        )}
      </div>

      {/* Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Trạng thái:</span>
          <span className={`font-medium ${group.is_active ? 'text-green-600' : 'text-gray-400'}`}>
            {group.is_active ? 'Đang hoạt động' : 'Tạm dừng'}
          </span>
        </div>
      </div>
    </div>
  );
}

function GroupModal({ group, onClose, onSuccess }: any) {
  const [formData, setFormData] = useState({
    name: group?.name || '',
    description: group?.description || '',
    is_active: group?.is_active ?? true,
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await keywords.createGroup(formData);
      onSuccess();
    } catch (error) {
      console.error('Failed to create group:', error);
      alert('Không thể tạo nhóm từ khóa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
        <h2 className="text-xl font-bold text-gray-900">
          {group ? 'Chỉnh sửa nhóm từ khóa' : 'Tạo nhóm từ khóa mới'}
        </h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tên nhóm *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="VD: Thương hiệu chính"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Mô tả
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Mô tả mục đích của nhóm từ khóa này"
            />
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
              {loading ? 'Đang lưu...' : group ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function KeywordModal({ groupId, onClose, onSuccess }: any) {
  const [formData, setFormData] = useState({
    keyword_group_id: groupId,
    keyword: '',
    is_negative: false,
    match_type: 'contains',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await keywords.createKeyword(formData);
      onSuccess();
    } catch (error) {
      console.error('Failed to create keyword:', error);
      alert('Không thể tạo từ khóa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
        <h2 className="text-xl font-bold text-gray-900">Thêm từ khóa mới</h2>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Từ khóa *
            </label>
            <input
              type="text"
              required
              value={formData.keyword}
              onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="VD: tên thương hiệu"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Kiểu khớp
            </label>
            <select
              value={formData.match_type}
              onChange={(e) => setFormData({ ...formData, match_type: e.target.value })}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="contains">Chứa từ khóa</option>
              <option value="exact">Khớp chính xác</option>
              <option value="starts_with">Bắt đầu bằng</option>
              <option value="ends_with">Kết thúc bằng</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_negative"
              checked={formData.is_negative}
              onChange={(e) => setFormData({ ...formData, is_negative: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_negative" className="ml-2 text-sm text-gray-700">
              Từ khóa loại trừ (bỏ qua kết quả chứa từ này)
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
              {loading ? 'Đang lưu...' : 'Thêm từ khóa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
