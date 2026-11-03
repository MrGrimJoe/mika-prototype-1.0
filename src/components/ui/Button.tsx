import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-[13px] gap-1.5',
    md: 'px-4 py-2 text-sm gap-2 min-h-9',
    lg: 'px-5 py-2.5 text-base gap-2.5 min-h-11'
  }[size];

  const variantStyles = {
    primary: 'bg-accent text-white border border-accent shadow-xs hover:bg-accent-strong hover:border-accent-strong active:scale-[0.98] disabled:bg-edge disabled:border-edge disabled:shadow-none',
    secondary: 'bg-surface text-ink border border-hairline shadow-2xs hover:bg-paper-raised active:scale-[0.98] disabled:opacity-50',
    ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-paper-raised hover:text-ink disabled:opacity-40',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50'
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center font-medium rounded-xs transition-[background-color,border-color,transform,box-shadow] whitespace-nowrap cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${sizeStyles} ${variantStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
