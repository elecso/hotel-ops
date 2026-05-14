import { createClient } from '@/lib/supabase/server'
import { isoDate } from '@/lib/utils'
import { StatistiqueClient } from './StatistiqueClient'

export default async function StatistiquePage() {
  const supabase = await createClient()

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = isoDate(now)

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user?.id ?? '').single()

  const [{ data: stats }, { data: hotels }] = await Promise.all([
    supabase
      .from('daily_stats')
      .select('hotel_id, stat_date, occupancy_pct, rps, all_stars_count')
      .gte('stat_date', monthStart)
      .lte('stat_date', today)
      .order('stat_date', { ascending: false }),
    supabase
      .from('hotels')
      .select('id, name, occupancy_target'),
  ])

  const mercureStats = (stats ?? []).filter(s => s.hotel_id === 'mercure')
  const ibisStats    = (stats ?? []).filter(s => s.hotel_id === 'ibis')

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null
  const sum = (arr: (number | null)[]) => arr.reduce<number>((a, b) => a + (b ?? 0), 0)

  const getHotelTarget = (id: string) =>
    (hotels ?? []).find(h => h.id === id)?.occupancy_target ?? 80

  const monthLabel = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <StatistiqueClient
      month={monthLabel}
      mercure={{
        avgOccupancy: avg(mercureStats.map(s => s.occupancy_pct).filter(Boolean)) ?? null,
        target: getHotelTarget('mercure'),
        avgRps: avg(mercureStats.map(s => s.rps).filter((v): v is number => v != null)),
        totalAllStars: sum(mercureStats.map(s => s.all_stars_count)),
        daysWithData: mercureStats.length,
      }}
      ibis={{
        avgOccupancy: avg(ibisStats.map(s => s.occupancy_pct).filter(Boolean)) ?? null,
        target: getHotelTarget('ibis'),
        avgRps: avg(ibisStats.map(s => s.rps).filter((v): v is number => v != null)),
        totalAllStars: sum(ibisStats.map(s => s.all_stars_count)),
        daysWithData: ibisStats.length,
      }}
      isManager={profile?.role === 'admin' || profile?.role === 'manager'}
      today={today}
      userId={user?.id ?? ''}
    />
  )
}
