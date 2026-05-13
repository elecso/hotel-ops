'use client'
import { useRouter } from 'next/navigation'
import { MetricCard } from '@/components/ui/card'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { formatDate, formatPct, isoDate } from '@/lib/utils'
import type { DailyStat, FbDailySale, Event, ForecastOccupancy } from '@/lib/types'

interface Props {
  selectedDate: string
  todayStats: DailyStat[]
  yesterdayStats: DailyStat[]
  todayFbSales: FbDailySale[]
  yesterdayFbSales: FbDailySale[]
  todayEvents: Event[]
  forecast: ForecastOccupancy[]
}

function getStat(stats: DailyStat[], hotelId: string) {
  return stats.find(s => s.hotel_id === hotelId)
}

function getSale(sales: FbDailySale[], outlet: string) {
  return sales.find(s => s.outlet === outlet)
}

const eventBadgeVariant: Record<string, 'meeting' | 'banqueting' | 'event'> = {
  meeting: 'meeting',
  banqueting: 'banqueting',
  event: 'event',
}

export function DashboardClient({ selectedDate, todayStats, yesterdayStats, todayFbSales, yesterdayFbSales, todayEvents, forecast }: Props) {
  const router = useRouter()

  const mercureToday = getStat(todayStats, 'mercure')
  const ibisToday = getStat(todayStats, 'ibis')
  const mercureYesterday = getStat(yesterdayStats, 'mercure')
  const ibisYesterday = getStat(yesterdayStats, 'ibis')

  const bfMercure = todayStats.find(s => s.hotel_id === 'mercure')?.breakfast_covers ?? 0
  const bfIbis = todayStats.find(s => s.hotel_id === 'ibis')?.breakfast_covers ?? 0

  const today = isoDate(new Date())
  const dateLabel = formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6 max-w-full">
      {/* Header with date picker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: '#C5C0B1' }}>Données du</p>
          <h2 className="text-2xl font-bold capitalize" style={{ color: '#602460' }}>
            {dateLabel}
          </h2>
        </div>
        <input
          type="date"
          value={selectedDate}
          max={today}
          onChange={e => router.push(`/dashboard?date=${e.target.value}`)}
          className="h-9 px-3 rounded-[6px] border border-[#C5C0B1] bg-white text-sm text-[#3D1640] focus:outline-none focus:ring-2 focus:ring-[#7E3A7E]"
        />
      </div>

      {/* Section 1 — Today's key figures */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#C5C0B1' }}>
          Chiffres clés du jour
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <MetricCard
            hotel="mercure"
            label="Mercure — Taux d'occupation"
            value={mercureToday ? formatPct(mercureToday.occupancy_pct) : '—'}
          />
          <MetricCard
            hotel="mercure"
            label="Mercure — Arrivées / Départs"
            value={mercureToday ? `${mercureToday.arrivals} / ${mercureToday.departures}` : '— / —'}
          />
          <MetricCard
            hotel="ibis"
            label="Ibis — Taux d'occupation"
            value={ibisToday ? formatPct(ibisToday.occupancy_pct) : '—'}
          />
          <MetricCard
            hotel="ibis"
            label="Ibis — Arrivées / Départs"
            value={ibisToday ? `${ibisToday.arrivals} / ${ibisToday.departures}` : '— / —'}
          />
        </div>
        {/* Breakfast card */}
        <div
          className="px-5 py-4 rounded-[10px] border border-[#C5C0B1] bg-white"
        >
          <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#602460' }}>
            Petits-déjeuners
          </p>
          <div className="flex items-center gap-6 text-lg font-bold font-mono">
            <span style={{ color: '#602460' }}>Mercure: <span className="text-2xl">{bfMercure}</span></span>
            <span className="text-[#C5C0B1]">|</span>
            <span style={{ color: '#E8003D' }}>Ibis: <span className="text-2xl">{bfIbis}</span></span>
            <span className="text-[#C5C0B1]">|</span>
            <span style={{ color: '#3D1640' }}>Total: <span className="text-2xl">{bfMercure + bfIbis}</span></span>
          </div>
        </div>
      </div>

      {/* Section 2 — Events of the day */}
      <Card>
        <CardHeader>
          <CardTitle>Événements du jour</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {todayEvents.length === 0 ? (
            <p className="px-5 py-4 text-sm" style={{ color: '#C5C0B1' }}>Aucun événement aujourd'hui.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Événement</TableHead>
                  <TableHead>Salle</TableHead>
                  <TableHead>Personnes</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {todayEvents.map(ev => (
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

      {/* Section 3 — 10-day forecast */}
      <Card>
        <CardHeader>
          <CardTitle>Prévisions — 10 prochains jours</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Mercure Occ.</TableHead>
                <TableHead>Ibis Occ.</TableHead>
                <TableHead>Petits-déjeuners</TableHead>
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
                  return Object.entries(grouped).map(([date, hotels]) => (
                    <TableRow
                      key={date}
                      className={date === selectedDate ? 'bg-[#602460]/10' : ''}
                    >
                      <TableCell className={`font-medium ${date === selectedDate ? 'text-[#602460] font-semibold' : ''}`}>
                        {formatDate(date)}
                        {date === today && <span className="ml-2 text-[10px] text-[#602460] font-semibold">AUJOURD'HUI</span>}
                      </TableCell>
                      <TableCell style={{ color: '#602460' }}>
                        {hotels.mercure ? formatPct(hotels.mercure.occupancy_pct) : '—'}
                      </TableCell>
                      <TableCell style={{ color: '#E8003D' }}>
                        {hotels.ibis ? formatPct(hotels.ibis.occupancy_pct) : '—'}
                      </TableCell>
                      <TableCell>
                        {(hotels.mercure?.breakfast_covers ?? 0) + (hotels.ibis?.breakfast_covers ?? 0) || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                })()
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Section 4 — Yesterday's results */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: '#C5C0B1' }}>
          Résultats J-1 — {formatDate(new Date(new Date(selectedDate).getTime() - 86400000))}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard hotel="mercure" label="Mercure Occ." value={mercureYesterday ? formatPct(mercureYesterday.occupancy_pct) : '—'} />
          <MetricCard hotel="ibis" label="Ibis Occ." value={ibisYesterday ? formatPct(ibisYesterday.occupancy_pct) : '—'} />
          <MetricCard hotel="neutral" label="Petits-déjeuners"
            value={(mercureYesterday?.breakfast_covers ?? 0) + (ibisYesterday?.breakfast_covers ?? 0)}
          />
          <MetricCard hotel="mercure" label="Dîner Mercure"
            value={getSale(yesterdayFbSales, 'dinner')?.covers ?? '—'}
            sub={getSale(yesterdayFbSales, 'dinner') ? `${getSale(yesterdayFbSales, 'dinner')!.revenue.toFixed(0)} €` : undefined}
          />
          <MetricCard hotel="ibis" label="Dîner Ibis"
            value="—"
          />
          <MetricCard hotel="neutral" label="Déjeuner"
            value={getSale(yesterdayFbSales, 'lunch')?.covers ?? '—'}
            sub={getSale(yesterdayFbSales, 'lunch') ? `${getSale(yesterdayFbSales, 'lunch')!.revenue.toFixed(0)} €` : undefined}
          />
          <MetricCard hotel="neutral" label="Banq. Déjeuner"
            value={getSale(yesterdayFbSales, 'banqueting_lunch')?.covers ?? '—'}
          />
          <MetricCard hotel="neutral" label="Banq. Dîner"
            value={getSale(yesterdayFbSales, 'banqueting_dinner')?.covers ?? '—'}
          />
          <MetricCard hotel="neutral" label="Room Service"
            value={getSale(yesterdayFbSales, 'room_service')?.revenue?.toFixed(0) ?? '—'}
            sub="€"
          />
        </div>
      </div>
    </div>
  )
}
