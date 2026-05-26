import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Lock, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { useStudentEnrollmentStatus } from '../hooks/useStudentEnrollmentStatus';
import { useAddDropPageData } from '../hooks/useAddDropPageData';
import { addDropBlockMessage } from '../lib/enrollmentPeriods';
import { filterStudyLoadEnrollments } from '../lib/studentEnrollments';
import {
  EnrollmentRequestError,
  submitDropEnrollment,
} from '../services/enrollmentRequestService';
import { formatSemesterLabel } from '../lib/systemConfig';
import PageHeader from '../components/layout/PageHeader';
import ConfigRequiredState from '../components/ConfigRequiredState';
import { cn } from '../lib/utils';

export default function DropSubjects() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { config, loading: configLoading } = useSystemConfig();
  const {
    enrollments,
    loading: statusLoading,
    isEnrolled,
    termPhase,
    canRequestDrop,
    dropBlockReason,
    hasApprovedStudyLoad,
    hasPendingInitial,
  } = useStudentEnrollmentStatus();
  const { loadByEnrollmentId, loading: dataLoading } = useAddDropPageData(
    profile,
    enrollments,
    config
  );

  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const studyLoadRows = config ? filterStudyLoadEnrollments(enrollments, config) : [];
  const droppable = studyLoadRows.filter((e) => e.status === 'approved');

  const handleDrop = async (enrollmentId: string) => {
    if (!profile || !config) return;
    if (!canRequestDrop) {
      toast.error(
        addDropBlockMessage(dropBlockReason) || addDropBlockMessage('drop_period_closed')
      );
      return;
    }
    if (!confirm('Request to drop this subject? The registrar must approve.')) return;

    setSubmittingId(enrollmentId);
    try {
      await submitDropEnrollment({ profile, config, enrollmentId, enrollments });
      toast.success('Drop request submitted for registrar approval');
      navigate('/study-load');
    } catch (e) {
      toast.error(
        e instanceof EnrollmentRequestError ? e.message : 'Drop request failed'
      );
    } finally {
      setSubmittingId(null);
    }
  };

  const loading = configLoading || statusLoading || dataLoading;

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!config) {
    return <ConfigRequiredState title="Dropping subjects unavailable until term is configured" />;
  }

  if (termPhase === 'not_enrolled') return <Navigate to="/enrollment" replace />;
  if (termPhase === 'pre_enrollment_pending' || hasPendingInitial) {
    return <Navigate to="/enrollment" replace />;
  }
  if (!isEnrolled && !hasApprovedStudyLoad) {
    return <Navigate to="/enrollment" replace />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <PageHeader
        title="Dropping subjects"
        subtitle={`AY ${config.currentAcademicYear} · ${formatSemesterLabel(config.currentSemester)}`}
        backTo="/study-load"
      />

      {!canRequestDrop && (
        <p className="text-sm font-medium text-warning bg-warning-muted border border-warning/20 rounded-2xl px-5 py-3 flex items-center gap-2">
          <Lock size={16} />
          {addDropBlockMessage(dropBlockReason) || addDropBlockMessage('drop_period_closed')}
        </p>
      )}

      <p className="text-sm text-muted">
        Only approved courses for AY {config.currentAcademicYear} ·{' '}
        {formatSemesterLabel(config.currentSemester)} can be dropped here. Older terms stay on your
        record but are not listed.
      </p>

      <div className="space-y-4">
        {droppable.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-muted text-sm">
              No approved courses on your load for this term yet.
            </p>
            <Link
              to="/study-load"
              className="text-[10px] font-bold uppercase tracking-widest text-primary"
            >
              Back to study load
            </Link>
          </div>
        ) : (
          droppable.map((e) => {
            const sub = loadByEnrollmentId[e.id];
            return (
              <div
                key={e.id}
                className="bg-surface p-6 rounded-2xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div>
                  <p className="font-mono text-sm text-accent">{sub?.code ?? '—'}</p>
                  <p className="font-bold text-primary">{sub?.title ?? 'Course'}</p>
                  <p className="text-xs text-muted mt-1">Sec {sub?.section ?? '—'}</p>
                </div>
                <button
                  type="button"
                  disabled={!canRequestDrop || submittingId === e.id}
                  onClick={() => void handleDrop(e.id)}
                  className={cn(
                    'inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest shrink-0',
                    canRequestDrop
                      ? 'border border-danger/40 text-danger hover:bg-danger/10'
                      : 'opacity-50 cursor-not-allowed border-border text-muted'
                  )}
                >
                  <Trash2 size={14} />
                  {submittingId === e.id ? 'Submitting…' : 'Request drop'}
                </button>
              </div>
            );
          })
        )}
      </div>

      <Link
        to="/study-load"
        className="text-[10px] font-bold uppercase tracking-widest text-accent"
      >
        ← Back to study load
      </Link>
    </div>
  );
}
