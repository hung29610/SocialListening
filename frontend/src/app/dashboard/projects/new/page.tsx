'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { keywords as keywordsApi, crawl } from '@/lib/api';
import { useProject } from '@/contexts/ProjectContext';
import toast, { Toaster } from 'react-hot-toast';
import {
  ArrowRight, ArrowLeft, Loader2, Globe, FileText,
  Rss, Youtube, Facebook, Instagram, Video, ShieldAlert,
  CheckCircle2, AlertCircle
} from 'lucide-react';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';
const focusRingOffset =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void';
const wizardInputClass =
  'bg-void-surface border border-edge-strong rounded-xl text-paper text-lg placeholder:text-paper-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60 focus-visible:border-signal transition-colors duration-150 motion-reduce:transition-none';

export default function NewProjectPage() {
  const router = useRouter();
  const { fetchProjects, setActiveProject } = useProject();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form State
  const [projectName, setProjectName] = useState('');
  const [keywords, setKeywords] = useState('');


  const [sources, setSources] = useState({
    web: true,
    news: true,
    blogs: true,
    rss: true,
    youtube: false,
    facebook: false,
    tiktok: false,
  });

  const handleNext = () => setStep(s => Math.min(s + 1, 3));
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));

  const handleCreate = async () => {
    try {
      setLoading(true);
      const loadingToast = toast.loading('Đang tạo dự án và cấu hình quét...');

      // 1. Create KeywordGroup (Project)
      const newGroup = await keywordsApi.createGroup({
        name: projectName.trim(),
        description: `Dự án tạo từ Setup Wizard`,
      });

      // 2. Add Included Keywords
      const includedList = keywords.split(',').map(k => k.trim()).filter(Boolean);
      if (includedList.length > 0) {
        await keywordsApi.createKeywordsBulk({
          group_id: newGroup.id,
          keywords: includedList,
          keyword_type: 'general',
          is_active: true
        });
      }



      // 4. Trigger Web Scan
      const payload = {
        keyword_group_ids: [newGroup.id],
        mode: 'AUTO_DISCOVERY',
        keywords: includedList,
        // Optional: pass sources config to backend if supported by crawl API
      };
      await crawl.manualScan(payload);

      toast.dismiss(loadingToast);
      toast.success('Dự án đã được tạo thành công! Đang thu thập dữ liệu.');

      // Update global context
      await fetchProjects();
      setActiveProject(newGroup);

      // Redirect to Mentions
      router.push('/dashboard/mentions');

    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Có lỗi xảy ra khi tạo dự án');
    } finally {
      setLoading(false);
    }
  };

  const isNextDisabled = () => {
    if (step === 1 && !projectName.trim()) return true;
    if (step === 2 && !keywords.trim()) return true;
    return false;
  };

  return (
    <div className="max-w-3xl mx-auto py-10">
      <Toaster position="top-right" />

      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-paper mb-3">Tạo Dự án Mới</h1>
        <p className="text-paper-muted">Thiết lập bộ từ khóa và nguồn dữ liệu để bắt đầu lắng nghe</p>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center justify-between mb-12 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-edge -z-10 rounded-full" />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-signal -z-10 rounded-full transition-all duration-200 motion-reduce:transition-none"
          style={{ width: `${((step - 1) / 2) * 100}%` }}
        />
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold tabular-nums border-4 transition-colors duration-150 motion-reduce:transition-none ${
              step >= i
                ? 'bg-signal border-void text-white'
                : 'bg-void-raised border-void text-paper-faint'
            }`}
          >
            {step > i ? <CheckCircle2 className="w-5 h-5" /> : i}
          </div>
        ))}
      </div>

      {/* Steps Content */}
      <div className="bg-void-surface border border-edge rounded-2xl p-8 shadow-tile">

        {step === 1 && (
          <div className="animate-fadeIn">
            <h2 className="text-xl font-semibold text-paper mb-2">Tên dự án / Thương hiệu</h2>
            <p className="text-sm text-paper-muted mb-6">Đặt tên cho dự án này (ví dụ: Tên công ty, Sản phẩm, Tên đối thủ).</p>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="VD: Vinfast, TTH Hospital..."
              className={`w-full px-5 py-4 ${wizardInputClass}`}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && !isNextDisabled() && handleNext()}
            />
          </div>
        )}

        {step === 2 && (
          <div className="animate-fadeIn">
            <h2 className="text-xl font-semibold text-paper mb-2">Từ khóa chính cần theo dõi</h2>
            <p className="text-sm text-paper-muted mb-6">Hệ thống sẽ thu thập bài viết chứa ÍT NHẤT MỘT trong các từ khóa này. Phân cách bằng dấu phẩy (,).</p>
            <textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="VD: TTH, Bệnh viện TTH, TTH Hospital"
              className={`w-full px-5 py-4 min-h-[150px] ${wizardInputClass}`}
              autoFocus
            />
          </div>
        )}

        {step === 3 && (
          <div className="animate-fadeIn">
            <h2 className="text-xl font-semibold text-paper mb-2">Nguồn dữ liệu</h2>
            <p className="text-sm text-paper-muted mb-6">Chọn các nền tảng bạn muốn hệ thống quét dữ liệu.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className={`flex items-center p-4 rounded-xl border cursor-pointer transition-colors duration-150 motion-reduce:transition-none ${sources.web ? 'bg-signal/10 border-signal/25 text-paper' : 'bg-void-raised border-edge text-paper-muted hover:border-edge-strong'}`}>
                <input type="checkbox" checked={sources.web} onChange={(e) => setSources({...sources, web: e.target.checked})} className="hidden" />
                <Globe className={`w-6 h-6 mr-3 ${sources.web ? 'text-signal dark:text-signal-bright' : ''}`} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Web & Forums</p>
                </div>
                {sources.web && <CheckCircle2 className="w-5 h-5 text-signal dark:text-signal-bright" />}
              </label>

              <label className={`flex items-center p-4 rounded-xl border cursor-pointer transition-colors duration-150 motion-reduce:transition-none ${sources.news ? 'bg-signal/10 border-signal/25 text-paper' : 'bg-void-raised border-edge text-paper-muted hover:border-edge-strong'}`}>
                <input type="checkbox" checked={sources.news} onChange={(e) => setSources({...sources, news: e.target.checked})} className="hidden" />
                <FileText className={`w-6 h-6 mr-3 ${sources.news ? 'text-signal dark:text-signal-bright' : ''}`} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Báo chí (News)</p>
                </div>
                {sources.news && <CheckCircle2 className="w-5 h-5 text-signal dark:text-signal-bright" />}
              </label>

              <label className={`flex items-center p-4 rounded-xl border cursor-pointer transition-colors duration-150 motion-reduce:transition-none ${sources.blogs ? 'bg-signal/10 border-signal/25 text-paper' : 'bg-void-raised border-edge text-paper-muted hover:border-edge-strong'}`}>
                <input type="checkbox" checked={sources.blogs} onChange={(e) => setSources({...sources, blogs: e.target.checked})} className="hidden" />
                <FileText className={`w-6 h-6 mr-3 ${sources.blogs ? 'text-signal dark:text-signal-bright' : ''}`} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Blogs</p>
                </div>
                {sources.blogs && <CheckCircle2 className="w-5 h-5 text-signal dark:text-signal-bright" />}
              </label>

              <label className={`flex items-center p-4 rounded-xl border cursor-pointer transition-colors duration-150 motion-reduce:transition-none ${sources.rss ? 'bg-signal/10 border-signal/25 text-paper' : 'bg-void-raised border-edge text-paper-muted hover:border-edge-strong'}`}>
                <input type="checkbox" checked={sources.rss} onChange={(e) => setSources({...sources, rss: e.target.checked})} className="hidden" />
                <Rss className={`w-6 h-6 mr-3 ${sources.rss ? 'text-signal dark:text-signal-bright' : ''}`} />
                <div className="flex-1">
                  <p className="font-semibold text-sm">RSS Feeds</p>
                </div>
                {sources.rss && <CheckCircle2 className="w-5 h-5 text-signal dark:text-signal-bright" />}
              </label>

              <label className="flex items-center p-4 rounded-xl border bg-void-raised border-edge text-paper-muted cursor-not-allowed opacity-60">
                <Youtube className="w-6 h-6 mr-3 text-paper-faint" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">YouTube</p>
                  <p className="text-[10px] text-paper-faint">Yêu cầu cấu hình API Key</p>
                </div>
              </label>

              <label className="flex items-center p-4 rounded-xl border bg-void-raised border-edge text-paper-muted cursor-not-allowed opacity-60">
                <Facebook className="w-6 h-6 mr-3 text-paper-faint" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">Facebook / Instagram</p>
                  <p className="text-[10px] text-paper-faint">Yêu cầu Meta OAuth</p>
                </div>
              </label>

              <label className="flex items-center p-4 rounded-xl border bg-void-raised border-edge text-paper-muted cursor-not-allowed opacity-60">
                <Video className="w-6 h-6 mr-3 text-paper-faint" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">TikTok</p>
                  <p className="text-[10px] text-warning">Connector required</p>
                </div>
              </label>
            </div>
          </div>
        )}

      </div>

      {/* Footer Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={handlePrev}
          disabled={step === 1 || loading}
          className={`flex items-center gap-2 px-6 py-3 font-medium rounded-xl transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${
            step === 1 ? 'opacity-0 cursor-default' : 'bg-void-surface text-paper-muted hover:text-paper border border-edge-strong hover:bg-void-raised'
          }`}
        >
          <ArrowLeft className="w-5 h-5" /> Quay lại
        </button>

        {step < 3 ? (
          <button
            onClick={handleNext}
            disabled={isNextDisabled()}
            className={`flex items-center gap-2 px-8 py-3 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white font-medium rounded-xl transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed ${focusRingOffset}`}
          >
            Tiếp tục <ArrowRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={loading}
            className={`flex items-center gap-2 px-8 py-3 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white font-bold rounded-xl transition-colors duration-150 motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed ${focusRingOffset}`}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldAlert className="w-5 h-5" />}
            {loading ? 'Đang tạo dự án...' : 'Tạo Dự án & Bắt đầu quét'}
          </button>
        )}
      </div>

    </div>
  );
}
