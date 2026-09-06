import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'flat' | 'raised' | 'sunken' | 'ledger';
  children: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  variant = 'flat',
  children,
  className = '',
  ...props
}) => {
  const variantStyles = {
    flat: 'bg-[#F7F5F0] border-[#DAD5C9]',
    raised: 'bg-[#EFEBE2] border-[#DAD5C9] shadow-xs',
    sunken: 'bg-[#E8E4DA] border-[#DAD5C9]',
    ledger: 'bg-[#F7F5F0] border-[#DAD5C9] bg-ledger-grid'
  }[variant];

  return (
    <div
      className={`border rounded-xs p-4 sm:p-5 transition-colors ${variantStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
