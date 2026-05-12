'use client';

import { useState, useEffect } from 'react';
import { Shield, Plus, Edit2, Trash2, X, Check, Users } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  permissions: string[];
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

interface RoleFormData {
  name: string;
  display_name: string;
  description: string;
  permissions: string[];
  is_active: boolean;
}

export default function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState<RoleFormData>({
    name: '',
    display_name: '',
    description: '',
    permissions: [],
    is_active: true
  });

  useEffect(() => {
    loadRoles();
    loadAvailablePermissions();
  }, []);

  const loadRoles = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/admin/roles/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load roles');
      
      const data = await response.json();
      setRoles(data);
    } catch (error) {
      console.error('Error loading roles:', error);
      toast.error('Không thể tải danh sách vai trò');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailablePermissions = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('https://social-listening-backend.onrender.com/api/admin/roles/permissions/available', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load permissions');
      
      const data = await response.json();
      setAvailablePermissions(data);
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  const handleCreate = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      display_name: '',
      description: '',
      permissions: [],
      is_active: true
    });
    setShowModal(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      display_name: role.display_name,
      description: role.description || '',
      permissions: role.permissions,
      is_active: role.is_active
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('access_token');
      const url = editingRole
        ? `https://social-listening-backend.onrender.com/api/admin/roles/${editingRole.id}`
        : 'https://social-listening-backend.onrender.com/api/admin/roles/';
      
      const method = editingRole ? 'PUT' : 'POST';
      
      // For system roles, only send permissions and is_active
      const payload = editingRole?.is_system
        ? { permissions: formData.permissions, is_active: formData.is_active }
        : formData;

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to save role');
      }

      toast.success(editingRole ? 'Cập nhật vai trò thành công' : 'Tạo vai trò thành công');
      setShowModal(false);
      loadRoles();
    } catch (error: any) {
      console.error('Error saving role:', error);
      toast.error(error.message || 'Không thể lưu vai trò');
    }
  };

  const handleDelete = async (role: Role) => {
    if (!confirm(`Bạn có chắc muốn xóa vai trò "${role.display_name}"?`)) return;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`https://social-listening-backend.onrender.com/api/admin/roles/${role.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete role');
      }

      toast.success('Xóa vai trò thành công');
      loadRoles();
    } catch (error: any) {
      console.error('Error deleting role:', error);
      toast.error(error.message || 'Không thể xóa vai trò');
    }
  };

  const togglePermission = (permission: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  if (loading) {
    return <div className="text-center py-8">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Quản lý vai trò</h2>
          <p className="text-sm text-gray-600 mt-1">Định nghĩa vai trò và quyền hạn trong hệ thống</p>
        </div>
        <button 
          onClick={handleCreate}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Thêm vai trò
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((role) => (
          <div key={role.id} className={`bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow ${!role.is_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${role.is_system ? 'bg-purple-100' : 'bg-blue-100'}`}>
                  <Shield className={`w-5 h-5 ${role.is_system ? 'text-purple-600' : 'text-blue-600'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{role.display_name}</h3>
                  <p className="text-xs text-gray-500">{role.name}</p>
                  {role.is_system && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                      Hệ thống
                    </span>
                  )}
                </div>
              </div>
              <div className="flex space-x-1">
                <button 
                  onClick={() => handleEdit(role)}
                  className="p-2 text-gray-600 hover:text-blue-600"
                  title="Chỉnh sửa"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {!role.is_system && (
                  <button 
                    onClick={() => handleDelete(role)}
                    className="p-2 text-gray-600 hover:text-red-600"
                    title="Xóa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {role.description && (
              <p className="text-sm text-gray-600 mb-3">{role.description}</p>
            )}

            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Quyền hạn ({role.permissions.length}):</p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.slice(0, 5).map((perm, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                  >
                    {perm}
                  </span>
                ))}
                {role.permissions.length > 5 && (
                  <span className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded">
                    +{role.permissions.length - 5} more
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {editingRole ? `Chỉnh sửa vai trò: ${editingRole.display_name}` : 'Tạo vai trò mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {editingRole?.is_system && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                  <strong>Lưu ý:</strong> Vai trò hệ thống chỉ có thể chỉnh sửa quyền hạn và trạng thái.
                </div>
              )}

              {!editingRole?.is_system && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mã vai trò <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., content_moderator"
                      required
                      disabled={!!editingRole}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tên hiển thị <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.display_name}
                      onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Người kiểm duyệt nội dung"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Mô tả vai trò này..."
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quyền hạn <span className="text-red-500">*</span>
                </label>
                <div className="border border-gray-300 rounded-lg p-3 max-h-60 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-2">
                    {availablePermissions.map((permission) => (
                      <label key={permission} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(permission)}
                          onChange={() => togglePermission(permission)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{permission}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Đã chọn: {formData.permissions.length} quyền
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Vai trò đang hoạt động
                </label>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingRole ? 'Cập nhật' : 'Tạo vai trò'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Lưu ý:</strong> Vai trò hệ thống (Super Admin, Admin, Manager, Analyst, Viewer) không thể xóa. 
          Thay đổi quyền hạn sẽ ảnh hưởng đến tất cả người dùng có vai trò đó.
        </p>
      </div>
    </div>
  );
}
