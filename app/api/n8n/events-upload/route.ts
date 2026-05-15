import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const MEETING_KW  = ['ROUEN','DEAUVILLE','HONFLEUR','VEULES LES ROSES','ETRETAT','FECAMP','JUMIEGES','GIVERNY','HOULGATE','OUISTREAM','CABOURG','CINE LOUNGE']
const BANQUET_KW  = ['RESTO','PRESTIGE','PATIO','ESPACE REPAS IBIS','ROUEN']
const ROOMS_KW    = ['CHAMBRES MERCURE','CHAMBRES IBIS']

function getType(room: string): 'meeting' | 'banqueting' | 'event' {
  const r = room.toUpperCase()
  if (ROOMS_KW.some(k => r.includes(k)))   return 'event'
  if (BANQUET_KW.some(k => r.includes(k))) return 'banqueting'
  if (MEETING_KW.some(k => r.includes(k))) return 'meeting'
  return 'meeting'
}

// Parse "DD/MM/YYYY" → "YYYY-MM-DD"
function parseDate(d: string): string | null {
  const parts = d.split('/')
  if (parts.length !== 3) return null
  const [day, month, year] = parts
  if (!day || !month || !year) return null
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

// Extract person count from strings like "42 pax", "26#", "15 pers"
function extractPersons(details: string): number | null {
  const m = details.match(/(\d+)\s*(?:pax|pers(?:onnes?)?|#)/i)
  return m ? parseInt(m[1]) : null
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { items?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: 'Body must contain { items: [...] }' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = body.items as any[]

  // Collect unique dates in this batch to delete stale events before re-inserting
  const dates = new Set<string>()
  const rows: { event_date: string; event_name: string; room: string; persons: number | null; type: string }[] = []

  for (const item of items) {
    const rawDate = String(item.date ?? '')
    const isoDate = parseDate(rawDate)
    if (!isoDate) continue

    const location = String(item.location ?? '').trim()
    const details  = String(item.details  ?? '').trim()
    if (!location && !details) continue

    dates.add(isoDate)
    rows.push({
      event_date: isoDate,
      event_name: details || location,
      room:       location,
      persons:    extractPersons(details),
      type:       getType(location),
    })
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 })
  }

  // Delete existing events for all dates in this batch, then re-insert
  for (const d of dates) {
    await supabase.from('events').delete().eq('event_date', d)
  }

  const { error, count } = await supabase
    .from('events')
    .insert(rows, { count: 'exact' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, inserted: count ?? rows.length })
}
