import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-[6px] border border-[#252548] bg-[#0e0e24] px-3 py-1 text-sm text-[#e2e2f0] placeholder:text-[#4a4a6a] transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-[#a855f7] focus:border-[#a855f7]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = 'Input'
export { Input }
