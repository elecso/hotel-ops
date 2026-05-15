'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MetricCard } from '@/components/ui/card'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatDate, formatPct, isoDate } from '@/lib/utils'
import { CalendarDays, Plus } from 'lucide-react'
import type { DailyStat, Event, ForecastOccupancy } from '@/lib/types'

interface Props {
  selectedDate: string
  todayStats: DailyStat[]
  yesterdayStats: DailyStat[]
  todayEvents: Event[]
  forecast: ForecastOccupancy[]
}

function getStat(stats: DailyStat[], hotelId: string) {
  return stats.find(s => s.hotel_id === hotelId)
}

const CHIP = { borderRadius: 4, padding: '1px 8px', display: 'inline-block', fontWeight: 600 } as const

function occColor(pct: number | null | undefined) {
  if (pct == null) return {}
  if (pct > 75) return { ...CHIP, background: '#fee2e2', color: '#991b1b' }
  if (pct > 60) return { ...CHIP, background: '#ffedd5', color: '#9a3412' }
  if (pct > 30) return { ...CHIP, background: '#dcfce7', color: '#166534' }
  return { ...CHIP, background: '#dbeafe', color: '#1e40af' }
}

function bfColor(covers: number) {
  if (covers <= 0) return {}
  if (covers > 250) return { ...CHIP, background: '#fee2e2', color: '#991b1b' }
  if (covers > 200) return { ...CHIP, background: '#ffedd5', color: '#9a3412' }
  if (covers > 100) return { ...CHIP, background: '#dcfce7', color: '#166534' }
  return { ...CHIP, background: '#dbeafe', color: '#1e40af' }
}

const eventBadgeVariant: Record<string, 'meeting' | 'banqueting' | 'event'> = {
  meeting: 'meeting',
  banqueting: 'banqueting',
  event: 'event',
}

const EVENT_TYPES = [
  { value: 'meeting', label: 'Réunion' },
  { value: 'banqueting', label: 'Banquet' },
  { value: 'event', label: 'Événement' },
]

