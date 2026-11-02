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
    flat: 'bg-paper border-hairline',
    raised: 'bg-paper-raised border-hairline shadow-xs',
    sunken: 'bg-paper-sunken border-hairline',
    ledger: 'bg-paper border-hairline bg-ledger-grid'
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
