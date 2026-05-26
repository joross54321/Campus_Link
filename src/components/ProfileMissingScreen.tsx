import { Link } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { AlertTriangle, LogOut } from 'lucide-react';

export default function ProfileMissingScreen() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-brand-blue px-6">
      <div className="max-w-md w-full bg-white rounded-3xl p-10 text-center shadow-2xl">
        <AlertTriangle className="mx-auto text-brand-gold mb-6" size={40} />
        <h1 className="text-xl font-display font-bold text-brand-blue mb-3">Profile not found</h1>
        <p className="text-sm text-slate-500 mb-8 leading-relaxed">
          You are signed in, but there is no campus profile linked to this account. Ask the
          registrar to provision you, or run system setup on a fresh database.
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => void auth.signOut()}
            className="w-full inline-flex items-center justify-center gap-2 bg-brand-blue text-white py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest"
          >
            <LogOut size={16} />
            Sign out
          </button>
          <Link
            to="/login"
            className="w-full py-4 rounded-xl border border-slate-200 text-brand-blue font-bold text-[10px] uppercase tracking-widest block text-center"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
