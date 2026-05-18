import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createAdminClient()
  const { data, error } = await supabase.from('room_types').select('*').order('hotel_id, code')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const { product_id, room_type_ids } = await req.json()
  if (!product_id) return NextResponse.json({ error: 'product_id required' }, { status: 400 })

  const supabase = await createAdminClient()

  const { error: delErr } = await supabase
    .from('product_room_typologies')
    .delete()
    .eq('product_id', product_id)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  if (room_type_ids?.length > 0) {
    const { error: insErr } = await supabase
      .from('product_room_typologies')
      .insert(room_type_ids.map((id: number) => ({ product_id, room_type_id: id })))
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
