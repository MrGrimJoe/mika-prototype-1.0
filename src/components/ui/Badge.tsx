import React from 'react';
import { taskStateColors, TaskStatusKey } from '../../lib/designSystem';

export interface BadgeProps {
  status?: TaskStatusKey;
  variant?: TaskStatusKey;
  label?: string;
  showDot?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  variant,
  label,
  showDot = false,
  className = '',
  children
}) => {
  const resolvedKey = (variant || status || 'pending') as TaskStatusKey;
  const config = taskStateColors[resolvedKey] || taskStateColors.pending;
  const displayLabel = label || config.label;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xs text-xs font-mono font-medium border whitespace-nowrap ${className}`}
      style={{
        color: config.text,
        backgroundColor: config.bg,
        borderColor: config.border
      }}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: config.dot }}
        />
      )}
      {children || <span>{displayLabel}</span>}
    </span>
  );
};
