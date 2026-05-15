import { createClient } from '@/lib/supabase/server'
import { FoodInventoryPage } from '@/components/inventory/FoodInventoryPage'
import { loadInventoryData } from '@/lib/inventory-loader'
import { isoDate, currentMonth } from '@/lib/utils'

export default async function FoodPage() {
  const { isAdmin } = await loadInventoryData('food')
  const supabase = await createClient()

  const today = isoDate(new Date())
  const monthStart = currentMonth()

  const [{ data: menuItems }, { data: sales }] = await Promise.all([
    supabase.from('menu_items').select('id, name, outlet, category').eq('is_active', true).order('name'),
    supabase
      .from('menu_item_sales')
      .select('menu_item_id, quantity')
      .gte('sale_date', monthStart)
      .lte('sale_date', today),
  ])

  const salesByItem: Record<number, number> = {}
  for (const s of sales ?? []) {
    salesByItem[s.menu_item_id] = (salesByItem[s.menu_item_id] ?? 0) + Number(s.quantity)
  }

  const rows = (menuItems ?? []).map(mi => ({
    id: mi.id as number,
    name: mi.name as string,
    outlet: (mi.outlet as string) ?? '',
    category: (mi.category as string) ?? 'other',
    sales_mtd: salesByItem[mi.id as number] ?? 0,
  }))

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return <FoodInventoryPage rows={rows} isAdmin={isAdmin} monthLabel={monthLabel} />
}
