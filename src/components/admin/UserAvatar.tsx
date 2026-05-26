import React from 'react';
import { User } from 'lucide-react';
import { cn } from '../../lib/utils';

export function userInitials(user: {
  firstName?: string;
  surname?: string;
  studentId?: string;
}): string {
  const first = user.firstName?.trim();
  const last = user.surname?.trim();
  const id = user.studentId?.trim();
  const a = (first?.[0] ?? id?.[0] ?? '').toUpperCase();
  const b = (last?.[0] ?? '').toUpperCase();
  const combined = `${a}${b}`;
  return combined.length > 0 ? combined.slice(0, 2) : '';
}

export default function UserAvatar({
  user,
  size = 'md',
  className,
}: {
  user: { firstName?: string; surname?: string; studentId?: string };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    sm: 'w-12 h-12 text-sm rounded-xl',
    md: 'w-16 h-16 text-lg rounded-2xl',
    lg: 'w-24 h-24 text-2xl rounded-[2rem]',
  };
  const iconSizes = { sm: 18, md: 22, lg: 28 };
  const initials = userInitials(user);

  return (
    <div
      className={cn(
        'bg-brand-gold/15 border border-brand-gold/25 flex items-center justify-center font-display font-bold text-brand-blue shrink-0',
        sizes[size],
        className
      )}
    >
      {initials ? (
        initials
      ) : (
        <User size={iconSizes[size]} className="text-brand-blue/35" strokeWidth={1.75} />
      )}
    </div>
  );
}
