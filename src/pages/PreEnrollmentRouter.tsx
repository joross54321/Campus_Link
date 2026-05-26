import React from 'react';
import { Clock, Lock } from 'lucide-react';
import { useStudentEnrollmentStatus } from '../hooks/useStudentEnrollmentStatus';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { enrollmentMatchesPortalTermStrict } from '../lib/studentEnrollments';
import { hasOffPortalTermEnrollment } from '../lib/enrollmentEligibility';
import { preEnrollmentBlockMessage } from '../lib/enrollmentUtils';
import AlreadyEnrolled from './AlreadyEnrolled';
import EnrollmentTermMismatch from './EnrollmentTermMismatch';
import EnrollmentWizard from './EnrollmentWizard';
import ConfigRequiredState from '../components/ConfigRequiredState';
import { Link } from 'react-router-dom';

export default function PreEnrollmentRouter() {
  const { config, loading: configLoading } = useSystemConfig();
  const {
    loading: statusLoading,
    isEnrolled,
    termPhase,
    canPreEnroll,
    preEnrollBlockReason,
    enrollments,
  } = useStudentEnrollmentStatus();

  if (configLoading || statusLoading) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-2 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (!config) {
    return <ConfigRequiredState title="Enrollment unavailable until term is configured" />;
  }

  const hasCurrentTermLoad =
    config &&
    enrollments.some(
      (e) =>
        (e.status === 'approved' || e.status === 'pending_drop') &&
        enrollmentMatchesPortalTermStrict(e, config)
    );

  const hasOffTermApproved =
    config && !hasCurrentTermLoad && hasOffPortalTermEnrollment(enrollments, config);

  if (termPhase === 'pre_enrollment_pending') {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center bg-white rounded-3xl border border-slate-100 p-12">
        <Clock size={40} className="mx-auto text-brand-gold mb-6" />
        <h2 className="text-2xl font-display font-bold text-brand-blue mb-4">
          Pre-enrollment submitted
        </h2>
        <p className="text-slate-500 mb-8">{preEnrollmentBlockMessage('awaiting_approval')}</p>
        <Link
          to="/study-load"
          className="inline-block bg-brand-blue text-white px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-widest"
        >
          Track on study load
        </Link>
      </div>
    );
  }

  if (isEnrolled || termPhase === 'enrolled') {
    return <AlreadyEnrolled />;
  }

  if (hasOffTermApproved) {
    return <EnrollmentTermMismatch />;
  }

  if (!canPreEnroll) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center bg-white rounded-3xl border border-slate-100 p-12">
        <Lock size={40} className="mx-auto text-brand-gold mb-6" />
        <h2 className="text-2xl font-display font-bold text-brand-blue mb-4">
          Pre-enrollment unavailable
        </h2>
        <p className="text-slate-500 mb-8">
          {preEnrollmentBlockMessage(preEnrollBlockReason) ||
            'Pre-enrollment is not open for this term.'}
        </p>
        <Link
          to="/services"
          className="inline-block bg-brand-blue text-white px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-widest"
        >
          Back to services
        </Link>
      </div>
    );
  }

  return <EnrollmentWizard />;
}
