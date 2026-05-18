import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const supabase = await createAdminClient()
  const { error } = await supabase.from('logbook_news').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
