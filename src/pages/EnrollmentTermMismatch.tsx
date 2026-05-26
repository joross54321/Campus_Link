import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { formatSemesterLabel } from '../lib/systemConfig';
import PageHeader from '../components/layout/PageHeader';

export default function EnrollmentTermMismatch() {
  const { config } = useSystemConfig();

  return (
    <div className="max-w-2xl mx-auto space-y-10 pb-20">
      <PageHeader title="Enrollment records" backTo="/services" />

      <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-sm space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
          <AlertTriangle size={32} className="text-amber-600" />
        </div>
        <h2 className="text-2xl font-display font-bold text-brand-blue">
          Courses on file for another term
        </h2>
        <p className="text-slate-500 text-sm leading-relaxed max-w-md mx-auto">
          You have approved enrollments that do not match the portal&apos;s current term
          {config
            ? ` (AY ${config.currentAcademicYear} · ${formatSemesterLabel(config.currentSemester)})`
            : ''}
          . Pre-enrollment and add/drop use the current term only. Ask the registrar to re-approve
          your load for this term, or run <strong>Foundation seed</strong> again after setting the
          portal term (demo data will be re-stamped).
        </p>
        <Link
          to="/study-load"
          className="inline-block bg-brand-blue text-white px-8 py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest"
        >
          View study load
        </Link>
      </div>
    </div>
  );
}
