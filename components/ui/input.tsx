import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-[#2a2d38] bg-[#13151c] px-3 py-1 text-sm text-[#f0f1f5]',
        'placeholder:text-[#55596a] transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = 'Input'
export { Input }
