import * as React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'mercure' | 'ibis' | 'pending' | 'validated' | 'rejected' | 'meeting' | 'banqueting' | 'event' | 'admin' | 'manager' | 'staff' | 'readonly' | 'default'

const variantClasses: Record<BadgeVariant, string> = {
  mercure:    'bg-[#602460]/12 text-[#602460] border border-[#602460]/25',
  ibis:       'bg-rose-100 text-rose-700 border border-rose-200',
  pending:    'bg-amber-100 text-amber-700 border border-amber-200',
  validated:  'bg-green-100 text-green-700 border border-green-200',
  rejected:   'bg-red-100 text-red-700 border border-red-200',
  meeting:    'bg-sky-100 text-sky-700 border border-sky-200',
  banqueting: 'bg-violet-100 text-violet-700 border border-violet-200',
  event:      'bg-orange-100 text-orange-700 border border-orange-200',
  admin:      'bg-[#602460]/12 text-[#602460] border border-[#602460]/25',
  manager:    'bg-sky-100 text-sky-700 border border-sky-200',
  staff:      'bg-gray-100 text-gray-600 border border-gray-200',
  readonly:   'bg-gray-50 text-gray-500 border border-gray-100',
  default:    'bg-gray-100 text-gray-600 border border-gray-200',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide',
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
