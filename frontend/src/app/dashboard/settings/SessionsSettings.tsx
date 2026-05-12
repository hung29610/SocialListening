'use client';

import { Clock, Monitor, LogOut, AlertCircle } from 'lucide-react';

export default function SessionsSettings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Phiên đăng nhập</h2>
        <p className="text-sm text-gray-600 mt-1">Quản lý các phiên đăng nhập của bạn</p>
      </div>

      {/* Pending Integration Notice */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <div className="flex items-start">
          <AlertCircle className="w-6 h-6 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-yellow-900 mb-2">
              ⚠️ Chưa tích hợp quản lý phiên đăng nhập
            </h3>
            <p className="text-sm text-yellow-800 mb-3">
              Tính năng quản lý phiên đăng nhập yêu cầu backend tracking JWT tokens (JTI). 
              Hiện tại hệ thống chưa lưu trữ thông tin phiên đăng nhập.
            </p>
            <p className="text-sm text-yellow-800">
              <strong>Để implement tính năng này cần:</strong>
            </p>
            <ul className="list-disc list-inside text-sm text-yellow-800 mt-2 space-y-1">
              <li>Lưu JWT JTI vào database khi user login</li>
              <li>Lưu thông tin: IP address, user agent, device type, location</li>
              <li>Kiểm tra JTI có bị revoke không ở mỗi request</li>
              <li>API để list sessions và revoke sessions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Current Session (Placeholder) */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 opacity-50">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Phiên hiện tại</h3>
        
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <Monitor className="w-6 h-6 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Windows - Chrome</p>
            <p className="text-xs text-gray-500 mt-1">Thông tin phiên chưa khả dụng</p>
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

      {/* Other Sessions (Disabled) */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 opacity-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Phiên khác</h3>
          <button
            disabled
            className="flex items-center px-4 py-2 text-gray-400 border border-gray-300 rounded-lg cursor-not-allowed"
            title="Tính năng chưa được tích hợp"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Đăng xuất tất cả
          </button>
        </div>

        <div className="text-center py-8 text-gray-400">
          <Monitor className="w-12 h-12 mx-auto mb-3" />
          <p className="text-sm">Không có dữ liệu phiên đăng nhập</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Lưu ý:</strong> Khi tính năng này được tích hợp, bạn sẽ có thể xem tất cả các thiết bị 
          đang đăng nhập và đăng xuất từ xa nếu phát hiện hoạt động đáng ngờ.
        </p>
      </div>
    </div>
  );
}
