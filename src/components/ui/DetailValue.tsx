import React from 'react';
import { cn } from '../../lib/utils';

type DetailValueProps = {
  children: React.ReactNode;
  className?: string;
  truncate?: boolean;
  multiline?: boolean;
};

export function DetailValue({
  children,
  className,
  truncate,
  multiline,
}: DetailValueProps) {
  return (
    <p
      className={cn(
        'text-sm font-bold min-w-0',
        truncate && 'truncate',
        multiline && 'break-words leading-snug [overflow-wrap:anywhere]',
        !truncate && !multiline && 'break-words',
        className
      )}
      title={typeof children === 'string' ? children : undefined}
    >
      {children}
    </p>
  );
}

export function EmailValue({
  email,
  className,
  inverted,
}: {
  email: string;
  className?: string;
  inverted?: boolean;
}) {
  return (
    <a
      href={`mailto:${email}`}
      className={cn(
        'block w-full text-xs sm:text-[13px] font-mono font-semibold leading-relaxed',
        'break-all whitespace-normal',
        'hover:underline underline-offset-2',
        inverted ? 'text-white/90 hover:text-accent' : 'text-foreground hover:text-accent',
        className
      )}
      title={email}
    >
      {email}
    </a>
  );
}

export function ProfileField({
  label,
  value,
  icon: Icon,
  inverted,
  truncate,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  inverted?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 min-w-0 w-full">
      {Icon && (
        <Icon
          size={16}
          className={cn('shrink-0 mt-0.5', inverted ? 'text-accent' : 'text-primary')}
        />
      )}
      <div className="min-w-0 flex-1 overflow-hidden">
        <p
          className={cn(
            'text-[9px] font-bold uppercase tracking-[0.18em] mb-0.5',
            inverted ? 'text-white/40' : 'text-muted'
          )}
        >
          {label}
        </p>
        {typeof value === 'string' ? (
          <DetailValue
            className={inverted ? '!text-white/90' : 'text-foreground'}
            multiline={!truncate}
            truncate={truncate}
          >
            {value}
          </DetailValue>
        ) : (
          value
        )}
      </div>
    </div>
  );
}
