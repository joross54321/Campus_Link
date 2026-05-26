import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Calendar, BookMarked, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import PageHeader from '../components/layout/PageHeader';
import { useAuth } from '../hooks/useAuth';
import { getHomePathForRole } from '../lib/authRoutes';

const ServiceCard = ({
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
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
    <Link
      to={to}
      className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-brand-gold/30 hover:-translate-y-1 transition-all group flex flex-col h-full"
    >
      <div className="w-12 h-12 rounded-2xl bg-brand-blue/5 flex items-center justify-center mb-8">
        <Icon size={24} className="text-brand-blue" />
      </div>
      <h3 className="text-xl font-display font-bold text-brand-blue mb-2 group-hover:text-brand-gold transition-colors">
        {title}
      </h3>
      <div className="flex items-center justify-between gap-2 mt-auto">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">{desc}</p>
        <ArrowRight size={14} className="text-slate-300 group-hover:text-brand-gold shrink-0" />
      </div>
    </Link>
  </motion.div>
);

export default function Services() {
  const { profile, isStudent, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-gold border-t-transparent" />
      </div>
    );
  }

  if (!isStudent || !profile) {
    return <Navigate to={getHomePathForRole(profile?.role)} replace />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 md:pb-28">
      <PageHeader
        title="Student Services"
        subtitle="University modules and academic tools"
        backTo="/dashboard"
        feedbackOnBack
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
        <ServiceCard
          to="/schedule"
          icon={Calendar}
          title="Class Schedule"
          desc="Weekly calendar view"
          delay={0.05}
        />
        <ServiceCard
          to="/enrollment"
          icon={BookMarked}
          title="Enrollment System"
          desc="Pre-enrollment and enrollment status"
          delay={0.1}
        />
      </div>
    </div>
  );
}
