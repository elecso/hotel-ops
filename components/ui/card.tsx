import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hotel?: 'mercure' | 'ibis' | 'neutral'
}

export function Card({ className, hotel, ...props }: CardProps) {
  const accent = hotel === 'mercure' ? 'border-t-[#602460]' : hotel === 'ibis' ? 'border-t-rose-500' : ''
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-[#E5E2D8] shadow-sm',
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
      className={cn('px-5 py-4 border-b border-[#E5E2D8] flex items-center justify-between', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-[15px] font-semibold text-[#3D1640] leading-none', className)} {...props} />
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
  color?: 'purple' | 'green' | 'amber' | 'sky' | 'rose' | 'default'
}

const colorMap = {
  purple:  { bg: '#F2EBF2', border: '#602460', text: '#602460' },
  green:   { bg: '#f0fdf4', border: '#16a34a', text: '#15803d' },
  amber:   { bg: '#fffbeb', border: '#d97706', text: '#b45309' },
  sky:     { bg: '#f0f9ff', border: '#0284c7', text: '#0369a1' },
  rose:    { bg: '#fff1f2', border: '#e11d48', text: '#be123c' },
  default: { bg: '#FAFAF8', border: '#E5E2D8', text: '#7B6B80' },
}

export function MetricCard({ label, value, sub, hotel, compact, color = 'default' }: MetricCardProps) {
  const c = hotel === 'mercure' ? colorMap.purple :
            hotel === 'ibis'    ? colorMap.rose :
            (colorMap[color] ?? colorMap.default)
  return (
    <div
      className={`rounded-xl border-l-[3px] ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}
      style={{ background: c.bg, borderColor: c.border, borderWidth: '1px', borderLeftWidth: '3px' }}
    >
      <p className={`uppercase tracking-wider font-medium ${compact ? 'text-[10px] mb-1' : 'text-xs mb-2'}`} style={{ color: c.text }}>
        {label}
      </p>
      <p className={`font-bold font-mono ${compact ? 'text-xl' : 'text-2xl'}`} style={{ color: c.border }}>
        {value}
      </p>
      {sub && <p className={`${compact ? 'text-[10px] mt-0.5' : 'text-xs mt-1'}`} style={{ color: '#B0A5B4' }}>{sub}</p>}
    </div>
  )
}
