import { createClient } from '@/lib/supabase/server'
import { MeetingClient } from './MeetingClient'
import { isoDate, addDays } from '@/lib/utils'
import type { Event } from '@/lib/types'

// DB stores event_date 1 day ahead of the real date — compensate at the boundary
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export default async function MeetingPage() {
  const supabase = await createClient()
  const today = isoDate(new Date())

  // Query DB with +1 offset to fetch today's real events (stored as tomorrow in DB)
  const queryStart = shiftDate(today, 1)
  const queryEnd = shiftDate(today, 8)

  const { data: rawEvents } = await supabase
    .from('events')
    .select('*')
    .gte('event_date', queryStart)
    .lte('event_date', queryEnd)
    .order('event_date')
    .order('room')

  // Shift dates back -1 so the client sees the real event dates
  const events = (rawEvents ?? []).map(ev => ({ ...ev, event_date: shiftDate(ev.event_date, -1) }))

  return <MeetingClient today={today} events={events as Event[]} />
}
