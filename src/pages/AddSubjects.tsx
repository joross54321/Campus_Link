import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Lock, Plus } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { useStudentEnrollmentStatus } from '../hooks/useStudentEnrollmentStatus';
import { useAddDropPageData } from '../hooks/useAddDropPageData';
import {
  enrollmentsForTerm,
  addDropBlockMessage,
} from '../lib/enrollmentPeriods';
import { studyLoadAddBlockMessage } from '../lib/enrollmentUtils';
import {
  evaluateSubjectEligibility,
  listAddBackCatalog,
} from '../lib/enrollmentEligibility';
import {
  EnrollmentRequestError,
  submitAddEnrollment,
} from '../services/enrollmentRequestService';
import { formatSemesterLabel } from '../lib/systemConfig';
import PageHeader from '../components/layout/PageHeader';
import ConfigRequiredState from '../components/ConfigRequiredState';
import SearchField from '../components/SearchField';
import { useUrlSearchQuery } from '../hooks/useUrlSearchQuery';
import { filterSubjectsBySearch } from '../lib/searchUtils';
import SubjectOfferingCard from '../components/SubjectOfferingCard';

export default function AddSubjects() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { config, loading: configLoading } = useSystemConfig();
  const {
    enrollments,
    loading: statusLoading,
    isEnrolled,
    termPhase,
    hasPendingInitial,
    canRequestAdd,
    addBlockReason,
  } = useStudentEnrollmentStatus();
  const { subjects, passedCodes, capacitySnapshot, loading: dataLoading } =
    useAddDropPageData(profile, enrollments, config);

  const [catalogSearch, setCatalogSearch] = useUrlSearchQuery();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const termEnrollments = config ? enrollmentsForTerm(enrollments, config) : [];
  const enrolledIds = termEnrollments
    .filter(
      (e) =>
        e.status === 'approved' ||
        e.status === 'pending_drop' ||
        (e.status === 'pending' && e.requestType === 'add')
    )
    .map((e) => e.subjectId);

  const catalogPool = useMemo(() => {
    if (!profile || !config) return [];
    return listAddBackCatalog(subjects, profile, config, passedCodes).filter(
      (s) => !enrolledIds.includes(s.id)
    );
  }, [subjects, profile, config, passedCodes, enrolledIds]);

  const withEligibility = useMemo(() => {
    if (!profile || !config) return [];
    return catalogPool.map((s) => ({
      subject: s,
      eligibility: evaluateSubjectEligibility(s, {
        profile,
        config,
        passedCourseCodes: passedCodes,
        enrolledSubjectIds: enrolledIds,
        snapshot: capacitySnapshot,
        intent: 'add_back',
      }),
    }));
  }, [catalogPool, profile, config, passedCodes, enrolledIds, capacitySnapshot]);

  const filtered = filterSubjectsBySearch(
    withEligibility.map((x) => x.subject),
    catalogSearch
  ).map((s) => withEligibility.find((x) => x.subject.id === s.id)!);

  const handleAdd = async (subjectId: string) => {
    if (!profile || !config || !canRequestAdd) return;
    const row = withEligibility.find((x) => x.subject.id === subjectId);
    if (row && !row.eligibility.eligible) return;

    setSubmittingId(subjectId);
    try {
      await submitAddEnrollment({
        profile,
        config,
        enrollments,
        subjects,
        subjectId,
        passedCourseCodes: passedCodes,
      });
      toast.success('Add request submitted for registrar approval');
      navigate('/study-load');
    } catch (e) {
      toast.error(
        e instanceof EnrollmentRequestError ? e.message : 'Add request failed'
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
    return <ConfigRequiredState title="Adding subjects unavailable until term is configured" />;
  }

  if (termPhase === 'not_enrolled') return <Navigate to="/enrollment" replace />;
  if (termPhase === 'pre_enrollment_pending' || hasPendingInitial) {
    return <Navigate to="/enrollment" replace />;
  }
  if (!isEnrolled) {
    return <Navigate to="/enrollment" replace />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <PageHeader
        title="Adding subjects"
        subtitle={`AY ${config.currentAcademicYear} · ${formatSemesterLabel(config.currentSemester)}`}
        backTo="/study-load"
      />

      {!canRequestAdd && (
        <p className="text-sm font-medium text-warning bg-warning-muted border border-warning/20 rounded-2xl px-5 py-3 flex items-center gap-2">
          <Lock size={16} />
          {studyLoadAddBlockMessage(addBlockReason) || addDropBlockMessage('add_period_closed')}
        </p>
      )}

      <p className="text-sm text-muted">
        You can only request <strong className="text-primary">back subjects</strong> here — courses
        from an earlier year level that you should have taken already but either{' '}
        <strong className="text-primary">failed</strong> or have{' '}
        <strong className="text-primary">not yet passed</strong>. They must match the portal semester
        slot ({formatSemesterLabel(config.currentSemester)}) and enroll with that cohort&apos;s
        section. Your current-year load is built through pre-enrollment, not this add screen.
      </p>

      <SearchField
        value={catalogSearch}
        onChange={setCatalogSearch}
        onSubmit={setCatalogSearch}
        placeholder="Search courses…"
      />

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <p className="text-muted text-sm text-center py-12 max-w-lg mx-auto leading-relaxed">
            {catalogSearch.trim()
              ? 'No back subjects match your search.'
              : 'No back subjects available to add. If you still need a current-year course, it belongs on your study load from pre-enrollment; this screen is only for retakes or courses you missed from earlier years.'}
          </p>
        ) : (
          filtered.map(({ subject, eligibility }) => (
            <SubjectOfferingCard
              key={subject.id}
              subject={subject}
              eligibility={eligibility}
              config={config}
              compact
              actionLabel={submittingId === subject.id ? 'Submitting…' : 'Request add'}
              onToggle={() => void handleAdd(subject.id)}
            />
          ))
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
