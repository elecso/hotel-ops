import { createClient } from '@/lib/supabase/server'
import { InventoryPage } from '@/components/inventory/InventoryPage'
import { loadInventoryData } from '@/lib/inventory-loader'

export default async function FoodInventoryPage() {
  const { suppliers, categories, roomTypes, isAdmin } = await loadInventoryData('food')
  const supabase = await createClient()

  const { data: products } = await supabase
    .from('products')
    .select('id, name, unit, price_excl_tax, packaging_desc, category:product_categories(name), supplier:suppliers(name)')
    .eq('type', 'food')
    .eq('is_active', true)
    .order('name')

  return (
    <InventoryPage
      rows={(products ?? []).map(p => ({ product: p, stock: null, theoretical: 0 }))}
      month={new Date().toISOString().substring(0, 7) + '-01'}
      suppliers={suppliers}
      categories={categories}
      roomTypes={roomTypes}
      isAdmin={isAdmin}
      type="food"
      salesOnly
    />
  )
}
