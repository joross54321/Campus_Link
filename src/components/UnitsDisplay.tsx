import React from 'react';
import { cn } from '../lib/utils';
import { unitWord } from '../lib/unitsDisplay';

/** Large numeric credit with a separate units label (no "3u" suffix). */
export function UnitValue({
  value,
  size = 'md',
  className,
  labelClassName,
}: {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  labelClassName?: string;
}) {
  const sizes = {
    sm: { num: 'text-lg', label: 'text-[8px]' },
    md: { num: 'text-2xl', label: 'text-[9px]' },
    lg: { num: 'text-4xl', label: 'text-[10px]' },
  };
  const s = sizes[size];

  return (
    <div className={cn('inline-flex flex-col items-end leading-none', className)}>
      <span className={cn('font-mono font-bold tabular-nums text-inherit', s.num)}>
        {value}
      </span>
      <span
        className={cn(
          'font-bold uppercase tracking-[0.2em] text-muted-foreground mt-1',
          s.label,
          labelClassName
        )}
      >
        {unitWord(value)}
      </span>
    </div>
  );
}

/** Compact inline: `3` + muted `units`. */
export function UnitInline({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 tabular-nums', className)}>
      <span className="font-mono font-bold">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {unitWord(value)}
      </span>
    </span>
  );
}

/** Table header for credit columns. */
export function UnitsColumnHeader({ className }: { className?: string }) {
  return (
    <span className={cn('text-[9px] font-bold uppercase tracking-widest text-muted-foreground', className)}>
      Units
    </span>
  );
}
