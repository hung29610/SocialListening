'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertTriangle, FileText, Send, X, Package } from 'lucide-react';
import { serviceRequests as serviceRequestsApi, getErrorMessage } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import toast, { Toaster } from 'react-hot-toast';

/* SIGNAL shared micro-interaction primitive (150–250ms, reduced-motion honored) */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';

export default function ServiceRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [request, setRequest] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [actionNote, setActionNote] = useState('');

  const requestId = Number(params?.id);
  const isAdmin = user?.is_superuser === true;

  useEffect(() => {
    if (requestId) {
      fetchData();
    }
  }, [requestId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reqData, logsData, delData] = await Promise.allSettled([
        serviceRequestsApi.get(requestId),
        serviceRequestsApi.getLogs(requestId),
        serviceRequestsApi.getDeliverables(requestId)
      ]);

      if (reqData.status === 'fulfilled') setRequest(reqData.value);
      if (logsData.status === 'fulfilled') setLogs(logsData.value);
      if (delData.status === 'fulfilled') setDeliverables(delData.value);
    } catch (error: any) {
      toast.error('Lỗi khi tải chi tiết yêu cầu');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionFn: any, payload: any, modalSetter: any) => {
    try {
      await actionFn(requestId, payload);
      toast.success('Thao tác thành công!');
      modalSetter(false);
      setActionNote('');
      fetchData();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi thực hiện thao tác');
    }
  };

  const getStatusColor = (status: string) => {
    // Status ladder on SIGNAL semantic tokens: success = done/approved,
    // destructive = rejected, warning = waiting states, info = submitted,
    // signal = actively in progress, neutral paper scale = draft/cancelled.
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-paper-muted">Đang tải...</div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-bold text-paper">Không tìm thấy yêu cầu</h2>
        <button onClick={() => router.push('/dashboard/services')} className={`text-signal dark:text-signal-bright hover:underline rounded ${focusRing}`}>
          Quay lại danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.push('/dashboard/services')} className={`p-2 bg-void-surface border border-edge rounded-xl hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>
            <ArrowLeft className="w-5 h-5 text-paper-muted" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-paper flex items-center gap-2">
              Yêu Cầu <span className="text-signal dark:text-signal-bright tabular-nums">#{request.id}</span>
            </h1>
            <p className="text-sm text-paper-muted mt-1">{request.service?.name}</p>
          </div>
        </div>

        {/* Actions based on role and status */}
        <div className="flex space-x-3">
          {request.status === 'draft' && (
            <button onClick={() => setShowSubmitModal(true)} className={`flex items-center px-4 py-2 bg-signal text-white rounded-lg hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none ${focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-void`}>
              <Send className="w-4 h-4 mr-2" /> Gửi yêu cầu
            </button>
          )}

          {['draft', 'submitted', 'pending_approval'].includes(request.status) && (
            <button onClick={() => setShowCancelModal(true)} className={`flex items-center px-4 py-2 bg-void-raised border border-edge-strong text-paper-muted rounded-lg hover:text-paper hover:bg-void-surface transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>
              <X className="w-4 h-4 mr-2" /> Hủy
            </button>
          )}

          {isAdmin && request.approval_status === 'pending' && (
            <>
              <button onClick={() => setShowRejectModal(true)} className={`px-4 py-2 bg-destructive/10 text-destructive border border-destructive/25 rounded-lg hover:bg-destructive/20 transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>
                Từ chối
              </button>
              <button onClick={() => handleAction(serviceRequestsApi.approve, {}, () => {})} className={`px-4 py-2 bg-success/10 text-success border border-success/25 rounded-lg hover:bg-success/20 transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>
                Phê duyệt
              </button>
            </>
          )}

          {isAdmin && (request.status === 'in_progress' || request.status === 'waiting_external_response') && (
            <button onClick={() => setShowCompleteModal(true)} className={`flex items-center px-4 py-2 bg-signal text-white rounded-lg hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none ${focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-void`}>
              <CheckCircle className="w-4 h-4 mr-2" /> Hoàn thành
            </button>
          )}

          {isAdmin && request.status === 'approved' && (
             <button onClick={() => handleAction(serviceRequestsApi.update, { status: 'in_progress' }, () => {})} className={`px-4 py-2 bg-signal text-white rounded-lg hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none ${focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-void`}>
               Bắt đầu xử lý
             </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-void-surface border border-edge rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-paper mb-4">Chi tiết yêu cầu</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-paper-faint uppercase">Trạng thái</p>
                <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-bold uppercase rounded ${getStatusColor(request.status)}`}>
                  {request.status.replace('_', ' ')}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold text-paper-faint uppercase">Lý do</p>
                <p className="text-sm text-paper-muted mt-1">{request.request_reason || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-paper-faint uppercase">Kết quả mong muốn</p>
                <p className="text-sm text-paper-muted mt-1">{request.desired_outcome || 'N/A'}</p>
              </div>
              {request.result_summary && (
                <div className="bg-success/10 border border-success/25 p-4 rounded-xl mt-4">
                  <p className="text-xs font-semibold text-success uppercase">Kết quả thực tế</p>
                  <p className="text-sm text-paper mt-1">{request.result_summary}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-void-surface border border-edge rounded-xl p-6 shadow-sm">
             <h3 className="text-lg font-bold text-paper mb-4 flex items-center">
               <Package className="w-5 h-5 mr-2 text-signal dark:text-signal-bright" />
               Deliverables ({deliverables.length})
             </h3>
             {deliverables.length === 0 ? (
               <p className="text-sm text-paper-faint italic">Chưa có kết quả bàn giao nào.</p>
             ) : (
               <div className="space-y-3">
                 {deliverables.map(d => (
                   <div key={d.id} className="p-3 border border-edge rounded-lg bg-void-raised">
                     <p className="text-sm font-medium text-paper">{d.name}</p>
                     {d.description && <p className="text-xs text-paper-faint mt-1">{d.description}</p>}
                     {d.file_url && <a href={d.file_url} target="_blank" rel="noreferrer" className={`text-xs text-signal dark:text-signal-bright hover:underline mt-2 inline-block rounded ${focusRing}`}>Xem tệp đính kèm</a>}
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>

        {/* Right Column: Timelines & Info */}
        <div className="space-y-6">
          <div className="bg-void-surface border border-edge rounded-xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-paper mb-4">Thông tin</h3>
            <div className="space-y-4">
               <div>
                  <p className="text-xs font-semibold text-paper-faint uppercase">Dịch vụ</p>
                  <p className="text-sm font-medium text-paper-muted">{request.service?.name}</p>
               </div>
               <div>
                  <p className="text-xs font-semibold text-paper-faint uppercase">Ngày tạo</p>
                  <p className="text-sm font-medium text-paper-muted tabular-nums">{new Date(request.created_at).toLocaleString('vi-VN')}</p>
               </div>
               <div>
                  <p className="text-xs font-semibold text-paper-faint uppercase">Ưu tiên</p>
                  <p className="text-sm font-medium text-paper-muted capitalize">{request.priority}</p>
               </div>
            </div>
          </div>

          <div className="bg-void-surface border border-edge rounded-xl p-6 shadow-sm">
             <h3 className="text-lg font-bold text-paper mb-4 flex items-center">
               <Clock className="w-5 h-5 mr-2 text-paper-faint" />
               Nhật ký hoạt động
             </h3>
             <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                {logs.length === 0 ? (
                  <p className="text-sm text-paper-faint italic">Không có nhật ký nào.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="relative pl-4 border-l-2 border-signal/30 pb-4 last:pb-0">
                      <div className="absolute w-2 h-2 bg-signal rounded-full -left-[5px] top-1.5" />
                      <p className="text-xs text-paper-faint tabular-nums">{new Date(log.created_at).toLocaleString('vi-VN')}</p>
                      <p className="text-sm font-medium text-paper mt-0.5">
                        {log.action.replace('_', ' ').toUpperCase()}
                      </p>
                      {log.note && <p className="text-sm text-paper-muted mt-1">{log.note}</p>}
                    </div>
                  ))
                )}
             </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/25 dark:bg-void/70">
          <div className="bg-void-surface border border-edge shadow-tile p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 text-paper">Từ chối yêu cầu</h3>
            <textarea
              className="w-full p-3 border border-edge-strong rounded-lg bg-void-surface text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
              rows={4}
              placeholder="Nhập lý do từ chối..."
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowRejectModal(false)} className={`px-4 py-2 bg-void-raised border border-edge text-paper-muted hover:text-paper rounded-lg transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>Hủy</button>
              <button onClick={() => handleAction(serviceRequestsApi.reject, { note: actionNote }, setShowRejectModal)} className={`px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors duration-150 motion-reduce:transition-none ${focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-void`}>Từ chối</button>
            </div>
          </div>
        </div>
      )}

      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/25 dark:bg-void/70">
          <div className="bg-void-surface border border-edge shadow-tile p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 text-paper">Hoàn thành yêu cầu</h3>
            <textarea
              className="w-full p-3 border border-edge-strong rounded-lg bg-void-surface text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
              rows={4}
              placeholder="Nhập tóm tắt kết quả thực tế..."
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowCompleteModal(false)} className={`px-4 py-2 bg-void-raised border border-edge text-paper-muted hover:text-paper rounded-lg transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>Hủy</button>
              <button onClick={() => handleAction(serviceRequestsApi.complete, { result_summary: actionNote }, setShowCompleteModal)} className={`px-4 py-2 bg-signal text-white rounded-lg hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none ${focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-void`}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/25 dark:bg-void/70">
          <div className="bg-void-surface border border-edge shadow-tile p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 text-paper">Gửi yêu cầu</h3>
            <textarea
              className="w-full p-3 border border-edge-strong rounded-lg bg-void-surface text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
              rows={2}
              placeholder="Ghi chú thêm (không bắt buộc)..."
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowSubmitModal(false)} className={`px-4 py-2 bg-void-raised border border-edge text-paper-muted hover:text-paper rounded-lg transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>Hủy</button>
              <button onClick={() => handleAction(serviceRequestsApi.submit, { note: actionNote }, setShowSubmitModal)} className={`px-4 py-2 bg-signal text-white rounded-lg hover:bg-signal-deep dark:hover:bg-signal-bright transition-colors duration-150 motion-reduce:transition-none ${focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-void`}>Gửi</button>
            </div>
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-paper/25 dark:bg-void/70">
          <div className="bg-void-surface border border-edge shadow-tile p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 text-paper">Hủy yêu cầu</h3>
            <textarea
              className="w-full p-3 border border-edge-strong rounded-lg bg-void-surface text-paper placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
              rows={3}
              placeholder="Lý do hủy..."
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowCancelModal(false)} className={`px-4 py-2 bg-void-raised border border-edge text-paper-muted hover:text-paper rounded-lg transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>Đóng</button>
              <button onClick={() => handleAction(serviceRequestsApi.cancel, { note: actionNote }, setShowCancelModal)} className={`px-4 py-2 bg-edge-strong text-paper rounded-lg hover:bg-edge transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>Xác nhận hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
