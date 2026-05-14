import { createClient } from '@/lib/supabase/server'
import { isoDate } from '@/lib/utils'
import { LogbookClient } from './LogbookClient'

export default async function LogbookPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date: dateParam } = await searchParams
  const selectedDate = dateParam ?? isoDate(new Date())
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  const [
    { data: news },
    { data: meetings },
    { data: toiletChecks },
  ] = await Promise.all([
    supabase.from('logbook_news').select('*').eq('news_date', selectedDate).order('id', { ascending: false }),
    supabase.from('morning_meeting').select('*').eq('meeting_date', selectedDate).order('id', { ascending: false }),
    supabase.from('toilet_checks').select('*').eq('check_date', selectedDate),
  ])

  const isAdmin = profile?.role === 'admin'

  return (
    <LogbookClient
      key={selectedDate}
      selectedDate={selectedDate}
      news={news ?? []}
      meetings={meetings ?? []}
      toiletChecks={toiletChecks ?? []}
      isAdmin={isAdmin}
    />
  )
}
