import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  error?: string;
  helperText?: string;
  className?: string;
  children?: React.ReactNode;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({
  label,
  options,
  error,
  helperText,
  className = '',
  id,
  children,
  ...props
}, ref) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label htmlFor={selectId} className="block text-xs font-medium text-ink-2">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={selectId && (error || helperText) ? `${selectId}-hint` : undefined}
        ref={ref}
        className={`w-full px-3 py-2 text-sm bg-surface text-ink border rounded-xs transition-colors focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent cursor-pointer ${
          error ? 'border-rose-400' : 'border-hairline'
        } ${className}`}
        {...props}
      >
        {options
          ? options.map(opt => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      {error && <p id={selectId ? `${selectId}-hint` : undefined} role="alert" className="text-xs text-rose-700 font-medium">{error}</p>}
      {!error && helperText && <p id={selectId ? `${selectId}-hint` : undefined} className="text-xs text-ink-3">{helperText}</p>}
    </div>
  );
});

Select.displayName = 'Select';
