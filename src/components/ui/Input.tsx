import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  className?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-[#5C574B]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        className={`w-full px-3 py-2 text-sm bg-white text-[#1C2438] border rounded-xs placeholder-[#8A8578] transition-colors focus:outline-none focus:border-[#2F3B7A] focus:ring-1 focus:ring-[#2F3B7A] ${
          error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : 'border-[#DAD5C9]'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-[#8A8578]">{helperText}</p>}
    </div>
  );
});

Input.displayName = 'Input';
