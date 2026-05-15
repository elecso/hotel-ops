import { createClient } from '@/lib/supabase/server'
import { MeetingClient } from './MeetingClient'
import { isoDate } from '@/lib/utils'
import type { Event } from '@/lib/types'

export default async function MeetingPage() {
  const supabase = await createClient()
  const today = isoDate(new Date())
  const end = isoDate(new Date(Date.now() + 7 * 86400000))

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', today)
    .lte('event_date', end)
    .order('event_date')
    .order('room')

  return <MeetingClient today={today} events={(events ?? []) as Event[]} />
}
