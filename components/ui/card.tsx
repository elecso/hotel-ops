import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hotel?: 'mercure' | 'ibis' | 'neutral'
}

export function Card({ className, hotel, ...props }: CardProps) {
  const borderColor = hotel === 'mercure' ? 'border-t-[#602460]' : hotel === 'ibis' ? 'border-t-[#E8003D]' : ''
  const borderTop = hotel ? 'border-t-4' : ''
  return (
    <div
      className={cn(
        'bg-white rounded-[10px] border border-[#C5C0B1]',
        borderTop, borderColor, className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4 border-b border-[#C5C0B1]', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold text-[#3D1640]', className)} {...props} />
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}

interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  hotel?: 'mercure' | 'ibis' | 'neutral'
  icon?: React.ReactNode
  compact?: boolean
}

export function MetricCard({ label, value, sub, hotel = 'neutral', compact }: MetricCardProps) {
  const styles = {
    mercure: {
      wrapper: 'bg-white border-l-4 border-l-[#602460] border border-[#C5C0B1] rounded-[10px]',
      value: 'text-[#602460]',
    },
    ibis: {
      wrapper: 'bg-[#FDEAEF] border-l-4 border-l-[#E8003D] border border-[#C5C0B1] rounded-[10px]',
      value: 'text-[#E8003D]',
    },
    neutral: {
      wrapper: 'bg-[#DFDBCF] border-l-4 border-l-[#C5C0B1] border border-[#C5C0B1] rounded-[10px]',
      value: 'text-[#3D1640]',
    },
  }
  const s = styles[hotel]
  return (
    <div className={`${s.wrapper} ${compact ? 'px-3 py-2.5' : 'px-5 py-4'}`}>
      <p className={`font-medium text-[#602460] uppercase tracking-wide mb-0.5 ${compact ? 'text-[10px]' : 'text-xs mb-1'}`}>{label}</p>
      <p className={`font-bold font-mono ${s.value} ${compact ? 'text-lg' : 'text-2xl'}`}>{value}</p>
      {sub && <p className={`text-gray-500 mt-0.5 ${compact ? 'text-[10px]' : 'text-xs mt-1'}`}>{sub}</p>}
    </div>
  )
}
