'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { auth, crawl } from '@/lib/api';
import type { WorkerHealth } from '@/lib/api';
import LoadingSpinner from '@/components/LoadingSpinner';
import { SidebarBadge } from '@/components/dashboard/Badges';
import { canAccessAdmin, type User } from '@/lib/permissions';
import { useAuth } from '@/contexts/AuthContext';
import { ProjectProvider, useProject } from '@/contexts/ProjectContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import toast, { Toaster } from 'react-hot-toast';
import { withTimeout } from '@/lib/utils/timeout';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import WebinarRegistrationModal from '@/components/dashboard/WebinarRegistrationModal';
import WebinarSuccessModal from '@/components/dashboard/WebinarSuccessModal';
import {
  LayoutDashboard,
  Globe,
  FileText,
  Bell,
  LogOut,
  Menu,
  X,
  Settings,
  Briefcase,
  PieChart,
  MessageSquareText,
  ScanSearch,
  ClipboardList,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
  SearchCode,
  Link2,
  Scale,
  Mail,
  FileSpreadsheet,
  Image as ImageIcon,
  Award,
  HelpCircle,
  Zap,
  Sparkles,
  ShieldAlert
} from 'lucide-react';

/* Shared micro-interaction primitives (SIGNAL: 150–250ms, reduced-motion honored) */
const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70';
const sidebarTooltip =
  'pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 bg-void-raised border border-edge text-paper text-xs font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150 motion-reduce:transition-none z-50 shadow-tile';

function WorkerStatusBadge() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<WorkerHealth | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await crawl.getWorkerStatus();
        setStatus(data);
        setFailed(false);
      } catch (err) {
        setFailed(true);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!status) {
    if (!failed) return null;
    return (
      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-warning/10 text-warning text-[10px] font-semibold tracking-eyebrow uppercase rounded-full border border-warning/25" title={t('header.workerStatusUnknown')}>
        <div className="w-2 h-2 rounded-full bg-warning"></div>
        {t('header.workerUnknown')}
      </div>
    );
  }

  const workerStatus = status.celery_worker.status;
  const isRunning = workerStatus === 'online';
  const isDegraded = workerStatus === 'degraded';
  const brokerUnavailable = status.broker.status === 'unreachable';
  const freeMvpEmbedded = status.runtime?.mode === 'free_mvp_embedded';
  const label = freeMvpEmbedded
    ? t('header.freeMvpEmbedded')
    : brokerUnavailable
    ? 'BROKER UNREACHABLE'
    : isRunning
    ? t('header.workerOnline')
    : isDegraded
    ? 'CELERY DEGRADED'
    : t('header.workerOffline');
  const tone = freeMvpEmbedded
    ? 'bg-warning/10 text-warning border-warning/25'
    : isRunning
    ? 'bg-sentiment-positive/10 text-sentiment-positive border-sentiment-positive/25'
    : isDegraded
    ? 'bg-warning/10 text-warning border-warning/25'
    : 'bg-sentiment-negative/10 text-sentiment-negative border-sentiment-negative/25';

  return (
    <div
      className={`hidden sm:flex items-center gap-1.5 px-3 py-1 border ${tone} text-[10px] font-semibold tracking-eyebrow uppercase rounded-full cursor-help transition-colors duration-150 motion-reduce:transition-none`}
      title={`${status.runtime?.label || 'Standard runtime'}. Celery: ${workerStatus}. Broker: ${status.broker.status}. Beat: ${status.celery_beat.status}. Queues: ${status.celery_worker.queues.join(', ') || 'none'}`}
    >
      <div className={`w-2 h-2 rounded-full ${freeMvpEmbedded ? 'bg-warning' : isRunning ? 'bg-sentiment-positive animate-pulse motion-reduce:animate-none' : isDegraded ? 'bg-warning' : 'bg-sentiment-negative'}`}></div>
      {label}
    </div>
  );
}

