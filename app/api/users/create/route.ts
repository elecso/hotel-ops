import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { full_name, email, password, role, hotel_access } = await req.json()

    const adminClient = await createAdminClient()
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role, hotel_access },
    })

    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

    // Upsert profile (trigger should have done it, but ensure)
    await adminClient.from('user_profiles').upsert({
      id: authUser.user.id,
      full_name,
      role,
      hotel_access,
    })

    return NextResponse.json({
      user: {
        id: authUser.user.id,
        full_name,
        role,
        hotel_access,
        created_at: authUser.user.created_at,
      }
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
