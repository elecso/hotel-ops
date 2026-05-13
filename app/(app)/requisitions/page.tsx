import { createClient } from '@/lib/supabase/server'
import { RequisitionsClient } from './RequisitionsClient'

export default async function RequisitionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user?.id ?? '').single()

  const [{ data: products }, { data: myRequisitions }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, type, unit, supplier:suppliers(name)')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('requisitions')
      .select('*, lines:requisition_lines(*, product:products(name, unit))')
      .eq('requested_by', user?.id ?? '')
      .order('request_date', { ascending: false })
      .limit(20),
  ])

  return (
    <RequisitionsClient
      products={(products ?? []) as never}
      myRequisitions={(myRequisitions ?? []) as never}
      userId={user?.id ?? ''}
      role={profile?.role ?? 'readonly'}
    />
  )
}
