import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-[#E5E2D8] bg-white px-3 py-1 text-sm text-[#3D1640]',
        'placeholder:text-[#B0A5B4] transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-[#602460]/30 focus:border-[#602460]',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-[#F4F2ED]',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = 'Input'
export { Input }
