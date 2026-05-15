'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { Event } from '@/lib/types'

const MEETING_KW  = ['ROUEN','DEAUVILLE','HONFLEUR','VEULES LES ROSES','ETRETAT','FECAMP','JUMIEGES','GIVERNY','HOULGATE','OUISTREAM','CABOURG','CINE LOUNGE']
const BANQUET_KW  = ['RESTO','PRESTIGE','PATIO','ESPACE REPAS IBIS']
const ROOMS_KW    = ['CHAMBRES MERCURE','CHAMBRES IBIS']

type Category = 'meeting' | 'banqueting' | 'rooms'

function categorize(ev: Event): Category {
  const r = (ev.room ?? ev.event_name ?? '').toUpperCase()
  if (ROOMS_KW.some(k => r.includes(k)))   return 'rooms'
  if (BANQUET_KW.some(k => r.includes(k))) return 'banqueting'
  if (MEETING_KW.some(k => r.includes(k))) return 'meeting'
  return 'meeting'
}

const CAT_CFG: Record<Category, { label: string; color: string; bg: string; dot: string }> = {
  meeting:    { label: 'Meeting',     color: '#0891b2', bg: '#f0f9ff', dot: '#0ea5e9' },
  banqueting: { label: 'Banqueting',  color: '#7c3aed', bg: '#faf5ff', dot: '#a855f7' },
  rooms:      { label: 'Rooms',       color: '#15803d', bg: '#f0fdf4', dot: '#22c55e' },
}

