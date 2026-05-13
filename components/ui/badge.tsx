import * as React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'mercure' | 'ibis' | 'pending' | 'validated' | 'rejected' | 'meeting' | 'banqueting' | 'event' | 'admin' | 'manager' | 'staff' | 'readonly' | 'default'

const variantClasses: Record<BadgeVariant, string> = {
  mercure:    'bg-[#602460] text-white',
  ibis:       'bg-[#E8003D] text-white',
  pending:    'bg-amber-100 text-amber-700',
  validated:  'bg-green-100 text-green-700',
  rejected:   'bg-red-100 text-red-700',
  meeting:    'bg-[#602460] text-white',
  banqueting: 'bg-[#DFDBCF] text-[#3D1640]',
  event:      'bg-[#E8003D] text-white',
  admin:      'bg-[#3D1640] text-white',
  manager:    'bg-[#602460] text-white',
  staff:      'bg-[#DFDBCF] text-[#3D1640]',
  readonly:   'bg-gray-100 text-gray-600',
  default:    'bg-[#DFDBCF] text-[#3D1640]',
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
