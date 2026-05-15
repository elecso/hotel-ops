'use client'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import type { Event } from '@/lib/types'

const MEETING_KW  = ['ROUEN','DEAUVILLE','HONFLEUR','VEULES LES ROSES','ETRETAT','FECAMP','JUMIEGES','GIVERNY','HOULGATE','OUISTREAM','CABOURG','CINE LOUNGE']
const BANQUET_KW  = ['RESTO','PRESTIGE','PATIO','ESPACE REPAS IBIS','ROUEN']
const ROOMS_KW    = ['CHAMBRES MERCURE','CHAMBRES IBIS']

type Category = 'meeting' | 'banqueting' | 'rooms'

function categorize(ev: Event): Category | null {
  const r = (ev.room ?? ev.event_name ?? '').toUpperCase()
  if (ROOMS_KW.some(k => r.includes(k)))   return 'rooms'
  if (BANQUET_KW.some(k => r.includes(k))) return 'banqueting'
  if (MEETING_KW.some(k => r.includes(k))) return 'meeting'
  return null
}

const COL: Record<Category, { label: string; color: string; bg: string; border: string }> = {
  meeting:    { label: 'Meetings',    color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  banqueting: { label: 'Banqueting',  color: '#9333ea', bg: '#faf5ff', border: '#e9d5ff' },
  rooms:      { label: 'Rooms',       color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
}
const CATS: Category[] = ['meeting', 'banqueting', 'rooms']

function EventCard({ ev }: { ev: Event }) {
  return (
    <div className="rounded-md border border-[#E5E2D8] bg-white px-3 py-2 text-xs space-y-0.5">
      <p className="font-semibold text-[#3D1640] truncate">{ev.event_name}</p>
      {ev.room && <p className="text-[#B0A5B4] truncate">{ev.room}</p>}
      {ev.persons && <p className="text-[#7B6B80]">{ev.persons}</p>}
    </div>
  )
}

function Column({ cat, events }: { cat: Category; events: Event[] }) {
  const cfg = COL[cat]
  return (
    <div className="flex-1 min-w-0">
      <div
        className="rounded-t-lg px-3 py-2 text-xs font-bold uppercase tracking-wide"
        style={{ background: cfg.bg, color: cfg.color, borderBottom: `2px solid ${cfg.border}` }}
      >
        {cfg.label}
        {events.length > 0 && (
          <span className="ml-2 rounded-full px-1.5 py-0 text-[10px]" style={{ background: cfg.color, color: '#fff' }}>
            {events.length}
          </span>
        )}
      </div>
      <div
        className="rounded-b-lg p-2 space-y-1.5 min-h-[60px]"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderTop: 'none' }}
      >
        {events.length === 0
          ? <p className="text-[10px] text-[#C5C0B1] py-2 text-center">—</p>
          : events.map(ev => <EventCard key={ev.id} ev={ev} />)
        }
      </div>
    </div>
  )
}

interface Props {
  today: string
  events: Event[]
}

export function MeetingClient({ today, events }: Props) {
  // Group events by date
  const byDate: Record<string, Event[]> = {}
  for (const ev of events) {
    if (!byDate[ev.event_date]) byDate[ev.event_date] = []
    byDate[ev.event_date].push(ev)
  }

  const todayEvents = byDate[today] ?? []
  const forecastDates = Object.keys(byDate).sort().filter(d => d !== today)

  // All 7 dates (today + next 6)
  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(Date.parse(today) + i * 86400000).toISOString().slice(0, 10))
  }

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: '#C5C0B1' }}>Programme</p>
        <h2 className="text-2xl font-bold capitalize" style={{ color: '#602460' }}>
          Meetings & Événements
        </h2>
      </div>

      {/* Today */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle>Aujourd&apos;hui</CardTitle>
            <Badge variant="default" className="text-[10px]">
              {formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {CATS.map(cat => (
              <Column
                key={cat}
                cat={cat}
                events={todayEvents.filter(ev => categorize(ev) === cat)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 7-day forecast */}
      <Card>
        <CardHeader>
          <CardTitle>Prévisions — 7 prochains jours</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Column headers */}
          <div className="grid grid-cols-[120px_1fr_1fr_1fr] border-b border-[#E5E2D8]">
            <div className="px-3 py-2 text-xs font-semibold text-[#B0A5B4] uppercase tracking-wide">Date</div>
            {CATS.map(cat => (
              <div
                key={cat}
                className="px-3 py-2 text-xs font-bold uppercase tracking-wide"
                style={{ color: COL[cat].color }}
              >
                {COL[cat].label}
              </div>
            ))}
          </div>

          {dates.slice(1).map((date, i) => {
            const dayEvents = byDate[date] ?? []
            const isWeekend = [0, 6].includes(new Date(date).getDay())
            return (
              <div
                key={date}
                className={`grid grid-cols-[120px_1fr_1fr_1fr] border-b border-[#E5E2D8] ${isWeekend ? 'bg-[#F4F2ED]/60' : ''}`}
              >
                <div className="px-3 py-2 text-xs font-medium text-[#3D1640] self-start pt-3">
                  <p className="font-semibold capitalize">{formatDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                </div>
                {CATS.map(cat => {
                  const catEvents = dayEvents.filter(ev => categorize(ev) === cat)
                  return (
                    <div key={cat} className="px-2 py-2 space-y-1">
                      {catEvents.length === 0
                        ? <p className="text-[10px] text-[#E5E2D8] py-1">—</p>
                        : catEvents.map(ev => (
                          <div key={ev.id} className="text-[11px] rounded px-2 py-1" style={{ background: COL[cat].bg, border: `1px solid ${COL[cat].border}` }}>
                            <p className="font-semibold text-[#3D1640] truncate">{ev.event_name}</p>
                            {ev.room && <p style={{ color: COL[cat].color }} className="truncate">{ev.room}</p>}
                            {ev.persons && <p className="text-[#7B6B80]">{ev.persons}</p>}
                          </div>
                        ))
                      }
                    </div>
                  )
                })}
              </div>
            )
          })}

          {dates.slice(1).every(d => !(byDate[d]?.length)) && (
            <p className="text-center text-sm text-[#B0A5B4] py-8">Aucun événement prévu pour les 7 prochains jours.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
