import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { db } from '../lib/firebase';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, getDoc, doc, setDoc } from 'firebase/firestore';
import { Subject, Enrollment } from '../types';
import { toast } from 'react-hot-toast';
import { Users, CheckCircle2, Clock, BookOpen, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, omitUndefined } from '../lib/utils';
import { subjectMatchesProfessor } from '../lib/enrollmentUtils';
import PageHeader from '../components/layout/PageHeader';
import ConfigRequiredState from '../components/ConfigRequiredState';
import { fetchUserRecord, formatUserDisplayName } from '../lib/userLookup';

type RosterStudent = {
  id: string;
  name: string;
  studentId: string;
  grade: number | null;
  gradeStatus: 'posted' | 'pending' | 'not_posted';
};

export default function ProfessorPortal() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { config, loading: configLoading } = useSystemConfig();
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (subjectId) void fetchSubjectAndStudents(subjectId);
  }, [subjectId, profile, user]);

  const fetchSubjectAndStudents = async (id: string) => {
    if (!profile || !user) return;
    setLoading(true);
    try {
      const subSnap = await getDoc(doc(db, 'subjects', id));
      if (!subSnap.exists()) {
        navigate('/professor/subjects');
        return;
      }
      const s = { id: subSnap.id, ...subSnap.data() } as Subject;
      if (!subjectMatchesProfessor(s, user.uid, profile.handlingSections)) {
        toast.error('You are not assigned to this subject');
        navigate('/professor/subjects');
        return;
      }
      setSelectedSubject(s);

      const snap = await getDocs(
        query(
          collection(db, 'enrollments'),
          where('subjectId', '==', s.id),
          where('status', '==', 'approved')
        )
      );

      const studentList = await Promise.all(
        snap.docs.map(async (d) => {
          const enrollment = d.data() as Enrollment;
          const userData = await fetchUserRecord(enrollment.userId);
          const gradeSnap = await getDoc(
            doc(db, 'grades', `${enrollment.userId}_${s.id}`)
          );
          const g = gradeSnap.exists() ? gradeSnap.data() : null;
          const status =
            g?.status === 'posted'
              ? 'posted'
              : g?.status === 'pending'
                ? 'pending'
                : 'not_posted';
          return {
            id: enrollment.userId,
            name: formatUserDisplayName(userData),
            studentId: userData?.studentId ? String(userData.studentId) : '—',
            grade:
              status === 'posted' || status === 'pending'
                ? Number(g!.grade)
                : null,
            gradeStatus: status,
          };
        })
      );
      setStudents(studentList);
      const inputs: Record<string, string> = {};
      studentList.forEach((std) => {
        if (std.grade != null && !Number.isNaN(std.grade)) {
          inputs[std.id] = String(std.grade);
        }
      });
      setGradeInputs(inputs);
    } catch {
      toast.error('Failed to load roster');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitGrade = async (studentUserId: string) => {
    if (!selectedSubject || !user || !config) {
      toast.error('Academic term is not configured.');
      return;
    }
    const raw = gradeInputs[studentUserId];
    const val = parseFloat(raw);
    if (Number.isNaN(val) || val < 1 || val > 5) {
      toast.error('Enter a valid grade between 1.0 and 5.0');
      return;
    }

    const existing = students.find((s) => s.id === studentUserId);
    if (existing?.gradeStatus === 'posted') {
      toast.error('This grade is already posted by the registrar.');
      return;
    }

    setSubmittingId(studentUserId);
    try {
      await setDoc(
        doc(db, 'grades', `${studentUserId}_${selectedSubject.id}`),
        omitUndefined({
          userId: studentUserId,
          subjectId: selectedSubject.id,
          professorId: user.uid,
          grade: val,
          status: 'pending',
          academicYear: config.currentAcademicYear,
          semester: config.currentSemester,
        })
      );
      toast.success('Grade submitted for registrar approval');
      await fetchSubjectAndStudents(selectedSubject.id);
    } catch {
      toast.error('Failed to submit grade');
    } finally {
      setSubmittingId(null);
    }
  };

  if (configLoading) {
    return (
      <div className="flex justify-center py-24">
        <motion.div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!config) {
    return <ConfigRequiredState title="Grade entry unavailable until term is configured" />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20">
      <PageHeader
        title={selectedSubject?.title ?? 'Section Roster'}
        subtitle={
          selectedSubject
            ? `${selectedSubject.code} · ${selectedSubject.section}`
            : 'Loading...'
        }
        backTo="/professor/subjects"
        badge="Submit for approval"
      />

      <AnimatePresence mode="wait">
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : !selectedSubject ? (
          <div className="text-center py-20 text-muted">Subject not found.</div>
        ) : (
          <motion.div
            key="roster"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-3xl border border-border overflow-hidden"
          >
            <div className="p-8 border-b border-border flex items-center justify-between bg-background/50">
              <div className="flex items-center gap-4">
                <Users className="text-accent" size={24} />
                <p className="text-sm text-muted">
                  {students.length} enrolled · Submissions require registrar approval before posting
                </p>
              </div>
              <div className="flex items-center gap-2 text-muted text-[10px] font-bold uppercase tracking-widest">
                <BookOpen size={14} className="text-accent" />
                AY {config.currentAcademicYear}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-background text-[10px] font-bold uppercase tracking-widest text-muted">
                  <tr>
                    <th className="px-8 py-5">Student</th>
                    <th className="px-8 py-5">ID</th>
                    <th className="px-8 py-5">Grade (1.0–5.0)</th>
                    <th className="px-8 py-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-8 py-16 text-center text-muted">
                        No approved enrollments for this section.
                      </td>
                    </tr>
                  ) : (
                    students.map((std) => (
                      <tr key={std.id} className="hover:bg-background/30">
                        <td className="px-8 py-5 font-bold text-primary">{std.name}</td>
                        <td className="px-8 py-5 font-mono text-xs text-muted">{std.studentId}</td>
                        <td className="px-8 py-5">
                          {std.gradeStatus === 'posted' ? (
                            <span className="font-mono font-bold text-lg text-primary">
                              {std.grade != null ? std.grade.toFixed(2) : '—'}
                            </span>
                          ) : (
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                min={1}
                                max={5}
                                step={0.25}
                                disabled={std.gradeStatus === 'pending'}
                                value={gradeInputs[std.id] ?? ''}
                                onChange={(e) =>
                                  setGradeInputs((prev) => ({
                                    ...prev,
                                    [std.id]: e.target.value,
                                  }))
                                }
                                className="w-24 px-3 py-2 border border-border rounded-lg font-mono text-sm disabled:opacity-60"
                              />
                              <button
                                type="button"
                                disabled={
                                  submittingId === std.id || std.gradeStatus === 'pending'
                                }
                                onClick={() => void handleSubmitGrade(std.id)}
                                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold uppercase text-[9px] tracking-widest disabled:opacity-50"
                              >
                                <Send size={12} />
                                {std.gradeStatus === 'pending' ? 'Pending' : 'Submit'}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <span
                            className={cn(
                              'inline-flex items-center gap-2 text-[9px] font-bold uppercase px-3 py-2 rounded-lg border',
                              std.gradeStatus === 'posted'
                                ? 'text-success border-success/20 bg-success-muted'
                                : std.gradeStatus === 'pending'
                                  ? 'text-amber-600 border-amber-200 bg-amber-50'
                                  : 'text-muted border-border bg-background'
                            )}
                          >
                            {std.gradeStatus === 'posted' ? (
                              <CheckCircle2 size={12} />
                            ) : (
                              <Clock size={12} />
                            )}
                            {std.gradeStatus === 'posted'
                              ? 'Posted'
                              : std.gradeStatus === 'pending'
                                ? 'Awaiting approval'
                                : 'Not submitted'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
