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
        <label htmlFor={inputId} className="block text-xs font-medium text-ink-2">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={inputId && (error || helperText) ? `${inputId}-hint` : undefined}
        ref={ref}
        className={`w-full px-3 py-2 text-sm bg-surface text-ink border rounded-xs placeholder-ink-3 transition-colors focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent ${
          error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500' : 'border-hairline'
        } ${className}`}
        {...props}
      />
      {error && <p id={inputId ? `${inputId}-hint` : undefined} role="alert" className="text-xs text-rose-700 font-medium">{error}</p>}
      {!error && helperText && <p id={inputId ? `${inputId}-hint` : undefined} className="text-xs text-ink-3">{helperText}</p>}
    </div>
  );
});

Input.displayName = 'Input';
