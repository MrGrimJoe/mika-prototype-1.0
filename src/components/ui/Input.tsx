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
        aria-invalid={error ? true : undefined}
        aria-describedby={inputId && (error || helperText) ? `${inputId}-hint` : undefined}
        ref={ref}
        className={`w-full px-3 py-2 text-sm bg-white text-[#1C2438] border rounded-xs placeholder-[#6B665A] transition-colors focus:outline-none focus:border-[#2F3B7A] focus:ring-1 focus:ring-[#2F3B7A] ${
          error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : 'border-[#DAD5C9]'
        } ${className}`}
        {...props}
      />
      {error && <p id={inputId ? `${inputId}-hint` : undefined} role="alert" className="text-xs text-rose-700 font-medium">{error}</p>}
      {!error && helperText && <p id={inputId ? `${inputId}-hint` : undefined} className="text-xs text-[#6B665A]">{helperText}</p>}
    </div>
  );
});

Input.displayName = 'Input';
