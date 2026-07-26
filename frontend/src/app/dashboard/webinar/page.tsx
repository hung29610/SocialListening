'use client';

import { Award, Calendar, Users, PlayCircle, CheckCircle2, Mail } from 'lucide-react';
import Link from 'next/link';
import { useDialog } from '@/components/ui/Dialog';

export default function WebinarPage() {
  const { prompt, alert } = useDialog();

  const handleRegister = async () => {
    const email = await prompt({
      title: 'Đăng ký tham dự Webinar',
      message: 'Nhập email của bạn để nhận link Zoom và tài liệu.',
      placeholder: 'your@email.com',
      confirmText: 'Đăng ký ngay',
      icon: <Mail className="w-6 h-6" />,
    });
    if (email === null) return;
    if (email && email.includes('@')) {
      localStorage.setItem('webinar_registered', email);
      await alert({
        title: 'Đăng ký thành công! 🎉',
        message: `Link Zoom và tài liệu sẽ được gửi đến: ${email}`,
        variant: 'success',
        confirmText: 'Tuyệt vời!',
      });
    } else {
      await alert({
        title: 'Email không hợp lệ',
        message: 'Vui lòng nhập đúng định dạng email (ví dụ: ten@email.com).',
        variant: 'warning',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden bg-void-raised border border-edge p-12 text-center flex flex-col items-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-signal/20 blur-[100px] pointer-events-none" />

        <div className="w-20 h-20 bg-signal/10 rounded-full flex items-center justify-center mb-6 relative z-10 border border-signal/25">
          <Award className="w-10 h-10 text-signal dark:text-signal-bright" />
        </div>

        <span className="px-3 py-1 bg-signal/10 text-signal dark:text-signal-bright text-eyebrow font-semibold uppercase tracking-eyebrow rounded-full mb-4 relative z-10 border border-signal/25">
          Free Online Masterclass
        </span>

        <h1 className="text-4xl md:text-5xl font-display font-bold text-paper tracking-tight mb-6 relative z-10 max-w-3xl leading-tight">
          Get a Social Listening Certificate with <span className="text-signal dark:text-signal-bright">Nope360</span>
        </h1>

        <p className="text-lg text-paper-muted max-w-2xl mb-10 relative z-10">
          Nâng cao kỹ năng giám sát truyền thông, xử lý khủng hoảng và nắm bắt Insight khách hàng với chứng chỉ chuyên môn độc quyền từ chúng tôi.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 relative z-10">
          <button
            onClick={handleRegister}
            className="px-8 py-4 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white rounded-xl font-bold transition-colors duration-150 motion-reduce:transition-none shadow-glow-signal flex items-center justify-center gap-2 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          >
            <CheckCircle2 className="w-5 h-5" />
            Đăng ký giữ chỗ ngay
          </button>
          <Link href="/dashboard" className="px-8 py-4 bg-void-surface hover:bg-void-raised text-paper rounded-xl font-bold transition-colors duration-150 motion-reduce:transition-none border border-edge-strong flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70">
            Trở về Dashboard
          </Link>
        </div>
      </div>

      {/* Details Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-void-surface rounded-2xl border border-edge p-6 flex flex-col items-center text-center">
          <Calendar className="w-8 h-8 text-signal dark:text-signal-bright mb-4" />
          <h3 className="font-bold text-paper mb-2">Lịch trình</h3>
          <p className="text-sm text-paper-muted">Thứ Tư, 03 Tháng 6, 2026<br/>20:00 - 22:00 (GMT+7)</p>
        </div>

        <div className="bg-void-surface rounded-2xl border border-edge p-6 flex flex-col items-center text-center">
          <PlayCircle className="w-8 h-8 text-signal dark:text-signal-bright mb-4" />
          <h3 className="font-bold text-paper mb-2">Hình thức</h3>
          <p className="text-sm text-paper-muted">Trực tuyến qua Zoom<br/>(Link sẽ được gửi qua Email)</p>
        </div>

        <div className="bg-void-surface rounded-2xl border border-edge p-6 flex flex-col items-center text-center">
          <Users className="w-8 h-8 text-signal dark:text-signal-bright mb-4" />
          <h3 className="font-bold text-paper mb-2">Đối tượng</h3>
          <p className="text-sm text-paper-muted">Marketing Manager, PR Executive, Brand Manager</p>
        </div>
      </div>
    </div>
  );
}
