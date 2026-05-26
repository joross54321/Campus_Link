import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  defaultSearchPath,
  isSearchablePath,
} from '../../hooks/useUrlSearchQuery';
import { toast } from 'react-hot-toast';
import { 
  LayoutDashboard, 
  User, 
  BookOpen, 
  GraduationCap, 
  ClipboardList, 
  Settings, 
  LogOut,
  ChevronRight,
  Home,
  Bell,
  BookMarked,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useSystemConfig } from '../../hooks/useSystemConfig';
import { useStudentEnrollmentStatus } from '../../hooks/useStudentEnrollmentStatus';
import { usePendingNotifications } from '../../hooks/usePendingNotifications';
import { formatSemesterLabel } from '../../lib/systemConfig';
import { cn } from '../../lib/utils';
import { userInitials } from '../admin/UserAvatar';
import { EMPTY } from '../../lib/displayUtils';
import { motion, AnimatePresence } from 'motion/react';
import { useCampusNotifications } from '../../hooks/useCampusNotifications';
import { useScreenFeedback } from '../../contexts/ScreenFeedbackContext';
import ErrorBoundary from '../ErrorBoundary';
import SearchField from '../SearchField';
import { useSearchIndex } from '../../hooks/useSearchIndex';
import { suggestionQueryValue, type SearchSuggestion } from '../../lib/searchSuggestions';

const SidebarItem = ({
  to,
  icon: Icon,
  label,
  active,
  badge = 0,
}: {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  active: boolean;
  badge?: number;
}) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 group",
      active 
        ? "bg-background text-primary shadow-sm" 
        : "text-white/60 hover:text-white hover:bg-white/5"
    )}
  >
    <div className={cn(
      "transition-transform duration-300",
      active ? "scale-110" : "group-hover:translate-x-0.5"
    )}>
      <Icon size={18} />
    </div>
    <span className="tracking-wide flex-1 min-w-0 truncate">{label}</span>
    {badge > 0 && (
      <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-brand-gold text-brand-blue text-[10px] font-bold flex items-center justify-center">
        {badge > 99 ? '99+' : badge}
      </span>
    )}
    {active && badge === 0 && (
      <motion.div layoutId="active-nav" className="ml-auto w-1 h-4 rounded-full bg-accent" />
    )}
  </Link>
);

