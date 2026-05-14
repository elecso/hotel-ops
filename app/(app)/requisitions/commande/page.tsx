import { createClient } from '@/lib/supabase/server'
import { CommandeClient } from './CommandeClient'

export default async function CommandePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: products }, { data: orders }] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, type, unit, price_excl_tax, packaging_desc')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('purchase_orders')
      .select('*, lines:purchase_order_lines(*, product:products(name, unit))')
      .eq('created_by', user?.id ?? '')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <CommandeClient
      products={products ?? []}
      orders={orders ?? []}
      userId={user?.id ?? ''}
    />
  )
}
