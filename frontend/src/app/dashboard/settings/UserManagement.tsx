'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Key, Power, Crown, User as UserIcon, X } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';

interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  created_at: string;
  updated_at: string | null;
}

interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  superusers: number;
  normal_users: number;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [filterSuperuser, setFilterSuperuser] = useState<boolean | null>(null);
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Confirm dialogs
  const [confirmDelete, setConfirmDelete] = useState<{ show: boolean; user: User | null }>({ show: false, user: null });
  const [confirmToggle, setConfirmToggle] = useState<{ show: boolean; user: User | null }>({ show: false, user: null });

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [searchTerm, filterActive, filterSuperuser]);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (filterActive !== null) params.append('is_active', String(filterActive));
      if (filterSuperuser !== null) params.append('is_superuser', String(filterSuperuser));

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/stats/summary`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleCreateUser = async (userData: any) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(userData),
        }
      );

      if (response.ok) {
        setShowCreateModal(false);
        fetchUsers();
        fetchStats();
      } else {
        const error = await response.json();
        alert(error.detail || 'Lỗi khi tạo người dùng');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Lỗi khi tạo người dùng');
    }
  };

  const handleUpdateUser = async (userId: number, userData: any) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${userId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(userData),
        }
      );

      if (response.ok) {
        setShowEditModal(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        const error = await response.json();
        alert(error.detail || 'Lỗi khi cập nhật người dùng');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Lỗi khi cập nhật người dùng');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${userId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        fetchUsers();
        fetchStats();
      } else {
        const error = await response.json();
        alert(error.detail || 'Lỗi khi xóa người dùng');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Lỗi khi xóa người dùng');
    }
  };

  const handleToggleActive = async (userId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${userId}/toggle-active`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        fetchUsers();
        fetchStats();
      } else {
        const error = await response.json();
        alert(error.detail || 'Lỗi khi thay đổi trạng thái');
      }
    } catch (error) {
      console.error('Error toggling active:', error);
      alert('Lỗi khi thay đổi trạng thái');
    }
  };

  const handleResetPassword = async (userId: number, newPassword: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${userId}/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ new_password: newPassword }),
        }
      );

      if (response.ok) {
        setShowResetPasswordModal(false);
        setSelectedUser(null);
        alert('Đặt lại mật khẩu thành công');
      } else {
        const error = await response.json();
        alert(error.detail || 'Lỗi khi đặt lại mật khẩu');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Lỗi khi đặt lại mật khẩu');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Đang tải...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatCard label="Tổng số" value={stats.total_users} color="blue" />
          <StatCard label="Đang hoạt động" value={stats.active_users} color="green" />
          <StatCard label="Vô hiệu hóa" value={stats.inactive_users} color="gray" />
          <StatCard label="Quản trị viên" value={stats.superusers} color="purple" />
          <StatCard label="Người dùng" value={stats.normal_users} color="indigo" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm kiếm theo email hoặc tên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <select
          value={filterActive === null ? '' : String(filterActive)}
          onChange={(e) => setFilterActive(e.target.value === '' ? null : e.target.value === 'true')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Vô hiệu hóa</option>
        </select>

        <select
          value={filterSuperuser === null ? '' : String(filterSuperuser)}
          onChange={(e) => setFilterSuperuser(e.target.value === '' ? null : e.target.value === 'true')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả quyền</option>
          <option value="true">Quản trị viên</option>
          <option value="false">Người dùng</option>
        </select>

        {/* Create button */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Thêm người dùng
        </button>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Người dùng
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quyền
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày tạo
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{user.full_name || 'N/A'}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.is_superuser ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        <Crown className="w-3 h-3 mr-1" />
                        Quản trị viên
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <UserIcon className="w-3 h-3 mr-1" />
                        Người dùng
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {user.is_active ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ✗ Vô hiệu hóa
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowEditModal(true);
                      }}
                      className="inline-flex items-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Sửa"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowResetPasswordModal(true);
                      }}
                      className="inline-flex items-center p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                      title="Đặt lại mật khẩu"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmToggle({ show: true, user })}
                      className="inline-flex items-center p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      title={user.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ show: true, user })}
                      className="inline-flex items-center p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Không tìm thấy người dùng nào
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <UserFormModal
          title="Thêm người dùng mới"
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateUser}
        />
      )}

      {showEditModal && selectedUser && (
        <UserFormModal
          title="Sửa thông tin người dùng"
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSubmit={(data) => handleUpdateUser(selectedUser.id, data)}
        />
      )}

      {showResetPasswordModal && selectedUser && (
        <ResetPasswordModal
          user={selectedUser}
          onClose={() => {
            setShowResetPasswordModal(false);
            setSelectedUser(null);
          }}
          onSubmit={(password) => handleResetPassword(selectedUser.id, password)}
        />
      )}

      {/* Confirm dialogs */}
      <ConfirmDialog
        isOpen={confirmDelete.show}
        title="Xác nhận xóa người dùng"
        message={`Bạn có chắc chắn muốn xóa người dùng "${confirmDelete.user?.email}"? Hành động này không thể hoàn tác.`}
        type="danger"
        onConfirm={() => {
          if (confirmDelete.user) {
            handleDeleteUser(confirmDelete.user.id);
          }
          setConfirmDelete({ show: false, user: null });
        }}
        onCancel={() => setConfirmDelete({ show: false, user: null })}
      />

      <ConfirmDialog
        isOpen={confirmToggle.show}
        title={confirmToggle.user?.is_active ? 'Vô hiệu hóa người dùng' : 'Kích hoạt người dùng'}
        message={`Bạn có chắc chắn muốn ${confirmToggle.user?.is_active ? 'vô hiệu hóa' : 'kích hoạt'} người dùng "${confirmToggle.user?.email}"?`}
        type="warning"
        onConfirm={() => {
          if (confirmToggle.user) {
            handleToggleActive(confirmToggle.user.id);
          }
          setConfirmToggle({ show: false, user: null });
        }}
        onCancel={() => setConfirmToggle({ show: false, user: null })}
      />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    gray: 'bg-gray-50 text-gray-700',
    purple: 'bg-purple-50 text-purple-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  };

  return (
    <div className={`p-4 rounded-lg ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm">{label}</div>
    </div>
  );
}

function UserFormModal({
  title,
  user,
  onClose,
  onSubmit,
}: {
  title: string;
  user?: User;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    email: user?.email || '',
    password: '',
    full_name: user?.full_name || '',
    is_superuser: user?.is_superuser || false,
    is_active: user?.is_active ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // For edit, only send changed fields
    if (user) {
      const updates: any = {};
      if (formData.email !== user.email) updates.email = formData.email;
      if (formData.full_name !== user.full_name) updates.full_name = formData.full_name;
      if (formData.is_superuser !== user.is_superuser) updates.is_superuser = formData.is_superuser;
      if (formData.is_active !== user.is_active) updates.is_active = formData.is_active;
      onSubmit(updates);
    } else {
      // For create, send all fields
      onSubmit(formData);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {!user && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu *
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Họ tên
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_superuser"
              checked={formData.is_superuser}
              onChange={(e) => setFormData({ ...formData, is_superuser: e.target.checked })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="is_superuser" className="ml-2 text-sm text-gray-700">
              Quản trị viên (Superuser)
            </label>
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
              Kích hoạt tài khoản
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {user ? 'Cập nhật' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onSubmit,
}: {
  user: User;
  onClose: () => void;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Mật khẩu xác nhận không khớp');
      return;
    }
    if (password.length < 6) {
      alert('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold">Đặt lại mật khẩu</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            Đặt lại mật khẩu cho: <strong>{user.email}</strong>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu mới *
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Xác nhận mật khẩu *
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
            >
              Đặt lại mật khẩu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
