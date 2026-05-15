import { createClient } from '@/lib/supabase/server'
import type { ProductType } from '@/lib/types'
import { currentMonth } from '@/lib/utils'

export async function loadInventoryData(type: ProductType) {
  const supabase = await createClient()
  const month = currentMonth()

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user?.id ?? '')
    .single()

  const [
    { data: products },
    { data: suppliers },
    { data: categories },
    { data: roomTypes },
  ] = await Promise.all([
    supabase
      .from('products')
      .select('*, supplier:suppliers(*), category:product_categories(*), sub_products:beverage_sub_products(*), room_typologies:product_room_typologies(room_type_id)')
      .eq('type', type)
      .eq('is_active', true)
      .order('name'),
    supabase.from('suppliers').select('*').order('name'),
    supabase.from('product_categories').select('*').order('name'),
    supabase.from('room_types').select('*').order('hotel_id, code'),
  ])

  const { data: stockData } = await supabase
    .from('stock_months')
    .select('*')
    .eq('month', month)
    .in('product_id', (products ?? []).map((p: { id: number }) => p.id))

  const rows = (products ?? []).map((p: { id: number; min_stock?: number }) => {
    const stock = stockData?.find((s: { product_id: number }) => s.product_id === p.id) ?? null
    const theoretical = (stock?.opening_stock ?? 0) + (stock?.bought ?? 0) - (stock?.used ?? 0)
    return { product: p, stock, theoretical }
  })

  return {
    rows,
    month,
    suppliers: suppliers ?? [],
    categories: categories ?? [],
    roomTypes: roomTypes ?? [],
    isAdmin: profile?.role === 'admin',
  }
}
