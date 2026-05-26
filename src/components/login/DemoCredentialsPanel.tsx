import { useState } from 'react';
import { ChevronDown, ChevronUp, KeyRound } from 'lucide-react';
import { motion } from 'motion/react';
import { getFullDemoCredentials, getRegistrarCredential, type DemoCredential } from '../../lib/accountCredentials';

function CredentialTable({ rows, title }: { rows: DemoCredential[]; title: string }) {
  if (rows.length === 0) return null;
  return (
    <motion.div className="mt-3" initial={false}>
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">{title}</p>
      <motion.div className="overflow-x-auto rounded-lg border border-slate-200/80">
        <table className="w-full text-left text-[10px]">
          <thead>
            <tr className="bg-slate-50 text-slate-500">
              <th className="px-2 py-1.5 font-bold">ID</th>
              <th className="px-2 py-1.5 font-bold">Password</th>
              <th className="px-2 py-1.5 font-bold">Role</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-2 py-1.5 font-mono text-brand-blue">{r.id}</td>
                <td className="px-2 py-1.5 font-mono">{r.password}</td>
                <td className="px-2 py-1.5 capitalize text-slate-600">{r.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </motion.div>
  );
}

/** Dev-only reference for demo logins (see ACCOUNT_CREDENTIALS.md). */
export default function DemoCredentialsPanel() {
  const [open, setOpen] = useState(false);
  const registrar = getRegistrarCredential();
  const demoAccounts = getFullDemoCredentials().filter((c) => c.role !== 'registrar');

  return (
    <div className="mt-8 w-full max-w-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:border-brand-gold/50 hover:text-brand-blue"
      >
        <span className="flex items-center gap-2">
          <KeyRound size={14} />
          Demo credentials
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] text-slate-500 leading-relaxed">
            Passwords follow surname rules (pad with <span className="font-mono">1</span> if under 6 chars).
            See <span className="font-mono">ACCOUNT_CREDENTIALS.md</span>.
          </p>
          <CredentialTable rows={[registrar]} title="Registrar" />
          <CredentialTable rows={demoAccounts} title="Included in Initialize" />
        </div>
      )}
    </div>
  );
}
