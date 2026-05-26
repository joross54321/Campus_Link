import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { useStudentEnrollmentStatus } from '../hooks/useStudentEnrollmentStatus';
import { useCampusNotifications } from '../hooks/useCampusNotifications';
import { enrollmentMatchesTerm } from '../lib/enrollmentUtils';
import { formatSemesterLabel } from '../lib/systemConfig';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import {
  BookOpen,
  LayoutGrid,
  ArrowRight,
  Award,
  BookMarked,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';
import { Link, Navigate } from 'react-router-dom';
import { getHomePathForRole } from '../lib/authRoutes';
import { cn } from '../lib/utils';

const DashboardCard = ({
  to,
  icon: Icon,
  title,
  desc,
  delay = 0,
}: {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  desc: string;
  delay?: number;
}) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
    <Link
      to={to}
      className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-brand-gold/30 hover:-translate-y-1 transition-all group flex flex-col h-full overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -mr-16 -mt-16 group-hover:bg-brand-gold/10 transition-colors" />
      <div className="w-12 h-12 rounded-2xl bg-brand-blue/5 flex items-center justify-center mb-10 transition-transform group-hover:scale-110 relative z-10">
        <Icon size={24} className="text-brand-blue" />
      </div>
      <div className="relative z-10 mt-auto">
        <h3 className="text-xl font-display font-bold text-brand-blue mb-2 group-hover:text-brand-gold transition-colors">
          {title}
        </h3>
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-widest truncate">{desc}</p>
          <ArrowRight size={14} className="text-slate-300 group-hover:text-brand-gold group-hover:translate-x-1 transition-all shrink-0" />
        </div>
      </div>
    </Link>
  </motion.div>
);

