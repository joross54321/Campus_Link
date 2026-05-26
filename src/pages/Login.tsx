import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithId, seedInitialData, ensureProfileForAuthUid } from '../services/authService';
import { db } from '../lib/firebase';
import { getDoc, doc } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import { toast } from 'react-hot-toast';
import { GraduationCap, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { getHomePathForRole } from '../lib/authRoutes';
import { allowBootstrapUi } from '../lib/bootstrapUi';
import DemoCredentialsPanel from '../components/login/DemoCredentialsPanel';
import { getRegistrarCredential } from '../lib/accountCredentials';

export default function Login() {
  const [idNumber, setIdNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [initStatus, setInitStatus] = useState<'loading' | 'needs' | 'ready' | 'unknown'>('loading');
  const navigate = useNavigate();

  /** Empty database: always offer one-time setup on login (including production). Dev-only for unknown state. */
  const showInitialize =
    initStatus === 'needs' || (allowBootstrapUi && initStatus === 'unknown');

  useEffect(() => {
    const checkInitialized = async () => {
      try {
        const configSnap = await getDoc(doc(db, 'system', 'config'));
        setInitStatus(configSnap.exists() ? 'ready' : 'needs');
      } catch (err) {
        console.error('Could not read system/config:', err);
        setInitStatus('unknown');
      }
    };
    checkInitialized();
  }, []);

  const handleSeed = async () => {
    if (!showInitialize) return;
    setSeeding(true);
    try {
      const result = await seedInitialData();
      setInitStatus('ready');
      toast.success(
        import.meta.env.DEV
          ? 'System initialized with full demo data. Log in as registrar 2026-0001-A / Admin1.'
          : 'Setup complete. You may sign in.',
        { duration: 8000 }
      );
      if (result.loginHint) {
        toast(`Demo logins (ID / password):\n${result.loginHint}`, { duration: 14000 });
      }
      if (import.meta.env.DEV) {
        const reg = getRegistrarCredential();
        setIdNumber(reg.id);
        setPassword(reg.password);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error(msg, { duration: 8000 });
    } finally {
      setSeeding(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const standardizedId = idNumber.toUpperCase().trim();

    try {
      await loginWithId(standardizedId, password.trim());
      const uid = auth.currentUser?.uid;
      if (uid) {
        try {
          await ensureProfileForAuthUid(auth.currentUser!, standardizedId);
        } catch (syncErr) {
          console.warn('Profile sync after login:', syncErr);
        }
      }
      let role: string | undefined;
      if (uid) {
        role = (await getDoc(doc(db, 'users', uid))).data()?.role as string | undefined;
      }
      if (!role) {
        role = (await getDoc(doc(db, 'users', standardizedId))).data()?.role as string | undefined;
      }
      if (!role) {
        toast.error(
          'Signed in but no campus profile was found. Ask the registrar to provision you again under Admin → Users.'
        );
        return;
      }
      toast.success('Successfully logged in!');
      navigate(getHomePathForRole(role));
    } catch (error: unknown) {
      if (initStatus === 'needs' && allowBootstrapUi) {
        toast.error('System not set up yet. Use Initialize (bottom right) once.');
      } else if (initStatus === 'needs') {
        toast.error('This portal is not ready yet. Please contact your registrar.');
      } else {
        const msg = error instanceof Error ? error.message : 'Invalid ID or password.';
        toast.error(msg, { duration: 8000 });
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className="min-h-screen bg-brand-paper flex overflow-hidden font-sans">
      <motion.div
        className="hidden lg:flex w-1/2 bg-brand-blue relative items-center justify-center p-20 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-gold rounded-full filter blur-[100px] -translate-y-1/2 translate-x-1/2" />
        </motion.div>
        <div className="relative z-10 max-w-lg">
          <div className="flex items-center gap-4 mb-12">
            <motion.div className="w-16 h-16 rounded-2xl bg-brand-gold flex items-center justify-center">
              <GraduationCap size={32} className="text-brand-blue" />
            </motion.div>
            <div>
              <h2 className="text-brand-gold font-display font-bold text-3xl">CampusLink</h2>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em] mt-1">ISAT U Portal</p>
            </div>
          </div>
          <h1 className="text-white text-6xl font-display font-medium leading-tight mb-8">
            Empowering <span className="text-brand-gold italic">Tomorrow&apos;s</span> Leaders.
          </h1>
        </div>
      </motion.div>

      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 lg:p-24 relative">
        <motion.div className="w-full max-w-sm">
          {initStatus === 'needs' && (
            <div className="mb-6 p-4 rounded-2xl bg-brand-gold/10 border border-brand-gold/30 flex items-start gap-3">
              <Sparkles className="text-brand-gold shrink-0 mt-0.5" size={16} />
              <p className="text-[11px] font-bold text-brand-blue">
                {allowBootstrapUi
                  ? 'First-time setup: use Initialize (bottom right), then sign in.'
                  : 'One-time setup required. Use Initialize (bottom right), then sign in.'}
              </p>
            </div>
          )}
          {allowBootstrapUi && initStatus === 'unknown' && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <Sparkles className="text-amber-600 shrink-0 mt-0.5" size={16} />
              <p className="text-[11px] font-bold text-brand-blue">
                Could not verify setup. Try signing in, or use Initialize if this is a new project.
              </p>
            </div>
          )}
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-brand-blue mb-8 whitespace-nowrap">
            Welcome to CampusLink
          </h2>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label
                htmlFor="id-number"
                className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1"
              >
                ID Number
              </label>
              <div className="relative">
                <input
                  id="id-number"
                  type="text"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  className="w-full px-5 py-4 bg-white border border-slate-200 rounded-xl focus:border-brand-blue outline-none font-medium"
                  required
                />
                <UserCheck size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2 ml-1">
                <label
                  htmlFor="password"
                  className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest"
                >
                  Password
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showPassword}
                    onChange={(e) => setShowPassword(e.target.checked)}
                    className="rounded border-slate-300 text-brand-blue focus:ring-brand-gold"
                  />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Show password
                  </span>
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 pr-12 bg-white border border-slate-200 rounded-xl focus:border-brand-blue outline-none font-medium"
                  required
                />
                <ShieldCheck size={18} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || initStatus === 'loading'}
              className="w-full bg-brand-blue text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Log in'}
            </button>
          </form>
          {import.meta.env.DEV && <DemoCredentialsPanel />}
        </motion.div>

        {showInitialize && (
          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="absolute bottom-8 right-8 p-3 text-slate-400 hover:text-brand-gold flex items-center gap-2"
          >
            <Sparkles size={14} className={seeding ? 'animate-spin' : ''} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              {seeding ? 'Setting up demo...' : 'Initialize'}
            </span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