function dayLabel(dateStr: string, short = false) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('fr-FR', short
    ? { weekday: 'short', day: 'numeric', month: 'short' }
    : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function EventPill({ ev, compact }: { ev: Event; compact?: boolean }) {
  const cat = categorize(ev)
  const cfg = CAT_CFG[cat]
  return (
    <div
      className="rounded-lg px-3 py-2 border"
      style={{ background: cfg.bg, borderColor: cfg.dot + '55' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-semibold text-[#1e1b2e] truncate ${compact ? 'text-xs' : 'text-sm'}`}>
            {ev.event_name}
          </p>
          {ev.room && (
            <p className={`truncate mt-0.5 ${compact ? 'text-[10px]' : 'text-xs'}`} style={{ color: cfg.color }}>
              {ev.room}
            </p>
          )}
        </div>
        {ev.persons > 0 && (
          <span
            className="flex-shrink-0 rounded-full px-2 py-0.5 text-white font-bold"
            style={{ background: cfg.dot, fontSize: compact ? '9px' : '11px' }}
          >
            {ev.persons} pers.
          </span>
        )}
      </div>
    </div>
  )
}

function CategoryBadge({ cat, count }: { cat: Category; count: number }) {
  const cfg = CAT_CFG[cat]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.dot}44` }}
    >
      <span className="w-2 h-2 rounded-full" style={{ background: cfg.dot }} />
      {cfg.label}
      {count > 0 && (
        <span className="rounded-full w-4 h-4 flex items-center justify-center text-white text-[10px] font-bold"
          style={{ background: cfg.dot }}>
          {count}
        </span>
      )}
    </span>
  )
}

interface Props { today: string; events: Event[] }

export function MeetingClient({ today, events }: Props) {
  const [expandedDays, setExpandedDays] = useState<string[]>([today])

  const dates: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  const byDate: Record<string, Event[]> = {}
  for (const ev of events) {
    if (!byDate[ev.event_date]) byDate[ev.event_date] = []
    byDate[ev.event_date].push(ev)
  }

  const CATS: Category[] = ['meeting', 'banqueting', 'rooms']

  const toggleDay = (d: string) =>
    setExpandedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const todayEvts = byDate[today] ?? []
  const totalToday = todayEvts.length

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page header */}
      <div>
        <p className="text-xs uppercase tracking-widest font-medium text-[#B0A5B4] mb-1">Programme</p>
        <h2 className="text-2xl font-bold text-[#602460]">Meetings & Événements</h2>
      </div>

      {/* TODAY — prominent card */}
      <div className="rounded-2xl border border-[#E5E2D8] bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-[#E5E2D8] flex items-center justify-between bg-gradient-to-r from-[#602460]/5 to-transparent">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#602460] mb-0.5">Aujourd&apos;hui</p>
            <p className="text-lg font-bold text-[#3D1640] capitalize">{dayLabel(today)}</p>
          </div>
          <div className="flex items-center gap-2">
            {totalToday === 0
              ? <Badge variant="default" className="text-xs">Aucun événement</Badge>
              : CATS.map(cat => {
                  const count = todayEvts.filter(e => categorize(e) === cat).length
                  return count > 0 ? <CategoryBadge key={cat} cat={cat} count={count} /> : null
                })
            }
          </div>
        </div>

        {totalToday === 0 ? (
          <p className="text-center text-sm text-[#C5C0B1] py-8">Journée calme — aucun événement prévu.</p>
        ) : (
          <div className="grid grid-cols-3 gap-0 divide-x divide-[#E5E2D8]">
            {CATS.map(cat => {
              const catEvts = todayEvts.filter(e => categorize(e) === cat)
              const cfg = CAT_CFG[cat]
              return (
                <div key={cat} className="px-4 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: cfg.color }}>
                    {cfg.label}
                  </p>
                  {catEvts.length === 0
                    ? <p className="text-[11px] text-[#C5C0B1] italic">—</p>
                    : <div className="space-y-2">{catEvts.map(ev => <EventPill key={ev.id} ev={ev} />)}</div>
                  }
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 7-day forecast */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[#B0A5B4] mb-3">Prévisions — 7 jours</p>
        <div className="space-y-2">
          {dates.slice(1).map(date => {
            const dayEvts = byDate[date] ?? []
            const isExpanded = expandedDays.includes(date)
            const isWeekend = [0, 6].includes(new Date(date + 'T12:00:00').getDay())
            const hasEvents = dayEvts.length > 0

            return (
              <div
                key={date}
                className={`rounded-xl border overflow-hidden transition-all ${isWeekend ? 'border-[#E8D5CC] bg-[#FFF8F6]' : 'border-[#E5E2D8] bg-white'}`}
              >
                {/* Day header — always visible, clickable */}
                <button
                  onClick={() => hasEvents && toggleDay(date)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left ${hasEvents ? 'cursor-pointer hover:bg-black/[0.02] transition-colors' : 'cursor-default'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center flex-shrink-0 ${isWeekend ? 'bg-[#FDE8E0]' : 'bg-[#F4F2ED]'}`}>
                      <span className="text-[9px] font-bold uppercase tracking-wide text-[#7B6B80]">
                        {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short' })}
                      </span>
                      <span className="text-sm font-bold text-[#3D1640] leading-none">
                        {new Date(date + 'T12:00:00').getDate()}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-[#3D1640] capitalize">
                      {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>

                  {!hasEvents ? (
                    <span className="text-[11px] text-[#C5C0B1] italic">Aucun événement</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      {CATS.map(cat => {
                        const count = dayEvts.filter(e => categorize(e) === cat).length
                        return count > 0 ? <CategoryBadge key={cat} cat={cat} count={count} /> : null
                      })}
                      <span className="text-[#B0A5B4] ml-1 text-xs">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  )}
                </button>

                {/* Expanded event details */}
                {hasEvents && isExpanded && (
                  <div className="border-t border-[#E5E2D8] grid grid-cols-3 gap-0 divide-x divide-[#E5E2D8]">
                    {CATS.map(cat => {
                      const catEvts = dayEvts.filter(e => categorize(e) === cat)
                      const cfg = CAT_CFG[cat]
                      return (
                        <div key={cat} className="px-4 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: cfg.color }}>
                            {cfg.label}
                          </p>
                          {catEvts.length === 0
                            ? <p className="text-[11px] text-[#C5C0B1] italic">—</p>
                            : <div className="space-y-1.5">{catEvts.map(ev => <EventPill key={ev.id} ev={ev} compact />)}</div>
                          }
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
