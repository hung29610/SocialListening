'use client';

import { Clock, Monitor, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SessionsSettings() {
  const handleLogoutOthers = () => {
    // TODO: Call POST /api/me/logout-other-sessions
    toast.success('Đã đăng xuất tất cả phiên khác');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Phiên đăng nhập</h2>
        <p className="text-sm text-gray-600 mt-1">Quản lý các phiên đăng nhập của bạn</p>
      </div>

      {/* Current Session */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Phiên hiện tại</h3>
        
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <Monitor className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Windows - Chrome</p>
            <p className="text-xs text-gray-500 mt-1">Hà Nội, Việt Nam</p>
            <div className="flex items-center mt-2 text-xs text-gray-500">
              <Clock className="w-3 h-3 mr-1" />
              Đăng nhập lúc: {new Date().toLocaleString('vi-VN')}
            </div>
          </div>
          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
            Đang hoạt động
          </span>
        </div>
      </div>

      {/* Other Sessions */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Phiên khác</h3>
          <button
            onClick={handleLogoutOthers}
            className="flex items-center px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Đăng xuất tất cả
          </button>
        </div>

        <div className="text-center py-8 text-gray-500">
          <Monitor className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-sm">Không có phiên đăng nhập nào khác</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Lưu ý:</strong> Nếu bạn thấy phiên đăng nhập không quen thuộc, hãy đăng xuất tất cả và đổi mật khẩu ngay.
        </p>
      </div>
    </div>
  );
}
