'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, CheckCircle, XCircle, Clock, AlertTriangle, FileText, DollarSign } from 'lucide-react';
import { services as servicesApi, serviceRequests as serviceRequestsApi, getErrorMessage } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';

interface ServiceCategory {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

interface Service {
  id: number;
  category_id: number;
  code: string;
  name: string;
  description: string;
  service_type: string;
  platform: string;
  legal_basis?: string;
  workflow_template?: any;
  deliverables?: any;
  estimated_duration: string;
  sla_hours: number;
  base_price: number;
  min_quantity?: number;
  unit: string;
  risk_level: string;
  requires_approval: boolean;
  is_active: boolean;
  category: ServiceCategory;
  created_at?: string;
  updated_at?: string;
}

interface ServiceRequest {
  id: number;
  service_id: number;
  status: string;
  priority: string;
  approval_status: string;
  quoted_price: number;
  final_price: number;
  deadline: string;
  created_at: string;
  service: Service;
}

interface DashboardSummary {
  total_active_services: number;
  open_service_requests: number;
  pending_approvals: number;
  completed_requests: number;
  high_risk_requests: number;
  monthly_estimated_cost: number;
}

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'catalog' | 'requests'>('overview');
  const [services, setServices] = useState<Service[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [showServiceDetail, setShowServiceDetail] = useState(false);
  const [showCreateRequest, setShowCreateRequest] = useState(false);
  
  // Form state for creating service request
  const [requestForm, setRequestForm] = useState({
    service_id: 0,
    priority: 'medium',
    request_reason: '',
    evidence_summary: '',
    desired_outcome: '',
    quoted_price: 0,
    deadline: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [servicesData, requestsData, summaryData] = await Promise.allSettled([
        servicesApi.list({ is_active: true }),
        serviceRequestsApi.list({ limit: 50 }),
        servicesApi.getDashboardSummary()
      ]);
      
      if (servicesData.status === 'fulfilled') setServices(servicesData.value);
      if (requestsData.status === 'fulfilled') setServiceRequests(requestsData.value);
      if (summaryData.status === 'fulfilled') setDashboardSummary(summaryData.value);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Lỗi khi tải dữ liệu dịch vụ');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setShowServiceDetail(true);
  };

  const handleCreateRequest = (service: Service) => {
    setSelectedService(service);
    setRequestForm({
      service_id: service.id,
      priority: 'medium',
      request_reason: '',
      evidence_summary: '',
      desired_outcome: '',
      quoted_price: service.base_price || 0,
      deadline: ''
    });
    setShowCreateRequest(true);
  };
  
  const handleSubmitRequest = async () => {
    if (!requestForm.request_reason || !requestForm.desired_outcome) {
      toast.error('Vui lòng điền đầy đủ lý do và kết quả mong muốn');
      return;
    }
    try {
      await serviceRequestsApi.create(requestForm);
      toast.success('Tạo yêu cầu dịch vụ thành công!');
      setShowCreateRequest(false);
      fetchData();
    } catch (error: any) {
      console.error('Error creating request:', error);
      toast.error(getErrorMessage(error) || 'Lỗi khi tạo yêu cầu dịch vụ');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'draft': 'bg-gray-100 text-gray-800',
      'submitted': 'bg-blue-100 text-blue-800',
      'pending_approval': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'in_progress': 'bg-indigo-100 text-indigo-800',
      'waiting_external_response': 'bg-orange-100 text-orange-800',
      'completed': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'cancelled': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getApprovalStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'not_required': 'bg-gray-100 text-gray-800',
      'pending': 'bg-yellow-100 text-yellow-800',
      'approved': 'bg-green-100 text-green-800',
      'rejected': 'bg-red-100 text-red-800',
      'revision_required': 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-green-100 text-green-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'high': 'bg-orange-100 text-orange-800',
      'urgent': 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const getRiskLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-green-100 text-green-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'high': 'bg-orange-100 text-orange-800',
      'critical': 'bg-red-100 text-red-800'
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  };

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    service.category.name.toLowerCase().includes(searchTerm.toLowerCase())
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
      <Toaster position="top-right" />
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dịch Vụ</h1>
        <p className="text-sm text-gray-500 mt-1">
          Quản lý các gói dịch vụ bảo vệ danh tiếng và xử lý khủng hoảng
        </p>
      </div>

      {/* Compliance Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <strong>Lưu ý tuân thủ:</strong> Tất cả quy trình dịch vụ trong hệ thống được thiết kế cho việc bảo vệ danh tiếng hợp pháp, 
            thu thập bằng chứng, soạn thảo phản hồi chính thức, báo cáo chính sách nền tảng và chuẩn bị yêu cầu gỡ bỏ/sửa chữa hợp pháp. 
            Hệ thống không hỗ trợ hack, DDoS, spam report, truy cập trái phép, chiếm đoạt tài khoản, scraping riêng tư hoặc thao túng nền tảng.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Tổng Quan', icon: DollarSign },
            { key: 'catalog', label: 'Danh Mục Dịch Vụ', icon: FileText },
            { key: 'requests', label: 'Yêu Cầu Dịch Vụ', icon: Clock }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && dashboardSummary && (
        <div className="space-y-6">
          {/* Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Dịch vụ hoạt động</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{dashboardSummary.total_active_services}</p>
                </div>
                <div className="bg-blue-500 p-3 rounded-lg">
                  <FileText className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Yêu cầu đang mở</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{dashboardSummary.open_service_requests}</p>
                </div>
                <div className="bg-orange-500 p-3 rounded-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Chờ phê duyệt</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{dashboardSummary.pending_approvals}</p>
                </div>
                <div className="bg-yellow-500 p-3 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Đã hoàn thành</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{dashboardSummary.completed_requests}</p>
                </div>
                <div className="bg-green-500 p-3 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Rủi ro cao</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{dashboardSummary.high_risk_requests}</p>
                </div>
                <div className="bg-red-500 p-3 rounded-lg">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Chi phí tháng này</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{formatPrice(dashboardSummary.monthly_estimated_cost)}</p>
                </div>
                <div className="bg-purple-500 p-3 rounded-lg">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Catalog Tab */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Tìm kiếm dịch vụ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Services Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dịch vụ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Danh mục
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nền tảng
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Giá cơ bản
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      SLA
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rủi ro
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phê duyệt
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredServices.map((service) => (
                    <tr key={service.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{service.name}</div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">{service.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">{service.category.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900 capitalize">{service.platform.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {service.base_price ? formatPrice(service.base_price) : 'Thỏa thuận'}
                        </span>
                        {service.unit && (
                          <span className="text-xs text-gray-500 ml-1">/{service.unit}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {service.sla_hours ? `${service.sla_hours}h` : service.estimated_duration}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskLevelColor(service.risk_level)}`}>
                          {service.risk_level}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {service.requires_approval ? (
                          <CheckCircle className="w-5 h-5 text-yellow-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-green-500" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleServiceClick(service)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCreateRequest(service)}
                          className="text-green-600 hover:text-green-900"
                          title="Tạo yêu cầu"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Service Requests Tab */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Service Requests Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dịch vụ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ưu tiên
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phê duyệt
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Giá
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tạo lúc
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {serviceRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{request.id}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{request.service.name}</div>
                          <div className="text-sm text-gray-500">{request.service.category.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                          {request.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(request.priority)}`}>
                          {request.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getApprovalStatusColor(request.approval_status)}`}>
                          {request.approval_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {request.final_price ? formatPrice(request.final_price) : 
                         request.quoted_price ? formatPrice(request.quoted_price) : 'Chưa báo giá'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(request.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          className="text-blue-600 hover:text-blue-900"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Service Detail Modal */}
      {showServiceDetail && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{selectedService.name}</h2>
                <button
                  onClick={() => setShowServiceDetail(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Thông tin cơ bản</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Mã dịch vụ:</span>
                      <span className="ml-2 text-sm text-gray-900">{selectedService.code}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Danh mục:</span>
                      <span className="ml-2 text-sm text-gray-900">{selectedService.category.name}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Loại dịch vụ:</span>
                      <span className="ml-2 text-sm text-gray-900 capitalize">{selectedService.service_type.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Nền tảng:</span>
                      <span className="ml-2 text-sm text-gray-900 capitalize">{selectedService.platform.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Mức rủi ro:</span>
                      <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getRiskLevelColor(selectedService.risk_level)}`}>
                        {selectedService.risk_level}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Giá và SLA</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm font-medium text-gray-700">Giá cơ bản:</span>
                      <span className="ml-2 text-sm text-gray-900">
                        {selectedService.base_price ? formatPrice(selectedService.base_price) : 'Thỏa thuận'}
                        {selectedService.unit && <span className="text-gray-500">/{selectedService.unit}</span>}
                      </span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Thời gian ước tính:</span>
                      <span className="ml-2 text-sm text-gray-900">{selectedService.estimated_duration}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">SLA:</span>
                      <span className="ml-2 text-sm text-gray-900">{selectedService.sla_hours}h</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Số lượng tối thiểu:</span>
                      <span className="ml-2 text-sm text-gray-900">{selectedService.unit}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700">Yêu cầu phê duyệt:</span>
                      <span className="ml-2">
                        {selectedService.requires_approval ? (
                          <CheckCircle className="w-4 h-4 text-yellow-500 inline" />
                        ) : (
                          <XCircle className="w-4 h-4 text-green-500 inline" />
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Mô tả</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{selectedService.description}</p>
              </div>
              
              {selectedService.legal_basis && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Cơ sở pháp lý</h3>
                  <p className="text-sm text-gray-700 leading-relaxed">{selectedService.legal_basis}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end space-x-3">
              <button
                onClick={() => setShowServiceDetail(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  setShowServiceDetail(false);
                  handleCreateRequest(selectedService);
                }}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Tạo yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Create Service Request Modal */}
      {showCreateRequest && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Tạo Yêu Cầu Dịch Vụ</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedService.name}</p>
                </div>
                <button
                  onClick={() => setShowCreateRequest(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Service Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Danh mục:</span>
                    <span className="ml-2 text-gray-900">{selectedService.category.name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Giá cơ bản:</span>
                    <span className="ml-2 text-gray-900">
                      {selectedService.base_price ? formatPrice(selectedService.base_price) : 'Thỏa thuận'}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Thời gian ước tính:</span>
                    <span className="ml-2 text-gray-900">{selectedService.estimated_duration}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">SLA:</span>
                    <span className="ml-2 text-gray-900">{selectedService.sla_hours}h</span>
                  </div>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mức độ ưu tiên <span className="text-red-500">*</span>
                </label>
                <select
                  value={requestForm.priority}
                  onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Thấp</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Cao</option>
                  <option value="urgent">Khẩn cấp</option>
                </select>
              </div>

              {/* Request Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lý do yêu cầu <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={requestForm.request_reason}
                  onChange={(e) => setRequestForm({ ...requestForm, request_reason: e.target.value })}
                  rows={3}
                  placeholder="Mô tả lý do cần dịch vụ này..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Evidence Summary */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tóm tắt bằng chứng
                </label>
                <textarea
                  value={requestForm.evidence_summary}
                  onChange={(e) => setRequestForm({ ...requestForm, evidence_summary: e.target.value })}
                  rows={3}
                  placeholder="Tóm tắt các bằng chứng, mentions, alerts liên quan..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Desired Outcome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kết quả mong muốn <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={requestForm.desired_outcome}
                  onChange={(e) => setRequestForm({ ...requestForm, desired_outcome: e.target.value })}
                  rows={3}
                  placeholder="Mô tả kết quả mong muốn từ dịch vụ này..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Quoted Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Giá báo (VND)
                </label>
                <input
                  type="number"
                  value={requestForm.quoted_price}
                  onChange={(e) => setRequestForm({ ...requestForm, quoted_price: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Thời hạn
                </label>
                <input
                  type="datetime-local"
                  value={requestForm.deadline}
                  onChange={(e) => setRequestForm({ ...requestForm, deadline: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Compliance Notice */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <strong>Lưu ý:</strong> Yêu cầu này sẽ được xem xét và phê duyệt trước khi thực hiện. 
                    Tất cả dịch vụ phải tuân thủ pháp luật và chính sách nền tảng.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateRequest(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={!requestForm.request_reason || !requestForm.desired_outcome}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Tạo yêu cầu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}