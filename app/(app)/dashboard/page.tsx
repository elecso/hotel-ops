import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'
import { isoDate } from '@/lib/utils'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date: dateParam } = await searchParams
  const selectedDate = dateParam ?? isoDate(new Date())
  const yesterday = isoDate(new Date(new Date(selectedDate).getTime() - 86400000))

  const supabase = await createClient()

  const [
    { data: todayStats },
    { data: yesterdayStats },
    { data: todayFbSales },
    { data: yesterdayFbSales },
    { data: todayEvents },
    { data: forecast },
  ] = await Promise.all([
    supabase.from('daily_stats').select('*').eq('stat_date', selectedDate),
    supabase.from('daily_stats').select('*').eq('stat_date', yesterday),
    supabase.from('fb_daily_sales').select('*').eq('sale_date', selectedDate),
    supabase.from('fb_daily_sales').select('*').eq('sale_date', yesterday),
    supabase.from('events').select('*').eq('event_date', selectedDate).order('event_name'),
    supabase
      .schema('forecast')
      .from('occupancy')
      .select('*')
      .gte('forecast_date', selectedDate)
      .order('forecast_date')
      .limit(10),
  ])

  return (
    <DashboardClient
      selectedDate={selectedDate}
      todayStats={todayStats ?? []}
      yesterdayStats={yesterdayStats ?? []}
      todayFbSales={todayFbSales ?? []}
      yesterdayFbSales={yesterdayFbSales ?? []}
      todayEvents={todayEvents ?? []}
      forecast={forecast ?? []}
    />
  )
}