function DashboardSidebar({ sidebarOpen, setSidebarOpen, user, badges, setIsWebinarModalOpen, sidebarCollapsed, setSidebarCollapsed }: any) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const { projects, activeProject, setActiveProject, loading: projectsLoading } = useProject();
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);

  const projectNav = [
    { name: t('nav.dashboard'), href: '/dashboard/overview', icon: LayoutDashboard },
    { name: t('nav.mentions'), href: '/dashboard/mentions', icon: MessageSquareText },
    { name: t('nav.analysis'), href: '/dashboard/summary', icon: PieChart },
    { name: t('nav.comparison'), href: '/dashboard/comparison', icon: Scale },
    { name: t('nav.influencers'), href: '/dashboard/influencers', icon: Users },
    { name: t('nav.integrations'), href: '/dashboard/integrations', icon: Link2 },
    { name: t('nav.projectSettings'), href: '/dashboard/project-settings', icon: SearchCode },
  ];

  const reportsNav = [
    { name: t('nav.emailReports'), href: '/dashboard/reports/email', icon: Mail },
    { name: t('nav.pdfReport'), href: '/dashboard/reports', icon: FileText },
    { name: t('nav.excelReport'), href: '/dashboard/reports/excel', icon: FileSpreadsheet },
    { name: t('nav.infographic'), href: '/dashboard/reports/infographic', icon: ImageIcon },
  ];

  const systemNav = [
    { name: t('nav.aiAssistant'), href: '/dashboard/assistant', icon: Sparkles },
    { name: t('nav.services'), href: '/dashboard/services', icon: Briefcase },
  ];

  const handleLogout = () => {
    auth.logout();
    router.push('/login');
  };

  const toggleCollapse = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebar_collapsed', String(next));
    }
  };

  // Shared nav item renderer — active route carries the signal accent, sparingly
  const NavItem = ({ item, isActive }: { item: { name: string; href: string; icon: any }, isActive: boolean }) => (
    <Link
      href={item.href}
      prefetch={false}
      title={item.name}
      aria-current={isActive ? 'page' : undefined}
      className={`group relative flex items-center rounded-lg transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${
        isActive
          ? 'bg-signal/[0.08] text-signal dark:text-signal-bright'
          : 'text-paper-muted hover:text-paper hover:bg-paper/[0.04]'
      } ${sidebarCollapsed
          ? 'justify-center w-10 h-10 mx-auto'
          : 'px-3 py-2.5 gap-3'
      }`}
      onClick={() => setSidebarOpen(false)}
    >
      {/* Active route indicator */}
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-signal dark:bg-signal-bright" />
      )}
      <item.icon className={`shrink-0 transition-colors duration-150 motion-reduce:transition-none ${sidebarCollapsed ? 'w-[18px] h-[18px]' : 'w-[17px] h-[17px]'} ${isActive ? 'text-signal dark:text-signal-bright' : 'text-paper-faint group-hover:text-paper-muted'}`} />
      {!sidebarCollapsed && <span className="truncate text-sm font-medium">{item.name}</span>}
      {/* Tooltip in collapsed mode */}
      {sidebarCollapsed && (
        <span className={sidebarTooltip}>
          {item.name}
        </span>
      )}
    </Link>
  );

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-void-surface border-r border-edge transform transition-[transform,width] duration-200 ease-out motion-reduce:transition-none lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } ${sidebarCollapsed ? 'w-[68px]' : 'w-64'}`}
    >

      {/* ── Header: Logo + Collapse Button ─────────────────────────────── */}
      <div className={`flex items-center shrink-0 border-b border-edge ${sidebarCollapsed ? 'flex-col justify-center py-4 gap-3' : 'h-16 justify-between px-4'}`}>
        {sidebarCollapsed ? (
          /* Collapsed: Logo and Toggle button */
          <>
            <div className="w-9 h-9 bg-signal rounded-lg flex items-center justify-center">
              <span className="text-white font-display font-bold text-base leading-none">N</span>
            </div>
            <button
              onClick={toggleCollapse}
              title={t('common.expand')}
              className={`group relative w-8 h-8 rounded-lg text-paper-faint hover:text-paper hover:bg-paper/[0.04] flex items-center justify-center transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
            >
              <ChevronRight className="w-4 h-4" />
              <span className={sidebarTooltip}>
                {t('common.expand')}
              </span>
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-signal rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white font-display font-bold text-base leading-none">N</span>
              </div>
              <h1 className="text-lg font-display font-bold text-paper tracking-tight">Nope360</h1>
            </div>
            <div className="flex items-center gap-1">
              {/* Close on mobile */}
              <button
                onClick={() => setSidebarOpen(false)}
                className={`lg:hidden p-1.5 text-paper-faint hover:text-paper hover:bg-paper/[0.04] rounded-lg transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
              >
                <X className="w-4 h-4" />
              </button>
              {/* Collapse on desktop */}
              <button
                onClick={toggleCollapse}
                title={t('common.collapse')}
                className={`hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-paper-faint hover:text-paper hover:bg-paper/[0.04] transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Scrollable Nav ─────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide py-3">

        {/* Project selector */}
        <div className={`mb-1 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center justify-between px-2 mb-1.5">
              <span className="text-[10px] tracking-eyebrow font-semibold uppercase text-paper-faint">{t('nav.projectsTitle')}</span>
              <Link href="/dashboard/projects/new" title="New Project" className={`text-paper-faint hover:text-signal dark:hover:text-signal-bright rounded transition-colors duration-150 motion-reduce:transition-none ${focusRing}`} prefetch={false}>
                <Plus className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {sidebarCollapsed ? (
            /* Collapsed project: avatar only */
            <div className="flex flex-col items-center gap-2 mt-1">
              <Link href="/dashboard/projects/new" title="New Project" className={`w-10 h-10 rounded-lg flex items-center justify-center text-paper-faint hover:text-signal dark:hover:text-signal-bright hover:bg-paper/[0.04] transition-colors duration-150 motion-reduce:transition-none ${focusRing}`} prefetch={false}>
                <Plus className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                title={activeProject?.name || t('mentions.page.selectProject')}
                className={`group relative w-10 h-10 rounded-lg bg-signal/10 hover:bg-signal/15 flex items-center justify-center border border-signal/20 transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}
              >
                <span className="text-signal dark:text-signal-bright font-semibold text-xs">
                  {activeProject?.name?.charAt(0).toUpperCase() || '?'}
                </span>
                {/* Active dot */}
                <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-sentiment-positive border-2 border-void-surface" />
                {/* Tooltip */}
                <span className={sidebarTooltip}>
                  {activeProject?.name || t('mentions.page.selectProject')}
                </span>
              </button>
              {projectDropdownOpen && (
                <div className="absolute left-[76px] top-[10px] w-52 bg-void-surface border border-edge rounded-xl shadow-tile overflow-hidden py-1.5 z-50">
                  {projects.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => { setActiveProject(p); setProjectDropdownOpen(false); router.push('/dashboard/mentions'); }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${activeProject?.id === p.id ? 'bg-signal/[0.08] text-signal dark:text-signal-bright font-semibold' : 'text-paper-muted hover:text-paper hover:bg-paper/[0.04]'}`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Expanded project selector */
            <div className="relative">
              <button
                onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-paper/[0.04] transition-colors duration-150 motion-reduce:transition-none group ${focusRing}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-signal/10 border border-signal/20 flex items-center justify-center text-signal dark:text-signal-bright font-semibold text-xs shrink-0">
                    {activeProject?.name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-semibold text-paper truncate leading-none">
                      {projectsLoading ? t('common.loading') : activeProject?.name || t('mentions.page.selectProject')}
                    </p>
                    <p className="text-[11px] text-paper-faint mt-1 truncate flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-sentiment-positive shrink-0" />
                      {activeProject ? t('common.active') : t('mentions.page.noProject')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-paper-faint shrink-0">
                  <Settings className="w-3.5 h-3.5 hover:text-paper transition-colors duration-150 motion-reduce:transition-none" onClick={(e) => { e.stopPropagation(); router.push('/dashboard/project-settings'); }} />
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 motion-reduce:transition-none ${projectDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {projectDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-void-surface border border-edge rounded-xl shadow-tile overflow-hidden py-1.5 z-50">
                  <div className="max-h-48 overflow-y-auto">
                    {projects.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => { setActiveProject(p); setProjectDropdownOpen(false); router.push('/dashboard/mentions'); }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors duration-150 motion-reduce:transition-none ${focusRing} ${activeProject?.id === p.id ? 'bg-signal/[0.08] text-signal dark:text-signal-bright font-semibold' : 'text-paper-muted hover:text-paper hover:bg-paper/[0.04]'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className={`my-3 border-t border-edge ${sidebarCollapsed ? 'mx-3' : 'mx-4'}`} />

        {/* Project Nav */}
        <div className={`space-y-0.5 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {!sidebarCollapsed && (
            <p className="px-2 mb-1.5 text-[10px] tracking-eyebrow font-semibold uppercase text-paper-faint">{t('nav.workspace')}</p>
          )}
          {projectNav.map((item) => (
            <NavItem key={item.name} item={item} isActive={pathname === item.href} />
          ))}
        </div>

        {/* Divider */}
        <div className={`my-3 border-t border-edge ${sidebarCollapsed ? 'mx-3' : 'mx-4'}`} />

        {/* Reports Nav */}
        <div className={`space-y-0.5 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {!sidebarCollapsed && (
            <p className="px-2 mb-1.5 text-[10px] tracking-eyebrow font-semibold uppercase text-paper-faint">{t('nav.reportsTitle')}</p>
          )}
          {reportsNav.map((item) => (
            <NavItem key={item.name} item={item} isActive={pathname === item.href} />
          ))}
        </div>

        {/* Divider */}
        <div className={`my-3 border-t border-edge ${sidebarCollapsed ? 'mx-3' : 'mx-4'}`} />

        {/* System Nav */}
        <div className={`space-y-0.5 ${sidebarCollapsed ? 'px-2' : 'px-3'}`}>
          {!sidebarCollapsed && (
            <p className="px-2 mb-1.5 text-[10px] tracking-eyebrow font-semibold uppercase text-paper-faint">{t('nav.systemTitle')}</p>
          )}
          {systemNav.map((item) => (
            <NavItem key={item.name} item={item} isActive={pathname.startsWith(item.href)} />
          ))}
        </div>

        {/* Webinar Banner (expanded only) */}
        {!sidebarCollapsed && (
          <div className="mx-3 mt-4 p-3 rounded-xl bg-void-raised border border-edge">
            <p className="text-[10px] tracking-eyebrow font-semibold uppercase text-signal dark:text-signal-bright mb-1">{t('nav.webinar')}</p>
            <p className="text-xs text-paper-muted leading-relaxed mb-2">{t('nav.webinarDesc')}</p>
            <button onClick={() => setIsWebinarModalOpen(true)} className={`flex items-center gap-1.5 text-xs font-semibold text-signal dark:text-signal-bright hover:text-signal-deep dark:hover:text-signal rounded transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>
              <Award className="w-3.5 h-3.5" />
              {t('nav.signUp')}
            </button>
          </div>
        )}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className={`shrink-0 border-t border-edge flex items-center ${sidebarCollapsed ? 'justify-center py-3' : 'justify-between px-4 py-3'}`}>
        <button onClick={handleLogout} className={`flex items-center gap-2 text-xs text-paper-faint hover:text-destructive transition-colors duration-150 motion-reduce:transition-none font-medium rounded-lg ${focusRing} ${sidebarCollapsed ? 'justify-center w-10 h-10 hover:bg-paper/[0.04]' : ''}`}>
          <LogOut className="w-4 h-4" />
          {!sidebarCollapsed && t('nav.logout')}
        </button>
      </div>
    </div>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const router = useRouter();
  const {
    user,
    isLoading: authLoading,
    isHydrating,
    sessionState,
    readinessReason,
    refreshContext,
  } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isWebinarModalOpen, setIsWebinarModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hasLocalSession, setHasLocalSession] = useState(false);
  const [badges, setBadges] = useState<{ new_alerts: number, open_incidents: number, unreviewed_mentions: number }>({
    new_alerts: 0,
    open_incidents: 0,
    unreviewed_mentions: 0,
  });

  useEffect(() => {
    setMounted(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      setHasLocalSession(false);
      window.location.replace('/login');
      return;
    }
    setHasLocalSession(true);

    const savedCollapse = localStorage.getItem('sidebar_collapsed');
    if (savedCollapse === 'true') {
      setSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (!mounted || !hasLocalSession || authLoading || isHydrating) {
      return;
    }

    if (sessionState === 'UNAUTHENTICATED') {
      window.location.replace('/login?expired=1');
    }
  }, [mounted, hasLocalSession, authLoading, isHydrating, sessionState]);

  useEffect(() => {
    if (user) {
      const fetchBadges = async () => {
        try {
          const { dashboard } = await import('@/lib/api');
          setBadges(await withTimeout(dashboard.sidebarBadges(), 8000));
        } catch (error) {}
      };
      fetchBadges();
      const interval = setInterval(fetchBadges, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  if (!mounted || !hasLocalSession || authLoading || isHydrating) {
    return <LoadingSpinner message={t('common.loading')} />;
  }

  if (sessionState === 'AUTHENTICATED_NOT_READY') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-void px-4">
        <section
          className="w-full max-w-xl rounded-2xl border border-warning/25 bg-void-surface p-6 shadow-tile sm:p-8"
          aria-live="polite"
          data-testid="authenticated-not-ready"
        >
          <div className="flex items-start gap-4">
            <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <h1 className="font-display text-xl font-semibold text-paper">
                {t('readiness.title')}
              </h1>
              <p className="mt-2 text-sm leading-6 text-paper-muted">
                {t('readiness.description')}
              </p>
              <p className="mt-3 text-xs text-paper-faint">
                {t('readiness.sessionPreserved')}
              </p>
              {readinessReason && (
                <p className="mt-2 font-mono text-[11px] text-paper-faint">
                  {t('readiness.reason')}: {readinessReason}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void refreshContext()}
                  data-testid="readiness-retry"
                  className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-signal-deep motion-reduce:transition-none"
                >
                  {t('readiness.retry')}
                </button>
                <button
                  type="button"
                  onClick={() => { auth.logout(); router.push('/login'); }}
                  className="rounded-lg border border-edge px-4 py-2 text-sm font-medium text-paper-muted transition-colors duration-150 hover:bg-paper/[0.04] hover:text-paper motion-reduce:transition-none"
                >
                  {t('nav.logout')}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (sessionState === 'UNAUTHENTICATED' || !user) {
    return <LoadingSpinner message={t('common.loading')} />;
  }

  return (
    <ProjectProvider>
      <div className="min-h-screen bg-void">
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-paper/25 dark:bg-void/70 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <DashboardSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={user}
          badges={badges}
          setIsWebinarModalOpen={setIsWebinarModalOpen}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
        />

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className: '!bg-void-surface !text-paper !border !border-edge !shadow-tile'
        }}
      />
      <div className={`transition-[padding] duration-200 ease-out motion-reduce:transition-none flex flex-col min-h-screen ${mounted ? (sidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-64') : 'lg:pl-64'}`}>
        <div className="sticky top-0 z-20 flex min-w-0 items-center h-16 px-3 bg-void/[0.85] border-b border-edge sm:px-4 lg:px-8 backdrop-blur-xl">
          <button onClick={() => setSidebarOpen(true)} className={`lg:hidden p-2 -ml-2 text-paper-muted hover:text-paper mr-2 rounded-lg transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>
            <Menu className="w-5 h-5" />
          </button>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4">
            <WorkerStatusBadge />
            <button onClick={() => toast('Billing/Upgrade coming soon', { icon: '⏳' })} className={`hidden sm:flex items-center px-4 py-1.5 bg-signal hover:bg-signal-deep dark:hover:bg-signal-bright text-white text-xs font-semibold rounded-full transition-colors duration-150 motion-reduce:transition-none tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70 focus-visible:ring-offset-2 focus-visible:ring-offset-void`}>
              {t('header.upgrade')}
            </button>
            <div className="h-6 w-px bg-edge mx-2 hidden sm:block"></div>
            <button onClick={() => toast.success('Vui lòng gửi email hỗ trợ đến support@nope.com')} title="Help Center" className={`text-paper-muted hover:text-paper rounded-lg transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>
              <HelpCircle className="w-5 h-5" />
            </button>
            <button disabled title="Quick Actions (Coming soon)" className="text-paper-faint opacity-50 cursor-not-allowed hidden sm:block">
              <Zap className="w-5 h-5" />
            </button>
            <LanguageSwitcher />
            <ThemeToggle />

            <div className="relative group">
              <div suppressHydrationWarning className="w-8 h-8 rounded-full bg-void-raised border border-edge-strong text-paper flex items-center justify-center text-xs font-bold ml-2 cursor-pointer hover:ring-2 hover:ring-signal/60 transition-shadow duration-150 motion-reduce:transition-none">
                {authLoading ? '...' : (user?.full_name || user?.email || 'K')[0].toUpperCase()}
              </div>
              <div className="absolute right-0 top-full mt-2 w-48 bg-void-surface rounded-xl shadow-tile border border-edge opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 motion-reduce:transition-none z-50">
                <div className="px-4 py-3 border-b border-edge">
                  <p suppressHydrationWarning className="text-sm font-semibold text-paper truncate">{user?.full_name || 'User'}</p>
                  <p suppressHydrationWarning className="text-xs text-paper-faint truncate">{user?.email}</p>
                </div>
                <div className="py-1">
                  <Link href="/dashboard/settings" className={`block px-4 py-2 text-sm text-paper-muted hover:text-paper hover:bg-paper/[0.04] transition-colors duration-150 motion-reduce:transition-none ${focusRing}`} prefetch={false}>
                    {t('nav.projectSettings')}
                  </Link>
                  <button onClick={() => { auth.logout(); router.push('/login'); }} className={`w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/[0.06] font-medium transition-colors duration-150 motion-reduce:transition-none ${focusRing}`}>
                    {t('nav.logout')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <main className="flex w-full min-w-0 max-w-[1920px] flex-1 flex-col p-3 sm:p-4 lg:mx-auto lg:p-8">
          <div className="flex-1">
            {children}
          </div>
          <footer className="mt-10 pt-4 border-t border-edge">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-paper-faint">
              <div className="flex items-center gap-4">
                <span>{t('header.legalInformation')}</span>
                <span>{t('header.cookiePreferences')}</span>
              </div>
              <p className="text-center sm:text-right">{t('header.copyright')}</p>
            </div>
          </footer>
        </main>
      </div>

      <WebinarRegistrationModal
        isOpen={isWebinarModalOpen}
        onClose={() => setIsWebinarModalOpen(false)}
        onSuccess={() => {
          setIsWebinarModalOpen(false);
          setIsSuccessModalOpen(true);
        }}
      />

      <WebinarSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => setIsSuccessModalOpen(false)}
      />
      </div>
    </ProjectProvider>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}
