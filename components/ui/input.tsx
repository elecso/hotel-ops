import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-[6px] border border-[#C5C0B1] bg-white px-3 py-1 text-sm text-[#3D1640] placeholder:text-[#A09A91] transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-[#7E3A7E] focus:border-[#7E3A7E]',
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
