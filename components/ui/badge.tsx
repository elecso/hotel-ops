import * as React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'mercure' | 'ibis' | 'pending' | 'validated' | 'rejected' | 'meeting' | 'banqueting' | 'event' | 'admin' | 'manager' | 'staff' | 'readonly' | 'default'

const variantClasses: Record<BadgeVariant, string> = {
  mercure:    'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  ibis:       'bg-rose-500/20 text-rose-300 border border-rose-500/30',
  pending:    'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  validated:  'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  rejected:   'bg-red-500/15 text-red-400 border border-red-500/25',
  meeting:    'bg-sky-500/15 text-sky-400 border border-sky-500/25',
  banqueting: 'bg-violet-500/15 text-violet-400 border border-violet-500/25',
  event:      'bg-orange-500/15 text-orange-400 border border-orange-500/25',
  admin:      'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
  manager:    'bg-sky-500/15 text-sky-400 border border-sky-500/25',
  staff:      'bg-white/5 text-[#9095a8] border border-white/10',
  readonly:   'bg-white/5 text-[#55596a] border border-white/8',
  default:    'bg-white/5 text-[#9095a8] border border-white/10',
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
