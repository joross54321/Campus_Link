import React from 'react';
import { History } from 'lucide-react';
import {
  adminLogActionLabel,
  type AdminActivityLog,
} from '../../lib/adminActivityLog';
import { format } from 'date-fns';

export default function AdminActivityLogPanel({
  logs,
  loading,
}: {
  logs: AdminActivityLog[];
  loading?: boolean;
}) {
  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-slate-50 flex items-center gap-3">
        <History size={18} className="text-brand-gold" />
        <div>
          <h4 className="text-sm font-display font-bold text-brand-blue uppercase tracking-widest">
            Activity log
          </h4>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            Provisioning, approvals, and other registrar actions
          </p>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
        {loading ? (
          <p className="px-8 py-10 text-center text-sm text-slate-400">Loading log…</p>
        ) : logs.length === 0 ? (
          <p className="px-8 py-10 text-center text-sm text-slate-400">
            No activity recorded yet. Provision a user to see entries here.
          </p>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} className="px-8 py-4 hover:bg-slate-50/80 transition-colors">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-gold">
                  {adminLogActionLabel(entry.action)}
                </p>
                <time className="text-[9px] font-mono text-slate-400">
                  {format(new Date(entry.createdAt), 'MMM d, yyyy · h:mm a')}
                </time>
              </div>
              <p className="text-sm font-bold text-brand-blue mt-1">{entry.details}</p>
              <p className="text-[10px] text-slate-400 mt-1">
                By {entry.actorName}
                {entry.targetId ? ` · ID ${entry.targetId}` : ''}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
