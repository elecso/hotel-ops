import { createClient } from '@/lib/supabase/server'
import { InvoicesClient } from './InvoicesClient'

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user?.id ?? '').single()

  const [
    { data: invoices },
    { data: suppliers },
    { data: products },
    { data: mappings },
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('*, supplier:suppliers(name), lines:invoice_lines(*, product:products(name))')
      .order('upload_date', { ascending: false })
      .limit(30),
    supabase.from('suppliers').select('id, name').order('name'),
    supabase
      .from('products')
      .select('id, name, unit, type')
      .eq('is_active', true)
      .order('name'),
    supabase.from('product_ai_mappings').select('*').eq('confirmed', true),
  ])

  return (
    <InvoicesClient
      invoices={invoices ?? []}
      suppliers={suppliers ?? []}
      products={products ?? []}
      confirmedMappings={mappings ?? []}
      userId={user?.id ?? ''}
      isManager={profile?.role === 'admin' || profile?.role === 'manager'}
    />
  )
}
