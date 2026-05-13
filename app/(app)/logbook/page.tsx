import { createClient } from '@/lib/supabase/server'
import { isoDate } from '@/lib/utils'
import { LogbookClient } from './LogbookClient'

export default async function LogbookPage() {
  const today = isoDate(new Date())
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
    supabase.from('logbook_news').select('*').eq('news_date', today).order('id', { ascending: false }),
    supabase.from('morning_meeting').select('*').eq('meeting_date', today).order('id', { ascending: false }),
    supabase.from('toilet_checks').select('*').eq('check_date', today),
  ])

  const isAdmin = profile?.role === 'admin'

  return (
    <LogbookClient
      today={today}
      news={news ?? []}
      meetings={meetings ?? []}
      toiletChecks={toiletChecks ?? []}
      isAdmin={isAdmin}
    />
  )
}
