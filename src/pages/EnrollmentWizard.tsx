import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { useStudentEnrollmentStatus } from '../hooks/useStudentEnrollmentStatus';
import { COLLEGES, collegeIdByName } from '../lib/colleges';
import {
  buildEnrollmentCapacitySnapshot,
  canChooseCollegeAndProgram,
  evaluateSubjectEligibility,
  listPreEnrollmentCatalog,
  subjectIneligibilityLabel,
  type EnrollmentCapacitySnapshot,
} from '../lib/enrollmentEligibility';
import { preEnrollmentBlockMessage } from '../lib/enrollmentUtils';
import { formatSemesterLabel } from '../lib/systemConfig';
import SubjectOfferingCard from '../components/SubjectOfferingCard';
import {
  EnrollmentRequestError,
  submitInitialEnrollment,
} from '../services/enrollmentRequestService';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { Subject, Grade, Enrollment } from '../types';
import { toast } from 'react-hot-toast';
import PageHeader from '../components/layout/PageHeader';
import { 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  ArrowRight,
  ArrowLeft,
  Info,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  Lock,
  ChevronRight,
  GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useUrlSearchQuery } from '../hooks/useUrlSearchQuery';
import { filterSubjectsBySearch } from '../lib/searchUtils';
import { suggestionFromSubject } from '../lib/searchSuggestions';
import SearchField from '../components/SearchField';
import ConfigRequiredState from '../components/ConfigRequiredState';
import { UnitInline, UnitValue, UnitsColumnHeader } from '../components/UnitsDisplay';
import { formatCapacityPhrase } from '../lib/unitsDisplay';

