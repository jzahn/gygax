import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[100px] w-full border-3 bg-parchment-100 px-4 py-3 font-input text-base shadow-brutal-sm input-brutal resize-none',
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
Textarea.displayName = 'Textarea'

export { Textarea }
