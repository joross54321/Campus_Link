import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useStudentEnrollmentStatus } from '../hooks/useStudentEnrollmentStatus';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import {
  Building,
  GraduationCap,
  Calendar,
  User,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  ArrowRight,
  Fingerprint,
  Award,
  BookOpen,
  LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/layout/PageHeader';
import { getHomePathForRole } from '../lib/authRoutes';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { formatSemesterLabel } from '../lib/systemConfig';
import { UserRole } from '../types';
import { cn } from '../lib/utils';
import { campusAuthEmail } from '../lib/authEmail';
import { DetailValue, EmailValue, ProfileField } from '../components/ui/DetailValue';
import { SectionChips } from '../components/ui/SectionChips';
import { useProfessorSections } from '../hooks/useProfessorSections';

function roleDisplayName(role: UserRole): string {
  if (role === 'registrar') return 'Registrar / Administrator';
  if (role === 'professor') return 'Faculty';
  return 'Student';
}

function yearLevelLabel(yearLevel?: number): string {
  if (yearLevel === 4) return '4TH';
  if (yearLevel === 3) return '3RD';
  if (yearLevel === 2) return '2ND';
  if (yearLevel === 1) return '1ST';
  return '—';
}

const ProfileSection = ({
  title,
  items,
}: {
  title: string;
  items: {
    label: string;
    value: string | React.ReactNode;
    icon?: React.ComponentType<{ size?: number }>;
    email?: boolean;
    wide?: boolean;
  }[];
}) => (
  <div className="space-y-8">
    <div className="flex items-center gap-4">
      <h3 className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] font-mono whitespace-nowrap">{title}</h3>
      <div className="h-[1px] bg-border flex-1" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
      {items.map((item, idx) => (
        <div
          key={idx}
          className={cn(
            'flex items-start gap-4 group min-w-0',
            item.wide && 'md:col-span-2'
          )}
        >
          <div className="w-10 h-10 shrink-0 rounded-xl bg-background flex items-center justify-center text-primary group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
            {item.icon && <item.icon size={18} />}
          </div>
          <div className="flex-1 min-w-0 border-b border-border pb-4 group-hover:border-accent/30 transition-colors overflow-hidden">
            <p className="text-[9px] font-bold text-muted uppercase tracking-widest mb-1">{item.label}</p>
            {item.email && typeof item.value === 'string' ? (
              <EmailValue email={item.value} />
            ) : typeof item.value === 'string' ? (
              <DetailValue multiline>{item.value}</DetailValue>
            ) : (
              item.value
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

function profileImageUrl(profile: { firstName?: string; surname?: string; photoUrl?: string }): string {
  if (profile.photoUrl?.trim()) return profile.photoUrl.trim();
  const name = encodeURIComponent(`${profile.firstName ?? ''} ${profile.surname ?? ''}`.trim() || 'User');
  return `https://ui-avatars.com/api/?name=${name}&background=E8C547&color=1e3a5f&size=256`;
}

export default function Profile() {
  const { profile, user } = useAuth();
  const { config } = useSystemConfig();
  const { enrollments } = useStudentEnrollmentStatus();
  const navigate = useNavigate();
  const homePath = getHomePathForRole(profile?.role);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updating, setUpdating] = useState(false);
  const { sections: professorSections } = useProfessorSections(
    profile?.role === 'professor' ? user?.uid : undefined,
    profile?.handlingSections
  );

  const handlePasswordUpdate = async () => {
    if (!user?.email) return;
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setUpdating(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      toast.success('Password updated');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/wrong-password') toast.error('Current password is incorrect');
      else if (code === 'auth/weak-password') toast.error('Password is too weak');
      else toast.error('Could not update password');
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  if (!profile) return (
    <div className="flex flex-col items-center justify-center py-32 space-y-4">
      <div className="w-8 h-8 border-2 border-primary/20 border-t-brand-blue rounded-full animate-spin" />
      <p className="text-[10px] font-bold text-muted uppercase tracking-[0.3em] animate-pulse">Loading Identity Data</p>
    </div>
  );

  const role = profile.role;
  const isStudent = role === 'student';
  const isProfessor = role === 'professor';
  const isRegistrar = role === 'registrar';
  const academicYear = config?.currentAcademicYear ?? '—';
  const academicTerm = config ? formatSemesterLabel(config.currentSemester) : '—';
  const isEnrolledThisTerm =
    isStudent &&
    config &&
    enrollments.some(
      (e) =>
        e.status === 'approved' &&
        e.academicYear === config.currentAcademicYear &&
        e.semester === config.currentSemester
    );
  const enrollmentStatusLabel = isStudent
    ? isEnrolledThisTerm
      ? 'Enrolled'
      : 'Not Enrolled'
    : undefined;

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <PageHeader
        title="System Profile"
        subtitle={
          config
            ? `AY ${config.currentAcademicYear} · ${formatSemesterLabel(config.currentSemester)}`
            : undefined
        }
        backTo={homePath}
      />

      <div className="bg-primary rounded-[3rem] overflow-hidden relative shadow-2xl shadow-primary/20">
         {/* Background Ornaments */}
         <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
            <Fingerprint size={300} strokeWidth={1} />
         </div>
         <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/10 rounded-full blur-[80px]" />

         <div className="relative z-10 p-12 lg:p-20 pb-14 lg:pb-16 flex flex-col lg:flex-row items-center lg:items-start gap-12 lg:gap-20">
            {/* Avatar Stack */}
            <div className="relative">
               <img
                 src={profileImageUrl(profile)}
                 alt={`${profile.firstName} ${profile.surname}`}
                 className="w-40 h-40 rounded-[3rem] object-cover rotate-3 shadow-2xl shadow-accent/20 border-4 border-accent"
                 referrerPolicy="no-referrer"
               />
            </div>

            <div className="flex-1 min-w-0 text-center lg:text-left">
               <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6 justify-center lg:justify-start">
                  <h1 className="text-4xl lg:text-5xl font-display font-bold text-white tracking-tight">{profile.firstName} {profile.surname}</h1>
                  <span className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20 w-fit shrink-0 self-center lg:self-auto">
                    {roleDisplayName(role)}
                  </span>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 mb-10 max-w-2xl mx-auto lg:mx-0">
                  {[
                    {
                      icon: Fingerprint,
                      label: isRegistrar ? 'Staff ID' : isProfessor ? 'Faculty ID' : 'Student ID',
                      value: profile.studentId,
                    },
                    {
                      icon: GraduationCap,
                      label: isStudent ? 'Academic Program' : 'Assignment',
                      value: isStudent ? (
                        profile.program || '—'
                      ) : isProfessor ? (
                        <SectionChips sections={professorSections} inverted />
                      ) : (
                        'CampusLink Administration'
                      ),
                    },
                    ...(isStudent
                      ? [
                          {
                            icon: BookOpen,
                            label: 'Section',
                            value: profile.section || '—',
                          },
                        ]
                      : []),
                    {
                      icon: Building,
                      label: isRegistrar ? 'Office' : 'College',
                      value: profile.college || (isRegistrar ? "Registrar's Office" : '—'),
                    },
                  ].map((item, i) => (
                    <ProfileField
                      key={i}
                      inverted
                      icon={item.icon}
                      label={item.label}
                      value={item.value}
                    />
                  ))}
               </div>

               <div className="flex flex-wrap gap-4 justify-center lg:justify-start">
                  <div className="bg-surface/5 border border-white/10 backdrop-blur-md px-10 py-6 rounded-[2rem] flex flex-col items-center min-w-[8rem]">
                     <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Semester (Term)</p>
                     <p className="text-lg font-mono font-bold text-white leading-tight text-center">{academicTerm}</p>
                  </div>
                  <div className="bg-surface/5 border border-white/10 backdrop-blur-md px-10 py-6 rounded-[2rem] flex flex-col items-center min-w-[8rem]">
                     <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Academic Year</p>
                     <p className="text-lg font-mono font-bold text-white leading-tight text-center">{academicYear}</p>
                  </div>
                  {isStudent && (
                    <>
                      <div className="bg-surface/5 border border-white/10 backdrop-blur-md px-10 py-6 rounded-[2rem] flex flex-col items-center">
                        <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Max Load</p>
                        <p className="text-2xl font-mono font-bold text-white leading-none">{profile.maxUnits ?? 30}</p>
                      </div>
                      <div className="bg-surface/5 border border-white/10 backdrop-blur-md px-10 py-6 rounded-[2rem] flex flex-col items-center">
                        <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Year Level</p>
                        <p className="text-2xl font-mono font-bold text-white leading-none">{yearLevelLabel(profile.yearLevel)}</p>
                      </div>
                      {enrollmentStatusLabel && (
                        <div className="bg-surface/5 border border-white/10 backdrop-blur-md px-10 py-6 rounded-[2rem] flex flex-col items-center">
                          <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Enrollment Status</p>
                          <p
                            className={cn(
                              'text-sm font-bold uppercase tracking-widest',
                              isEnrolledThisTerm ? 'text-emerald-300' : 'text-amber-300'
                            )}
                          >
                            {enrollmentStatusLabel}
                          </p>
                        </div>
                      )}
                    </>
                  )}
               </div>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
         {/* Detailed Sections */}
         <div className="lg:col-span-8 bg-surface rounded-[3rem] p-12 pb-14 border border-border shadow-sm space-y-16">
            <ProfileSection
              title={isRegistrar ? 'Administrative Context' : isProfessor ? 'Faculty Context' : 'Scholastic Context'}
              items={
                isRegistrar
                  ? [
                      { label: 'Semester (Term)', value: academicTerm, icon: Calendar },
                      { label: 'Academic Year', value: academicYear, icon: Calendar },
                      { label: 'Registration Status', value: 'System operator', icon: ShieldCheck },
                    ]
                  : isProfessor
                    ? [
                        { label: 'Semester (Term)', value: academicTerm, icon: Calendar },
                        { label: 'Academic Year', value: academicYear, icon: Calendar },
                        { label: 'Registration Status', value: 'Active faculty', icon: ShieldCheck },
                        {
                          label: 'Sections',
                          value: <SectionChips sections={professorSections} />,
                          icon: BookOpen,
                          wide: true,
                        },
                      ]
                    : [
                        { label: 'Semester (Term)', value: academicTerm, icon: Calendar },
                        { label: 'Academic Year', value: academicYear, icon: Calendar },
                        {
                          label: 'Program',
                          value: profile.program || '—',
                          icon: GraduationCap,
                        },
                        { label: 'Section', value: profile.section || '—', icon: BookOpen },
                        { label: 'Year Level', value: yearLevelLabel(profile.yearLevel), icon: Award },
                        {
                          label: 'Enrollment Status',
                          value: enrollmentStatusLabel ?? '—',
                          icon: ShieldCheck,
                        },
                        {
                          label: 'Enrollment Capacity',
                          value: `${profile.maxUnits ?? 30} units max`,
                          icon: ShieldCheck,
                        },
                      ]
              }
            />

            <ProfileSection
              title="Contact & Profile"
              items={[
                { label: 'Display Name', value: `${profile.firstName} ${profile.surname}`, icon: User },
                { label: 'Address', value: profile.address || '—', icon: MapPin },
                { label: 'Contact', value: profile.contact || '—', icon: Phone },
                {
                  label: 'CampusLink Email',
                  value: campusAuthEmail(profile.studentId),
                  icon: Mail,
                  email: true,
                  wide: true,
                },
              ]}
            />
         </div>

         <div className="lg:col-span-4 space-y-6">
            <div className="bg-surface p-8 rounded-[2.5rem] border border-border">
               <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-6 text-center">Identity Management</h3>
               <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm((v) => !v)}
                    className="w-full flex items-center justify-between p-4 bg-background rounded-xl group hover:bg-primary hover:text-white transition-all"
                  >
                     <span className="text-[10px] font-bold uppercase tracking-widest">Change Password</span>
                     <ArrowRight size={14} />
                  </button>
                  {showPasswordForm && (
                    <div className="space-y-3 p-4 bg-background rounded-xl">
                      <input
                        type="password"
                        placeholder="Current password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                      />
                      <input
                        type="password"
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                      />
                      <input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border text-sm"
                      />
                      <button
                        type="button"
                        disabled={updating}
                        onClick={handlePasswordUpdate}
                        className="w-full bg-primary text-white py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest"
                      >
                        {updating ? 'Saving...' : 'Save password'}
                      </button>
                    </div>
                  )}
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-between p-4 bg-rose-50 rounded-xl group hover:bg-rose-500 hover:text-white transition-all"
                  >
                     <div className="flex items-center gap-3">
                        <LogOut size={14} className="text-rose-500 group-hover:text-white" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600 group-hover:text-white">Terminate Session</span>
                     </div>
                  </button>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
