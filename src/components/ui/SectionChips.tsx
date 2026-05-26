import React from 'react';
import { cn } from '../../lib/utils';

export function SectionChips({
  sections,
  inverted,
  className,
}: {
  sections: string[];
  inverted?: boolean;
  className?: string;
}) {
  if (!sections.length) {
    return <span className={cn('text-sm font-bold', inverted ? 'text-white/60' : 'text-muted')}>—</span>;
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {sections.map((section) => (
        <span
          key={section}
          className={cn(
            'inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border',
            inverted
              ? 'bg-white/10 text-white border-white/20'
              : 'bg-brand-blue/5 text-brand-blue border-brand-blue/15'
          )}
        >
          {section}
        </span>
      ))}
    </div>
  );
}
