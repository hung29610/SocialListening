'use client';

import { useState } from 'react';
import { Shield, Plus, Edit2, Trash2 } from 'lucide-react';

interface Role {
  id: number;
  code: string;
  name: string;
  description: string;
  permissions: string[];
}

export default function RoleManagement() {
  const [roles] = useState<Role[]>([
    {
      id: 1,
      code: 'super_admin',
      name: 'Quản trị viên cấp cao',
      description: 'Toàn quyền truy cập hệ thống',
      permissions: ['*']
    },
    {
      id: 2,
      code: 'admin',
      name: 'Quản trị viên',
      description: 'Quản lý người dùng và cấu hình',
      permissions: ['users.manage', 'settings.manage', 'roles.view']
    },
    {
      id: 3,
      code: 'manager',
      name: 'Quản lý',
      description: 'Quản lý nội dung và báo cáo',
      permissions: ['mentions.manage', 'reports.manage', 'incidents.manage']
    },
    {
      id: 4,
      code: 'analyst',
      name: 'Phân tích viên',
      description: 'Xem và phân tích dữ liệu',
      permissions: ['mentions.view', 'reports.view', 'dashboard.view']
    },
    {
      id: 5,
      code: 'viewer',
      name: 'Người xem',
      description: 'Chỉ xem dữ liệu',
      permissions: ['dashboard.view', 'mentions.view']
    }
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Quản lý vai trò</h2>
          <p className="text-sm text-gray-600 mt-1">Định nghĩa vai trò và quyền hạn trong hệ thống</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4 mr-2" />
          Thêm vai trò
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((role) => (
          <div key={role.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Shield className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{role.name}</h3>
                  <p className="text-xs text-gray-500">{role.code}</p>
                </div>
              </div>
              <div className="flex space-x-1">
                <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                {!['super_admin', 'admin'].includes(role.code) && (
                  <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-3">{role.description}</p>

            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Quyền hạn:</p>
              <div className="flex flex-wrap gap-1">
                {role.permissions.map((perm, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Lưu ý:</strong> Vai trò Super Admin và Admin không thể xóa. Thay đổi quyền hạn sẽ ảnh hưởng đến tất cả người dùng có vai trò đó.
        </p>
      </div>
    </div>
  );
}
