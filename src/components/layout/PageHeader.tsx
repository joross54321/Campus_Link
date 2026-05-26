import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { getHomePathForRole } from '../../lib/authRoutes';
import { useScreenFeedback } from '../../contexts/ScreenFeedbackContext';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  badge?: string;
  showBack?: boolean;
  /** Triggers a light screen wobble when navigating back */
  feedbackOnBack?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  backTo,
  badge,
  showBack = true,
  feedbackOnBack = false,
  className,
  children,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { triggerFeedback } = useScreenFeedback();

  const handleBack = () => {
    if (feedbackOnBack) triggerFeedback('navigate');
    if (backTo) {
      navigate(backTo);
    } else {
      navigate(getHomePathForRole(profile?.role));
    }
  };

  return (
    <div className={cn('flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 min-w-0', className)}>
      <div className="flex items-center gap-6 min-w-0 flex-1">
        {showBack && (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="w-11 h-11 bg-surface border border-border rounded-xl flex items-center justify-center text-primary hover:text-accent hover:border-accent/30 transition-all shadow-sm group shrink-0"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
          </button>
        )}
        <div className="min-w-0">
          {badge && (
            <div className="bg-accent/10 text-accent px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border border-accent/20 mb-2 w-fit">
              {badge}
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-display font-bold text-primary tracking-tight break-words">
            {title}
          </h1>
          {subtitle && (
            <p className="text-muted text-sm mt-1 truncate" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
