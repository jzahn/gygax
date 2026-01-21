import * as React from 'react'
import { cn } from '@/lib/utils'

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  ornate?: boolean
}

const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  ({ className, ornate = true, children, ...props }, ref) => {
    if (ornate && children) {
      return (
        <div
          ref={ref}
          className={cn('divider-ornate my-6 text-ink-faded text-sm', className)}
          {...props}
        >
          {children}
        </div>
      )
    }

    if (ornate) {
      return (
        <div
          ref={ref}
          className={cn(
            'my-6 h-px w-full bg-gradient-to-r from-transparent via-ink to-transparent',
            className
          )}
          {...props}
        />
      )
    }

    return (
      <hr
        ref={ref as React.Ref<HTMLHRElement>}
        className={cn('my-6 border-t border-ink', className)}
        {...props}
      />
    )
  }
)
Divider.displayName = 'Divider'

export { Divider }
