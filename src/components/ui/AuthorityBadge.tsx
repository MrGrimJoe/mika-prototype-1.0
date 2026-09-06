import React from 'react';
import { ShieldCheck, User } from 'lucide-react';

export interface AuthorityBadgeProps {
  isLead?: boolean;
  level?: 'master_root' | 'dept_root' | 'section_root' | 'staff';
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const AuthorityBadge: React.FC<AuthorityBadgeProps> = ({
  isLead,
  level,
  label,
  size = 'md',
  className = ''
}) => {
  const resolvedIsLead = isLead !== undefined ? isLead : (level && level !== 'staff');

  let defaultLabel = resolvedIsLead ? 'Lead' : 'Staff';
  if (level === 'master_root') defaultLabel = 'Master Root';
  else if (level === 'section_root') defaultLabel = 'Section Root';
  else if (level === 'dept_root') defaultLabel = 'Dept Root';

  const displayLabel = label || defaultLabel;

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-[10px] gap-1' 
    : 'px-2.5 py-1 text-xs gap-1.5';

  if (resolvedIsLead) {
    return (
      <span
        className={`inline-flex items-center font-medium rounded-xs border whitespace-nowrap bg-[#2F3B7A] text-white border-[#2F3B7A] ${sizeClasses} ${className}`}
      >
        <ShieldCheck className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span>{displayLabel}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-xs border whitespace-nowrap bg-[#EFEBE2] text-[#5C574B] border-[#DAD5C9] ${sizeClasses} ${className}`}
    >
      <User className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{displayLabel}</span>
    </span>
  );
};
