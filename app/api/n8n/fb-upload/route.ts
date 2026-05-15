import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { date?: string; items?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { date, items } = body
  if (!date || !Array.isArray(items)) {
    return NextResponse.json({ error: 'Body must contain { date: "YYYY-MM-DD", items: [...] }' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Dedup: if a record for this date already exists, don't create a duplicate
  const { data: existing } = await supabase
    .from('fb_imports')
    .select('id, status')
    .eq('import_date', date)
    .eq('source', 'n8n')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing?.status === 'validated') {
    // Already processed — skip silently
    return NextResponse.json({ ok: true, id: existing.id, skipped: true })
  }

  if (existing?.status === 'pending') {
    // Update raw_json on the existing pending record instead of inserting a new one
    const { error } = await supabase
      .from('fb_imports')
      .update({ raw_json: items })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: existing.id })
  }

  const { data, error } = await supabase
    .from('fb_imports')
    .insert({ import_date: date, source: 'n8n', status: 'pending', raw_json: items })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
