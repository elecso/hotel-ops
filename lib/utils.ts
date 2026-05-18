import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('fr-FR', opts ?? { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function formatPct(value: number): string {
  return `${value?.toFixed(1) ?? '—'}%`
}

export function currentMonth(): string {
  return isoDate(new Date()).slice(0, 8) + '01'
}

export function monthLabel(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function getWeekStart(date: Date = new Date()): Date {
  // Resolve to the Paris local date first to avoid UTC-server offset issues
  const localStr = isoDate(date)
  const [y, m, d] = localStr.split('-').map(Number)
  const local = new Date(y, m - 1, d)
  const day = local.getDay()
  const diff = day === 0 ? -6 : 1 - day
  local.setDate(local.getDate() + diff)
  return local
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function isoDate(date: Date): string {
  // Use Paris local date — avoids UTC-server returning yesterday for French users
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' })
}
