import React, { useState, useEffect } from 'react';
import { X, Lock, Plus, Trash2, ExternalLink, Link2, FileText, CameraOff } from 'lucide-react';
import { evidence, getErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { useDialog } from '@/components/ui/Dialog';

interface EvidenceLockerModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: any;
}

export default function EvidenceLockerModal({ isOpen, onClose, incident }: EvidenceLockerModalProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { confirm } = useDialog();
  
  // New evidence form
  const [showAdd, setShowAdd] = useState(false);
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen && incident) {
      fetchEvidence();
    } else {
      setItems([]);
      setShowAdd(false);
      setUrl('');
      setNote('');
    }
  }, [isOpen, incident]);

  const fetchEvidence = async () => {
    setLoading(true);
    try {
      const data = await evidence.list(incident.id);
      setItems(data || []);
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi tải dữ liệu bằng chứng');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTextSnapshot = async () => {
    if (!url.trim()) {
      toast.error('Vui lòng nhập URL hoặc mô tả');
      return;
    }
    setSubmitting(true);
    try {
      await evidence.create(incident.id, {
        file_name: 'Text Snapshot',
        file_path: note || 'Không có ghi chú',
        file_type: 'text/html',
        capture_method: 'manual',
        original_url: url,
        metadata: JSON.stringify({ note })
      });
      toast.success('Lưu bằng chứng thành công');
      setShowAdd(false);
      setUrl('');
      setNote('');
      fetchEvidence();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi lưu bằng chứng');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Xóa bằng chứng',
      message: 'Bạn có chắc chắn muốn xóa bằng chứng này?',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await evidence.delete(id);
      toast.success('Xóa thành công');
      fetchEvidence();
    } catch (error: any) {
      toast.error(getErrorMessage(error) || 'Lỗi khi xóa');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-paper/25 dark:bg-void/75 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-void rounded-2xl shadow-tile border border-edge flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-edge bg-void-surface rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-signal/10 border border-signal/25 rounded-xl">
              <Lock className="w-5 h-5 text-signal dark:text-signal-bright" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-paper tracking-wide">Evidence Locker</h2>
              <p className="text-xs text-paper-muted mt-0.5 font-medium tracking-wide">
                Bảo vệ bằng chứng cho sự cố #{incident?.id}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-paper-muted hover:text-paper hover:bg-paper/[0.04] rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-void-surface border border-info/30 rounded-xl p-4 flex items-start space-x-3">
            <CameraOff className="w-5 h-5 text-info mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-info">Chưa tích hợp chụp ảnh màn hình tự động (Screenshot)</h4>
              <p className="text-xs text-paper-muted mt-1 leading-relaxed">
                Trong giai đoạn MVP, tính năng lưu trữ chụp ảnh bằng chứng gốc tự động chưa được bật. 
                Bạn có thể lưu dạng Text Snapshot (URL và ghi chú).
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-paper tracking-wide uppercase">Danh sách bằng chứng</h3>
            {!showAdd && (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center text-xs font-semibold text-signal dark:text-signal-bright bg-signal/10 hover:bg-signal/15 px-3 py-1.5 rounded-lg border border-signal/25 transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Thêm Bằng Chứng
              </button>
            )}
          </div>

          {showAdd && (
            <div className="bg-void-surface border border-edge-strong p-5 rounded-xl space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-signal"></div>
              <div>
                <label className="block text-eyebrow font-semibold text-paper-faint mb-1.5 uppercase">URL Nguồn</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-void border border-edge-strong text-paper text-sm rounded-xl px-4 py-2.5 outline-none transition-colors duration-150 motion-reduce:transition-none placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal"
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div>
                <label className="block text-eyebrow font-semibold text-paper-faint mb-1.5 uppercase">Ghi chú (Tùy chọn)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full bg-void border border-edge-strong text-paper text-sm rounded-xl px-4 py-2.5 outline-none transition-colors duration-150 motion-reduce:transition-none placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal resize-none"
                  placeholder="Người đăng nhắc đến..."
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowAdd(false)}
                  className="px-4 py-2 text-xs font-semibold text-paper-muted hover:text-paper rounded-lg transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveTextSnapshot}
                  disabled={submitting}
                  className="px-4 py-2 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu Snapshot'}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-10 text-paper-muted text-sm font-medium tracking-wide">Đang tải...</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 bg-void-surface border border-edge rounded-xl border-dashed">
              <FileText className="w-8 h-8 text-paper-faint mx-auto mb-3" />
              <p className="text-sm text-paper-faint font-medium tracking-wide">Chưa có bằng chứng nào được lưu</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="bg-void-surface border border-edge p-4 rounded-xl flex items-start justify-between group hover:border-edge-strong transition-colors duration-150 motion-reduce:transition-none">
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-void-raised rounded-lg border border-edge mt-0.5">
                      <Link2 className="w-4 h-4 text-paper-muted" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-paper uppercase tracking-wide">{item.file_name}</span>
                        <span className="text-[10px] text-paper-faint tabular-nums">{new Date(item.captured_at).toLocaleString('vi-VN')}</span>
                      </div>
                      <a
                        href={item.original_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-signal dark:text-signal-bright hover:underline flex items-center mt-1 w-fit group/link rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                      >
                        <span className="truncate max-w-xs">{item.original_url}</span>
                        <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-50 group-hover/link:opacity-100" />
                      </a>
                      {item.file_path && item.file_path !== 'Không có ghi chú' && (
                        <p className="text-xs text-paper-muted mt-2 bg-void-raised p-2 rounded border border-edge">
                          {item.file_path}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 text-paper-faint hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors duration-150 motion-reduce:transition-none opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                    title="Xóa bằng chứng"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
