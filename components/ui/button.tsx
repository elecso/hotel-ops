'use client'
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0f1117] disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        default:   'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm',
        secondary: 'bg-[#22252f] text-[#f0f1f5] border border-[#363944] hover:bg-[#2a2d38] hover:border-[#454a57]',
        ghost:     'text-[#9095a8] hover:bg-[#22252f] hover:text-[#f0f1f5]',
        danger:    'bg-red-600 text-white hover:bg-red-500 shadow-sm',
        outline:   'border border-[#2a2d38] bg-transparent text-[#f0f1f5] hover:bg-[#22252f]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-7 px-3 text-xs',
        lg:      'h-10 px-5',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