export function DashboardClient({ selectedDate, todayStats, yesterdayStats, todayEvents: initialEvents, forecast }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const mercureToday = getStat(todayStats, 'mercure')
  const ibisToday = getStat(todayStats, 'ibis')
  const mercureYesterday = getStat(yesterdayStats, 'mercure')
  const ibisYesterday = getStat(yesterdayStats, 'ibis')

  // Today's KPIs come from forecast_occupancy (more up-to-date than daily_stats)
  const forecastToday = forecast.filter(f => f.forecast_date === selectedDate)
  const mercureForecastToday = forecastToday.find(f => f.hotel_id === 'mercure')
  const ibisForecastToday = forecastToday.find(f => f.hotel_id === 'ibis')

  const bfMercure = mercureForecastToday?.breakfast_covers ?? mercureToday?.breakfast_covers ?? 0
  const bfIbis = ibisForecastToday?.breakfast_covers ?? ibisToday?.breakfast_covers ?? 0

  const today = isoDate(new Date())
  const dateLabel = formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Event creation state
  const [events, setEvents] = useState<Event[]>(initialEvents)
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventForm, setEventForm] = useState({ event_name: '', room: '', persons: '', type: 'meeting' })
  const [eventSaving, setEventSaving] = useState(false)

  const handleAddEvent = async () => {
    if (!eventForm.event_name) return
    setEventSaving(true)
    const { data, error } = await supabase.from('events').insert({
      event_date: selectedDate,
      event_name: eventForm.event_name,
      room: eventForm.room || null,
      persons: eventForm.persons ? parseInt(eventForm.persons) : null,
      type: eventForm.type,
    }).select().single()
    if (!error && data) {
      setEvents(prev => [...prev, data])
      setEventForm({ event_name: '', room: '', persons: '', type: 'meeting' })
      setShowEventForm(false)
    }
    setEventSaving(false)
  }

  return (
    <div className="space-y-6 max-w-full">
      {/* Header with date picker + today button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: '#C5C0B1' }}>Données du</p>
          <h2 className="text-2xl font-bold capitalize" style={{ color: '#602460' }}>
            {dateLabel}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={e => router.push(`/dashboard?date=${e.target.value}`)}
            className="h-9 px-3 rounded-[6px] border border-[#C5C0B1] bg-white text-sm text-[#3D1640] focus:outline-none focus:ring-2 focus:ring-[#7E3A7E]"
          />
          {selectedDate !== today && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/dashboard')}
              className="flex items-center gap-1.5"
            >
              <CalendarDays size={14} />
              Aujourd&apos;hui
            </Button>
          )}
        </div>
      </div>

      {/* Section 1 — Today's key figures — compact single-row */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#C5C0B1' }}>
          Chiffres clés du jour
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard
            hotel="mercure"
            label="Mercure Occ."
            value={mercureForecastToday ? formatPct(mercureForecastToday.occupancy_pct) : '—'}
          />
          <MetricCard
            hotel="mercure"
            label="Arr. / Dép. Mercure"
            value={mercureToday ? `${mercureToday.arrivals ?? 0} / ${mercureToday.departures ?? 0}` : '—'}
          />
          <MetricCard
            hotel="ibis"
            label="Ibis Occ."
            value={ibisForecastToday ? formatPct(ibisForecastToday.occupancy_pct) : '—'}
          />
          <MetricCard
            hotel="ibis"
            label="Arr. / Dép. Ibis"
            value={ibisToday ? `${ibisToday.arrivals ?? 0} / ${ibisToday.departures ?? 0}` : '—'}
          />
          <MetricCard
            color="green"
            label="PDJ Mercure"
            value={bfMercure}
          />
          <MetricCard
            color="amber"
            label="PDJ Ibis"
            value={bfIbis}
          />
        </div>
      </div>

      {/* Section 2+3 — Two-column: Events+Forecast LEFT, Yesterday RIGHT */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* LEFT column: Events + Forecast */}
        <div className="space-y-6">
          {/* Events */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Événements du jour</CardTitle>
                <Button variant="secondary" size="sm" onClick={() => setShowEventForm(v => !v)}>
                  <Plus size={14} /> Ajouter
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {showEventForm && (
                <div className="px-5 py-4 border-b border-[#C5C0B1] bg-[#F4F2ED]/50 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Nom de l'événement *"
                      value={eventForm.event_name}
                      onChange={e => setEventForm(f => ({ ...f, event_name: e.target.value }))}
                      className="col-span-2"
                    />
                    <Input
                      placeholder="Salle"
                      value={eventForm.room}
                      onChange={e => setEventForm(f => ({ ...f, room: e.target.value }))}
                    />
                    <Input
                      placeholder="Personnes"
                      type="number"
                      value={eventForm.persons}
                      onChange={e => setEventForm(f => ({ ...f, persons: e.target.value }))}
                      min="0"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={eventForm.type} onValueChange={v => setEventForm(f => ({ ...f, type: v }))}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={handleAddEvent} disabled={eventSaving || !eventForm.event_name}>
                      {eventSaving ? 'Ajout…' : 'Ajouter'}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setShowEventForm(false)}>Annuler</Button>
                  </div>
                </div>
              )}
              {events.length === 0 && !showEventForm ? (
                <p className="px-5 py-4 text-sm" style={{ color: '#C5C0B1' }}>Aucun événement aujourd&apos;hui.</p>
              ) : events.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Événement</TableHead>
                      <TableHead>Salle</TableHead>
                      <TableHead>Pers.</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map(ev => (
                      <TableRow key={ev.id}>
                        <TableCell className="font-medium">{ev.event_name}</TableCell>
                        <TableCell>{ev.room ?? '—'}</TableCell>
                        <TableCell>{ev.persons ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={eventBadgeVariant[ev.type] ?? 'default'}>
                            {ev.type === 'meeting' ? 'Réunion' : ev.type === 'banqueting' ? 'Banquet' : 'Événement'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* 10-day forecast */}
          <Card>
            <CardHeader>
              <CardTitle>Prévisions — 10 prochains jours</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Mercure</TableHead>
                    <TableHead>Ibis</TableHead>
                    <TableHead>PDJ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forecast.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center" style={{ color: '#C5C0B1' }}>
                        Aucune prévision disponible.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (() => {
                      const grouped: Record<string, { mercure?: ForecastOccupancy; ibis?: ForecastOccupancy }> = {}
                      for (const f of forecast) {
                        if (!grouped[f.forecast_date]) grouped[f.forecast_date] = {}
                        grouped[f.forecast_date][f.hotel_id as 'mercure' | 'ibis'] = f
                      }
                      return Object.entries(grouped).slice(0, 10).map(([forecastDate, hotels]) => (
                        <TableRow
                          key={forecastDate}
                          className={forecastDate === selectedDate ? 'bg-[#602460]/10' : ''}
                        >
                          <TableCell className={`font-medium text-xs ${forecastDate === selectedDate ? 'text-[#602460] font-semibold' : ''}`}>
                            {formatDate(forecastDate)}
                            {forecastDate === today && <span className="ml-1 text-[9px] text-[#602460] font-semibold">AUJ.</span>}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span style={occColor(hotels.mercure?.occupancy_pct)}>
                              {hotels.mercure ? formatPct(hotels.mercure.occupancy_pct) : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            <span style={occColor(hotels.ibis?.occupancy_pct)}>
                              {hotels.ibis ? formatPct(hotels.ibis.occupancy_pct) : '—'}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs">
                            {(() => {
                              const covers = (hotels.mercure?.breakfast_covers ?? 0) + (hotels.ibis?.breakfast_covers ?? 0)
                              return covers ? <span style={bfColor(covers)}>{covers}</span> : '—'
                            })()}
                          </TableCell>
                        </TableRow>
                      ))
                    })()
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT column: Yesterday's results */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#C5C0B1' }}>
            Résultats J-1 — {formatDate(new Date(new Date(selectedDate).getTime() - 86400000))}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard hotel="mercure" label="Mercure Occ." value={mercureYesterday ? formatPct(mercureYesterday.occupancy_pct) : '—'} />
            <MetricCard hotel="ibis" label="Ibis Occ." value={ibisYesterday ? formatPct(ibisYesterday.occupancy_pct) : '—'} />
            <MetricCard color="green" label="PDJ Total"
              value={(mercureYesterday?.breakfast_covers ?? 0) + (ibisYesterday?.breakfast_covers ?? 0)}
            />
            <MetricCard color="sky" label="Déjeuner"
              value={mercureYesterday?.lunch_covers ?? '—'}
            />
            <MetricCard color="purple" label="Dîner Mercure"
              value={mercureYesterday?.dinner_mercure_covers ?? '—'}
            />
            <MetricCard color="rose" label="Dîner Ibis"
              value={ibisYesterday?.dinner_ibis_covers ?? '—'}
            />
            <MetricCard color="amber" label="Banq. Déjeuner"
              value={mercureYesterday?.banquet_lunch_covers ?? '—'}
            />
            <MetricCard color="amber" label="Banq. Dîner"
              value={mercureYesterday?.banquet_dinner_covers ?? '—'}
            />
            <MetricCard color="sky" label="Room Service"
              value={mercureYesterday?.room_service_revenue ?? '—'}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
