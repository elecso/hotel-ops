import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-[#E5E2D8] bg-white px-3 py-2 text-sm text-[#3D1640]',
        'placeholder:text-[#B0A5B4] transition-colors resize-none',
        'focus:outline-none focus:ring-2 focus:ring-[#602460]/30 focus:border-[#602460]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'
export { Textarea }
