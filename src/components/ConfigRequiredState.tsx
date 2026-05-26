import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Database } from 'lucide-react';

export default function ConfigRequiredState({ title = 'Academic term not configured' }: { title?: string }) {
  const { isAdmin } = useAuth();

  return (
    <div className="max-w-lg mx-auto py-24 px-6 text-center">
      <Database className="mx-auto text-brand-gold mb-6" size={40} />
      <h2 className="text-xl font-display font-bold text-brand-blue mb-3">{title}</h2>
      <p className="text-sm text-slate-500 mb-8 leading-relaxed">
        The system calendar has not been initialized. A registrar must run setup before
        enrollment, grades, and term filters can work.
      </p>
      {isAdmin ? (
        <Link
          to="/admin?tab=system"
          className="inline-block bg-brand-blue text-white px-8 py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest"
        >
          Open system tools
        </Link>
      ) : (
        <Link
          to="/login"
          className="inline-block bg-brand-blue text-white px-8 py-4 rounded-xl font-bold text-[10px] uppercase tracking-widest"
        >
          Return to login
        </Link>
      )}
    </div>
  );
}
