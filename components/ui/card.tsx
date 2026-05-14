import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hotel?: 'mercure' | 'ibis' | 'neutral'
}

export function Card({ className, hotel, ...props }: CardProps) {
  const accent = hotel === 'mercure' ? 'border-t-indigo-500' : hotel === 'ibis' ? 'border-t-rose-500' : ''
  return (
    <div
      className={cn(
        'bg-[#1c1e26] rounded-xl border border-[#2a2d38]',
        hotel && 'border-t-2',
        accent,
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-5 py-4 border-b border-[#2a2d38] flex items-center justify-between', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-[15px] font-semibold text-[#f0f1f5] leading-none', className)} {...props} />
  )
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
  color?: 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose' | 'default'
}

const colorMap = {
  indigo:  { bg: '#1e2048', border: '#6366f1', text: '#818cf8' },
  emerald: { bg: '#052e1b', border: '#10b981', text: '#34d399' },
  amber:   { bg: '#2d1f00', border: '#f59e0b', text: '#fbbf24' },
  sky:     { bg: '#0c2340', border: '#38bdf8', text: '#7dd3fc' },
  rose:    { bg: '#2d0a14', border: '#ef4444', text: '#f87171' },
  default: { bg: '#22252f', border: '#363944', text: '#9095a8' },
}

export function MetricCard({ label, value, sub, hotel, compact, color = 'default' }: MetricCardProps) {
  const c = colorMap[color] ?? (
    hotel === 'mercure' ? colorMap.indigo :
    hotel === 'ibis'    ? colorMap.rose :
    colorMap.default
  )
  return (
    <div
      className={`rounded-xl border-l-[3px] ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}
      style={{ background: c.bg, borderColor: c.border, borderWidth: '1px', borderLeftWidth: '3px' }}
    >
      <p className={`text-[#9095a8] uppercase tracking-wider font-medium ${compact ? 'text-[10px] mb-1' : 'text-xs mb-2'}`}>
        {label}
      </p>
      <p className={`font-bold font-mono ${compact ? 'text-xl' : 'text-2xl'}`} style={{ color: c.text }}>
        {value}
      </p>
      {sub && <p className={`text-[#55596a] ${compact ? 'text-[10px] mt-0.5' : 'text-xs mt-1'}`}>{sub}</p>}
    </div>
  )
}
