import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  setDoc,
  serverTimestamp,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { Enrollment, UserProfile, Subject } from '../types';
import { toast } from 'react-hot-toast';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  Database,
  UserPlus,
  ArrowUpRight,
  ClipboardCheck,
  GraduationCap,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, omitUndefined } from '../lib/utils';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { formatSemesterLabel } from '../lib/systemConfig';
import {
  createCampusNotification,
  dismissEnrollmentDecisionNotifications,
  enrollmentNotificationCopy,
} from '../lib/campusNotifications';
import { useScreenFeedback } from '../contexts/ScreenFeedbackContext';
import { resolveCurrentTermFromCalendar } from '../lib/isatuAcademicCalendar';
import { enrollmentRequestLabel } from '../lib/enrollmentPeriods';
import PageHeader from '../components/layout/PageHeader';
import { SectionChips } from '../components/ui/SectionChips';
import UserAvatar from '../components/admin/UserAvatar';
import AdminActivityLogPanel from '../components/admin/AdminActivityLogPanel';
import EnrollmentSimulationPanel from '../components/admin/EnrollmentSimulationPanel';
import { useAuth } from '../hooks/useAuth';
import {
  appendAdminLog,
  fetchAdminLogs,
  type AdminActivityLog,
} from '../lib/adminActivityLog';
import { EMPTY, EMPTY_SHORT, parseDisplayName } from '../lib/displayUtils';
import { COLLEGES, collegeNameById } from '../lib/colleges';
import { runFoundationSeedWithClear } from '../services/foundationSeedService';
import { ensureSeedUser } from '../services/authService';
import {
  sectionsForProgram,
  studentsInDirectory,
  dedupeUserProfiles,
  professorsForCollege,
  subjectsForCollege,
  pendingCountForCollege,
  hasPendingForCollege,
  normalizeCollegeName,
  sectionMatchesProgram,
} from '../lib/directoryUtils';
import {
  fetchUserRecord,
  formatUserDisplayName,
  formatFirestoreDate,
} from '../lib/userLookup';
import { useUrlSearchQuery } from '../hooks/useUrlSearchQuery';
import {
  filterSubjectsBySearch,
  filterUsersBySearch,
  matchesSearch,
} from '../lib/searchUtils';
import { buildLocalSearchIndex } from '../hooks/useSearchIndex';
import SearchField from '../components/SearchField';
import {
  suggestionQueryValue,
  type SearchSuggestion,
} from '../lib/searchSuggestions';

function collegeNameForDrill(collegeId?: string) {
  return collegeId ? collegeNameById(collegeId) : undefined;
}

