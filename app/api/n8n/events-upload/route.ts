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

// Parse "DD/MM/YYYY" or "YYYY-MM-DD" → "YYYY-MM-DD"
function parseDate(d: string): string | null {
  if (!d) return null
  d = d.trim()
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  // DD/MM/YYYY
  const parts = d.split('/')
  if (parts.length === 3) {
    const [day, month, year] = parts
    if (year.length === 4) return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    // MM/DD/YYYY fallback — detect by year position
    if (day.length === 4) return `${day}-${month.padStart(2, '0')}-${parts[2].padStart(2, '0')}`
  }
  return null
}

// Extract person count: "42 pax", "26#", "15 pers"
function extractPersons(details: string): number | null {
  const m = details.match(/(\d+)\s*(?:pax|pers(?:onnes?)?|#)/i)
  return m ? parseInt(m[1]) : null
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Accept either { items: [...] } or a raw array [...]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: any[]
  if (Array.isArray(body)) {
    items = body
  } else if (body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)) {
    items = (body as { items: unknown[] }).items
  } else {
    return NextResponse.json({
      error: 'Body must be an array [...] or { items: [...] }',
      received: typeof body,
    }, { status: 400 })
  }

  if (items.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: 'Empty items array' })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const dates = new Set<string>()
  const rows: { event_date: string; event_name: string; room: string; persons: number | null; type: string }[] = []
  const skipped: string[] = []

  for (const item of items) {
    // Support date / Date / event_date keys
    const rawDate = String(item.date ?? item.Date ?? item.event_date ?? '')
    const isoDate = parseDate(rawDate)
    if (!isoDate) { skipped.push(`bad date: "${rawDate}"`); continue }

    // Support location / Location / room / salle keys
    const location = String(item.location ?? item.Location ?? item.room ?? item.salle ?? '').trim()
    // Support details / Details / event_name / nom keys
    const details  = String(item.details ?? item.Details ?? item.event_name ?? item.nom ?? '').trim()

    if (!location && !details) { skipped.push(`empty row for ${isoDate}`); continue }

    dates.add(isoDate)
    rows.push({
      event_date: isoDate,
      event_name: details || location,
      room:       location || details,
      persons:    extractPersons(details),
      type:       getType(location || details),
    })
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, inserted: 0, skipped, message: 'No valid rows parsed — check date format (DD/MM/YYYY) and field names (date, location, details)' })
  }

  // Delete existing events for all dates in batch, then re-insert
  for (const d of dates) {
    const { error: delErr } = await supabase.from('events').delete().eq('event_date', d)
    if (delErr) return NextResponse.json({ error: `Delete failed for ${d}: ${delErr.message}` }, { status: 500 })
  }

  const { error, count } = await supabase
    .from('events')
    .insert(rows, { count: 'exact' })

  if (error) return NextResponse.json({ error: error.message, rows_attempted: rows.length }, { status: 500 })

  return NextResponse.json({
    ok: true,
    inserted: count ?? rows.length,
    dates: [...dates],
    skipped: skipped.length ? skipped : undefined,
  })
}
