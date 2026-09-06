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
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5'
  }[size];

  const variantStyles = {
    primary: 'bg-[#1C2438] text-[#F7F5F0] border border-[#1C2438] hover:bg-[#2F3B7A] hover:border-[#2F3B7A] disabled:bg-[#8A8578] disabled:border-[#8A8578]',
    secondary: 'bg-[#EFEBE2] text-[#1C2438] border border-[#DAD5C9] hover:bg-[#E8E4DA] hover:border-[#8A8578] disabled:opacity-50',
    ghost: 'bg-transparent text-[#5C574B] border border-transparent hover:bg-[#EFEBE2] hover:text-[#1C2438] disabled:opacity-40',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 disabled:opacity-50'
  }[variant];

  return (
    <button
      className={`inline-flex items-center justify-center font-medium rounded-xs transition-colors whitespace-nowrap cursor-pointer disabled:cursor-not-allowed ${sizeStyles} ${variantStyles} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};
