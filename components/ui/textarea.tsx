import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-[#2a2d38] bg-[#13151c] px-3 py-2 text-sm text-[#f0f1f5]',
        'placeholder:text-[#55596a] transition-colors resize-none',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500',
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
