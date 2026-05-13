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
    const { date, title, body: newsBody, source } = body

    if (!date || !title) {
      return NextResponse.json({ error: 'date and title are required' }, { status: 400 })
    }

    const { data, error } = await getSupabase().from('logbook_news').insert({
      news_date: date,
      title,
      body: newsBody ?? '',
      source: source ?? 'n8n',
      created_via: 'n8n',
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const { data, error } = await getSupabase().from('logbook_news').select('*').eq('news_date', date).order('id', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
