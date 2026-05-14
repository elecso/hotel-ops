import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hotel?: 'mercure' | 'ibis' | 'neutral'
}

export function Card({ className, hotel, ...props }: CardProps) {
  const borderColor = hotel === 'mercure' ? 'border-t-[#a855f7]' : hotel === 'ibis' ? 'border-t-[#f43f5e]' : ''
  const borderTop = hotel ? 'border-t-4' : ''
  return (
    <div
      className={cn(
        'bg-[#14142b] rounded-[10px] border border-[#252548]',
        borderTop, borderColor, className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4 border-b border-[#252548]', className)} {...props} />
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold text-[#e2e2f0]', className)} {...props} />
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
      wrapper: 'bg-[#1e1050] border-l-4 border-l-[#a855f7] border border-[#252548] rounded-[10px]',
      value: 'text-[#a855f7]',
    },
    ibis: {
      wrapper: 'bg-[#2a0a14] border-l-4 border-l-[#f43f5e] border border-[#252548] rounded-[10px]',
      value: 'text-[#f43f5e]',
    },
    neutral: {
      wrapper: 'bg-[#14142b] border-l-4 border-l-[#22d3ee] border border-[#252548] rounded-[10px]',
      value: 'text-[#22d3ee]',
    },
  }
  const s = styles[hotel]
  return (
    <div className={`${s.wrapper} ${compact ? 'px-3 py-2.5' : 'px-5 py-4'}`}>
      <p className={`font-medium text-[#8080a8] uppercase tracking-wide mb-0.5 ${compact ? 'text-[10px]' : 'text-xs mb-1'}`}>{label}</p>
      <p className={`font-bold font-mono ${s.value} ${compact ? 'text-lg' : 'text-2xl'}`}>{value}</p>
      {sub && <p className={`text-[#4a4a6a] mt-0.5 ${compact ? 'text-[10px]' : 'text-xs mt-1'}`}>{sub}</p>}
    </div>
  )
}
