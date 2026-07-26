'use client';

import { useState, useEffect } from 'react';
import { Shield, Facebook, Instagram, CheckCircle2, XCircle, Loader2, ArrowLeft, Plug, LogOut, CheckSquare, Square } from 'lucide-react';
import Link from 'next/link';
import { useDialog } from '@/components/ui/Dialog';

interface MetaAccount {
  id: number;
  external_id: string;
  provider: string;
  account_type: string;
  name: string;
  selected: boolean;
}

interface MetaStatus {
  status: 'config_required' | 'oauth_required' | 'limited' | 'active';
  label: string;
  message: string;
  granted_scopes: string[];
  missing_scopes: string[];
  accounts: MetaAccount[];
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';
const focusRingOffset =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void';

export default function MetaIntegrationPage() {
  const { confirm } = useDialog();
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Using relative URLs to proxy through Next.js rewrites

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/integrations/meta/status`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setMetaStatus(data);
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/integrations/meta/auth-url`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Không lấy được URL kết nối');
        setActionLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi gọi API');
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const ok = await confirm({
      title: 'Ngắt kết nối Meta',
      message: 'Bạn có chắc muốn ngắt kết nối Meta? Mọi tài khoản đang đồng bộ sẽ bị dừng.',
      variant: 'danger'
    });
    if (!ok) return;
    try {
      setActionLoading(true);
      await fetch(`/api/integrations/meta/disconnect`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      await fetchStatus();
      setSuccessMsg('Đã ngắt kết nối thành công.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Lỗi khi ngắt kết nối');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAccount = async (accountId: string, currentSelected: boolean) => {
    try {
      const res = await fetch(`/api/integrations/meta/select-account`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ account_id: accountId, selected: !currentSelected })
      });
      if (res.ok) {
        // Update local state smoothly
        setMetaStatus(prev => prev ? {
          ...prev,
          accounts: prev.accounts.map(acc =>
            acc.external_id === accountId ? { ...acc, selected: !currentSelected } : acc
          )
        } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTestConnection = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/integrations/meta/test-connection`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Kết nối hoạt động tốt!');
      } else {
        setError(data.message || 'Lỗi kết nối');
      }
      setTimeout(() => { setSuccessMsg(''); setError(''); }, 3000);
    } catch (err) {
      console.error(err);
      setError('Không thể test kết nối.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Link href="/dashboard/sources" className={`inline-flex items-center text-sm font-medium text-paper-muted hover:text-paper mb-6 transition-colors duration-150 motion-reduce:transition-none rounded ${focusRing}`}>
        <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại Quản lý Nguồn
      </Link>

      <div className="bg-void-surface border border-edge rounded-3xl overflow-hidden shadow-tile">
        <div className="p-8 border-b border-edge bg-void-raised relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-signal/50" />
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-signal/10 rounded-2xl border border-signal/25">
              <Facebook className="w-8 h-8 text-signal dark:text-signal-bright" />
            </div>
            <div className="p-3 bg-signal/10 rounded-2xl border border-signal/25">
              <Instagram className="w-8 h-8 text-signal dark:text-signal-bright" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-paper mb-2 tracking-tight">Kết nối Facebook & Instagram</h1>
          <p className="text-paper-muted max-w-2xl leading-relaxed">
            Nope360 sử dụng Meta OAuth chính thức để kết nối Facebook Page và Instagram Business/Creator.
            Hệ thống <strong>không yêu cầu mật khẩu</strong> và chỉ thu thập dữ liệu trong phạm vi quyền bạn cấp.
          </p>
        </div>

        <div className="p-8 space-y-8">
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/25 rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="text-destructive text-sm">{error}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-success/10 border border-success/25 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
              <div className="text-success text-sm">{successMsg}</div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-8 h-8 text-signal dark:text-signal-bright animate-spin" />
            </div>
          ) : metaStatus ? (
            <>
              {/* Status Section */}
              <div className="bg-void-raised border border-edge rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-paper mb-1">Trạng thái kết nối</h2>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-eyebrow ${
                        metaStatus.status === 'active' ? 'bg-success/10 text-success border border-success/25'
                        : metaStatus.status === 'limited' ? 'bg-warning/10 text-warning border border-warning/25'
                        : 'bg-paper-faint/10 text-paper-muted border border-paper-faint/20'
                      }`}>
                        {metaStatus.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    {(metaStatus.status === 'active' || metaStatus.status === 'limited') ? (
                      <>
                        <button
                          onClick={handleTestConnection}
                          disabled={actionLoading}
                          className={`flex-1 sm:flex-none px-4 py-2 bg-signal/10 hover:bg-signal/20 text-signal dark:text-signal-bright border border-signal/25 rounded-xl text-sm font-medium transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 ${focusRing}`}
                        >
                          Kiểm tra kết nối
                        </button>
                        <button
                          onClick={handleDisconnect}
                          disabled={actionLoading}
                          className={`flex-1 sm:flex-none px-4 py-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/25 rounded-xl text-sm font-medium transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 flex items-center justify-center gap-2 ${focusRing}`}
                        >
                          <LogOut className="w-4 h-4" /> Ngắt kết nối
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleConnect}
                        disabled={actionLoading || metaStatus.status === 'config_required'}
                        className={`w-full sm:w-auto px-6 py-2.5 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white rounded-xl text-sm font-medium transition-colors duration-150 motion-reduce:transition-none flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${focusRingOffset}`}
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                        Connect Facebook / Instagram
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-sm text-paper-muted mt-2 bg-paper/[0.04] p-3 rounded-xl border border-edge">
                  <Shield className="w-4 h-4 inline-block mr-1 text-paper-faint" />
                  {metaStatus.message}
                </p>
              </div>

              {/* Permissions Section */}
              {(metaStatus.status === 'active' || metaStatus.status === 'limited') && (
                <div className="bg-void-raised border border-edge rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-paper mb-4">Quyền truy cập đã cấp (Scopes)</h2>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {metaStatus.granted_scopes.map((scope, idx) => (
                      <span key={idx} className="px-3 py-1 bg-success/10 border border-success/25 text-success text-xs rounded-lg flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {scope}
                      </span>
                    ))}
                    {metaStatus.missing_scopes.map((scope, idx) => (
                      <span key={idx} className="px-3 py-1 bg-destructive/10 border border-destructive/25 text-destructive text-xs rounded-lg flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> {scope} (thiếu)
                      </span>
                    ))}
                  </div>
                  {metaStatus.missing_scopes.length > 0 && (
                    <p className="text-xs text-warning mt-2">
                      ⚠️ Bạn đã từ chối một số quyền. Hệ thống sẽ không thể thu thập đủ dữ liệu. Vui lòng kết nối lại và cấp đủ quyền.
                    </p>
                  )}
                </div>
              )}

              {/* Accounts Section */}
              {(metaStatus.status === 'active' || metaStatus.status === 'limited') && (
                <div className="bg-void-raised border border-edge rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-paper">Tài khoản & Trang (Pages)</h2>
                    <span className="text-xs text-paper-muted">Chọn nguồn để thu thập</span>
                  </div>

                  {metaStatus.accounts.length === 0 ? (
                    <div className="text-center py-8 text-paper-faint text-sm bg-paper/[0.04] rounded-xl border border-edge">
                      Không tìm thấy Page hoặc tài khoản Instagram Business nào.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {metaStatus.accounts.map(acc => (
                        <div
                          key={acc.id}
                          onClick={() => handleToggleAccount(acc.external_id, acc.selected)}
                          className={`p-4 rounded-xl border transition-colors duration-150 motion-reduce:transition-none cursor-pointer flex items-center gap-4 ${
                            acc.selected ? 'bg-signal/10 border-signal/25' : 'bg-void-surface border-edge hover:border-edge-strong'
                          }`}
                        >
                          <div className="flex-shrink-0">
                            {acc.provider === 'facebook' ? (
                              <div className="w-10 h-10 rounded-full bg-signal/10 flex items-center justify-center border border-signal/25">
                                <Facebook className="w-5 h-5 text-signal dark:text-signal-bright" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-signal/10 flex items-center justify-center border border-signal/25">
                                <Instagram className="w-5 h-5 text-signal dark:text-signal-bright" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-paper truncate">{acc.name}</h3>
                            <p className="text-xs text-paper-faint uppercase tracking-eyebrow">{acc.account_type}</p>
                          </div>
                          <div>
                            {acc.selected ? (
                              <CheckSquare className="w-5 h-5 text-signal dark:text-signal-bright" />
                            ) : (
                              <Square className="w-5 h-5 text-paper-faint" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
