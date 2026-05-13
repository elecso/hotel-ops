import { createClient } from '@/lib/supabase/server'
import { getWeekStart, addDays, isoDate } from '@/lib/utils'
import { DutyRosterClient } from './DutyRosterClient'

export default async function DutyRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const { week } = await searchParams
  const weekStart = week ? new Date(week) : getWeekStart()
  const weekStartIso = isoDate(weekStart)
  const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart, i)))

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user?.id ?? '').single()

  const [
    { data: staff },
    { data: roster },
  ] = await Promise.all([
    supabase.from('staff').select('*').eq('is_active', true).order('service, full_name'),
    supabase
      .from('duty_roster')
      .select('*')
      .eq('week_start', weekStartIso)
      .in('day_date', weekDates),
  ])

  return (
    <DutyRosterClient
      weekStart={weekStartIso}
      weekDates={weekDates}
      staff={staff ?? []}
      roster={roster ?? []}
      isManager={profile?.role === 'admin' || profile?.role === 'manager'}
    />
  )
}
