import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { getDoc, doc } from 'firebase/firestore';
import { Enrollment, Subject } from '../types';
import { useSystemConfig } from '../hooks/useSystemConfig';
import {
  enrollmentMatchesPortalTermStrict,
  preEnrollmentBlockMessage,
  studyLoadAddBlockMessage,
  addDropBlockMessage,
  studentTermPhaseLabel,
} from '../lib/enrollmentUtils';
import {
  EnrollmentRequestError,
  submitDropEnrollment,
} from '../services/enrollmentRequestService';
import { useStudentEnrollmentStatus } from '../hooks/useStudentEnrollmentStatus';
import {
  canRequestStudyLoadDrop,
  getDropLockDate,
  getAddPeriodStatus,
  getDropPeriodStatus,
  isRegistrarEnrollmentOverride,
} from '../lib/systemConfig';
import { filterStudyLoadEnrollments } from '../lib/studentEnrollments';
import { isInitialPreEnrollmentRow } from '../lib/enrollmentPeriods';
import { toast } from 'react-hot-toast';
import {
  BookMarked,
  Trash2,
  Clock,
  Calendar,
  MapPin,
  ShieldAlert,
  Plus,
  User,
  GraduationCap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchUserRecord, formatUserDisplayName } from '../lib/userLookup';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import PageHeader from '../components/layout/PageHeader';
import { UnitValue } from '../components/UnitsDisplay';
import { unitWord } from '../lib/unitsDisplay';
import ConfigRequiredState from '../components/ConfigRequiredState';
import { formatSemesterLabel } from '../lib/systemConfig';
import { format } from 'date-fns';
import { useUrlSearchQuery } from '../hooks/useUrlSearchQuery';
import { subjectMatchesSearch } from '../lib/searchUtils';

