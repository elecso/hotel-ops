import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { date, notes, attendees } = body

    if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

    const { data, error } = await getSupabase().from('morning_meeting').insert({
      meeting_date: date,
      notes: notes ?? '',
      attendees: Array.isArray(attendees) ? attendees : [],
      created_via: 'n8n',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
