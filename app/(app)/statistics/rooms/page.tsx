import { createClient } from '@/lib/supabase/server'
import { StatisticsRoomsClient } from './StatisticsRoomsClient'

export default async function StatisticsRoomsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user?.id ?? '').single()

  const now = new Date()
  const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = now.toISOString().slice(0, 10)
  const yearStart = `${now.getFullYear()}-01-01`

  const [
    { data: dailyStatsMTD },
    { data: forecast },
    { data: budgetRows },
    { data: allStarsRows },
  ] = await Promise.all([
    supabase
      .from('daily_stats')
      .select('hotel_id, occupancy_pct, adr, rps')
      .gte('stat_date', currentMonthStart)
      .lte('stat_date', today),
    supabase
      .from('forecast.occupancy')
      .select('hotel_id, occupancy_pct')
      .gte('forecast_date', today),
    supabase
      .from('budget')
      .select('*')
      .gte('month', yearStart)
      .order('month'),
    supabase
      .from('hotel_all_stars')
      .select('*')
      .gte('month', yearStart)
      .order('month', { ascending: false }),
  ])

  const isManager = profile?.role === 'admin' || profile?.role === 'manager'

  return (
    <StatisticsRoomsClient
      dailyStatsMTD={dailyStatsMTD ?? []}
      forecast={forecast ?? []}
      budgetRows={budgetRows ?? []}
      allStarsRows={allStarsRows ?? []}
      currentMonth={currentMonthStart}
      isManager={isManager}
    />
  )
}
