import { Toaster } from 'react-hot-toast';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

const iconClass = 'shrink-0';

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        className: 'text-sm font-medium',
        success: {
          icon: <CheckCircle2 size={20} strokeWidth={2} className={`${iconClass} text-emerald-600`} />,
        },
        error: {
          icon: <XCircle size={20} strokeWidth={2} className={`${iconClass} text-rose-600`} />,
        },
        loading: {
          icon: <Info size={20} strokeWidth={2} className={`${iconClass} text-brand-blue`} />,
        },
        blank: {
          icon: <Info size={20} strokeWidth={2} className={`${iconClass} text-slate-500`} />,
        },
      }}
    />
  );
}
