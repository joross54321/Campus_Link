import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { ArrowRight, BookOpen, Layers, ClipboardList } from 'lucide-react';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { formatSemesterLabel } from '../lib/systemConfig';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import { useProfessorSections } from '../hooks/useProfessorSections';
import { SectionChips } from '../components/ui/SectionChips';

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
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
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
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">{desc}</p>
          <ArrowRight
            size={14}
            className="text-slate-300 group-hover:text-brand-gold group-hover:translate-x-1 transition-all"
          />
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
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number }>;
  color: string;
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
    <div className="relative z-10">
      <p className="text-3xl font-mono font-bold text-brand-ink leading-none mb-1">{value}</p>
      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</p>
    </div>
    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover:scale-150">
      <Icon size={120} />
    </div>
  </div>
);

export default function ProfessorDashboard() {
  const { profile, user } = useAuth();
  const { config } = useSystemConfig();
  const { sections: professorSections } = useProfessorSections(
    user?.uid,
    profile?.handlingSections
  );

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
                Faculty Session
              </div>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
                {config
                  ? `AY ${config.currentAcademicYear} · ${formatSemesterLabel(config.currentSemester)}`
                  : 'Loading term...'}
              </p>
            </div>
            <h1 className="text-5xl lg:text-7xl font-display font-bold tracking-tight mb-4">
              Hello, <span className="text-brand-gold">Prof. {profile?.surname}</span>
            </h1>
            <p className="text-white/60 text-lg lg:text-xl font-light max-w-lg leading-relaxed">
              Manage your assigned academic loads, monitor student progress, and finalize scholastic evaluations with precision.
            </p>
          </div>

          <div className="flex gap-4 flex-wrap">
            <Link
              to="/professor/grades"
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              Student Grades
            </Link>
            <Link
              to="/professor/subjects"
              className="bg-brand-gold hover:bg-brand-gold/90 text-brand-blue px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-xl shadow-brand-gold/10"
            >
              My Subjects
            </Link>
            <Link
              to="/profile"
              className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
            >
              Faculty Profile
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <DashboardCard
          to="/professor/subjects"
          icon={Layers}
          title="My Subjects"
          desc="Assigned courses only"
          delay={0.1}
        />
        <DashboardCard
          to="/professor/grades"
          icon={ClipboardList}
          title="Student Grades"
          desc="Posted scholastic records"
          delay={0.2}
        />
      </div>

      <div className="pb-4">
        <h2 className="text-2xl font-display font-bold text-brand-blue tracking-tight mb-8 text-center lg:text-left">
          Instructional Overview
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl">
          <Link
            to="/professor/subjects"
            className="block transition-transform hover:scale-[1.02] active:scale-95"
          >
            <SummaryCard
              label="Assigned Sections"
              value={professorSections.length || '—'}
              icon={BookOpen}
              color="bg-brand-gold/10"
            />
          </Link>
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
              Section assignments
            </p>
            <SectionChips sections={professorSections} />
          </div>
        </div>
      </div>
    </div>
  );
}
