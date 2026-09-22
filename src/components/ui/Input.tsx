import { forwardRef, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className = '', ...rest },
  ref,
) {
  const inputId = id || rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink-soft">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`h-11 w-full rounded-lg border bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-mp focus:ring-2 focus:ring-mp/20 ${
          error ? 'border-bad' : 'border-line'
        } ${className}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-bad">{error}</p>}
    </div>
  );
});