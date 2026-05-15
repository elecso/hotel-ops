import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  try {
    const { path } = await req.json()
    if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

    const admin = await createAdminClient()
    const { error } = await admin.storage.from('Invoice').remove([path])
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
