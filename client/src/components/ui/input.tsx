import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 w-full border-3 bg-parchment-100 px-4 py-2 font-input text-base shadow-brutal-sm input-brutal',
          'placeholder:font-body placeholder:italic placeholder:text-ink-ghost',
          'disabled:cursor-not-allowed disabled:bg-parchment-300 disabled:text-ink-faded',
          error ? 'border-blood-red' : 'border-ink',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