const SummaryCard = ({
  label,
  value,
  icon: Icon,
  color,
  valueClassName,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
  valueClassName?: string;
}) => (
  <div className="bg-white p-8 rounded-3xl border border-slate-100 flex items-center gap-6 relative overflow-hidden group">
    <div
      className={cn(
        'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 relative z-10 transition-transform group-hover:rotate-12',
        color
      )}
    >
      <Icon size={24} className="text-brand-blue" />
    </div>
    <div className="relative z-10 min-w-0">
      <p
        className={cn(
          'font-mono font-bold text-brand-ink leading-none mb-1',
          typeof value === 'number' ? 'text-3xl' : 'text-lg uppercase tracking-wide',
          valueClassName
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</p>
    </div>
    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover:scale-150">
      <Icon size={120} />
    </div>
  </div>
);

export default function Dashboard() {
  const { profile, isStudent, loading } = useAuth();
  const { config } = useSystemConfig();
  const { canEnroll, enrollments, termPhase, isEnrolled } = useStudentEnrollmentStatus();
  const { unread: unreadNotifs } = useCampusNotifications();
  const [stats, setStats] = useState({
    coursesThisTerm: 0,
    unitsThisTerm: 0,
    creditsEarned: 0,
    pendingRequests: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!isStudent || !profile || !config) return;
      const termEnrollments = enrollments.filter(
        (e) =>
          enrollmentMatchesTerm(e, config) &&
          (e.status === 'approved' || e.status === 'pending' || e.status === 'pending_drop')
      );
      const approved = termEnrollments.filter((e) => e.status === 'approved');
      const pendingRequests = termEnrollments.filter(
        (e) => e.status === 'pending' || e.status === 'pending_drop'
      ).length;

      let unitsThisTerm = 0;
      await Promise.all(
        approved.map(async (e) => {
          const subSnap = await getDoc(doc(db, 'subjects', e.subjectId));
          if (subSnap.exists()) unitsThisTerm += subSnap.data().units ?? 0;
        })
      );

      const gradesQ = query(
        collection(db, 'grades'),
        where('userId', '==', profile.uid),
        where('status', '==', 'posted')
      );
      const gradesSnap = await getDocs(gradesQ);
      let creditsEarned = 0;
      for (const gd of gradesSnap.docs) {
        const g = gd.data();
        if (g.grade > 3.0) continue;
        const subSnap = await getDoc(doc(db, 'subjects', g.subjectId));
        if (subSnap.exists()) creditsEarned += subSnap.data().units ?? 0;
      }

      setStats({
        coursesThisTerm: approved.length,
        unitsThisTerm,
        creditsEarned,
        pendingRequests,
      });
    };
    void fetchData();
  }, [profile, config, isStudent, enrollments]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  if (!isStudent || !profile) {
    return <Navigate to={getHomePathForRole(profile?.role)} replace />;
  }

  const isEnrolledThisTerm = config && isEnrolled;

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 md:pb-28">
      <section className="relative rounded-[3rem] overflow-hidden bg-brand-blue p-12 lg:p-20 text-white shadow-2xl">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-gold rounded-full filter blur-[100px]" />
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="bg-brand-gold text-brand-blue px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-brand-gold/20">
                Session Active
              </div>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
                {config
                  ? `AY ${config.currentAcademicYear} · ${formatSemesterLabel(config.currentSemester)}`
                  : 'Loading term...'}
              </p>
            </div>
            <h1 className="text-5xl lg:text-7xl font-display font-bold tracking-tight mb-4">
              Hello, <span className="text-brand-gold">{profile?.firstName}</span>
            </h1>
            <p className="text-white/60 text-lg lg:text-xl font-light max-w-lg leading-relaxed">
              Secure your academic future. Complete your enrollment, manage your course selections, and prepare for the upcoming term.
            </p>
          </div>

          <div className="flex gap-4 flex-wrap">
            <Link
              to="/study-load"
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              Study Load
            </Link>
            <Link
              to="/profile"
              className="bg-brand-gold hover:bg-brand-gold/90 text-brand-blue px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl shadow-brand-gold/10"
            >
              System Profile
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DashboardCard
              to="/services"
              icon={LayoutGrid}
              title="Student Services"
              desc="University service hub"
              delay={0.05}
            />
            {canEnroll && (
              <DashboardCard
                to="/enrollment"
                icon={BookOpen}
                title="Course Enrollment"
                desc="Pre-enrollment wizard"
                delay={0.1}
              />
            )}
            <DashboardCard
              to="/study-load"
              icon={BookOpen}
              title="Study Load"
              desc="Current term courses"
              delay={0.15}
            />
            <DashboardCard
              to="/grades"
              icon={Award}
              title="Grades"
              desc="Scholastic records"
              delay={0.2}
            />
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-2xl font-display font-bold text-brand-blue tracking-tight">This term</h2>
          <div className="space-y-4">
            <SummaryCard
              label="Courses enrolled"
              value={stats.coursesThisTerm}
              icon={BookMarked}
              color="bg-brand-blue/5"
            />
            <SummaryCard
              label="Units this term"
              value={stats.unitsThisTerm}
              icon={BookOpen}
              color="bg-brand-gold/10"
            />
            <SummaryCard
              label="Enrollment status"
              value={isEnrolledThisTerm ? 'Enrolled' : 'Not enrolled'}
              icon={ShieldCheck}
              color={isEnrolledThisTerm ? 'bg-emerald-50' : 'bg-amber-50'}
              valueClassName={isEnrolledThisTerm ? 'text-emerald-700' : 'text-amber-700'}
            />
            {stats.pendingRequests > 0 && (
              <SummaryCard
                label="Pending requests"
                value={stats.pendingRequests}
                icon={Award}
                color="bg-amber-50"
              />
            )}
            <SummaryCard
              label="Credits earned (posted)"
              value={stats.creditsEarned}
              icon={Award}
              color="bg-emerald-50"
            />
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-[10px] font-bold text-brand-gold uppercase tracking-widest mb-2">
                {unreadNotifs > 0 ? `${unreadNotifs} new notification${unreadNotifs === 1 ? '' : 's'}` : 'Quick tip'}
              </p>
              <h4 className="font-display font-bold text-xl mb-2">
                {unreadNotifs > 0 ? 'Check your inbox' : 'Keep your profile current'}
              </h4>
              <p className="text-white/40 text-sm leading-relaxed font-light">
                {unreadNotifs > 0
                  ? 'Use the bell in the top bar for enrollment approvals and campus updates.'
                  : 'Your contact details and password are in System Profile. Credits earned count posted passing grades.'}
              </p>
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-brand-gold/10 rounded-full blur-[40px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