export default function EnrollmentWizard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { config: systemConfig, loading: configLoading } = useSystemConfig();
  const { preEnrollBlockReason, canPreEnroll, enrollments, isEnrolled, termPhase } =
    useStudentEnrollmentStatus();
  const [step, setStep] = useState(() => {
    const q = Number(searchParams.get('step'));
    return q >= 1 && q <= 4 ? q : 1;
  });

  const goToStep = (next: number) => {
    setStep(next);
    const params = new URLSearchParams(searchParams);
    if (next <= 1) params.delete('step');
    else params.set('step', String(next));
    setSearchParams(params, { replace: true });
  };
  const [wizardConfig, setWizardConfig] = useState({
    college: '',
    program: '',
    section: '',
    semester: '1',
    yearLevel: 1,
    status: 'Regular',
  });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [userGrades, setUserGrades] = useState<string[]>([]); 
  const [enrolledSubjectIds, setEnrolledSubjectIds] = useState<string[]>([]);
  const [capacitySnapshot, setCapacitySnapshot] = useState<EnrollmentCapacitySnapshot>({
    bySubjectId: {},
    byCourseCode: {},
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [catalogSearch, setCatalogSearch] = useUrlSearchQuery();

  const mayChooseCollegeProgram =
    profile && systemConfig
      ? canChooseCollegeAndProgram(profile, systemConfig)
      : false;

  useEffect(() => {
    if (!profile || !systemConfig) return;
    if (mayChooseCollegeProgram) return;
    setWizardConfig((prev) => ({
      ...prev,
      college: collegeIdByName(profile.college ?? '') ?? prev.college,
      program: profile.program ?? prev.program,
      section: profile.section ?? prev.section,
      yearLevel: profile.yearLevel ?? 1,
      semester: systemConfig.currentSemester,
    }));
  }, [profile, systemConfig, mayChooseCollegeProgram]);

  const catalogSuggestions = useMemo(
    () =>
      subjects.map((s) =>
        suggestionFromSubject(s, 'student', { canEnroll: canPreEnroll })
      ),
    [subjects, canPreEnroll]
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const subjectsSnap = await getDocs(collection(db, 'subjects'));
        const subjectsData = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Subject));
        setSubjects(subjectsData);

        if (profile) {
          const gradesQ = query(
            collection(db, 'grades'),
            where('userId', '==', profile.uid),
            where('status', '==', 'posted')
          );
          const gradesSnap = await getDocs(gradesQ);
          const passedCodes: string[] = [];
          for (const gd of gradesSnap.docs) {
            if (gd.data().grade > 3.0) continue;
            const subSnap = await getDoc(doc(db, 'subjects', gd.data().subjectId));
            if (subSnap.exists()) passedCodes.push(subSnap.data().code);
          }
          setUserGrades(passedCodes);

          const enrollSnap = await getDocs(collection(db, 'enrollments'));
          const allEnrolls = enrollSnap.docs.map(
            (d) => ({ id: d.id, ...d.data() } as Enrollment)
          );
          const enrolled = allEnrolls
            .filter((e) => e.userId === profile.uid)
            .map((e) => e.subjectId);
          setEnrolledSubjectIds(enrolled);
          if (systemConfig) {
            setCapacitySnapshot(
              buildEnrollmentCapacitySnapshot(allEnrolls, subjectsData, systemConfig)
            );
          }
        }
      } catch (error) {
        toast.error('Failed to load subjects');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile, systemConfig]);

  const toggleSubject = (s: Subject) => {
    if (!profile || !systemConfig) return;
    const check = evaluateSubjectEligibility(s, {
      profile,
      config: systemConfig,
      passedCourseCodes: userGrades,
      enrolledSubjectIds,
      snapshot: capacitySnapshot,
      section: wizardConfig.section || undefined,
      collegeName: wizardConfig.college
        ? COLLEGES.find((c) => c.id === wizardConfig.college)?.name
        : profile.college,
      intent: 'pre_enrollment',
    });
    if (!check.eligible) {
      toast.error(
        subjectIneligibilityLabel(
          check.reasons,
          check.missingPrerequisites,
          check.scheduleKind,
          systemConfig,
          s
        )
      );
      return;
    }

    if (selectedIds.includes(s.id)) {
      setSelectedIds(prev => prev.filter(id => id !== s.id));
    } else {
      const currentUnits = subjects
        .filter(sub => selectedIds.includes(sub.id))
        .reduce((acc, curr) => acc + curr.units, 0);
      
      if (currentUnits + s.units > (profile?.maxUnits || 30)) {
        toast.error(`You have reached the maximum unit capacity (${profile?.maxUnits} units)`);
        return;
      }

      setSelectedIds(prev => [...prev, s.id]);
    }
  };

  const catalogPool = useMemo(() => {
    if (!profile || !systemConfig || !wizardConfig.section) return [];
    return listPreEnrollmentCatalog(subjects, profile, systemConfig, {
      collegeId: wizardConfig.college || undefined,
      program: wizardConfig.program || undefined,
      section: wizardConfig.section,
    });
  }, [subjects, profile, systemConfig, wizardConfig]);

  const catalogWithEligibility = useMemo(() => {
    if (!profile || !systemConfig) return [];
    const collegeName = wizardConfig.college
      ? COLLEGES.find((c) => c.id === wizardConfig.college)?.name
      : profile.college;
    return catalogPool.map((s) => ({
      subject: s,
      eligibility: evaluateSubjectEligibility(s, {
        profile,
        config: systemConfig,
        passedCourseCodes: userGrades,
        enrolledSubjectIds,
        snapshot: capacitySnapshot,
        section: wizardConfig.section,
        collegeName,
        intent: 'pre_enrollment',
      }),
    }));
  }, [
    catalogPool,
    profile,
    systemConfig,
    userGrades,
    enrolledSubjectIds,
    capacitySnapshot,
    wizardConfig.section,
    wizardConfig.college,
  ]);

  const wizardFiltered = filterSubjectsBySearch(
    catalogWithEligibility.map((x) => x.subject),
    catalogSearch
  ).map((s) => catalogWithEligibility.find((x) => x.subject.id === s.id)!);

  const sectionOptions = useMemo(() => {
    if (!profile || !systemConfig) return [];
    const pool = listPreEnrollmentCatalog(subjects, profile, systemConfig, {
      collegeId: wizardConfig.college || undefined,
      program: wizardConfig.program || undefined,
    });
    return [...new Set(pool.map((s) => s.section).filter(Boolean))].sort();
  }, [subjects, profile, systemConfig, wizardConfig.college, wizardConfig.program]);

  const handleConfirm = async () => {
    if (!profile?.uid || !systemConfig) {
      toast.error('Your profile is not loaded. Sign out and sign in again.');
      return;
    }
    setSubmitting(true);
    try {
      await submitInitialEnrollment({
        profile,
        config: systemConfig,
        enrollments,
        subjects,
        subjectIds: selectedIds,
        passedCourseCodes: userGrades,
        wizardMeta: {
          collegeId: wizardConfig.college,
          program: wizardConfig.program,
          section: wizardConfig.section,
        },
      });
      toast.success('Pre-enrollment submitted for registrar approval!');
      goToStep(4);
      setTimeout(() => navigate('/enrollment'), 2500);
    } catch (e) {
      toast.error(
        e instanceof EnrollmentRequestError ? e.message : 'Enrollment failed'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const totalSelectedUnits = subjects
    .filter(s => selectedIds.includes(s.id))
    .reduce((acc, curr) => acc + curr.units, 0);

  if (configLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <motion.div className="w-8 h-8 border-2 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] animate-pulse">Initializing Enrollment Engine</p>
      </div>
    );
  }

  if (!systemConfig) {
    return <ConfigRequiredState title="Enrollment unavailable until term is configured" />;
  }

  if (termPhase === 'pre_enrollment_pending' && systemConfig) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center bg-white rounded-3xl border border-slate-100 p-12">
        <Clock size={40} className="mx-auto text-brand-gold mb-6" />
        <h2 className="text-2xl font-display font-bold text-brand-blue mb-4">
          Pre-Enrollment Submitted
        </h2>
        <p className="text-slate-500 mb-8">
          {preEnrollmentBlockMessage('awaiting_approval')}
        </p>
        <p className="text-xs text-slate-400 mb-8">
          Add and drop stay unavailable until the registrar approves your load and you are enrolled
          for this term.
        </p>
        <button
          type="button"
          onClick={() => navigate('/study-load')}
          className="bg-brand-blue text-white px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-widest"
        >
          View Study Load
        </button>
      </div>
    );
  }

  if (!canPreEnroll && systemConfig) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center bg-white rounded-3xl border border-slate-100 p-12">
        <Lock size={40} className="mx-auto text-brand-gold mb-6" />
        <h2 className="text-2xl font-display font-bold text-brand-blue mb-4">Pre-enrollment Unavailable</h2>
        <p className="text-slate-500 mb-8">
          {preEnrollmentBlockMessage(preEnrollBlockReason) ||
            'Pre-enrollment is not available for this term.'}
        </p>
        {preEnrollBlockReason === 'already_enrolled' ? (
          <button
            type="button"
            onClick={() => navigate('/enrollment')}
            className="bg-brand-blue text-white px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-widest"
          >
            Enrollment status
          </button>
        ) : (
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-brand-blue text-white px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-widest"
          >
            Back to Dashboard
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <motion.div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-8 h-8 border-2 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] animate-pulse">Initializing Enrollment Engine</p>
      </motion.div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-12">
      {/* Dynamic Progress Stepper */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-4">
        <PageHeader
          title="Pre-Enrollment"
          subtitle={
            systemConfig
              ? `AY ${systemConfig.currentAcademicYear} · ${formatSemesterLabel(systemConfig.currentSemester)}`
              : undefined
          }
          badge={`Step ${step} of 4`}
          backTo="/dashboard"
          className="flex-1 pb-0"
        />

        <div className="flex items-center gap-4 bg-surface p-2 rounded-2xl border border-border shadow-sm relative">
           {[1, 2, 3, 4].map((s) => (
             <div key={s} className="flex items-center">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center font-display font-bold text-sm transition-all duration-500",
                  step === s ? "bg-primary text-primary-foreground shadow-xl shadow-primary/20" : step > s ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground"
                )}>
                  {step > s ? <CheckCircle2 size={18} /> : s}
                </div>
                {s < 4 && <div className={cn("w-12 h-1 mx-2 rounded-full", step > s ? "bg-accent" : "bg-border")} />}
             </div>
           ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1" 
            initial={{ opacity: 0, scale: 0.98 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.98 }} 
            className="grid grid-cols-1 lg:grid-cols-3 gap-12"
          >
            <div className="lg:col-span-2 bg-white rounded-[3rem] p-12 lg:p-20 border border-slate-100 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                  <GraduationCap size={400} />
               </div>
               
               <div className="relative z-10">
                 <h2 className="text-3xl font-display font-bold text-brand-blue mb-10 tracking-tight">Eligibility Verification</h2>
                 <p className="text-slate-500 mb-12 max-w-lg leading-relaxed">
                   Before proceeding to subject selection, please verify that your system profile reflects the correct academic standing for the upcoming semester.
                 </p>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
                   {[
                     { label: 'Academic Program', value: profile?.program, icon: BookOpen },
                     { label: 'Year Classification', value: `Year ${profile?.yearLevel}`, icon: Layers },
                     { label: 'College Faculty', value: profile?.college, icon: GraduationCap },
                     { label: 'Max Load Capacity', value: `${profile?.maxUnits} Units`, icon: Sparkles }
                   ].map((item, i) => (
                      <div key={i} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 hover:border-brand-gold/30 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center mb-4 text-brand-blue shadow-sm">
                           <item.icon size={16} />
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                        <p className="text-sm font-bold text-brand-ink">{item.value}</p>
                      </div>
                   ))}
                 </div>

                 <div className="flex items-center gap-6">
                    <div className="flex-1 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Enrollment Status</p>
                        <p className="font-display font-bold text-emerald-900">Cleared for Registration</p>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => goToStep(2)} 
                      className="bg-brand-blue text-white px-10 py-6 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-2xl shadow-brand-blue/20 hover:bg-brand-blue/90 hover:-translate-y-1 transition-all active:translate-y-0 flex items-center gap-3"
                    >
                      Choose College
                      <ArrowRight size={18} />
                    </button>
                 </div>
               </div>
            </div>

            <div className="space-y-6">
               <div className="bg-brand-blue p-10 rounded-[2.5rem] text-white overflow-hidden relative">
                  <div className="relative z-10">
                    <h4 className="text-xl font-display font-bold mb-4">Enrollment Guidelines</h4>
                    <p className="text-white/40 text-xs leading-relaxed mb-6 font-light">
                      Students are advised to select courses strictly following the prescribed curriculum. Prerequisite validation is real-time.
                    </p>
                    <ul className="space-y-3 text-[10px] font-bold uppercase tracking-widest text-brand-gold/80">
                       <li className="flex items-center gap-2">
                         <div className="w-1 h-1 rounded-full bg-brand-gold" />
                         Check PREREQUISITES
                       </li>
                       <li className="flex items-center gap-2">
                         <div className="w-1 h-1 rounded-full bg-brand-gold" />
                         Verify SLOT AVAILABILITY
                       </li>
                       <li className="flex items-center gap-2">
                         <div className="w-1 h-1 rounded-full bg-brand-gold" />
                         Submit FOR APPROVAL
                       </li>
                    </ul>
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-brand-gold/10 rounded-full blur-[40px]" />
               </div>

               <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 italic font-light text-slate-400 text-xs leading-relaxed text-center">
                  "The root of education is bitter, but the fruit is sweet. Manage your academic journey with precision."
               </div>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step2-config" 
            initial={{ opacity: 0, scale: 0.98 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="space-y-12"
          >
            <div className="bg-white rounded-[3rem] p-12 lg:p-20 border border-slate-100 shadow-sm relative overflow-hidden">
               <h2 className="text-3xl font-display font-bold text-brand-blue mb-10 tracking-tight">Pre-Enrollment Configuration</h2>
               
               <div className="space-y-12">
                 {!mayChooseCollegeProgram && (
                   <p className="text-sm text-slate-500 bg-brand-paper border border-slate-100 rounded-2xl px-6 py-4">
                     College and program are set from your profile for this term (only 1st year · 1st
                     sem may choose them). Select your <strong>section</strong> and subjects below.
                   </p>
                 )}
                 {/* College Selection */}
                 {!wizardConfig.college ? (
                   <div className="space-y-6">
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4">Choose College</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {COLLEGES.map((c) => (
                         <button 
                           key={c.id} 
                           type="button"
                           disabled={!mayChooseCollegeProgram}
                           onClick={() => mayChooseCollegeProgram && setWizardConfig(prev => ({ ...prev, college: c.id }))}
                           className={cn(
                             "p-8 rounded-[2rem] bg-white border border-slate-100 text-left flex items-start gap-6 group transition-all",
                             mayChooseCollegeProgram
                               ? "hover:border-brand-gold hover:shadow-xl hover:shadow-brand-gold/10"
                               : "opacity-40 cursor-not-allowed"
                           )}
                         >
                           <span className="text-4xl group-hover:scale-110 transition-transform">{c.icon}</span>
                           <div>
                             <p className="font-display font-bold text-brand-ink mb-1">{c.name}</p>
                             <p className="text-xs text-slate-400 font-medium">{c.programs.join(' · ')}</p>
                           </div>
                         </button>
                       ))}
                     </div>
                   </div>
                 ) : !wizardConfig.program ? (
                   <div className="space-y-6">
                     <div className="flex items-center justify-between px-4">
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Program in {wizardConfig.college}</p>
                       {mayChooseCollegeProgram && (
                         <button type="button" onClick={() => setWizardConfig(prev => ({ ...prev, college: '' }))} className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">Change Unit</button>
                       )}
                     </div>
                     <div className="grid grid-cols-1 gap-4">
                       {(COLLEGES.find((c) => c.id === wizardConfig.college)?.programs ?? []).map(p => (
                         <button 
                           key={p}
                           type="button"
                           disabled={!mayChooseCollegeProgram}
                           onClick={() => mayChooseCollegeProgram && setWizardConfig(prev => ({ ...prev, program: p }))}
                           className={cn(
                             "p-8 rounded-3xl bg-white border border-slate-100 text-left flex items-center justify-between group transition-all",
                             mayChooseCollegeProgram ? "hover:border-brand-gold" : "opacity-40 cursor-not-allowed"
                           )}
                         >
                           <div className="flex items-center gap-4">
                              <div className="w-4 h-4 rounded-full border-2 border-slate-200 group-hover:border-brand-gold flex items-center justify-center transition-colors">
                                 <div className="w-1.5 h-1.5 bg-brand-gold rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <span className="font-bold text-brand-blue">{p}</span>
                           </div>
                           <span className="text-[10px] font-mono text-slate-300">4-Year Track • 143 Units</span>
                         </button>
                       ))}
                     </div>
                   </div>
                 ) : (
                   <div className="space-y-12">
                     <div className="flex items-center justify-between bg-brand-paper p-8 rounded-3xl border border-slate-100">
                        <div className="flex items-center gap-6">
                           <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-2xl shadow-sm">🎓</div>
                           <div>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Selected Program</p>
                              <p className="text-sm font-bold text-brand-blue">{wizardConfig.program}</p>
                           </div>
                        </div>
                        {mayChooseCollegeProgram && (
                          <button type="button" onClick={() => setWizardConfig(prev => ({ ...prev, program: '' }))} className="text-[10px] font-bold text-brand-gold uppercase tracking-widest">Change</button>
                        )}
                     </div>

                     <div className="space-y-8">
                        <div>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Choose Section</p>
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {sectionOptions.map((sec) => (
                                 <button
                                    key={sec}
                                    type="button"
                                    onClick={() => setWizardConfig((prev) => ({ ...prev, section: sec }))}
                                    className={cn(
                                       'p-5 rounded-2xl border font-bold text-sm transition-all',
                                       wizardConfig.section === sec
                                         ? 'bg-brand-blue text-white border-transparent'
                                         : 'bg-white border-slate-100 text-slate-500 hover:border-brand-gold'
                                    )}
                                 >
                                    {sec}
                                 </button>
                              ))}
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-6">
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Year Level</p>
                           <div className="grid grid-cols-2 gap-4">
                              {[1, 2, 3, 4].map(y => (
                                 <button 
                                    key={y}
                                    type="button"
                                    disabled={!mayChooseCollegeProgram}
                                    onClick={() => mayChooseCollegeProgram && setWizardConfig(prev => ({ ...prev, yearLevel: y }))}
                                    className={cn(
                                       "p-6 rounded-2xl border transition-all font-display font-bold text-center",
                                       wizardConfig.yearLevel === y ? "bg-brand-blue text-white border-transparent shadow-lg shadow-brand-blue/20" : "bg-white border-slate-100 text-slate-400",
                                       !mayChooseCollegeProgram && "opacity-40 cursor-not-allowed",
                                       mayChooseCollegeProgram && wizardConfig.yearLevel !== y && "hover:border-slate-200"
                                    )}
                                 >
                                    <span className="text-xl mb-1 block">{y === 1 ? '🥇' : y === 2 ? '🥈' : y === 3 ? '🥉' : '🎓'}</span>
                                    {y}{y === 1 ? 'st' : y === 2 ? 'nd' : y === 3 ? 'rd' : 'th'} Year
                                 </button>
                              ))}
                           </div>
                        </div>

                        <div className="space-y-6">
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Term</p>
                           <div className="p-6 rounded-2xl bg-brand-paper border border-slate-100">
                              <p className="font-bold text-brand-blue">
                                 AY {systemConfig?.currentAcademicYear} ·{' '}
                                 {systemConfig ? formatSemesterLabel(systemConfig.currentSemester) : '—'}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-2 uppercase tracking-widest">
                                 Portal term (fixed for pre-enrollment)
                              </p>
                           </div>
                        </div>
                     </div>

                     <div className="flex justify-end pt-8">
                        <button 
                           disabled={!wizardConfig.section}
                           onClick={() => goToStep(3)}
                           className="bg-brand-blue text-white px-12 py-6 rounded-2xl font-bold uppercase text-[11px] tracking-widest shadow-2xl shadow-brand-blue/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-4 disabled:opacity-50"
                        >
                           Proceed to Course Selection
                           <ArrowRight size={20} />
                        </button>
                     </div>
                   </div>
                 )}
               </div>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* Load Analyzer Sidebar */}
              <div className="lg:col-span-4 xl:col-span-4 space-y-6">
                <div className="bg-white p-8 lg:p-10 rounded-[2.5rem] border border-slate-100 shadow-sm sticky top-8 min-w-0">
                  <h3 className="text-xs font-bold text-brand-blue uppercase tracking-[0.2em] mb-8 text-center">
                    Load Summary
                  </h3>
                  
                  <div className="space-y-8">
                    <div className="flex flex-col items-center px-2">
                      <div className="relative w-44 h-44 flex items-center justify-center mb-4">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                           <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-50" />
                           <motion.circle 
                              cx="80" cy="80" r="70" 
                              stroke="currentColor" strokeWidth="8" fill="transparent" 
                              strokeDasharray={440}
                              strokeDashoffset={440 - (440 * (totalSelectedUnits / (profile?.maxUnits || 30)))}
                              strokeLinecap="round"
                              className="text-brand-gold transition-all duration-1000"
                           />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <UnitValue
                            value={totalSelectedUnits}
                            size="lg"
                            className="items-center text-brand-blue"
                            labelClassName="text-slate-400"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                        {formatCapacityPhrase(profile?.maxUnits || 30)}
                      </p>
                    </div>
                    
                    <div className="h-px bg-slate-100" />

                    {selectedIds.length === 0 ? (
                      <div className="flex flex-col items-center py-10 px-4 border-2 border-dashed border-slate-100 rounded-2xl text-center">
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No courses selected</p>
                         <p className="text-xs text-slate-400 mt-2 leading-relaxed">Select subjects from the catalog to build your load.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected courses</p>
                        <div className="overflow-x-auto -mx-1 px-1">
                          <table className="w-full min-w-[240px] text-left text-sm border-separate border-spacing-y-2">
                            <thead>
                              <tr className="text-[9px] uppercase tracking-widest text-slate-400">
                                <th className="pb-2 pr-3 font-bold w-[4.5rem]">Code</th>
                                <th className="pb-2 pr-3 font-bold">Title</th>
                                <th className="pb-2 text-right font-bold w-[3.5rem]">
                                  <UnitsColumnHeader />
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {subjects.filter((s) => selectedIds.includes(s.id)).map((s) => (
                                <tr key={s.id} className="bg-brand-paper/80 rounded-xl">
                                  <td className="py-3 pr-3 font-mono text-xs font-bold text-brand-gold align-top">{s.code}</td>
                                  <td className="py-3 pr-3 text-xs font-medium text-brand-ink leading-snug align-top">{s.title}</td>
                                  <td className="py-3 text-right align-top">
                                    <UnitInline value={s.units} className="flex-col items-end gap-0.5" />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 space-y-3">
                      <button 
                        disabled={selectedIds.length === 0 || submitting}
                        onClick={() => void handleConfirm()}
                        className="w-full bg-brand-blue text-white py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-brand-blue/90 disabled:grayscale disabled:opacity-50 transition-all shadow-xl shadow-brand-blue/20 active:scale-95"
                      >
                        {submitting ? 'Submitting...' : 'Confirm & Submit'}
                      </button>
                      <button
                        type="button"
                        onClick={() => goToStep(2)}
                        className="w-full text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-brand-blue flex items-center justify-center gap-2 transition-all py-2"
                      >
                        <ArrowLeft size={12} />
                        Back to Choose College
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subject Grid */}
              <div className="lg:col-span-8 xl:col-span-8 space-y-8">
                <SearchField
                  value={catalogSearch}
                  onChange={setCatalogSearch}
                  onSubmit={setCatalogSearch}
                  suggestions={catalogSuggestions}
                  placeholder="Search academic catalog…"
                  inputClassName="!py-4 !rounded-2xl"
                />

                <div className="grid grid-cols-1 gap-6 pb-20">
                  {wizardFiltered.length === 0 && catalogSearch.trim() && (
                    <p className="text-center text-slate-400 text-sm py-12">
                      No courses match &ldquo;{catalogSearch.trim()}&rdquo;
                    </p>
                  )}
                  {wizardFiltered.length === 0 && !catalogSearch.trim() && !wizardConfig.section && (
                    <p className="text-center text-slate-400 text-sm py-12">
                      Choose a section in the previous step to see courses.
                    </p>
                  )}
                  {wizardFiltered.map(({ subject, eligibility }) => (
                    <SubjectOfferingCard
                      key={subject.id}
                      subject={subject}
                      eligibility={eligibility}
                      config={systemConfig ?? undefined}
                      isSelected={selectedIds.includes(subject.id)}
                      onToggle={() => toggleSubject(subject)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === 4 && (
          <motion.div 
            key="step4" 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-brand-blue rounded-[4rem] p-16 lg:p-24 shadow-2xl text-center max-w-4xl mx-auto overflow-hidden relative border border-white/5"
          >
            <div className="absolute inset-0 pointer-events-none opacity-20">
               <div className="absolute top-0 right-0 w-96 h-96 bg-brand-gold rounded-full filter blur-[120px]" />
               <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-emerald-400 rounded-full filter blur-[120px]" />
            </div>
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center text-white mb-10 shadow-[0_0_50px_rgba(16,185,129,0.3)] rotate-3">
                <CheckCircle2 size={48} />
              </div>
              <h2 className="text-5xl font-display font-bold text-white mb-6 tracking-tight">Enrollment Submitted</h2>
              <p className="text-white/50 text-lg lg:text-xl font-light mb-12 max-w-xl leading-relaxed">
                Your enrollment request has been submitted and is awaiting registrar approval. You will be redirected to Study Load shortly.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md">
                <button 
                  onClick={() => window.location.href = '/dashboard'} 
                  className="flex-1 bg-brand-gold text-brand-blue py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-xl shadow-brand-gold/20 hover:-translate-y-1 transition-all"
                >
                  Return to Dashboard
                </button>
                <button 
                  onClick={() => navigate('/study-load')} 
                  className="flex-1 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all"
                >
                  View Study Load
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