const EnrolledCard = ({
  enrollment,
  onDrop,
  dropLocked,
  professorName,
}: {
  enrollment: any;
  onDrop: (id: string) => void;
  dropLocked: boolean;
  professorName?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-surface p-8 rounded-[2.5rem] border border-border shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between group transition-all hover:shadow-xl hover:shadow-primary/5 relative overflow-hidden"
  >
    <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 rounded-bl-[4rem] -mr-8 -mt-8 pointer-events-none" />

    <div className="flex-1 space-y-6 relative z-10">
      <div className="flex items-center gap-4">
        <div className="bg-background px-3 py-1 rounded-full text-[10px] font-bold text-accent uppercase tracking-widest border border-accent/20">
          SEC {enrollment.subject?.section || 'A'}
        </div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
          {enrollment.subject?.code} · {enrollment.subject?.title}
        </p>
      </div>

      <div>
        <h4 className="text-2xl font-display font-bold text-primary tracking-tight mb-2 group-hover:text-foreground transition-colors">
          <span className="font-mono text-accent text-lg">{enrollment.subject?.code}</span>{' '}
          {enrollment.subject?.title}
        </h4>
        {professorName && (
          <p className="text-xs font-bold text-muted flex items-center gap-2 mb-3">
            <User size={14} className="text-accent" />
            Professor: {professorName}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-muted">
            <Calendar size={14} className="text-accent" />
            <span>Mon / Wed / Fri 09:00 - 10:00 AM</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted">
            <MapPin size={14} className="text-accent" />
            <span>{enrollment.subject?.room || 'Academic Wing L-302'}</span>
          </div>
        </div>
      </div>
    </div>

    <div className="flex items-center gap-8 mt-8 md:mt-0 pt-8 md:pt-0 border-t md:border-t-0 md:border-l border-border md:pl-12">
      <div className="text-right">
        <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Credits</p>
        <UnitValue value={enrollment.subject?.units ?? 0} size="md" className="text-primary" />
      </div>
      <button
        type="button"
        onClick={() => onDrop(enrollment.id)}
        disabled={enrollment.status === 'pending_drop' || dropLocked}
        className={cn(
          'px-8 py-4 rounded-xl border font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm active:scale-95 flex items-center gap-2',
          enrollment.status === 'pending_drop' || dropLocked
            ? 'border-warning/20 bg-warning-muted text-warning grayscale opacity-70 cursor-not-allowed'
            : 'border-danger/20 text-danger hover:bg-danger hover:text-white'
        )}
      >
        {enrollment.status === 'pending_drop' ? <Clock size={14} /> : <Trash2 size={14} />}
        {enrollment.status === 'pending_drop'
          ? 'Drop Pending'
          : dropLocked
            ? 'Drop Locked'
            : 'Request Drop'}
      </button>
    </div>
  </motion.div>
);

export default function StudyLoad() {
  const { profile } = useAuth();
  const { config, loading: configLoading } = useSystemConfig();
  const {
    enrollments: allEnrollments,
    loading: enrollmentLoading,
    canPreEnroll,
    preEnrollBlockReason,
    termPhase,
    isEnrolled,
    hasApprovedStudyLoad,
    hasPendingInitial,
    canRequestAdd,
    canRequestDrop,
    addBlockReason,
    dropBlockReason,
  } = useStudentEnrollmentStatus();
  const [enrichedLoad, setEnrichedLoad] = useState<any[]>([]);
  const [pendingInitialDisplay, setPendingInitialDisplay] = useState<
    { id: string; code: string; title: string }[]
  >([]);
  const [enriching, setEnriching] = useState(true);
  const [searchQuery] = useUrlSearchQuery();

  const rawLoad = useMemo(() => {
    if (!config) return [];
    return filterStudyLoadEnrollments(allEnrollments, config);
  }, [allEnrollments, config]);

  const loadSignature = useMemo(
    () => rawLoad.map((e) => `${e.id}:${e.status}`).join('|'),
    [rawLoad]
  );
  const lastEnrichedSignature = useRef('');

  const pendingThisTerm = useMemo(() => {
    if (!config) return [];
    return allEnrollments.filter(
      (e) => e.status === 'pending' && enrollmentMatchesPortalTermStrict(e, config)
    );
  }, [allEnrollments, config]);

  const pendingInitialThisTerm = useMemo(() => {
    if (!config) return [];
    return allEnrollments.filter(
      (e) =>
        e.status === 'pending' &&
        isInitialPreEnrollmentRow(e) &&
        enrollmentMatchesPortalTermStrict(e, config)
    );
  }, [allEnrollments, config]);

  useEffect(() => {
    if (!config) {
      setEnrichedLoad([]);
      setEnriching(false);
      lastEnrichedSignature.current = '';
      return;
    }

    if (rawLoad.length === 0) {
      setEnrichedLoad([]);
      setEnriching(false);
      lastEnrichedSignature.current = '';
      return;
    }

    if (loadSignature === lastEnrichedSignature.current) {
      setEnriching(false);
      return;
    }

    let cancelled = false;
    setEnriching(true);
    const enrich = async () => {
      try {
        const data = await Promise.all(
          rawLoad.map(async (enrollment) => {
            const subjectSnap = await getDoc(doc(db, 'subjects', enrollment.subjectId));
            const subject = subjectSnap.exists() ? (subjectSnap.data() as Subject) : null;
            let professorName: string | undefined;
            if (subject?.professorId) {
              const prof = await fetchUserRecord(subject.professorId);
              professorName = formatUserDisplayName(prof) || undefined;
            }
            return { ...enrollment, subject, professorName };
          })
        );
        if (!cancelled) {
          setEnrichedLoad(data);
          lastEnrichedSignature.current = loadSignature;
          setEnriching(false);
        }
      } catch {
        if (!cancelled) {
          toast.error('Failed to load course details');
          setEnriching(false);
        }
      }
    };

    void enrich();
    return () => {
      cancelled = true;
    };
  }, [loadSignature, config, rawLoad]);

  useEffect(() => {
    if (!config || pendingInitialThisTerm.length === 0) {
      setPendingInitialDisplay([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const rows = await Promise.all(
        pendingInitialThisTerm.map(async (e) => {
          const snap = await getDoc(doc(db, 'subjects', e.subjectId));
          const sub = snap.exists() ? (snap.data() as Subject) : null;
          return {
            id: e.id,
            code: sub?.code ?? '—',
            title: sub?.title ?? 'Course',
          };
        })
      );
      if (!cancelled) setPendingInitialDisplay(rows);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [pendingInitialThisTerm, config]);

  const offTermApproved = useMemo(() => {
    if (!config) return [];
    return allEnrollments.filter(
      (e) =>
        (e.status === 'approved' || e.status === 'pending_drop') &&
        !enrollmentMatchesPortalTermStrict(e, config)
    );
  }, [allEnrollments, config]);

  const handleDrop = async (enrollmentId: string) => {
    if (!config) return;

    if (!canRequestStudyLoadDrop(config)) {
      toast.error('The drop period is closed (midterm lockout or before classes start).');
      return;
    }

    if (!confirm('Are you sure you want to request to DROP this subject?')) return;

    if (!profile) return;
    try {
      await submitDropEnrollment({ profile, config, enrollmentId, enrollments: allEnrollments });
      toast.success('Drop request submitted for review');
    } catch (e) {
      toast.error(
        e instanceof EnrollmentRequestError ? e.message : 'Failed to submit drop request'
      );
    }
  };

  const filteredLoad = searchQuery.trim()
    ? enrichedLoad.filter((item) =>
        item.subject ? subjectMatchesSearch(item.subject, searchQuery) : false
      )
    : enrichedLoad;

  const totalUnits = filteredLoad.reduce(
    (acc, curr) => acc + (curr.subject?.units || 0),
    0
  );
  const addPeriod = config ? getAddPeriodStatus(config) : { open: false, reason: '' };
  const dropPeriod = config ? getDropPeriodStatus(config) : { open: false, reason: '' };
  const dropLocked = config ? !canRequestStudyLoadDrop(config) : true;
  const addLocked = !canRequestAdd;
  const dropActionLocked = !canRequestDrop;
  const simActive = config ? isRegistrarEnrollmentOverride(config) : false;

  const pageLoading =
    configLoading || (enrollmentLoading && enrichedLoad.length === 0 && rawLoad.length === 0);

  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-[10px] font-bold text-muted uppercase tracking-[0.3em] animate-pulse">
          Loading study load
        </p>
      </div>
    );
  }

  if (!config) {
    return <ConfigRequiredState title="Study load unavailable until term is configured" />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <PageHeader
        title="Study Load"
        subtitle={`AY ${config.currentAcademicYear} · ${formatSemesterLabel(config.currentSemester)}`}
        badge="Current term"
        backTo="/dashboard"
      />

      <p className="text-sm text-muted leading-relaxed -mt-4 max-w-2xl">
        Status: <strong className="text-primary">{studentTermPhaseLabel(termPhase)}</strong>.{' '}
        Pre-enrollment (college, course, subjects) is once per term before you are enrolled. Add/drop
        (including back subjects) is only available after registrar approval, during the add/drop
        period.
      </p>

      {simActive && (
        <p className="text-xs font-bold text-accent bg-accent/10 border border-accent/20 rounded-2xl px-5 py-3">
          Registrar simulation is active — mock date:{' '}
          {config.simulationDate
            ? format(new Date(config.simulationDate), 'MMM d, yyyy')
            : 'set'}
          . Add: {addLocked ? 'locked' : 'open'} ({addPeriod.reason}) · Drop:{' '}
          {dropPeriod.open ? 'open' : 'locked'} ({dropPeriod.reason}).
        </p>
      )}

      {hasPendingInitial && pendingInitialThisTerm.length > 0 && (
        <div className="rounded-2xl border border-warning/20 bg-warning-muted px-5 py-4 space-y-3">
          <p className="text-xs font-bold text-warning">
            Pre-enrollment awaiting approval ({pendingInitialThisTerm.length} course
            {pendingInitialThisTerm.length === 1 ? '' : 's'}) — you are not enrolled until the
            registrar approves your full submission.
          </p>
          <ul className="text-sm text-warning/90 space-y-1">
            {(pendingInitialDisplay.length > 0
              ? pendingInitialDisplay
              : pendingInitialThisTerm.map((e) => ({
                  id: e.id,
                  code: '…',
                  title: 'Loading…',
                }))
            ).map((row) => (
              <li key={row.id}>
                <span className="font-mono">{row.code}</span> — {row.title}
              </li>
            ))}
          </ul>
          <Link
            to="/enrollment"
            className="inline-block text-[10px] font-bold uppercase tracking-widest text-warning underline"
          >
            Enrollment status
          </Link>
        </div>
      )}

      {pendingThisTerm.length > 0 &&
        !hasPendingInitial &&
        enrichedLoad.length === 0 && (
        <p className="text-xs font-bold text-warning bg-warning-muted border border-warning/20 rounded-2xl px-5 py-3">
          You have {pendingThisTerm.length} add request(s) awaiting registrar approval.
        </p>
      )}

      {offTermApproved.length > 0 && (
        <p className="text-xs text-muted bg-surface border border-border rounded-2xl px-5 py-3">
          {offTermApproved.length} approved enrollment(s) are stored for a different term than the
          portal (AY {config.currentAcademicYear} · {formatSemesterLabel(config.currentSemester)}).
          Run <strong>Initialize</strong> again on a clean database, or ask the registrar to align
          enrollments to this term.
        </p>
      )}

      <div className="flex flex-wrap gap-4 p-6 bg-surface rounded-3xl border border-border">
        {termPhase === 'not_enrolled' && canPreEnroll && (
          <Link
            to="/enrollment"
            className="inline-flex items-center gap-2 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-[10px] uppercase tracking-widest"
          >
            <GraduationCap size={14} />
            Pre-Enrollment Wizard
          </Link>
        )}
        {termPhase === 'not_enrolled' && !canPreEnroll && (
          <button
            type="button"
            onClick={() => toast.error(preEnrollmentBlockMessage(preEnrollBlockReason))}
            className="inline-flex items-center gap-2 px-6 py-4 rounded-xl border border-warning/20 text-warning font-bold text-[10px] uppercase tracking-widest opacity-70"
          >
            Pre-Enrollment Closed
          </button>
        )}
        {termPhase === 'pre_enrollment_pending' && (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 px-6 py-4 rounded-xl border border-border text-muted font-bold text-[10px] uppercase tracking-widest opacity-50 cursor-not-allowed"
          >
            <Plus size={14} />
            Request Add (after approval)
          </button>
        )}
        {termPhase === 'pre_enrollment_pending' && (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 px-6 py-4 rounded-xl border border-border text-muted font-bold text-[10px] uppercase tracking-widest opacity-50 cursor-not-allowed"
          >
            <Trash2 size={14} />
            Request Drop (after approval)
          </button>
        )}
        {isEnrolled && (
          <>
            {addLocked ? (
              <button
                type="button"
                onClick={() =>
                  toast.error(
                    studyLoadAddBlockMessage(addBlockReason) ||
                      addDropBlockMessage('not_enrolled')
                  )
                }
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-4 rounded-xl border font-bold text-[10px] uppercase tracking-widest',
                  'border-warning/20 bg-warning-muted text-warning opacity-70 cursor-not-allowed'
                )}
              >
                <Plus size={14} />
                Request Add Locked
              </button>
            ) : (
              <Link
                to="/study-load/add"
                className="inline-flex items-center gap-2 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-[10px] uppercase tracking-widest"
              >
                <Plus size={14} />
                Adding subjects
              </Link>
            )}
            {dropActionLocked ? (
              <button
                type="button"
                onClick={() =>
                  toast.error(
                    addDropBlockMessage(dropBlockReason) || dropPeriod.reason
                  )
                }
                className={cn(
                  'inline-flex items-center gap-2 px-6 py-4 rounded-xl border font-bold text-[10px] uppercase tracking-widest',
                  'border-warning/20 bg-warning-muted text-warning opacity-70 cursor-not-allowed'
                )}
              >
                <Trash2 size={14} />
                Dropping subjects locked
              </button>
            ) : (
              <Link
                to="/study-load/drop"
                className="inline-flex items-center gap-2 px-6 py-4 rounded-xl border border-danger/30 text-danger font-bold text-[10px] uppercase tracking-widest hover:bg-danger/10"
              >
                <Trash2 size={14} />
                Dropping subjects
              </Link>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-6">
          {enriching && rawLoad.length > 0 && (
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest animate-pulse">
              Updating course list…
            </p>
          )}
          {enrichedLoad.length === 0 ? (
            <div className="bg-surface p-20 rounded-[3rem] border border-border text-center shadow-sm">
              <div className="w-20 h-20 bg-background rounded-full flex items-center justify-center text-slate-200 mx-auto mb-8">
                <BookMarked size={40} />
              </div>
              <h3 className="text-xl font-display font-bold text-primary mb-2">
                No Approved Courses This Term
              </h3>
              <p className="text-muted text-sm max-w-md mx-auto leading-relaxed mb-8">
                {termPhase === 'pre_enrollment_pending'
                  ? 'Pre-enrollment is pending registrar approval. You are not enrolled yet — courses appear here after approval.'
                  : termPhase === 'not_enrolled'
                    ? 'Complete the one-time pre-enrollment wizard (college, course, and subjects for this semester). Add/drop unlocks after you are enrolled.'
                    : pendingThisTerm.length > 0
                      ? 'Some requests are still pending approval.'
                      : 'No approved courses on your load. Use Request Add during the add period for back subjects you failed or have not yet passed.'}
              </p>
              {termPhase === 'not_enrolled' && canPreEnroll && !pendingThisTerm.length && (
                <Link
                  to="/enrollment"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-[10px] uppercase tracking-widest"
                >
                  <GraduationCap size={14} />
                  Start Pre-Enrollment
                </Link>
              )}
            </div>
          ) : filteredLoad.length === 0 ? (
            <p className="text-center text-muted text-sm py-12">
              No enrolled courses match your search.
            </p>
          ) : (
            filteredLoad.map((item) => (
              <EnrolledCard
                key={item.id}
                enrollment={item}
                onDrop={handleDrop}
                dropLocked={dropLocked || dropActionLocked}
                professorName={item.professorName}
              />
            ))
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-primary p-10 rounded-[3rem] text-white relative overflow-hidden shadow-2xl shadow-primary/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-surface/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="relative z-10">
              <p className="text-[10px] font-bold text-accent uppercase tracking-[0.3em] mb-8">
                Load Summary
              </p>
              <div className="space-y-6">
                <div className="flex justify-between items-end border-b border-white/10 pb-6">
                  <span className="text-white/40 text-xs font-bold uppercase">Total Units</span>
                  <div className="text-right">
                    <span className="text-4xl font-mono font-bold leading-none">{totalUnits}</span>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mt-1">
                      {unitWord(totalUnits)}
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-end border-b border-white/10 pb-6">
                  <span className="text-white/40 text-xs font-bold uppercase">Course Count</span>
                  <span className="text-2xl font-mono font-bold">{enrichedLoad.length}</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-white/40 text-xs font-bold uppercase">Drop period</span>
                  <span
                    className={cn(
                      'text-xs font-bold uppercase tracking-widest',
                      dropLocked ? 'text-white/50' : 'text-accent'
                    )}
                  >
                    {dropLocked ? 'Closed' : 'Open'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface p-8 rounded-[3rem] border border-border shadow-sm">
            <div className="flex items-center gap-3 mb-6 text-accent">
              <ShieldAlert size={20} />
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">
                System Constraints
              </h4>
            </div>
            <p className="text-xs text-muted leading-relaxed italic mb-8">
              Subject dropping is governed by institutional policy. Electronic filing must be
              completed 7 days prior to midterm examinations.
            </p>
            <div className="space-y-4">
              <div className="bg-background p-6 rounded-2xl border border-border">
                <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                  Midterm Lockout
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-primary">
                    {config?.midtermDate && getDropLockDate(config.midtermDate)
                      ? format(getDropLockDate(config.midtermDate)!, 'MMMM dd, yyyy')
                      : 'TBA'}
                  </p>
                  <Clock size={16} className="text-accent" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