export default function Shell() {
  const { profile, isStudent } = useAuth();
  const { config, enrollmentWindowOpen } = useSystemConfig();
  const { canPreEnroll } = useStudentEnrollmentStatus();
  const { counts, isRegistrar } = usePendingNotifications();
  const campusNotifs = useCampusNotifications();
  const { pulseKey, pulseKind } = useScreenFeedback();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [campusNotifOpen, setCampusNotifOpen] = useState(false);
  const pendingToastShown = useRef(false);
  const urlQ = new URLSearchParams(location.search).get('q') ?? '';
  const [headerSearch, setHeaderSearch] = useState(urlQ);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHeaderSearch(urlQ);
  }, [urlQ]);

  /** Updates ?q= on the current page only — no redirect while typing. */
  const applyHeaderSearchOnCurrentPage = (value: string) => {
    const trimmed = value.trim();
    const params = new URLSearchParams(location.search);
    if (trimmed) params.set('q', trimmed);
    else params.delete('q');
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : '',
      },
      { replace: true }
    );
  };

  /** Enter key: jump to the role’s search hub when not already on a searchable page. */
  const applyHeaderSearchSubmit = (value: string) => {
    const trimmed = value.trim();
    if (isSearchablePath(location.pathname)) {
      applyHeaderSearchOnCurrentPage(value);
      return;
    }
    if (!profile) return;
    const { pathname, search: baseSearch } = defaultSearchPath(
      profile.role,
      Boolean(isStudent && canPreEnroll)
    );
    const merged = new URLSearchParams(baseSearch);
    if (trimmed) merged.set('q', trimmed);
    else merged.delete('q');
    const search = merged.toString();
    navigate({ pathname, search: search ? `?${search}` : '' });
  };

  const { suggestions: searchIndex, loading: searchIndexLoading } = useSearchIndex();

  const handleHeaderSearchChange = (value: string) => {
    setHeaderSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => applyHeaderSearchOnCurrentPage(value), 350);
  };

  const handlePickSuggestion = (s: SearchSuggestion) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const q = suggestionQueryValue(s);
    setHeaderSearch(q);
    navigate(s.navigateTo);
  };

  useEffect(() => {
    if (!isRegistrar || counts.total === 0 || pendingToastShown.current) return;
    pendingToastShown.current = true;
    toast.success(
      `${counts.enrollments} enrollment request(s), ${counts.grades} grade(s) awaiting action.`,
      { duration: 6000 }
    );
  }, [isRegistrar, counts.total, counts.enrollments, counts.grades]);

  const navBadge = (to: string) => {
    if (to.includes('tab=approvals')) return counts.enrollments;
    if (to.includes('tab=grades')) return counts.grades;
    return 0;
  };

  const routeActive = (to: string) => {
    const path = location.pathname + location.search;
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (to.includes('?')) return path === to;
    if (to === '/admin') {
      return location.pathname === '/admin' && (!tab || tab === 'approvals');
    }
    if (to === '/professor') {
      return location.pathname === '/professor';
    }
    return location.pathname === to;
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['student'] as const },
    { to: '/services', icon: GraduationCap, label: 'Services', roles: ['student'] },
    { to: '/professor', icon: LayoutDashboard, label: 'Faculty Home', roles: ['professor'] as const },
    { to: '/admin', icon: LayoutDashboard, label: 'Registrar Console', roles: ['registrar'] as const },
    ...(isStudent && canPreEnroll
      ? [{ to: '/enrollment', icon: BookMarked, label: 'Pre-Enrollment', roles: ['student'] as ('student' | 'professor' | 'registrar')[] }]
      : []),
    { to: '/study-load', icon: BookOpen, label: 'Study Load', roles: ['student'] },
    { to: '/grades', icon: ClipboardList, label: 'Grades', roles: ['student'] },
    { to: '/admin?tab=approvals', icon: BookMarked, label: 'Enrollment Queue', roles: ['registrar'] },
    { to: '/professor/subjects', icon: GraduationCap, label: 'My Subjects', roles: ['professor'] },
    { to: '/professor/grades', icon: ClipboardList, label: 'Student Grades', roles: ['professor'] },
    { to: '/admin?tab=grades', icon: ClipboardList, label: 'Grade Validation', roles: ['registrar'] },
    { to: '/admin?tab=users', icon: User, label: 'Directory', roles: ['registrar'] },
    { to: '/profile', icon: User, label: 'My Profile', roles: ['student', 'professor', 'registrar'] },
  ];

  const filteredNav = navItems.filter(item => profile && item.roles.includes(profile.role));
  const initials = profile
    ? userInitials({
        firstName: profile.firstName,
        surname: profile.surname,
        studentId: profile.studentId,
      })
    : '';

  return (
    <motion.div className="flex h-screen bg-background font-sans overflow-hidden relative">
      <AnimatePresence>
        {pulseKey > 0 && (
          <motion.div
            key={pulseKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className={cn(
              'pointer-events-none fixed inset-0 z-[200]',
              pulseKind === 'navigate' && 'animate-screen-wobble',
              pulseKind === 'refresh' && 'animate-screen-flicker'
            )}
            style={{
              background:
                pulseKind === 'refresh'
                  ? 'linear-gradient(135deg, rgba(197,160,89,0.18), rgba(0,31,61,0.06))'
                  : 'rgba(0, 31, 61, 0.05)',
            }}
          />
        )}
      </AnimatePresence>
      {/* Sidebar */}
      <aside className="w-72 bg-primary flex flex-col relative z-20 shrink-0">
        {/* Sidebar Background Accents */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5">
           <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand-gold rounded-full blur-[80px]" />
           <div className="absolute top-1/2 -right-32 w-64 h-64 bg-brand-gold rounded-full blur-[80px]" />
        </div>

        <div className="p-8 relative z-10 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-brand-gold flex items-center justify-center shadow-lg shadow-brand-gold/20">
              <GraduationCap size={20} className="text-brand-blue" />
            </div>
            <div>
              <h1 className="text-white font-display font-bold text-xl tracking-tight leading-none">CampusLink</h1>
              <p className="text-white/30 text-[8px] font-bold uppercase tracking-[0.3em] mt-1">Innovation Unit</p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-white/20 text-[9px] font-bold uppercase tracking-[0.2em] mb-4 ml-4">Main Menu</p>
            <nav className="space-y-1">
              {filteredNav.map((item) => (
                <SidebarItem
                  key={item.to}
                  to={item.to}
                  icon={item.icon}
                  label={item.label}
                  active={routeActive(item.to)}
                  badge={navBadge(item.to)}
                />
              ))}
            </nav>
          </div>

          <div className="mt-auto pt-8 border-t border-white/5 space-y-1">
             <p className="text-white/20 text-[9px] font-bold uppercase tracking-[0.2em] mb-4 ml-4">System</p>
             <Link
              to="/settings"
              className={cn(
                'flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                routeActive('/settings')
                  ? 'bg-background text-primary shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              <Settings size={18} />
              <span>Settings</span>
            </Link>
            <button 
              onClick={handleLogout}
              className="flex w-full items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-red-400 hover:bg-red-400/5 transition-all mt-4"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-10 relative z-30 overflow-visible gap-4 sticky top-0">
          <SearchField
            className="flex-1 min-w-0 max-w-md"
            value={headerSearch}
            onChange={handleHeaderSearchChange}
            onSubmit={applyHeaderSearchSubmit}
            onSelectSuggestion={handlePickSuggestion}
            suggestions={searchIndex}
            loading={searchIndexLoading}
            placeholder={
              profile?.role === 'registrar'
                ? 'Search students, faculty, courses…'
                : profile?.role === 'professor'
                  ? 'Search your subjects…'
                  : 'Search courses…'
            }
            inputClassName="!border-0 !ring-0 !bg-transparent"
          />
          
          <div className="flex items-center gap-6 shrink-0">
            {isStudent && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCampusNotifOpen((v) => !v)}
                  className="relative p-2 text-slate-400 hover:text-brand-blue transition-colors"
                  aria-label="Campus notifications"
                >
                  <Bell size={20} />
                  {campusNotifs.unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-brand-gold text-brand-blue text-[9px] font-bold flex items-center justify-center border-2 border-white">
                      {campusNotifs.unread > 99 ? '99+' : campusNotifs.unread}
                    </span>
                  )}
                </button>
                {campusNotifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden max-h-[min(24rem,70vh)] flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue">
                        Notifications
                      </p>
                      {campusNotifs.unread > 0 && (
                        <button
                          type="button"
                          onClick={() => void campusNotifs.markAllRead()}
                          className="text-[9px] font-bold uppercase text-brand-gold hover:underline"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    {campusNotifs.items.length === 0 ? (
                      <p className="px-4 py-6 text-sm text-slate-400 text-center">No messages yet</p>
                    ) : (
                      <ul className="py-2 overflow-y-auto">
                        {campusNotifs.items.map((n) => (
                          <li key={n.id}>
                            <button
                              type="button"
                              className={cn(
                                'w-full px-4 py-3 text-left hover:bg-slate-50 border-l-2',
                                n.read ? 'border-transparent opacity-70' : 'border-brand-gold bg-brand-gold/5'
                              )}
                              onClick={() => {
                                void campusNotifs.markRead(n.id);
                                if (n.link) navigate(n.link);
                                setCampusNotifOpen(false);
                              }}
                            >
                              <p className="text-sm font-bold text-brand-ink">{n.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
            {isRegistrar && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative p-2 text-slate-400 hover:text-brand-blue transition-colors"
                  aria-label="Pending actions"
                >
                  <Bell size={20} />
                  {counts.total > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white">
                      {counts.total > 99 ? '99+' : counts.total}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-brand-blue">
                        Pending actions
                      </p>
                    </div>
                    {counts.total === 0 ? (
                      <p className="px-4 py-6 text-sm text-slate-400 text-center">All caught up</p>
                    ) : (
                      <ul className="py-2">
                        {counts.enrollments > 0 && (
                          <li>
                            <button
                              type="button"
                              className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3"
                              onClick={() => {
                                navigate('/admin?tab=approvals');
                                setNotifOpen(false);
                              }}
                            >
                              <BookMarked size={18} strokeWidth={2} className="text-brand-gold shrink-0" />
                              <span className="text-sm font-medium text-brand-ink flex-1 min-w-0">
                                Enrollment requests
                              </span>
                              <span className="text-xs font-bold bg-brand-gold/20 text-brand-blue px-2 py-0.5 rounded-full shrink-0">
                                {counts.enrollments}
                              </span>
                            </button>
                          </li>
                        )}
                        {counts.grades > 0 && (
                          <li>
                            <button
                              type="button"
                              className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center gap-3"
                              onClick={() => {
                                navigate('/admin?tab=grades');
                                setNotifOpen(false);
                              }}
                            >
                              <ClipboardList size={18} strokeWidth={2} className="text-brand-gold shrink-0" />
                              <span className="text-sm font-medium text-brand-ink flex-1 min-w-0">
                                Grades to validate
                              </span>
                              <span className="text-xs font-bold bg-brand-gold/20 text-brand-blue px-2 py-0.5 rounded-full shrink-0">
                                {counts.grades}
                              </span>
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="h-8 w-[1px] bg-slate-100 ml-2" />

            <Link
              to="/profile"
              className="flex items-center gap-4 group min-w-0 max-w-[11rem] md:max-w-[14rem] shrink-0"
            >
              <div className="text-right hidden sm:block min-w-0 overflow-hidden">
                <p className="text-sm font-bold text-brand-ink leading-none truncate">
                  {profile?.firstName} {profile?.surname}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 capitalize truncate">
                  {profile?.role === 'registrar' ? 'Admin' : profile?.role}
                </p>
              </div>
              <div className="w-10 h-10 shrink-0 rounded-xl bg-brand-gold/10 flex items-center justify-center font-bold text-brand-gold border border-brand-gold/20 transition-transform group-hover:scale-105 text-xs">
                {initials || <span className="text-brand-gold/50 font-medium">{EMPTY}</span>}
              </div>
            </Link>
          </div>
        </header>

        {/* Term status strip */}
        <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-100 py-2.5 px-10 flex flex-wrap items-center justify-between gap-3 min-w-0 sticky top-20 z-20">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {config ? (
              <>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-blue/5 border border-brand-blue/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-gold animate-pulse shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-blue">
                    AY {config.currentAcademicYear}
                  </span>
                </span>
                <span className="px-3 py-1 rounded-full bg-white border border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  {formatSemesterLabel(config.currentSemester)}
                </span>
                {isStudent && enrollmentWindowOpen && (
                  <span className="px-3 py-1 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-[10px] font-bold uppercase tracking-widest text-brand-blue">
                    Enrollment open
                  </span>
                )}
              </>
            ) : (
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Loading academic calendar…
              </span>
            )}
          </div>
          {isRegistrar && config && counts.total > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {counts.enrollments > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/admin?tab=approvals')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/80 text-[10px] font-bold uppercase tracking-widest text-rose-700 hover:bg-rose-100 transition-colors"
                >
                  <span className="tabular-nums">{counts.enrollments}</span>
                  enrollment pending
                </button>
              )}
              {counts.grades > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/admin?tab=grades')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-[10px] font-bold uppercase tracking-widest text-amber-800 hover:bg-amber-100 transition-colors"
                >
                  <span className="tabular-nums">{counts.grades}</span>
                  grade pending
                </button>
              )}
            </div>
          )}
        </div>

        {/* Page Container */}
        <main className="flex-1 overflow-y-auto p-10">
          <div className="h-full min-h-[16rem]">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </motion.div>
  );
}
