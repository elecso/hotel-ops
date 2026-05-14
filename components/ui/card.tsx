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
  purple:  { bg: '#7c3aed', border: '#6d28d9', text: 'rgba(255,255,255,0.8)', value: '#FFFFFF' },
  green:   { bg: '#16a34a', border: '#15803d', text: 'rgba(255,255,255,0.8)', value: '#FFFFFF' },
  amber:   { bg: '#d97706', border: '#b45309', text: 'rgba(255,255,255,0.8)', value: '#FFFFFF' },
  sky:     { bg: '#0284c7', border: '#0369a1', text: 'rgba(255,255,255,0.8)', value: '#FFFFFF' },
  rose:    { bg: '#e11d48', border: '#be123c', text: 'rgba(255,255,255,0.8)', value: '#FFFFFF' },
  default: { bg: '#FAFAF8', border: '#E5E2D8', text: '#7B6B80',               value: '#3D1640' },
}

const hotelColorMap = {
  mercure: { bg: '#602460', border: '#4a1a4a', text: 'rgba(255,255,255,0.8)', value: '#FFFFFF' },
  ibis:    { bg: '#e11d48', border: '#be123c', text: 'rgba(255,255,255,0.8)', value: '#FFFFFF' },
  neutral: colorMap.default,
}

export function MetricCard({ label, value, sub, hotel, compact, color = 'default' }: MetricCardProps) {
  const c = hotel === 'mercure' ? hotelColorMap.mercure :
            hotel === 'ibis'    ? hotelColorMap.ibis :
            hotel === 'neutral' ? hotelColorMap.neutral :
            (colorMap[color] ?? colorMap.default)
  return (
    <div
      className={`rounded-xl ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}
      style={{ background: c.bg, border: `1px solid ${c.border}`, borderLeft: `4px solid ${c.border}` }}
    >
      <p className={`uppercase tracking-wider font-medium ${compact ? 'text-[10px] mb-1' : 'text-xs mb-2'}`} style={{ color: c.text }}>
        {label}
      </p>
      <p className={`font-bold font-mono ${compact ? 'text-xl' : 'text-2xl'}`} style={{ color: c.value }}>
        {value}
      </p>
      {sub && <p className={`${compact ? 'text-[10px] mt-0.5' : 'text-xs mt-1'}`} style={{ color: c.text }}>{sub}</p>}
    </div>
  )
}