function CollegeIconBadge({ collegeId }: { collegeId: string }) {
  return (
    <div className="w-14 h-14 rounded-2xl bg-brand-blue/5 border border-brand-blue/10 flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-brand-blue tracking-wider">{collegeId}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const { config, runSemesterTransition, refresh, enrollmentWindowOpen, alignWithIsatuCalendar } =
    useSystemConfig();
  const { triggerFeedback } = useScreenFeedback();
  const [searchParams, setSearchParams] = useSearchParams();
  const [systemSaving, setSystemSaving] = useState(false);
  const [automationBusy, setAutomationBusy] = useState(false);
  const initialTab = (searchParams.get('tab') as any) || 'approvals';
  const [activeTab, setActiveTab] = useState<'users' | 'approvals' | 'grades' | 'system'>(initialTab);
  
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'users' | 'approvals' | 'grades' | 'system') => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  };

  const [navPath, setNavPath] = useState<any[]>([{ id: 'root', label: 'Colleges' }]);
  const [drillDown, setDrillDown] = useState<{
    level: 'colleges' | 'subRole' | 'faculty' | 'programs' | 'sections' | 'students' | 'detail' | 'subjects' | 'subjectStudents';
    collegeId?: string;
    subRole?: 'student' | 'professor';
    program?: string;
    section?: string;
    selectedUserId?: string;
    subjectId?: string;
  }>({ level: 'colleges' });

  const goBack = () => {
    triggerFeedback('navigate');
    if (activeTab === 'approvals' && drillDown.level === 'subjectStudents') {
      setDrillDown((prev) => ({ ...prev, level: 'subjects' }));
      return;
    }
    if (activeTab === 'grades' && drillDown.level === 'detail') {
      setDrillDown((prev) => ({ ...prev, level: 'students' }));
      return;
    }
    if (drillDown.level === 'detail') setDrillDown(prev => ({ ...prev, level: prev.subRole === 'professor' ? 'faculty' : 'students' }));
    else if (drillDown.level === 'students') setDrillDown(prev => ({ ...prev, level: 'sections' }));
    else if (drillDown.level === 'sections') setDrillDown(prev => ({ ...prev, level: 'programs' }));
    else if (drillDown.level === 'programs') setDrillDown({ level: 'colleges', collegeId: drillDown.collegeId });
    else if (drillDown.level === 'faculty') setDrillDown(prev => ({ ...prev, level: 'subRole' }));
    else if (drillDown.level === 'subRole') setDrillDown({ level: 'colleges' });
    else if (drillDown.level === 'subjects') setDrillDown({ level: 'colleges' });
    else if (drillDown.level === 'subjectStudents') setDrillDown(prev => ({ ...prev, level: 'subjects' }));
  };

  const [pendingEnrollments, setPendingEnrollments] = useState<any[]>([]);
  const [pendingGrades, setPendingGrades] = useState<any[]>([]);
  const [subjectRoster, setSubjectRoster] = useState<any[]>([]);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [simulationDateInput, setSimulationDateInput] = useState('');
  const [userList, setUserList] = useState<UserProfile[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [userFilter, setUserFilter] = useState<'student' | 'professor'>('student');
  const [searchQuery, setSearchQuery] = useUrlSearchQuery();

  const directoryGlobalHits = useMemo(
    () => (searchQuery.trim() ? filterUsersBySearch(userList, searchQuery) : []),
    [searchQuery, userList]
  );

  const subjectsForCollegeFiltered = (collegeId: string | undefined) =>
    filterSubjectsBySearch(subjectsForCollege(subjects, collegeId), searchQuery);

  const directorySearchIndex = useMemo(
    () => buildLocalSearchIndex(userList, subjects, 'registrar'),
    [userList, subjects]
  );

  const handleDirectorySuggestion = (s: SearchSuggestion) => {
    const next = new URLSearchParams(searchParams);
    if (s.kind === 'subject') {
      next.set('tab', 'approvals');
      next.set('q', suggestionQueryValue(s));
      next.delete('userId');
      setSearchParams(next);
      setActiveTab('approvals');
      return;
    }
    next.set('tab', 'users');
    next.set('userId', s.id.replace(/^user-/, ''));
    next.delete('q');
    setSearchParams(next);
    setActiveTab('users');
  };
  const [loading, setLoading] = useState(false);
  const [adminLogs, setAdminLogs] = useState<AdminActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const refreshAdminLogs = async () => {
    setLogsLoading(true);
    try {
      setAdminLogs(await fetchAdminLogs(40));
    } finally {
      setLogsLoading(false);
    }
  };
  const [studentDetail, setStudentDetail] = useState<{
    courses: { title: string; code: string; grade: string; units: number; status: string }[];
    gwa: number | null;
    totalUnits: number;
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form State for New User
  const [newUser, setNewUser] = useState({
    studentId: '',
    surname: '',
    firstName: '',
    role: 'student' as 'student' | 'professor',
    college: 'CCI',
    program: 'BS Computer Science',
    section: 'BSCS 1-A',
    yearLevel: 1,
  });

  useEffect(() => {
    setDrillDown({ level: 'colleges' });
  }, [activeTab]);

  useEffect(() => {
    fetchPendingApprovals();
    fetchPendingGrades();
    fetchUsers();
    fetchSubjects();
    void refreshAdminLogs();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') void refreshAdminLogs();
  }, [activeTab]);

  useEffect(() => {
    const userId = searchParams.get('userId');
    if (!userId || activeTab !== 'users' || userList.length === 0) return;
    const u = userList.find((x) => x.uid === userId);
    if (!u) return;
    const college = COLLEGES.find(
      (c) => c.name === u.college || c.programs.includes(u.program ?? '')
    );
    setDrillDown({
      level: 'detail',
      selectedUserId: u.uid,
      subRole: u.role === 'professor' ? 'professor' : 'student',
      collegeId: college?.id,
      program: u.program,
      section: u.section,
    });
  }, [searchParams, activeTab, userList]);

  const fetchSubjects = async () => {
    try {
      const snap = await getDocs(collection(db, 'subjects'));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
      setSubjects(data);
    } catch (e) {
      toast.error('Failed to fetch subjects');
    }
  };

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snap = await getDocs(q);
      const data = dedupeUserProfiles(
        snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile))
      );
      setUserList(data);
    } catch (e) {
      toast.error('Failed to fetch user index');
    }
  };

  const fetchPendingGrades = async () => {
    try {
      const q = query(collection(db, 'grades'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      const data = await Promise.all(snap.docs.map(async d => {
        const grade = { id: d.id, ...d.data() } as any;
        const userData = await fetchUserRecord(grade.userId);
        const subSnap = await getDoc(doc(db, 'subjects', grade.subjectId));
        return {
          ...grade,
          studentName: formatUserDisplayName(userData),
          subjectTitle: subSnap.exists() ? subSnap.data().title : 'Unknown',
        };
      }));
      setPendingGrades(data);
    } catch (e) {
      toast.error('Failed to fetch grades');
    }
  };

  const fetchSubjectRoster = async (subjectId: string) => {
    try {
      const configSnap = await getDoc(doc(db, 'system', 'config'));
      const sys = configSnap.data();
      const subSnap = await getDoc(doc(db, 'subjects', subjectId));
      if (!subSnap.exists()) return;
      const subject = subSnap.data();

      const eq = query(
        collection(db, 'enrollments'),
        where('subjectId', '==', subjectId),
        where('status', '==', 'approved')
      );
      const enrollSnap = await getDocs(eq);
      const roster = await Promise.all(
        enrollSnap.docs.map(async (d) => {
          const en = d.data();
          const userData = await fetchUserRecord(en.userId);
          const gradeId = `${en.userId}_${subjectId}`;
          const gradeSnap = await getDoc(doc(db, 'grades', gradeId));
          const g = gradeSnap.exists() ? gradeSnap.data() : null;
          return {
            userId: en.userId,
            studentName: formatUserDisplayName(userData),
            studentId: userData?.studentId ? String(userData.studentId) : EMPTY_SHORT,
            postedGrade: g?.status === 'posted' ? g.grade : null,
          };
        })
      );
      setSubjectRoster(roster);
      const inputs: Record<string, string> = {};
      roster.forEach((r) => {
        if (r.postedGrade != null) inputs[r.userId] = String(r.postedGrade);
      });
      setGradeInputs(inputs);
    } catch {
      toast.error('Failed to load section roster');
    }
  };

  useEffect(() => {
    if (drillDown.level === 'subjectStudents' && drillDown.subjectId) {
      fetchSubjectRoster(drillDown.subjectId);
    }
  }, [drillDown.level, drillDown.subjectId]);

  const loadStudentDetail = async (userId: string) => {
    setDetailLoading(true);
    try {
      const enSnap = await getDocs(
        query(
          collection(db, 'enrollments'),
          where('userId', '==', userId),
          where('status', '==', 'approved')
        )
      );
      const courses: {
        title: string;
        code: string;
        grade: string;
        units: number;
        status: string;
      }[] = [];
      let totalPoints = 0;
      let totalUnits = 0;

      for (const d of enSnap.docs) {
        const en = d.data();
        const subSnap = await getDoc(doc(db, 'subjects', en.subjectId));
        const sub = subSnap.exists() ? subSnap.data() : null;
        const gradeSnap = await getDoc(doc(db, 'grades', `${userId}_${en.subjectId}`));
        const g = gradeSnap.exists() ? gradeSnap.data() : null;
        const units = Number(sub?.units ?? 3);
        const posted = g?.status === 'posted' ? Number(g.grade) : null;
        if (posted != null && !Number.isNaN(posted)) {
          totalPoints += posted * units;
          totalUnits += units;
        }
        courses.push({
          title: sub?.title ?? 'Unknown subject',
          code: sub?.code ?? en.subjectId,
          grade: posted != null ? posted.toFixed(2) : g?.status === 'pending' ? 'Pending' : EMPTY,
          units,
          status: String(en.status),
        });
      }

      setStudentDetail({
        courses,
        gwa: totalUnits > 0 ? totalPoints / totalUnits : null,
        totalUnits,
      });
    } catch {
      toast.error('Could not load student record');
      setStudentDetail({ courses: [], gwa: null, totalUnits: 0 });
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (drillDown.level !== 'detail' || !drillDown.selectedUserId) {
      setStudentDetail(null);
      return;
    }
    const u = userList.find((x) => x.uid === drillDown.selectedUserId);
    if (u?.role === 'student') {
      void loadStudentDetail(drillDown.selectedUserId);
    } else {
      setStudentDetail(null);
    }
  }, [drillDown.level, drillDown.selectedUserId, userList]);

  const handleApprovePendingGrade = async (gradeId: string) => {
    try {
      await updateDoc(doc(db, 'grades', gradeId), { status: 'posted' });
      toast.success('Grade approved and posted');
      await fetchPendingGrades();
    } catch {
      toast.error('Failed to approve grade');
    }
  };

  const handleRejectPendingGrade = async (gradeId: string) => {
    if (!confirm('Reject this grade submission? The faculty member can submit again.')) return;
    try {
      await deleteDoc(doc(db, 'grades', gradeId));
      toast.success('Grade submission rejected');
      await fetchPendingGrades();
    } catch {
      toast.error('Failed to reject grade');
    }
  };

  const fetchPendingApprovals = async () => {
    setLoading(true);
    try {
      const q1 = query(collection(db, 'enrollments'), where('status', '==', 'pending'));
      const q2 = query(collection(db, 'enrollments'), where('status', '==', 'pending_drop'));
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const combined = [...snap1.docs, ...snap2.docs];

      const data = await Promise.all(combined.map(async d => {
        const enrollment = { id: d.id, ...d.data() } as any;
        const userData = await fetchUserRecord(enrollment.userId);
        const subjectSnap = await getDoc(doc(db, 'subjects', enrollment.subjectId));
        return {
          ...enrollment,
          studentName: formatUserDisplayName(userData),
          campusId: userData?.studentId ? String(userData.studentId) : enrollment.userId,
          subjectTitle: subjectSnap.exists() ? subjectSnap.data().title : 'Unknown',
          subjectCode: subjectSnap.exists() ? subjectSnap.data().code : '---',
        };
      }));
      setPendingEnrollments(data);
    } catch (error) {
      toast.error('Failed to fetch approvals');
    } finally {
      setLoading(false);
    }
  };

  const notifyEnrollmentDecision = async (
    enrollmentId: string,
    outcome: 'approved' | 'rejected',
    currentStatus: string
  ) => {
    const req = pendingEnrollments.find((r) => r.id === enrollmentId);
    if (!req?.userId) return;
    const copy = enrollmentNotificationCopy(
      outcome,
      req.subjectCode ?? '---',
      req.subjectTitle ?? 'Course',
      currentStatus === 'pending_drop'
    );
    try {
      await dismissEnrollmentDecisionNotifications(req.userId, req.subjectCode ?? '');
      await createCampusNotification(req.userId, { ...copy, link: '/study-load' });
    } catch (e) {
      console.error('Campus notification failed', e);
    }
  };

  const handleApprove = async (id: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'pending_drop' ? 'dropped' : 'approved';
      const req = pendingEnrollments.find((r) => r.id === id);
      await updateDoc(doc(db, 'enrollments', id), {
        status: nextStatus,
        ...(nextStatus === 'approved' && config
          ? {
              academicYear: config.currentAcademicYear,
              semester: config.currentSemester,
            }
          : {}),
      });
      await notifyEnrollmentDecision(id, 'approved', currentStatus);
      if (profile?.uid && req) {
        await appendAdminLog({
          actorUid: profile.uid,
          actorName: formatUserDisplayName(profile),
          action: 'enrollment_approved',
          targetId: req.campusId ?? id,
          details: `${req.studentName} · ${req.subjectCode} ${req.subjectTitle}`,
        });
        void refreshAdminLogs();
      }
      toast.success(currentStatus === 'pending_drop' ? 'Drop Approved' : 'Enrollment Approved');
      if (selectedApprovalId === id) setSelectedApprovalId(null);
      fetchPendingApprovals();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Approval failed';
      toast.error(msg);
      console.error('Enrollment approve failed', e);
    }
  };

  const handleReject = async (id: string, currentStatus: string) => {
    try {
      // If it was a pending drop, rejecting it means keeping it as approved
      const nextStatus = currentStatus === 'pending_drop' ? 'approved' : 'rejected';
      const req = pendingEnrollments.find((r) => r.id === id);
      await updateDoc(doc(db, 'enrollments', id), { status: nextStatus });
      await notifyEnrollmentDecision(id, 'rejected', currentStatus);
      if (profile?.uid && req) {
        await appendAdminLog({
          actorUid: profile.uid,
          actorName: formatUserDisplayName(profile),
          action: 'enrollment_rejected',
          targetId: req.campusId ?? id,
          details: `${req.studentName} · ${req.subjectCode} ${req.subjectTitle}`,
        });
        void refreshAdminLogs();
      }
      toast.success('Request Rejected');
      if (selectedApprovalId === id) setSelectedApprovalId(null);
      fetchPendingApprovals();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Operation failed';
      toast.error(msg);
      console.error('Enrollment reject failed', e);
    }
  };

  const renderApprovalActions = (req: {
    id: string;
    status: string;
  }) => (
    <div className="flex justify-end gap-3">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void handleReject(req.id, req.status);
        }}
        className="w-10 h-10 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
        title="Reject"
      >
        <XCircle size={18} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void handleApprove(req.id, req.status);
        }}
        className="w-10 h-10 flex items-center justify-center text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all border border-transparent hover:border-emerald-100"
        title="Approve"
      >
        <CheckCircle2 size={18} />
      </button>
    </div>
  );

  const filteredPendingApprovals = useMemo(
    () =>
      pendingEnrollments.filter((req) =>
        matchesSearch(
          searchQuery,
          req.studentName,
          req.campusId,
          req.subjectTitle,
          req.subjectCode
        )
      ),
    [pendingEnrollments, searchQuery]
  );

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.role !== 'student' && newUser.role !== 'professor') {
      toast.error('Use System setup to create registrar accounts.');
      return;
    }
    setLoading(true);
    try {
      const college = collegeNameById(newUser.college) ?? newUser.college;
      await ensureSeedUser(newUser.studentId, newUser.surname, omitUndefined({
        firstName: newUser.firstName,
        role: newUser.role,
        college,
        program: newUser.role === 'student' ? newUser.program : undefined,
        section: newUser.role === 'student' ? newUser.section : undefined,
        yearLevel: newUser.role === 'student' ? newUser.yearLevel : undefined,
        maxUnits: 30,
        createdAt: serverTimestamp(),
      }));

      const detail =
        newUser.role === 'student'
          ? `${newUser.firstName} ${newUser.surname} · ${newUser.program} · ${newUser.section}`
          : `${newUser.firstName} ${newUser.surname} · ${college}`;

      if (profile?.uid) {
        await appendAdminLog({
          actorUid: profile.uid,
          actorName: formatUserDisplayName(profile),
          action: 'user_provisioned',
          targetId: newUser.studentId,
          details: detail,
        });
      }

      toast.success(
        `${newUser.role === 'student' ? 'Student' : 'Faculty'} ${newUser.firstName} ${newUser.surname} (${newUser.studentId}) saved to the directory.`,
        { duration: 5000 }
      );
      void refreshAdminLogs();
      setNewUser({
        studentId: '',
        surname: '',
        firstName: '',
        role: 'student',
        college: 'CCI',
        program: 'BS Computer Science',
        section: 'BSCS 1-A',
        yearLevel: 1,
      });
      await fetchUsers();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Provisioning failed';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const seedFoundationData = async () => {
    const ok = window.confirm(
      'Reset and reseed foundation demo data?\n\n' +
        'This deletes all enrollments, grades, subjects, notifications, admin logs, and demo user profiles in Firestore (portal term and your registrar login stay).\n\n' +
        'Firebase Auth passwords are not reset. For a full Auth wipe, use: npm run clear:db -- --confirm --auth\n\n' +
        'Continue?'
    );
    if (!ok) return;

    setLoading(true);
    try {
      const { loginHint, cleared } = await runFoundationSeedWithClear();
      const clearedMsg = cleared
        ? `Removed ${cleared.total} document(s) before reseed` +
          (cleared.deletedByCollection.subjects != null
            ? ` (${cleared.deletedByCollection.subjects} subjects).`
            : '.')
        : '';
      toast.success(
        `Foundation reset complete. ${clearedMsg} You remain signed in as registrar.`,
        { duration: 8000 }
      );
      toast(`Demo logins (ID / password):\n${loginHint}`, { duration: 14000 });
      if (profile?.uid) {
        await appendAdminLog({
          actorUid: profile.uid,
          actorName: formatUserDisplayName(profile),
          action: 'foundation_reset',
          details: cleared
            ? `Cleared ${cleared.total} docs, then reseeded demo catalog`
            : 'Reseeded demo catalog',
        });
        void refreshAdminLogs();
      }
      await Promise.all([
        fetchUsers(),
        fetchSubjects(),
        fetchPendingApprovals(),
        fetchPendingGrades(),
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Seeding failed';
      toast.error(msg, { duration: 10000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-12 max-w-7xl mx-auto pb-20 md:pb-28">
      <PageHeader
        title="Administrative Operations"
        subtitle="Registrar console"
        badge="Operational"
        showBack={false}
      >
        <div className="flex p-1.5 bg-surface rounded-2xl border border-border shadow-sm gap-1">
          {(['approvals', 'grades', 'users', 'system'] as const).map((tab) => {
            const pendingCount =
              tab === 'approvals'
                ? pendingEnrollments.length
                : tab === 'grades'
                  ? pendingGrades.length
                  : 0;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabChange(tab)}
                className={cn(
                  'px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all inline-flex items-center gap-2',
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground shadow-xl shadow-primary/20'
                    : 'text-muted hover:text-primary hover:bg-background'
                )}
              >
                {tab}
                {pendingCount > 0 && (
                  <span
                    className={cn(
                      'min-w-[1.125rem] h-5 px-1 rounded-full text-[9px] font-bold flex items-center justify-center',
                      activeTab === tab ? 'bg-brand-gold text-brand-blue' : 'bg-rose-500 text-white'
                    )}
                  >
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </PageHeader>

      <AnimatePresence mode="wait">
        {activeTab === 'grades' && (
          <motion.div 
            key="grades" 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-8"
          >
            {/* Nav Header */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between">
               <div className="flex items-center gap-4">
                  {drillDown.level !== 'colleges' && (
                    <button 
                      onClick={goBack}
                      className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-brand-blue transition-colors"
                    >
                       <ArrowLeft size={18} />
                    </button>
                  )}
                  <div>
                     <h3 className="text-xl font-display font-bold text-brand-blue tracking-tight">
                        {drillDown.level === 'colleges' ? 'Scholastic Validation Queue' : 
                         drillDown.level === 'subjects' ? COLLEGES.find(c => c.id === drillDown.collegeId)?.name :
                         'Student Grade Management'}
                     </h3>
                     <p className="text-xs text-slate-400 font-medium">
                        {drillDown.level === 'colleges' ? 'Select college to view academic resources' :
                         drillDown.level === 'programs' ? 'Select degree track' :
                         drillDown.level === 'sections' ? 'Select section' :
                         drillDown.level === 'students' ? 'Select student profile' :
                         'Course scholastic records (read-only)'}
                     </p>
                  </div>
               </div>
               <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Validation</p>
                    <p className="text-sm font-bold text-brand-blue">Approve faculty submissions</p>
                  </div>
            </div>

            {pendingGrades.length > 0 && (
              <motion.div className="bg-amber-50 rounded-3xl border border-amber-200/80 shadow-sm overflow-hidden">
                <motion.div className="px-10 py-6 border-b border-amber-200/60">
                  <h4 className="text-sm font-display font-bold text-brand-blue">Faculty grade submissions</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {pendingGrades.length} pending — approve to post on student records.
                  </p>
                </motion.div>
                <motion.div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-white/60 text-[10px] uppercase font-bold tracking-[0.15em] text-slate-400">
                      <tr>
                        <th className="px-10 py-4">Student</th>
                        <th className="px-10 py-4">Course</th>
                        <th className="px-10 py-4">Grade</th>
                        <th className="px-10 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {pendingGrades.map((g) => (
                        <tr key={g.id} className="bg-white/40">
                          <td className="px-10 py-5 font-bold text-brand-ink">{g.studentName}</td>
                          <td className="px-10 py-5 text-sm text-slate-600">{g.subjectTitle}</td>
                          <td className="px-10 py-5 font-mono font-bold text-lg">
                            {typeof g.grade === 'number' ? g.grade.toFixed(2) : EMPTY}
                          </td>
                          <td className="px-10 py-5 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => void handleApprovePendingGrade(g.id)}
                              className="inline-flex items-center gap-2 bg-brand-blue text-white px-5 py-2.5 rounded-xl font-bold uppercase text-[9px] tracking-widest"
                            >
                              <CheckCircle2 size={14} />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRejectPendingGrade(g.id)}
                              className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-2.5 rounded-xl font-bold uppercase text-[9px] tracking-widest"
                            >
                              <XCircle size={14} />
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              </motion.div>
            )}

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-10">
                  {drillDown.level === 'colleges' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {COLLEGES.map(c => (
                        <button 
                          key={c.id}
                          onClick={() => setDrillDown({ level: 'programs', collegeId: c.id, subRole: 'student' })}
                          className="p-8 rounded-[2rem] bg-white border border-slate-100 hover:border-brand-gold hover:shadow-xl hover:shadow-brand-gold/10 transition-all text-left flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-6">
                            <span className="text-4xl group-hover:scale-110 transition-transform">{c.icon}</span>
                            <div>
                              <p className="font-display font-bold text-brand-blue">{c.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                  Programs → sections → students
                                </p>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {drillDown.level === 'programs' && (
                    <div className="grid grid-cols-1 gap-4 max-w-xl mx-auto">
                      {(COLLEGES.find((c) => c.id === drillDown.collegeId)?.programs ?? []).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDrillDown((prev) => ({ ...prev, level: 'sections', program: p }))}
                          className="p-6 rounded-2xl border border-slate-100 hover:border-brand-gold text-left flex items-center justify-between"
                        >
                          <span className="font-bold text-brand-blue text-sm">{p}</span>
                          <ArrowRight size={16} className="text-slate-200" />
                        </button>
                      ))}
                    </div>
                  )}

                  {drillDown.level === 'sections' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {sectionsForProgram(userList, subjects, drillDown.collegeId, drillDown.program).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setDrillDown((prev) => ({ ...prev, level: 'students', section: s }))}
                          className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-brand-gold font-bold text-brand-blue"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {drillDown.level === 'students' && (
                    <div className="divide-y divide-slate-50">
                      {studentsInDirectory(userList, drillDown.collegeId, drillDown.program, drillDown.section).map((u) => (
                        <button
                          key={u.uid}
                          type="button"
                          onClick={() => {
                            setDrillDown((prev) => ({ ...prev, level: 'detail', selectedUserId: u.uid }));
                            void loadStudentDetail(u.uid);
                          }}
                          className="w-full p-6 flex items-center justify-between hover:bg-slate-50 text-left"
                        >
                          <div>
                            <p className="font-bold text-brand-blue">{u.firstName} {u.surname}</p>
                            <p className="text-[10px] font-mono text-slate-400">{u.studentId}</p>
                          </div>
                          <ArrowRight size={16} className="text-slate-200" />
                        </button>
                      ))}
                    </div>
                  )}

                  {drillDown.level === 'detail' && studentDetail && (
                    <div className="space-y-4">
                      <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Historical course metrics</p>
                      <table className="w-full text-left text-sm">
                        <thead className="text-[10px] uppercase text-slate-400">
                          <tr>
                            <th className="py-3">Code</th>
                            <th className="py-3">Title</th>
                            <th className="py-3">Units</th>
                            <th className="py-3">Grade</th>
                            <th className="py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {studentDetail.courses.map((c, i) => (
                            <tr key={i}>
                              <td className="py-4 font-mono text-xs">{c.code}</td>
                              <td className="py-4">{c.title}</td>
                              <td className="py-4">{c.units}</td>
                              <td className="py-4 font-mono font-bold">{c.grade}</td>
                              <td className="py-4 text-[10px] uppercase">{c.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'system' && (
          <motion.div key="system" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 flex flex-col items-center">
            <div className="w-full max-w-2xl bg-brand-blue p-16 rounded-[4rem] text-white relative overflow-hidden shadow-2xl">
               <div className="absolute inset-0 opacity-10 pointer-events-none">
                  <Database size={500} className="absolute -bottom-20 -left-20" />
               </div>
               
               <div className="relative z-10 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-brand-gold flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-brand-gold/40 hover:rotate-6 transition-transform cursor-pointer">
                    <RefreshCw size={32} className="text-brand-blue" />
                  </div>
                  <h3 className="text-3xl font-display font-bold mb-6">Semester Transition Matrix</h3>
                  <p className="text-white/40 text-sm leading-relaxed mb-6 max-w-md mx-auto">
                    Seeds demo users with Firebase Auth, subjects (full college names), approved enrollments, and posted/pending grades for testing.
                  </p>
                  <p className="text-white/30 text-[10px] leading-relaxed mb-8 max-w-md mx-auto">
                    Clears demo Firestore data, then reseeds subjects, enrollments, grades, and users for the
                    current portal term. Keeps system/config and your session. Does not delete Auth accounts.
                  </p>

                  {config && (
                    <motion.div className="text-left mb-8 p-6 bg-white/10 rounded-2xl border border-white/10 space-y-4">
                      <p className="text-white/90 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
                        <Calendar size={14} className="text-brand-gold" />
                        ISAT-U academic calendar
                      </p>
                      <p className="text-white/50 text-[11px] leading-relaxed">
                        1st sem Aug–Dec · 2nd sem Jan–May · Summer Jun–Jul. Calendar today:{' '}
                        <strong className="text-white/80">
                          AY {resolveCurrentTermFromCalendar().academicYear} ·{' '}
                          {formatSemesterLabel(resolveCurrentTermFromCalendar().semester)}
                        </strong>
                      </p>
                      <button
                        type="button"
                        disabled={systemSaving}
                        onClick={async () => {
                          setSystemSaving(true);
                          try {
                            const next = await alignWithIsatuCalendar();
                            await refresh();
                            if (next) {
                              toast.success(
                                `Aligned to ISAT-U calendar: AY ${next.currentAcademicYear} · ${formatSemesterLabel(next.currentSemester)}`
                              );
                            } else {
                              toast.error('Could not align calendar');
                            }
                          } catch {
                            toast.error('Calendar alignment failed');
                          } finally {
                            setSystemSaving(false);
                          }
                        }}
                        className="w-full py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] bg-brand-gold text-brand-blue hover:bg-brand-gold/90 transition-all disabled:opacity-50"
                      >
                        {systemSaving ? 'Aligning…' : 'Align system to today'}
                      </button>
                      <p className="text-white/90 text-[11px] font-bold uppercase tracking-widest pt-2">
                        Automatic semester rollover
                      </p>
                      <p className="text-white/50 text-[11px] leading-relaxed">
                        When paused, student/faculty logins will not advance the term after the term
                        end date. Manual advance below moves one term at a time.
                      </p>
                      <p className="text-[11px]">
                        Status:{' '}
                        <span
                          className={
                            config.semesterAutomationEnabled !== false
                              ? 'text-emerald-300 font-bold'
                              : 'text-amber-300 font-bold'
                          }
                        >
                          {config.semesterAutomationEnabled !== false ? 'Running' : 'Paused by registrar'}
                        </span>
                      </p>
                      <button
                        type="button"
                        disabled={automationBusy}
                        onClick={async () => {
                          setAutomationBusy(true);
                          try {
                            const enabledNow = config.semesterAutomationEnabled !== false;
                            await updateDoc(doc(db, 'system', 'config'), {
                              semesterAutomationEnabled: !enabledNow,
                            });
                            await refresh();
                            toast.success(
                              enabledNow
                                ? 'Automatic rollover halted'
                                : 'Automatic rollover resumed'
                            );
                          } catch {
                            toast.error('Could not update automation flag');
                          } finally {
                            setAutomationBusy(false);
                          }
                        }}
                        className="w-full py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] border border-brand-gold/40 text-brand-gold hover:bg-brand-gold/10 transition-all disabled:opacity-50"
                      >
                        {automationBusy
                          ? 'Saving…'
                          : config.semesterAutomationEnabled !== false
                            ? 'Halt automatic rollover'
                            : 'Resume automatic rollover'}
                      </button>
                    </motion.div>
                  )}
                  
                  <div className="space-y-6">
                    <button 
                      onClick={seedFoundationData}
                      disabled={loading}
                      className="w-full bg-brand-gold text-brand-blue py-5 rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl shadow-brand-gold/20 hover:-translate-y-1 transition-all active:translate-y-0 disabled:opacity-50"
                    >
                      <Database size={18} />
                      {loading ? 'Resetting…' : 'Reset & seed foundation data'}
                    </button>
                    <button
                      type="button"
                      disabled={systemSaving}
                      onClick={async () => {
                        setSystemSaving(true);
                        try {
                          const ok = await runSemesterTransition(true);
                          await refresh();
                          toast.success(
                            ok
                              ? 'Advanced one term (ISAT-U calendar dates)'
                              : 'No transition needed'
                          );
                        } catch {
                          toast.error('Transition failed');
                        } finally {
                          setSystemSaving(false);
                        }
                      }}
                      className="w-full bg-white/10 text-white border border-white/10 py-5 rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-white/20 transition-all disabled:opacity-50"
                    >
                      <ArrowRight size={18} />
                      {systemSaving ? 'Running...' : 'Commit Automated Pipeline'}
                    </button>
                    {config && (
                      <div className="text-left space-y-3 mt-8 p-6 bg-white/5 rounded-2xl text-sm">
                        <p className="text-white/60">
                          AY {config.currentAcademicYear} ·{' '}
                          {formatSemesterLabel(config.currentSemester)}
                        </p>
                        {config.semesterStartDate && config.semesterEndDate && (
                          <p className="text-white/40 text-xs">
                            Classes: {formatFirestoreDate(config.semesterStartDate)} –{' '}
                            {formatFirestoreDate(config.semesterEndDate)}
                          </p>
                        )}
                        {config.enrollmentStartDate && config.enrollmentEndDate && (
                          <p className="text-white/40 text-xs">
                            Enrollment window: {formatFirestoreDate(config.enrollmentStartDate)} –{' '}
                            {formatFirestoreDate(config.enrollmentEndDate)}
                          </p>
                        )}
                        <p className="text-white/60">
                          Enrollment: {enrollmentWindowOpen ? 'Open' : 'Closed'}
                          {config.enrollmentOpen === false ? ' (registrar closed)' : ''}
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            const nextForced = !config.enrollmentPeriodForced;
                            await updateDoc(doc(db, 'system', 'config'), {
                              enrollmentOpen: true,
                              enrollmentPeriodForced: nextForced,
                              ...(nextForced
                                ? {
                                    allowPostEnrollmentAdds: true,
                                    allowPostEnrollmentDrops: true,
                                  }
                                : {
                                    allowPostEnrollmentAdds: false,
                                    allowPostEnrollmentDrops: false,
                                  }),
                            });
                            await refresh();
                            toast.success(
                              nextForced
                                ? 'Enrollment period forced open (bypasses calendar dates)'
                                : 'Calendar date rules restored'
                            );
                          }}
                          className="text-brand-gold text-[10px] font-bold uppercase tracking-widest"
                        >
                          {config.enrollmentPeriodForced
                            ? 'Stop forcing enrollment'
                            : 'Force enrollment open'}
                        </button>
                        <EnrollmentSimulationPanel
                          simulationDateInput={simulationDateInput}
                          onSimulationDateInputChange={setSimulationDateInput}
                          systemSaving={systemSaving}
                          onSystemSavingChange={setSystemSaving}
                        />
                        <div className="border-t border-white/10 pt-4 mt-4 space-y-3">
                          <p className="text-white/80 text-[11px] font-bold uppercase tracking-widest">
                            Cloud automation
                          </p>
                          <p className="text-white/50 text-[11px] leading-relaxed">
                            <strong className="text-white/70">No Blaze / no registrar-only gate:</strong> students and
                            faculty do <strong className="text-white/80">not</strong> get a button or setting for this.
                            Simply <strong className="text-white/80">using the portal</strong> (while logged in) runs a
                            silent background check. If the term-end date has passed and rules allow it, the system
                            advances the semester once, they are only a <em>catalyst</em>, not an operator.
                          </p>
                          <p className="text-white/50 text-[11px] leading-relaxed">
                            When enabled, a daily Firebase job can also run the check (server clock). That path usually
                            needs the Blaze plan and{' '}
                            <code className="text-white/60">firebase deploy --only functions</code>. Turn off here to
                            halt cloud + shared auto, manual &quot;Commit Automated Pipeline&quot; below always works.
                          </p>
                          <p className="text-[11px]">
                            <span className="text-white/60">Status:</span>{' '}
                            <span
                              className={
                                config.semesterAutomationEnabled !== false
                                  ? 'text-emerald-300 font-bold'
                                  : 'text-amber-300 font-bold'
                              }
                            >
                              {config.semesterAutomationEnabled !== false ? 'Enabled' : 'Paused'}
                            </span>
                          </p>
                          <button
                            type="button"
                            disabled={automationBusy}
                            onClick={async () => {
                              setAutomationBusy(true);
                              try {
                                const enabledNow = config.semesterAutomationEnabled !== false;
                                await updateDoc(doc(db, 'system', 'config'), {
                                  semesterAutomationEnabled: !enabledNow,
                                });
                                await refresh();
                                toast.success(
                                  enabledNow
                                    ? 'Automatic rollover paused (site visitors + cloud job)'
                                    : 'Automatic rollover re-enabled'
                                );
                              } catch {
                                toast.error('Could not update automation flag');
                              } finally {
                                setAutomationBusy(false);
                              }
                            }}
                            className="text-brand-gold text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                          >
                            {automationBusy
                              ? 'Saving…'
                              : config.semesterAutomationEnabled !== false
                                ? 'Pause automatic rollover'
                                : 'Resume automatic rollover'}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-center gap-2 text-rose-400">
                       <ShieldAlert size={14} />
                       <span className="text-[10px] font-bold uppercase tracking-widest">Auth Level III Required</span>
                    </div>
                  </div>
               </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'approvals' && (() => {
          const selectedReq = selectedApprovalId
            ? pendingEnrollments.find((e) => e.id === selectedApprovalId)
            : null;
          const selectedStudent = selectedReq
            ? userList.find((u) => u.uid === selectedReq.userId)
            : null;
          const pendingForStudent = selectedReq
            ? pendingEnrollments.filter((e) => e.userId === selectedReq.userId)
            : [];
          const unitsLoad = pendingForStudent.reduce((acc, e) => {
            const sub = subjects.find((s) => s.id === e.subjectId);
            return acc + (sub?.units ?? 0);
          }, 0);
          return (
          <motion.div 
            key="approvals" 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-8"
          >
            {/* Nav Header */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex items-center justify-between">
               <div className="flex items-center gap-4">
                  {drillDown.level !== 'colleges' && (
                    <button 
                      onClick={goBack}
                      className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-brand-blue transition-colors"
                    >
                       <ArrowLeft size={18} />
                    </button>
                  )}
                  <div>
                     <h3 className="text-xl font-display font-bold text-brand-blue tracking-tight">
                        {drillDown.level === 'colleges' ? 'Active Enrollment Requests' : 
                         drillDown.level === 'subjects' ? COLLEGES.find(c => c.id === drillDown.collegeId)?.name :
                         'Section Enrollment Queue'}
                     </h3>
                     <p className="text-xs text-slate-400 font-medium">
                        {drillDown.level === 'colleges' ? 'Real-time queue for student study load adjustments' :
                         drillDown.level === 'subjects' ? 'Select subject to review entry/exit requests' :
                         'Individual student study load decision matrix'}
                     </p>
                  </div>
               </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-10 py-6 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-display font-bold text-brand-blue">Approval queue</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Approve or reject pending enrollments and drop requests.
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {filteredPendingApprovals.length} pending
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400">
                    <tr>
                      <th className="px-10 py-4">Student</th>
                      <th className="px-10 py-4">Course</th>
                      <th className="px-10 py-4">Type</th>
                      <th className="px-10 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredPendingApprovals.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-10 py-16 text-center text-slate-400 text-sm">
                          No pending enrollment or drop requests.
                        </td>
                      </tr>
                    ) : (
                      filteredPendingApprovals.map((req) => (
                        <tr
                          key={req.id}
                          className={cn(
                            'hover:bg-slate-50/50 cursor-pointer',
                            selectedApprovalId === req.id && 'bg-brand-gold/5'
                          )}
                          onClick={() => setSelectedApprovalId(req.id)}
                        >
                          <td className="px-10 py-5">
                            <p className="font-bold text-brand-ink text-sm">{req.studentName}</p>
                            <p className="text-[10px] font-mono text-slate-400">{req.campusId}</p>
                          </td>
                          <td className="px-10 py-5 text-sm">
                            <span className="font-mono text-brand-gold text-xs">{req.subjectCode}</span>
                            {' '}{req.subjectTitle}
                          </td>
                          <td className="px-10 py-5">
                            <span
                              className={cn(
                                'inline-flex px-3 py-1 rounded-full text-[9px] font-bold uppercase border',
                                req.status === 'pending_drop'
                                  ? 'bg-rose-50 text-rose-500 border-rose-100'
                                  : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              )}
                            >
                              {enrollmentRequestLabel(req)}
                            </span>
                          </td>
                          <td className="px-10 py-5 text-right">{renderApprovalActions(req)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedReq && selectedStudent && (
              <div className="bg-white rounded-[2.5rem] border border-brand-gold/30 shadow-sm p-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div>
                  <h4 className="text-lg font-display font-bold text-brand-blue mb-4">Student diagnostic</h4>
                  <p className="text-sm font-bold text-brand-ink mb-1">{selectedStudent.firstName} {selectedStudent.surname}</p>
                  <p className="text-[10px] font-mono text-slate-400 mb-4">{selectedStudent.studentId}</p>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Academic classification</p>
                  <p className="text-sm font-bold text-brand-blue mb-4">
                    {(selectedStudent as UserProfile & { irregular?: boolean }).irregular
                      ? 'Irregular'
                      : 'Regular'}
                  </p>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Accumulated units load (pending)</p>
                  <p className="text-2xl font-mono font-bold text-brand-blue">{unitsLoad} units</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-3">Target subjects requested</p>
                  <ul className="space-y-2 mb-6 text-sm">
                    {pendingForStudent.map((e) => (
                      <li key={e.id} className="flex justify-between border-b border-slate-100 pb-2">
                        <span>{e.subjectCode} — {e.subjectTitle}</span>
                        <span className="text-[10px] uppercase text-slate-400">{enrollmentRequestLabel(e)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Prerequisites accomplished</p>
                  <p className="text-xs text-slate-500 mb-2">Review posted grades before validating.</p>
                  <span className="inline-flex px-3 py-1 rounded-full text-[9px] font-bold uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">
                    Checklist — verify in grade history
                  </span>
                  <div className="mt-8 flex flex-wrap gap-3">
                    {pendingForStudent.map((e) => (
                      <div key={e.id} className="flex items-center gap-2">
                        <span className="text-xs font-mono">{e.subjectCode}</span>
                        {renderApprovalActions(e)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
               <div className="p-10">
                  {drillDown.level === 'colleges' && (
                    <div className="space-y-6">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 text-center">
                        Drill down by program track or by course
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {COLLEGES.map((c) => (
                          <div
                            key={c.id}
                            className="p-6 rounded-[2rem] bg-white border border-slate-100 space-y-3"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setDrillDown({ level: 'programs', collegeId: c.id, subRole: 'student' })
                              }
                              className="w-full p-4 rounded-xl border border-slate-100 hover:border-brand-gold text-left flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-4">
                                <span className="text-3xl">{c.icon}</span>
                                <div>
                                  <p className="font-display font-bold text-brand-blue">{c.name}</p>
                                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                    {pendingCountForCollege(pendingEnrollments, subjects, c.id)} requests
                                  </p>
                                </div>
                              </div>
                              <ArrowRight size={16} className="text-slate-200 group-hover:text-brand-gold" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDrillDown({ level: 'subjects', collegeId: c.id })}
                              className="w-full py-3 rounded-xl bg-brand-blue/5 text-brand-blue text-[10px] font-bold uppercase tracking-widest hover:bg-brand-blue/10"
                            >
                              By course →
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {drillDown.level === 'programs' && activeTab === 'approvals' && (
                    <div className="grid grid-cols-1 gap-4 max-w-xl mx-auto">
                      {(COLLEGES.find((c) => c.id === drillDown.collegeId)?.programs ?? []).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDrillDown((prev) => ({ ...prev, level: 'sections', program: p }))}
                          className="p-6 rounded-2xl border border-slate-100 hover:border-brand-gold text-left flex items-center justify-between"
                        >
                          <span className="font-bold text-brand-blue text-sm">{p}</span>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                    </div>
                  )}

                  {drillDown.level === 'sections' && activeTab === 'approvals' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {sectionsForProgram(userList, subjects, drillDown.collegeId, drillDown.program).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setDrillDown((prev) => ({ ...prev, level: 'students', section: s }))}
                          className="p-8 rounded-3xl bg-slate-50 border hover:border-brand-gold font-bold text-brand-blue"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  {drillDown.level === 'students' && activeTab === 'approvals' && (
                    <div className="space-y-6">
                      {(() => {
                        const sectionStudents = studentsInDirectory(
                          userList,
                          drillDown.collegeId,
                          drillDown.program,
                          drillDown.section
                        );
                        const pendingUserIds = new Set(
                          pendingEnrollments.map((e) => e.userId)
                        );
                        const fromDirectory = sectionStudents.filter((u) =>
                          pendingUserIds.has(u.uid)
                        );
                        const orphanPending = pendingEnrollments.filter(
                          (e) =>
                            !sectionStudents.some((u) => u.uid === e.userId) &&
                            (() => {
                              const sub = subjects.find((s) => s.id === e.subjectId);
                              const collegeName = drillDown.collegeId
                                ? collegeNameById(drillDown.collegeId)
                                : undefined;
                              return (
                                sub &&
                                collegeName &&
                                normalizeCollegeName(sub.college) === collegeName &&
                                sectionMatchesProgram(sub.section, drillDown.program ?? '')
                              );
                            })()
                        );
                        if (fromDirectory.length === 0 && orphanPending.length === 0) {
                          return (
                            <p className="text-center text-slate-400 text-sm py-12">
                              No pending requests for this section. Use the approval queue above.
                            </p>
                          );
                        }
                        return (
                          <>
                            {fromDirectory.map((u) => {
                              const reqs = pendingEnrollments.filter((e) => e.userId === u.uid);
                              return (
                                <div
                                  key={u.uid}
                                  className="p-6 rounded-2xl border border-slate-100 bg-slate-50/50"
                                >
                                  <p className="font-bold text-brand-blue mb-4">
                                    {u.firstName} {u.surname}{' '}
                                    <span className="font-mono text-xs text-slate-400">
                                      {u.studentId}
                                    </span>
                                  </p>
                                  <div className="space-y-3">
                                    {reqs.map((req) => (
                                      <div
                                        key={req.id}
                                        className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100"
                                      >
                                        <div>
                                          <p className="text-sm font-mono text-brand-gold">
                                            {req.subjectCode}
                                          </p>
                                          <p className="text-xs text-slate-600">{req.subjectTitle}</p>
                                        </div>
                                        {renderApprovalActions(req)}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                            {orphanPending.map((req) => (
                              <div
                                key={req.id}
                                className="p-6 rounded-2xl border border-amber-100 bg-amber-50/50"
                              >
                                <p className="font-bold text-brand-blue mb-2">
                                  {req.studentName}{' '}
                                  <span className="font-mono text-xs">{req.campusId}</span>
                                </p>
                                <p className="text-[10px] text-amber-700 mb-3">
                                  Pending for this college/program (section mismatch on profile)
                                </p>
                                <div className="flex items-center justify-between bg-white p-4 rounded-xl">
                                  <span className="text-sm">
                                    {req.subjectCode} — {req.subjectTitle}
                                  </span>
                                  {renderApprovalActions(req)}
                                </div>
                              </div>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {drillDown.level === 'subjects' && activeTab === 'approvals' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {subjectsForCollegeFiltered(drillDown.collegeId).length === 0 && (
                        <p className="col-span-full text-center text-slate-400 text-sm py-12">
                          {searchQuery.trim()
                            ? 'No courses match your search.'
                            : 'No courses for this college yet. Run Foundation Seed on the System tab.'}
                        </p>
                      )}
                      {subjectsForCollegeFiltered(drillDown.collegeId).map(subj => {
                        const count = pendingEnrollments.filter(e => e.subjectId === subj.id).length;
                        return (
                          <button 
                            key={subj.id}
                            onClick={() => setDrillDown(prev => ({ ...prev, level: 'subjectStudents', subjectId: subj.id }))}
                            className={cn(
                              "p-6 rounded-2xl border transition-all text-left flex items-center justify-between group",
                              count > 0 ? "bg-brand-blue/5 border-brand-blue/20 hover:border-brand-blue" : "bg-white border-slate-100 hover:border-brand-gold"
                            )}
                          >
                            <div>
                               <div className="flex items-center gap-2 mb-1">
                                  <span className="px-2 py-0.5 bg-brand-blue text-white text-[8px] font-bold rounded uppercase tracking-widest">{subj.code}</span>
                                  {count > 0 && <span className="text-[8px] font-bold text-blue-500 uppercase tracking-widest">{count} Pending</span>}
                               </div>
                               <p className="font-bold text-brand-blue">{subj.title}</p>
                               <p className="text-[10px] font-medium text-slate-400">Sec: {subj.section}</p>
                            </div>
                            <ArrowRight size={20} className="text-slate-200 group-hover:text-brand-gold" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {drillDown.level === 'subjectStudents' && (
                    <div className="overflow-x-auto -m-10">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50/50 text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400">
                          <tr>
                            <th className="px-10 py-6">Entity Identity</th>
                            <th className="px-10 py-6">Classification</th>
                            <th className="px-10 py-6">Timestamp</th>
                            <th className="px-10 py-6 text-right">Commit Decisions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {pendingEnrollments
                            .filter((e) => e.subjectId === drillDown.subjectId)
                            .filter((req) =>
                              matchesSearch(
                                searchQuery,
                                req.studentName,
                                req.campusId,
                                req.subjectTitle,
                                req.subjectCode
                              )
                            ).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="px-10 py-20 text-center text-slate-300 italic font-medium">
                                {searchQuery.trim()
                                  ? 'No pending requests match your search.'
                                  : 'No active requests for this section'}
                              </td>
                            </tr>
                          ) : (
                            pendingEnrollments
                              .filter((e) => e.subjectId === drillDown.subjectId)
                              .filter((req) =>
                                matchesSearch(
                                  searchQuery,
                                  req.studentName,
                                  req.campusId,
                                  req.subjectTitle,
                                  req.subjectCode
                                )
                              )
                              .map((req) => (
                              <tr
                                key={req.id}
                                className={cn(
                                  'group hover:bg-slate-50/50 transition-colors cursor-pointer',
                                  selectedApprovalId === req.id && 'bg-brand-gold/5'
                                )}
                                onClick={() => setSelectedApprovalId(req.id)}
                              >
                                <td className="px-10 py-6">
                                   <div className="flex items-center gap-4">
                                      <UserAvatar
                                        user={{
                                          ...parseDisplayName(req.studentName),
                                          studentId: req.campusId,
                                        }}
                                        size="sm"
                                        className="w-10 h-10 text-xs"
                                      />
                                      <div>
                                        <p className="font-display font-bold text-brand-ink text-sm">{req.studentName}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                          {req.campusId ?? req.userId}
                                        </p>
                                        <span className="inline-flex mt-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase bg-slate-100 text-slate-500">
                                          Prerequisites — review grades
                                        </span>
                                      </div>
                                   </div>
                                </td>
                                <td className="px-10 py-6">
                                   <span className={cn(
                                     "inline-flex items-center px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border",
                                     req.status === 'pending_drop' 
                                       ? "bg-rose-50 text-rose-500 border-rose-100" 
                                       : "bg-emerald-50 text-emerald-500 border-emerald-100"
                                   )}>
                                     {enrollmentRequestLabel(req)}
                                   </span>
                                </td>
                                <td className="px-10 py-6 text-slate-400 font-mono text-[10px]">
                                  {formatFirestoreDate(req.requestedAt)}
                                </td>
                                <td className="px-10 py-6 text-right">
                                  {renderApprovalActions(req)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
               </div>
            </div>
          </motion.div>
          );
        })()}

        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
            {/* Form */}
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm lg:col-span-2 relative overflow-hidden flex flex-col max-h-[min(720px,calc(100vh-10rem))]">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                 <UserPlus size={120} />
              </div>
              
              <h3 className="text-2xl font-display font-bold text-brand-blue mb-8 flex items-center gap-3 relative z-10">
                <UserPlus size={28} className="text-brand-gold" />
                Provision Identity
              </h3>
              
              <form onSubmit={handleAddUser} className="flex flex-col flex-1 min-h-0 relative z-10">
                <div className="flex-1 overflow-y-auto pr-1 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 ml-1 tracking-[0.2em]">Deployment Role</label>
                    <select 
                      value={newUser.role}
                      onChange={e => setNewUser({...newUser, role: e.target.value as 'student' | 'professor'})}
                      className="w-full bg-slate-50 border-slate-100 rounded-2xl px-5 py-4 font-bold text-brand-blue focus:ring-2 focus:ring-brand-gold transition-all cursor-pointer appearance-none outline-none"
                    >
                      <option value="student">Student Account</option>
                      <option value="professor">Faculty Member</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 ml-1 tracking-[0.2em]">Academic Unit (College)</label>
                    <select 
                      value={newUser.college || ''}
                      onChange={e => setNewUser({...newUser, college: e.target.value})}
                      className="w-full bg-slate-50 border-slate-100 rounded-2xl px-5 py-4 font-bold text-brand-blue focus:ring-2 focus:ring-brand-gold transition-all cursor-pointer appearance-none outline-none"
                    >
                      <option value="">Select College...</option>
                      {COLLEGES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 ml-1 tracking-[0.2em]">Assignment ID</label>
                    <div className="relative">
                      <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" />
                      <input 
                        type="text" 
                        required
                        value={newUser.studentId}
                        onChange={e => setNewUser({...newUser, studentId: e.target.value})}
                        placeholder="e.g. 2026-4364-A"
                        className="w-full bg-slate-50 border-slate-100 rounded-2xl pl-12 pr-5 py-4 font-mono text-sm font-bold text-brand-blue focus:ring-2 focus:ring-brand-gold outline-none"
                      />
                    </div>
                  </div>

                  {newUser.role === 'student' && (
                    <>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 ml-1 tracking-[0.2em]">Degree Program</label>
                        <select 
                          value={newUser.program || ''}
                          onChange={e => setNewUser({...newUser, program: e.target.value})}
                          className="w-full bg-slate-50 border-slate-100 rounded-2xl px-5 py-4 font-bold text-brand-blue focus:ring-2 focus:ring-brand-gold outline-none"
                        >
                          <option value="">Select Program...</option>
                          {COLLEGES.find(c => c.id === newUser.college)?.programs.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 ml-1 tracking-[0.2em]">Assigned Section</label>
                        <input 
                          type="text" 
                          value={newUser.section || ''}
                          onChange={e => setNewUser({...newUser, section: e.target.value})}
                          placeholder="e.g. 1-A"
                          className="w-full bg-slate-50 border-slate-100 rounded-2xl px-5 py-4 font-bold text-brand-blue focus:ring-2 focus:ring-brand-gold outline-none"
                        />
                      </div>
                    </>
                  )}

                  {newUser.role === 'professor' && (
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 ml-1 tracking-[0.2em]">Academic Department</label>
                      <input 
                        type="text" 
                        value={newUser.department || ''}
                        onChange={e => setNewUser({...newUser, department: e.target.value})}
                        placeholder="e.g. Software Engineering"
                        className="w-full bg-slate-50 border-slate-100 rounded-2xl px-5 py-4 font-bold text-brand-blue focus:ring-2 focus:ring-brand-gold outline-none"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 ml-1 tracking-[0.2em]">Given Name</label>
                    <input 
                      type="text" 
                      required
                      value={newUser.firstName}
                      onChange={e => setNewUser({...newUser, firstName: e.target.value})}
                      className="w-full bg-slate-50 border-slate-100 rounded-2xl px-5 py-4 font-bold text-brand-blue focus:ring-2 focus:ring-brand-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 ml-1 tracking-[0.2em]">Surname / Auth</label>
                    <input 
                      type="text" 
                      required
                      value={newUser.surname}
                      onChange={e => setNewUser({...newUser, surname: e.target.value})}
                      className="w-full bg-slate-50 border-slate-100 rounded-2xl px-5 py-4 font-bold text-brand-blue focus:ring-2 focus:ring-brand-gold outline-none"
                    />
                  </div>
                </div>
                </div>

                <div className="pt-4 shrink-0 border-t border-slate-100 mt-4">
                  <button 
                    disabled={loading}
                    className="w-full bg-brand-blue text-white py-5 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-brand-blue/90 shadow-2xl shadow-brand-blue/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:grayscale"
                  >
                    {loading ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
                    <span>Submit to Database</span>
                  </button>
                  <p className="text-[9px] text-center text-slate-400 font-bold uppercase mt-4 tracking-[0.2em]">
                    A toast and activity log entry are created on success
                  </p>
                </div>
              </form>
            </div>

            {/* List Placeholder with Aesthetic Card */}
            <div className="lg:col-span-3 space-y-8">
               <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
                  {/* Drill-down Header */}
                  <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        {drillDown.level !== 'colleges' && (
                          <button 
                            onClick={goBack}
                            className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-brand-blue transition-colors"
                          >
                             <ArrowLeft size={18} />
                          </button>
                        )}
                        <div>
                           <h4 className="font-display font-bold text-brand-blue text-sm uppercase tracking-widest">
                              {drillDown.level === 'colleges' ? 'Colleges' : 
                               drillDown.level === 'subRole' ? COLLEGES.find(c => c.id === drillDown.collegeId)?.name :
                               drillDown.level === 'programs' ? 'Select Program' :
                               drillDown.level === 'sections' ? drillDown.program :
                               drillDown.level === 'students' ? `${drillDown.program} - ${drillDown.section}` :
                               drillDown.level === 'faculty' ? 'Faculty Directory' :
                               'Profile Detail'}
                           </h4>
                           <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">
                              Administrative Authority Index
                           </p>
                        </div>
                     </div>
                     <SearchField
                        className="w-56"
                        value={searchQuery}
                        onChange={setSearchQuery}
                        onSubmit={setSearchQuery}
                        onSelectSuggestion={handleDirectorySuggestion}
                        suggestions={directorySearchIndex}
                        placeholder="Search directory…"
                        inputClassName="!py-2 !text-[10px]"
                        maxSuggestions={10}
                      />
                  </div>

                  <div className="flex-1 overflow-y-auto p-8">
                    {searchQuery.trim() ? (
                      <div className="space-y-3 max-w-2xl mx-auto">
                        <p className="text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-6 text-center">
                          {directoryGlobalHits.length} match
                          {directoryGlobalHits.length === 1 ? '' : 'es'} for &ldquo;
                          {searchQuery.trim()}&rdquo;
                        </p>
                        {directoryGlobalHits.length === 0 ? (
                          <p className="text-center text-slate-400 text-sm py-12">
                            No students or faculty match this search.
                          </p>
                        ) : (
                          directoryGlobalHits.map((u) => (
                            <button
                              key={u.uid}
                              type="button"
                              onClick={() =>
                                setDrillDown({
                                  level: 'detail',
                                  selectedUserId: u.uid,
                                  collegeId: drillDown.collegeId,
                                  subRole: u.role === 'professor' ? 'professor' : 'student',
                                })
                              }
                              className="w-full p-5 rounded-2xl border border-slate-100 hover:border-brand-gold flex items-center justify-between text-left transition-all"
                            >
                              <div>
                                <p className="font-bold text-brand-blue">
                                  {u.firstName} {u.surname}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-1">
                                  {u.studentId} · {u.role}
                                  {u.program ? ` · ${u.program}` : ''}
                                </p>
                              </div>
                              <ArrowRight size={16} className="text-slate-200" />
                            </button>
                          ))
                        )}
                      </div>
                    ) : drillDown.level === 'colleges' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {COLLEGES.map(c => (
                          <button 
                            key={c.id}
                            onClick={() => setDrillDown({ level: 'subRole', collegeId: c.id })}
                            className="p-8 rounded-[2rem] bg-white border border-slate-100 hover:border-brand-gold hover:shadow-xl hover:shadow-brand-gold/10 transition-all text-left flex items-center justify-between group"
                          >
                            <div className="flex items-center gap-6">
                              <CollegeIconBadge collegeId={c.id} />
                              <div>
                                <p className="font-display font-bold text-brand-blue">{c.name}</p>
                                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-1">{c.id} Department</p>
                              </div>
                            </div>
                            <ArrowRight size={20} className="text-slate-100 group-hover:text-brand-gold transition-colors" />
                          </button>
                        ))}
                      </div>
                    ) : drillDown.level === 'subRole' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto py-12">
                        <button 
                          onClick={() => setDrillDown(prev => ({ ...prev, level: 'faculty', subRole: 'professor' }))}
                          className="flex flex-col items-center p-12 rounded-[3rem] bg-slate-50 border border-slate-100 hover:bg-white hover:border-brand-gold transition-all group"
                        >
                          <div className="w-20 h-20 rounded-3xl bg-brand-gold/10 border border-brand-gold/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Users size={36} className="text-brand-blue" />
                          </div>
                          <span className="font-display font-bold text-brand-blue uppercase tracking-widest text-xs">Faculty / Professors</span>
                        </button>
                        <button 
                          onClick={() => setDrillDown(prev => ({ ...prev, level: 'programs', subRole: 'student' }))}
                          className="flex flex-col items-center p-12 rounded-[3rem] bg-slate-50 border border-slate-100 hover:bg-white hover:border-brand-gold transition-all group"
                        >
                          <div className="w-20 h-20 rounded-3xl bg-brand-blue/5 border border-brand-blue/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <GraduationCap size={36} className="text-brand-blue" />
                          </div>
                          <span className="font-display font-bold text-brand-blue uppercase tracking-widest text-xs">Student Directory</span>
                        </button>
                      </div>
                    ) : drillDown.level === 'programs' ? (
                      <div className="grid grid-cols-1 gap-4 max-w-xl mx-auto">
                        {(COLLEGES.find(c => c.id === drillDown.collegeId)?.programs ?? [])
                          .filter((p) => matchesSearch(searchQuery, p))
                          .map(p => (
                          <button 
                            key={p}
                            onClick={() => setDrillDown(prev => ({ ...prev, level: 'sections', program: p }))}
                            className="p-6 rounded-2xl border border-slate-100 hover:border-brand-gold text-left flex items-center justify-between group transition-all"
                          >
                            <span className="font-bold text-brand-blue text-sm">{p}</span>
                            <ArrowRight size={16} className="text-slate-200 group-hover:text-brand-gold" />
                          </button>
                        ))}
                      </div>
                    ) : drillDown.level === 'sections' ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {sectionsForProgram(
                          userList,
                          subjects,
                          drillDown.collegeId,
                          drillDown.program
                        )
                          .filter((sec) => matchesSearch(searchQuery, sec))
                          .length === 0 ? (
                          <p className="col-span-full text-center text-slate-400 text-sm py-12">
                            No sections yet. Assign a section when provisioning students, or run
                            Foundation Seed.
                          </p>
                        ) : (
                          sectionsForProgram(
                            userList,
                            subjects,
                            drillDown.collegeId,
                            drillDown.program
                          )
                            .filter((sec) => matchesSearch(searchQuery, sec))
                            .map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() =>
                                setDrillDown((prev) => ({ ...prev, level: 'students', section: s }))
                              }
                              className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-white hover:border-brand-gold font-display font-bold text-brand-blue transition-all"
                            >
                              {s}
                            </button>
                          ))
                        )}
                      </div>
                    ) : drillDown.level === 'students' ? (
                      <div className="divide-y divide-slate-50">
                        {filterUsersBySearch(
                          studentsInDirectory(
                            userList,
                            drillDown.collegeId,
                            drillDown.program,
                            drillDown.section
                          ),
                          searchQuery
                        ).length === 0 ? (
                          <p className="text-center text-slate-400 text-sm py-12">
                            {searchQuery.trim()
                              ? 'No students match your search in this section.'
                              : 'No students in this section. Run Foundation Seed or provision users with program and section.'}
                          </p>
                        ) : (
                        filterUsersBySearch(
                          studentsInDirectory(
                            userList,
                            drillDown.collegeId,
                            drillDown.program,
                            drillDown.section
                          ),
                          searchQuery
                        ).map((u) => (
                          <button 
                            key={u.uid}
                            onClick={() =>
                              setDrillDown((prev) => ({
                                ...prev,
                                level: 'detail',
                                selectedUserId: u.uid,
                                subRole: 'student',
                              }))
                            }
                            className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                          >
                            <div className="flex items-center gap-5">
                              <UserAvatar user={u} size="sm" />
                              <div className="text-left">
                                <p className="font-bold text-brand-blue mb-0.5">{u.firstName} {u.surname}</p>
                                <p className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-widest">
                                  {u.studentId}
                                  {u.section ? ` · ${u.section}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                               <div className="text-right">
                                  <p className="text-[9px] font-bold text-brand-gold uppercase tracking-widest leading-none">Academic record</p>
                                  <p className="text-xs font-bold text-brand-blue mt-1">View detail</p>
                               </div>
                               <ArrowRight size={18} className="text-slate-200 group-hover:text-brand-gold" />
                            </div>
                          </button>
                        ))
                        )}
                      </div>
                    ) : drillDown.level === 'faculty' ? (
                      <div className="divide-y divide-slate-50">
                        {filterUsersBySearch(
                          professorsForCollege(userList, drillDown.collegeId),
                          searchQuery
                        ).length === 0 ? (
                          <p className="text-center text-slate-400 text-sm py-12">
                            {searchQuery.trim()
                              ? 'No faculty match your search.'
                              : 'No faculty listed for this college. Run Foundation Seed to create demo professors.'}
                          </p>
                        ) : (
                        filterUsersBySearch(
                          professorsForCollege(userList, drillDown.collegeId),
                          searchQuery
                        ).map((u) => (
                          <button 
                            key={u.uid}
                            onClick={() =>
                              setDrillDown((prev) => ({
                                ...prev,
                                level: 'detail',
                                selectedUserId: u.uid,
                                subRole: 'professor',
                              }))
                            }
                            className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                          >
                             <div className="flex items-center gap-5">
                              <UserAvatar user={u} size="sm" />
                              <div className="text-left">
                                <p className="font-bold text-brand-blue mb-0.5">{u.firstName} {u.surname}</p>
                                <p className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-widest">Faculty ID: {u.uid.slice(0, 8)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-6">
                               <span className="px-3 py-1 bg-white border border-slate-100 rounded-full text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                  {u.department || 'General Faculty'}
                               </span>
                               <ArrowRight size={18} className="text-slate-200 group-hover:text-brand-gold" />
                            </div>
                          </button>
                        ))
                        )}
                      </div>
                    ) : drillDown.level === 'detail' ? (
                      <div className="space-y-12">
                         {/* User Bio Header */}
                         {userList.find(u => u.uid === drillDown.selectedUserId) && (
                           <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 bg-brand-paper p-10 rounded-[3rem] border border-slate-100">
                              <div className="flex items-center gap-8 min-w-0">
                                {userList.find((u) => u.uid === drillDown.selectedUserId) && (
                                  <UserAvatar
                                    user={userList.find((u) => u.uid === drillDown.selectedUserId)!}
                                    size="lg"
                                  />
                                )}
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold mb-2">
                                    {drillDown.subRole === 'student' ? 'Student record' : 'Faculty record'}
                                  </p>
                                  <h3 className="text-2xl md:text-3xl font-display font-bold text-brand-blue leading-tight mb-2 break-words">
                                    {userList.find(u => u.uid === drillDown.selectedUserId)?.firstName}{' '}
                                    {userList.find(u => u.uid === drillDown.selectedUserId)?.surname}
                                  </h3>
                                  <p className="flex items-center gap-3">
                                    <span className="text-xs font-mono font-bold text-brand-gold uppercase tracking-widest">
                                      {userList.find(u => u.uid === drillDown.selectedUserId)?.studentId || drillDown.selectedUserId?.slice(0, 10)}
                                    </span>
                                    <span className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                      {COLLEGES.find(c => c.id === drillDown.collegeId)?.name}
                                    </span>
                                  </p>
                                </div>
                              </div>
                           </div>
                         )}

                         {(drillDown.subRole === 'student' ||
                           userList.find((u) => u.uid === drillDown.selectedUserId)?.role ===
                             'student') ? (
                           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                              <div className="lg:col-span-2 space-y-8">
                                 <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                                    <div className="p-6 border-b border-slate-50 font-display font-bold text-brand-blue text-xs uppercase tracking-widest flex items-center justify-between">
                                      Academic Subjects Taken
                                      <span className="text-brand-gold">
                                        {detailLoading
                                          ? 'Loading…'
                                          : `${studentDetail?.courses.length ?? 0} enrolled`}
                                      </span>
                                    </div>
                                    <div className="divide-y divide-slate-50 p-6">
                                      {detailLoading ? (
                                        <p className="text-slate-400 text-sm py-8 text-center">Loading enrollments…</p>
                                      ) : studentDetail?.courses.length === 0 ? (
                                        <p className="text-slate-400 text-sm py-8 text-center">No approved enrollments</p>
                                      ) : (
                                        studentDetail?.courses.map((s) => (
                                        <div key={`${s.code}-${s.title}`} className="py-4 flex items-center justify-between">
                                          <div>
                                            <p className="font-bold text-brand-blue text-sm">{s.title}</p>
                                            <p className="text-[10px] font-mono text-slate-300">{s.code}</p>
                                          </div>
                                          <div className="flex items-center gap-6">
                                            <div className="text-center">
                                              <p className="text-[9px] font-bold text-slate-300 uppercase mb-0.5">Grade</p>
                                              <p className="text-xs font-bold text-emerald-500">{s.grade}</p>
                                            </div>
                                            <div className="text-center">
                                              <p className="text-[9px] font-bold text-slate-300 uppercase mb-0.5">Units</p>
                                              <p className="text-xs font-bold text-brand-blue">{s.units}</p>
                                            </div>
                                          </div>
                                        </div>
                                        ))
                                      )}
                                    </div>
                                 </div>
                              </div>
                              <div className="space-y-8">
                                 <div className="bg-brand-blue p-8 rounded-3xl text-white">
                                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-4">Posted GWA</p>
                                    <div className="flex items-end gap-3">
                                       <span className="text-5xl font-display font-bold">
                                         {studentDetail?.gwa != null
                                           ? studentDetail.gwa.toFixed(2)
                                           : EMPTY}
                                       </span>
                                    </div>
                                    <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-2 gap-4">
                                       <div>
                                          <p className="text-[9px] font-bold text-white/40 uppercase mb-1">Posted units</p>
                                          <p className="text-sm font-bold">{studentDetail?.totalUnits ?? 0}</p>
                                       </div>
                                       <div>
                                          <p className="text-[9px] font-bold text-white/40 uppercase mb-2">Section</p>
                                          {(() => {
                                            const sec = userList.find(
                                              (u) => u.uid === drillDown.selectedUserId
                                            )?.section;
                                            return sec ? (
                                              <SectionChips sections={[sec]} inverted />
                                            ) : (
                                              <p className="text-sm font-bold">N/A</p>
                                            );
                                          })()}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           </div>
                         ) : (
                           <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                              <div className="bg-white rounded-3xl border border-slate-100 p-8">
                                 <h4 className="font-display font-bold text-brand-blue text-xs uppercase tracking-widest mb-4">
                                   Handling Sections
                                 </h4>
                                 <SectionChips
                                   sections={
                                     userList.find((u) => u.uid === drillDown.selectedUserId)
                                       ?.handlingSections ?? ['General Load']
                                   }
                                 />
                              </div>
                              <div className="bg-white rounded-3xl border border-slate-100 p-8">
                                 <h4 className="font-display font-bold text-brand-blue text-xs uppercase tracking-widest mb-4">Department Info</h4>
                                 <div className="space-y-4">
                                    <div>
                                       <p className="text-[9px] font-bold text-slate-300 uppercase mb-1">Department</p>
                                       <p className="font-bold text-brand-blue">
                                         {userList.find(u => u.uid === drillDown.selectedUserId)?.department || 'Instructional Office'}
                                       </p>
                                    </div>
                                    <div>
                                       <p className="text-[9px] font-bold text-slate-300 uppercase mb-1">Office</p>
                                       <p className="font-bold text-brand-blue">Academic Bldg, Rm 204</p>
                                    </div>
                                    <div>
                                       <p className="text-[9px] font-bold text-slate-300 uppercase mb-1">Teaching Status</p>
                                       <p className="font-bold text-emerald-500">Regular Faculty</p>
                                    </div>
                                 </div>
                              </div>
                           </div>
                         )}
                      </div>
                    ) : null}
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-100 flex items-center justify-between group cursor-default shadow-sm">
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Verified Students</p>
                        <p className="text-3xl font-display font-bold text-brand-blue">{userList.filter(u => u.role === 'student').length}</p>
                     </div>
                     <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <GraduationCap size={24} />
                     </div>
                  </div>
                  <div className="bg-white p-8 rounded-[2rem] border border-slate-100 flex items-center justify-between group cursor-default shadow-sm">
                     <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 font-mono">Faculty Access</p>
                        <p className="text-3xl font-display font-bold text-brand-blue">{userList.filter(u => u.role === 'professor').length}</p>
                     </div>
                     <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Users size={24} />
                     </div>
                  </div>
               </div>
            </div>
          </div>
          <AdminActivityLogPanel logs={adminLogs} loading={logsLoading} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
