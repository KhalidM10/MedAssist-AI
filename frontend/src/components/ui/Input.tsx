import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '../../lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[12px] font-medium uppercase tracking-wider"
            style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 w-full border px-3 text-[14px] transition-colors',
            'focus:outline-none focus:ring-1',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error
              ? 'border-danger focus:ring-danger focus:border-danger'
              : 'border-border focus:ring-brand focus:border-brand',
            className,
          )}
          style={{
            borderRadius: 4,
            backgroundColor: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-body)',
          }}
          {...props}
        />
        {error && (
          <p className="text-[12px]" style={{ color: 'var(--color-danger)', fontFamily: 'var(--font-body)' }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-[12px]" style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-body)' }}>
            {hint}
          </p>
        )}
      </div>
    )
  },
)

Input.displayName = 'Input'
