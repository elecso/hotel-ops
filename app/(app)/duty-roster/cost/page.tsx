import { createClient } from '@/lib/supabase/server'
import { getWeekStart, addDays, isoDate, formatDate, formatPct } from '@/lib/utils'

export default async function DutyRosterCostPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const weekStart = week ? new Date(week) : getWeekStart()
  const weekStartIso = isoDate(weekStart)
  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart, i)))

  const supabase = await createClient()

  const [
    { data: roster },
    { data: staff },
    { data: stats },
  ] = await Promise.all([
    supabase.from('duty_roster').select('*, staff:staff(*)').eq('week_start', weekStartIso),
    supabase.from('staff').select('*').eq('is_active', true),
    supabase.from('daily_stats').select('*').in('stat_date', weekDates),
  ])

  const receptionStaff = (staff ?? []).filter(s => s.service?.toLowerCase().includes('réception') || s.service?.toLowerCase().includes('reception'))
  const restaurantStaff = (staff ?? []).filter(s => s.service?.toLowerCase().includes('restaurant') || s.service?.toLowerCase().includes('f&b'))

  const countShift = (staffGroup: typeof staff, date: string, shift: 'morning' | 'afternoon') => {
    if (!staffGroup) return 0
    return staffGroup.filter(s =>
      (roster ?? []).some(r => r.staff_id === s.id && r.day_date === date && r.shift === shift && r.value && r.value !== 'RH')
    ).length
  }

  const getStat = (date: string, hotel: string) =>
    (stats ?? []).find(s => s.stat_date === date && s.hotel_id === hotel)

  const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  const rows = [
    {
      label: 'Taux occupation',
      values: weekDates.map(date => {
        const m = getStat(date, 'mercure')
        const ib = getStat(date, 'ibis')
        return { mercure: m?.occupancy_pct, ibis: ib?.occupancy_pct }
      }),
      render: (v: { mercure?: number; ibis?: number }) => (
        <div className="text-xs font-mono">
          <span style={{ color: '#602460' }}>{v.mercure != null ? `${v.mercure.toFixed(1)}%` : '—'}</span>
          {' / '}
          <span style={{ color: '#E8003D' }}>{v.ibis != null ? `${v.ibis.toFixed(1)}%` : '—'}</span>
        </div>
      ),
    },
    {
      label: 'Arrivées totales',
      values: weekDates.map(date => {
        const m = getStat(date, 'mercure')
        const ib = getStat(date, 'ibis')
        return (m?.arrivals ?? 0) + (ib?.arrivals ?? 0)
      }),
      render: (v: number) => <span className="font-mono">{v || '—'}</span>,
    },
    {
      label: 'Départs totaux',
      values: weekDates.map(date => {
        const m = getStat(date, 'mercure')
        const ib = getStat(date, 'ibis')
        return (m?.departures ?? 0) + (ib?.departures ?? 0)
      }),
      render: (v: number) => <span className="font-mono">{v || '—'}</span>,
    },
    {
      label: 'Agents réception — Matin',
      values: weekDates.map(date => countShift(receptionStaff, date, 'morning')),
      render: (v: number) => <span className="font-mono font-bold" style={{ color: '#602460' }}>{v}</span>,
    },
    {
      label: 'Agents réception — A-M',
      values: weekDates.map(date => Math.max(0, countShift(receptionStaff, date, 'afternoon') - 2)),
      render: (v: number) => <span className="font-mono font-bold" style={{ color: '#602460' }}>{v}</span>,
    },
    {
      label: 'Couverts petit-déjeuner',
      values: weekDates.map(date => {
        const m = getStat(date, 'mercure')
        const ib = getStat(date, 'ibis')
        return (m?.breakfast_covers ?? 0) + (ib?.breakfast_covers ?? 0)
      }),
      render: (v: number) => <span className="font-mono">{v || '—'}</span>,
    },
    {
      label: 'Agents restaurant — Matin',
      values: weekDates.map(date => countShift(restaurantStaff, date, 'morning')),
      render: (v: number) => <span className="font-mono font-bold" style={{ color: '#E8003D' }}>{v}</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <a
          href={`/duty-roster/cost?week=${isoDate(addDays(weekStart, -7))}`}
          className="h-9 w-9 flex items-center justify-center rounded-[6px] border border-[#C5C0B1] bg-white hover:bg-[#F4F2ED] text-[#3D1640]"
        >←</a>
        <span className="text-sm font-medium px-2">{formatDate(weekStartIso)} – {formatDate(isoDate(addDays(weekStart, 6)))}</span>
        <a
          href={`/duty-roster/cost?week=${isoDate(addDays(weekStart, 7))}`}
          className="h-9 w-9 flex items-center justify-center rounded-[6px] border border-[#C5C0B1] bg-white hover:bg-[#F4F2ED] text-[#3D1640]"
        >→</a>
      </div>

      <div className="bg-white rounded-[10px] border border-[#C5C0B1] overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ background: '#DFDBCF' }}>
              <th className="text-left px-4 py-2.5 font-semibold text-[#3D1640] min-w-[200px]">Indicateur</th>
              {weekDates.map((date, i) => (
                <th key={date} className="text-center px-3 py-2.5 font-semibold text-[#3D1640] min-w-[90px]">
                  {DAY_LABELS[i]}<br />
                  <span className="font-normal text-[11px]">{new Date(date + 'T00:00:00').getDate()}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-[#C5C0B1] even:bg-[#F4F2ED]/50">
                <td className="px-4 py-3 font-medium" style={{ background: '#F4F2ED', color: '#3D1640' }}>
                  {row.label}
                </td>
                {row.values.map((val, di) => (
                  <td key={di} className="px-3 py-3 text-center">
                    {row.render(val as never)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
