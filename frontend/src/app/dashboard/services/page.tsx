'use client';

import { useEffect, useState } from 'react';
import { Plus, Search, Eye, Edit, Trash2, CheckCircle, XCircle, Clock, AlertTriangle, FileText, DollarSign } from 'lucide-react';
import { services as servicesApi, serviceRequests as serviceRequestsApi, getErrorMessage } from '@/lib/api';
import toast, { Toaster } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/contexts/LanguageContext';

/* SIGNAL shared micro-interaction primitive (150–250ms, reduced-motion honored) */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';

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
  const router = useRouter();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'catalog' | 'requests'>('overview');
  const [services, setServices] = useState<Service[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [showServiceDetail, setShowServiceDetail] = useState(false);
  const [showRequestDetail, setShowRequestDetail] = useState(false);
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
      toast.error(t('servicesPage.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
    setShowServiceDetail(true);
  };

  const handleRequestClick = (request: ServiceRequest) => {
    router.push(`/dashboard/service-requests/${request.id}`);
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
      toast.error(t('servicesPage.errors.missingFields'));
      return;
    }
    try {
      await serviceRequestsApi.create(requestForm);
      toast.success(t('servicesPage.requestCreated'));
      setShowCreateRequest(false);
      fetchData();
    } catch (error: any) {
      console.error('Error creating request:', error);
      toast.error(getErrorMessage(error) || t('servicesPage.errors.createRequestFailed'));
    }
  };

  // Status ladder on SIGNAL semantic tokens: success = done/approved,
  // destructive = rejected, warning = waiting states, info = submitted,
  // signal = actively in progress, neutral paper scale = draft/cancelled.
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'draft': 'bg-void-raised text-paper-muted border-edge',
      'submitted': 'bg-info/10 text-info border-info/25',
      'pending_approval': 'bg-warning/10 text-warning border-warning/25',
      'approved': 'bg-success/10 text-success border-success/25',
      'in_progress': 'bg-signal/10 text-signal dark:text-signal-bright border-signal/25',
      'waiting_external_response': 'bg-warning/[0.06] text-warning border-warning/20',
      'completed': 'bg-success/10 text-success border-success/25',
      'rejected': 'bg-destructive/10 text-destructive border-destructive/25',
      'cancelled': 'bg-void-raised text-paper-muted border-edge'
    };
    return `${colors[status] || 'bg-void-raised text-paper-muted border-edge'} border`;
  };

  const getApprovalStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'not_required': 'bg-void-raised text-paper-muted border-edge',
      'pending': 'bg-warning/10 text-warning border-warning/25',
      'approved': 'bg-success/10 text-success border-success/25',
      'rejected': 'bg-destructive/10 text-destructive border-destructive/25',
      'revision_required': 'bg-warning/[0.06] text-warning border-warning/20'
    };
    return `${colors[status] || 'bg-void-raised text-paper-muted border-edge'} border`;
  };

  // Severity ladder (contract rule 6): urgent/critical → destructive,
  // high → warning, medium → weaker warning tint, low → sentiment-neutral.
  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-sentiment-neutral/10 text-sentiment-neutral border-sentiment-neutral/25',
      'medium': 'bg-warning/[0.06] text-warning border-warning/20',
      'high': 'bg-warning/10 text-warning border-warning/25',
      'urgent': 'bg-destructive/10 text-destructive border-destructive/25'
    };
    return `${colors[priority] || 'bg-void-raised text-paper-muted border-edge'} border`;
  };

  const getRiskLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      'low': 'bg-sentiment-neutral/10 text-sentiment-neutral border-sentiment-neutral/25',
      'medium': 'bg-warning/[0.06] text-warning border-warning/20',
      'high': 'bg-warning/10 text-warning border-warning/25',
      'critical': 'bg-destructive/10 text-destructive border-destructive/25'
    };
    return `${colors[level] || 'bg-void-raised text-paper-muted border-edge'} border`;
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
        <div className="text-lg text-paper-muted">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Toaster position="top-right" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-paper tracking-wide">{t('servicesPage.title')}</h1>
        <p className="text-sm text-paper-muted mt-1">
          {t('servicesPage.subtitle')}
        </p>
      </div>

      {/* Compliance Notice */}
      <div className="bg-warning/10 border border-warning/25 rounded-xl p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
          <div className="text-sm text-paper-muted">
            <strong className="text-warning">{t('servicesPage.compliance.label')}</strong> {t('servicesPage.compliance.body')}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-edge">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {[
            { key: 'overview', label: t('servicesPage.tabs.overview'), icon: DollarSign },
            { key: 'catalog', label: t('servicesPage.tabs.catalog'), icon: FileText },
            { key: 'requests', label: t('servicesPage.tabs.requests'), icon: Clock }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center space-x-2 py-3 px-2 border-b-2 font-medium text-sm transition-colors duration-150 motion-reduce:transition-none whitespace-nowrap ${focusRing} ${
                activeTab === key
                  ? 'border-signal text-signal dark:text-signal-bright'
                  : 'border-transparent text-paper-muted hover:text-paper hover:border-edge-strong'
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
            <div className="bg-void-surface border border-edge rounded-xl shadow-sm hover:shadow-md p-6 hover:border-edge-strong transition-all duration-150 motion-reduce:transition-none">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-paper-muted">{t('servicesPage.summary.activeServices')}</p>
                  <p className="text-3xl font-black text-paper tabular-nums mt-2">{dashboardSummary.total_active_services}</p
                </div>
                <div className="bg-signal/10 border border-signal/20 p-3 rounded-xl">
                  <FileText className="w-6 h-6 text-signal dark:text-signal-bright" />
                </div>
              </div>
            </div>

            <div className="bg-void-surface border border-edge rounded-xl shadow-sm hover:shadow-md p-6 hover:border-edge-strong transition-all duration-150 motion-reduce:transition-none">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-paper-muted">{t('servicesPage.summary.openRequests')}</p>
                  <p className="text-3xl font-black text-paper tabular-nums mt-2">{dashboardSummary.open_service_requests}</p
                </div>
                <div className="bg-warning/10 border border-warning/25 p-3 rounded-xl">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
              </div>
            </div>

            <div className="bg-void-surface border border-edge rounded-xl shadow-sm hover:shadow-md p-6 hover:border-edge-strong transition-all duration-150 motion-reduce:transition-none">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-paper-muted">{t('servicesPage.summary.pendingApprovals')}</p>
                  <p className="text-3xl font-black text-paper tabular-nums mt-2">{dashboardSummary.pending_approvals}</p
                </div>
                <div className="bg-warning/10 border border-warning/25 p-3 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-warning" />
                </div>
              </div>
            </div>

            <div className="bg-void-surface border border-edge rounded-xl shadow-sm hover:shadow-md p-6 hover:border-edge-strong transition-all duration-150 motion-reduce:transition-none">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-paper-muted">{t('servicesPage.summary.completed')}</p>
                  <p className="text-3xl font-black text-paper tabular-nums mt-2">{dashboardSummary.completed_requests}</p
                </div>
                <div className="bg-success/10 border border-success/25 p-3 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-success" />
                </div>
              </div>
            </div>

            <div className="bg-void-surface border border-edge rounded-xl shadow-sm hover:shadow-md p-6 hover:border-edge-strong transition-all duration-150 motion-reduce:transition-none">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-paper-muted">{t('servicesPage.summary.highRisk')}</p>
                  <p className="text-3xl font-black text-paper tabular-nums mt-2">{dashboardSummary.high_risk_requests}</p
                </div>
                <div className="bg-destructive/10 border border-destructive/25 p-3 rounded-xl">
                  <XCircle className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </div>

            <div className="bg-void-surface border border-edge rounded-xl shadow-sm hover:shadow-md p-6 hover:border-edge-strong transition-all duration-150 motion-reduce:transition-none">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-paper-muted">{t('servicesPage.summary.monthlyCost')}</p>
                  <p className="text-2xl font-black text-paper tabular-nums mt-2">{formatPrice(dashboardSummary.monthly_estimated_cost)}</p
                </div>
                <div className="bg-void-raised border border-edge p-3 rounded-xl">
                  <DollarSign className="w-6 h-6 text-paper-muted" />
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
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-paper-faint w-5 h-5" />
            <input
              type="text"
              placeholder={t('servicesPage.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-void-surface border border-edge-strong rounded-xl text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal shadow-sm"
            />
          </div>

          {/* Services Table */}
          <div className="bg-void-surface border border-edge rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-edge">
                <thead className="bg-void-raised">
                  <tr className="border-b border-edge">
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.table.service')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.fields.category')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.fields.platform')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.fields.basePrice')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      SLA
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.table.risk')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.table.approval')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {filteredServices.map((service) => (
                    <tr key={service.id} className="border-b border-edge hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-bold text-paper">{service.name}</div>
                          <div className="text-sm text-paper-muted truncate max-w-xs mt-0.5">{service.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-paper-muted">{service.category.name}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-paper-muted capitalize">{service.platform.replace('_', ' ')}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap tabular-nums">
                        <span className="text-sm font-medium text-paper">
                          {service.base_price ? formatPrice(service.base_price) : t('servicesPage.negotiablePrice')}
                        </span>
                        {service.unit && (
                          <span className="text-xs text-paper-faint ml-1">/{service.unit}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap tabular-nums">
                        <span className="text-sm font-medium text-paper-muted">
                          {service.sla_hours ? `${service.sla_hours}h` : service.estimated_duration}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-eyebrow font-bold rounded ${getRiskLevelColor(service.risk_level)}`}>
                          {service.risk_level}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {service.requires_approval ? (
                          <CheckCircle className="w-5 h-5 text-warning" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-success" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleServiceClick(service)}
                          className={`p-2 text-paper-faint hover:text-signal dark:hover:text-signal-bright hover:bg-signal/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-signal/20 ${focusRing}`}
                          title={t('servicesPage.actions.viewDetail')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCreateRequest(service)}
                          className={`p-2 text-paper-faint hover:text-signal dark:hover:text-signal-bright hover:bg-signal/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-signal/20 ${focusRing}`}
                          title={t('servicesPage.actions.createRequest')}
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
          <div className="bg-void-surface border border-edge rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-edge">
                <thead className="bg-void-raised">
                  <tr className="border-b border-edge">
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      ID
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.table.service')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.table.status')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.table.priority')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.table.approval')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.table.price')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.table.createdAt')}
                    </th>
                    <th scope="col" className="px-6 py-4 text-left text-eyebrow font-semibold uppercase text-paper-faint">
                      {t('servicesPage.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge">
                  {serviceRequests.map((request) => (
                    <tr key={request.id} className="border-b border-edge hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-signal dark:text-signal-bright tabular-nums">
                        #{request.id}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-bold text-paper">{request.service.name}</div>
                          <div className="text-sm text-paper-muted mt-0.5">{request.service.category.name}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-eyebrow font-bold rounded ${getStatusColor(request.status)}`}>
                          {request.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-eyebrow font-bold rounded ${getPriorityColor(request.priority)}`}>
                          {request.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-eyebrow font-bold rounded ${getApprovalStatusColor(request.approval_status)}`}>
                          {request.approval_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-paper tabular-nums">
                        {request.final_price ? formatPrice(request.final_price) :
                         request.quoted_price ? formatPrice(request.quoted_price) : t('servicesPage.notQuoted')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-paper-faint tabular-nums">
                        {new Date(request.created_at).toLocaleString('vi-VN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleRequestClick(request)}
                          className={`p-2 text-paper-faint hover:text-signal dark:hover:text-signal-bright hover:bg-signal/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none border border-transparent hover:border-signal/20 ${focusRing}`}
                          title={t('servicesPage.actions.viewDetail')}
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
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none" onClick={() => setShowServiceDetail(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-void-surface border border-edge rounded-2xl shadow-tile w-full max-w-4xl transform transition-all overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-edge bg-void-raised shrink-0">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-paper pr-4">{selectedService.name}</h2>
                  <button
                    onClick={() => setShowServiceDetail(false)}
                    className={`text-paper-faint hover:text-paper transition-colors duration-150 motion-reduce:transition-none shrink-0 rounded-lg ${focusRing}`}
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-bold text-paper mb-4">{t('servicesPage.detail.basicInfo')}</h3>
                    <div className="space-y-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">{t('servicesPage.fields.serviceCode')}</span>
                        <span className="text-sm font-medium text-paper">{selectedService.code}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">{t('servicesPage.fields.category')}</span>
                        <span className="text-sm font-medium text-paper">{selectedService.category.name}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">{t('servicesPage.fields.serviceType')}</span>
                        <span className="text-sm font-medium text-paper capitalize">{selectedService.service_type.replace('_', ' ')}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">{t('servicesPage.fields.platform')}</span>
                        <span className="text-sm font-medium text-paper capitalize">{selectedService.platform.replace('_', ' ')}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">{t('servicesPage.fields.riskLevel')}</span>
                        <div className="mt-1">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-eyebrow rounded ${getRiskLevelColor(selectedService.risk_level)}`}>
                            {selectedService.risk_level}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-paper mb-4">{t('servicesPage.detail.priceAndSla')}</h3>
                    <div className="space-y-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">{t('servicesPage.fields.basePrice')}</span>
                        <span className="text-sm font-bold text-paper tabular-nums">
                          {selectedService.base_price ? formatPrice(selectedService.base_price) : t('servicesPage.negotiablePrice')}
                          {selectedService.unit && <span className="text-paper-faint ml-1 font-medium">/{selectedService.unit}</span>}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">{t('servicesPage.fields.estimatedDuration')}</span>
                        <span className="text-sm font-medium text-paper">{selectedService.estimated_duration}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">SLA</span>
                        <span className="text-sm font-medium text-paper tabular-nums">{selectedService.sla_hours}h</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">{t('servicesPage.fields.minQuantity')}</span>
                        <span className="text-sm font-medium text-paper tabular-nums">{selectedService.min_quantity || 1} {selectedService.unit}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">{t('servicesPage.fields.requiresApproval')}</span>
                        <div className="mt-1">
                          {selectedService.requires_approval ? (
                            <span className="inline-flex items-center text-warning bg-warning/10 border border-warning/25 px-2 py-1 rounded text-xs font-medium">
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              {t('servicesPage.required')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-success bg-success/10 border border-success/25 px-2 py-1 rounded text-xs font-medium">
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              {t('servicesPage.notRequired')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>


                <div className="pt-4 border-t border-edge">
                  <h3 className="text-lg font-bold text-paper mb-3">{t('servicesPage.fields.description')}</h3>
                  <p className="text-sm text-paper-muted leading-relaxed bg-void-raised p-4 rounded-xl border border-edge">{selectedService.description}</p>
                </div>

                {selectedService.legal_basis && (
                  <div className="pt-4 border-t border-edge">
                    <h3 className="text-lg font-bold text-paper mb-3">{t('servicesPage.detail.legalBasis')}</h3>
                    <p className="text-sm text-paper-muted leading-relaxed bg-void-raised p-4 rounded-xl border border-edge">{selectedService.legal_basis}</p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-edge bg-void-raised flex justify-end space-x-3 shrink-0">
                <button
                  onClick={() => setShowServiceDetail(false)}
                  className={`px-5 py-2.5 text-paper-muted bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised hover:text-paper transition-colors duration-150 motion-reduce:transition-none font-medium ${focusRing}`}
                >
                  {t('servicesPage.actions.close')}
                </button>
                <button
                  onClick={() => {
                    setShowServiceDetail(false);
                    handleCreateRequest(selectedService);
                  }}
                  className={`px-5 py-2.5 text-white bg-signal rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none font-medium ${focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-void`}
                >
                  {t('servicesPage.actions.createRequest')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Create Service Request Modal */}
      {showCreateRequest && selectedService && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="fixed inset-0 bg-paper/25 dark:bg-void/70 backdrop-blur-sm transition-opacity duration-150 motion-reduce:transition-none" onClick={() => setShowCreateRequest(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-void-surface border border-edge rounded-2xl shadow-tile w-full max-w-3xl transform transition-all overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-edge bg-void-raised shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-paper">{t('servicesPage.createModal.title')}</h2>
                    <p className="text-sm text-paper-muted mt-1">{selectedService.name}</p>
                  </div>
                  <button
                    onClick={() => setShowCreateRequest(false)}
                    className={`text-paper-faint hover:text-paper transition-colors duration-150 motion-reduce:transition-none rounded-lg ${focusRing}`}
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto">
                {/* Service Info */}
                <div className="bg-signal/10 border border-signal/25 rounded-xl p-5">
                  <div className="grid grid-cols-2 gap-6 text-sm">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">{t('servicesPage.fields.category')}</span>
                      <span className="font-medium text-paper">{selectedService.category.name}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">{t('servicesPage.fields.basePrice')}</span>
                      <span className="font-bold text-signal dark:text-signal-bright tabular-nums">
                        {selectedService.base_price ? formatPrice(selectedService.base_price) : t('servicesPage.negotiablePrice')}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">{t('servicesPage.fields.estimatedDuration')}</span>
                      <span className="font-medium text-paper">{selectedService.estimated_duration}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-paper-faint uppercase tracking-eyebrow mb-1">SLA</span>
                      <span className="font-medium text-paper tabular-nums">{selectedService.sla_hours}h</span>
                    </div>
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('servicesPage.form.priority')} <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={requestForm.priority}
                    onChange={(e) => setRequestForm({ ...requestForm, priority: e.target.value })}
                    className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper"
                  >
                    <option value="low">{t('servicesPage.priority.low')}</option>
                    <option value="medium">{t('servicesPage.priority.medium')}</option>
                    <option value="high">{t('servicesPage.priority.high')}</option>
                    <option value="urgent">{t('servicesPage.priority.urgent')}</option>
                  </select>
                </div>

                {/* Request Reason */}
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('servicesPage.form.requestReason')} <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    value={requestForm.request_reason}
                    onChange={(e) => setRequestForm({ ...requestForm, request_reason: e.target.value })}
                    rows={3}
                    placeholder={t('servicesPage.form.requestReasonPlaceholder')}
                    className="w-full px-4 py-3 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper placeholder:text-paper-faint resize-none"
                  />
                </div>

                {/* Evidence Summary */}
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('servicesPage.form.evidenceSummary')}
                  </label>
                  <textarea
                    value={requestForm.evidence_summary}
                    onChange={(e) => setRequestForm({ ...requestForm, evidence_summary: e.target.value })}
                    rows={3}
                    placeholder={t('servicesPage.form.evidenceSummaryPlaceholder')}
                    className="w-full px-4 py-3 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper placeholder:text-paper-faint resize-none"
                  />
                </div>

                {/* Desired Outcome */}
                <div>
                  <label className="block text-sm font-medium text-paper-muted mb-2">
                    {t('servicesPage.form.desiredOutcome')} <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    value={requestForm.desired_outcome}
                    onChange={(e) => setRequestForm({ ...requestForm, desired_outcome: e.target.value })}
                    rows={3}
                    placeholder={t('servicesPage.form.desiredOutcomePlaceholder')}
                    className="w-full px-4 py-3 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper placeholder:text-paper-faint resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Quoted Price */}
                  <div>
                    <label className="block text-sm font-medium text-paper-muted mb-2">
                      {t('servicesPage.form.quotedPrice')}
                    </label>
                    <input
                      type="number"
                      value={requestForm.quoted_price}
                      onChange={(e) => setRequestForm({ ...requestForm, quoted_price: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper tabular-nums"
                    />
                  </div>

                  {/* Deadline */}
                  <div>
                    <label className="block text-sm font-medium text-paper-muted mb-2">
                      {t('servicesPage.form.deadline')}
                    </label>
                    <input
                      type="datetime-local"
                      value={requestForm.deadline}
                      onChange={(e) => setRequestForm({ ...requestForm, deadline: e.target.value })}
                      className="w-full px-4 py-2.5 bg-void-surface border border-edge-strong rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal text-paper tabular-nums"
                    />
                  </div>
                </div>

                {/* Compliance Notice */}
                <div className="bg-warning/10 border border-warning/25 rounded-xl p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-warning mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-paper-muted">
                      <strong className="text-warning">{t('servicesPage.createModal.noticeLabel')}</strong> {t('servicesPage.createModal.noticeBody')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-edge bg-void-raised flex justify-end space-x-3 shrink-0">
                <button
                  onClick={() => setShowCreateRequest(false)}
                  className={`px-5 py-2.5 text-paper-muted bg-void-surface border border-edge-strong rounded-xl hover:bg-void-raised hover:text-paper transition-colors duration-150 motion-reduce:transition-none font-medium ${focusRing}`}
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleSubmitRequest}
                  disabled={!requestForm.request_reason || !requestForm.desired_outcome}
                  className={`px-5 py-2.5 text-white bg-signal rounded-xl hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed font-medium ${focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-void`}
                >
                  {t('servicesPage.actions.createRequest')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
