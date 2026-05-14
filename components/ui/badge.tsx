import * as React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'mercure' | 'ibis' | 'pending' | 'validated' | 'rejected' | 'meeting' | 'banqueting' | 'event' | 'admin' | 'manager' | 'staff' | 'readonly' | 'default'

const variantClasses: Record<BadgeVariant, string> = {
  mercure:    'bg-[#a855f7] text-white',
  ibis:       'bg-[#f43f5e] text-white',
  pending:    'bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/30',
  validated:  'bg-[#4ade80]/15 text-[#4ade80] border border-[#4ade80]/30',
  rejected:   'bg-[#f87171]/15 text-[#f87171] border border-[#f87171]/30',
  meeting:    'bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/30',
  banqueting: 'bg-[#fb923c]/15 text-[#fb923c] border border-[#fb923c]/30',
  event:      'bg-[#f43f5e]/15 text-[#f43f5e] border border-[#f43f5e]/30',
  admin:      'bg-[#a855f7] text-white',
  manager:    'bg-[#22d3ee]/15 text-[#22d3ee] border border-[#22d3ee]/30',
  staff:      'bg-[#252548] text-[#8080a8]',
  readonly:   'bg-[#1a1a35] text-[#4a4a6a]',
  default:    'bg-[#252548] text-[#8080a8]',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${variantClasses[variant]} ${className ?? ''}`}
      {...props}
    >
      {children}
    </span>
  )
}
